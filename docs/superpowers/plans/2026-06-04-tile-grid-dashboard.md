# Tile Grid Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make layout option B, the tile-grid dashboard, the committed home-screen direction with five primary sections: Dishes, Suggest, What I have, Weekly plan, and Grocery list.

**Architecture:** The home route stays as the index route in `app/routes/home.tsx`. The loader continues to fetch live counts, while the component renders a mobile-first tile grid from a small data model so tile order, copy, icons, links, and responsive spans are easy to review.

**Tech Stack:** React Router v7 framework mode, React 19, Tailwind CSS v4, shadcn-style tokens, Lucide React icons, TypeScript.

---

## File Structure

- Modify: `app/routes/home.tsx`
  - Keeps the index-route loader, greeting hook, and tile rendering.
  - Defines the five dashboard tiles selected in option B.
  - Removes `Add a dish` from the primary tile grid and exposes it as a small header action near the Dishes count.
- No new runtime files are needed.
- No dedicated test files are added because this repo does not currently have a test runner configured; verification uses React Router type generation plus TypeScript.

---

### Task 1: Update Home Tiles To Match Option B

**Files:**
- Modify: `app/routes/home.tsx`

- [ ] **Step 1: Replace `app/routes/home.tsx` with the option B home structure**

Use this complete file content:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  Calendar,
  Plus,
  Refrigerator,
  ShoppingCart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { startOfWeek, toIsoDate, weekDates } from "~/lib/dates";
import { countDishes } from "~/lib/dishes.server";
import { countPlannedThisWeek } from "~/lib/plan.server";
import { requireUser } from "~/lib/require-user.server";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Meal Prep" },
    { name: "description", content: "Plan, suggest, and shop for the week." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await requireUser(request);
  const days = weekDates(startOfWeek(new Date()));
  const startStr = toIsoDate(days[0]);
  const endStr = toIsoDate(days[days.length - 1]);

  const [dishCount, plannedThisWeek] = await Promise.all([
    countDishes(supabase),
    countPlannedThisWeek(supabase, startStr, endStr),
  ]);

  return new Response(JSON.stringify({ dishCount, plannedThisWeek }), {
    headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" },
  });
}

type Tone = "amber" | "violet" | "emerald" | "sky" | "rose";

const TONES: Record<Tone, string> = {
  amber:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ring-amber-200/50 dark:ring-amber-900/50",
  violet:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 ring-violet-200/50 dark:ring-violet-900/50",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-emerald-200/50 dark:ring-emerald-900/50",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 ring-sky-200/50 dark:ring-sky-900/50",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-rose-200/50 dark:ring-rose-900/50",
};

type TileProps = {
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone: Tone;
  wide?: boolean;
};

function Tile({ to, icon: Icon, title, subtitle, tone, wide = false }: TileProps) {
  return (
    <Link
      to={to}
      className={`group flex min-h-32 flex-col justify-between rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20 active:translate-y-0 sm:min-h-36 sm:p-5 ${
        wide ? "col-span-2 sm:col-span-1" : ""
      }`}
    >
      <div
        className={`grid size-11 place-items-center rounded-xl ring-1 ${TONES[tone]} transition group-hover:scale-105`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="font-medium leading-tight">{title}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</div>
      </div>
    </Link>
  );
}

function useGreeting(): string {
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5) setGreeting("Up late");
    else if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);
  return greeting;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { dishCount, plannedThisWeek } = loaderData as {
    dishCount: number;
    plannedThisWeek: number;
  };
  const greeting = useGreeting();

  const tiles = useMemo(
    () => [
      {
        to: "/suggest",
        icon: Sparkles,
        title: "Suggest a dish",
        subtitle: "Get three picks for tonight.",
        tone: "violet" as const,
      },
      {
        to: "/suggest?mode=pantry",
        icon: Refrigerator,
        title: "What I have",
        subtitle: "Match dinner to pantry staples.",
        tone: "emerald" as const,
      },
      {
        to: "/plan",
        icon: Calendar,
        title: "Weekly plan",
        subtitle: plannedThisWeek === 0 ? "Open week ahead." : `${plannedThisWeek} planned this week.`,
        tone: "sky" as const,
      },
      {
        to: "/grocery",
        icon: ShoppingCart,
        title: "Grocery list",
        subtitle: "Build a list from the plan.",
        tone: "rose" as const,
      },
      {
        to: "/dishes",
        icon: BookOpen,
        title: "My dishes",
        subtitle: dishCount === 0 ? "Start your dish list." : `${dishCount} saved dishes.`,
        tone: "amber" as const,
        wide: true,
      },
    ],
    [dishCount, plannedThisWeek],
  );

  return (
    <main className="mx-auto min-h-svh max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-start justify-between gap-4 sm:mb-12">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">What's the plan?</p>
        </div>
        <Link
          to="/dishes/new"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:opacity-90"
          aria-label="Add a dish"
          title="Add a dish"
        >
          <Plus className="size-4" />
        </Link>
      </header>

      <section
        aria-label="Quick actions"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {tiles.map((tile) => (
          <Tile key={tile.to} {...tile} />
        ))}
      </section>

      <section
        aria-label="This week"
        className="mt-8 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:mt-10"
      >
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          This week
        </div>
        {plannedThisWeek === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing planned yet.{" "}
            <Link
              to="/plan"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Open the weekly plan
            </Link>{" "}
            to drop dishes into days.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {plannedThisWeek} {plannedThisWeek === 1 ? "meal" : "meals"} on the
            calendar.{" "}
            <Link
              to="/plan"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              See the week →
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Run type generation and TypeScript**

Run:

```powershell
npm run typecheck
```

Expected:

```text
> typecheck
> react-router typegen && tsc
```

The command should finish with exit code `0`.

- [ ] **Step 3: Commit the dashboard tile update**

Run:

```powershell
git add app/routes/home.tsx
git commit -m "feat: refine tile grid dashboard"
```

Expected: a new commit containing only `app/routes/home.tsx`.

---

### Task 2: Verify The Local Dashboard Experience

**Files:**
- Read: `package.json`
- Read: `app/routes/home.tsx`

- [ ] **Step 1: Start the React Router dev server**

Run:

```powershell
npm run dev
```

Expected:

```text
> dev
> react-router dev
```

The server should print a local URL such as `http://localhost:5173/`.

- [ ] **Step 2: Open the home route in a browser**

Open the URL printed by the dev server.

Expected visible result:

```text
Good morning / Good afternoon / Good evening
What's the plan?
Suggest a dish
What I have
Weekly plan
Grocery list
My dishes
This week
```

- [ ] **Step 3: Check mobile layout at about 375px width**

Expected:

```text
The quick actions render as two columns.
Suggest a dish and What I have occupy the first row.
Weekly plan and Grocery list occupy the second row.
My dishes spans both columns on the third row.
The add-dish button is an icon button in the header, not a sixth dashboard tile.
No tile text overlaps or spills outside its card.
```

- [ ] **Step 4: Check desktop layout at about 1024px width**

Expected:

```text
The quick actions render as three columns.
All five primary sections are visible without horizontal scrolling.
The add-dish button remains in the header.
The This week panel sits below the tile grid.
```

- [ ] **Step 5: Stop the dev server**

Press:

```text
Ctrl+C
```

Expected: the dev server process exits cleanly.

---

## Self-Review

- Spec coverage: This plan covers the selected layout decision for option B and maps the five selected sections to the home route.
- Placeholder scan: No `TBD`, `TODO`, vague implementation steps, or missing command expectations remain.
- Type consistency: `Tone`, `TileProps`, `Tile`, and the `tiles` data model use matching property names throughout the plan.
