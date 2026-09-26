# AGENTS.md

Local MCP server that lets an agent drive **Aseprite** headlessly to create pixel art.

## Commands

| Purpose | Command |
| --- | --- |
| Run server | `npm start` (`node src/index.ts`) |
| Watch server | `npm run dev` |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) |
| Unit tests | `npm test` (`node --test`) |
| Watch tests | `npm run test:watch` |
| Integration tests (spawns Aseprite) | `npm run test:integration` |

Always run `npm run typecheck` and `npm test` after code changes.

## Hard constraints

- **Runs as raw TypeScript on Node's native type stripping.** No build step. Therefore:
  - No `enum`, `namespace`, decorators, or constructor parameter properties.
  - Relative imports **must use the `.ts` extension** (`import { x } from "./y.ts"`).
- Never write to **stdout** in server code — it carries JSON-RPC. Log via `console.error`.
- Requires the Aseprite binary. Resolved by `src/config.ts` (env `ASEPRITE_BIN` overrides).

## Layout

```
src/
  config.ts              locate the Aseprite binary
  index.ts               MCP server bootstrap + tool registration
  aseprite/
    runner.ts            spawns `aseprite -b --script`; returns structured LuaRunResult
    lua.ts               pure helpers: luaString, buildWrappedScript, filterStderr, parseLuaOutput
    color.ts             parseColor (hex / named / hsl / hsv) + colorToLua
    named-colors.ts      CSS named-color table
    workspace.ts         resolve ASEPRITE_MCP_DIR / ~/aseprite-mcp/sprites, name -> path
  tools/
    color-schema.ts      shared zod colorSchema for all tools
    create-sprite.ts     create_sprite tool
```

Sprites live in `ASEPRITE_MCP_DIR` or `~/aseprite-mcp/sprites`, addressed by short `name`.

## Aseprite scripting notes (learned the hard way)

- Batch invocation: `aseprite -b --script <file>`. Lua errors print to stdout and exit `255`.
- `--script-param` must appear **before** `--script`. We avoid it and instead write `args.json`, embedded path read via `io.open` + `json.decode`.
- The runner wraps the body in a Lua function, `pcall`s it, and emits JSON on a sentinel line (`__ASEPRITE_MCP_RESULT__` / `__ASEPRITE_MCP_ERROR__`).
- Available in scripts: `json`, `io`, `dofile`.
- `Sprite(w, h, ColorMode.RGB)` starts transparent. `image:clear(Color{...})` fills.
- `image:getPixel(x, y)` returns a **packed int**, not a Color — decode with `app.pixelColor.rgbaR/G/B/A(p)`.
- Access cels via `sprite.cels[1]` (there is no `sprite:cel(...)`).
- `sprite:saveAs(path)` returns a boolean.
- User extensions (e.g. `pixellab`) print startup errors to stderr; `filterStderr` drops them.

## MCP client config

Registered in `~/.config/opencode/opencode.jsonc` under `mcp.aseprite`. New tools are auto-discovered on restart; adding a `permission` entry is only needed to pre-approve (otherwise the client prompts). Restart opencode after config changes.
