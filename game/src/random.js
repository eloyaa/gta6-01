// Deterministic random numbers: the same seed always builds the same city,
// the same traffic and the same pedestrians, so a screenshot scene replays.
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from a random function. */
export function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Float in [min, max) from a random function. */
export function floatBetween(rng, min, max) {
  return min + rng() * (max - min);
}

/** One element of an array, picked by a random function. */
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

/** Fisher-Yates shuffle that returns a new array. */
export function shuffled(rng, array) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
