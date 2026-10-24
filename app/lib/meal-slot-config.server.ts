import type { SupabaseServer } from "./supabase.server";

export type MealSlotConfig = Record<string, string[]>;

function isMissingConfigTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  return (
    code === "PGRST205" ||
    message.includes("Could not find the table") ||
    message.includes("user_meal_slot_configs") ||
    message.includes("does not exist") ||
    message.includes("relation \"user_meal_slot_configs\"")
  );
}

export function normalizeMealSlotConfig(value: unknown): MealSlotConfig {
  if (!value || typeof value !== "object") return {};

  const entries = value as Record<string, unknown>;
  const normalized: MealSlotConfig = {};

  for (const [date, slots] of Object.entries(entries)) {
    if (!date || !Array.isArray(slots)) continue;

    const cleaned = Array.from(
      new Set(
        slots
          .map((slot) => String(slot).trim())
          .filter(Boolean),
      ),
    );

    if (cleaned.length > 0) {
      normalized[date] = cleaned;
    }
  }

  return normalized;
}

export async function loadMealSlotConfig(
  supabase: SupabaseServer | null,
  userId: string,
): Promise<MealSlotConfig> {
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("user_meal_slot_configs")
    .select("config")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingConfigTableError(error)) {
      return {};
    }

    throw error;
  }

  return normalizeMealSlotConfig(data?.config ?? {});
}

export async function saveMealSlotConfig(
  supabase: SupabaseServer | null,
  userId: string,
  config: MealSlotConfig,
): Promise<{ ok: true } | { error: string }> {
  const normalized = normalizeMealSlotConfig(config);

  if (!supabase) {
    return { ok: true };
  }

  const { error } = await supabase.from("user_meal_slot_configs").upsert(
    {
      user_id: userId,
      config: normalized,
    },
    { onConflict: "user_id" },
  );

  if (error && isMissingConfigTableError(error)) {
    return { ok: true };
  }

  return error ? { error: error.message } : { ok: true };
}
