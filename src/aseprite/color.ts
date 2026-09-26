export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ColorInput = string | { r: number; g: number; b: number; a?: number };

function clampByte(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 255) {
    throw new Error(`Color channel ${label} must be an integer between 0 and 255.`);
  }
  return Math.round(value);
}

function parseHex(input: string): Rgba {
  const hex = input.trim().replace(/^#/, "");

  if (!/^[0-9a-fA-F]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) {
    throw new Error(
      `Invalid hex color "${input}". Use #rgb, #rgba, #rrggbb, or #rrggbbaa.`,
    );
  }

  const expand = (c: string) => parseInt(c + c, 16);
  const pair = (i: number) => parseInt(hex.slice(i, i + 2), 16);

  if (hex.length === 3 || hex.length === 4) {
    return {
      r: expand(hex[0]),
      g: expand(hex[1]),
      b: expand(hex[2]),
      a: hex.length === 4 ? expand(hex[3]) : 255,
    };
  }

  return {
    r: pair(0),
    g: pair(2),
    b: pair(4),
    a: hex.length === 8 ? pair(6) : 255,
  };
}

export function parseColor(input: ColorInput): Rgba {
  if (typeof input === "string") return parseHex(input);

  return {
    r: clampByte(input.r, "r"),
    g: clampByte(input.g, "g"),
    b: clampByte(input.b, "b"),
    a: input.a === undefined ? 255 : clampByte(input.a, "a"),
  };
}

export function colorToLua(color: Rgba): string {
  return `Color{r=${color.r}, g=${color.g}, b=${color.b}, a=${color.a}}`;
}
