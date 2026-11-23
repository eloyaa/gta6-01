// Save and load through localStorage: cash, story progress, stashes, and
// where Leo was standing. The wanted level and police never survive a save.
import { SAVE_KEY } from './config.js';

/** The save shape, with defaults for a fresh game. */
export function defaultSave() {
  return {
    money: 0,
    missionIndex: 0,
    stashesFound: [],
    health: 100,
    ammo: 24,
    x: 1280,
    y: 1460,
    totalEarned: 0,
    faresDone: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return { ...defaultSave(), ...data };
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private mode or a full store: the game still plays, it just forgets.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to forget.
  }
}
