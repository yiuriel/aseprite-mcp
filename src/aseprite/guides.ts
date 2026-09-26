export const GUIDE_LAYER_NAME = "symmetrical guides";
export const GUIDE_LAYER_PREFIX = "_";
export const GUIDE_COLOR = { r: 255, g: 0, b: 255, a: 120 };

export function isGuideLayerName(name: string): boolean {
  return name === GUIDE_LAYER_NAME || name.startsWith(GUIDE_LAYER_PREFIX);
}
