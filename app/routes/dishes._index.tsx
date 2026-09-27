import { Link } from "react-router";
import { BookOpen, Plus } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import type { Dish } from "~/lib/dishes";
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
            <Button asChild>
              <Link to="/dishes/new">
                <Plus className="size-4" /> Add dish
              </Link>
            </Button>
          )
        }
      />

      {dishes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No dishes yet"
          message="Add the first one and it'll show up here. You can plan it, get suggestions for it, and add its ingredients to a grocery list."
          action={
            <Button asChild>
              <Link to="/dishes/new">
                <Plus className="size-4" /> Add your first dish
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {dishes.map((d) => (
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
    </main>
  );
}
