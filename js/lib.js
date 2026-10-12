// Pure helpers shared by the page and the test suite. No DOM access in here.

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const lerp = (a, b, t) => a + (b - a) * t;

// Wraps v into [min, max). Used by the marquee so the track loops seamlessly.
export function wrap(v, min, max) {
  const span = max - min;
  if (span <= 0) return min;
  return ((((v - min) % span) + span) % span) + min;
}

// Where the hover guide sits relative to the cursor. It prefers the right side,
// flips left when it would run off-screen, and always stays inside the margin.
export function placeGuide({ x, y, w, h, vw, vh, gap = 28, margin = 16 }) {
  let side = 'right';
  let left = x + gap;
  if (left + w > vw - margin) {
    side = 'left';
    left = x - gap - w;
  }
  left = clamp(left, margin, Math.max(margin, vw - margin - w));
  const top = clamp(y - h * 0.3, margin, Math.max(margin, vh - margin - h));
  return { left, top, side };
}

// CSS object-fit: cover, expressed as UV scale + offset so a shader can sample
// the image the same way. focusX/focusY follow object-position (0..1, from top-left).
// Returned offsets are in GL texture space (origin bottom-left).
export function coverFit(cw, ch, iw, ih, focusX = 0.5, focusY = 0.5) {
  const rc = cw / ch;
  const ri = iw / ih;
  const sx = rc > ri ? 1 : rc / ri;
  const sy = rc > ri ? ri / rc : 1;
  return {
    sx,
    sy,
    ox: (1 - sx) * focusX,
    oy: (1 - sy) * (1 - focusY),
  };
}

// Maps loading progress (0..1) to the loader's whole-number readout.
export const percent = (p) => Math.round(clamp(p, 0, 1) * 100);

// The pass the ball is on: the last player whose possession point the scroll has
// passed (`from`) and the next one (`to`). `starts` must be ascending.
export function passAt(scroll, starts) {
  const n = starts.length;
  if (n === 0) return { from: -1, to: -1 };
  if (n === 1 || scroll <= starts[0]) return { from: 0, to: Math.min(1, n - 1) };
  if (scroll >= starts[n - 1]) return { from: n - 2, to: n - 1 };
  let i = 0;
  while (i < n - 2 && scroll >= starts[i + 1]) i++;
  return { from: i, to: i + 1 };
}

// How far through the pass the ball is (0..1, eased). The ball stays with the
// passer and only travels during the last `window` px before the receiver's
// possession point, so it is never kicked toward someone still off-screen.
export function kickProgress(scroll, fromStart, toStart, window) {
  const span = toStart - fromStart;
  if (span <= 0) return 1;
  const begin = toStart - Math.min(window, span * 0.75);
  const x = clamp((scroll - begin) / (toStart - begin), 0, 1);
  return x * x * (3 - 2 * x);
}

// A point on a curved pass from a to b. `lift` peaks mid-flight and scales with
// distance, so short touches stay on the ground and long balls get air.
export function passPoint(a, b, p, bend = 0.18) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const cx = (a.x + b.x) / 2 + (dist ? -dy / dist : 0) * dist * bend;
  const cy = (a.y + b.y) / 2 + (dist ? dx / dist : 0) * dist * bend;
  const q = 1 - p;
  return {
    x: q * q * a.x + 2 * q * p * cx + p * p * b.x,
    y: q * q * a.y + 2 * q * p * cy + p * p * b.y,
    cx,
    cy,
    lift: Math.sin(Math.PI * p) * Math.min(1, dist / 500),
  };
}
