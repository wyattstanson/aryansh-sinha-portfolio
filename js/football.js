import { clamp, passAt, kickProgress, passPoint } from './lib.js';

// The ball is passed between [data-player] anchors as the page scrolls. Each
// anchor gets a ScrollTrigger whose start is its "possession point"; the ball
// holds with the passer and flies to the receiver as the receiver arrives.

const BALL_R = 15;

export function initBall({ gsap, ScrollTrigger, getPan }) {
  const fx = document.querySelector('.pitch-fx');
  const ball = fx.querySelector('.ball');
  const shadow = fx.querySelector('.ball-shadow');
  const line = fx.querySelector('.pass-line path');
  let players = [];
  let builtWithPan = null;
  let holder = -1;
  let rot = 0;
  let last = null;
  let time = 0;

  function build() {
    players.forEach((p) => p.st?.kill());
    const pan = getPan();
    builtWithPan = Boolean(pan);
    players = [...document.querySelectorAll('[data-player]')]
      .filter((el) => pan || !el.hasAttribute('data-pan'))
      .map((el) => {
        // anything inside the gallery track moves sideways while it is pinned
        const inPan = Boolean(pan && el.closest('[data-more-track]'));
        const st = inPan ? null : ScrollTrigger.create({ trigger: el, start: 'center 58%' });
        return { el, st, inPan, panStart: 0, kind: el.dataset.anchor || 'player' };
      });
    measurePan();
    holder = -1;
  }

  // Items inside the horizontal gallery: work out the page scroll at which each
  // reaches 62% of the viewport width, from the pan's own scroll range.
  function measurePan() {
    const pan = getPan();
    if (!pan) return;
    const st = pan.scrollTrigger;
    const track = pan.targets()[0];
    const x = Number(gsap.getProperty(track, 'x')) || 0;
    for (const p of players) {
      if (!p.inPan) continue;
      const r = p.el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - x;
      p.panStart = clamp(st.start + (cx - window.innerWidth * 0.62), st.start, st.end);
    }
  }

  const startOf = (p) => (p.inPan ? p.panStart : p.st.start);

  // Where the ball sits relative to an anchor, kept inside the viewport so a
  // long pass stays visible even when one end has scrolled away.
  function spot(p) {
    const r = p.el.getBoundingClientRect();
    let x = r.left + r.width / 2;
    let y = r.top + r.height / 2;
    if (p.kind === 'player') {
      x += r.width / 2 + 4;
      y += r.height / 2 - 4;
    } else if (p.kind === 'goal') {
      y += r.height * 0.15;
    } else if (p.kind === 'cone') {
      x += 20;
      y += 2;
    }
    return { x: clamp(x, 28, window.innerWidth - 28), y: clamp(y, 84, window.innerHeight - 28) };
  }

  function tick(_t, dt) {
    if (!players.length) return;
    time += dt / 1000;
    const scroll = window.scrollY;
    const sorted = players.slice().sort((a, b) => startOf(a) - startOf(b));
    const starts = sorted.map(startOf);
    const { from, to } = passAt(scroll, starts);
    const A = sorted[from];
    const B = sorted[to];
    const p = from === to ? 1 : kickProgress(scroll, starts[from], starts[to], window.innerHeight * 0.45);
    const a = spot(A);
    const b = spot(B);
    const pt = passPoint(a, b, p, (from % 2 ? 1 : -1) * 0.16);

    const resting = p <= 0.001 || p >= 0.999;
    const bob = resting ? Math.abs(Math.sin(time * 2.4)) * -2.5 : 0;
    const x = pt.x;
    const y = pt.y - pt.lift * 48 + bob;
    if (last) {
      const d = Math.hypot(x - last.x, y - last.y);
      if (d < 400) rot += (d / BALL_R) * 57.3 * (x >= last.x ? 1 : -1);
    }
    last = { x, y };

    ball.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${1 + pt.lift * 0.55})`;
    shadow.style.transform = `translate(${pt.x}px, ${pt.y + BALL_R * 0.85}px) scale(${1 - pt.lift * 0.5})`;
    shadow.style.opacity = String(0.6 - pt.lift * 0.4);

    if (!resting) {
      line.setAttribute('d', `M${a.x},${a.y} Q${pt.cx},${pt.cy} ${b.x},${b.y}`);
      line.style.strokeDasharray = `${p} 1`;
    }
    fx.classList.toggle('is-passing', !resting);

    const now = p >= 0.999 ? sorted[to] : sorted[from];
    const idx = players.indexOf(now);
    if (idx !== holder) {
      players[holder]?.el.classList.remove('has-ball');
      now.el.classList.add('has-ball');
      holder = idx;
    }
  }

  build();
  ScrollTrigger.addEventListener('refresh', () => {
    if (Boolean(getPan()) !== builtWithPan) build();
    else measurePan();
  });
  gsap.ticker.add(tick);
}

// A small ball replaces the pointer and rolls with the mouse; a ring trails it
// and grows over anything clickable.
export function initCursor({ gsap, reduced }) {
  const el = document.querySelector('.cursor');
  const ring = el.querySelector('.cursor-ring');
  const label = el.querySelector('.cursor-label');
  const ballEl = el.querySelector('.cursor-ball');
  document.documentElement.classList.add('has-cursor');

  let x = -100;
  let y = -100;
  let rx = -100;
  let ry = -100;
  let rot = 0;
  let lastX = null;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX;
    y = e.clientY;
    if (!el.classList.contains('is-on')) {
      rx = x;
      ry = y;
      lastX = x;
      el.classList.add('is-on');
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => el.classList.remove('is-on'));
  window.addEventListener('pointerdown', () => el.classList.add('is-down'));
  window.addEventListener('pointerup', () => el.classList.remove('is-down'));

  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('a, button, [data-guide], [data-cursor]');
    el.classList.toggle('is-hover', Boolean(t));
    label.textContent = t ? t.dataset.cursor || (t.matches('[data-guide]') ? 'Open' : '') : '';
  });

  const tick = () => {
    const k = reduced ? 1 : 0.2;
    rx += (x - rx) * k;
    ry += (y - ry) * k;
    if (lastX !== null && !reduced) rot += (x - lastX) * 2.4;
    lastX = x;
    ballEl.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
  };
  if (gsap) gsap.ticker.add(tick);
  else (function loop() { tick(); requestAnimationFrame(loop); })();
}
