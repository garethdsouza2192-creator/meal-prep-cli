import type { SupabaseServer } from "./supabase.server";
import { demoStore } from "./demo-store.server";
import { parseIngredientsText, type Ingredient } from "./ingredients";
import { MEAL_TYPES, type Dish, type DishInput } from "./dishes";

const DISH_FIELDS =
  "id, name, cuisine, meal_types, prep_time_min, tags, notes, dish_ingredients(name, quantity, unit, position)";

type DishRow = Omit<Dish, "ingredients"> & {
  dish_ingredients: Ingredient[] | null;
};

function rowToDish(row: DishRow): Dish {
  const { dish_ingredients, ...rest } = row;
  return {
    ...rest,
    ingredients: (dish_ingredients ?? [])
      .slice()
      .sort((a, b) => a.position - b.position),
  };
}

export function parseDishForm(formData: FormData): DishInput | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const cuisine = String(formData.get("cuisine") ?? "").trim() || null;

  const meal_types = MEAL_TYPES.filter((t) =>
    formData.getAll("meal_types").includes(t),
  );

  const prepRaw = String(formData.get("prep_time_min") ?? "").trim();
  const prep_time_min = prepRaw === "" ? null : Number.parseInt(prepRaw, 10);
  if (prep_time_min !== null && (Number.isNaN(prep_time_min) || prep_time_min < 0)) {
    return { error: "Prep time must be a non-negative number." };
  }

  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const notes = String(formData.get("notes") ?? "").trim() || null;
  const ingredients = parseIngredientsText(String(formData.get("ingredients") ?? ""));

  return { name, cuisine, meal_types, prep_time_min, tags, notes, ingredients };
}

export async function listDishes(supabase: SupabaseServer | null): Promise<Dish[]> {
  if (!supabase) return demoStore.listDishes();
  const { data, error } = await supabase
    .from("dishes")
    .select(DISH_FIELDS)
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DishRow[]).map(rowToDish);
}

export async function getDish(
  supabase: SupabaseServer | null,
  id: string,
): Promise<Dish | null> {
  if (!supabase) return demoStore.getDish(id);
  const { data, error } = await supabase
    .from("dishes")
    .select(DISH_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToDish(data as DishRow) : null;
}

export async function countDishes(supabase: SupabaseServer | null): Promise<number> {
  if (!supabase) return demoStore.countDishes();
  const { count, error } = await supabase
    .from("dishes")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function createDish(
  supabase: SupabaseServer | null,
  userId: string,
  input: DishInput,
): Promise<{ id: string } | { error: string }> {
  if (!supabase) return { id: demoStore.createDish(input).id };

  const { ingredients, ...dishFields } = input;
  const { data, error } = await supabase
    .from("dishes")
    .insert({ ...dishFields, user_id: userId })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save dish." };

  if (ingredients.length > 0) {
    const { error: ingErr } = await supabase
      .from("dish_ingredients")
      .insert(ingredients.map((i) => ({ ...i, dish_id: data.id })));
    if (ingErr) return { error: ingErr.message };
  }

  return { id: data.id };
}

export async function updateDish(
  supabase: SupabaseServer | null,
  id: string,
  input: DishInput,
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) {
    const updated = demoStore.updateDish(id, input);
    return updated ? { ok: true } : { error: "Dish not found." };
  }

  const { ingredients, ...dishFields } = input;
  const { error } = await supabase.from("dishes").update(dishFields).eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("dish_ingredients").delete().eq("dish_id", id);
  if (ingredients.length > 0) {
    const { error: ingErr } = await supabase
      .from("dish_ingredients")
      .insert(ingredients.map((i) => ({ ...i, dish_id: id })));
    if (ingErr) return { error: ingErr.message };
  }

  return { ok: true };
}

export async function deleteDish(
  supabase: SupabaseServer | null,
  id: string,
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) {
    demoStore.deleteDish(id);
    return { ok: true };
  }
  const { error } = await supabase.from("dishes").delete().eq("id", id);
  return error ? { error: error.message } : { ok: true };
}
