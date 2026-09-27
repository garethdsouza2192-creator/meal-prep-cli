export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const dayOfWeek = (date.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  date.setDate(date.getDate() - dayOfWeek);
  return date;
}

export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}
