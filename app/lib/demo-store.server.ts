import { randomUUID } from "node:crypto";
import type { Dish, DishInput } from "./dishes";
import type { MealSlot } from "./dates";
import type { PlanMeal } from "./plan";

const dishes = new Map<string, Dish>();
const planMeals = new Map<string, PlanMeal>(); // key: `${date}|${slot}`

const planKey = (date: string, slot: MealSlot) => `${date}|${slot}`;

function normalizeDishIds(dishIds: string[] | string | null | undefined): string[] {
  const values = Array.isArray(dishIds)
    ? dishIds
    : dishIds
      ? [dishIds]
      : [];

  return Array.from(new Set(values.filter(Boolean)));
}

// Changed from DishInput[] to Dish[] and added a hardcoded 'id' to each
const SEED_DISHES: Dish[] = [
  {
    id: "4fa54228-4443-4e34-b20f-b4b9b9a67425",
    name: "Banana Pancakes",
    cuisine: "American",
    meal_types: ["breakfast"],
    prep_time_min: 20,
    tags: ["kid-friendly", "weekend"],
    notes: "Mash bananas before mixing the batter.",
    ingredients: [
      { name: "banana", quantity: 2, unit: null, position: 0 },
      { name: "flour", quantity: 1, unit: "cup", position: 1 },
      { name: "eggs", quantity: 2, unit: null, position: 2 },
      { name: "milk", quantity: 0.75, unit: "cup", position: 3 },
      { name: "butter", quantity: 2, unit: "tbsp", position: 4 },
      { name: "baking powder", quantity: 1, unit: "tsp", position: 5 },
      { name: "maple syrup", quantity: null, unit: null, position: 6 },
    ],
  },
  {
    id: "2ccf7663-d14a-4467-85b4-d758079633e4",
    name: "Cheesy Scrambled Eggs",
    cuisine: "American",
    meal_types: ["breakfast"],
    prep_time_min: 10,
    tags: ["kid-friendly", "quick"],
    notes: "Stir gently over low heat for soft curds.",
    ingredients: [
      { name: "eggs", quantity: 4, unit: null, position: 0 },
      { name: "milk", quantity: 2, unit: "tbsp", position: 1 },
      { name: "cheddar", quantity: 0.5, unit: "cup", position: 2 },
      { name: "butter", quantity: 1, unit: "tbsp", position: 3 },
      { name: "salt", quantity: null, unit: null, position: 4 },
    ],
  },
  {
    id: "e084777e-cb99-4d6d-8b01-5278c772c3b2",
    name: "Aloo Paratha",
    cuisine: "Indian",
    meal_types: ["breakfast"],
    prep_time_min: 30,
    tags: ["kid-friendly", "weekend"],
    notes: "Boil potatoes ahead — saves 15 minutes in the morning.",
    ingredients: [
      { name: "flour", quantity: 2, unit: "cup", position: 0 },
      { name: "potatoes", quantity: 2, unit: null, position: 1 },
      { name: "ghee", quantity: 2, unit: "tbsp", position: 2 },
      { name: "cumin", quantity: 1, unit: "tsp", position: 3 },
      { name: "ginger", quantity: 1, unit: "inch", position: 4 },
      { name: "cilantro", quantity: null, unit: null, position: 5 },
      { name: "salt", quantity: null, unit: null, position: 6 },
    ],
  },
  {
    id: "a66fbc08-25d2-43bb-a4e9-9154a4f8d5bb",
    name: "Mac and Cheese",
    cuisine: "American",
    meal_types: ["lunch", "dinner"],
    prep_time_min: 25,
    tags: ["kid-friendly", "comfort"],
    notes: null,
    ingredients: [
      { name: "pasta", quantity: 2, unit: "cup", position: 0 },
      { name: "cheddar", quantity: 1, unit: "cup", position: 1 },
      { name: "milk", quantity: 1, unit: "cup", position: 2 },
      { name: "butter", quantity: 2, unit: "tbsp", position: 3 },
      { name: "flour", quantity: 2, unit: "tbsp", position: 4 },
      { name: "salt", quantity: null, unit: null, position: 5 },
    ],
  },
  {
    id: "b2721ab9-968b-493e-a129-eb7ba9830206",
    name: "Veggie Quesadilla",
    cuisine: "Mexican",
    meal_types: ["lunch"],
    prep_time_min: 15,
    tags: ["kid-friendly", "quick"],
    notes: null,
    ingredients: [
      { name: "tortillas", quantity: 4, unit: null, position: 0 },
      { name: "cheese", quantity: 1, unit: "cup", position: 1 },
      { name: "bell peppers", quantity: 1, unit: null, position: 2 },
      { name: "black beans", quantity: 1, unit: "can", position: 3 },
      { name: "onion", quantity: 0.5, unit: null, position: 4 },
      { name: "salsa", quantity: null, unit: null, position: 5 },
    ],
  },
  {
    id: "f9e31d45-6622-491c-99d8-79532822a104",
    name: "Mini Margherita Pizzas",
    cuisine: "Italian",
    meal_types: ["lunch", "dinner"],
    prep_time_min: 20,
    tags: ["kid-friendly", "fun"],
    notes: "Use naan as a quick crust shortcut.",
    ingredients: [
      { name: "naan", quantity: 4, unit: null, position: 0 },
      { name: "tomato sauce", quantity: 0.5, unit: "cup", position: 1 },
      { name: "mozzarella", quantity: 1, unit: "cup", position: 2 },
      { name: "basil", quantity: null, unit: null, position: 3 },
      { name: "olive oil", quantity: 1, unit: "tbsp", position: 4 },
    ],
  },
  {
    id: "4c04dc60-9831-4171-8bc4-d75607315579",
    name: "Spaghetti and Meatballs",
    cuisine: "Italian",
    meal_types: ["dinner"],
    prep_time_min: 40,
    tags: ["kid-friendly", "classic"],
    notes: null,
    ingredients: [
      { name: "spaghetti", quantity: 1, unit: "lb", position: 0 },
      { name: "ground beef", quantity: 1, unit: "lb", position: 1 },
      { name: "breadcrumbs", quantity: 0.5, unit: "cup", position: 2 },
      { name: "eggs", quantity: 1, unit: null, position: 3 },
      { name: "marinara sauce", quantity: 2, unit: "cup", position: 4 },
      { name: "parmesan", quantity: 0.5, unit: "cup", position: 5 },
      { name: "garlic", quantity: 3, unit: "cloves", position: 6 },
      { name: "parsley", quantity: null, unit: null, position: 7 },
    ],
  },
  {
    id: "24b7a1e0-79ea-4029-a1b4-2b6fb6e6d194",
    name: "Butter Chicken",
    cuisine: "Indian",
    meal_types: ["dinner"],
    prep_time_min: 35,
    tags: ["kid-friendly", "mild"],
    notes: "Mild on spice — great intro to Indian food for kids.",
    ingredients: [
      { name: "chicken", quantity: 1, unit: "lb", position: 0 },
      { name: "butter", quantity: 4, unit: "tbsp", position: 1 },
      { name: "tomatoes", quantity: 2, unit: "cup", position: 2 },
      { name: "cream", quantity: 0.5, unit: "cup", position: 3 },
      { name: "garam masala", quantity: 1, unit: "tbsp", position: 4 },
      { name: "ginger", quantity: 1, unit: "inch", position: 5 },
      { name: "garlic", quantity: 4, unit: "cloves", position: 6 },
      { name: "onion", quantity: 1, unit: null, position: 7 },
    ],
  },
  {
    id: "d855791c-b5f7-4148-af7e-3cecf39dd4f8",
    name: "Chicken Teriyaki Rice Bowl",
    cuisine: "Japanese",
    meal_types: ["lunch", "dinner"],
    prep_time_min: 30,
    tags: ["kid-friendly"],
    notes: null,
    ingredients: [
      { name: "chicken", quantity: 1, unit: "lb", position: 0 },
      { name: "rice", quantity: 2, unit: "cup", position: 1 },
      { name: "soy sauce", quantity: 0.25, unit: "cup", position: 2 },
      { name: "honey", quantity: 2, unit: "tbsp", position: 3 },
      { name: "sesame oil", quantity: 1, unit: "tbsp", position: 4 },
      { name: "broccoli", quantity: 2, unit: "cup", position: 5 },
      { name: "garlic", quantity: 2, unit: "cloves", position: 6 },
      { name: "ginger", quantity: 1, unit: "inch", position: 7 },
    ],
  },
  {
    id: "f7f18cc5-7e5f-463f-91cb-d227b233a011",
    name: "Veggie Fried Rice",
    cuisine: "Chinese",
    meal_types: ["lunch", "dinner"],
    prep_time_min: 25,
    tags: ["kid-friendly", "weeknight"],
    notes: "Best with day-old rice.",
    ingredients: [
      { name: "rice", quantity: 3, unit: "cup", position: 0 },
      { name: "eggs", quantity: 2, unit: null, position: 1 },
      { name: "peas", quantity: 1, unit: "cup", position: 2 },
      { name: "carrots", quantity: 2, unit: null, position: 3 },
      { name: "soy sauce", quantity: 3, unit: "tbsp", position: 4 },
      { name: "sesame oil", quantity: 1, unit: "tsp", position: 5 },
      { name: "garlic", quantity: 2, unit: "cloves", position: 6 },
      { name: "scallions", quantity: null, unit: null, position: 7 },
    ],
  },
  {
    id: "9e1fa122-8d77-4951-872e-336fc167da51",
    name: "Rajma Chawal",
    cuisine: "Indian",
    meal_types: ["lunch", "dinner"],
    prep_time_min: 45,
    tags: ["kid-friendly", "comfort"],
    notes: "Soak rajma overnight, or use canned for a 25-min version.",
    ingredients: [
      { name: "rajma", quantity: 1, unit: "cup", position: 0 },
      { name: "rice", quantity: 2, unit: "cup", position: 1 },
      { name: "onion", quantity: 1, unit: null, position: 2 },
      { name: "tomatoes", quantity: 2, unit: null, position: 3 },
      { name: "ginger", quantity: 1, unit: "inch", position: 4 },
      { name: "garlic", quantity: 4, unit: "cloves", position: 5 },
      { name: "garam masala", quantity: 1, unit: "tsp", position: 6 },
      { name: "cumin", quantity: 1, unit: "tsp", position: 7 },
      { name: "turmeric", quantity: 0.5, unit: "tsp", position: 8 },
      { name: "oil", quantity: 2, unit: "tbsp", position: 9 },
      { name: "cilantro", quantity: null, unit: null, position: 10 },
      { name: "salt", quantity: null, unit: null, position: 11 },
    ],
  },
  {
    id: "7e1b5f25-83c9-49ba-8a8b-185d2634e565",
    name: "Avocado Toast",
    cuisine: "American",
    meal_types: ["breakfast"],
    prep_time_min: 5,
    tags: ["quick", "kid-friendly"],
    notes: "Mash with a fork, season generously.",
    ingredients: [
      { name: "bread", quantity: 2, unit: "slices", position: 0 },
      { name: "avocado", quantity: 1, unit: null, position: 1 },
      { name: "lemon", quantity: 0.5, unit: null, position: 2 },
      { name: "olive oil", quantity: 1, unit: "tsp", position: 3 },
      { name: "salt", quantity: null, unit: null, position: 4 },
      { name: "red pepper flakes", quantity: null, unit: null, position: 5 },
    ],
  },
  {
    id: "b3b28df6-b8db-4e14-8745-612b7a86f7b1",
    name: "French Toast",
    cuisine: "French",
    meal_types: ["breakfast"],
    prep_time_min: 15,
    tags: ["kid-friendly", "weekend"],
    notes: "Slightly stale bread soaks up the custard best.",
    ingredients: [
      { name: "bread", quantity: 4, unit: "slices", position: 0 },
      { name: "eggs", quantity: 2, unit: null, position: 1 },
      { name: "milk", quantity: 0.5, unit: "cup", position: 2 },
      { name: "sugar", quantity: 1, unit: "tbsp", position: 3 },
      { name: "vanilla", quantity: 1, unit: "tsp", position: 4 },
      { name: "cinnamon", quantity: 0.5, unit: "tsp", position: 5 },
      { name: "butter", quantity: 1, unit: "tbsp", position: 6 },
      { name: "maple syrup", quantity: null, unit: null, position: 7 },
    ],
  },
];

function initializeSeeds() {
  if (dishes.size === 0) {
    for (const dish of SEED_DISHES) {
      // id is now already part of the object, so no randomUUID() needed here
      dishes.set(dish.id, dish);
    }
  }
}

export const demoStore = {
  // ---- dishes ----
  listDishes(): Dish[] {
    initializeSeeds();
    return Array.from(dishes.values()).sort((a, b) => a.name.localeCompare(b.name));
  },

  getDish(id: string): Dish | null {
    initializeSeeds(); // Added safety initialization
    return dishes.get(id) ?? null;
  },

  countDishes(): number {
    initializeSeeds(); // Added safety initialization
    return dishes.size;
  },

  createDish(input: DishInput): Dish {
    initializeSeeds(); // Added safety initialization
    const dish: Dish = { id: randomUUID(), ...input }; // Safe here since it runs on a user request
    dishes.set(dish.id, dish);
    return dish;
  },

  updateDish(id: string, input: DishInput): Dish | null {
    initializeSeeds(); // Added safety initialization
    const existing = dishes.get(id);
    if (!existing) return null;
    const updated: Dish = { ...existing, ...input };
    dishes.set(id, updated);
    return updated;
  },

  deleteDish(id: string): boolean {
    initializeSeeds(); // Added safety initialization
    for (const [key, m] of planMeals) {
      if (m.dish_id === id) planMeals.delete(key);
    }
    return dishes.delete(id);
  },

  // ---- plan ----
  listPlanMealsInRange(startDate: string, endDate: string): PlanMeal[] {
    return Array.from(planMeals.values()).filter(
      (m) => m.meal_date >= startDate && m.meal_date <= endDate,
    );
  },

  setPlanMeal(date: string, slot: MealSlot, dishIds: string[] | string): PlanMeal {
    const key = planKey(date, slot);
    const normalized = normalizeDishIds(dishIds);
    const existing = planMeals.get(key);
    const nextDishIds = normalized.length > 0 ? normalized : existing?.dish_ids ?? [];
    const primaryDishId = nextDishIds[0] ?? existing?.dish_id ?? null;

    const meal: PlanMeal = existing
      ? {
          ...existing,
          dish_id: primaryDishId,
          dish_ids: nextDishIds,
          status: "planned",
          cooked_at: null,
        }
      : {
          id: randomUUID(),
          meal_date: date,
          meal_slot: slot,
          dish_id: primaryDishId,
          dish_ids: nextDishIds,
          status: "planned",
          cooked_at: null,
        };

    if (nextDishIds.length === 0) {
      planMeals.delete(key);
      return meal;
    }

    planMeals.set(key, meal);
    return meal;
  },

  removePlanMeal(date: string, slot: MealSlot, dishId?: string): boolean {
    const key = planKey(date, slot);
    const existing = planMeals.get(key);
    if (!existing) return false;

    if (!dishId) {
      return planMeals.delete(key);
    }

    const remaining = (existing.dish_ids ?? []).filter((id) => id !== dishId);
    if (remaining.length === 0) {
      return planMeals.delete(key);
    }

    const updated: PlanMeal = {
      ...existing,
      dish_ids: remaining,
      dish_id: remaining[0] ?? null,
    };
    planMeals.set(key, updated);
    return true;
  },

  setCookedStatus(date: string, slot: MealSlot, cooked: boolean): PlanMeal | null {
    const meal = planMeals.get(planKey(date, slot));
    if (!meal) return null;
    const updated: PlanMeal = {
      ...meal,
      status: cooked ? "cooked" : "planned",
      cooked_at: cooked ? new Date().toISOString() : null, // Safe here since it runs on a user request
    };
    planMeals.set(planKey(date, slot), updated);
    return updated;
  },
};