import { useState, useEffect } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { BookOpen, ChevronLeft, ShoppingCart, Wand2, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { isFeatureEnabled } from "~/lib/feature-flags";
import { DishForm } from "~/components/dish-form";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import {
  DAY_LABELS,
  formatWeekRange,
  startOfWeek,
  toIsoDate,
  weekDates,
  type MealSlot,
} from "~/lib/dates";
import { MEAL_TYPES, type Dish } from "~/lib/dishes";
import { listDishes } from "~/lib/dishes.server";
import type { PlanMeal } from "~/lib/plan";
import {
  clearPlanMealsInRange,
  generatePlan,
  listPlanMealsInRange,
  removePlanMeal,
  setCookedStatus,
  setPlanMeal,
  type GenerateResult,
} from "~/lib/plan.server";
import { loadMealSlotConfig, saveMealSlotConfig } from "~/lib/meal-slot-config.server";
import { requireUser } from "~/lib/require-user.server";
import type { Route } from "./+types/plan";

const DEFAULT_MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const SLOT_STORAGE_KEY = "meal-prep-slot-config-v1";

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function getSelectedWeekStart(request: Request): Date {
  const url = new URL(request.url);
  const rawWeek = url.searchParams.get("week");
  const baseDate = rawWeek ? parseIsoDate(rawWeek) : new Date();
  return startOfWeek(baseDate);
}

function normalizeMealSlotList(slots: unknown[]): string[] {
  const cleaned = Array.from(
    new Set(
      slots
        .map((slot) => (slot == null ? "" : String(slot).trim()))
        .filter(Boolean),
    ),
  );

  return cleaned.length > 0 ? cleaned : DEFAULT_MEAL_SLOTS;
}

function getMealTypePriority(mealType: string): number {
  const index = MEAL_TYPES.indexOf(mealType as (typeof MEAL_TYPES)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortDishesByMealType(dishes: Dish[]): Dish[] {
  return [...dishes].sort((a, b) => {
    const aPriority = a.meal_types.length
      ? Math.min(...a.meal_types.map((mealType) => getMealTypePriority(mealType)))
      : Number.MAX_SAFE_INTEGER;
    const bPriority = b.meal_types.length
      ? Math.min(...b.meal_types.map((mealType) => getMealTypePriority(mealType)))
      : Number.MAX_SAFE_INTEGER;

    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.name.localeCompare(b.name);
  });
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Weekly plan · Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, user } = await requireUser(request);

  const start = getSelectedWeekStart(request);
  const days = weekDates(start);
  const startStr = toIsoDate(days[0]);
  const endStr = toIsoDate(days[days.length - 1]);

  const [dishes, plan, mealSlotConfig] = await Promise.all([
    listDishes(supabase),
    listPlanMealsInRange(supabase, startStr, endStr),
    loadMealSlotConfig(supabase, user.id),
  ]);

  return new Response(
    JSON.stringify({
      dishes,
      plan,
      mealSlotConfig,
      weekStart: toIsoDate(start),
      weekLabel: formatWeekRange(start),
      days: days.map((d) => toIsoDate(d)),
      todayIso: toIsoDate(new Date()),
    }),
    {
      headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" },
    },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, user } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "generate") {
    const fillOnly = formData.get("fill_only") !== "false";
    const weekInput = String(formData.get("week") ?? "");
    const selectedStart = weekInput ? startOfWeek(parseIsoDate(weekInput)) : startOfWeek(new Date());
    const days = weekDates(selectedStart).map((d) => toIsoDate(d));
    const result = await generatePlan(supabase, user.id, {
      days,
      slots: DEFAULT_MEAL_SLOTS,
      fillOnly,
    });
    return result;
  }

  if (intent === "clear-week") {
    const weekInput = String(formData.get("week") ?? "");
    const selectedStart = weekInput ? startOfWeek(parseIsoDate(weekInput)) : startOfWeek(new Date());
    const startDate = toIsoDate(selectedStart);
    const endDate = toIsoDate(weekDates(selectedStart)[weekDates(selectedStart).length - 1]);
    return await clearPlanMealsInRange(supabase, user.id, startDate, endDate);
  }

  const meal_date = String(formData.get("meal_date") ?? "");
  const meal_slot = String(formData.get("meal_slot") ?? "") as MealSlot;

  if (intent === "save-slot-config") {
    const rawConfig = String(formData.get("meal_slot_config") ?? "{}");

    try {
      const parsed = JSON.parse(rawConfig) as Record<string, string[]>;
      return await saveMealSlotConfig(supabase, user.id, parsed);
    } catch {
      return { error: "Unable to save meal slot configuration." };
    }
  }

  if (intent === "set") {
    const dishIds = formData.getAll("dish_ids").map((value) => String(value));
    const fallbackDishId = String(formData.get("dish_id") ?? "");
    const selectedIds = dishIds.length > 0 ? dishIds : fallbackDishId ? [fallbackDishId] : [];

    if (selectedIds.length === 0) return { error: "No dish selected." };

    const result = await setPlanMeal(supabase, user.id, meal_date, meal_slot, selectedIds);
    return result;
  }

  if (intent === "remove") {
    const dish_id = String(formData.get("dish_id") ?? "");
    return await removePlanMeal(supabase, meal_date, meal_slot, dish_id || undefined);
  }

  if (intent === "cooked") {
    const cooked = formData.get("cooked") === "true";
    return await setCookedStatus(supabase, meal_date, meal_slot, cooked);
  }

  return { error: "Unknown intent." };
}

type LoaderData = {
  dishes: Dish[];
  plan: PlanMeal[];
  mealSlotConfig: Record<string, string[]>;
  weekStart: string;
  weekLabel: string;
  days: string[];
  todayIso: string;
};

function getAssignedDishIds(meal: PlanMeal | null): string[] {
  if (!meal) return [];

  const dishIds = Array.isArray(meal.dish_ids)
    ? meal.dish_ids
    : meal.dish_ids
      ? [meal.dish_ids]
      : [];

  const legacyDishIds = Array.isArray(meal.dish_id)
    ? meal.dish_id
    : meal.dish_id
      ? [meal.dish_id]
      : [];

  const merged = [...dishIds, ...legacyDishIds];
  return Array.from(new Set(merged.filter(Boolean)));
}

export default function Plan({ loaderData }: Route.ComponentProps) {
  const { dishes, plan, mealSlotConfig, weekStart, weekLabel, days, todayIso } = loaderData as LoaderData;
  const orderedDishes = sortDishesByMealType(dishes);
  const actionData = useActionData<typeof action>() as
    | GenerateResult
    | { ok?: true; error?: string }
    | undefined;
  const nav = useNavigation();
  const generating =
    nav.state === "submitting" &&
    nav.formData?.get("intent") === "generate";

  const [mealSlotsByDay, setMealSlotsByDay] = useState<Record<string, string[]>>(() => {
    if (mealSlotConfig && Object.keys(mealSlotConfig).length > 0) {
      return Object.fromEntries(
        Object.entries(mealSlotConfig).map(([date, slots]) => [date, normalizeMealSlotList(Array.isArray(slots) ? slots : [])]),
      );
    }

    if (typeof window === "undefined") return {};

    try {
      const raw = window.localStorage.getItem(SLOT_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      return Object.fromEntries(
        Object.entries(parsed).map(([date, slots]) => [date, normalizeMealSlotList(Array.isArray(slots) ? slots : [])]),
      );
    } catch {
      return {};
    }
  });
  const [bulkMealName, setBulkMealName] = useState("Meal 4");
  const [isBulkMealInputOpen, setIsBulkMealInputOpen] = useState(false);
  const [isDishLibraryCollapsed, setIsDishLibraryCollapsed] = useState(false);
  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, string>>({});
  const holidayFeatureEnabled = isFeatureEnabled("HOLIDATES");

  useEffect(() => {
    if (!holidayFeatureEnabled || typeof window === "undefined") return;

    const getBrowserCountryCode = () => {
      const locales = [...(navigator.languages ?? []), navigator.language ?? "en-US"];

      for (const locale of locales) {
        const match = locale.match(/[-_](\w{2,3})$/i);
        if (match) return match[1].toUpperCase();
      }

      const resolvedLocale = Intl.DateTimeFormat().resolvedOptions().locale;
      const resolvedMatch = resolvedLocale.match(/[-_](\w{2,3})$/i);
      return resolvedMatch ? resolvedMatch[1].toUpperCase() : "US";
    };

    const year = new Date(`${weekStart}T00:00:00`).getFullYear();
    const countryCode = getBrowserCountryCode();
    const controller = new AbortController();

    fetch(`https://nagerholidays.com/api/v4/Holidays/${countryCode}/${year}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Holiday fetch failed: ${response.status}`);
        return response.json() as Promise<Array<{ date?: string; name?: string }>>;
      })
      .then((holidays) => {
        const nextMap: Record<string, string> = {};
        for (const holiday of holidays) {
          if (!holiday.date || !holiday.name) continue;
          nextMap[holiday.date] = holiday.name;
        }
        setHolidaysByDate(nextMap);
      })
      .catch(() => {
        setHolidaysByDate({});
      });

    return () => controller.abort();
  }, [holidayFeatureEnabled, weekStart]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SLOT_STORAGE_KEY, JSON.stringify(mealSlotsByDay));
    }
  }, [mealSlotsByDay]);

  const persistMealSlotConfig = async (nextConfig: Record<string, string[]>) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SLOT_STORAGE_KEY, JSON.stringify(nextConfig));
    }

    const formData = new FormData();
    formData.set("intent", "save-slot-config");
    formData.set("meal_slot_config", JSON.stringify(nextConfig));

    await fetch("/plan", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });
  };

  const prevWeek = new Date(`${weekStart}T00:00:00`);
  const nextWeek = new Date(`${weekStart}T00:00:00`);
  prevWeek.setDate(prevWeek.getDate() - 7);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const planByCell = new Map<string, PlanMeal>();
  for (const m of plan) {
    planByCell.set(`${m.meal_date}|${m.meal_slot}`, m);
  }

  const ensureSlotsForDate = (date: string, source: Record<string, string[]> = mealSlotsByDay): string[] => {
    const current = source[date] ?? DEFAULT_MEAL_SLOTS;
    return normalizeMealSlotList(Array.isArray(current) ? current : DEFAULT_MEAL_SLOTS);
  };

  const updateSlotsForDate = (date: string, slots: string[]) => {
    const cleaned = normalizeMealSlotList(slots);
    setMealSlotsByDay((previous) => {
      const nextState = {
        ...previous,
        [date]: cleaned,
      };
      void persistMealSlotConfig(nextState);
      return nextState;
    });
  };

  const addMealSlot = (date: string, name?: string) => {
    const daySlots = ensureSlotsForDate(date);
    const nextName = (name ?? `Meal ${daySlots.length + 1}`).trim();
    if (!nextName) return;

    const nextSlots = Array.from(new Set([...daySlots, nextName]));
    updateSlotsForDate(date, nextSlots);
  };

  const addMealSlotToAllDays = () => {
    const nextName = bulkMealName.trim();
    if (!nextName) return;

    setMealSlotsByDay((previous) => {
      const nextState = { ...previous };
      for (const date of days) {
        const current = ensureSlotsForDate(date, previous);
        nextState[date] = Array.from(new Set([...current, nextName]));
      }
      void persistMealSlotConfig(nextState);
      return nextState;
    });

    setBulkMealName("Meal 4");
    setIsBulkMealInputOpen(false);
  };

  const removeMealSlot = (date: string, slot: string) => {
    const daySlots = ensureSlotsForDate(date).filter((candidate) => candidate !== slot);
    updateSlotsForDate(date, daySlots);
  };

  const renameMealSlot = (date: string, oldSlot: string, nextValue: string) => {
    const nextName = nextValue.trim();
    if (!nextName) return;

    const daySlots = ensureSlotsForDate(date).map((slot) => (slot === oldSlot ? nextName : slot));
    updateSlotsForDate(date, daySlots);
  };

  const hasAnyPlan = plan.some((m) => getAssignedDishIds(m).length > 0);
  const generateMessage = (() => {
    if (!actionData || !("placed" in actionData)) return null;
    if (actionData.placed === 0 && actionData.skipped === 0) {
      return "Nothing to fill — every cell already has a dish.";
    }
    const parts = [`Filled ${actionData.placed} ${actionData.placed === 1 ? "meal" : "meals"}`];
    if (actionData.skipped > 0) parts.push(`${actionData.skipped} skipped`);
    return parts.join(" · ");
  })();

  return (
    <main className="mx-auto min-h-svh max-w-6xl px-4 py-8 sm:py-10">
      <PageHeader
        back={{ to: "/", label: "Home" }}
        title="Weekly plan"
        subtitle={weekLabel}
        action={
          dishes.length > 0 && (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-background/60 p-1">
                <Link
                  to={`/plan?week=${toIsoDate(prevWeek)}`}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Previous week"
                >
                  ←
                </Link>
                <Form method="get" className="flex items-center">
                  <input
                    type="date"
                    name="week"
                    value={weekStart}
                    onChange={(event) => {
                      const form = event.currentTarget.form;
                      if (form) form.requestSubmit();
                    }}
                    className="rounded-md border border-foreground/10 bg-background px-2 py-1 text-sm outline-none focus:border-violet-400"
                  />
                </Form>
                <Link
                  to={`/plan?week=${toIsoDate(nextWeek)}`}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Next week"
                >
                  →
                </Link>
                <Link
                  to={`/plan?week=${toIsoDate(startOfWeek(new Date()))}`}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  This week
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <Form method="post">
                  <input type="hidden" name="intent" value="generate" />
                  <input type="hidden" name="week" value={weekStart} />
                  <input
                    type="hidden"
                    name="fill_only"
                    value={hasAnyPlan ? "true" : "false"}
                  />
                  <Button type="submit" variant="secondary" disabled={generating}>
                    <Wand2 className="size-4" />
                    <span className="hidden sm:inline">
                      {generating ? "Filling…" : hasAnyPlan ? "Fill empty" : "Auto-fill"}
                    </span>
                  </Button>
                </Form>
                {isBulkMealInputOpen ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={bulkMealName}
                      onChange={(event) => setBulkMealName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") addMealSlotToAllDays();
                        if (event.key === "Escape") setIsBulkMealInputOpen(false);
                      }}
                      autoFocus
                      placeholder="Meal name"
                      className="rounded-md border border-foreground/10 bg-background px-2 py-1.5 text-sm outline-none focus:border-violet-400"
                    />
                    <button
                      type="button"
                      onClick={addMealSlotToAllDays}
                      className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 dark:border-violet-900/80 dark:bg-violet-950/60 dark:text-violet-200"
                    >
                      Add to all days
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsBulkMealInputOpen(true)}
                    className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 dark:border-violet-900/80 dark:bg-violet-950/60 dark:text-violet-200"
                  >
                    + Add daily meal
                  </button>
                )}
                <Form method="post" onSubmit={(event) => {
                  if (!window.confirm("Clear all meals for this week?")) {
                    event.preventDefault();
                  }
                }}>
                  <input type="hidden" name="intent" value="clear-week" />
                  <input type="hidden" name="week" value={weekStart} />
                  <Button type="submit" variant="secondary" className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                    Clear week
                  </Button>
                </Form>
                {hasAnyPlan && (
                  <Button asChild>
                    <Link to="/grocery">
                      <ShoppingCart className="size-4" />
                      <span className="hidden sm:inline">Grocery list</span>
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )
        }
      />

      {actionData && "error" in actionData && actionData.error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionData.error}
        </div>
      )}
      {generateMessage && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {generateMessage}
        </div>
      )}

      {dishes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No dishes to plan with"
          message="Add a few dishes first, then you can drop them into days and meals."
          action={
            <Button asChild>
              <Link to="/dishes/new">Add a dish</Link>
            </Button>
          }
        />
      ) : (
        <div
          className={
            isDishLibraryCollapsed
              ? "grid gap-2 xl:grid-cols-[56px_minmax(0,1fr)] xl:items-start"
              : "grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start"
          }
        >
          <aside
            className={[
              "hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 xl:sticky xl:top-6 xl:block",
              isDishLibraryCollapsed ? "h-[56px] w-[56px] justify-self-start p-2" : "w-full justify-self-start p-2 xl:w-[300px]",
            ].join(" ")}
          >
            <div
              className={[
                "grid items-center",
                isDishLibraryCollapsed
                  ? "h-[40px] w-[40px] grid-cols-1"
                  : "mb-3 min-h-[42px] grid-cols-[42px_minmax(0,1fr)] gap-3",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => setIsDishLibraryCollapsed((previous) => !previous)}
                className={[
                  "ml-0 inline-flex shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200/50 transition hover:border-violet-400 hover:text-foreground dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50",
                  isDishLibraryCollapsed ? "h-[40px] w-[40px]" : "h-[42px] w-[42px]",
                ].join(" ")}
                aria-label={isDishLibraryCollapsed ? "Expand dish library" : "Collapse dish library"}
                title={isDishLibraryCollapsed ? "Expand dish library" : "Collapse dish library"}
              >
                {isDishLibraryCollapsed ? <BookOpen className="size-4" /> : <ChevronLeft className="size-4" />}
              </button>

              <div
                className={[
                  "min-w-0 overflow-hidden",
                  isDishLibraryCollapsed
                    ? "pointer-events-none max-w-0 opacity-0"
                    : "max-w-full opacity-100",
                ].join(" ")}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Dish library
                </div>
                <div className="font-heading text-lg font-semibold">
                  {dishes.length} dishes
                </div>
              </div>
            </div>

            {!isDishLibraryCollapsed && (
              <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
                {orderedDishes.map((dish) => (
                  <div
                    key={dish.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", dish.id);
                      event.dataTransfer.setData("application/x-dish-id", dish.id);
                      event.dataTransfer.setData("application/x-dish-source", "library");
                      event.dataTransfer.setData("application/x-source", "library");
                      event.currentTarget.classList.add("opacity-40", "scale-[0.98]");
                    }}
                    onDragEnd={(event) => {
                      event.currentTarget.classList.remove("opacity-40", "scale-[0.98]");
                    }}
                    className="cursor-grab rounded-xl border border-foreground/10 bg-muted/40 p-3 text-left transition duration-150 hover:bg-muted active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{dish.name}</div>
                      </div>
                    </div>
                    {dish.meal_types.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {dish.meal_types.map((mealType) => (
                          <span
                            key={`${dish.id}-${mealType}`}
                            className="rounded-full bg-background px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground ring-1 ring-foreground/10"
                          >
                            {mealType}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>

          <div className="flex flex-col gap-3">
            {days.map((date, i) => {
              const isToday = date === todayIso;
              return (
                <div
                  key={date}
                  className={
                    "rounded-2xl bg-card p-4 ring-1 transition " +
                    (isToday ? "ring-foreground/30 shadow-sm" : "ring-foreground/10")
                  }
                >
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-heading font-medium">
                        {DAY_LABELS[i]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          dayPeriod: undefined,
                        })}
                      </span>
                    </div>

                    {holidayFeatureEnabled && holidaysByDate[date] && (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        {holidaysByDate[date]}
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      {isToday && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Today
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => addMealSlot(date)}
                        className="inline-flex items-center rounded-full border border-foreground/10 bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground transition hover:border-violet-400 hover:text-foreground"
                      >
                        + Add meal
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {ensureSlotsForDate(date).map((slot) => (
                      <PlanCell
                        key={`${date}-${slot}`}
                        date={date}
                        slot={slot}
                        meal={planByCell.get(`${date}|${slot}`) ?? null}
                        dishes={dishes}
                        onRenameSlot={(nextValue) => renameMealSlot(date, slot, nextValue)}
                        onRemoveSlot={() => removeMealSlot(date, slot)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

type CellProps = {
  date: string;
  slot: MealSlot;
  meal: PlanMeal | null;
  dishes: Dish[];
  onRenameSlot: (nextValue: string) => void;
  onRemoveSlot: () => void;
};

function PlanCell({ date, slot, meal, dishes, onRenameSlot, onRemoveSlot }: CellProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddDishOpen, setIsAddDishOpen] = useState(false);
  const [isNewDishDrawerOpen, setIsNewDishDrawerOpen] = useState(false);
  const [dishSearch, setDishSearch] = useState("");
  const [newDishError, setNewDishError] = useState<string | null>(null);
  const assignedDishIds = getAssignedDishIds(meal);

  const filteredDishes = sortDishesByMealType(
    dishes.filter((dish) => {
      const query = dishSearch.trim().toLowerCase();
      if (!query) return true;

      return (
        dish.name.toLowerCase().includes(query) ||
        dish.cuisine?.toLowerCase().includes(query) ||
        dish.meal_types.some((mealType) => mealType.toLowerCase().includes(query))
      );
    }),
  );

  const addDish = async (dishId: string) => {
    if (!dishId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const nextDishIds = Array.from(new Set([...assignedDishIds, dishId]));
      const formData = new FormData();
      formData.set("intent", "set");
      formData.set("meal_date", date);
      formData.set("meal_slot", slot);
      for (const id of nextDishIds) formData.append("dish_ids", id);

      const response = await fetch("/plan", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (response.ok) {
        window.location.reload();
      }
    } finally {
      setIsSubmitting(false);
      setIsAddDishOpen(false);
      setDishSearch("");
    }
  };

  const handleCreateDish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/dishes/new", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (response.ok) {
        setIsNewDishDrawerOpen(false);
        setNewDishError(null);
        window.location.reload();
        return;
      }

      setNewDishError("Unable to save the dish. Please check the form and try again.");
    } catch {
      setNewDishError("Unable to save the dish right now.");
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const dishId =
      event.dataTransfer.getData("application/x-dish-id") ||
      event.dataTransfer.getData("text/plain");

    if (!dishId || isSubmitting) return;

    const sourceDate = event.dataTransfer.getData("application/x-source-date");
    const sourceSlot = event.dataTransfer.getData("application/x-source-slot");
    const sourceDishId = event.dataTransfer.getData("application/x-source-dish-id");

    setIsSubmitting(true);

    try {
      if (sourceDate && sourceSlot && sourceDishId && (sourceDate !== date || sourceSlot !== slot)) {
        const removeFormData = new FormData();
        removeFormData.set("intent", "remove");
        removeFormData.set("meal_date", sourceDate);
        removeFormData.set("meal_slot", sourceSlot);
        removeFormData.set("dish_id", sourceDishId);

        await fetch("/plan", {
          method: "POST",
          body: removeFormData,
          credentials: "same-origin",
        });
      }

      const nextDishIds = Array.from(new Set([...assignedDishIds, dishId]));
      const formData = new FormData();
      formData.set("intent", "set");
      formData.set("meal_date", date);
      formData.set("meal_slot", slot);
      for (const id of nextDishIds) formData.append("dish_ids", id);

      const response = await fetch("/plan", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (response.ok) {
        window.location.reload();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!isSubmitting) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={
        "relative min-h-[80px] rounded-xl border bg-muted/40 p-3 transition " +
        (isDragOver ? "border-violet-400 bg-violet-50 dark:bg-violet-950/20" : "border-foreground/5")
      }
    >
      {isSubmitting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/75 backdrop-blur-[1px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-violet-500" />
            Saving…
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={slot}
          onChange={(event) => onRenameSlot(event.target.value)}
          className="w-full border-0 bg-transparent px-0 py-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground outline-none placeholder:text-muted-foreground/60"
          aria-label={`Meal slot name for ${date}`}
        />
        <button
          type="button"
          onClick={onRemoveSlot}
          aria-label={`Remove ${slot} meal slot`}
          className="cursor-pointer text-muted-foreground transition hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {assignedDishIds.length === 0 ? (
        <div className="mt-3">
          {!isAddDishOpen ? (
            <button
              type="button"
              onClick={() => setIsAddDishOpen(true)}
              className="flex max-h-[120px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-foreground/10 bg-background/40 px-3 py-4 text-center text-muted-foreground transition hover:border-violet-300 hover:bg-violet-50/40 hover:text-foreground dark:hover:bg-violet-950/20"
            >
              {/* <span className="text-xl font-light text-foreground/70">+</span> */}
              <span className="mt-1 hidden text-[12px] font-medium leading-tight tracking-tight text-foreground/70 sm:block">
                Drag a dish here
              </span>
              <span className="mt-0.5 text-[12px] italic text-foreground/50 sm:hidden">
                + Add dish
              </span>
              <span className="mt-0.5 hidden text-[12px] italic text-foreground/50 sm:block">
                or click to add
              </span>
            </button>
          ) : (
            <div className="space-y-2 rounded-2xl border border-foreground/10 bg-background/80 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Add dish
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddDishOpen(false);
                    setDishSearch("");
                  }}
                  aria-label="Close dish search"
                  className="inline-flex size-6 items-center justify-center rounded-full border border-foreground/10 bg-background text-muted-foreground transition hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={dishSearch}
                onChange={(event) => setDishSearch(event.target.value)}
                placeholder="Search dishes"
                autoFocus
                className="w-full rounded-md border border-foreground/10 bg-background px-2 py-1.5 text-sm outline-none focus:border-violet-400"
              />
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {filteredDishes.length === 0 ? (
                  <div className="space-y-2 px-2 py-1">
                    <div className="text-xs text-muted-foreground">No matching dishes</div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddDishOpen(false);
                        setDishSearch("");
                        setIsNewDishDrawerOpen(true);
                      }}
                      className="inline-flex w-full items-center justify-center rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5 text-xs font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
                    >
                      Missing a dish? Add a new one.
                    </button>
                  </div>
                ) : (
                  filteredDishes.map((dish) => (
                    <button
                      key={dish.id}
                      type="button"
                      onClick={() => addDish(dish.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-violet-200 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                    >
                      <span className="truncate text-sm font-medium">{dish.name}</span>
                      {dish.cuisine && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">{dish.cuisine}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {assignedDishIds.map((dishId) => {
            const dish = dishes.find((d) => d.id === dishId);
            if (!dish) return null;

            return (
              <div
                key={`${date}-${slot}-${dish.id}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", dish.id);
                  event.dataTransfer.setData("application/x-dish-id", dish.id);
                  event.dataTransfer.setData("application/x-source-date", date);
                  event.dataTransfer.setData("application/x-source-slot", slot);
                  event.dataTransfer.setData("application/x-source-dish-id", dish.id);
                  event.currentTarget.classList.add("opacity-40", "scale-[0.98]");
                }}
                onDragEnd={(event) => {
                  event.currentTarget.classList.remove("opacity-40", "scale-[0.98]");
                }}
                className="flex items-start justify-between gap-2 rounded-lg border border-foreground/10 bg-background/80 p-2 transition duration-150"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/dishes/${dish.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {dish.name}
                  </Link>
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="meal_date" value={date} />
                  <input type="hidden" name="meal_slot" value={slot} />
                  <input type="hidden" name="dish_id" value={dish.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${dish.name}`}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </Form>
              </div>
            );
          })}
        </div>
      )}

      {isNewDishDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[1px]">
          <div className="flex h-full w-full max-w-md flex-col border-l border-foreground/10 bg-background p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add a dish</div>
                <h3 className="text-xl font-semibold">New dish</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsNewDishDrawerOpen(false);
                  setNewDishError(null);
                }}
                className="inline-flex size-8 items-center justify-center rounded-full border border-foreground/10 bg-background text-muted-foreground transition hover:text-foreground"
                aria-label="Close add dish panel"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-y-auto">
              <DishForm
                submitLabel="Save dish"
                action="/dishes/new"
                onSubmit={handleCreateDish}
                error={newDishError}
                existingDishes={dishes}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
