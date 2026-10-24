alter table plan_meals
drop constraint if exists plan_meals_meal_slot_check;

alter table plan_meals
alter column meal_slot type text;
