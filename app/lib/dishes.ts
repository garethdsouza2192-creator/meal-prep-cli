import type { Ingredient } from "./ingredients";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export type Dish = {
  id: string;
  name: string;
  cuisine: string | null;
  meal_types: string[];
  prep_time_min: number | null;
  tags: string[];
  notes: string | null;
  ingredients: Ingredient[];
};

export type DishInput = {
  name: string;
  cuisine: string | null;
  meal_types: MealType[];
  prep_time_min: number | null;
  tags: string[];
  notes: string | null;
  ingredients: Ingredient[];
};
