// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, busted and wasted screens.
//
// ?seed=N fixes the city. ?shot=chase|drive|street|title stages that scene
// instead of the title screen and sets window.__shotReady for a screenshot.
import { DEFAULT_SEED, KEYS } from './config.js';
import { createWorld, resetWorld, stepWorld } from './game.js';
import { createInput, keyPressed, endFrame } from './input.js';
import { createCamera, updateCamera, drawWorld, drawHUD } from './render.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave, defaultSave } from './save.js';
import { startMission, MISSIONS } from './missions.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause-menu');
const endEl = document.getElementById('end-menu');
const endTitleEl = document.getElementById('end-title');
const endTextEl = document.getElementById('end-text');

const audio = createAudio();
let save = loadSave() || defaultSave();
const world = createWorld(seed, save, audio);
const input = createInput(canvas);
const camera = createCamera();

let screen = 'title';
let saveTimer = 0;
let framesPainted = 0;

function viewSize() {
  return { w: window.innerWidth, h: window.innerHeight };
}

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/** Show one DOM overlay and hide the others. */
function showOverlay(which) {
  menuEl.classList.toggle('hidden', which !== 'menu');
  pauseEl.classList.toggle('hidden', which !== 'pause');
  endEl.classList.toggle('hidden', which !== 'end');
  if (which === 'menu') fillMenu();
}

function setStatus(text) {
  statusEl.textContent = text;
}

/** The title screen's mission list, with ticks for finished jobs. */
function fillMenu() {
  const list = document.getElementById('mission-list');
  if (!list) return;
  list.innerHTML = '';
  MISSIONS.forEach((mission, i) => {
    const li = document.createElement('li');
    li.textContent = `${save.missionIndex > i ? '✓' : '○'} ${mission.title} — $${mission.reward}`;
    if (save.missionIndex > i) li.className = 'done';
    list.appendChild(li);
  });
  const continueBtn = document.getElementById('btn-continue');
  if (continueBtn) continueBtn.disabled = !(save && (save.missionIndex > 0 || save.totalEarned > 0 || save.money > 0));
}

/** Begin playing: fresh or continued, with the current job started. */
function startPlaying(fromSave) {
  audio.unlock();
  if (!fromSave) {
    save = defaultSave();
    clearSave();
    resetWorld(world, seed);
    world.save = save;
  } else {
    world.player.x = save.x;
    world.player.y = save.y;
    world.player.money = save.money;
    world.player.health = save.health;
    world.player.ammo = save.ammo;
  }
  world.screen = 'play';
  screen = 'play';
  showOverlay(null);
  setStatus('Playing Solmar City');
  startMission(world, Math.min(save.missionIndex, MISSIONS.length - 1));
  writeSave(save);
}

function pauseGame() {
  if (screen !== 'play') return;
  screen = 'paused';
  world.screen = 'paused';
  showOverlay('pause');
  setStatus('Paused');
  syncSave();
  writeSave(save);
}

function resumeGame() {
  audio.unlock();
  screen = 'play';
  world.screen = 'play';
  showOverlay(null);
  setStatus('Playing Solmar City');
}

function quitToTitle() {
  syncSave();
  writeSave(save);
  screen = 'title';
  world.screen = 'title';
  world.attract = true;
  showOverlay('menu');
  setStatus('Solmar City title screen');
}

/** Busted or wasted: the penalty, the screen, and the way back in. */
function endGame(kind) {
  const player = world.player;
  const fine = kind === 'busted' ? 100 : 150;
  player.money = Math.max(0, player.money - fine);
  world.wanted.heat = 0;
  world.wanted.stars = 0;
  world.police = [];
  for (const car of world.cars) {
    if (car.driver === 'police') {
      car.driver = 'parked';
      car.speed = 0;
      car.vx = 0;
      car.vy = 0;
    }
  }
  if (player.car) {
    player.car.driver = 'parked';
    player.car = null;
  }
  player.onFoot = true;
  screen = kind;
  world.screen = kind;
  endTitleEl.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  endTextEl.textContent = kind === 'busted'
    ? `The Solmar PD took you in. Fine: $${fine}. Your crew bailed you out at the station.`
    : `You woke up at Solmar General. Hospital bill: $${fine}. The job is still waiting.`;
  showOverlay('end');
  setStatus(endTitleEl.textContent);
  syncSave();
  writeSave(save);
  world.busted = false;
  world.wasted = false;
}

/** Back on the street after a bust or a hospital stay. */
function retryGame() {
  const player = world.player;
  player.health = 100;
  player.ammo = Math.max(player.ammo, 12);
  player.x = 560;
  player.y = 820;
  player.angle = -Math.PI / 2;
  screen = 'play';
  world.screen = 'play';
  showOverlay(null);
  setStatus('Playing Solmar City');
  if (world.mission.active || world.mission.index < MISSIONS.length) {
    startMission(world, Math.min(world.mission.index, MISSIONS.length - 1));
  }
}

/** Copy the live state into the save object. */
function syncSave() {
  save.money = world.player.money;
  save.health = Math.max(1, Math.round(world.player.health));
  save.ammo = world.player.ammo;
  save.x = Math.round(world.player.x);
  save.y = Math.round(world.player.y);
  save.missionIndex = world.mission.index + (world.mission.done ? 1 : 0);
  save.stashesFound = world.stashes.map((s, i) => (s.found ? i : -1)).filter((i) => i >= 0);
  save.totalEarned = world.save.totalEarned;
  save.faresDone = world.save.faresDone;
}

// Buttons.
document.getElementById('btn-start').addEventListener('click', () => startPlaying(false));
document.getElementById('btn-continue').addEventListener('click', () => startPlaying(true));
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  resumeGame();
  startMission(world, Math.min(world.mission.index, MISSIONS.length - 1));
});
document.getElementById('btn-quit').addEventListener('click', quitToTitle);
document.getElementById('btn-retry').addEventListener('click', retryGame);
document.getElementById('btn-end-title').addEventListener('click', quitToTitle);
canvas.addEventListener('mousedown', () => audio.unlock());

/** One fixed step, with the mouse translated into world coordinates. */
function step(dt) {
  const view = viewSize();
  world.mouseWorldX = camera.x + input.mouseX / camera.zoom;
  world.mouseWorldY = camera.y + input.mouseY / camera.zoom;
  if (screen === 'play') {
    stepWorld(world, input, dt);
    if (keyPressed(input, KEYS.pause)) pauseGame();
    if (keyPressed(input, KEYS.mute)) audio.setMuted(!audio.isMuted());
    if (keyPressed(input, KEYS.restart)) startMission(world, Math.min(world.mission.index, MISSIONS.length - 1));
    if (world.busted) endGame('busted');
    else if (world.wasted) endGame('wasted');
  } else if (screen === 'title') {
    // Attract mode: the city lives behind the menu, camera drifting over downtown.
    world.attractAngle = (world.attractAngle || 0) + dt * 0.04;
    const cx = 1800 + Math.cos(world.attractAngle) * 420;
    const cy = 1250 + Math.sin(world.attractAngle * 0.7) * 260;
    world.player.x = cx;
    world.player.y = cy;
    stepWorld(world, { held: new Set(), pressed: new Set(), mouseX: 0, mouseY: 0, mouseDown: false, mousePressed: false }, dt);
  }
  endFrame(input);
  saveTimer += dt;
  if (saveTimer > 5 && screen === 'play') {
    saveTimer = 0;
    syncSave();
    writeSave(save);
  }
}

/** Paint the current screen. */
function render() {
  const view = viewSize();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#11141b';
  ctx.fillRect(0, 0, view.w, view.h);
  updateCamera(camera, world, view.w, view.h, STEP);
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x + camera.shakeX, -camera.y + camera.shakeY);
  drawWorld(ctx, world, camera, view.w, view.h);
  ctx.restore();
  if (screen === 'play' || screen === 'paused') drawHUD(ctx, world, view.w, view.h);
  framesPainted += 1;
  if (shot && framesPainted >= 2) window.__shotReady = true;
}

let last = performance.now();
function frame(now) {
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
  let acc = elapsed;
  // A staged shot frame stays exactly as staged: the world is frozen and
  // only the camera settles, so the screenshot matches the staging.
  while (acc >= STEP && !shot) {
    step(STEP);
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}

// A screenshot scene: stage it on a fresh world, then let the loop paint it.
if (shot) {
  const staged = stageShot(shot, world);
  screen = staged.screen;
  world.screen = staged.screen;
  if (staged.screen === 'title') showOverlay('menu');
  else showOverlay(null);
  setStatus(`Solmar City — ${shot} scene`);
} else {
  showOverlay('menu');
  world.attract = true;
}

// Debug handle for the screenshot driver: the live world, nothing more.
window.__solmar = world;

requestAnimationFrame(frame);
