export type AppEnvironment = "LOCAL" | "DEV" | "PROD";

export function getAppEnvironment(): AppEnvironment {
  const value = (process.env.APP_ENV ?? "").trim().toUpperCase();

  if (value === "LOCAL" || value === "DEV" || value === "PROD") {
    return value;
  }

  return process.env.NODE_ENV === "development" ? "LOCAL" : "PROD";
}

export function isLocalEnvironment(): boolean {
  return getAppEnvironment() === "LOCAL";
}

export function isDemoMode(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY;
}

export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
