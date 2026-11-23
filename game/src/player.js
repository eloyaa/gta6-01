// Leo Cruz, the player: on foot he walks, runs, punches and shoots; in a car
// he drives it. Entering and leaving cars, and every crime that follows, live here.
import { PLAYER, WANTED, KEYS, CAR } from './config.js';
import { clamp, distance, angleDifference, pushCircleOutOfRect } from './util.js';
import { nearestCar, updatePlayerCar, damageCar } from './vehicles.js';
import { knockPedDown, scarePed } from './people.js';
import { addHeat } from './wanted.js';
import { keyHeld, keyPressed } from './input.js';
import { addParticle, spawnSparks } from './effects.js';

/** A fresh player at a point, optionally seeded from a save. */
export function createPlayer(x, y, save) {
  return {
    x, y,
    angle: -Math.PI / 2,
    aimAngle: 0,
    speed: 0,
    onFoot: true,
    car: null,
    health: save ? save.health : PLAYER.maxHealth,
    ammo: save ? save.ammo : PLAYER.startAmmo,
    money: save ? save.money : 0,
    punchTimer: 0,
    shootTimer: 0,
    lastDamageAt: -99,
    entering: false,
  };
}

/** The player, one step: on foot or behind the wheel. */
export function updatePlayer(world, input, dt) {
  const player = world.player;
  player.punchTimer -= dt;
  player.shootTimer -= dt;
  if (player.onFoot) updateOnFoot(world, input, dt);
  else updateDriving(world, input, dt);
  // Slow health recovery after a quiet stretch.
  if (world.time - player.lastDamageAt > 6 && player.health > 0 && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + 1.5 * dt);
  }
  if (player.health <= 0 && !world.wasted) {
    world.wasted = true;
    world.audio.busted();
  }
}

/** On foot: WASD to move, Shift to run, Space to punch, click to shoot, E to drive. */
function updateOnFoot(world, input, dt) {
  const player = world.player;
  let mx = 0;
  let my = 0;
  if (keyHeld(input, KEYS.up)) my -= 1;
  if (keyHeld(input, KEYS.down)) my += 1;
  if (keyHeld(input, KEYS.left)) mx -= 1;
  if (keyHeld(input, KEYS.right)) mx += 1;
  const moving = mx !== 0 || my !== 0;
  const running = keyHeld(input, KEYS.run);
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, my);
    player.angle = Math.atan2(my / len, mx / len);
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  // Buildings keep Leo on the street.
  const body = { x: player.x, y: player.y, radius: PLAYER.radius };
  for (const b of world.city.buildings) {
    if (pushCircleOutOfRect(body, b)) {
      player.x = body.x;
      player.y = body.y;
    }
  }
  player.x = clamp(player.x, 20, world.cityWidth - 20);
  player.y = clamp(player.y, 20, world.cityHeight - 20);

  // Aim follows the mouse (in world coordinates, set by main.js).
  player.aimAngle = Math.atan2(world.mouseWorldY - player.y, world.mouseWorldX - player.x);

  if (keyPressed(input, KEYS.punch) && player.punchTimer <= 0) {
    punch(world);
  }
  if ((input.mousePressed || input.mouseDown) && player.shootTimer <= 0 && player.ammo > 0) {
    shoot(world);
  }
  if (keyPressed(input, KEYS.enterCar)) {
    enterNearestCar(world);
  }
}

/** A punch in the direction Leo faces: cops and pedestrians feel it. */
function punch(world) {
  const player = world.player;
  player.punchTimer = 0.35;
  world.audio.punch();
  const reach = PLAYER.punchRange;
  const px = player.x + Math.cos(player.angle) * reach * 0.6;
  const py = player.y + Math.sin(player.angle) * reach * 0.6;
  addParticle(world, { x: px, y: py, life: 0.15, maxLife: 0.15, size: 8, color: '#ffffff', kind: 'spark' });
  for (const cop of world.police) {
    if (distance(player.x, player.y, cop.x, cop.y) < reach + 12) {
      cop.x += Math.cos(player.angle) * 20;
      cop.y += Math.sin(player.angle) * 20;
      addHeat(world, WANTED.punchCop);
      world.audio.punch();
    }
  }
  for (const ped of world.peds) {
    if (ped.downTimer > 0) continue;
    if (distance(player.x, player.y, ped.x, ped.y) < reach + 10) {
      knockPedDown(world, ped, Math.cos(player.angle), Math.sin(player.angle));
      addHeat(world, 8);
    }
  }
}

/** A gunshot toward the mouse: hits the first pedestrian, cop or car on the line. */
function shoot(world) {
  const player = world.player;
  player.ammo -= 1;
  player.shootTimer = 0.28;
  world.audio.gunshot();
  world.shake = Math.max(world.shake, 2);
  const range = PLAYER.gunRange;
  const dx = Math.cos(player.aimAngle);
  const dy = Math.sin(player.aimAngle);
  const mx = player.x + dx * 16;
  const my = player.y + dy * 16;
  addParticle(world, { x: mx, y: my, life: 0.08, maxLife: 0.08, size: 10, color: '#ffe9a0', kind: 'spark' });
  // The loudest thing in the neighbourhood: everyone nearby runs.
  for (const ped of world.peds) {
    if (distance(player.x, player.y, ped.x, ped.y) < 320) scarePed(ped, player.x, player.y);
  }
  addHeat(world, WANTED.shoot);

  let bestD = range;
  let bestHit = null;
  let bestKind = null;
  const consider = (x, y, radius, kind, ref) => {
    const relX = x - player.x;
    const relY = y - player.y;
    const along = relX * dx + relY * dy;
    if (along < 0 || along > bestD) return;
    const perp = Math.abs(relX * dy - relY * dx);
    if (perp < radius + 6) {
      bestD = along;
      bestHit = ref;
      bestKind = kind;
    }
  };
  for (const ped of world.peds) {
    if (ped.downTimer > 0) continue;
    consider(ped.x, ped.y, 11, 'ped', ped);
  }
  for (const cop of world.police) consider(cop.x, cop.y, 12, 'cop', cop);
  for (const car of world.cars) {
    if (car.dead) continue;
    consider(car.x, car.y, car.l / 2, 'car', car);
  }
  const hitX = player.x + dx * bestD;
  const hitY = player.y + dy * bestD;
  world.tracer = { x1: mx, y1: my, x2: hitX, y2: hitY, life: 0.09 };
  if (!bestHit) return;
  if (bestKind === 'ped') {
    knockPedDown(world, bestHit, dx, dy);
    addHeat(world, WANTED.hitPedestrian);
  } else if (bestKind === 'cop') {
    bestHit.x += dx * 26;
    bestHit.y += dy * 26;
    addHeat(world, WANTED.killCop);
    spawnSparks(world, hitX, hitY, 6);
  } else if (bestKind === 'car') {
    damageCar(world, bestHit, PLAYER.gunDamage);
    spawnSparks(world, hitX, hitY, 6);
  }
}

/** Step into the nearest car; stealing an occupied one is a crime. */
function enterNearestCar(world) {
  const player = world.player;
  const car = nearestCar(world, player.x, player.y, 52);
  if (!car || car.dead) return;
  if (car.driver === 'traffic') {
    addHeat(world, WANTED.stealCar);
    world.banner = { text: 'CAR STOLEN', sub: 'The owner called the cops', timer: 1.8, color: '#ff5252' };
  }
  if (car.driver === 'police') {
    addHeat(world, WANTED.stealCar + 20);
  }
  car.driver = 'player';
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
  world.audio.pickup();
}

/** Behind the wheel: drive, handbrake, and E to get out. */
function updateDriving(world, input, dt) {
  const player = world.player;
  const car = player.car;
  if (!car || car.dead) {
    // The car blew up under Leo: he stumbles out, hurt.
    if (car) {
      player.x = car.x + 30;
      player.y = car.y + 30;
      player.car = null;
    }
    player.onFoot = true;
    player.health = Math.max(1, player.health - 20);
    player.lastDamageAt = world.time;
    return;
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  updatePlayerCar(world, car, {
    up: keyHeld(input, KEYS.up),
    down: keyHeld(input, KEYS.down),
    left: keyHeld(input, KEYS.left),
    right: keyHeld(input, KEYS.right),
    handbrake: keyHeld(input, KEYS.handbrake),
  }, dt);
  // Running over pedestrians is a crime the whole street sees.
  for (const ped of world.peds) {
    if (ped.downTimer > 0) continue;
    if (distance(car.x, car.y, ped.x, ped.y) < 26) {
      const dirX = (ped.x - car.x) / 26;
      const dirY = (ped.y - car.y) / 26;
      knockPedDown(world, ped, dirX, dirY);
      addHeat(world, WANTED.hitPedestrian);
      world.audio.crash(0.3);
    }
  }
  // And running over a foot cop is a much bigger one.
  for (const cop of world.police) {
    if (distance(car.x, car.y, cop.x, cop.y) < 26) {
      cop.x += (cop.x - car.x) * 2;
      cop.y += (cop.y - car.y) * 2;
      addHeat(world, WANTED.killCop);
      world.audio.crash(0.5);
    }
  }
  if (keyPressed(input, KEYS.enterCar)) {
    // Get out beside the car, on the driver's side.
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 30;
    player.y = car.y + Math.sin(side) * 30;
    car.driver = 'parked';
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    player.car = null;
    player.onFoot = true;
    player.angle = car.angle;
  }
}

/** Hurt the player (a punch, a crash); used by police and explosions. */
export function hurtPlayer(world, amount) {
  const player = world.player;
  player.health -= amount;
  player.lastDamageAt = world.time;
  if (player.health <= 0 && !world.wasted) {
    world.wasted = true;
    world.audio.busted();
  }
}

export function playerMoney(world) {
  return world.player.money;
}

export function addMoney(world, amount, reason) {
  world.player.money += amount;
  world.save.totalEarned += amount;
  world.audio.cash();
  world.banner = { text: `+$${amount}`, sub: reason, timer: 2.2, color: '#7ee081' };
}
void angleDifference;
void CAR;
