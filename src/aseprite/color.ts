import { NAMED_COLORS } from "./named-colors.ts";

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface RgbInput {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface HslInput {
  h: number;
  s: number;
  l: number;
  a?: number;
}

export interface HsvInput {
  h: number;
  s: number;
  v: number;
  a?: number;
}

export type ColorInput = string | RgbInput | HslInput | HsvInput;

function clampByte(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 255) {
    throw new Error(`Color channel ${label} must be an integer between 0 and 255.`);
  }
  return Math.round(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeFraction(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Color channel ${label} must be a non-negative number.`);
  }
  return clamp01(value > 1 ? value / 100 : value);
}

function parseHex(input: string): Rgba {
  const hex = input.trim().replace(/^#/, "");

  if (!/^[0-9a-fA-F]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) {
    throw new Error(
      `Invalid color "${input}". Use a hex value (#rgb, #rgba, #rrggbb, #rrggbbaa), a CSS color name, or {r,g,b,a} / {h,s,l,a} / {h,s,v,a}.`,
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

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = (((h % 360) + 360) % 360) / 360;

  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  return {
    r: Math.round(channel(hue + 1 / 3) * 255),
    g: Math.round(channel(hue) * 255),
    b: Math.round(channel(hue - 1 / 3) * 255),
  };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;

  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

export function parseColor(input: ColorInput): Rgba {
  if (typeof input === "string") {
    const named = NAMED_COLORS[input.trim().toLowerCase()];
    return parseHex(named ?? input);
  }

  if ("h" in input) {
    const alpha = input.a === undefined ? 255 : clampByte(input.a, "a");
    const s = normalizeFraction(input.s, "s");

    if ("l" in input) {
      const { r, g, b } = hslToRgb(input.h, s, normalizeFraction(input.l, "l"));
      return { r, g, b, a: alpha };
    }

    const { r, g, b } = hsvToRgb(input.h, s, normalizeFraction(input.v, "v"));
    return { r, g, b, a: alpha };
  }

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
