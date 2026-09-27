import { redirect } from "react-router";
import { getSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/auth.callback";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  console.log("Auth callback hit", {
    requestUrl: request.url,
    hasCode: !!code,
    next,
  });

  const { supabase, headers } = getSupabaseServerClient(request);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.log("Auth callback success; redirecting", { next, headers: Object.fromEntries(headers.entries()) });
      throw redirect(next, { headers });
    }

    console.error("Supabase auth callback failed", {
      message: error.message,
      status: error.status,
      code,
      requestUrl: request.url,
    });
  } else {
    console.error("Supabase auth callback missing code", { requestUrl: request.url });
  }

  throw redirect(`/login?error=${encodeURIComponent("callback_failed")}`, { headers });
}
