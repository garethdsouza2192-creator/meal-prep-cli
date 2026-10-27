import { useEffect, useMemo, useState } from "react";
import { Form, Link } from "react-router";
import {
  BookOpen,
  Calendar,
  LogOut,
  Plus,
  Refrigerator,
  ShoppingCart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { AddDishDrawer } from "~/components/add-dish-drawer";
import { startOfWeek, toIsoDate, weekDates } from "~/lib/dates";
import { countDishes, listDishes } from "~/lib/dishes.server";
import { countPlannedThisWeek, listPlanMealsInRange } from "~/lib/plan.server";
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

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  const monthStartStr = toIsoDate(monthStart);
  const monthEndStr = toIsoDate(monthEnd);

  const [dishCount, plannedThisWeek, dishes, monthPlan] = await Promise.all([
    countDishes(supabase),
    countPlannedThisWeek(supabase, startStr, endStr),
    listDishes(supabase),
    listPlanMealsInRange(supabase, monthStartStr, monthEndStr),
  ]);

  console.log("Home loader data", { dishCount, plannedThisWeek, dishes: dishes.length, monthPlan: monthPlan.length });

  return new Response(
    JSON.stringify({
      dishCount,
      plannedThisWeek,
      dishes,
      plan: monthPlan,
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
  to?: string;
  icon: LucideIcon;
  title: string;
  count?: string;
  tone: Tone;
  compact?: boolean;
  onClick?: () => void;
};

function Tile({ to, icon: Icon, title, count, tone, compact = false, onClick }: TileProps) {
  const content = (
    <>
      <div className={`grid size-7 place-items-center rounded-full ring-1 ${TONES[tone]} transition group-hover:scale-105`}>
        <Icon className="size-3.5" />
      </div>
      <span className="text-[11px] font-medium leading-none">{title}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="group inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card px-2.5 py-2 text-muted-foreground shadow-sm transition hover:border-foreground/20 hover:text-foreground"
      >
        {content}
      </button>
    );
  }

  if (compact) {
    return (
      <Link
        to={to ?? "/"}
        title={title}
        className="group inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card px-2.5 py-2 text-muted-foreground shadow-sm transition hover:border-foreground/20 hover:text-foreground"
      >
        {content}
      </Link>
    );
  }

  return (
    <Link
      to={to ?? "/"}
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

const MEAL_TONE_CLASS: Record<string, string> = {
  breakfast: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  lunch: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900",
  dinner: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  snack: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
};

function getMealTone(slot: string): string {
  const key = String(slot).toLowerCase();
  return MEAL_TONE_CLASS[key] ?? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900";
}

function getMealSortOrder(slot: string): number {
  const key = String(slot).trim().toLowerCase();
  if (key === "breakfast") return 0;
  if (key === "lunch") return 1;
  if (key === "dinner") return 2;
  return 3;
}

function sortMealsForCalendar<T extends { meal_slot: string }>(meals: T[]): T[] {
  return [...meals].sort((a, b) => {
    const orderDelta = getMealSortOrder(a.meal_slot) - getMealSortOrder(b.meal_slot);
    if (orderDelta !== 0) return orderDelta;

    return String(a.meal_slot).localeCompare(String(b.meal_slot));
  });
}

function getDishNamesForMeal(meal: { dish_id?: string | null; dish_ids?: string[] | null }, dishMap: Map<string, string>) {
  const ids = [
    ...(Array.isArray(meal.dish_ids) ? meal.dish_ids : meal.dish_id ? [meal.dish_id] : []),
    ...(meal.dish_id ? [meal.dish_id] : []),
  ];

  return Array.from(new Set(ids.filter(Boolean))).map((id) => dishMap.get(id)).filter(Boolean) as string[];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { dishCount, plannedThisWeek, dishes, plan, user } = loaderData as {
    dishCount: number;
    plannedThisWeek: number;
    dishes: Array<{ id: string; name: string; meal_types?: string[] }>;
    plan: Array<{ meal_date: string; meal_slot: string; dish_id?: string | null; dish_ids?: string[] | null }>;
    user?: { email?: string };
  };
  const greeting = useGreeting();
  const [view, setView] = useState<"week" | "month">("week");
  const [weekWindow, setWeekWindow] = useState<"this" | "next">("this");
  const [isAddDishOpen, setIsAddDishOpen] = useState(false);
  const userEmail = user?.email ?? "User";
  const initials = userEmail
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

  const dishMap = useMemo(() => new Map(dishes.map((dish) => [dish.id, dish.name])), [dishes]);

  const mealsByDate = useMemo(() => {
    const map = new Map<string, Map<string, { meal_slot: string; dishNames: Set<string> }>>();

    for (const meal of plan) {
      const dateKey = meal.meal_date;
      const slotMap = map.get(dateKey) ?? new Map();
      const existing = slotMap.get(meal.meal_slot) ?? {
        meal_slot: meal.meal_slot,
        dishNames: new Set<string>(),
      };

      for (const dishName of getDishNamesForMeal(meal, dishMap)) {
        existing.dishNames.add(dishName);
      }

      slotMap.set(meal.meal_slot, existing);
      map.set(dateKey, slotMap);
    }

    const resolved = new Map<string, Array<{ meal_slot: string; dishNames: string[] }>>();
    for (const [dateKey, slotMap] of map.entries()) {
      resolved.set(
        dateKey,
        sortMealsForCalendar(
          [...slotMap.values()].map((entry) => ({
            meal_slot: entry.meal_slot,
            dishNames: [...entry.dishNames],
          })),
        ),
      );
    }

    return resolved;
  }, [dishMap, plan]);

  const visibleWeekStart = useMemo(() => {
    const start = startOfWeek(new Date());
    const next = new Date(start);
    next.setDate(start.getDate() + (weekWindow === "next" ? 7 : 0));
    return next;
  }, [weekWindow]);

  const weekDays = useMemo(() => weekDates(visibleWeekStart), [visibleWeekStart]);
  const monthDate = new Date();
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  const monthCells = useMemo(() => {
    const cells: Date[] = [];
    for (let i = 0; i < 42; i += 1) {
      const cell = new Date(calendarStart);
      cell.setDate(calendarStart.getDate() + i);
      cells.push(cell);
    }
    return cells;
  }, [calendarStart]);

  return (
    <main className="mx-auto min-h-svh max-w-4xl px-4 py-8 sm:py-12">
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
          <Form method="post" action="/logout">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </Form>
        </div>
      </header>

      <AddDishDrawer open={isAddDishOpen} onClose={() => setIsAddDishOpen(false)} existingDishes={dishes} />

      <section className="mb-6 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {/* <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Calendar
            </div> */}
            {view === "week" && (
              <div className="mt-2 inline-flex rounded-full border border-foreground/10 bg-muted/60 p-1">
              {(["this", "next"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setWeekWindow(option)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    weekWindow === option
                      ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option === "this" ? "This week" : "Next week"}
                </button>
              ))}
            </div>
            )}
          </div>
          <div className="inline-flex rounded-full border border-foreground/10 bg-muted/60 p-1">
            {(["week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                  view === option
                    ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {view === "week" ? (
          <div className="grid gap-2 sm:grid-cols-7">
            {weekDays.map((date) => {
              const iso = toIsoDate(date);
              const dailyMeals = mealsByDate.get(iso) ?? [];
              const isToday = iso === toIsoDate(new Date());
              return (
                <div key={iso} className={`rounded-xl border p-2 transition-all ${isToday ? "border-primary" : "border-foreground/10 bg-background/60"}`}>
                  <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {new Intl.DateTimeFormat("en", { weekday: "short" }).format(date) + " "}
                    {new Intl.DateTimeFormat("en", { day: "numeric" }).format(date)}
                  </div>
                  <div className="space-y-1.5">
                    {dailyMeals.length !== 0 && (
                      dailyMeals.map((meal, index) => (
                        <div key={`${iso}-${meal.meal_slot}-${index}`} className={`rounded-md px-1.5 py-1 text-[10px] ring-1 ${getMealTone(meal.meal_slot)}`}>
                          <div className="truncate font-medium capitalize">{meal.meal_slot}</div>
                          <div className="mt-0.5 line-clamp-2">
                            {meal.dishNames.length > 0 ? meal.dishNames.join(", ") : "Planned"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {monthCells.map((date) => {
              const iso = toIsoDate(date);
              const isCurrentMonth = date.getMonth() === monthDate.getMonth();
              const dailyMeals = mealsByDate.get(iso) ?? [];
              return (
                <div
                  key={iso}
                  className={`min-h-[110px] rounded-xl border p-2 ${
                    isCurrentMonth
                      ? "border-foreground/10 bg-background/60"
                      : "border-foreground/5 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <div className="mb-2 text-right text-[10px] font-semibold text-muted-foreground">
                    {new Intl.DateTimeFormat("en", { day: "numeric" }).format(date)}
                  </div>
                  <div className="space-y-1.5">
                    {dailyMeals.slice(0, 2).map((meal, index) => (
                      <div key={`${iso}-${meal.meal_slot}-${index}`} className={`rounded-md px-1.5 py-1 text-[9px] ring-1 ${getMealTone(meal.meal_slot)}`}>
                        <div className="truncate font-medium capitalize">{meal.meal_slot}</div>
                        <div className="mt-0.5 line-clamp-2">
                          {meal.dishNames.length > 0 ? meal.dishNames.join(", ") : "Planned"}
                        </div>
                      </div>
                    ))}
                    {dailyMeals.length > 2 && (
                      <div className="text-[9px] text-muted-foreground">+{dailyMeals.length - 2} more</div>
                    )}
                    {/* {dailyMeals.length === 0 && (
                      <div className="rounded-md border border-dashed border-foreground/10 px-1.5 py-1 text-[9px] text-muted-foreground">
                        Free
                      </div>
                    )} */}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8 sm:gap-3">
        <section aria-label="Quick actions" className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Tile to="/dishes" icon={BookOpen} title="Dishes" compact tone="amber" />
          <Tile to="/suggest" icon={Sparkles} title="Suggest a dish" compact tone="violet" />
          <Tile to="/suggest?mode=pantry" icon={Refrigerator} title="What I have" compact tone="emerald" />
          <Tile to="/plan" icon={Calendar} title="Weekly plan" compact tone="sky" />
          <Tile to="/grocery" icon={ShoppingCart} title="Grocery list" compact tone="rose" />
          <Tile
            icon={Plus}
            title="Add a dish"
            compact
            tone="neutral"
            onClick={() => setIsAddDishOpen(true)}
          />
        </section>
      </div>

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
