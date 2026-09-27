import { Form, redirect, useActionData } from "react-router";
import { Button } from "~/components/ui/button";
import { DishForm } from "~/components/dish-form";
import { PageHeader } from "~/components/page-header";
import type { Dish } from "~/lib/dishes";
import { deleteDish, getDish, parseDishForm, updateDish } from "~/lib/dishes.server";
import { requireUser } from "~/lib/require-user.server";
import type { Route } from "./+types/dishes.$id";

export function meta({ data }: Route.MetaArgs) {
  const dish = (data as { dish?: { name: string } } | undefined)?.dish;
  return [{ title: dish ? `${dish.name} · Meal Prep` : "Dish · Meal Prep" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = await requireUser(request);
  const dish = await getDish(supabase, params.id);
  if (!dish) {
    throw new Response("Not found", { status: 404 });
  }
  return new Response(JSON.stringify({ dish }), {
    headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" },
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "update");

  if (intent === "delete") {
    const result = await deleteDish(supabase, params.id);
    if ("error" in result) return { error: result.error };
    throw redirect("/dishes", { headers });
  }

  const parsed = parseDishForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const result = await updateDish(supabase, params.id, parsed);
  if ("error" in result) return { error: result.error };
  return { ok: true } as const;
}

export default function DishDetail({ loaderData }: Route.ComponentProps) {
  const { dish } = loaderData as { dish: Dish | null };
  const actionData = useActionData<typeof action>();

  if (!dish) return null;

  return (
    <main className="mx-auto min-h-svh max-w-2xl px-4 py-8 sm:py-10">
      <PageHeader
        back={{ to: "/dishes", label: "All dishes" }}
        title={dish.name}
        subtitle="Edit details below."
      />

      <DishForm
        dish={dish}
        submitLabel="Save changes"
        error={actionData && "error" in actionData ? actionData.error : null}
      />

      {actionData && "ok" in actionData && (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
          Saved.
        </p>
      )}

      <Form method="post" className="mt-12 border-t pt-6">
        <input type="hidden" name="intent" value="delete" />
        <Button
          type="submit"
          variant="destructive"
          onClick={(e) => {
            if (!confirm(`Delete "${dish.name}"?`)) e.preventDefault();
          }}
        >
          Delete dish
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          This also removes it from any planned meals.
        </p>
      </Form>
    </main>
  );
}
