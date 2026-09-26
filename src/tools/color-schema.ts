import { z } from "zod";

const rgbObject = z.object({
  r: z.number().describe("Red, 0-255."),
  g: z.number().describe("Green, 0-255."),
  b: z.number().describe("Blue, 0-255."),
  a: z.number().optional().describe("Alpha, 0-255. Defaults to 255."),
});

const hslObject = z.object({
  h: z.number().describe("Hue in degrees, 0-360 (wraps)."),
  s: z.number().describe("Saturation, 0-1 (values above 1 are read as percent)."),
  l: z.number().describe("Lightness, 0-1 (values above 1 are read as percent)."),
  a: z.number().optional().describe("Alpha, 0-255. Defaults to 255."),
});

const hsvObject = z.object({
  h: z.number().describe("Hue in degrees, 0-360 (wraps)."),
  s: z.number().describe("Saturation, 0-1 (values above 1 are read as percent)."),
  v: z.number().describe("Value, 0-1 (values above 1 are read as percent)."),
  a: z.number().optional().describe("Alpha, 0-255. Defaults to 255."),
});

export const colorSchema = z.union([z.string(), rgbObject, hslObject, hsvObject]);

export const COLOR_DESCRIPTION =
  "Color as #rgb/#rgba/#rrggbb/#rrggbbaa, a CSS color name, {r,g,b,a} (0-255), {h,s,l,a}, or {h,s,v,a} (h in degrees, s/l/v in 0-1).";
