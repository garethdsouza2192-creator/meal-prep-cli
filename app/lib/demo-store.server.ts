import { randomUUID } from "node:crypto";
import type { Dish, DishInput } from "./dishes";
import type { MealSlot } from "./dates";
import type { PlanMeal } from "./plan";

const dishes = new Map<string, Dish>();
const planMeals = new Map<string, PlanMeal>(); // key: `${date}|${slot}`

const planKey = (date: string, slot: MealSlot) => `${date}|${slot}`;

const SEED_DISHES: DishInput[] = [
  {
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

if (dishes.size === 0) {
  for (const input of SEED_DISHES) {
    const dish: Dish = { id: randomUUID(), ...input };
    dishes.set(dish.id, dish);
  }
}

export const demoStore = {
  // ---- dishes ----
  listDishes(): Dish[] {
    return Array.from(dishes.values()).sort((a, b) => a.name.localeCompare(b.name));
  },

  getDish(id: string): Dish | null {
    return dishes.get(id) ?? null;
  },

  countDishes(): number {
    return dishes.size;
  },

  createDish(input: DishInput): Dish {
    const dish: Dish = { id: randomUUID(), ...input };
    dishes.set(dish.id, dish);
    return dish;
  },

  updateDish(id: string, input: DishInput): Dish | null {
    const existing = dishes.get(id);
    if (!existing) return null;
    const updated: Dish = { ...existing, ...input };
    dishes.set(id, updated);
    return updated;
  },

  deleteDish(id: string): boolean {
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

  setPlanMeal(date: string, slot: MealSlot, dish_id: string): PlanMeal {
    const key = planKey(date, slot);
    const existing = planMeals.get(key);
    const meal: PlanMeal = existing
      ? { ...existing, dish_id, status: "planned", cooked_at: null }
      : {
          id: randomUUID(),
          meal_date: date,
          meal_slot: slot,
          dish_id,
          status: "planned",
          cooked_at: null,
        };
    planMeals.set(key, meal);
    return meal;
  },

  removePlanMeal(date: string, slot: MealSlot): boolean {
    return planMeals.delete(planKey(date, slot));
  },

  setCookedStatus(date: string, slot: MealSlot, cooked: boolean): PlanMeal | null {
    const meal = planMeals.get(planKey(date, slot));
    if (!meal) return null;
    const updated: PlanMeal = {
      ...meal,
      status: cooked ? "cooked" : "planned",
      cooked_at: cooked ? new Date().toISOString() : null,
    };
    planMeals.set(planKey(date, slot), updated);
    return updated;
  },
};
