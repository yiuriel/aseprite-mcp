import assert from "node:assert/strict";
import test from "node:test";
import { NAMED_COLORS } from "./named-colors.ts";
import { parseColor } from "./color.ts";

test("every named color is a lowercase key with a #rrggbb value", () => {
  for (const [name, hex] of Object.entries(NAMED_COLORS)) {
    assert.equal(name, name.toLowerCase(), `name ${name} should be lowercase`);
    assert.match(hex, /^#[0-9a-f]{6}$/, `value for ${name} should be lowercase hex`);
  }
});

test("every named color parses to opaque rgba", () => {
  for (const name of Object.keys(NAMED_COLORS)) {
    const rgba = parseColor(name);
    assert.equal(rgba.a, 255, `${name} should be opaque`);
  }
});

test("covers the css keyword set", () => {
  assert.equal(NAMED_COLORS.rebeccapurple, "#663399");
  assert.equal(NAMED_COLORS.aqua, NAMED_COLORS.cyan);
  assert.equal(NAMED_COLORS.fuchsia, NAMED_COLORS.magenta);
});
