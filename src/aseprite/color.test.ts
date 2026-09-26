import assert from "node:assert/strict";
import test from "node:test";
import { colorToLua, interpolateRamp, parseColor, rgbToHsl, rgbToHsv } from "./color.ts";

test("parses short and long hex", () => {
  assert.deepEqual(parseColor("#f00"), { r: 255, g: 0, b: 0, a: 255 });
  assert.deepEqual(parseColor("#00ff00"), { r: 0, g: 255, b: 0, a: 255 });
  assert.deepEqual(parseColor("0000ff"), { r: 0, g: 0, b: 255, a: 255 });
});

test("parses hex with alpha", () => {
  assert.deepEqual(parseColor("#0000ff80"), { r: 0, g: 0, b: 255, a: 128 });
  assert.deepEqual(parseColor("#f00f"), { r: 255, g: 0, b: 0, a: 255 });
});

test("parses named colors case-insensitively", () => {
  assert.deepEqual(parseColor("red"), { r: 255, g: 0, b: 0, a: 255 });
  assert.deepEqual(parseColor("RebeccaPurple"), { r: 102, g: 51, b: 153, a: 255 });
  assert.deepEqual(parseColor(" skyblue "), { r: 135, g: 206, b: 235, a: 255 });
});

test("parses rgb objects with default alpha", () => {
  assert.deepEqual(parseColor({ r: 10, g: 20, b: 30 }), { r: 10, g: 20, b: 30, a: 255 });
  assert.deepEqual(parseColor({ r: 10, g: 20, b: 30, a: 128 }), {
    r: 10,
    g: 20,
    b: 30,
    a: 128,
  });
});

test("parses hsl", () => {
  assert.deepEqual(parseColor({ h: 0, s: 1, l: 0.5 }), { r: 255, g: 0, b: 0, a: 255 });
  assert.deepEqual(parseColor({ h: 120, s: 1, l: 0.5 }), { r: 0, g: 255, b: 0, a: 255 });
  assert.deepEqual(parseColor({ h: 210, s: 0, l: 0.5 }), { r: 128, g: 128, b: 128, a: 255 });
});

test("parses hsv", () => {
  assert.deepEqual(parseColor({ h: 0, s: 1, v: 1 }), { r: 255, g: 0, b: 0, a: 255 });
  assert.deepEqual(parseColor({ h: 210, s: 0.5, v: 0.4 }), { r: 51, g: 77, b: 102, a: 255 });
});

test("reads s/l/v above 1 as percent", () => {
  assert.deepEqual(parseColor({ h: 0, s: 100, l: 50 }), { r: 255, g: 0, b: 0, a: 255 });
});

test("wraps hue values", () => {
  assert.deepEqual(parseColor({ h: 480, s: 1, l: 0.5 }), { r: 0, g: 255, b: 0, a: 255 });
  assert.deepEqual(parseColor({ h: -120, s: 1, l: 0.5 }), { r: 0, g: 0, b: 255, a: 255 });
});

test("rejects invalid colors", () => {
  assert.throws(() => parseColor("#zzz"), /Invalid color/);
  assert.throws(() => parseColor("#12345"), /Invalid color/);
  assert.throws(() => parseColor({ r: 256, g: 0, b: 0 }), /between 0 and 255/);
  assert.throws(() => parseColor({ r: -1, g: 0, b: 0 }), /between 0 and 255/);
  assert.throws(() => parseColor({ h: 0, s: -1, l: 0.5 }), /non-negative/);
});

test("colorToLua emits an Aseprite Color literal", () => {
  assert.equal(colorToLua({ r: 1, g: 2, b: 3, a: 4 }), "Color{r=1, g=2, b=3, a=4}");
});

test("rgbToHsl and rgbToHsv convert primaries", () => {
  assert.deepEqual(rgbToHsl({ r: 255, g: 0, b: 0, a: 255 }), { h: 0, s: 1, l: 0.5 });
  assert.deepEqual(rgbToHsl({ r: 255, g: 255, b: 255, a: 255 }), { h: 0, s: 0, l: 1 });
  assert.deepEqual(rgbToHsv({ r: 0, g: 0, b: 255, a: 255 }), { h: 240, s: 1, v: 1 });
});

test("interpolateRamp generates rgb endpoints and midpoint", () => {
  const ramp = interpolateRamp(
    { r: 255, g: 0, b: 0, a: 255 },
    { r: 0, g: 0, b: 255, a: 255 },
    3,
    "rgb",
  );
  assert.deepEqual(ramp, [
    { r: 255, g: 0, b: 0, a: 255 },
    { r: 128, g: 0, b: 128, a: 255 },
    { r: 0, g: 0, b: 255, a: 255 },
  ]);
});

test("interpolateRamp preserves endpoints in hsl and hsv", () => {
  const from = { r: 200, g: 40, b: 40, a: 255 };
  const to = { r: 40, g: 200, b: 90, a: 128 };
  for (const space of ["hsl", "hsv"] as const) {
    const ramp = interpolateRamp(from, to, 5, space);
    assert.equal(ramp.length, 5);
    assert.deepEqual(ramp[0], from);
    assert.deepEqual(ramp[4], to);
  }
});

test("interpolateRamp rejects too few steps", () => {
  assert.throws(
    () => interpolateRamp({ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }, 1),
    /at least 2/,
  );
});
