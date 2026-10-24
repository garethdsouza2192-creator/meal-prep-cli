create table user_meal_slot_configs (
  user_id     uuid primary key references auth.users on delete cascade,
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index user_meal_slot_configs_user_id_idx on user_meal_slot_configs (user_id);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_meal_slot_configs_set_updated_at
  before update on user_meal_slot_configs
  for each row execute function set_updated_at();

alter table user_meal_slot_configs enable row level security;

create policy "user_meal_slot_configs: owner can select" on user_meal_slot_configs
  for select using (auth.uid() = user_id);
create policy "user_meal_slot_configs: owner can insert" on user_meal_slot_configs
  for insert with check (auth.uid() = user_id);
create policy "user_meal_slot_configs: owner can update" on user_meal_slot_configs
  for update using (auth.uid() = user_id);
create policy "user_meal_slot_configs: owner can delete" on user_meal_slot_configs
  for delete using (auth.uid() = user_id);
