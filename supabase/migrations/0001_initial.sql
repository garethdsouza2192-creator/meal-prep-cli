-- Schema for the meal-prep app. See docs/superpowers/specs/2026-04-29-meal-prep-app-design.md §4.

create extension if not exists pgcrypto;

-- 4.1 dishes -----------------------------------------------------------------
create table dishes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  name          text not null,
  cuisine       text,
  meal_types    text[] not null default '{}',
  prep_time_min int,
  tags          text[] default '{}',
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index dishes_user_id_idx on dishes (user_id);

-- 4.2 dish_ingredients -------------------------------------------------------
create table dish_ingredients (
  id        uuid primary key default gen_random_uuid(),
  dish_id   uuid not null references dishes(id) on delete cascade,
  name      text not null,
  quantity  numeric,
  unit      text,
  position  int not null default 0
);
create index dish_ingredients_dish_id_idx on dish_ingredients (dish_id);

-- 4.3 plan_meals -------------------------------------------------------------
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
create index plan_meals_user_date_idx on plan_meals (user_id, meal_date);

-- updated_at trigger for dishes ----------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger dishes_set_updated_at
  before update on dishes
  for each row execute function set_updated_at();

-- Row-Level Security ---------------------------------------------------------
alter table dishes enable row level security;
alter table dish_ingredients enable row level security;
alter table plan_meals enable row level security;

create policy "dishes: owner can select" on dishes
  for select using (auth.uid() = user_id);
create policy "dishes: owner can insert" on dishes
  for insert with check (auth.uid() = user_id);
create policy "dishes: owner can update" on dishes
  for update using (auth.uid() = user_id);
create policy "dishes: owner can delete" on dishes
  for delete using (auth.uid() = user_id);

create policy "dish_ingredients: owner via dish" on dish_ingredients
  for all using (
    exists (
      select 1 from dishes
      where dishes.id = dish_ingredients.dish_id
        and dishes.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from dishes
      where dishes.id = dish_ingredients.dish_id
        and dishes.user_id = auth.uid()
    )
  );

create policy "plan_meals: owner can select" on plan_meals
  for select using (auth.uid() = user_id);
create policy "plan_meals: owner can insert" on plan_meals
  for insert with check (auth.uid() = user_id);
create policy "plan_meals: owner can update" on plan_meals
  for update using (auth.uid() = user_id);
create policy "plan_meals: owner can delete" on plan_meals
  for delete using (auth.uid() = user_id);
