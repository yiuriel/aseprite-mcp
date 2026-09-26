import assert from "node:assert/strict";
import test from "node:test";
import { autoScale } from "./render.ts";

test("autoScale targets about 192px", () => {
  assert.equal(autoScale(16, 16), 12);
  assert.equal(autoScale(32, 32), 6);
  assert.equal(autoScale(64, 32), 3);
});

test("autoScale never exceeds the cap and never goes below 1", () => {
  assert.equal(autoScale(1, 1), 16);
  assert.equal(autoScale(1000, 1000), 1);
  assert.equal(autoScale(0, 0), 1);
});
