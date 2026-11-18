// Tileable value noise + fbm used by the procedural texture generators.
function ihash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
/** Value noise, wraps every `period` lattice cells so textures tile seamlessly. */
export function vnoise(x, y, period, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const wx0 = ((x0 % period) + period) % period, wx1 = (wx0 + 1) % period;
  const wy0 = ((y0 % period) + period) % period, wy1 = (wy0 + 1) % period;
  const a = ihash(wx0, wy0, seed), b = ihash(wx1, wy0, seed), c = ihash(wx0, wy1, seed), d = ihash(wx1, wy1, seed);
  const u = fade(fx), v = fade(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fbm in [0,1]; `u`,`v` in [0,1) texture space; base frequency `freq` cells across. */
export function fbm(u, v, freq, oct = 4, seed = 0, gain = 0.5) {
  let amp = 0.5, sum = 0, norm = 0, f = freq;
  for (let o = 0; o < oct; o++) {
    sum += amp * vnoise(u * f, v * f, f, seed + o * 17);
    norm += amp; amp *= gain; f *= 2;
  }
  return sum / norm;
}
export const ridged = (u, v, freq, oct, seed) => 1 - Math.abs(fbm(u, v, freq, oct, seed) * 2 - 1);
export { ihash };
