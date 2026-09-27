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
