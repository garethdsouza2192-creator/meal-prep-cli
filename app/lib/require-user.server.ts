import { redirect } from "react-router";
import { isDemoMode } from "./env.server";
import { getSupabaseServerClient, type SupabaseServer } from "./supabase.server";

export const DEMO_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "demo@local",
};

export type AuthResult = {
  demo: boolean;
  user: { id: string; email?: string };
  supabase: SupabaseServer | null;
  headers: Headers;
};

export async function requireUser(request: Request): Promise<AuthResult> {
  if (isDemoMode()) {
    return { demo: true, user: DEMO_USER, supabase: null, headers: new Headers() };
  }

  const { supabase, headers } = getSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw redirect("/login", { headers });
  }

  return { demo: false, user, supabase, headers };
}
