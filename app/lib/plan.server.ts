import type { SupabaseServer } from "./supabase.server";
import { demoStore } from "./demo-store.server";
import type { MealSlot } from "./dates";
import { listDishes } from "./dishes.server";
import type { PlanMeal } from "./plan";

const FIELDS = "id, meal_date, meal_slot, dish_id, status, cooked_at";

export async function listPlanMealsInRange(
  supabase: SupabaseServer | null,
  startDate: string,
  endDate: string,
): Promise<PlanMeal[]> {
  if (!supabase) return demoStore.listPlanMealsInRange(startDate, endDate);
  const { data, error } = await supabase
    .from("plan_meals")
    .select(FIELDS)
    .gte("meal_date", startDate)
    .lte("meal_date", endDate);
  if (error) throw error;
  return (data ?? []) as PlanMeal[];
}

export async function setPlanMeal(
  supabase: SupabaseServer | null,
  userId: string,
  meal_date: string,
  meal_slot: MealSlot,
  dish_id: string,
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) {
    demoStore.setPlanMeal(meal_date, meal_slot, dish_id);
    return { ok: true };
  }
  const { error } = await supabase.from("plan_meals").upsert(
    {
      user_id: userId,
      meal_date,
      meal_slot,
      dish_id,
      status: "planned",
      cooked_at: null,
    },
    { onConflict: "user_id,meal_date,meal_slot" },
  );
  return error ? { error: error.message } : { ok: true };
}

export async function removePlanMeal(
  supabase: SupabaseServer | null,
  meal_date: string,
  meal_slot: MealSlot,
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) {
    demoStore.removePlanMeal(meal_date, meal_slot);
    return { ok: true };
  }
  const { error } = await supabase
    .from("plan_meals")
    .delete()
    .eq("meal_date", meal_date)
    .eq("meal_slot", meal_slot);
  return error ? { error: error.message } : { ok: true };
}

export async function setCookedStatus(
  supabase: SupabaseServer | null,
  meal_date: string,
  meal_slot: MealSlot,
  cooked: boolean,
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) {
    demoStore.setCookedStatus(meal_date, meal_slot, cooked);
    return { ok: true };
  }
  const { error } = await supabase
    .from("plan_meals")
    .update({
      status: cooked ? "cooked" : "planned",
      cooked_at: cooked ? new Date().toISOString() : null,
    })
    .eq("meal_date", meal_date)
    .eq("meal_slot", meal_slot);
  return error ? { error: error.message } : { ok: true };
}

export async function countPlannedThisWeek(
  supabase: SupabaseServer | null,
  startDate: string,
  endDate: string,
): Promise<number> {
  const meals = await listPlanMealsInRange(supabase, startDate, endDate);
  return meals.filter((m) => m.dish_id !== null).length;
}

export type GenerateResult =
  | { ok: true; placed: number; skipped: number }
  | { error: string };

export async function generatePlan(
  supabase: SupabaseServer | null,
  userId: string,
  args: {
    days: string[];
    slots: MealSlot[];
    fillOnly?: boolean;
  },
): Promise<GenerateResult> {
  const dishes = await listDishes(supabase);
  if (dishes.length === 0) {
    return { error: "Add a dish first — there's nothing to plan with." };
  }

  const existing = await listPlanMealsInRange(
    supabase,
    args.days[0],
    args.days[args.days.length - 1],
  );
  const existingByCell = new Map<string, PlanMeal>();
  for (const m of existing) existingByCell.set(`${m.meal_date}|${m.meal_slot}`, m);

  const usedDishIds = new Set<string>(
    existing.filter((m) => m.dish_id).map((m) => m.dish_id as string),
  );

  let placed = 0;
  let skipped = 0;

  for (const date of args.days) {
    for (const slot of args.slots) {
      const cellKey = `${date}|${slot}`;
      const existingCell = existingByCell.get(cellKey);
      if (args.fillOnly && existingCell?.dish_id) continue;

      const slotCandidates = dishes.filter(
        (d) => d.meal_types.length === 0 || d.meal_types.includes(slot),
      );
      const fresh = slotCandidates.filter((d) => !usedDishIds.has(d.id));
      const pool = fresh.length > 0 ? fresh : slotCandidates;

      if (pool.length === 0) {
        skipped++;
        continue;
      }

      const pick = pool[Math.floor(Math.random() * pool.length)];
      const result = await setPlanMeal(supabase, userId, date, slot, pick.id);
      if ("error" in result) {
        skipped++;
      } else {
        usedDishIds.add(pick.id);
        placed++;
      }
    }
  }

  return { ok: true, placed, skipped };
}
