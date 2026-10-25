import { useMemo, useState } from "react";
import { Link } from "react-router";
import { BookOpen, Plus, Search } from "lucide-react";
import { AddDishDrawer } from "~/components/add-dish-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { MEAL_TYPES, type Dish } from "~/lib/dishes";
import { listDishes } from "~/lib/dishes.server";
import { requireUser } from "~/lib/require-user.server";
import type { Route } from "./+types/dishes._index";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Dishes · Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await requireUser(request);
  const dishes = await listDishes(supabase);
  return new Response(JSON.stringify({ dishes }), {
    headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" },
  });
}

export default function DishesIndex({ loaderData }: Route.ComponentProps) {
  const { dishes } = loaderData as { dishes: Dish[] };
  const [search, setSearch] = useState("");
  const [selectedMealType, setSelectedMealType] = useState("all");
  const [isAddDishOpen, setIsAddDishOpen] = useState(false);

  const filteredDishes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return dishes.filter((dish) => {
      const matchesMealType =
        selectedMealType === "all" || dish.meal_types.includes(selectedMealType);

      if (!matchesMealType) return false;

      if (!query) return true;

      const haystack = [
        dish.name,
        dish.cuisine,
        dish.notes,
        ...dish.ingredients.map((ingredient) => ingredient.name),
        ...dish.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [dishes, search, selectedMealType]);

  return (
    <main className="mx-auto min-h-svh max-w-3xl px-4 py-8 sm:py-10">
      <PageHeader
        back={{ to: "/", label: "Home" }}
        title="Dishes"
        subtitle={
          dishes.length === 0
            ? "Your recipe book lives here."
            : `${dishes.length} saved`
        }
        action={
          dishes.length > 0 && (
            <Button type="button" onClick={() => setIsAddDishOpen(true)}>
              <Plus className="size-4" /> Add dish
            </Button>
          )
        }
      />

      <AddDishDrawer open={isAddDishOpen} onClose={() => setIsAddDishOpen(false)} existingDishes={dishes} />

      {dishes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No dishes yet"
          message="Add the first one and it'll show up here. You can plan it, get suggestions for it, and add its ingredients to a grocery list."
          action={
            <Button type="button" onClick={() => setIsAddDishOpen(true)}>
              <Plus className="size-4" /> Add your first dish
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dishes"
                className="w-full rounded-lg border border-foreground/10 bg-background py-2 pl-9 pr-3 text-sm outline-none transition focus:border-violet-400"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Meal type</span>
              <select
                value={selectedMealType}
                onChange={(event) => setSelectedMealType(event.target.value)}
                className="rounded-lg border border-foreground/10 bg-background px-3 py-2 text-sm outline-none transition focus:border-violet-400"
              >
                <option value="all">All</option>
                {MEAL_TYPES.map((mealType) => (
                  <option key={mealType} value={mealType}>
                    {mealType}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredDishes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-foreground/10 bg-card p-6 text-center text-sm text-muted-foreground">
              No dishes match your search or selected meal type.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredDishes.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/dishes/${d.id}`}
                    className="group flex items-start justify-between gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-foreground/30 hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium group-hover:underline-offset-2">
                        {d.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {d.cuisine && <span>{d.cuisine}</span>}
                        {d.prep_time_min != null && (
                          <span>{d.prep_time_min} min</span>
                        )}
                        {d.ingredients.length > 0 && (
                          <span>{d.ingredients.length} ingredient{d.ingredients.length === 1 ? "" : "s"}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {d.meal_types.map((slot) => (
                        <Badge key={slot} variant="secondary" className="capitalize">
                          {slot}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
