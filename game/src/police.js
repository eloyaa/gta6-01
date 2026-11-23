// The Solmar PD: foot cops who chase Leo down and try to arrest him, and
// patrol cars that chase his car and ram it. Their numbers follow the stars.
import { WORLD } from './config.js';
import { floatBetween } from './random.js';
import { angleTo, clamp, distance, pushCircleOutOfRect, turnToward } from './util.js';
import { createCar, damageCar } from './vehicles.js';
import { policeQuota } from './wanted.js';
import { randomRoadPoint } from './city.js';
import { spawnSparks } from './effects.js';

let nextCopId = 1;

/** A foot cop, spawned near the player. */
export function createFootCop(x, y) {
  return {
    id: nextCopId,
    kind: 'foot',
    x, y,
    angle: 0,
    speed: 205,
    arrestTimer: 0,
    punchTimer: 0,
    unstickTimer: 0,
  };
}

/** Count the live police cars in the world. */
export function countPoliceCars(world) {
  let n = 0;
  for (const car of world.cars) if (car.driver === 'police' && !car.dead) n += 1;
  return n;
}

/**
 * Keep the police at the quota for the current stars: spawn what is missing
 * near the player, on a road for cars and on a sidewalk for foot cops.
 */
export function reinforcePolice(world, rng) {
  const quota = policeQuota(world.wanted.stars);
  const player = world.player;
  let cars = countPoliceCars(world);
  while (cars < quota.cars) {
    const spot = randomRoadPoint(rng);
    // Spawn a few hundred pixels from the player, not on top of him.
    const d = distance(spot.x, spot.y, player.x, player.y);
    if (d < 320 || d > 900) {
      if (rng() < 0.7) continue;
    }
    const car = createCar(spot.x, spot.y, spot.angle, 'police', 'police');
    world.cars.push(car);
    cars += 1;
  }
  while (world.police.length < quota.foot) {
    const a = rng() * Math.PI * 2;
    const r = 380 + rng() * 260;
    const cop = createFootCop(
      clamp(player.x + Math.cos(a) * r, 40, WORLD.width - 40),
      clamp(player.y + Math.sin(a) * r, 40, WORLD.height - 40),
    );
    world.police.push(cop);
  }
}

/** Drop police that are far away once the heat is gone. */
export function thinPolice(world) {
  if (world.wanted.stars > 0) return;
  for (let i = world.police.length - 1; i >= 0; i -= 1) {
    const cop = world.police[i];
    if (distance(cop.x, cop.y, world.player.x, world.player.y) > 700) world.police.splice(i, 1);
  }
  for (const car of world.cars) {
    if (car.driver === 'police' && !car.dead && distance(car.x, car.y, world.player.x, world.player.y) > 900) {
      car.dead = true;
      car.driver = 'wreck';
    }
  }
}

/** One foot cop, one step: run Leo down and hold him to arrest him. */
export function updateFootCop(world, cop, dt) {
  const player = world.player;
  const d = distance(cop.x, cop.y, player.x, player.y);
  const targetAngle = angleTo(cop.x, cop.y, player.x, player.y);
  cop.angle = turnToward(cop.angle, targetAngle, 6 * dt);
  const speed = cop.speed * (d < 60 ? 0.4 : 1);
  cop.x += Math.cos(cop.angle) * speed * dt;
  cop.y += Math.sin(cop.angle) * speed * dt;
  const body = { x: cop.x, y: cop.y, radius: 11 };
  for (const b of world.city.buildings) {
    if (pushCircleOutOfRect(body, b)) {
      cop.x = body.x;
      cop.y = body.y;
    }
  }
  cop.x = clamp(cop.x, 24, WORLD.width - 24);
  cop.y = clamp(cop.y, 24, WORLD.height - 24);

  // Arrest: a cop standing on Leo for a second busts him. A cop close by
  // punches him instead.
  if (player.onFoot && d < 30) {
    cop.arrestTimer += dt;
    cop.punchTimer -= dt;
    if (cop.punchTimer <= 0) {
      cop.punchTimer = 0.9;
      player.health -= 6;
      world.audio.punch();
      world.shake = Math.max(world.shake, 3);
      if (player.health <= 0) world.wasted = true;
    }
    if (cop.arrestTimer > 1.2) world.busted = true;
  } else {
    cop.arrestTimer = Math.max(0, cop.arrestTimer - dt * 2);
  }
}

/** One police car, one step: chase Leo's car and ram it. */
export function updatePoliceCar(world, car, dt) {
  const player = world.player;
  const targetX = player.car ? player.car.x : player.x;
  const targetY = player.car ? player.car.y : player.y;
  const d = distance(car.x, car.y, targetX, targetY);
  const wantAngle = angleTo(car.x, car.y, targetX, targetY);
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  let forwardSpeed = car.vx * forwardX + car.vy * forwardY;

  // If the car is stuck against a wall, back off and try a new angle.
  if (car.unstickTimer > 0) {
    car.unstickTimer -= dt;
    forwardSpeed -= 200 * dt;
  } else {
    car.angle = turnToward(car.angle, wantAngle, 3.2 * dt);
    forwardSpeed += (d > 120 ? 460 : 240) * dt;
    forwardSpeed = clamp(forwardSpeed, -80, 470);
  }
  let lateralX = car.vx - forwardX * forwardSpeed;
  let lateralY = car.vy - forwardY * forwardSpeed;
  const decay = Math.exp(-5.5 * dt);
  lateralX *= decay;
  lateralY *= decay;
  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * forwardSpeed + lateralX;
  car.vy = nfy * forwardSpeed + lateralY;
  car.speed = forwardSpeed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  const body = { x: car.x, y: car.y, radius: car.l * 0.42 };
  let hit = false;
  for (const b of world.city.buildings) {
    if (pushCircleOutOfRect(body, b)) hit = true;
  }
  if (hit) {
    car.x = body.x;
    car.y = body.y;
    if (Math.abs(forwardSpeed) > 120) {
      damageCar(world, car, 4);
      spawnSparks(world, car.x, car.y, 4);
    }
    car.vx *= 0.3;
    car.vy *= 0.3;
    if (car.unstickTimer <= 0 && Math.abs(car.speed) < 40) car.unstickTimer = 0.7;
  }
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);

  // Ram the player's car on contact — once per beat, not once per frame.
  car.ramTimer -= dt;
  if (player.car && d < (car.l + player.car.l) / 2 - 6 && car.ramTimer <= 0) {
    const rel = Math.abs(car.speed - player.car.speed);
    if (rel > 60) {
      damageCar(world, player.car, rel * 0.04);
      damageCar(world, car, rel * 0.02);
      spawnSparks(world, (car.x + player.car.x) / 2, (car.y + player.car.y) / 2, 6);
      world.audio.crash(rel / 430);
      world.shake = Math.max(world.shake, 5);
      // Shove the player's car sideways.
      player.car.vx += (player.car.x - car.x) * 1.2;
      player.car.vy += (player.car.y - car.y) * 1.2;
      car.ramTimer = 0.9;
    }
  }
}

/** Every police unit, one step. */
export function updatePolice(world, dt, rng) {
  reinforcePolice(world, rng);
  for (const cop of world.police) updateFootCop(world, cop, dt);
  for (const car of world.cars) {
    if (car.driver === 'police' && !car.dead) updatePoliceCar(world, car, dt);
  }
  thinPolice(world);
  void floatBetween;
}
