// Everything the eye sees: the city, the cars, the people, the particles,
// and the HUD — cash, health, wanted stars, the objective and the minimap.
// Canvas 2D only; the game has no image assets at all.
import { WORLD, ROADS_V, ROADS_H, BEACH_Y, WATER_Y, PALETTE, PLAYER } from './config.js';
import { clamp, distance } from './util.js';

/** Round a rectangle path (canvas has no built-in rounded rect in old engines). */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The camera follows Leo, zooming out a little at speed. */
export function createCamera() {
  return { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 };
}

export function updateCamera(camera, world, viewW, viewH, dt) {
  const player = world.player;
  const targetZoom = player.car ? 0.82 : 1.0;
  camera.zoom += (targetZoom - camera.zoom) * Math.min(1, 2 * dt);
  const targetX = player.x - viewW / 2 / camera.zoom;
  const targetY = player.y - viewH / 2 / camera.zoom;
  camera.x += (targetX - camera.x) * Math.min(1, 6 * dt);
  camera.y += (targetY - camera.y) * Math.min(1, 6 * dt);
  const maxX = WORLD.width - viewW / camera.zoom;
  const maxY = WORLD.height - viewH / camera.zoom;
  camera.x = maxX > 0 ? clamp(camera.x, 0, maxX) : maxX / 2;
  camera.y = maxY > 0 ? clamp(camera.y, 0, maxY) : maxY / 2;
  if (world.shake > 0) {
    camera.shakeX = (Math.random() - 0.5) * world.shake;
    camera.shakeY = (Math.random() - 0.5) * world.shake;
    world.shake = Math.max(0, world.shake - 40 * dt);
  } else {
    camera.shakeX = 0;
    camera.shakeY = 0;
  }
}

/** True when the rectangle is inside the camera's view (with a margin). */
function inView(camera, viewW, viewH, x, y, w, h, margin = 80) {
  const left = camera.x - margin;
  const top = camera.y - margin;
  const right = camera.x + viewW / camera.zoom + margin;
  const bottom = camera.y + viewH / camera.zoom + margin;
  return x + w >= left && x <= right && y + h >= top && y <= bottom;
}

/** Draw the whole world (ground, roads, buildings, cars, people, particles). */
export function drawWorld(ctx, world, camera, viewW, viewH) {
  const halfRoad = WORLD.roadWidth / 2;
  const t = world.time;

  // Ground: grass everywhere, then the beach and the sea.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(camera.x - 40, camera.y - 40, viewW / camera.zoom + 80, viewH / camera.zoom + 80);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(camera.x - 40, Math.max(camera.y, BEACH_Y), viewW / camera.zoom + 80, WORLD.height - BEACH_Y);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(camera.x - 40, WATER_Y, viewW / camera.zoom + 80, WORLD.height - WATER_Y);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let x = Math.floor(camera.x / 90) * 90; x < camera.x + viewW / camera.zoom; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, WATER_Y + 14 + Math.sin(t * 1.4 + x * 0.02) * 3);
    ctx.quadraticCurveTo(x + 22, WATER_Y + 8 + Math.sin(t * 1.4 + x * 0.02) * 3, x + 45, WATER_Y + 14 + Math.sin(t * 1.4 + x * 0.02) * 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Park and plaza grounds.
  if (world.city.park) {
    const p = world.city.park;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#6fb7d8';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, 42, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (world.city.plaza) {
    const p = world.city.plaza;
    ctx.fillStyle = '#d8cfc0';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#7fc4d8';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sidewalks (a pale band) then asphalt on top of them.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_V) ctx.fillRect(rx - halfRoad - WORLD.sidewalk, camera.y - 20, WORLD.roadWidth + WORLD.sidewalk * 2, viewH / camera.zoom + 40);
  for (const ry of ROADS_H) ctx.fillRect(camera.x - 20, ry - halfRoad - WORLD.sidewalk, viewW / camera.zoom + 40, WORLD.roadWidth + WORLD.sidewalk * 2);
  ctx.fillStyle = PALETTE.asphalt;
  for (const rx of ROADS_V) ctx.fillRect(rx - halfRoad, camera.y - 20, WORLD.roadWidth, viewH / camera.zoom + 40);
  for (const ry of ROADS_H) ctx.fillRect(camera.x - 20, ry - halfRoad, viewW / camera.zoom + 40, WORLD.roadWidth);

  // Centre dashes and crosswalks.
  ctx.fillStyle = PALETTE.asphaltLine;
  const dash = 26;
  const gap = 22;
  for (const rx of ROADS_V) {
    for (let y = Math.floor(camera.y / (dash + gap)) * (dash + gap); y < camera.y + viewH / camera.zoom; y += dash + gap) {
      ctx.fillRect(rx - 2, y, 4, dash);
    }
  }
  for (const ry of ROADS_H) {
    for (let x = Math.floor(camera.x / (dash + gap)) * (dash + gap); x < camera.x + viewW / camera.zoom; x += dash + gap) {
      ctx.fillRect(x, ry - 2, dash, 4);
    }
  }
  ctx.fillStyle = PALETTE.crosswalk;
  for (const rx of ROADS_V) {
    for (const ry of ROADS_H) {
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(rx + i * 12 - 3, ry - halfRoad - 2, 6, 12);
        ctx.fillRect(rx + i * 12 - 3, ry + halfRoad - 10, 6, 12);
      }
    }
  }

  // Buildings: shadow, pastel body, roof line and a window grid.
  for (const b of world.city.buildings) {
    if (!inView(camera, viewW, viewH, b.x, b.y, b.w, b.h)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.roofLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = PALETTE.window;
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        ctx.fillRect(b.x + 8 + c * 26, b.y + 8 + r * 26, 12, 10);
      }
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h / 2 - 10, 28, 20);
    }
  }

  // Palms, trees and lamps.
  for (const palm of world.city.palms) {
    if (!inView(camera, viewW, viewH, palm.x, palm.y, 4, 4, 40)) continue;
    drawPalm(ctx, palm.x, palm.y, t + palm.x * 0.01);
  }
  for (const tree of world.city.trees) {
    if (!inView(camera, viewW, viewH, tree.x, tree.y, 4, 4, 40)) continue;
    ctx.fillStyle = '#2f7a3a';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f9e4d';
    ctx.beginPath();
    ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Skid marks fade where cars slid.
  for (const skid of world.skids) {
    ctx.save();
    ctx.translate(skid.x, skid.y);
    ctx.rotate(skid.angle);
    ctx.fillStyle = `rgba(20,20,24,${Math.min(0.5, skid.life / 8)})`;
    ctx.fillRect(-14, -3, 28, 5);
    ctx.restore();
  }

  // Hidden cash stashes glint gold until Leo finds them.
  for (const stash of world.stashes) {
    if (stash.found) continue;
    if (!inView(camera, viewW, viewH, stash.x, stash.y, 4, 4, 60)) continue;
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    ctx.fillStyle = `rgba(255,210,74,${pulse})`;
    ctx.beginPath();
    ctx.arc(stash.x, stash.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a00';
    ctx.fillRect(stash.x - 6, stash.y - 4, 12, 8);
  }

  // The mission marker: a pulsing diamond where Leo has to go.
  const target = world.mission.target;
  if (target && !target.hidden) {
    const tx = target.follow ? target.follow.x : target.x;
    const ty = target.follow ? target.follow.y : target.y;
    const pulse = 1 + 0.25 * Math.sin(t * 5);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(-11, -11, 22, 22);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,210,74,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, 26 + 8 * Math.sin(t * 5), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cars, pedestrians, cops, Leo, particles, the gunshot tracer.
  for (const car of world.cars) {
    if (!inView(camera, viewW, viewH, car.x, car.y, car.l, car.l, 60)) continue;
    drawCar(ctx, car, t);
  }
  for (const ped of world.peds) {
    if (!inView(camera, viewW, viewH, ped.x, ped.y, 20, 20, 40)) continue;
    drawPed(ctx, ped, t);
  }
  for (const cop of world.police) {
    if (!inView(camera, viewW, viewH, cop.x, cop.y, 20, 20, 40)) continue;
    drawCop(ctx, cop, t);
  }
  if (world.player.onFoot) drawPlayerOnFoot(ctx, world.player, t);
  drawParticles(ctx, world);
  if (world.tracer && world.tracer.life > 0) {
    ctx.strokeStyle = `rgba(255,233,160,${world.tracer.life / 0.09})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(world.tracer.x1, world.tracer.y1);
    ctx.lineTo(world.tracer.x2, world.tracer.y2);
    ctx.stroke();
  }
}

function drawPalm(ctx, x, y, sway) {
  ctx.strokeStyle = PALETTE.palmTrunk;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(sway) * 3, y - 14);
  ctx.stroke();
  ctx.fillStyle = PALETTE.palmLeaf;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + sway * 0.2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 9, y - 14 + Math.sin(a) * 6, 10, 4, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A car, drawn top-down: body, roof, windshield, wheels and lights. */
export function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -car.l / 2 + 3, -car.w / 2 + 4, car.l, car.w, 7);
  ctx.fill();
  ctx.fillStyle = car.dead ? '#22252a' : car.color;
  roundRect(ctx, -car.l / 2, -car.w / 2, car.l, car.w, 7);
  ctx.fill();
  // Leo's car gets a white ring, so the player is easy to find in a chase.
  if (car.driver === 'player') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -car.l / 2 - 4, -car.w / 2 - 4, car.l + 8, car.w + 8, 10);
    ctx.stroke();
  }
  if (car.kind === 'police') {
    ctx.fillStyle = PALETTE.policeDoor;
    ctx.fillRect(-6, -car.w / 2, 12, car.w);
    const flash = Math.floor(t * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-4, -car.w / 2 - 1, 8, 6);
    ctx.fillStyle = flash ? '#2a6bff' : '#ff2a2a';
    ctx.fillRect(-4, car.w / 2 - 5, 8, 6);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.fillRect(-car.l / 2 + 6, -car.w / 2 + 3, 10, 4);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(-2, -6, 8, 12);
  }
  // Windshield and roof.
  ctx.fillStyle = 'rgba(20,40,60,0.75)';
  ctx.fillRect(car.l / 2 - 16, -car.w / 2 + 4, 9, car.w - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-8, -car.w / 2 + 5, 16, car.w - 10);
  // Wheels.
  ctx.fillStyle = '#14161a';
  const wy = car.w / 2 - 1;
  ctx.fillRect(car.l / 2 - 14, -wy - 3, 12, 5);
  ctx.fillRect(car.l / 2 - 14, wy - 2, 12, 5);
  ctx.fillRect(-car.l / 2 + 2, -wy - 3, 12, 5);
  ctx.fillRect(-car.l / 2 + 2, wy - 2, 12, 5);
  // Headlights and brake lights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(car.l / 2 - 2, -car.w / 2 + 3, 3, 5);
  ctx.fillRect(car.l / 2 - 2, car.w / 2 - 8, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2a2a' : '#7a1a1a';
  ctx.fillRect(-car.l / 2 - 1, -car.w / 2 + 3, 3, 5);
  ctx.fillRect(-car.l / 2 - 1, car.w / 2 - 8, 3, 5);
  ctx.restore();
  if (car.smoking && !car.dead) {
    ctx.fillStyle = 'rgba(90,90,90,0.5)';
    ctx.beginPath();
    ctx.arc(car.x - Math.cos(car.angle) * car.l / 3, car.y - Math.sin(car.angle) * car.l / 3, 6 + Math.sin(t * 7) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPed(ctx, ped, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(ped.x, ped.y + 8, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = ped.speed > 0 ? Math.sin(t * 10 + ped.id) * 1.5 : 0;
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + bob, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 2, ped.y + Math.sin(ped.angle) * 2 + bob, 5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.downTimer > 0) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ped.x - 8, ped.y - 12);
    ctx.lineTo(ped.x + 8, ped.y + 2);
    ctx.stroke();
  }
  if (ped.kind === 'fare') {
    const wave = Math.sin(ped.wavePhase) * 3;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 22 + wave, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', ped.x, ped.y - 22 + wave);
  }
}

function drawCop(ctx, cop, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cop.x, cop.y + 8, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c3a6e';
  ctx.beginPath();
  ctx.arc(cop.x, cop.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(cop.x + Math.cos(cop.angle) * 2, cop.y + Math.sin(cop.angle) * 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(cop.x - 2, cop.y + 4, 4, 3);
  if (cop.arrestTimer > 0.3) {
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', cop.x, cop.y - 20);
  }
  void t;
}

function drawPlayerOnFoot(ctx, player, t) {
  const p = player;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // White ring so Leo is easy to find in a crowd.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 16 + Math.sin(t * 3) * 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.playerJacket;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 2, p.y + Math.sin(p.angle) * 2, 6, 0, Math.PI * 2);
  ctx.fill();
  // The gun arm points where the mouse points.
  if (p.ammo > 0) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 18, p.y + Math.sin(p.aimAngle) * 18);
    ctx.stroke();
  }
  void PLAYER;
}

function drawParticles(ctx, world) {
  for (const p of world.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The HUD: cash, health, wanted stars, objective, minimap, speed, banner. */
export function drawHUD(ctx, world, viewW, viewH) {
  const player = world.player;
  const stars = world.wanted.stars;
  ctx.textBaseline = 'alphabetic';

  // Cash and health, top left.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  roundRect(ctx, 14, 12, 210, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee081';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${player.money.toLocaleString('en-US')}`, 26, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, 26, 50, 150, 10, 5);
  ctx.fill();
  ctx.fillStyle = player.health > 35 ? '#7ee081' : '#ff5252';
  roundRect(ctx, 26, 50, 150 * Math.max(0, player.health / 100), 10, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(player.health)}   AMMO ${player.ammo}`, 26, 74);

  // Wanted stars, top centre.
  if (stars > 0) {
    const flash = stars >= 3 && Math.floor(world.time * 3) % 2 === 0;
    ctx.fillStyle = flash ? 'rgba(120,10,10,0.6)' : 'rgba(10,14,20,0.55)';
    roundRect(ctx, viewW / 2 - 90, 12, 180, 40, 10);
    ctx.fill();
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < stars ? '#ffd24a' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', viewW / 2 - 64 + i * 32, 40);
    }
  }

  // Objective, bottom centre.
  const target = world.mission.target;
  const mission = world.mission;
  let objective = 'Free roam — find a job, steal a car, explore Solmar';
  if (target) objective = target.label;
  else if (mission.allDone) objective = 'King of Solmar — the city is yours';
  else if (!mission.active && mission.nextStartTimer > 0) objective = 'Next job coming up…';
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = Math.min(viewW - 40, ctx.measureText(objective).width + 44);
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  roundRect(ctx, (viewW - ow) / 2, viewH - 52, ow, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd24a';
  ctx.textAlign = 'center';
  ctx.fillText(objective, viewW / 2, viewH - 29);
  if (target && target.radius > 0) {
    const d = Math.round(distance(player.x, player.y, target.follow ? target.follow.x : target.x, target.follow ? target.follow.y : target.y));
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${d}m`, viewW / 2, viewH - 60);
  }

  // Speed, bottom right, while driving.
  if (player.car) {
    const mph = Math.round(Math.abs(player.car.speed) * 0.14);
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    roundRect(ctx, viewW - 130, viewH - 96, 116, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${mph}`, viewW - 52, viewH - 64);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#bbb';
    ctx.fillText('mph', viewW - 24, viewH - 64);
    if (player.car.health < 40) {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CAR DAMAGED', viewW - 72, viewH - 106);
    }
  }

  // The minimap, top right.
  drawMinimap(ctx, world, viewW - 224, 12, 210, 150);

  // Mission banner, centre.
  if (world.banner && world.banner.timer > 0) {
    const b = world.banner;
    const alpha = Math.min(1, b.timer);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(10,14,20,0.65)';
    const bw = Math.min(viewW - 60, 560);
    roundRect(ctx, (viewW - bw) / 2, 64, bw, 74, 12);
    ctx.fill();
    ctx.fillStyle = b.color || '#ffd24a';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.text, viewW / 2, 96);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(b.sub || '', viewW / 2, 120);
    ctx.globalAlpha = 1;
  }

  // A red edge when Leo is hurt or the heat is on.
  const danger = player.health < 30 ? 0.35 : stars >= 3 ? 0.18 : 0;
  if (danger > 0) {
    const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.42, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.72);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,0,0,${danger})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  // Controls hint, bottom left, fading out as the player learns the game.
  if (world.time < 25 && world.screen === 'play') {
    ctx.globalAlpha = clamp(1 - world.time / 25, 0, 1) * 0.9;
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    roundRect(ctx, 14, viewH - 96, 250, 84, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WASD move / drive    Shift run', 26, viewH - 72);
    ctx.fillText('E enter car / pick up fare', 26, viewH - 54);
    ctx.fillText('Space punch / handbrake', 26, viewH - 36);
    ctx.fillText('Click shoot    P pause    M mute', 26, viewH - 18);
    ctx.globalAlpha = 1;
  }
}

/** The minimap: the whole city small, with Leo, the objective and the cops. */
export function drawMinimap(ctx, world, x, y, w, h) {
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 6);
  ctx.clip();
  ctx.fillStyle = '#5d9b4e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2fa8b8';
  ctx.fillRect(x, y + WATER_Y * sy, w, h - WATER_Y * sy);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(x, y + BEACH_Y * sy, w, (WATER_Y - BEACH_Y) * sy);
  ctx.strokeStyle = '#3d4450';
  ctx.lineWidth = 2;
  for (const rx of ROADS_V) {
    ctx.beginPath();
    ctx.moveTo(x + rx * sx, y);
    ctx.lineTo(x + rx * sx, y + h);
    ctx.stroke();
  }
  for (const ry of ROADS_H) {
    ctx.beginPath();
    ctx.moveTo(x, y + ry * sy);
    ctx.lineTo(x + w, y + ry * sy);
    ctx.stroke();
  }
  const dot = (wx, wy, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const stash of world.stashes) if (!stash.found) dot(stash.x, stash.y, '#ffd24a', 2);
  for (const ped of world.peds) if (ped.kind === 'fare') dot(ped.x, ped.y, '#7ee081', 3);
  for (const car of world.cars) if (car.driver === 'police' && !car.dead) dot(car.x, car.y, '#ff5252', 3);
  for (const cop of world.police) dot(cop.x, cop.y, '#ff5252', 2);
  const target = world.mission.target;
  if (target && !target.hidden) {
    const tx = target.follow ? target.follow.x : target.x;
    const ty = target.follow ? target.follow.y : target.y;
    const pulse = 3 + Math.sin(world.time * 5) * 1.5;
    dot(tx, ty, '#ffd24a', pulse);
  }
  // Leo, as a white arrow.
  ctx.save();
  ctx.translate(x + world.player.x * sx, y + world.player.y * sy);
  ctx.rotate(world.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR CITY', x, y + h + 16);
}
