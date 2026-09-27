import { generateDishFromName } from "~/lib/dish-ai.server";
import { hasAnthropicKey } from "~/lib/env.server";
import { requireUser } from "~/lib/require-user.server";
import type { Route } from "./+types/resources.dish-from-name";

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);

  if (!hasAnthropicKey()) {
    return new Response(
      JSON.stringify({ ok: false, error: "ai_unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing_name" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const result = await generateDishFromName(name);
    if ("error" in result) {
      return new Response(
        JSON.stringify({ ok: false, error: result.error }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: true, dish: result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "ai_unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}
