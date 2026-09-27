import { redirect } from "react-router";
import { isDemoMode } from "~/lib/env.server";
import { getSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  if (isDemoMode()) throw redirect("/");
  const { supabase, headers } = getSupabaseServerClient(request);
  await supabase.auth.signOut();
  throw redirect("/login", { headers });
}

export async function loader() {
  throw redirect("/");
}
