// Particles: smoke, sparks, explosions, skid marks and pickup sparkles.
// Every system pushes particles into world.particles; the renderer draws them.
export function addParticle(world, particle) {
  world.particles.push({
    x: 0, y: 0, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 3, color: '#ffffff', kind: 'dot', ...particle,
  });
  if (world.particles.length > 600) world.particles.splice(0, world.particles.length - 600);
}

export function spawnSmoke(world, x, y, count = 6) {
  for (let i = 0; i < count; i += 1) {
    addParticle(world, {
      x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30,
      life: 0.9, maxLife: 0.9, size: 6 + Math.random() * 6, color: '#5a5a5a', kind: 'smoke',
    });
  }
}

export function spawnSparks(world, x, y, count = 10) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 160;
    addParticle(world, {
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 0.35, maxLife: 0.35, size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? '#ffd24a' : '#ff7a1a', kind: 'spark',
    });
  }
}

export function spawnExplosion(world, x, y) {
  for (let i = 0; i < 26; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 220;
    addParticle(world, {
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 0.6 + Math.random() * 0.5, maxLife: 1.1, size: 5 + Math.random() * 9,
      color: ['#ff7a1a', '#ffd24a', '#e5534b', '#5a5a5a'][i % 4], kind: 'fire',
    });
  }
  spawnSmoke(world, x, y, 10);
}

export function spawnSkid(world, x, y, angle) {
  world.skids.push({ x, y, angle, life: 4 });
  if (world.skids.length > 240) world.skids.splice(0, world.skids.length - 240);
}

export function spawnPickupSparkle(world, x, y) {
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    addParticle(world, {
      x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 20,
      life: 0.5, maxLife: 0.5, size: 3, color: '#ffd24a', kind: 'spark',
    });
  }
}

/** Advance particles and skid marks; call once per step. */
export function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      world.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    if (p.kind === 'smoke') p.size += 14 * dt;
  }
  for (let i = world.skids.length - 1; i >= 0; i -= 1) {
    world.skids[i].life -= dt;
    if (world.skids[i].life <= 0) world.skids.splice(i, 1);
  }
}
