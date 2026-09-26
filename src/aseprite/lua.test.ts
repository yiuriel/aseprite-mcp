import assert from "node:assert/strict";
import test from "node:test";
import {
  ERROR_SENTINEL,
  RESULT_SENTINEL,
  buildWrappedScript,
  filterStderr,
  luaString,
  parseLuaOutput,
} from "./lua.ts";

test("luaString escapes quotes, backslashes, and newlines", () => {
  assert.equal(luaString("/tmp/a.json"), '"/tmp/a.json"');
  assert.equal(luaString('a"b'), '"a\\"b"');
  assert.equal(luaString("a\\b"), '"a\\\\b"');
  assert.equal(luaString("a\nb\r"), '"a\\nb\\r"');
});

test("buildWrappedScript embeds the args path and body and sentinels", () => {
  const script = buildWrappedScript('return { n = MCP_ARGS.n }', "/tmp/x/args.json");
  assert.ok(script.includes('"/tmp/x/args.json"'));
  assert.ok(script.includes("return { n = MCP_ARGS.n }"));
  assert.ok(script.includes(RESULT_SENTINEL));
  assert.ok(script.includes(ERROR_SENTINEL));
});

test("filterStderr drops extension noise but keeps real errors", () => {
  const noise = "/Users/me/Aseprite/extensions/pixellab/handle-pose.lua:58: attempt to index a nil value";
  const real = "script.lua:12: intentional failure";
  assert.equal(filterStderr(`${noise}\n${real}\n${noise}`), real);
  assert.equal(filterStderr("\n\n"), "");
});

test("parseLuaOutput reads a result line", () => {
  const parsed = parseLuaOutput(`${RESULT_SENTINEL}{"a":1}`);
  assert.equal(parsed.kind, "result");
  assert.deepEqual(parsed.value, { a: 1 });
});

test("parseLuaOutput reads an error line", () => {
  const parsed = parseLuaOutput(`${ERROR_SENTINEL}boom`);
  assert.equal(parsed.kind, "error");
  assert.equal(parsed.error, "boom");
});

test("parseLuaOutput reports malformed json", () => {
  const parsed = parseLuaOutput(`${RESULT_SENTINEL}not-json`);
  assert.equal(parsed.kind, "result");
  assert.ok(parsed.parseError);
});

test("parseLuaOutput returns none when no sentinel is present", () => {
  assert.equal(parseLuaOutput("just some logs").kind, "none");
});
