import type { MealSlot } from "./dates";

export type PlanStatus = "planned" | "cooked" | "skipped";

export type PlanMeal = {
  id: string;
  meal_date: string;
  meal_slot: MealSlot;
  dish_id: string | null;
  status: PlanStatus;
  cooked_at: string | null;
};
