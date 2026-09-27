import type { Dish, MealType } from "./dishes";

export type SuggestMode = "tonight" | "pantry";

export type SuggestFilters = {
  cuisine?: string;
  max_prep_time?: number;
  meal_type?: MealType;
  tags?: string[];
};

export type SuggestRequest = {
  mode: SuggestMode;
  filters?: SuggestFilters;
  pantry_snapshot?: string;
};

export type Suggestion = { dish: Dish; reason: string };

export type SuggestResult =
  | { ok: true; picks: Suggestion[]; ranked_by: "ai" | "rules" }
  | { ok: false; error: "no_candidates" | "ai_unavailable" };
