import { Form, redirect, useActionData, useNavigation } from "react-router";
import { ChefHat } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { isDemoMode } from "~/lib/env.server";
import { getSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/login";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Sign in · Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (isDemoMode()) throw redirect("/");
  const { supabase } = getSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) throw redirect("/");
  return null;
}

function getPublicOrigin(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const url = new URL(request.url);

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return url.origin;
}

export async function action({ request }: Route.ActionArgs) {
  if (isDemoMode()) {
    return { error: "Sign-in is disabled in demo mode." };
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter an email address." };
  }

  const redirectTo = `${getPublicOrigin(request)}/auth/callback`;

  const { supabase, headers } = getSupabaseServerClient(request);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    return { error: error.message };
  }

  return new Response(null, {
    status: 200,
    headers: { ...Object.fromEntries(headers), "X-Sent": "1" },
  });
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const sending = nav.state === "submitting";
  const sent = actionData && !("error" in actionData);

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-8">
      <div className="rounded-3xl bg-card p-8 ring-1 ring-foreground/10 shadow-sm">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/50 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50">
          <ChefHat className="size-6" />
        </div>
        <h1 className="mt-5 text-center font-heading text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Sign in to your kitchen.
        </p>

        <Form method="post" className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>

          <Button type="submit" disabled={sending} className="w-full">
            {sending ? "Sending…" : "Send magic link"}
          </Button>

          {actionData && "error" in actionData && (
            <p className="text-sm text-destructive">{actionData.error}</p>
          )}
          {sent && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              Check your inbox for the magic link.
            </p>
          )}
        </Form>
      </div>
    </main>
  );
}
