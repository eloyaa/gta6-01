// Pedestrians: the people of Solmar City. Walkers stroll the sidewalks, fares
// wave for a taxi, and a scared pedestrian runs from gunfire and speeding cars.
import { PLAYER, WORLD } from './config.js';
import { floatBetween, pick } from './random.js';
import { clamp, distance, pushCircleOutOfRect } from './util.js';
import { randomSidewalkPoint } from './city.js';
import { spawnSparks } from './effects.js';

const SHIRTS = ['#e85d75', '#4f7ec9', '#3fae8a', '#e8a33d', '#8a6fc9', '#e8e8e8', '#5a6a7a', '#c9c94f'];
const PANTS = ['#2b3a55', '#3a3a3a', '#5a4a6a', '#2f4f2f'];

let nextPedId = 1;

/** A new pedestrian at a point. kind: 'walker' | 'fare'. */
export function createPed(x, y, kind = 'walker') {
  return {
    id: nextPedId,
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    kind,
    shirt: pick(Math.random, SHIRTS),
    pants: pick(Math.random, PANTS),
    walkSpeed: floatBetween(Math.random, 34, 62),
    target: null,
    waitTimer: 0,
    fleeTimer: 0,
    downTimer: 0,
    farePaid: false,
    wavePhase: Math.random() * Math.PI * 2,
  };
}

/** Fill the sidewalks with walkers. */
export function spawnPedestrians(world, rng, count = 42) {
  for (let i = 0; i < count; i += 1) {
    const spot = randomSidewalkPoint(rng);
    if (spot.y > 2260) continue; // keep the beach clear for the promenade
    const ped = createPed(spot.x, spot.y, 'walker');
    ped.target = randomSidewalkPoint(rng);
    world.peds.push(ped);
  }
}

/** A pedestrian is scared: run away from (x, y) for a few seconds. */
export function scarePed(ped, x, y) {
  ped.fleeTimer = 2.5 + Math.random() * 1.5;
  ped.fleeFrom = { x, y };
}

/** A pedestrian hit by a car: knocked down, then gets up and runs. */
export function knockPedDown(world, ped, dirX, dirY) {
  if (ped.downTimer > 0) return;
  ped.downTimer = 1.4;
  ped.x += dirX * 14;
  ped.y += dirY * 14;
  ped.fleeTimer = 4;
  ped.fleeFrom = { x: ped.x - dirX * 100, y: ped.y - dirY * 100 };
  spawnSparks(world, ped.x, ped.y, 4);
}

/** One pedestrian, one step. */
export function updatePed(world, ped, dt) {
  if (ped.downTimer > 0) {
    ped.downTimer -= dt;
    return;
  }
  if (ped.kind === 'fare') {
    // A fare stands on the kerb and waves until the player picks them up.
    ped.wavePhase += dt * 4;
    return;
  }
  let speed = ped.walkSpeed;
  let targetAngle = ped.angle;
  if (ped.fleeTimer > 0) {
    ped.fleeTimer -= dt;
    speed = 150;
    targetAngle = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
  } else if (ped.target) {
    const d = distance(ped.x, ped.y, ped.target.x, ped.target.y);
    if (d < 18) {
      if (ped.waitTimer > 0) {
        ped.waitTimer -= dt;
        speed = 0;
      } else {
        ped.target = randomSidewalkPoint(world.rng);
        ped.waitTimer = Math.random() * 3;
      }
    } else {
      targetAngle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    }
  }
  ped.angle += (targetAngle - ped.angle) * Math.min(1, 8 * dt);
  ped.speed = speed;
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  const body = { x: ped.x, y: ped.y, radius: 10 };
  for (const b of world.city.buildings) {
    if (pushCircleOutOfRect(body, b)) {
      ped.x = body.x;
      ped.y = body.y;
      ped.target = randomSidewalkPoint(world.rng);
    }
  }
  ped.x = clamp(ped.x, 24, WORLD.width - 24);
  ped.y = clamp(ped.y, 24, WORLD.height - 24);
}

/** Every pedestrian, one step. */
export function updatePeds(world, dt) {
  for (const ped of world.peds) updatePed(world, ped, dt);
}

/** The nearest fare pedestrian to a point, within maxDist. */
export function nearestFare(world, x, y, maxDist = 60) {
  let best = null;
  let bestD = maxDist;
  for (const ped of world.peds) {
    if (ped.kind !== 'fare') continue;
    const d = distance(x, y, ped.x, ped.y);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}

export function pedCount(world) {
  return world.peds.length;
}
void PLAYER;
