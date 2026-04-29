# Meal Prep App — Design Spec

**Date:** 2026-04-29
**Owner:** Pratiksha More (pmore@ebsco.com)
**Status:** Approved for implementation planning

---

## 1. Purpose

A personal web app for managing the family's recurring dish list, getting AI-assisted suggestions on what to cook (either for tonight or based on what's in the kitchen right now), planning the week, and generating a grocery list from the plan. Used from desktop and mobile browsers; one shared family account.

The "data dashboards" framing is satisfied by a tile-grid home screen with live counts (dish count, meals planned this week, grocery items pending). A separate analytics page is **not** in v1.

---

## 2. Scope

### In scope (v1)

- Dish CRUD with structured ingredients, cuisine, meal types, prep time, tags, notes
- "Suggest a dish" flow with two modes on one screen:
  - **Tonight mode** — filters (cuisine, max prep time, meal type, tags) → 3 AI-ranked picks
  - **Pantry mode** — paste what's in the kitchen → 3 AI picks that match
- Weekly meal planner (configurable meal slots, stored in localStorage)
- Grocery list from current week's plan, with a "what I already have" textarea that diffs the list
- Mark-as-cooked, used to derive `last_cooked_at` and avoid repeats
- Magic-link auth (single shared family account)

### Explicitly out of scope (v1)

- Per-person dietary preferences (multi-user household)
- Insights / analytics page
- "Propose a brand-new dish" via Sonnet
- Persistent pantry / inventory tracking
- Ingredient categorization (produce/pantry/dairy aisles)
- Recipe scraping or import from URLs
- Photos, ratings, calorie tracking
- Native mobile app (responsive web is enough; PWA installable later)

---

## 3. Architecture

```
[ Browser / mobile browser ]
            │
            ▼
[ Vercel ]
   ├─ React Router v7 (framework mode), SSR + client hydration
   │     loaders  → read from Supabase via @supabase/ssr
   │     actions  → write to Supabase, then redirect
   └─ /resources/suggest  (server-only resource route)
         calls Anthropic API with key from env
                         │
                         ▼
[ Supabase ]   Postgres + Auth + RLS
   tables: dishes, dish_ingredients, plan_meals
```

### Key architectural decisions

- **Single Vercel project, single Supabase project.** Free tier on both is enough.
- **`@supabase/ssr`** is used for cookie-based auth so loaders are auth-aware on the first paint (no logged-out flash).
- **Anthropic SDK lives only in server code.** The API key is never sent to the browser. The single resource route `/resources/suggest` is the only path that calls Anthropic.
- **Row-Level Security is on** for all three tables, scoped to `auth.uid()`. Even with one account, RLS is cheap and protects against future changes.
- **No separate API/backend service.** Loaders/actions own all reads and writes.
- **Prompt caching** on the Anthropic call (the dish catalog and system prompt are stable across calls).

---

## 4. Data Model

Three tables in Postgres. RLS scoped to `auth.uid()` on every row.

```sql
-- 4.1 dishes -------------------------------------------------------------
create table dishes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  name          text not null,
  cuisine       text,
  meal_types    text[] not null default '{}',   -- ['breakfast'|'lunch'|'dinner'|'snack']
  prep_time_min int,
  tags          text[] default '{}',
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 4.2 dish_ingredients ---------------------------------------------------
create table dish_ingredients (
  id        uuid primary key default gen_random_uuid(),
  dish_id   uuid not null references dishes(id) on delete cascade,
  name      text not null,
  quantity  numeric,
  unit      text,
  position  int not null default 0
);
create index on dish_ingredients (dish_id);

-- 4.3 plan_meals ---------------------------------------------------------
create table plan_meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  meal_date   date not null,
  meal_slot   text not null check (meal_slot in ('breakfast','lunch','dinner','snack')),
  dish_id     uuid references dishes(id) on delete set null,
  status      text not null default 'planned' check (status in ('planned','cooked','skipped')),
  cooked_at   timestamptz,
  unique (user_id, meal_date, meal_slot)
);
create index on plan_meals (user_id, meal_date);
```

### Derived values (no columns)

- **`last_cooked_at` per dish** =
  `select max(meal_date) from plan_meals where dish_id = $1 and status = 'cooked'`
  Computed in the suggest pipeline; never stored.

### What's not in the schema

- **Enabled meal slots per week** — stored in `localStorage` (`mealprep.enabledSlots = ['lunch','dinner']`). It's a UI preference and doesn't need to be in the DB.
- **`weekly_plans` aggregate table** — dropped. `plan_meals` is keyed by date directly.
- **Suggestion log** — dropped. Costs more than it earns in v1.

---

## 5. Routes / Screens

File-based routing in `app/routes/`:

| Route                  | Purpose                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `/`                    | Tile-grid home: 5 tiles (Dishes, Suggest, Plan, Grocery, Add Dish) with live counts; "this week" strip below |
| `/login`               | Email magic-link auth (Supabase)                                                                     |
| `/dishes`              | List + search + filter; inline "add dish" CTA                                                        |
| `/dishes/new`          | Add dish form                                                                                        |
| `/dishes/:id`          | Edit / delete                                                                                        |
| `/suggest`             | Toggle: Tonight ⇆ Pantry. Filters (Tonight) or textarea (Pantry). Returns 3 ranked picks.            |
| `/plan`                | Week grid: rows = days, cols = enabled slots. Click cell → dish picker drawer. Mark-as-cooked toggle. |
| `/grocery`             | Sums ingredients from the current week's plan; "what I already have" textarea diffs the list. Copy-to-clipboard button. |
| `/resources/suggest`   | Server-only POST. Calls Anthropic, returns 3 dishes with reasons.                                    |

### Mobile interactions

- Tile grid: 2 columns on phone, 3 on tablet+.
- `/plan` dish picker becomes a bottom sheet on small viewports.
- `/grocery` category-less flat list (sorted alphabetically); checkboxes for crossing items off.

---

## 6. AI Suggestion Engine

One endpoint, one model, two stages.

### 6.1 Pipeline

```
POST /resources/suggest
body: {
  mode: 'tonight' | 'pantry',
  filters?: { cuisine?, max_prep_time?, meal_type?, tags? },
  pantry_snapshot?: string   // freeform, only present when mode='pantry'
}

  ┌─ Stage 1: Postgres rule filter ─────────────────────────────────┐
  │ - meal_type matches filter (when given)                          │
  │ - cuisine matches (when given)                                   │
  │ - prep_time_min <= max (when given)                              │
  │ - dish has NOT been cooked in the last 7 days                    │
  │   (LEFT JOIN plan_meals on dish_id WHERE status='cooked')        │
  │ - LIMIT 15 candidates                                            │
  └──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
  ┌─ Stage 2: Claude Haiku 4.5 ranks ───────────────────────────────┐
  │ Prompt (with prompt caching on the stable parts):                │
  │  - System: rules of the game (return 3 best picks, with reasons) │
  │  - The 15 candidates (id, name, cuisine, prep_time, tags,        │
  │    ingredients summarized as comma-separated names)              │
  │  - Recent cooking history (last 14 days)                         │
  │  - mode + filters + pantry_snapshot (when present)               │
  │ Tool: `return_suggestions(picks: [{dish_id, reason}])`           │
  │ Forces structured JSON output via tool_use.                      │
  └──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
  ┌─ Stage 3: Hydrate and respond ──────────────────────────────────┐
  │ Server looks up full dish records by id, returns:                │
  │ [{ dish: {full record}, reason: "..." }, ...]                    │
  └──────────────────────────────────────────────────────────────────┘
```

### 6.2 Decisions and behaviors

- **Model:** `claude-haiku-4-5` for all calls in v1. No Sonnet path.
- **Prompt caching:** `cache_control: { type: 'ephemeral' }` on the system prompt and dish-catalog block. Warm calls drop ~70–90% of input tokens.
- **Tool use** is mandatory — model must respond via `return_suggestions`. No free-text JSON parsing.
- **Pantry mode** does NOT do server-side fuzzy matching. The snapshot is passed verbatim to Haiku, which decides which candidates are makeable from it. The Postgres filter is unchanged from Tonight mode (still applies cuisine/prep filters if present).
- **Empty Stage 1 result** (no candidates): UI shows "No matches — try relaxing a filter" without calling the LLM.
- **Anthropic call fails:** the resource route returns HTTP 503 with `{ error: 'ai_unavailable' }`. The UI shows an error card with a Retry button and a secondary button "Show me rule-only picks anyway" that re-fetches with `?fallback=true`, returning the top 3 candidates from Stage 1 sorted by `prep_time_min ASC`. **No silent degradation** — the user always knows when AI is offline.
- **Caching the *response*** is not done in v1. Each click is a fresh call.

### 6.3 Cost target

At ~30 suggestions/month with prompt caching warm, **under $0.10/month** in Anthropic spend.

---

## 7. Grocery List Logic

```
input: this_week's plan_meals (joined to dishes, dish_ingredients)
       optional snapshot text "rice, dal, 2 onions, paneer"

steps:
  1. Aggregate by ingredient name (case-insensitive, singularized):
       sum quantities when units match,
       otherwise list separately ("ginger 1 tbsp + ginger 2 inch").
  2. If snapshot provided:
       tokenize snapshot ("rice", "dal", "onion", "paneer"),
       mark matching ingredients as already-have (struck through, not removed).
  3. Sort alphabetically.
output:
  [{ name, quantity, unit, alreadyHave: bool }, ...]
```

The aggregator is a pure function (`groceryListFromPlan`) and is unit-tested.

---

## 8. Auth

- **Supabase magic link** (email-only).
- `app/lib/supabase.server.ts` builds a per-request SSR client from cookies.
- `app/lib/require-user.ts` is called at the top of every loader/action; redirects to `/login` if not authed.
- `/login` posts an email → Supabase sends a magic link → click → cookie set → redirect home.
- Logout = clear Supabase session cookie + redirect to `/login`.

No password reset, no signup form (inviting new family members happens via Supabase dashboard for v1; that's fine for a personal tool).

---

## 9. Testing

Two layers, kept minimal.

### Unit (`vitest`)

- `groceryListFromPlan(planMeals, dishes, snapshot?)` — aggregation + diff
- `buildSuggestPrompt(candidates, history, mode, filters, snapshot?)` — prompt structure (asserts cache_control placement, candidate format, tool definition)
- `parseSnapshot(text)` — tokenize + singularize

### Smoke E2E (`playwright`)

One test:

> login → add a dish → plan it on tomorrow's dinner → see it on the grocery list

Run on every PR via Vercel preview deploy.

---

## 10. Deployment

- **Vercel** project linked to GitHub repo. Preview deploys on every PR.
- **Supabase** free-tier project. Migrations checked into `/supabase/migrations/` and applied via `supabase db push` manually before deploys that include schema changes.

### Env vars

| Variable                    | Where         | Purpose                          |
| --------------------------- | ------------- | -------------------------------- |
| `SUPABASE_URL`              | server+client | Supabase project URL             |
| `SUPABASE_ANON_KEY`         | server+client | Public anon key                  |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only   | Used in seed/migration scripts   |
| `ANTHROPIC_API_KEY`         | server-only   | Used by `/resources/suggest`     |
| `SESSION_SECRET`            | server-only   | Cookie signing                   |

`.env.local` for dev, mirrored in Vercel project settings for prod.

---

## 11. Out-of-the-box look and feel

- **Tailwind CSS** + **shadcn/ui** for components (Button, Card, Dialog, Sheet, Input, Select, Badge, Checkbox, Toggle).
- **Lucide icons** for tile graphics.
- **System dark mode** respected by default.
- **Mobile-first:** every screen verified at 375px-wide before desktop polish.

No bespoke design system. shadcn defaults are good enough for a personal tool.

---

## 12. Risk register

| Risk                                                  | Mitigation                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| Anthropic API down → suggest button broken            | Explicit error UI + opt-in rule-only fallback button (§6.2).         |
| User adds 200 dishes → prompt gets too long           | Stage 1 LIMIT 15 caps the candidate list. Catalog never sent in full. |
| Schema drift between dev and prod                     | Migrations in repo, applied via `supabase db push`. Manual gate.     |
| Family member edits while you're editing same dish    | `updated_at` exists; v1 accepts last-write-wins. Document in README. |

---

## 13. Open questions for implementation

None blocking. Items to decide during implementation, not now:

- Exact tile copy and emoji choices on the home grid
- Typography scale (default shadcn is fine; tweak after first mobile test)
- Whether to seed an example dish on first login
