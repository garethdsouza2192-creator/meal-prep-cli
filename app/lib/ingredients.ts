export type Ingredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  position: number;
};

const UNIT_SET = new Set([
  "tsp", "tbsp", "cup", "cups", "oz", "lb", "lbs",
  "g", "kg", "ml", "l", "liter", "liters",
  "inch", "inches", "clove", "cloves",
  "piece", "pieces", "can", "cans",
  "sprig", "sprigs", "bunch", "bunches",
  "pinch", "pinches", "slice", "slices",
  "head", "heads", "stick", "sticks",
]);

function parseFraction(s: string): number | null {
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(Number);
    if (!Number.isNaN(a) && !Number.isNaN(b) && b !== 0) return a / b;
    return null;
  }
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export function parseIngredientLine(line: string, position: number): Ingredient | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  let i = 0;
  let quantity: number | null = null;
  let unit: string | null = null;

  if (tokens[i]) {
    const q = parseFraction(tokens[i]);
    if (q !== null) {
      quantity = q;
      i++;
    }
  }

  if (quantity !== null && tokens[i] && UNIT_SET.has(tokens[i].toLowerCase())) {
    unit = tokens[i].toLowerCase();
    i++;
  }

  const name = tokens.slice(i).join(" ").trim();
  if (!name) return null;
  return { name, quantity, unit, position };
}

export function parseIngredientsText(text: string): Ingredient[] {
  return text
    .split(/\r?\n/)
    .map((line, idx) => parseIngredientLine(line, idx))
    .filter((x): x is Ingredient => x !== null)
    .map((ing, position) => ({ ...ing, position }));
}

const FRACTION_LOOKUP: Array<[number, string]> = [
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
];

function formatQuantity(n: number): string {
  for (const [val, label] of FRACTION_LOOKUP) {
    if (Math.abs(n - val) < 0.01) return label;
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function ingredientsToText(ings: Ingredient[]): string {
  return ings
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((i) => {
      const parts: string[] = [];
      if (i.quantity != null) parts.push(formatQuantity(i.quantity));
      if (i.unit) parts.push(i.unit);
      parts.push(i.name);
      return parts.join(" ");
    })
    .join("\n");
}

export function singularize(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith("ies") && lower.length > 3) return lower.slice(0, -3) + "y";
  if (lower.endsWith("oes")) return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

export type GroceryItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  alreadyHave: boolean;
};

type Tally = { quantity: number | null; unit: string | null };

export function groceryListFromPlan(args: {
  plannedDishes: Array<{ ingredients: Ingredient[] }>;
  haveSnapshot?: string;
}): GroceryItem[] {
  const buckets = new Map<string, Map<string, Tally>>(); // key: singular name → unit→tally

  for (const dish of args.plannedDishes) {
    for (const ing of dish.ingredients) {
      const key = singularize(ing.name);
      const unitKey = ing.unit ?? "";
      const inner = buckets.get(key) ?? new Map<string, Tally>();
      const existing = inner.get(unitKey);
      if (existing) {
        if (existing.quantity != null && ing.quantity != null) {
          existing.quantity += ing.quantity;
        } else if (existing.quantity == null && ing.quantity != null) {
          existing.quantity = ing.quantity;
        }
      } else {
        inner.set(unitKey, { quantity: ing.quantity, unit: ing.unit });
      }
      buckets.set(key, inner);
    }
  }

  const haveTokens = parseSnapshot(args.haveSnapshot ?? "");

  const items: GroceryItem[] = [];
  for (const [name, byUnit] of buckets) {
    for (const tally of byUnit.values()) {
      items.push({
        name,
        quantity: tally.quantity,
        unit: tally.unit,
        alreadyHave: haveTokens.has(name),
      });
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

export function parseSnapshot(text: string): Set<string> {
  return new Set(
    text
      .split(/[\n,]/)
      .map((s) => s.trim().toLowerCase())
      .map((s) => s.replace(/^\d+(\.\d+)?(\s*\/\s*\d+)?\s*/, "")) // strip leading qty
      .map((s) => s.split(/\s+/).slice(-1)[0]) // last word
      .map(singularize)
      .filter(Boolean),
  );
}

export const GROCERY_CATEGORIES = [
  "Produce",
  "Meat & seafood",
  "Dairy & eggs",
  "Dry goods",
  "Pantry",
  "Spices & herbs",
  "Other",
] as const;
export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

const CATEGORY_RULES: Array<[GroceryCategory, string[]]> = [
  [
    "Pantry",
    [
      "marinara sauce", "tomato sauce", "tomato paste", "salsa",
      "soy sauce", "olive oil", "sesame oil", "vegetable oil", "oil",
      "maple syrup", "honey", "syrup", "vinegar",
      "rajma", "kidney bean", "black bean", "chickpea", "lentil", "bean",
      "stock", "broth", "ketchup", "mustard", "mayonnaise",
    ],
  ],
  [
    "Spices & herbs",
    [
      "garam masala", "red pepper flakes", "red pepper", "chili powder",
      "baking powder", "baking soda", "black pepper", "pepper", "salt",
      "cumin", "turmeric", "cinnamon", "vanilla",
      "paprika", "oregano", "thyme", "rosemary", "bay leaf", "nutmeg",
      "clove", "cardamom", "fennel", "coriander",
      "basil", "cilantro", "parsley", "mint", "dill",
    ],
  ],
  [
    "Meat & seafood",
    [
      "ground beef", "ground turkey", "chicken", "beef", "pork", "lamb",
      "turkey", "fish", "salmon", "tuna", "shrimp", "bacon", "sausage",
    ],
  ],
  [
    "Dairy & eggs",
    [
      "mozzarella", "parmesan", "cheddar", "cheese", "milk", "butter",
      "cream", "yogurt", "egg", "ghee", "sour cream",
    ],
  ],
  [
    "Dry goods",
    [
      "spaghetti", "pasta", "noodle", "rice", "flour", "bread", "naan",
      "tortilla", "breadcrumb", "sugar", "oat", "cereal", "granola",
    ],
  ],
  [
    "Produce",
    [
      "onion", "tomato", "garlic", "ginger", "banana", "avocado",
      "lemon", "lime", "broccoli", "carrot", "pea", "bell pepper",
      "scallion", "potato", "spinach", "kale", "lettuce", "cucumber",
      "apple", "berry", "strawberry", "blueberry", "orange", "mushroom",
      "celery", "zucchini", "cauliflower", "cabbage",
    ],
  ],
];

export function categorizeIngredient(name: string): GroceryCategory {
  const lower = name.toLowerCase();
  for (const [category, keywords] of CATEGORY_RULES) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category;
    }
  }
  return "Other";
}

export type PantryMatch = {
  matched: string[];
  missing: string[];
  score: number;
};

export function matchAgainstPantry(
  ingredients: Ingredient[],
  pantrySnapshot: string,
): PantryMatch {
  const tokens = parseSnapshot(pantrySnapshot);
  if (ingredients.length === 0) {
    return { matched: [], missing: [], score: 0 };
  }
  const matched: string[] = [];
  const missing: string[] = [];
  for (const ing of ingredients) {
    const key = singularize(ing.name);
    let found = false;
    for (const token of tokens) {
      if (token === key || key.includes(token) || token.includes(key)) {
        found = true;
        break;
      }
    }
    (found ? matched : missing).push(ing.name);
  }
  return {
    matched,
    missing,
    score: matched.length / ingredients.length,
  };
}
