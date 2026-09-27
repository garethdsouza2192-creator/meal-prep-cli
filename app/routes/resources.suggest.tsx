import { MEAL_TYPES, type MealType } from "~/lib/dishes";
import { requireUser } from "~/lib/require-user.server";
import { getSuggestions } from "~/lib/suggest.server";
import type { SuggestMode, SuggestRequest } from "~/lib/suggest";
import type { Route } from "./+types/resources.suggest";

export async function action({ request }: Route.ActionArgs) {
  const { supabase } = await requireUser(request);
  const formData = await request.formData();

  const mode = formData.get("mode") === "pantry" ? "pantry" : ("tonight" as SuggestMode);
  const fallback = formData.get("fallback") === "true";

  const cuisineRaw = String(formData.get("cuisine") ?? "").trim();
  const maxPrepRaw = String(formData.get("max_prep_time") ?? "").trim();
  const mealTypeRaw = String(formData.get("meal_type") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const pantry = String(formData.get("pantry_snapshot") ?? "").trim();

  const filters: SuggestRequest["filters"] = {};
  if (cuisineRaw) filters.cuisine = cuisineRaw;
  if (maxPrepRaw) {
    const n = Number.parseInt(maxPrepRaw, 10);
    if (!Number.isNaN(n)) filters.max_prep_time = n;
  }
  if (MEAL_TYPES.includes(mealTypeRaw as MealType)) {
    filters.meal_type = mealTypeRaw as MealType;
  }
  if (tagsRaw) {
    filters.tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const result = await getSuggestions(
    supabase,
    {
      mode,
      filters: Object.keys(filters).length ? filters : undefined,
      pantry_snapshot: mode === "pantry" ? pantry : undefined,
    },
    { fallback },
  );

  if (!result.ok && result.error === "ai_unavailable") {
    return new Response(JSON.stringify(result), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
}
