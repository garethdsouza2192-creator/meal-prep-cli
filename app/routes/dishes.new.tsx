import { useEffect, useState } from "react";
import { redirect, useActionData, useFetcher } from "react-router";
import { DishForm } from "~/components/dish-form";
import { PageHeader } from "~/components/page-header";
import type { Dish } from "~/lib/dishes";
import { createDish, parseDishForm } from "~/lib/dishes.server";
import { hasAnthropicKey } from "~/lib/env.server";
import { requireUser } from "~/lib/require-user.server";
import type { Route } from "./+types/dishes.new";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Add a dish · Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return { aiAvailable: hasAnthropicKey() };
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, user, headers } = await requireUser(request);
  const formData = await request.formData();
  const parsed = parseDishForm(formData);

  if ("error" in parsed) return { error: parsed.error };

  const result = await createDish(supabase, user.id, parsed);
  if ("error" in result) return { error: result.error };

  throw redirect(`/dishes/${result.id}`, { headers });
}

type AutoFillResponse =
  | { ok: true; dish: Dish }
  | { ok: false; error: string };

export default function NewDish({ loaderData }: Route.ComponentProps) {
  const { aiAvailable } = loaderData as { aiAvailable: boolean };
  const actionData = useActionData<typeof action>();

  const fetcher = useFetcher<AutoFillResponse>();
  const [prefill, setPrefill] = useState<Dish | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      const d = fetcher.data.dish;
      setPrefill({ ...d, id: prefill?.id ?? "draft" } as Dish);
      setPrefillKey((k) => k + 1);
      setAutoFillError(null);
    } else {
      setAutoFillError(
        fetcher.data.error === "ai_unavailable"
          ? "AI is offline. Try again."
          : "Couldn't auto-fill — try a more specific name.",
      );
    }
  }, [fetcher.state, fetcher.data]);

  function handleAutoFill(name: string) {
    if (!name.trim()) {
      setAutoFillError("Type a dish name first.");
      return;
    }
    setAutoFillError(null);
    fetcher.submit(
      { name: name.trim() },
      { method: "post", action: "/resources/dish-from-name" },
    );
  }

  return (
    <main className="mx-auto min-h-svh max-w-2xl px-4 py-8 sm:py-10">
      <PageHeader
        back={{ to: "/dishes", label: "All dishes" }}
        title="Add a dish"
        subtitle="Save it once; pull it into your week any time."
      />
      <DishForm
        key={prefillKey}
        dish={prefill}
        submitLabel="Save dish"
        error={actionData?.error ?? null}
        onAutoFill={aiAvailable ? handleAutoFill : undefined}
        autoFilling={fetcher.state !== "idle"}
        autoFillError={autoFillError}
      />
    </main>
  );
}
