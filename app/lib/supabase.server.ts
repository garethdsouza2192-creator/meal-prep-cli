import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requiredEnv } from "./env.server";

export type SupabaseServer = SupabaseClient;

export function getSupabaseServerClient(request: Request) {
  const headers = new Headers();

  const supabase = createServerClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "").map(
            ({ name, value }) => ({ name, value: value ?? "" }),
          );
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
          }
        },
      },
    },
  );

  return { supabase, headers };
}
