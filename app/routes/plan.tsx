import { useState } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
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

          <aside className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Dish library
                </div>
                <div className="font-heading text-lg font-semibold">
                  {dishes.length} dishes
                </div>
              </div>
            </div>

            <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
              {dishes.map((dish) => (
                <div
                  key={dish.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", dish.id);
                    event.dataTransfer.setData("application/x-dish-id", dish.id);
                  }}
                  className="cursor-grab rounded-xl border border-foreground/10 bg-muted/40 p-3 text-left transition hover:bg-muted active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{dish.name}</div>
                      {dish.cuisine && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {dish.cuisine}
                        </div>
                      )}
                    </div>
                    {dish.prep_time_min && (
                      <span className="rounded-full bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground ring-1 ring-foreground/10">
                        {dish.prep_time_min} min
                      </span>
                    )}
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
          </aside>
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const assignedDishIds = getAssignedDishIds(meal);
  const cooked = meal?.status === "cooked";

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const dishId =
      event.dataTransfer.getData("application/x-dish-id") ||
      event.dataTransfer.getData("text/plain");

    if (!dishId || isSubmitting) return;

    setIsSubmitting(true);

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

    setIsSubmitting(false);

    if (response.ok) {
      window.location.reload();
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
        "relative min-h-[118px] rounded-xl border bg-muted/40 p-3 transition " +
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
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {slot}
        </div>
        {assignedDishIds.length === 0 && !isSubmitting && (
          <span className="text-[10px] text-muted-foreground">Drop here</span>
        )}
      </div>

      {assignedDishIds.length === 0 ? (
        <div className="mt-3 flex h-[56px] items-center justify-center rounded-lg border border-dashed border-foreground/10 text-sm text-muted-foreground">
          Drag a dish here
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {assignedDishIds.map((dishId) => {
            const dish = dishes.find((d) => d.id === dishId);
            if (!dish) return null;

            return (
              <div
                key={`${date}-${slot}-${dish.id}`}
                className="flex items-start justify-between gap-2 rounded-lg border border-foreground/10 bg-background/80 p-2"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/dishes/${dish.id}`}
                    className={
                      "block truncate text-sm font-medium hover:underline " +
                      (cooked ? "text-muted-foreground line-through" : "")
                    }
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
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </Form>
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}
