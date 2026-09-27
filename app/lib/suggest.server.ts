import { getAnthropicClient, HAIKU_MODEL } from "./anthropic.server";
import type { Dish } from "./dishes";
import { listDishes } from "./dishes.server";
import { isDemoMode } from "./env.server";
import { matchAgainstPantry, type PantryMatch } from "./ingredients";
import type { SupabaseServer } from "./supabase.server";
import type { SuggestFilters, SuggestRequest, SuggestResult, Suggestion } from "./suggest";

const STAGE_1_LIMIT = 15;

export async function getSuggestions(
  supabase: SupabaseServer | null,
  request: SuggestRequest,
  opts: { fallback?: boolean } = {},
): Promise<SuggestResult> {
  const candidates = await stage1Candidates(supabase, request.filters);
  if (candidates.length === 0) {
    return { ok: false, error: "no_candidates" };
  }

  const useRules = opts.fallback || !canCallAnthropic();

  if (useRules) {
    const picks =
      request.mode === "pantry" && request.pantry_snapshot
        ? pantryPicks(candidates, request.pantry_snapshot)
        : tonightPicks(candidates);
    return { ok: true, picks, ranked_by: "rules" };
  }

  try {
    const picks = await rankWithAnthropic(candidates, request);
    return { ok: true, picks, ranked_by: "ai" };
  } catch {
    return { ok: false, error: "ai_unavailable" };
  }
}

function canCallAnthropic(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function stage1Candidates(
  supabase: SupabaseServer | null,
  filters?: SuggestFilters,
): Promise<Dish[]> {
  const all = await listDishes(supabase);

  let result = all;
  if (filters?.cuisine) {
    const target = filters.cuisine.toLowerCase();
    result = result.filter((d) => d.cuisine?.toLowerCase() === target);
  }
  if (filters?.max_prep_time != null) {
    result = result.filter(
      (d) => d.prep_time_min != null && d.prep_time_min <= filters.max_prep_time!,
    );
  }
  if (filters?.meal_type) {
    result = result.filter((d) => d.meal_types.includes(filters.meal_type!));
  }
  if (filters?.tags?.length) {
    const tagSet = new Set(filters.tags.map((t) => t.toLowerCase()));
    result = result.filter((d) =>
      d.tags.some((t) => tagSet.has(t.toLowerCase())),
    );
  }

  return result.slice(0, STAGE_1_LIMIT);
}

function tonightPicks(candidates: Dish[]): Suggestion[] {
  return candidates
    .slice()
    .sort(
      (a, b) =>
        (a.prep_time_min ?? Number.POSITIVE_INFINITY) -
        (b.prep_time_min ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, 3)
    .map((dish) => ({
      dish,
      reason:
        dish.prep_time_min != null
          ? `${dish.prep_time_min} min — quick to make.`
          : "From your saved dishes.",
    }));
}

function pantryPicks(candidates: Dish[], pantry: string): Suggestion[] {
  const scored = candidates
    .map((dish) => ({ dish, match: matchAgainstPantry(dish.ingredients, pantry) }))
    .sort((a, b) => {
      if (a.match.score !== b.match.score) return b.match.score - a.match.score;
      if (a.match.matched.length !== b.match.matched.length) {
        return b.match.matched.length - a.match.matched.length;
      }
      return (
        (a.dish.prep_time_min ?? Number.POSITIVE_INFINITY) -
        (b.dish.prep_time_min ?? Number.POSITIVE_INFINITY)
      );
    });

  return scored.slice(0, 1).map(({ dish, match }) => ({
    dish,
    reason: pantryReason(match),
  }));
}

function pantryReason(match: PantryMatch): string {
  const total = match.matched.length + match.missing.length;
  if (total === 0) {
    return "No ingredients listed for this dish — add some to score it.";
  }
  if (match.matched.length === 0) {
    const need = match.missing.slice(0, 3).join(", ");
    const more = match.missing.length > 3 ? "…" : "";
    return `Missing all ${total}: ${need}${more}.`;
  }
  if (match.score === 1) {
    return `You have all ${total} ingredients.`;
  }
  const need = match.missing.slice(0, 3).join(", ");
  const more = match.missing.length > 3 ? "…" : "";
  return `Have ${match.matched.length}/${total} — still need ${need}${more}.`;
}

async function rankWithAnthropic(
  candidates: Dish[],
  request: SuggestRequest,
): Promise<Suggestion[]> {
  if (isDemoMode()) {
    return request.mode === "pantry" && request.pantry_snapshot
      ? pantryPicks(candidates, request.pantry_snapshot)
      : tonightPicks(candidates);
  }

  const client = getAnthropicClient();
  const candidateBlock = candidates
    .map((d) => {
      const ings =
        d.ingredients.length > 0
          ? ` | ingredients=[${d.ingredients.map((i) => i.name).join(", ")}]`
          : "";
      return `- id=${d.id} | name="${d.name}" | cuisine=${d.cuisine ?? "?"} | prep=${
        d.prep_time_min ?? "?"
      }min | meal_types=[${d.meal_types.join(",")}] | tags=[${d.tags.join(",")}]${ings}`;
    })
    .join("\n");

  const userPrompt =
    request.mode === "pantry"
      ? `Pantry contents: ${request.pantry_snapshot ?? ""}\n\nPick 3 dishes most makeable from this pantry. Prefer dishes whose ingredients are mostly available. In your reason, mention how many ingredients are present.`
      : `Filters: ${JSON.stringify(request.filters ?? {})}\n\nPick 3 dishes that best match the filters and aren't repetitive.`;

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: "You rank dish candidates and return exactly 3 picks via the return_suggestions tool. Reasons should be one short sentence each.",
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `Dish catalog:\n${candidateBlock}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: "return_suggestions",
        description: "Return the 3 chosen dishes with one-sentence reasons.",
        input_schema: {
          type: "object",
          properties: {
            picks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  dish_id: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["dish_id", "reason"],
              },
              minItems: 3,
              maxItems: 3,
            },
          },
          required: ["picks"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "return_suggestions" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("No tool_use block in response");
  }
  const input = toolUse.input as { picks: { dish_id: string; reason: string }[] };

  const byId = new Map(candidates.map((d) => [d.id, d]));
  const picks: Suggestion[] = [];
  for (const p of input.picks) {
    const dish = byId.get(p.dish_id);
    if (dish) picks.push({ dish, reason: p.reason });
  }
  const finalPicks =
    picks.length > 0
      ? picks
      : request.mode === "pantry" && request.pantry_snapshot
        ? pantryPicks(candidates, request.pantry_snapshot)
        : tonightPicks(candidates);
  return request.mode === "pantry" ? finalPicks.slice(0, 1) : finalPicks;
}
