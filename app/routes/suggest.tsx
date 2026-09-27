import { useState } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";
import { Sparkles, WifiOff } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { PageHeader } from "~/components/page-header";
import { MEAL_TYPES } from "~/lib/dishes";
import { requireUser } from "~/lib/require-user.server";
import type { SuggestResult } from "~/lib/suggest";
import type { Route } from "./+types/suggest";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Suggest a dish · Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

type Mode = "tonight" | "pantry";

export default function Suggest() {
  const [searchParams] = useSearchParams();
  const initialMode: Mode = searchParams.get("mode") === "pantry" ? "pantry" : "tonight";
  const [mode, setMode] = useState<Mode>(initialMode);
  const fetcher = useFetcher<SuggestResult>();
  const submitting = fetcher.state !== "idle";
  const result = fetcher.data;

  function retry() {
    const form = document.querySelector<HTMLFormElement>("form#suggest-form");
    if (form) fetcher.submit(form);
  }

  function ruleOnly() {
    const form = document.querySelector<HTMLFormElement>("form#suggest-form");
    if (!form) return;
    const fd = new FormData(form);
    fd.set("fallback", "true");
    fetcher.submit(fd, { method: "post", action: "/resources/suggest" });
  }

  return (
    <main className="mx-auto min-h-svh max-w-2xl px-4 py-8 sm:py-10">
      <PageHeader
        back={{ to: "/", label: "Home" }}
        title={mode === "pantry" ? "What I have" : "Suggest a dish"}
        subtitle={
          mode === "pantry"
            ? "Tell me what's in the kitchen and I'll find dishes that match."
            : "Pick filters and I'll rank 3 dishes for tonight."
        }
      />

      <div className="mb-6 inline-flex rounded-lg border bg-card p-1 text-sm shadow-sm">
        <button
          type="button"
          onClick={() => setMode("tonight")}
          className={
            "rounded-md px-3 py-1.5 transition " +
            (mode === "tonight"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Tonight
        </button>
        <button
          type="button"
          onClick={() => setMode("pantry")}
          className={
            "rounded-md px-3 py-1.5 transition " +
            (mode === "pantry"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          What I have
        </button>
      </div>

      <fetcher.Form
        id="suggest-form"
        method="post"
        action="/resources/suggest"
        className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6"
      >
        <input type="hidden" name="mode" value={mode} />

        {mode === "tonight" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cuisine">Cuisine</Label>
              <Input id="cuisine" name="cuisine" placeholder="Indian" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="max_prep_time">Max prep (min)</Label>
              <Input
                id="max_prep_time"
                name="max_prep_time"
                type="number"
                min={0}
                placeholder="45"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="meal_type">Meal type</Label>
              <select
                id="meal_type"
                name="meal_type"
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm capitalize"
                defaultValue=""
              >
                <option value="">Any</option>
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" name="tags" placeholder="kid-friendly" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="pantry_snapshot">What's in the kitchen?</Label>
            <Textarea
              id="pantry_snapshot"
              name="pantry_snapshot"
              rows={5}
              placeholder="rice, dal, 2 onions, paneer, ginger…"
            />
            <p className="text-xs text-muted-foreground">
              Comma- or newline-separated. Be loose — I'll figure it out.
            </p>
          </div>
        )}

        <div>
          <Button type="submit" disabled={submitting}>
            <Sparkles className="size-4" />
            {submitting
              ? "Thinking…"
              : mode === "pantry"
                ? "Get a matching dish"
                : "Get 3 picks"}
          </Button>
        </div>
      </fetcher.Form>

      <section className="mt-8" aria-live="polite">
        {!result && !submitting && (
          <p className="text-sm text-muted-foreground">
            {mode === "pantry"
              ? "List what you have, then I'll find a dish that fits."
              : 'Fill out the form above and hit "Get 3 picks".'}
          </p>
        )}

        {result && !result.ok && result.error === "no_candidates" && (
          <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
            <p className="text-sm font-medium">No matches.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try relaxing a filter or adding more dishes.
            </p>
          </div>
        )}

        {result && !result.ok && result.error === "ai_unavailable" && (
          <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                <WifiOff className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">AI is offline.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Couldn't reach the suggestion service.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={retry}>
                    Retry
                  </Button>
                  <Button type="button" variant="secondary" onClick={ruleOnly}>
                    Show rule-only picks
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {result && result.ok && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={result.ranked_by === "ai" ? "default" : "secondary"}>
                {result.ranked_by === "ai" ? "AI ranked" : "Rule-based"}
              </Badge>
              <span>
                {result.picks.length} {result.picks.length === 1 ? "pick" : "picks"}
              </span>
            </div>
            {result.picks.map(({ dish, reason }, i) => (
              <Link
                key={dish.id}
                to={`/dishes/${dish.id}`}
                className="group flex items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-foreground/30 hover:shadow-sm"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-50 text-sm font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{dish.name}</div>
                    {dish.prep_time_min != null && (
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {dish.prep_time_min} min
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{reason}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
