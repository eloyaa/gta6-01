// The screenshot scenes behind ?shot=chase|drive|street|title. Each one plays
// the real rules forward from a fresh world, steered by a simple autopilot,
// so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { createCar } from './vehicles.js';
import { createPed } from './people.js';
import { startMission, refreshTarget } from './missions.js';
import { startFare } from './missions.js';
import { stepWorld } from './game.js';
import { endFrame } from './input.js';

const STEP = 1 / 60;

/** A fake input that holds W and steers toward the road ahead. */
function driveInput(world, steerToAngle) {
  const held = new Set(['KeyW']);
  const player = world.player;
  if (player.car) {
    const diff = player.car.angle - steerToAngle;
    const wrapped = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (wrapped > 0.12) held.add('KeyA');
    else if (wrapped < -0.12) held.add('KeyD');
  }
  return { held, pressed: new Set(), mouseX: 640, mouseY: 360, mouseDown: false, mousePressed: false };
}

/** Run the world forward for `seconds`, stepping with the given input maker. */
function playForward(world, seconds, makeInput) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = makeInput ? makeInput(world) : { held: new Set(), pressed: new Set(), mouseX: 640, mouseY: 360, mouseDown: false, mousePressed: false };
    stepWorld(world, input, STEP);
    endFrame(input);
    if (world.busted || world.wasted) break;
  }
}

/** Put Leo in a car at a road, facing along it. */
function putPlayerInCar(world, x, y, angle, kind) {
  const car = createCar(x, y, angle, kind, 'player');
  world.cars.push(car);
  const player = world.player;
  player.car = car;
  player.onFoot = false;
  player.x = x;
  player.y = y;
  player.angle = angle;
  car.speed = 240;
  car.vx = Math.cos(angle) * 240;
  car.vy = Math.sin(angle) * 240;
  return car;
}

function spawnPoliceBehind(world, x, y, angle, count) {
  for (let i = 0; i < count; i += 1) {
    const car = createCar(x - i * 90, y + (i % 2 === 0 ? 20 : -20), angle, 'police', 'police');
    car.speed = 260;
    car.vx = Math.cos(angle) * 260;
    car.vy = Math.sin(angle) * 260;
    world.cars.push(car);
  }
}

/**
 * Stage the named scene on a fresh world and return the screen to show.
 * chase: a three-star police chase in a sports car. drive: a taxi fare along
 * the beachfront. street: Leo on foot in the plaza, a fare waving. title:
 * the title screen over a living downtown.
 */
export function stageShot(name, world) {
  if (name === 'chase') {
    putPlayerInCar(world, 2800, 1460, Math.PI, 'sport');
    spawnPoliceBehind(world, 3000, 1460, Math.PI, 2);
    startMission(world, 3);
    world.mission.stepIndex = 1;
    refreshTarget(world);
    playForward(world, 2, (w) => driveInput(w, Math.PI));
    // The chase is rough on cars: if Leo's ride died mid-staging, give him a
    // fresh one in the middle of the action and put the heat back to 3 stars.
    if (world.player.onFoot) {
      putPlayerInCar(world, 1840, 1460, Math.PI, 'sport');
      spawnPoliceBehind(world, 2060, 1460, Math.PI, 2);
    } else {
      world.player.car.health = 100;
      world.player.car.smoking = false;
    }
    world.wanted.heat = 55;
    world.wanted.stars = 3;
    // The banner is a snapshot from staging (it may say 4 stars from a
    // jaywalker hit); rewrite it to match the 3 stars the frame shows.
    world.banner = { text: 'WANTED LEVEL 3', sub: 'The Solmar PD is on your tail', timer: 4, color: '#ff5a5a' };
    return { screen: 'play' };
  }
  if (name === 'drive') {
    const car = putPlayerInCar(world, 2900, 2100, Math.PI, 'taxi');
    void car;
    const fare = createPed(2860, 2050, 'fare');
    world.peds.push(fare);
    startFare(world, fare);
    world.fare.dest = { x: 700, y: 2100 };
    world.fare.timer = 95;
    playForward(world, 4, (w) => driveInput(w, Math.PI));
    // A taxi fare is not a crime scene: clear any heat the cab picked up
    // running over jaywalkers on the way, and send the cops home.
    world.wanted.heat = 0;
    world.wanted.stars = 0;
    world.police = [];
    for (const c of world.cars) {
      if (c.driver === 'police') {
        c.driver = 'parked';
        c.speed = 0;
        c.vx = 0;
        c.vy = 0;
      }
    }
    world.banner = { text: 'FARE PICKED UP', sub: 'Drop them off on the beachfront — $95 on the meter', timer: 4, color: '#7ee081' };
    return { screen: 'play' };
  }
  if (name === 'street') {
    const player = world.player;
    player.x = 2100;
    player.y = 700;
    player.angle = Math.PI / 2;
    const fare = createPed(2150, 640, 'fare');
    world.peds.push(fare);
    const walker = createPed(2050, 760, 'walker');
    world.peds.push(walker);
    startMission(world, 0);
    playForward(world, 2.5, null);
    // Re-raise the job banner so it reads at full strength in the frame.
    world.banner = { text: 'Job 1 — The Pickup', sub: 'Rosa needs a package from the warehouse. Fetch it, then bring it to the garage.', timer: 4, color: '#ffd24a' };
    return { screen: 'play' };
  }
  // title: the attract mode — traffic rolls through downtown under the menu.
  world.screen = 'title';
  world.attract = true;
  playForward(world, 4, null);
  return { screen: 'title' };
}

export function shotNames() {
  return ['chase', 'drive', 'street', 'title'];
}
