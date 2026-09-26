import assert from "node:assert/strict";
import test from "node:test";
import { normalizePixels } from "./set-pixels.ts";

test("normalizes pixel colors to rgba", () => {
  const pixels = normalizePixels([
    { x: 1, y: 2, color: "#ff0000" },
    { x: 3, y: 4, color: "skyblue" },
    { x: 5, y: 6, color: { h: 120, s: 1, l: 0.5 } },
  ]);

  assert.deepEqual(pixels, [
    { x: 1, y: 2, color: { r: 255, g: 0, b: 0, a: 255 } },
    { x: 3, y: 4, color: { r: 135, g: 206, b: 235, a: 255 } },
    { x: 5, y: 6, color: { r: 0, g: 255, b: 0, a: 255 } },
  ]);
});

test("rejects non-integer coordinates", () => {
  assert.throws(
    () => normalizePixels([{ x: 1.5, y: 0, color: "#000" }]),
    /pixel\[0\] x and y must be integers/,
  );
});

test("reports the offending pixel index for bad colors", () => {
  assert.throws(
    () =>
      normalizePixels([
        { x: 0, y: 0, color: "#000" },
        { x: 1, y: 1, color: "not-a-color" },
      ]),
    /pixel\[1\] color/,
  );
});
