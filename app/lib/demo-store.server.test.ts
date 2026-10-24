import test from "node:test";
import assert from "node:assert/strict";

import { demoStore } from "./demo-store.server.ts";

test("demo store keeps multiple dish ids in a slot and sets the primary dish id", () => {
  const date = "2026-10-19";
  const slot = "breakfast";
  const ids = ["dish-1", "dish-2"];

  const meal = demoStore.setPlanMeal(date, slot, ids);

  assert.deepEqual(meal.dish_ids, ids);
  assert.equal(meal.dish_id, ids[0]);
  assert.equal(meal.status, "planned");
});
