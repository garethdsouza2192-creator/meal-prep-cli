import type { SupabaseServer } from "./supabase.server";
import { demoStore } from "./demo-store.server";
import type { MealSlot } from "./dates";
import { listDishes } from "./dishes.server";
import { isLocalEnvironment } from "./env.server";
import type { PlanMeal } from "./plan";

const LEGACY_FIELDS = "id, meal_date, meal_slot, dish_id, status, cooked_at";
const MODERN_FIELDS = "id, meal_date, meal_slot, dish_id, dish_ids, status, cooked_at";

function normalizeDishIds(value: string[] | string | null | undefined): string[] {
  const values = Array.isArray(value)
    ? value.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
    : value
      ? [value]
      : [];
  return Array.from(new Set(values.filter(Boolean)));
}

function getMealDishIds(meal: Partial<PlanMeal> | null | undefined): string[] {
  if (!meal) return [];

  const ids = normalizeDishIds((meal.dish_ids ?? []) as string[] | string | null | undefined);
  const legacyIds = normalizeDishIds((meal.dish_id ?? []) as string[] | string | null | undefined);

  if (ids.length === 0) {
    return legacyIds;
  }

  return Array.from(new Set([...ids, ...legacyIds].filter(Boolean)));
}

async function useLocalDemoPlanStore(
  supabase: SupabaseServer | null,
): Promise<boolean> {
  if (!supabase || !isLocalEnvironment()) return false;

  const { count, error } = await supabase
    .from("dishes")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return (count ?? 0) === 0;
}

export async function listPlanMealsInRange(
  supabase: SupabaseServer | null,
  startDate: string,
  endDate: string,
): Promise<PlanMeal[]> {
  if (!supabase) return demoStore.listPlanMealsInRange(startDate, endDate);
  if (await useLocalDemoPlanStore(supabase)) {
    return demoStore.listPlanMealsInRange(startDate, endDate);
  }

  let data: unknown[] | null = null;
  let error: { message: string } | null = null;

  const query = supabase.from("plan_meals").select(MODERN_FIELDS);
  const fallbackQuery = supabase.from("plan_meals").select(LEGACY_FIELDS);

  const modernResult = await query.gte("meal_date", startDate).lte("meal_date", endDate);
  if (modernResult.error) {
    const msg = modernResult.error.message ?? "";
    if (msg.includes('column "dish_ids"') || msg.includes("dish_ids")) {
      const fallbackResult = await fallbackQuery.gte("meal_date", startDate).lte("meal_date", endDate);
      data = fallbackResult.data ?? null;
      error = fallbackResult.error;
    } else {
      error = modernResult.error;
    }
  } else {
    data = modernResult.data ?? null;
  }

  if (error) throw error;

  return ((data ?? []) as PlanMeal[]).map((meal) => {
    const dish_ids = getMealDishIds(meal);
    return {
      ...meal,
      dish_ids,
      dish_id: dish_ids[0] ?? null,
    };
  });
}

export async function setPlanMeal(
  supabase: SupabaseServer | null,
  userId: string,
  meal_date: string,
  meal_slot: MealSlot,
  dish_ids: string[] | string,
): Promise<{ ok: true } | { error: string }> {
  const normalized = normalizeDishIds(dish_ids);
  if (normalized.length === 0) {
    return { error: "No dish selected." };
  }

  if (!supabase) {
    demoStore.setPlanMeal(meal_date, meal_slot, normalized);
    return { ok: true };
  }

  if (await useLocalDemoPlanStore(supabase)) {
    demoStore.setPlanMeal(meal_date, meal_slot, normalized);
    return { ok: true };
  }

  const basePayload = {
    user_id: userId,
    meal_date,
    meal_slot,
    dish_id: normalized[0],
    status: "planned",
    cooked_at: null,
  };

  const { error } = await supabase.from("plan_meals").upsert(
    {
      ...basePayload,
      dish_ids: normalized,
    },
    { onConflict: "user_id,meal_date,meal_slot" },
  );

  if (error && (error.message.includes('column "dish_ids"') || error.message.includes("dish_ids"))) {
    const retry = await supabase.from("plan_meals").upsert(basePayload, {
      onConflict: "user_id,meal_date,meal_slot",
    });
    return retry.error ? { error: retry.error.message } : { ok: true };
  }

  return error ? { error: error.message } : { ok: true };
}

export async function clearPlanMealsInRange(
  supabase: SupabaseServer | null,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) {
    demoStore.clearPlanMealsInRange(startDate, endDate);
    return { ok: true };
  }

  if (await useLocalDemoPlanStore(supabase)) {
    demoStore.clearPlanMealsInRange(startDate, endDate);
    return { ok: true };
  }

  const { error } = await supabase
    .from("plan_meals")
    .delete()
    .eq("user_id", userId)
    .gte("meal_date", startDate)
    .lte("meal_date", endDate);

  return error ? { error: error.message } : { ok: true };
}

export async function removePlanMeal(
  supabase: SupabaseServer | null,
  meal_date: string,
  meal_slot: MealSlot,
  dish_id?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) {
    demoStore.removePlanMeal(meal_date, meal_slot, dish_id);
    return { ok: true };
  }

  if (await useLocalDemoPlanStore(supabase)) {
    demoStore.removePlanMeal(meal_date, meal_slot, dish_id);
    return { ok: true };
  }

  if (dish_id) {
    const { data: existing, error: fetchErr } = await supabase
      .from("plan_meals")
      .select("dish_id, dish_ids")
      .eq("meal_date", meal_date)
      .eq("meal_slot", meal_slot)
      .maybeSingle();

    if (fetchErr) {
      const fallback = await supabase
        .from("plan_meals")
        .select("dish_id")
        .eq("meal_date", meal_date)
        .eq("meal_slot", meal_slot)
        .maybeSingle();

      if (fallback.error) return { error: fallback.error.message };

      const remaining = getMealDishIds(fallback.data).filter((id) => id !== dish_id);
      if (remaining.length === 0) {
        const { error } = await supabase
          .from("plan_meals")
          .delete()
          .eq("meal_date", meal_date)
          .eq("meal_slot", meal_slot);
        return error ? { error: error.message } : { ok: true };
      }

      const { error } = await supabase
        .from("plan_meals")
        .update({ dish_id: remaining[0] })
        .eq("meal_date", meal_date)
        .eq("meal_slot", meal_slot);
      return error ? { error: error.message } : { ok: true };
    }

    const remaining = getMealDishIds(existing).filter((id) => id !== dish_id);

    if (remaining.length === 0) {
      const { error } = await supabase
        .from("plan_meals")
        .delete()
        .eq("meal_date", meal_date)
        .eq("meal_slot", meal_slot);
      return error ? { error: error.message } : { ok: true };
    }

    const updatePayload = {
      dish_id: remaining[0],
      ...(existing && "dish_ids" in existing ? { dish_ids: remaining } : {}),
    };

    const { error } = await supabase
      .from("plan_meals")
      .update(updatePayload)
      .eq("meal_date", meal_date)
      .eq("meal_slot", meal_slot);

    if (error && (error.message.includes('column "dish_ids"') || error.message.includes("dish_ids"))) {
      const retry = await supabase
        .from("plan_meals")
        .update({ dish_id: remaining[0] })
        .eq("meal_date", meal_date)
        .eq("meal_slot", meal_slot);
      return retry.error ? { error: retry.error.message } : { ok: true };
    }

    return error ? { error: error.message } : { ok: true };
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

  if (await useLocalDemoPlanStore(supabase)) {
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
  return meals.filter((m) => getMealDishIds(m).length > 0).length;
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
    existing.flatMap((m) => getMealDishIds(m)),
  );

  let placed = 0;
  let skipped = 0;

  for (const date of args.days) {
    for (const slot of args.slots) {
      const cellKey = `${date}|${slot}`;
      const existingCell = existingByCell.get(cellKey);
      if (args.fillOnly && getMealDishIds(existingCell).length > 0) continue;

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
