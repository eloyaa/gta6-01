// Cars: their kinds, their arcade driving physics, and the traffic that
// fills Solmar City's roads. A car is one object; who drives it decides
// whether the player, the traffic brain or the police brain steers it.
import { CAR, ROADS_V, ROADS_H, WORLD, PALETTE } from './config.js';
import { floatBetween, intBetween, pick } from './random.js';
import { clamp, distance, pushCircleOutOfRect, turnToward } from './util.js';
import { randomRoadPoint } from './city.js';
import { spawnExplosion, spawnSkid, spawnSmoke, spawnSparks } from './effects.js';

export const CAR_DEFS = {
  sedan: { w: 26, l: 48, color: '#c94f4f', accel: 1.0, top: 1.0 },
  taxi: { w: 26, l: 48, color: PALETTE.taxi, accel: 0.95, top: 0.95 },
  sport: { w: 26, l: 50, color: '#e8a33d', accel: 1.35, top: 1.25 },
  truck: { w: 30, l: 62, color: '#7a8a99', accel: 0.7, top: 0.8 },
  van: { w: 28, l: 54, color: '#8fb8a8', accel: 0.85, top: 0.9 },
  police: { w: 26, l: 50, color: PALETTE.policeBody, accel: 1.25, top: 1.18 },
};

const TRAFFIC_KINDS = ['sedan', 'sedan', 'taxi', 'sport', 'truck', 'van', 'sedan'];
const PAINTS = ['#c94f4f', '#4f7ec9', '#e8e8e8', '#2b2b2b', '#3fae8a', '#c96a4f', '#8a6fc9', '#d8d8d8'];

let nextCarId = 1;

/** A new car at a position, facing an angle, with a driver role. */
export function createCar(x, y, angle, kind, driver) {
  const def = CAR_DEFS[kind];
  const car = {
    id: nextCarId,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    kind,
    color: kind === 'taxi' ? PALETTE.taxi : kind === 'police' ? PALETTE.policeBody : pick(Math.random, PAINTS),
    w: def.w, l: def.l,
    accelMul: def.accel, topMul: def.top,
    health: CAR.maxHealth,
    driver, // 'player' | 'traffic' | 'police' | 'parked' | 'wreck'
    brakeLight: false,
    smoking: false,
    dead: false,
    hitTimer: 0,
    ramTimer: 0,
    waypoint: null,
    roadKind: 'v', roadIndex: 0, roadDir: 1,
    stuckTimer: 0,
  };
  nextCarId += 1;
  return car;
}

/** The two circles a car collides with (front and rear axle). */
export function carCircles(car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const r = car.w / 2 + 2;
  return [
    { x: car.x + fx * car.l * 0.26, y: car.y + fy * car.l * 0.26, radius: r },
    { x: car.x - fx * car.l * 0.26, y: car.y - fy * car.l * 0.26, radius: r },
  ];
}

/**
 * Fill the city with moving traffic and parked cars. Traffic cars get a
 * waypoint to drive toward; parked cars sit by the kerb, empty and stealable.
 */
export function spawnCityTraffic(world, rng, moving = 16, parked = 14) {
  for (let i = 0; i < moving; i += 1) {
    const spot = randomRoadPoint(rng);
    const kind = pick(rng, TRAFFIC_KINDS);
    const car = createCar(spot.x, spot.y, spot.angle, kind, 'traffic');
    car.roadKind = spot.angle === 0 || spot.angle === Math.PI ? 'h' : 'v';
    car.roadDir = spot.dir;
    car.waypoint = nextWaypoint(car, rng);
    car.speed = CAR.trafficSpeed * floatBetween(rng, 0.8, 1.15);
    world.cars.push(car);
  }
  for (let i = 0; i < parked; i += 1) {
    const spot = randomRoadPoint(rng);
    const kind = pick(rng, TRAFFIC_KINDS);
    // Parked cars hug the kerb: shift them to the road's edge.
    const car = createCar(spot.x, spot.y, spot.angle, kind, 'parked');
    const perp = spot.angle + Math.PI / 2;
    car.x += Math.cos(perp) * 26;
    car.y += Math.sin(perp) * 26;
    world.cars.push(car);
  }
}

/** The next intersection a traffic car should aim for along its road. */
export function nextWaypoint(car, rng) {
  const roads = car.roadKind === 'v' ? ROADS_H : ROADS_V;
  const here = car.roadKind === 'v' ? car.y : car.x;
  // Intersections ahead of the car on its own road.
  const ahead = [];
  for (const r of roads) {
    const d = (r - here) * car.roadDir;
    if (d > 40) ahead.push(r);
  }
  if (ahead.length === 0) {
    // End of the road: turn around.
    car.roadDir *= -1;
    return nextWaypoint(car, rng);
  }
  const target = ahead[0];
  // At an intersection the car may turn onto the crossing road instead.
  if (rng && rng() < 0.35 && ahead.length > 0) {
    return { turnAt: target, kind: car.roadKind === 'v' ? 'h' : 'v', index: car.roadKind === 'v' ? ROADS_H.indexOf(target) : ROADS_V.indexOf(target) };
  }
  return { turnAt: null, x: car.roadKind === 'v' ? car.x : target, y: car.roadKind === 'v' ? target : car.y };
}

/** The closest car to a point, within maxDist (0 = any distance). */
export function nearestCar(world, x, y, maxDist = 0) {
  let best = null;
  let bestD = maxDist || Infinity;
  for (const car of world.cars) {
    if (car.dead) continue;
    const d = distance(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Damage a car; at zero health it explodes and becomes a wreck. */
export function damageCar(world, car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 40 && !car.smoking) {
    car.smoking = true;
    spawnSmoke(world, car.x, car.y, 4);
  }
  if (car.health <= 0) {
    car.dead = true;
    car.driver = 'wreck';
    spawnExplosion(world, car.x, car.y);
    world.shake = Math.max(world.shake, 10);
    world.audio.crash(1);
  }
}

/** One traffic car, one step: steer toward its waypoint, brake for the car ahead. */
export function updateTrafficCar(world, car, dt, rng) {
  if (car.dead) return;
  const wp = car.waypoint;
  let targetAngle = car.angle;
  if (wp) {
    const tx = wp.x !== undefined ? wp.x : car.x;
    const ty = wp.y !== undefined ? wp.y : car.y;
    if (wp.turnAt !== null && wp.turnAt !== undefined) {
      // Drive to the intersection, then turn onto the crossing road.
      const along = car.roadKind === 'v' ? car.y : car.x;
      if (Math.abs(along - wp.turnAt) < 26) {
        car.roadKind = wp.kind;
        car.roadIndex = wp.index;
        car.roadDir = rng() < 0.5 ? 1 : -1;
        car.waypoint = nextWaypoint(car, rng);
      } else {
        targetAngle = car.roadKind === 'v' ? (car.roadDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.roadDir > 0 ? 0 : Math.PI);
      }
    } else {
      const d = distance(car.x, car.y, tx, ty);
      if (d < 30) {
        car.waypoint = nextWaypoint(car, rng);
      } else {
        targetAngle = Math.atan2(ty - car.y, tx - car.x);
      }
    }
  }
  // Brake for a car directly ahead.
  let blocked = false;
  for (const other of world.cars) {
    if (other === car || other.dead) continue;
    const d = distance(car.x, car.y, other.x, other.y);
    if (d < 64) {
      const ang = Math.atan2(other.y - car.y, other.x - car.x);
      if (Math.abs(ang - car.angle) < 0.7 || Math.abs(ang - car.angle) > Math.PI * 2 - 0.7) blocked = true;
    }
  }
  const targetSpeed = blocked ? 0 : CAR.trafficSpeed;
  car.speed += clamp(targetSpeed - car.speed, -CAR.brake * dt, CAR.accel * dt * 0.5);
  car.angle = turnToward(car.angle, targetAngle, 2.2 * dt);
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // Stay out of buildings: one circle at the car's centre is enough for the
  // arcade feel, and a hard push bleeds speed off.
  const body = { x: car.x, y: car.y, radius: car.l * 0.42 };
  for (const b of world.city.buildings) {
    if (pushCircleOutOfRect(body, b)) {
      car.speed *= 0.5;
      car.x = body.x;
      car.y = body.y;
    }
  }
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);
}

/**
 * The player's car, one step: arcade physics — accelerate, steer, drift with
 * the handbrake — plus building and car collisions.
 */
export function updatePlayerCar(world, car, input, dt) {
  const up = input.up;
  const down = input.down;
  const left = input.left;
  const right = input.right;
  const handbrake = input.handbrake;

  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  let forwardSpeed = car.vx * forwardX + car.vy * forwardY;
  let lateralX = car.vx - forwardX * forwardSpeed;
  let lateralY = car.vy - forwardY * forwardSpeed;

  if (up) forwardSpeed += CAR.accel * car.accelMul * dt;
  if (down) forwardSpeed -= (forwardSpeed > 0 ? CAR.brake : CAR.reverseAccel * car.accelMul) * dt;
  if (!up && !down) forwardSpeed -= forwardSpeed * 0.6 * dt;
  const maxF = CAR.maxSpeed * car.topMul;
  const maxR = CAR.maxReverse;
  forwardSpeed = clamp(forwardSpeed, -maxR, maxF);

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const steerFactor = clamp(Math.abs(forwardSpeed) / 140, 0, 1) * (forwardSpeed < 0 ? -1 : 1);
  car.angle += steer * CAR.turnRate * steerFactor * dt;

  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  const latDecay = Math.exp(-grip * dt);
  lateralX *= latDecay;
  lateralY *= latDecay;
  if (handbrake && Math.abs(forwardSpeed) > 120 && Math.random() < 0.4) {
    spawnSkid(world, car.x - forwardX * car.l * 0.3, car.y - forwardY * car.l * 0.3, car.angle);
  }

  const newForwardX = Math.cos(car.angle);
  const newForwardY = Math.sin(car.angle);
  car.vx = newForwardX * forwardSpeed + lateralX;
  car.vy = newForwardY * forwardSpeed + lateralY;
  car.speed = forwardSpeed;
  const oldX = car.x;
  const oldY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Buildings: one circle at the car's centre, pushed out of every building
  // it overlaps; a hard impact damages the car and shakes the camera.
  const body = { x: car.x, y: car.y, radius: car.l * 0.42 };
  let hitBuilding = false;
  for (const b of world.city.buildings) {
    if (pushCircleOutOfRect(body, b)) hitBuilding = true;
  }
  if (hitBuilding) {
    const impact = Math.hypot(car.vx, car.vy);
    car.x = body.x;
    car.y = body.y;
    if (impact > 160) {
      damageCar(world, car, (impact - 160) * 0.06);
      spawnSparks(world, car.x, car.y, 6);
      world.audio.crash(impact / 430);
      world.shake = Math.max(world.shake, impact / 60);
    }
    car.vx *= 0.3;
    car.vy *= 0.3;
    car.speed *= 0.3;
  }
  void oldX;
  void oldY;

  // Other cars: a soft push and a little damage on a hard hit (with a
  // cooldown, so one crash is one crash, not sixty a second).
  car.hitTimer -= dt;
  for (const other of world.cars) {
    if (other === car || other.dead) continue;
    const d = distance(car.x, car.y, other.x, other.y);
    const minD = (car.l + other.l) / 2 - 8;
    if (d < minD && d > 0.01) {
      const push = (minD - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 140 && car.hitTimer <= 0) {
        damageCar(world, car, rel * 0.05);
        damageCar(world, other, rel * 0.05);
        spawnSparks(world, (car.x + other.x) / 2, (car.y + other.y) / 2, 8);
        world.audio.crash(rel / 430);
        car.hitTimer = 0.5;
        other.hitTimer = 0.5;
      }
      if (other.driver === 'traffic') {
        other.speed *= 0.6;
      }
    }
  }

  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);
  car.brakeLight = down || handbrake;
  if (car.smoking && Math.random() < 0.3) spawnSmoke(world, car.x, car.y, 1);
}
