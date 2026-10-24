alter table plan_meals
  add column if not exists dish_ids uuid[] not null default '{}';

update plan_meals
set dish_ids = case
  when dish_id is null then '{}'::uuid[]
  else array[dish_id]
end
where dish_ids is null or cardinality(dish_ids) = 0;

create index if not exists plan_meals_dish_ids_idx on plan_meals using gin (dish_ids);
