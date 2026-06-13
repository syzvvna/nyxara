// ============================================================
// NYXARA — math utilities
// ============================================================

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeIn(t) {
  return t * t * t;
}

export function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Projects a point on the ground plane (worldX, worldZ) seen from an eye at
 * the origin (height 1.7m) yawed by camAngle, onto a W×H screen.
 * Returns { sx, sy, scale, dist } or null when the point is behind the camera.
 * FOV is the vertical field of view in radians.
 */
export function project3Dto2D(worldX, worldZ, camAngle, W, H, FOV) {
  const cos = Math.cos(camAngle);
  const sin = Math.sin(camAngle);

  // rotate the world into camera space (camera looks down -z)
  const cx = worldX * cos - worldZ * sin;
  const cz = worldX * sin + worldZ * cos;
  const depth = -cz;

  if (depth <= 0.1) return null;

  const f = (H * 0.5) / Math.tan(FOV * 0.5);
  const sx = W * 0.5 + (cx / depth) * f;
  const sy = H * 0.5 + (1.7 / depth) * f; // ground sits below the horizon line
  const scale = f / depth;
  const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);

  return { sx, sy, scale, dist };
}

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
