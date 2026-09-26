import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TILE_WIDTH, isoCubeFaces, isoDiamondPoints, isoGuideDots } from "./iso.ts";

test("isoDiamondPoints is a 2:1 diamond centered on the half pixel", () => {
  assert.deepEqual(isoDiamondPoints(0, 0, 32), [
    { x: 15.5, y: 0 },
    { x: 31, y: 8 },
    { x: 15.5, y: 16 },
    { x: 0, y: 8 },
  ]);
});

test("isoDiamondPoints offsets with the origin and tile width", () => {
  const points = isoDiamondPoints(32, 64, 16);
  assert.deepEqual(points, [
    { x: 32 + 7.5, y: 64 },
    { x: 32 + 15, y: 64 + 4 },
    { x: 32 + 7.5, y: 64 + 8 },
    { x: 32, y: 64 + 4 },
  ]);
});

test("isoCubeFaces returns top/left/right quads", () => {
  const faces = isoCubeFaces(0, 0, 32, 16);
  assert.equal(faces.top.length, 4);
  assert.deepEqual(faces.left, [
    { x: 0, y: 8 },
    { x: 15.5, y: 16 },
    { x: 15.5, y: 32 },
    { x: 0, y: 24 },
  ]);
  assert.deepEqual(faces.right, [
    { x: 15.5, y: 16 },
    { x: 31, y: 8 },
    { x: 31, y: 24 },
    { x: 15.5, y: 32 },
  ]);
});

test("isoCubeFaces defaults body height to half the tile", () => {
  const faces = isoCubeFaces(0, 0, 32);
  assert.deepEqual(faces.left[2], { x: 15.5, y: 32 });
});

test("isoGuideDots covers every cell with 14 markers", () => {
  assert.equal(isoGuideDots(32, 32, 32).length, 14);
  assert.equal(isoGuideDots(64, 64, 32).length, 14 * 4);
  assert.equal(isoGuideDots(0, 0, DEFAULT_TILE_WIDTH).length, 0);
});

test("isoGuideDots places the known marker offsets", () => {
  const dots = isoGuideDots(32, 32, 32);
  const has = (x: number, y: number) => dots.some((d) => d.x === x && d.y === y);
  assert.ok(has(15, 0), "top center low");
  assert.ok(has(16, 0), "top center high");
  assert.ok(has(0, 7), "left mid");
  assert.ok(has(31, 8), "right mid");
  assert.ok(has(15, 16), "bottom center");
  assert.ok(has(0, 23), "bottom corner low");
  assert.ok(has(31, 24), "bottom corner high");
  assert.ok(has(16, 31), "absolute bottom");
});
