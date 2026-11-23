// The world: everything alive in Solmar City, and the one fixed step that
// advances all of it. The main loop and the screenshot stager both step the
// same world, so a screenshot is a real game, a few seconds in.
import { WORLD, DEFAULT_SEED } from './config.js';
import { mulberry32 } from './random.js';
import { createCity } from './city.js';
import { createPlayer } from './player.js';
import { spawnCityTraffic, updateTrafficCar } from './vehicles.js';
import { spawnPedestrians, updatePeds } from './people.js';
import { createMissions } from './missions.js';
import { updatePlayer } from './player.js';
import { updatePolice } from './police.js';
import { updateMissions } from './missions.js';
import { decayWanted } from './wanted.js';
import { updateParticles } from './effects.js';

/** A fresh world from a seed and an optional save. */
export function createWorld(seed, save, audio) {
  const rng = mulberry32(seed);
  const world = {
    seed,
    rng,
    audio,
    save,
    time: 0,
    cityWidth: WORLD.width,
    cityHeight: WORLD.height,
    city: null,
    cars: [],
    peds: [],
    police: [],
    player: null,
    wanted: { heat: 0, stars: 0 },
    mission: null,
    stashes: [],
    fare: null,
    fareSpawnTimer: 8,
    particles: [],
    skids: [],
    shake: 0,
    banner: null,
    tracer: null,
    mouseWorldX: 0,
    mouseWorldY: 0,
    screen: 'title',
    busted: false,
    wasted: false,
    attractAngle: 0,
  };
  resetWorld(world, seed);
  return world;
}

/** Rebuild the city, traffic and people from the world's seed. */
export function resetWorld(world, seed) {
  world.seed = seed;
  world.rng = mulberry32(seed);
  world.time = 0;
  world.city = createCity(world.rng);
  world.cars = [];
  world.peds = [];
  world.police = [];
  world.particles = [];
  world.skids = [];
  world.shake = 0;
  world.banner = null;
  world.tracer = null;
  world.wanted = { heat: 0, stars: 0 };
  world.busted = false;
  world.wasted = false;
  const save = world.save;
  world.player = createPlayer(save ? save.x : 1280, save ? save.y : 1460, save);
  spawnCityTraffic(world, world.rng, 16, 14);
  spawnPedestrians(world, world.rng, 42);
  createMissions(world);
  if (save && save.missionIndex > 0) {
    world.mission.index = save.missionIndex;
  }
}

/** One fixed step of the whole simulation. */
export function stepWorld(world, input, dt) {
  world.time += dt;
  if (world.banner) {
    world.banner.timer -= dt;
    if (world.banner.timer <= 0) world.banner = null;
  }
  if (world.tracer) {
    world.tracer.life -= dt;
    if (world.tracer.life <= 0) world.tracer = null;
  }
  updatePlayer(world, input, dt);
  for (const car of world.cars) {
    if (car.driver === 'traffic') updateTrafficCar(world, car, dt, world.rng);
  }
  updatePeds(world, dt);
  updatePolice(world, dt, world.rng);
  updateMissions(world, dt, input);
  decayWanted(world, dt);
  updateParticles(world, dt);
  const driving = !world.player.onFoot && world.player.car;
  world.audio.setEngine(driving ? world.player.car.speed : 0, !!driving);
  const policeNear = world.police.length > 0 || world.cars.some((c) => c.driver === 'police' && !c.dead);
  world.audio.sirenTick(dt, policeNear && world.wanted.stars > 0);
}
