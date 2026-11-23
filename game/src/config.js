// Solmar City — tuning, palette and key bindings for the whole game.
// One place for every number a designer would want to change.
export const WORLD = {
  width: 3600,
  height: 2600,
  roadWidth: 72,
  sidewalk: 16,
};

// Vertical road centre lines (x) and horizontal ones (y). The city is a grid of
// blocks between them; the bottom road is the beachfront drive.
export const ROADS_V = [200, 560, 920, 1280, 1640, 2000, 2360, 2720, 3080, 3400];
export const ROADS_H = [180, 500, 820, 1140, 1460, 1780, 2100];

// The beach: sand starts here, the sea starts a little further down.
export const BEACH_Y = 2280;
export const WATER_Y = 2470;

// A park block and a plaza block, given by their road indices (between roads).
export const PARK_BLOCK = { vx: 3, vy: 2 }; // between roads 1280-1640, 820-1140
export const PLAZA_BLOCK = { vx: 5, vy: 1 }; // between roads 2000-2360, 500-820

// Sun-soaked pastel palette: Miami pastels on warm asphalt, turquoise sea.
export const PALETTE = {
  grass: '#7fb069',
  grassDark: '#6da25c',
  park: '#5d9b4e',
  sand: '#ecd9a0',
  water: '#2fa8b8',
  waterDeep: '#1e7f9e',
  asphalt: '#3d4450',
  asphaltLine: '#e8c84a',
  sidewalk: '#b9bec7',
  crosswalk: '#e8e8e8',
  building: ['#f2b8c6', '#ffd9a0', '#a8d8c8', '#a9c6e8', '#e8d5a9', '#d5b8e8', '#f7f3ea', '#ffb3a0', '#c8e6a0'],
  roofLine: 'rgba(0,0,0,0.25)',
  window: 'rgba(30,50,80,0.55)',
  palmTrunk: '#8a6a4a',
  palmLeaf: '#3f9e4d',
  playerJacket: '#ff7a1a',
  playerPants: '#2b3a55',
  policeBody: '#f2f2f2',
  policeDoor: '#1c2733',
  taxi: '#f7c948',
};

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 285,
  radius: 13,
  maxHealth: 100,
  punchRange: 34,
  punchDamage: 25,
  gunDamage: 34,
  gunRange: 420,
  startAmmo: 24,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 430,
  maxReverse: 140,
  turnRate: 2.6,
  grip: 5.5,
  handbrakeGrip: 1.4,
  trafficSpeed: 95,
  maxHealth: 100,
};

// Wanted heat: 0-100, stars are heat/20 rounded up. Crimes add heat, hiding sheds it.
export const WANTED = {
  stealCar: 22,
  hitPedestrian: 18,
  shoot: 14,
  punchCop: 30,
  killCop: 45,
  decayPerSecond: 2.2,
  decayHiddenBonus: 2.0,
  sightRange: 520,
};

// Police response by stars: how many patrol cars and foot cops stay active.
export const POLICE_BY_STARS = [
  { cars: 0, foot: 0 },
  { cars: 0, foot: 1 },
  { cars: 1, foot: 1 },
  { cars: 2, foot: 2 },
  { cars: 3, foot: 2 },
  { cars: 4, foot: 3 },
];

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  handbrake: ['Space'],
  punch: ['Space'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  restart: ['KeyR'],
};

export const SAVE_KEY = 'solmar-city-save-v1';
export const DEFAULT_SEED = 1337;
