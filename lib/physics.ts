// Thin helpers around Matter.js usage. Kept tiny — GameCanvas owns the loop.
export const WORLD = { width: 1200, height: 640, groundY: 600 };
export const SLING = { x: 220, y: 480, range: 110 };

export function launchVector(dragX: number, dragY: number, power: number) {
  const dx = SLING.x - dragX;
  const dy = SLING.y - dragY;
  const len = Math.hypot(dx, dy) || 1;
  const scale = power * 0.30;
  return { vx: dx * scale, vy: dy * scale, angle: Math.atan2(-dy, dx), magnitude: len };
}
