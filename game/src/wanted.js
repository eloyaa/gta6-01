// The wanted system: heat, stars, and whether the police can see Leo.
// Heat rises with every crime the police witness and falls when Leo hides.
import { WANTED, POLICE_BY_STARS } from './config.js';
import { clamp, distance } from './util.js';

/** Stars from heat: 0-100 heat maps to 0-5 stars. */
export function starsFromHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.ceil(heat / 20));
}

/** Add heat for a crime; returns the new star count. */
export function addHeat(world, amount) {
  world.wanted.heat = clamp(world.wanted.heat + amount, 0, 100);
  const stars = starsFromHeat(world.wanted.heat);
  if (stars > world.wanted.stars) {
    world.wanted.stars = stars;
    world.banner = { text: `WANTED LEVEL ${stars} ${'★'.repeat(stars)}`, sub: 'The Solmar PD is on your tail', timer: 2.4, color: '#ff5252' };
  }
  return world.wanted.stars;
}

/** How many patrol cars and foot cops the current stars call for. */
export function policeQuota(stars) {
  return POLICE_BY_STARS[Math.min(5, Math.max(0, stars))];
}

/**
 * True when any police unit has a line of sight to the player: close enough
 * and not hidden behind a building. Buildings block sight.
 */
export function policeCanSeePlayer(world) {
  const p = world.player;
  for (const cop of world.police) {
    const d = distance(cop.x, cop.y, p.x, p.y);
    if (d > WANTED.sightRange) continue;
    if (!sightBlocked(world, cop.x, cop.y, p.x, p.y)) return true;
  }
  for (const car of world.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    const d = distance(car.x, car.y, p.x, p.y);
    if (d > WANTED.sightRange) continue;
    if (!sightBlocked(world, car.x, car.y, p.x, p.y)) return true;
  }
  return false;
}

/** True when a building stands between the two points. */
export function sightBlocked(world, x1, y1, x2, y2) {
  for (const b of world.city.buildings) {
    if (lineHitsRect(x1, y1, x2, y2, b)) return true;
  }
  return false;
}

/** Segment vs axis-aligned rectangle intersection. */
export function lineHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** Heat decay, one step: faster when no police can see the player. */
export function decayWanted(world, dt) {
  if (world.wanted.heat <= 0) return;
  const seen = policeCanSeePlayer(world);
  const rate = WANTED.decayPerSecond + (seen ? 0 : WANTED.decayHiddenBonus);
  world.wanted.heat = Math.max(0, world.wanted.heat - rate * dt);
  world.wanted.stars = starsFromHeat(world.wanted.heat);
}
