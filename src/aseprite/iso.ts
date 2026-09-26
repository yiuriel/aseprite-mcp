export interface Point {
  x: number;
  y: number;
}

export const DEFAULT_TILE_WIDTH = 32;

export function isoDiamondPoints(x: number, y: number, tileWidth = DEFAULT_TILE_WIDTH): Point[] {
  const half = tileWidth / 2;
  const centerX = x + half - 0.5;
  const midY = y + half / 2;
  return [
    { x: centerX, y },
    { x: x + tileWidth - 1, y: midY },
    { x: centerX, y: y + half },
    { x, y: midY },
  ];
}

export interface IsoCubeFaces {
  top: Point[];
  left: Point[];
  right: Point[];
}

export function isoCubeFaces(
  x: number,
  y: number,
  tileWidth = DEFAULT_TILE_WIDTH,
  bodyHeight?: number,
): IsoCubeFaces {
  const half = tileWidth / 2;
  const body = bodyHeight ?? half;
  const centerX = x + half - 0.5;
  const midY = y + half / 2;
  const leftX = x;
  const rightX = x + tileWidth - 1;
  const floorY = y + half;
  const baseY = midY + body;

  return {
    top: isoDiamondPoints(x, y, tileWidth),
    left: [
      { x: leftX, y: midY },
      { x: centerX, y: floorY },
      { x: centerX, y: floorY + body },
      { x: leftX, y: baseY },
    ],
    right: [
      { x: centerX, y: floorY },
      { x: rightX, y: midY },
      { x: rightX, y: baseY },
      { x: centerX, y: floorY + body },
    ],
  };
}

export function isoGuideDots(
  width: number,
  height: number,
  tileWidth = DEFAULT_TILE_WIDTH,
): Point[] {
  const half = tileWidth / 2;
  const quarter = half / 2;
  const centerLow = half - 1;
  const centerHigh = half;
  const sideMidLow = quarter - 1;
  const sideMidHigh = quarter;
  const bottomCornerLow = half + quarter - 1;
  const bottomCornerHigh = half + quarter;
  const bottom = tileWidth - 1;
  const right = tileWidth - 1;

  const cellsX = Math.floor((width - 1) / tileWidth);
  const cellsY = Math.floor((height - 1) / tileWidth);

  const offsets: Point[] = [
    { x: centerLow, y: 0 },
    { x: centerHigh, y: 0 },
    { x: 0, y: sideMidLow },
    { x: 0, y: sideMidHigh },
    { x: right, y: sideMidLow },
    { x: right, y: sideMidHigh },
    { x: centerLow, y: half },
    { x: centerHigh, y: half },
    { x: 0, y: bottomCornerLow },
    { x: 0, y: bottomCornerHigh },
    { x: right, y: bottomCornerLow },
    { x: right, y: bottomCornerHigh },
    { x: centerLow, y: bottom },
    { x: centerHigh, y: bottom },
  ];

  const dots: Point[] = [];
  for (let row = 0; row <= cellsY; row++) {
    for (let col = 0; col <= cellsX; col++) {
      const originX = col * tileWidth;
      const originY = row * tileWidth;
      for (const offset of offsets) {
        dots.push({ x: originX + offset.x, y: originY + offset.y });
      }
    }
  }
  return dots;
}
