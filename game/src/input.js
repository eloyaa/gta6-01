// Keyboard and mouse state: held keys, just-pressed edges, and the mouse
// position in screen and world coordinates. The game reads this, never the DOM.
import { KEYS } from './config.js';

function matches(list, code) {
  return list.indexOf(code) !== -1;
}

/** Create the input state and wire it to the window's events. */
export function createInput(canvas) {
  const input = {
    held: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
    wheel: 0,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    input.held.add(event.code);
    input.pressed.add(event.code);
    if (matches(KEYS.handbrake, event.code) || matches(KEYS.up, event.code) || matches(KEYS.down, event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    input.held.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    input.mouseDown = true;
    input.mousePressed = true;
    onMouseMove(event);
  }
  function onMouseUp() {
    input.mouseDown = false;
  }
  function onBlur() {
    input.held.clear();
    input.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return input;
}

/** True while any key in the list is held. */
export function keyHeld(input, list) {
  for (const code of list) if (input.held.has(code)) return true;
  return false;
}

/** True only on the frame the key went down. */
export function keyPressed(input, list) {
  for (const code of list) if (input.pressed.has(code)) return true;
  return false;
}

/** Clear the per-frame edges; call once per update, after the game has read them. */
export function endFrame(input) {
  input.pressed.clear();
  input.mousePressed = false;
  input.wheel = 0;
}
