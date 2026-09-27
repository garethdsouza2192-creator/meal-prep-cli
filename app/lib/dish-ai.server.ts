import { getAnthropicClient, HAIKU_MODEL } from "./anthropic.server";
import { MEAL_TYPES, type DishInput, type MealType } from "./dishes";
import type { Ingredient } from "./ingredients";

type RawIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

type RawDish = {
  name: string;
  cuisine: string;
  meal_types: string[];
  prep_time_min: number;
  tags: string[];
  notes: string;
  ingredients: RawIngredient[];
};

export async function generateDishFromName(
  name: string,
): Promise<DishInput | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Provide a dish name." };

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text:
          "You're a helpful cooking assistant. Given a dish name, return a structured " +
          "dish entry via the return_dish tool. Estimate a realistic total prep+cook time, " +
          "appropriate cuisine, the meal types it fits (breakfast/lunch/dinner/snack), and " +
          "common ingredients with reasonable home-cooking quantities. " +
          "Use lowercase singular ingredient names. " +
          "Prefer these units when applicable: tsp, tbsp, cup, oz, lb, g, kg, ml, inch, cloves, slices, can. " +
          "Return null for quantity/unit if the ingredient is to-taste (e.g., salt, herbs).",
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: "return_dish",
        description: "Return structured data for the dish.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            cuisine: {
              type: "string",
              description:
                "e.g., Indian, Italian, Mexican, American. Empty string if unknown.",
            },
            meal_types: {
              type: "array",
              items: { type: "string", enum: [...MEAL_TYPES] },
              description: "Which meals this dish fits. May be multiple.",
            },
            prep_time_min: {
              type: "integer",
              description: "Realistic total time including prep and cook, in minutes.",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description:
                "Free-form labels like 'kid-friendly', 'weeknight', 'comfort'. Up to 4.",
            },
            notes: {
              type: "string",
              description: "Optional one-line cooking tip. Empty string if none.",
            },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: ["number", "null"] },
                  unit: { type: ["string", "null"] },
                },
                required: ["name", "quantity", "unit"],
              },
            },
          },
          required: [
            "name",
            "cuisine",
            "meal_types",
            "prep_time_min",
            "tags",
            "notes",
            "ingredients",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "return_dish" },
    messages: [{ role: "user", content: `Dish: ${trimmed}` }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { error: "AI didn't return a structured response." };
  }

  const raw = toolUse.input as RawDish;

  const meal_types = raw.meal_types.filter((t): t is MealType =>
    (MEAL_TYPES as readonly string[]).includes(t),
  );

  const ingredients: Ingredient[] = raw.ingredients.map((i, position) => ({
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    position,
  }));

  return {
    name: raw.name || trimmed,
    cuisine: raw.cuisine?.trim() ? raw.cuisine.trim() : null,
    meal_types,
    prep_time_min: Number.isFinite(raw.prep_time_min) ? raw.prep_time_min : null,
    tags: (raw.tags ?? []).filter(Boolean).slice(0, 6),
    notes: raw.notes?.trim() ? raw.notes.trim() : null,
    ingredients,
  };
}
