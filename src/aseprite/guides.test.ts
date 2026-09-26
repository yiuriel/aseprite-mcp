import assert from "node:assert/strict";
import test from "node:test";
import { isGuideLayerName } from "./guides.ts";

test("recognizes the guide layer name and underscore prefix", () => {
  assert.equal(isGuideLayerName("symmetrical guides"), true);
  assert.equal(isGuideLayerName("_grid"), true);
  assert.equal(isGuideLayerName("_"), true);
});

test("treats normal layers as non-guides", () => {
  assert.equal(isGuideLayerName("hero"), false);
  assert.equal(isGuideLayerName("background"), false);
  assert.equal(isGuideLayerName("symmetrical"), false);
});
