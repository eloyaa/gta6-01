// The story of Solmar City: five jobs for Leo Cruz, from a first pickup to
// the King of Solmar. Plus the side hustles that never stop: taxi fares and
// cash stashes hidden around the city.
import { distance } from './util.js';
import { addMoney } from './player.js';
import { createPed, nearestFare } from './people.js';
import { randomRoadPoint, randomSidewalkPoint } from './city.js';
import { addHeat } from './wanted.js';
import { keyPressed } from './input.js';
import { KEYS } from './config.js';
import { spawnPickupSparkle } from './effects.js';

// Ten cash stashes, hidden where a careful driver looks: the park, the
// plaza, the beach, and the alleys between the towers.
export const STASH_SPOTS = [
  { x: 1460, y: 980 }, { x: 2180, y: 660 }, { x: 600, y: 2400 }, { x: 3000, y: 2400 },
  { x: 200, y: 2100 }, { x: 3400, y: 200 }, { x: 920, y: 180 }, { x: 2720, y: 1780 },
  { x: 1640, y: 2100 }, { x: 560, y: 1140 },
];

export const MISSIONS = [
  {
    id: 'pickup',
    title: 'Job 1 — The Pickup',
    briefing: 'Rosa needs a package from the warehouse. Fetch it, then bring it to the garage.',
    reward: 300,
    steps: [
      { type: 'pickup', x: 2360, y: 1780, radius: 46, text: 'Pick up the package at the warehouse' },
      { type: 'deliver', x: 560, y: 500, radius: 60, text: 'Deliver the package to the garage' },
    ],
  },
  {
    id: 'wheelman',
    title: 'Job 2 — Wheelman',
    briefing: 'A buyer wants a sports car, no questions asked. Steal one and bring it to the lockup. The cops will notice.',
    reward: 500,
    heat: 22,
    steps: [
      { type: 'steal', kind: 'sport', text: 'Steal a sports car' },
      { type: 'deliver', x: 3080, y: 1460, radius: 70, kind: 'sport', text: 'Deliver the sports car to the lockup' },
    ],
  },
  {
    id: 'taxi',
    title: 'Job 3 — Taxi Nights',
    briefing: 'Drive the cab, keep the meter running. Three fares, three paydays.',
    reward: 450,
    steps: [
      { type: 'fares', count: 3, text: 'Complete 3 taxi fares' },
    ],
  },
  {
    id: 'getaway',
    title: 'Job 4 — The Getaway',
    briefing: 'Grab the cash from the bank job, then lose the whole Solmar PD and reach the safehouse.',
    reward: 800,
    heat: 55,
    steps: [
      { type: 'pickup', x: 2180, y: 660, radius: 46, text: 'Grab the cash at the plaza bank' },
      { type: 'escape', x: 200, y: 180, radius: 70, text: 'Lose the cops — reach the safehouse' },
    ],
  },
  {
    id: 'king',
    title: 'Job 5 — King of Solmar',
    briefing: 'Three drops, one yacht, the whole city on your tail. Finish this and Solmar is yours.',
    reward: 1500,
    heat: 75,
    steps: [
      { type: 'collect', points: [{ x: 920, y: 1780 }, { x: 2720, y: 500 }, { x: 3400, y: 2100 }], text: 'Collect the three cash drops' },
      { type: 'escape', x: 3300, y: 2380, radius: 70, text: 'Reach the yacht on the beach' },
    ],
  },
];

/** Mission state, stashes and the fare system, fresh for a new world. */
export function createMissions(world) {
  world.mission = {
    index: world.save.missionIndex || 0,
    stepIndex: 0,
    active: false,
    done: false,
    allDone: false,
    faresDoneInMission: 0,
    nextStartTimer: 0,
    target: null,
  };
  world.stashes = STASH_SPOTS.map((spot, i) => ({
    x: spot.x, y: spot.y, found: (world.save.stashesFound || []).indexOf(i) !== -1,
  }));
  world.fare = null;
  world.fareSpawnTimer = 8;
}

/** Start a mission by index: banner, heat, and its first step. */
export function startMission(world, index) {
  const mission = MISSIONS[index];
  if (!mission) {
    world.mission.allDone = true;
    world.mission.active = false;
    world.mission.target = null;
    world.banner = { text: 'KING OF SOLMAR', sub: 'Every job done. The city is yours, Leo.', timer: 4, color: '#ffd24a' };
    return;
  }
  world.mission.index = index;
  world.mission.stepIndex = 0;
  world.mission.active = true;
  world.mission.done = false;
  world.mission.faresDoneInMission = 0;
  world.mission.collectCount = 0;
  world.mission.nextStartTimer = 0;
  if (mission.heat) addHeat(world, mission.heat);
  world.banner = { text: mission.title, sub: mission.briefing, timer: 4, color: '#ffd24a' };
  world.audio.missionDone();
  refreshTarget(world);
}

/** The current objective, for the HUD, the arrow and the minimap. */
export function missionTarget(world) {
  return world.mission.target;
}

/** Recompute the current step's target from the mission data. */
export function refreshTarget(world) {
  const mission = MISSIONS[world.mission.index];
  if (!mission || !world.mission.active) {
    world.mission.target = null;
    return;
  }
  const step = mission.steps[world.mission.stepIndex];
  if (!step) {
    world.mission.target = null;
    return;
  }
  if (step.type === 'fares') {
    world.mission.target = world.fare
      ? { x: world.fare.dest.x, y: world.fare.dest.y, label: `Fare ${world.mission.faresDoneInMission + 1}/3 — drop off the passenger`, radius: 60 }
      : { x: world.player.x, y: world.player.y, label: 'Find a waving passenger ( ! )', radius: 0, hidden: true };
    return;
  }
  if (step.type === 'collect') {
    const next = step.points[world.mission.collectCount || 0];
    world.mission.target = next
      ? { x: next.x, y: next.y, label: `Cash drop ${(world.mission.collectCount || 0) + 1}/${step.points.length}`, radius: 46 }
      : null;
    return;
  }
  if (step.type === 'steal') {
    const car = nearestSportCar(world);
    world.mission.target = car
      ? { x: car.x, y: car.y, label: 'Steal the sports car', radius: 0, follow: car }
      : { x: world.player.x, y: world.player.y, label: 'Find a sports car', radius: 0 };
    return;
  }
  world.mission.target = { x: step.x, y: step.y, label: step.text, radius: step.radius || 50 };
}

function nearestSportCar(world) {
  let best = null;
  let bestD = Infinity;
  for (const car of world.cars) {
    if (car.kind !== 'sport' || car.dead || car.driver === 'player') continue;
    const d = distance(world.player.x, world.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Advance to the next step, or finish the mission with its reward. */
function advanceStep(world) {
  const mission = MISSIONS[world.mission.index];
  world.mission.stepIndex += 1;
  if (world.mission.stepIndex >= mission.steps.length) {
    completeMission(world, mission);
  } else {
    refreshTarget(world);
  }
}

function completeMission(world, mission) {
  world.mission.active = false;
  world.mission.done = true;
  addMoney(world, mission.reward, `${mission.title} complete`);
  world.save.missionIndex = world.mission.index + 1;
  world.mission.nextStartTimer = 3;
  world.banner = { text: 'JOB DONE', sub: `${mission.title} — $${mission.reward} earned`, timer: 3, color: '#7ee081' };
  world.audio.missionDone();
}

/** A fare pedestrian waves near the player; E (on foot) picks them up. */
export function spawnFarePed(world) {
  const spot = randomSidewalkPoint(world.rng);
  const d = distance(spot.x, spot.y, world.player.x, world.player.y);
  if (d < 200 || d > 700) return;
  const ped = createPed(spot.x, spot.y, 'fare');
  world.peds.push(ped);
}

/** Start a fare: the passenger climbs in, the meter runs, the clock ticks. */
export function startFare(world, ped) {
  const dest = randomRoadPoint(world.rng);
  world.fare = {
    ped,
    dest: { x: dest.x, y: dest.y },
    timer: 100,
    pay: 50 + Math.floor(distance(ped.x, ped.y, dest.x, dest.y) / 60),
  };
  // The passenger is in the car now, not on the kerb any more.
  const at = world.peds.indexOf(ped);
  if (at !== -1) world.peds.splice(at, 1);
  world.banner = { text: 'FARE PICKED UP', sub: `Drop them off — $${world.fare.pay} on the meter`, timer: 2, color: '#7ee081' };
  // With no story job running, the fare itself is the objective.
  if (!world.mission.active) {
    world.mission.target = { x: world.fare.dest.x, y: world.fare.dest.y, label: 'Drop off the passenger', radius: 60 };
  } else {
    refreshTarget(world);
  }
}

function completeFare(world) {
  const fare = world.fare;
  addMoney(world, fare.pay, 'Taxi fare');
  world.save.faresDone += 1;
  world.fare = null;
  const mission = MISSIONS[world.mission.index];
  if (world.mission.active && mission && mission.steps[world.mission.stepIndex].type === 'fares') {
    world.mission.faresDoneInMission += 1;
    if (world.mission.faresDoneInMission >= mission.steps[world.mission.stepIndex].count) {
      advanceStep(world);
      return;
    }
  }
  refreshTarget(world);
}

/** Missions, fares and stashes, one step. */
export function updateMissions(world, dt, input) {
  const player = world.player;

  // The next job starts a few seconds after the last one ends.
  if (!world.mission.active && world.mission.nextStartTimer > 0) {
    world.mission.nextStartTimer -= dt;
    if (world.mission.nextStartTimer <= 0) startMission(world, world.mission.index + 1);
  }

  // Pick up a waving fare with E — from the car or on foot.
  if (!world.fare && keyPressed(input, KEYS.enterCar)) {
    const fare = nearestFare(world, player.x, player.y, 56);
    if (fare) startFare(world, fare);
  }

  // The active fare's clock and destination.
  if (world.fare) {
    world.fare.timer -= dt;
    if (world.fare.timer <= 0) {
      world.banner = { text: 'FARE LOST', sub: 'The passenger gave up and walked away', timer: 2, color: '#ff5252' };
      world.fare = null;
      refreshTarget(world);
    } else if (distance(player.x, player.y, world.fare.dest.x, world.fare.dest.y) < 60) {
      completeFare(world);
    }
  }

  // A fresh fare waves every so often, once Leo has done the first job.
  if (!world.fare && world.save.missionIndex >= 1) {
    world.fareSpawnTimer -= dt;
    if (world.fareSpawnTimer <= 0) {
      world.fareSpawnTimer = 22;
      let fares = 0;
      for (const ped of world.peds) if (ped.kind === 'fare') fares += 1;
      if (fares < 2) spawnFarePed(world);
    }
  }

  // Cash stashes: walk over one to pocket $100.
  for (let i = 0; i < world.stashes.length; i += 1) {
    const stash = world.stashes[i];
    if (stash.found) continue;
    if (distance(player.x, player.y, stash.x, stash.y) < 30) {
      stash.found = true;
      world.save.stashesFound.push(i);
      addMoney(world, 100, 'Hidden cash stash found');
      spawnPickupSparkle(world, stash.x, stash.y);
    }
  }

  // The current mission step.
  if (!world.mission.active) return;
  const mission = MISSIONS[world.mission.index];
  const step = mission.steps[world.mission.stepIndex];
  if (!step) return;

  if (step.type === 'goto' || step.type === 'pickup' || step.type === 'deliver' || step.type === 'escape') {
    if (distance(player.x, player.y, step.x, step.y) < (step.radius || 50)) {
      if (step.type === 'deliver' && step.kind && (!player.car || player.car.kind !== step.kind)) {
        return; // the delivery needs the right car
      }
      if (step.type === 'pickup') spawnPickupSparkle(world, step.x, step.y);
      advanceStep(world);
    }
  } else if (step.type === 'steal') {
    if (player.car && player.car.kind === step.kind) advanceStep(world);
  } else if (step.type === 'collect') {
    const point = step.points[world.mission.collectCount || 0];
    if (point && distance(player.x, player.y, point.x, point.y) < 46) {
      world.mission.collectCount = (world.mission.collectCount || 0) + 1;
      spawnPickupSparkle(world, point.x, point.y);
      world.audio.pickup();
      if (world.mission.collectCount >= step.points.length) advanceStep(world);
      else refreshTarget(world);
    }
  } else if (step.type === 'fares') {
    refreshTarget(world);
  }
}
