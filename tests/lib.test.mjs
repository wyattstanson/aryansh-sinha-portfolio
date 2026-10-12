import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, wrap, placeGuide, coverFit, percent } from '../js/lib.js';

test('clamp keeps values inside the range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(42, 0, 10), 10);
});

test('wrap loops values into [min, max)', () => {
  assert.equal(wrap(0, -100, 0), -100);
  assert.equal(wrap(-150, -100, 0), -50);
  assert.equal(wrap(30, -100, 0), -70);
  assert.equal(wrap(5, 3, 3), 3);
});

test('placeGuide sits to the right of the cursor when there is room', () => {
  const p = placeGuide({ x: 200, y: 400, w: 360, h: 300, vw: 1440, vh: 900 });
  assert.equal(p.side, 'right');
  assert.equal(p.left, 228);
  assert.equal(p.top, 310);
});

test('placeGuide flips left near the right edge', () => {
  const p = placeGuide({ x: 1300, y: 400, w: 360, h: 300, vw: 1440, vh: 900 });
  assert.equal(p.side, 'left');
  assert.equal(p.left, 1300 - 28 - 360);
});

test('placeGuide never leaves the viewport margins', () => {
  const top = placeGuide({ x: 600, y: 5, w: 360, h: 500, vw: 1440, vh: 900 });
  assert.equal(top.top, 16);
  const bottom = placeGuide({ x: 600, y: 890, w: 360, h: 500, vw: 1440, vh: 900 });
  assert.equal(bottom.top, 900 - 16 - 500);
  const narrow = placeGuide({ x: 150, y: 300, w: 360, h: 300, vw: 375, vh: 812 });
  assert.ok(narrow.left >= 16);
});

test('coverFit matches object-fit: cover for wide and tall canvases', () => {
  const wide = coverFit(1600, 800, 1000, 1000, 0.5, 0.5);
  assert.equal(wide.sx, 1);
  assert.equal(wide.sy, 0.5);
  assert.equal(wide.oy, 0.25);

  const tall = coverFit(400, 800, 1000, 1000, 0.5, 0.5);
  assert.equal(tall.sx, 0.5);
  assert.equal(tall.sy, 1);
  assert.equal(tall.ox, 0.25);
});

test('coverFit focus near the top keeps the top of the image visible', () => {
  const f = coverFit(1600, 800, 1000, 1000, 0.5, 0);
  assert.equal(f.oy, 0.5);
  const g = coverFit(1600, 800, 1000, 1000, 0.5, 1);
  assert.equal(g.oy, 0);
});

test('percent rounds and clamps loader progress', () => {
  assert.equal(percent(0), 0);
  assert.equal(percent(0.505), 51);
  assert.equal(percent(2), 100);
  assert.equal(percent(-1), 0);
});

test('passAt finds the current pass between possession points', async () => {
  const { passAt } = await import('../js/lib.js');
  const starts = [0, 500, 1200, 2000];
  assert.deepEqual(passAt(-50, starts), { from: 0, to: 1 });
  assert.deepEqual(passAt(0, starts), { from: 0, to: 1 });
  assert.deepEqual(passAt(700, starts), { from: 1, to: 2 });
  assert.deepEqual(passAt(1200, starts), { from: 2, to: 3 });
  assert.deepEqual(passAt(9999, starts), { from: 2, to: 3 });
  assert.deepEqual(passAt(10, [0]), { from: 0, to: 0 });
  assert.deepEqual(passAt(10, []), { from: -1, to: -1 });
});

test('kickProgress holds the ball, then travels inside the window', async () => {
  const { kickProgress } = await import('../js/lib.js');
  assert.equal(kickProgress(0, 0, 1000, 400), 0);
  assert.equal(kickProgress(600, 0, 1000, 400), 0);
  assert.equal(kickProgress(800, 0, 1000, 400), 0.5);
  assert.equal(kickProgress(1000, 0, 1000, 400), 1);
  // a short gap uses at most 75% of it for the pass
  assert.equal(kickProgress(25, 0, 100, 400), 0);
  assert.equal(kickProgress(100, 0, 100, 400), 1);
  assert.equal(kickProgress(5, 10, 10, 400), 1);
  let prev = -1;
  for (let s = 0; s <= 1000; s += 50) {
    const p = kickProgress(s, 0, 1000, 400);
    assert.ok(p >= prev);
    prev = p;
  }
});

test('passPoint starts and ends on the players and lifts mid-flight', async () => {
  const { passPoint } = await import('../js/lib.js');
  const a = { x: 100, y: 100 };
  const b = { x: 700, y: 500 };
  const s = passPoint(a, b, 0);
  const e = passPoint(a, b, 1);
  assert.ok(Math.abs(s.x - 100) < 1e-9 && Math.abs(s.y - 100) < 1e-9);
  assert.ok(Math.abs(e.x - 700) < 1e-9 && Math.abs(e.y - 500) < 1e-9);
  assert.ok(Math.abs(s.lift) < 1e-9 && Math.abs(e.lift) < 1e-9);
  assert.equal(passPoint(a, b, 0.5).lift, 1);
  assert.ok(passPoint(a, { x: 150, y: 100 }, 0.5).lift < 0.2);
  const same = passPoint(a, a, 0.5);
  assert.equal(same.x, 100);
  assert.equal(same.lift, 0);
});
