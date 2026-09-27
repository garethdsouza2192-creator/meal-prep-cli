import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Apple,
  Calendar,
  Check,
  Copy,
  Drumstick,
  Egg,
  LeafyGreen,
  Package,
  RotateCcw,
  ShoppingCart,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { startOfWeek, toIsoDate, weekDates } from "~/lib/dates";
import type { Dish } from "~/lib/dishes";
import { listDishes } from "~/lib/dishes.server";
import {
  GROCERY_CATEGORIES,
  categorizeIngredient,
  groceryListFromPlan,
  type GroceryCategory,
  type GroceryItem,
} from "~/lib/ingredients";
import { listPlanMealsInRange } from "~/lib/plan.server";
import { requireUser } from "~/lib/require-user.server";
import type { Route } from "./+types/grocery";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Grocery list · Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await requireUser(request);

  const start = startOfWeek(new Date());
  const days = weekDates(start);
  const startStr = toIsoDate(days[0]);
  const endStr = toIsoDate(days[days.length - 1]);

  const [allDishes, plan] = await Promise.all([
    listDishes(supabase),
    listPlanMealsInRange(supabase, startStr, endStr),
  ]);

  const dishesById = new Map(allDishes.map((d) => [d.id, d]));
  const plannedDishes: Dish[] = [];
  for (const m of plan) {
    if (!m.dish_id) continue;
    if (m.status === "skipped") continue;
    const dish = dishesById.get(m.dish_id);
    if (dish) plannedDishes.push(dish);
  }

  return new Response(
    JSON.stringify({ plannedDishes, weekStart: toIsoDate(start) }),
    {
      headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" },
    },
  );
}

type LoaderData = { plannedDishes: Dish[]; weekStart: string };

const itemKey = (item: GroceryItem) => `${item.name.toLowerCase()}|${item.unit ?? ""}`;

export default function Grocery({ loaderData }: Route.ComponentProps) {
  const { plannedDishes, weekStart } = loaderData as LoaderData;
  const [haveSnapshot, setHaveSnapshot] = useState("");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const storageKey = `mealprep.grocery.${weekStart}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") setOverrides(parsed);
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(overrides));
  }, [storageKey, overrides]);

  const items = useMemo(
    () => groceryListFromPlan({ plannedDishes, haveSnapshot }),
    [plannedDishes, haveSnapshot],
  );

  function isChecked(item: GroceryItem): boolean {
    const key = itemKey(item);
    return key in overrides ? overrides[key] : item.alreadyHave;
  }

  function toggle(item: GroceryItem) {
    const key = itemKey(item);
    setOverrides((prev) => ({ ...prev, [key]: !isChecked(item) }));
  }

  function resetChecks() {
    setOverrides({});
  }

  const checkedCount = items.filter(isChecked).length;
  const remainingCount = items.length - checkedCount;

  const grouped = useMemo(() => {
    const map = new Map<GroceryCategory, GroceryItem[]>();
    for (const item of items) {
      const cat = categorizeIngredient(item.name);
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return GROCERY_CATEGORIES
      .map((category) => ({ category, items: map.get(category) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [items]);

  function copyList() {
    const text = items.filter((i) => !isChecked(i)).map(formatItem).join("\n");
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <main className="mx-auto min-h-svh max-w-6xl px-4 py-8 sm:py-10">
      <PageHeader
        back={{ to: "/", label: "Home" }}
        title="Grocery list"
        subtitle="From the meals you've planned this week."
      />

      {plannedDishes.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nothing planned this week"
          message="Drop a few dishes into the weekly plan and your grocery list will appear here."
          action={
            <Button asChild>
              <Link to="/plan">Open the weekly plan</Link>
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No ingredients yet"
          message="Your planned dishes don't have ingredients listed. Open a dish and add a few to populate the list."
          action={
            <Button asChild variant="secondary">
              <Link to="/dishes">Open dishes</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-2">
            <Label htmlFor="have">What I already have</Label>
            <Textarea
              id="have"
              value={haveSnapshot}
              onChange={(e) => setHaveSnapshot(e.target.value)}
              rows={2}
              placeholder="rice, dal, 2 onions, paneer"
            />
            <p className="text-xs text-muted-foreground">
              Quick-marks matching items as already have. Tap any row to override.
            </p>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{remainingCount}</span>{" "}
              to buy
              {checkedCount > 0 && (
                <>
                  {" · "}
                  <span>{checkedCount} got</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {checkedCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetChecks}
                  title="Uncheck all"
                >
                  <RotateCcw className="size-4" />
                  <span className="hidden sm:inline">Reset</span>
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={copyList}
                disabled={remainingCount === 0}
              >
                {copied ? (
                  <>
                    <Check className="size-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.map(({ category, items: catItems }) => {
              const remainingInCat = catItems.filter((i) => !isChecked(i)).length;
              const meta = CATEGORY_META[category];
              const Icon = meta.icon;
              return (
                <section
                  key={category}
                  className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10"
                >
                  <header className="flex items-center justify-between gap-3 border-b border-foreground/5 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`grid size-8 place-items-center rounded-lg ring-1 ${meta.tone}`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <h2 className="font-heading text-sm font-medium">{category}</h2>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {remainingInCat === 0
                        ? `${catItems.length} (all set)`
                        : `${remainingInCat} of ${catItems.length}`}
                    </span>
                  </header>
                  <ul className="divide-y divide-foreground/5">
                    {catItems.map((item, i) => {
                      const checked = isChecked(item);
                      return (
                        <li
                          key={`${itemKey(item)}-${i}`}
                          className="group"
                        >
                          <label
                            className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-muted/40 active:bg-muted/60"
                          >
                            <span
                              className={
                                "grid size-5 shrink-0 place-items-center rounded-md border transition " +
                                (checked
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-foreground/30 bg-card group-hover:border-foreground/60")
                              }
                              aria-hidden
                            >
                              {checked && <Check className="size-3.5" strokeWidth={3} />}
                            </span>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => toggle(item)}
                            />
                            <span
                              className={
                                "flex-1 " +
                                (checked ? "text-muted-foreground line-through" : "")
                              }
                            >
                              {formatItem(item)}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

const CATEGORY_META: Record<
  GroceryCategory,
  { icon: LucideIcon; tone: string }
> = {
  Produce: {
    icon: Apple,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50",
  },
  "Meat & seafood": {
    icon: Drumstick,
    tone: "bg-rose-50 text-rose-700 ring-rose-200/50 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50",
  },
  "Dairy & eggs": {
    icon: Egg,
    tone: "bg-amber-50 text-amber-700 ring-amber-200/50 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50",
  },
  "Dry goods": {
    icon: Wheat,
    tone: "bg-yellow-50 text-yellow-800 ring-yellow-200/50 dark:bg-yellow-950/40 dark:text-yellow-300 dark:ring-yellow-900/50",
  },
  Pantry: {
    icon: Package,
    tone: "bg-orange-50 text-orange-700 ring-orange-200/50 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900/50",
  },
  "Spices & herbs": {
    icon: LeafyGreen,
    tone: "bg-lime-50 text-lime-700 ring-lime-200/50 dark:bg-lime-950/40 dark:text-lime-300 dark:ring-lime-900/50",
  },
  Other: {
    icon: ShoppingCart,
    tone: "bg-muted text-foreground ring-foreground/10",
  },
};

function formatItem(item: GroceryItem): string {
  const parts: string[] = [];
  if (item.quantity != null) parts.push(formatQty(item.quantity));
  if (item.unit) parts.push(item.unit);
  parts.push(item.name);
  return parts.join(" ");
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}
