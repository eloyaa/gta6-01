// Solmar City itself: the road grid, the blocks between the roads, the
// buildings, the park, the plaza, the beachfront and the palms. Everything is
// placed from a seeded random function, so the city never changes between runs.
import { WORLD, ROADS_V, ROADS_H, BEACH_Y, WATER_Y, PARK_BLOCK, PLAZA_BLOCK, PALETTE } from './config.js';
import { floatBetween, intBetween, pick } from './random.js';
import { clamp } from './util.js';

const HALF_ROAD = WORLD.roadWidth / 2;

/** True when the point lies on any road (asphalt, not sidewalk). */
export function isOnRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= HALF_ROAD) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= HALF_ROAD) return true;
  return false;
}

/** True when the point lies on a sidewalk strip beside a road. */
export function isOnSidewalk(x, y) {
  const s = HALF_ROAD + WORLD.sidewalk;
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= s && Math.abs(x - rx) > HALF_ROAD) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= s && Math.abs(y - ry) > HALF_ROAD) return true;
  return false;
}

/**
 * The road a point is closest to: { kind: 'v' | 'h', index, along } where
 * `along` is the coordinate along that road.
 */
export function nearestRoad(x, y) {
  let best = { kind: 'v', index: 0, distance: Infinity };
  for (let i = 0; i < ROADS_V.length; i += 1) {
    const d = Math.abs(x - ROADS_V[i]);
    if (d < best.distance) best = { kind: 'v', index: i, distance: d };
  }
  for (let j = 0; j < ROADS_H.length; j += 1) {
    const d = Math.abs(y - ROADS_H[j]);
    if (d < best.distance) best = { kind: 'h', index: j, distance: d };
  }
  return best;
}

/** A random point on a random road, with the heading along that road. */
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const i = intBetween(rng, 0, ROADS_V.length - 1);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = dir > 0 ? -18 : 18;
    return { x: ROADS_V[i] + lane, y: floatBetween(rng, 60, WORLD.height - 60), angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2, dir };
  }
  const j = intBetween(rng, 0, ROADS_H.length - 1);
  const dir = rng() < 0.5 ? 1 : -1;
  const lane = dir > 0 ? 18 : -18;
  return { x: floatBetween(rng, 60, WORLD.width - 60), y: ROADS_H[j] + lane, angle: dir > 0 ? 0 : Math.PI, dir };
}

/** A random point on a sidewalk, for a pedestrian to walk from. */
export function randomSidewalkPoint(rng) {
  if (rng() < 0.5) {
    const i = intBetween(rng, 0, ROADS_V.length - 1);
    const side = rng() < 0.5 ? -1 : 1;
    return { x: ROADS_V[i] + side * (HALF_ROAD + 8), y: floatBetween(rng, 60, WORLD.height - 60) };
  }
  const j = intBetween(rng, 0, ROADS_H.length - 1);
  const side = rng() < 0.5 ? -1 : 1;
  return { x: floatBetween(rng, 60, WORLD.width - 60), y: ROADS_H[j] + side * (HALF_ROAD + 8) };
}

/** The rectangle of the block between vertical roads i,i+1 and horizontal roads j,j+1. */
export function blockRect(i, j) {
  const margin = HALF_ROAD + WORLD.sidewalk + 6;
  return {
    x: ROADS_V[i] + margin,
    y: ROADS_H[j] + margin,
    w: ROADS_V[i + 1] - ROADS_V[i] - margin * 2,
    h: ROADS_H[j + 1] - ROADS_H[j] - margin * 2,
  };
}

/**
 * Build the whole city from a seed. Returns buildings, palms, lamps, trees,
 * the park and plaza rectangles, and the beachfront promenade.
 */
export function createCity(rng) {
  const buildings = [];
  const palms = [];
  const lamps = [];
  const trees = [];
  let park = null;
  let plaza = null;

  for (let i = 0; i < ROADS_V.length - 1; i += 1) {
    for (let j = 0; j < ROADS_H.length - 1; j += 1) {
      const rect = blockRect(i, j);
      if (i === PARK_BLOCK.vx && j === PARK_BLOCK.vy) {
        park = rect;
        for (let t = 0; t < 26; t += 1) {
          trees.push({ x: floatBetween(rng, rect.x + 16, rect.x + rect.w - 16), y: floatBetween(rng, rect.y + 16, rect.y + rect.h - 16), r: floatBetween(rng, 9, 15) });
        }
        continue;
      }
      if (i === PLAZA_BLOCK.vx && j === PLAZA_BLOCK.vy) {
        plaza = rect;
        continue;
      }
      // Two buildings side by side in a wide block, one in a narrow one.
      const split = rect.w > 210 && rng() < 0.75;
      const parts = split ? 2 : 1;
      for (let p = 0; p < parts; p += 1) {
        const w = parts === 2 ? rect.w / 2 - 10 : rect.w - 8;
        const h = rect.h - 8 - (rng() < 0.4 ? 30 : 0);
        const b = {
          x: rect.x + 4 + (parts === 2 ? p * (rect.w / 2 + 2) : 0),
          y: rect.y + 4,
          w,
          h,
          color: pick(rng, PALETTE.building),
          floors: intBetween(rng, 1, 4),
          tall: rng() < 0.18,
        };
        if (b.tall) b.floors = intBetween(rng, 5, 8);
        buildings.push(b);
      }
    }
  }

  // Beachfront promenade: palms and lamps along the last road, and a row of
  // palms on the sand.
  for (let x = 120; x < WORLD.width; x += 130) {
    palms.push({ x: x + floatBetween(rng, -20, 20), y: BEACH_Y + 46 });
    if (rng() < 0.6) palms.push({ x: x + 60, y: ROADS_H[ROADS_H.length - 1] - HALF_ROAD - 26 });
  }
  for (let x = 200; x < WORLD.width; x += 360) {
    lamps.push({ x, y: ROADS_H[ROADS_H.length - 1] - HALF_ROAD - 10 });
  }
  // A few palms on random sidewalks around the city.
  for (let p = 0; p < 34; p += 1) {
    const spot = randomSidewalkPoint(rng);
    if (spot.y > BEACH_Y) continue;
    palms.push({ x: spot.x, y: spot.y });
  }

  return { buildings, palms, lamps, trees, park, plaza };
}

/** Clamp a point inside the world bounds, with a margin. */
export function clampToWorld(x, y, margin = 20) {
  return {
    x: clamp(x, margin, WORLD.width - margin),
    y: clamp(y, margin, WORLD.height - margin),
  };
}
