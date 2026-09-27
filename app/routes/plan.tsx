import { Form, Link, useActionData, useFetcher, useNavigation } from "react-router";
import { BookOpen, ShoppingCart, Wand2, X } from "lucide-react";
import { Button } from "~/components/ui/button";
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
import type { Dish } from "~/lib/dishes";
import { listDishes } from "~/lib/dishes.server";
import type { PlanMeal } from "~/lib/plan";
import {
  generatePlan,
  listPlanMealsInRange,
  removePlanMeal,
  setCookedStatus,
  setPlanMeal,
  type GenerateResult,
} from "~/lib/plan.server";
import { requireUser } from "~/lib/require-user.server";
import type { Route } from "./+types/plan";

const ENABLED_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Weekly plan · Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await requireUser(request);

  const start = startOfWeek(new Date());
  const days = weekDates(start);
  const startStr = toIsoDate(days[0]);
  const endStr = toIsoDate(days[days.length - 1]);

  const [dishes, plan] = await Promise.all([
    listDishes(supabase),
    listPlanMealsInRange(supabase, startStr, endStr),
  ]);

  return new Response(
    JSON.stringify({
      dishes,
      plan,
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
    const days = weekDates(startOfWeek(new Date())).map((d) => toIsoDate(d));
    const result = await generatePlan(supabase, user.id, {
      days,
      slots: ENABLED_SLOTS,
      fillOnly,
    });
    return result;
  }

  const meal_date = String(formData.get("meal_date") ?? "");
  const meal_slot = String(formData.get("meal_slot") ?? "") as MealSlot;

  if (intent === "set") {
    const dish_id = String(formData.get("dish_id") ?? "");
    if (!dish_id) return { error: "No dish selected." };
    const result = await setPlanMeal(supabase, user.id, meal_date, meal_slot, dish_id);
    return result;
  }

  if (intent === "remove") {
    return await removePlanMeal(supabase, meal_date, meal_slot);
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
  weekStart: string;
  weekLabel: string;
  days: string[];
  todayIso: string;
};

export default function Plan({ loaderData }: Route.ComponentProps) {
  const { dishes, plan, weekLabel, days, todayIso } = loaderData as LoaderData;
  const actionData = useActionData<typeof action>() as
    | GenerateResult
    | { ok?: true; error?: string }
    | undefined;
  const nav = useNavigation();
  const generating =
    nav.state === "submitting" &&
    nav.formData?.get("intent") === "generate";

  const planByCell = new Map<string, PlanMeal>();
  for (const m of plan) {
    planByCell.set(`${m.meal_date}|${m.meal_slot}`, m);
  }

  const hasAnyPlan = plan.some((m) => m.dish_id);
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
    <main className="mx-auto min-h-svh max-w-4xl px-4 py-8 sm:py-10">
      <PageHeader
        back={{ to: "/", label: "Home" }}
        title="Weekly plan"
        subtitle={weekLabel}
        action={
          dishes.length > 0 && (
            <div className="flex items-center gap-2">
              <Form method="post">
                <input type="hidden" name="intent" value="generate" />
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
              {hasAnyPlan && (
                <Button asChild>
                  <Link to="/grocery">
                    <ShoppingCart className="size-4" />
                    <span className="hidden sm:inline">Grocery list</span>
                  </Link>
                </Button>
              )}
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
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading font-medium">
                      {DAY_LABELS[i]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {date.slice(5)}
                    </span>
                  </div>
                  {isToday && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Today
                    </span>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ENABLED_SLOTS.map((slot) => (
                    <PlanCell
                      key={slot}
                      date={date}
                      slot={slot}
                      meal={planByCell.get(`${date}|${slot}`) ?? null}
                      dishes={dishes}
                    />
                  ))}
                </div>
              </div>
            );
          })}
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
};

function PlanCell({ date, slot, meal, dishes }: CellProps) {
  const fetcher = useFetcher();
  const dish = meal?.dish_id ? dishes.find((d) => d.id === meal.dish_id) : null;
  const cooked = meal?.status === "cooked";

  return (
    <div className="rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {slot}
      </div>
      {!meal || !dish ? (
        <fetcher.Form method="post" className="mt-1">
          <input type="hidden" name="intent" value="set" />
          <input type="hidden" name="meal_date" value={date} />
          <input type="hidden" name="meal_slot" value={slot} />
          <select
            name="dish_id"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) fetcher.submit(e.target.form);
            }}
            className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm"
          >
            <option value="">+ Add dish</option>
            {dishes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </fetcher.Form>
      ) : (
        <div className="mt-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/dishes/${dish.id}`}
              className={
                "block truncate text-sm font-medium hover:underline " +
                (cooked ? "text-muted-foreground line-through" : "")
              }
            >
              {dish.name}
            </Link>
            <fetcher.Form method="post" className="mt-1">
              <input type="hidden" name="intent" value="cooked" />
              <input type="hidden" name="meal_date" value={date} />
              <input type="hidden" name="meal_slot" value={slot} />
              <input type="hidden" name="cooked" value={cooked ? "false" : "true"} />
              <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={cooked}
                  onChange={(e) => fetcher.submit(e.target.form)}
                  className="size-3.5"
                />
                cooked
              </label>
            </fetcher.Form>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="remove" />
            <input type="hidden" name="meal_date" value={date} />
            <input type="hidden" name="meal_slot" value={slot} />
            <button
              type="submit"
              aria-label="Remove"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </Form>
        </div>
      )}
    </div>
  );
}
