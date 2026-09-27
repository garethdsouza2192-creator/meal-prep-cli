import { useEffect, useState } from "react";
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
  console.log("Home loader start", { url: request.url });

  const auth = await requireUser(request);
  console.log("Home loader auth state", {
    demo: auth.demo,
    userId: auth.user?.id,
    userEmail: auth.user?.email,
  });

  const { supabase, headers, user } = auth;
  const days = weekDates(startOfWeek(new Date()));
  const startStr = toIsoDate(days[0]);
  const endStr = toIsoDate(days[days.length - 1]);

  const [dishCount, plannedThisWeek] = await Promise.all([
    countDishes(supabase),
    countPlannedThisWeek(supabase, startStr, endStr),
  ]);

  console.log("Home loader data", { dishCount, plannedThisWeek });

  return new Response(
    JSON.stringify({
      dishCount,
      plannedThisWeek,
      user: { email: user.email ?? "User" },
    }),
    {
      headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" },
    },
  );
}

type Tone = "amber" | "violet" | "emerald" | "sky" | "rose" | "neutral";

const TONES: Record<Tone, string> = {
  amber:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ring-amber-200/50 dark:ring-amber-900/50",
  violet:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 ring-violet-200/50 dark:ring-violet-900/50",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-emerald-200/50 dark:ring-emerald-900/50",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 ring-sky-200/50 dark:ring-sky-900/50",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-rose-200/50 dark:ring-rose-900/50",
  neutral:
    "bg-muted text-foreground ring-foreground/10",
};

type TileProps = {
  to: string;
  icon: LucideIcon;
  title: string;
  count?: string;
  tone: Tone;
};

function Tile({ to, icon: Icon, title, count, tone }: TileProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20 active:translate-y-0 sm:p-5"
    >
      <div
        className={`grid size-11 place-items-center rounded-xl ring-1 ${TONES[tone]} transition group-hover:scale-105`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="font-medium leading-tight">{title}</div>
        {count !== undefined && (
          <div className="mt-0.5 text-xs text-muted-foreground">{count}</div>
        )}
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
  const { dishCount, plannedThisWeek, user } = loaderData as {
    dishCount: number;
    plannedThisWeek: number;
    user?: { email?: string };
  };
  const greeting = useGreeting();
  const userEmail = user?.email ?? "User";
  const initials = userEmail
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

  return (
    <main className="mx-auto min-h-svh max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-start justify-between gap-4 sm:mb-12">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What's the plan?
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-foreground/10 bg-card px-3 py-2 shadow-sm">
          <div className="grid size-8 place-items-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60">
            {initials}
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Signed in
            </div>
            <div className="max-w-[12rem] truncate text-sm font-medium text-foreground">
              {userEmail}
            </div>
          </div>
        </div>
      </header>

      <section
        aria-label="Quick actions"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <Tile
          to="/dishes"
          icon={BookOpen}
          title="Dishes"
          count={dishCount === 0 ? "Empty" : `${dishCount} saved`}
          tone="amber"
        />
        <Tile to="/suggest" icon={Sparkles} title="Suggest a dish" tone="violet" />
        <Tile
          to="/suggest?mode=pantry"
          icon={Refrigerator}
          title="What I have"
          tone="emerald"
        />
        <Tile
          to="/plan"
          icon={Calendar}
          title="Weekly plan"
          count={plannedThisWeek === 0 ? "Open" : `${plannedThisWeek} planned`}
          tone="sky"
        />
        <Tile to="/grocery" icon={ShoppingCart} title="Grocery list" tone="rose" />
        <Tile to="/dishes/new" icon={Plus} title="Add a dish" tone="neutral" />
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
            <Link to="/plan" className="font-medium text-foreground underline-offset-2 hover:underline">
              Open the weekly plan
            </Link>{" "}
            to drop dishes into days.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {plannedThisWeek} {plannedThisWeek === 1 ? "meal" : "meals"} on the
            calendar.{" "}
            <Link to="/plan" className="font-medium text-foreground underline-offset-2 hover:underline">
              See the week →
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
