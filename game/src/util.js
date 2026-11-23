// Small geometry helpers shared by every system: angles, clamping, and the
// circle-vs-rectangle push-out that keeps cars and people out of buildings.
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Shortest signed turn from angle `from` toward angle `to`, in (-PI, PI]. */
export function angleDifference(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Move `angle` toward `target` by at most `maxStep` radians. */
export function turnToward(angle, target, maxStep) {
  const d = angleDifference(angle, target);
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}

/**
 * Push a circle (x, y, radius) out of an axis-aligned rectangle. Returns true
 * when a push happened; the circle's x/y are updated in place.
 */
export function pushCircleOutOfRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= circle.radius * circle.radius) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    circle.x = nearestX + (dx / d) * circle.radius;
    circle.y = nearestY + (dy / d) * circle.radius;
  } else {
    // Centre is inside the rectangle: push out along the smallest exit.
    const left = circle.x - rect.x;
    const right = rect.x + rect.w - circle.x;
    const top = circle.y - rect.y;
    const bottom = rect.y + rect.h - circle.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) circle.x = rect.x - circle.radius;
    else if (min === right) circle.x = rect.x + rect.w + circle.radius;
    else if (min === top) circle.y = rect.y - circle.radius;
    else circle.y = rect.y + rect.h + circle.radius;
  }
  return true;
}

/** True when the point is inside the rectangle (with an optional margin). */
export function pointInRect(x, y, rect, margin = 0) {
  return x >= rect.x - margin && x <= rect.x + rect.w + margin && y >= rect.y - margin && y <= rect.y + rect.h + margin;
}
