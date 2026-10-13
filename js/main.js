import { SOCIALS, PROJECTS, MORE, BENCH } from './data.js';
import { clamp, wrap, placeGuide, percent } from './lib.js';
import { createHero } from './hero-gl.js';
import { initBall, initCursor } from './football.js';

const root = document.documentElement;
const reduced = !root.classList.contains('motion');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const { gsap, ScrollTrigger, SplitText, Lenis } = window;
const animated = !reduced && Boolean(gsap && ScrollTrigger && SplitText);

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const PROJECT_BY_ID = new Map([...PROJECTS, ...MORE].map((p) => [p.id, p]));

let lenis = null;
let hero = null;
let panTween = null;
const scroll = { velocity: 0, direction: 1 };

// small DOM builder so project content never goes through innerHTML
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

function icon(name, cls) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  if (cls) svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

const extLink = (href, label, cls = 'pill') =>
  h('a', { class: cls, href, target: '_blank', rel: 'noopener' }, label, icon('arrow'));

/* content */

function fillSocials() {
  for (const a of $$('[data-social]')) {
    const href = SOCIALS[a.dataset.social];
    if (href) a.href = href;
  }
}

function renderWork() {
  const list = $('[data-work-list]');
  $('#work-title .count').textContent = String(PROJECTS.length);
  list.replaceChildren(
    ...PROJECTS.map((p) => {
      const panelId = `panel-${p.id}`;
      return h('li', { class: 'work-row', 'data-id': p.id },
        h('a', {
          class: 'work-link',
          href: p.code,
          target: '_blank',
          rel: 'noopener',
          'data-guide': p.id,
          'data-primary': 'code',
          'aria-describedby': panelId,
          'aria-expanded': finePointer ? null : 'false',
          'aria-controls': finePointer ? null : panelId,
        },
          h('span', { class: 'work-no', 'aria-hidden': 'true' }, p.no),
          h('span', { class: 'work-name' }, p.name),
          h('span', { class: 'work-meta' },
            h('span', { class: 'work-line' }, p.line),
            h('span', { class: 'work-year' }, p.year)),
          icon('arrow', 'work-arrow')),
        h('div', { class: 'work-panel', id: panelId },
          h('div', null,
            h('div', { class: 'panel-body' },
              p.shot ? h('img', { src: p.shot, alt: `${p.name} screenshot`, loading: 'lazy', width: 1200, height: 750 }) : null,
              h('p', { class: 'panel-what' }, p.what),
              h('ol', { class: 'panel-steps' }, p.steps.map((s) => h('li', null, s))),
              p.metric ? h('p', { class: 'panel-metric' }, p.metric) : null,
              h('div', { class: 'panel-links' },
                extLink(p.code, 'Code on GitHub'),
                p.live ? extLink(p.live, 'Live site') : null)))));
    }),
  );
}

function renderMore() {
  const track = $('[data-more-track]');
  track.append(
    ...MORE.map((p) =>
      h('article', { class: 'more-card', 'data-guide': p.id, 'data-primary': 'live' },
        h('span', { class: 'cone', 'data-player': '', 'data-pan': '', 'data-anchor': 'cone', 'aria-hidden': 'true' }),
        h('div', { class: 'more-shot' },
          h('img', { src: p.shot, alt: `${p.name} screenshot`, loading: 'lazy', width: 1200, height: 750 })),
        h('div', { class: 'more-body' },
          h('h3', { class: 'more-name' },
            h('a', { href: p.live, target: '_blank', rel: 'noopener' }, p.name)),
          h('p', { class: 'more-kind' }, p.kind),
          h('p', { class: 'more-what' }, p.what),
          h('div', { class: 'more-links' },
            extLink(p.live, 'Live', 'text-link'),
            extLink(p.code, 'Code', 'text-link'))))),
  );
}

function renderBench() {
  $('[data-bench]').replaceChildren(
    ...BENCH.map((p) =>
      h('article', { class: 'bench-card' },
        h('p', { class: 'bench-no', 'aria-hidden': 'true' }, p.no),
        h('h3', { class: 'bench-name' },
          h('a', { href: p.code, target: '_blank', rel: 'noopener' }, p.name)),
        h('p', { class: 'bench-what' }, p.what),
        h('ul', { class: 'bench-stack' }, p.stack.map((s) => h('li', null, s))),
        h('span', { class: 'bench-link', 'aria-hidden': 'true' }, 'Code', icon('arrow')))),
  );
}

// The nav sits on the photo until the about sheet covers it, then takes the page colours.
function initNavTone() {
  const nav = $('.nav');
  const sentinel = $('.nav-sentinel');
  new IntersectionObserver(([e]) => {
    nav.classList.toggle('on-hero', e.boundingClientRect.top > 40);
  }, { threshold: [0, 1] }).observe(sentinel);
}

/* small interactions */

function initTheme() {
  const btn = $('.theme-toggle');
  const meta = $('meta[name="theme-color"]');
  const sync = () => {
    const light = root.dataset.theme === 'light';
    btn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    meta.setAttribute('content', light ? '#f7fbfe' : '#0d1530');
  };
  sync();
  btn.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', root.dataset.theme); } catch { /* private mode */ }
    sync();
  });
}

function initCopy() {
  const btn = $('.copy-btn');
  const label = $('.copy-label', btn);
  const status = $('[data-copy-status]');
  let timer = 0;
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    }
    btn.classList.toggle('is-done', ok);
    label.textContent = ok ? 'Copied' : 'Copy failed';
    status.textContent = ok ? 'Email address copied' : 'Could not copy. Select the address instead.';
    clearTimeout(timer);
    timer = setTimeout(() => {
      btn.classList.remove('is-done');
      label.textContent = 'Copy';
      status.textContent = '';
    }, 2200);
  });
}

function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else {
    const el = typeof target === 'number' ? null : target;
    window.scrollTo({ top: el ? el.getBoundingClientRect().top + window.scrollY : target, behavior: reduced ? 'auto' : 'smooth' });
  }
}

function initMenu() {
  const btn = $('.menu-btn');
  const menu = $('#menu');
  const links = $$('.menu-links a', menu);
  let open = false;

  const set = (next, { restoreFocus = true } = {}) => {
    open = next;
    btn.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    if (open) {
      lenis?.stop();
      if (animated) {
        gsap.fromTo(links, { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.06, ease: 'expo.out', delay: 0.25 });
        gsap.fromTo('.menu-foot', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.5, ease: 'power3.out' });
      }
      setTimeout(() => links[0].focus({ preventScroll: true }), 300);
    } else {
      lenis?.start();
      if (restoreFocus) btn.focus({ preventScroll: true });
    }
  };

  btn.addEventListener('click', () => set(!open));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) set(false); });
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-scroll]');
    if (!a) return;
    e.preventDefault();
    const target = $(a.getAttribute('href'));
    set(false, { restoreFocus: false });
    setTimeout(() => scrollToTarget(target), 350);
  });
}

function initAnchors() {
  $('.nav-logo').addEventListener('click', (e) => { e.preventDefault(); scrollToTarget(0); });
  $('.to-top').addEventListener('click', () => scrollToTarget(0));
}

// Scales the footer name so it spans the content width exactly.
function fitGiant() {
  const el = $('.contact-giant');
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize);
  const range = document.createRange();
  range.selectNodeContents(el);
  const textWidth = range.getBoundingClientRect().width;
  if (!textWidth) return;
  el.style.fontSize = `${base * clamp(el.clientWidth / textWidth, 0.4, 1.6) * 0.97}px`;
}

/* work rows on touch screens: tap to expand the walkthrough */

function initTouchPanels() {
  if (finePointer) return;
  let refreshTimer = 0;
  $('[data-work-list]').addEventListener('click', (e) => {
    const link = e.target.closest('.work-link');
    if (!link) return;
    e.preventDefault();
    const row = link.closest('.work-row');
    const open = !row.classList.contains('is-open');
    row.classList.toggle('is-open', open);
    link.setAttribute('aria-expanded', String(open));
    if (animated) {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 650);
    }
  });
}

/* the hover guide */

function initGuide() {
  if (!finePointer) return;
  const el = $('.guide');
  const inner = $('.guide-inner', el);
  const img = $('.guide-shot img', el);
  const kind = $('.guide-kind', el);
  const name = $('.guide-name', el);
  const what = $('.guide-what', el);
  const steps = $('.guide-steps', el);
  const metric = $('.guide-metric', el);
  const stack = $('.guide-stack', el);
  const cta = $('.guide-cta', el);

  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let active = null;
  let shown = false;
  let stepIdx = 0;
  let stepTimer = 0;
  let size = { w: 372, h: 480 };

  const moveX = animated ? gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' }) : null;
  const moveY = animated ? gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' }) : null;

  function place(jump = false) {
    const p = placeGuide({ ...pointer, w: size.w, h: size.h, vw: window.innerWidth, vh: window.innerHeight, gap: 48 });
    if (animated) {
      moveX(p.left, jump ? p.left : undefined);
      moveY(p.top, jump ? p.top : undefined);
    } else {
      el.style.transform = `translate(${p.left}px, ${p.top}px)`;
    }
  }

  function setStep(i) {
    stepIdx = i;
    $$('li', steps).forEach((li, n) => li.classList.toggle('is-active', reduced || n === i));
  }

  function fill(target) {
    const p = PROJECT_BY_ID.get(target.dataset.guide);
    if (!p) return;
    el.classList.toggle('no-shot', !p.shot);
    if (p.shot) img.src = p.shot;
    kind.textContent = p.kind;
    name.textContent = p.name;
    what.textContent = p.what;
    steps.replaceChildren(...p.steps.map((s) => h('li', null, s)));
    metric.textContent = p.metric || '';
    stack.replaceChildren(...p.stack.map((s) => h('li', null, s)));
    cta.textContent = target.dataset.primary === 'live' ? 'Click to open the live site' : 'Click to open the code on GitHub';
    setStep(0);
    clearInterval(stepTimer);
    if (!reduced) stepTimer = setInterval(() => setStep((stepIdx + 1) % p.steps.length), 1300);
    size = { w: el.offsetWidth, h: el.offsetHeight };
  }

  function show(target, viaKeyboard = false) {
    if (target === active) return;
    const swapping = shown;
    active = target;
    if (viaKeyboard) {
      const r = target.getBoundingClientRect();
      pointer.x = Math.min(r.right - 40, r.left + r.width * 0.55);
      pointer.y = r.top + r.height / 2;
    }
    el.style.visibility = 'visible';
    if (animated && swapping) {
      gsap.timeline()
        .to(inner, { opacity: 0, y: 6, duration: 0.12, ease: 'power2.in' })
        .add(() => { fill(target); place(); })
        .to(inner, { opacity: 1, y: 0, duration: 0.35, ease: 'expo.out' });
    } else {
      fill(target);
      place(true);
    }
    if (!shown) {
      shown = true;
      if (animated) {
        gsap.killTweensOf(inner, 'clipPath');
        gsap.fromTo(inner, { clipPath: 'inset(0% 0% 100% 0% round 18px)', opacity: 1, y: 0 },
          { clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 0.7, ease: 'expo.out' });
      } else {
        inner.style.clipPath = 'none';
      }
    }
  }

  function hide() {
    if (!shown) return;
    shown = false;
    active = null;
    clearInterval(stepTimer);
    if (animated) {
      gsap.to(inner, {
        clipPath: 'inset(0% 0% 100% 0% round 18px)',
        duration: 0.45,
        ease: 'power3.in',
        onComplete: () => { if (!shown) el.style.visibility = 'hidden'; },
      });
    } else {
      el.style.visibility = 'hidden';
    }
  }

  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (shown) place();
  }, { passive: true });

  let pointerSeen = false;
  const track = (target) => {
    if (target) show(target);
    else hide();
  };
  document.addEventListener('mouseover', (e) => {
    pointerSeen = true;
    track(e.target.closest('[data-guide]'));
  });

  // Content slides under a still cursor while scrolling (the horizontal gallery
  // especially), which fires no mouse events, so hit-test each frame instead.
  if (animated) {
    gsap.ticker.add(() => {
      if (!pointerSeen || scroll.velocity === 0) return;
      const hit = document.elementFromPoint(pointer.x, pointer.y);
      track(hit ? hit.closest('[data-guide]') : null);
    });
  }
  document.documentElement.addEventListener('mouseleave', hide);
  document.addEventListener('focusin', (e) => {
    const target = e.target.closest('[data-guide]');
    if (target && target.matches(':focus-visible, :focus-within')) show(target, true);
    else hide();
  });
  window.addEventListener('blur', hide);
}

/* hero canvas */

async function initHero() {
  const canvas = $('.hero-canvas');
  const img = new Image();
  img.src = 'assets/portrait.webp';
  try {
    await img.decode();
    hero = createHero(canvas, img, { focus: [0.5, 0.06], autoWander: !finePointer, reduced });
    root.classList.add('gl-ready');
    hero.start();
    canvas.addEventListener('webglcontextlost', () => {
      hero?.destroy();
      hero = null;
      root.classList.remove('gl-ready');
    });
  } catch (err) {
    console.warn('Hero falls back to the static photo:', err);
  }
}

/* smooth scroll + scroll scenes */

function initLenis() {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => {
    lenis.raf(t * 1000);
    // read every frame so effects settle back to rest when scrolling stops
    scroll.velocity = lenis.isScrolling ? lenis.velocity : 0;
    if (lenis.direction) scroll.direction = lenis.direction;
  });
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

function sectionHeadings() {
  for (const el of $$('.h-section, .contact-title')) {
    SplitText.create(el, {
      type: 'lines,words',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) => gsap.from(self.words, {
        yPercent: 110,
        duration: 1.1,
        stagger: 0.05,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      }),
    });
  }
}

// One trigger pins the hero, feeds the shader and scrubs the name apart,
// so all three stay in lockstep while the about sheet slides over.
function heroScroll(chars) {
  const rand = gsap.utils.random;
  gsap.timeline({
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      pin: true,
      pinSpacing: false,
      scrub: 0.7,
      onUpdate: (self) => hero?.setScroll(self.progress),
    },
  })
    .to(chars, {
      yPercent: () => rand(-160, -40),
      xPercent: () => rand(-60, 60),
      rotate: () => rand(-28, 28),
      opacity: 0,
      ease: 'none',
      stagger: { each: 0.03, from: 'center' },
    }, 0)
    .to('.hero-foot', { y: -80, opacity: 0, ease: 'none', duration: 0.5 }, 0)
    .to('.kickoff-line, .kickoff-circle', { opacity: 0, ease: 'none', duration: 0.5 }, 0);
}

function aboutScene() {
  const words = new SplitText('.manifesto', { type: 'words' }).words;
  gsap.set(words, { opacity: 0.14 });
  gsap.set('.facts > div', { opacity: 0, y: 30 });
  gsap.timeline({ scrollTrigger: { trigger: '.about', start: 'top top', end: '+=110%', pin: true, scrub: 0.5 } })
    .to(words, { opacity: 1, stagger: 0.1, ease: 'none', duration: 0.6 })
    .to('.facts > div', { opacity: 1, y: 0, stagger: 0.2, ease: 'power2.out', duration: 0.8 }, '-=0.4');
}

function workScene() {
  const rows = $$('.work-row');
  gsap.set(rows, { opacity: 0, y: 70 });
  ScrollTrigger.batch(rows, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out' }),
  });

  const list = $('.work-list');
  const skew = gsap.quickTo(list, 'skewY', { duration: 0.6, ease: 'power3' });
  let last = 0;
  gsap.ticker.add(() => {
    const next = Math.round(clamp(scroll.velocity * -0.12, -4, 4) * 100) / 100;
    if (next !== last) skew(next);
    last = next;
  });
}

function moreScene() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const track = $('[data-more-track]');
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const pan = panTween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.more',
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });
    for (const card of $$('.more-card')) {
      gsap.fromTo($('img', card), { xPercent: -5 }, {
        xPercent: 5,
        ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: pan, start: 'left right', end: 'right left', scrub: true },
      });
      gsap.from(card, {
        yPercent: 12,
        rotate: 2.5,
        opacity: 0.2,
        ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: pan, start: 'left right', end: 'left 55%', scrub: true },
      });
    }
    return () => { panTween = null; };
  });
}

function expScene() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const cards = $$('.exp-card');
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      gsap.to(card, {
        scale: 0.92,
        '--dim': 0.6,
        ease: 'none',
        scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 25%', scrub: true },
      });
    });
  });
}

function marquees() {
  for (const m of $$('[data-marquee]')) {
    const track = $('.marquee-track', m);
    const clones = [...track.children].map((n) => {
      const c = n.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      return c;
    });
    track.append(...clones);
    const dir = Number(m.dataset.marquee);
    let half = track.scrollWidth / 2;
    let x = dir > 0 ? 0 : -half / 2;
    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(m);
    new ResizeObserver(() => { half = track.scrollWidth / 2; }).observe(track);
    const setX = gsap.quickSetter(track, 'x', 'px');
    gsap.ticker.add((_t, dt) => {
      if (!visible) return;
      const boost = Math.min(Math.abs(scroll.velocity), 60) * 0.5;
      x -= (0.9 + boost) * dir * scroll.direction * (dt / 16.67);
      x = wrap(x, -half, 0);
      setX(x);
    });
  }
}

function bentoScene() {
  gsap.from('.cell', {
    y: 60,
    opacity: 0,
    duration: 1.1,
    stagger: 0.08,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.bento', start: 'top 82%', once: true },
  });
  gsap.from('.bench-card', {
    y: 60,
    opacity: 0,
    duration: 1.1,
    stagger: 0.08,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.bench-grid', start: 'top 85%', once: true },
  });
}

function contactScene() {
  const giant = $('.contact-giant');
  const chars = new SplitText(giant, { type: 'chars' }).chars;
  gsap.from(chars, {
    yPercent: 105,
    ease: 'none',
    stagger: 0.04,
    scrollTrigger: { trigger: giant, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 },
  });
  gsap.from('.contact-social li', {
    y: 30,
    opacity: 0,
    stagger: 0.07,
    duration: 0.9,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.contact-social', start: 'top 90%', once: true },
  });
}

/* intro */

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function intro(heroReady) {
  const loader = $('.loader');
  const num = $('.loader-num');
  const nameSplit = new SplitText('.loader-name', { type: 'chars' });
  gsap.set('.loader-name', { overflow: 'hidden' });
  gsap.from(nameSplit.chars, { yPercent: 110, duration: 1.2, stagger: 0.04, ease: 'expo.out' });

  const prog = { v: 0 };
  const draw = () => { num.textContent = String(percent(prog.v)); };
  gsap.to(prog, { v: 0.86, duration: 1.7, ease: 'power1.out', onUpdate: draw });

  await Promise.race([
    Promise.all([document.fonts.ready, heroReady, wait(1500)]),
    wait(5000),
  ]);
  await gsap.to(prog, { v: 1, duration: 0.4, ease: 'power2.out', onUpdate: draw });

  const lines = $$('.hero-line');
  const chars = lines.flatMap((l) => new SplitText(l, { type: 'chars' }).chars);
  gsap.set(lines, { overflow: 'hidden' });
  root.classList.add('revealed');
  gsap.set(chars, { yPercent: 115, rotate: 7 });
  gsap.set('.hero-foot > *', { y: 24, opacity: 0 });
  gsap.set('.nav', { opacity: 0 });

  const tl = gsap.timeline();
  tl.to(nameSplit.chars, { yPercent: -110, duration: 0.7, stagger: 0.025, ease: 'power3.in' })
    .to(num, { yPercent: -60, opacity: 0, duration: 0.5, ease: 'power3.in' }, '<')
    .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, '-=0.25')
    .add(() => { if (hero) gsap.to(hero.state, { reveal: 1, duration: 2.4, ease: 'power2.inOut' }); }, '<0.1')
    .to(chars, { yPercent: 0, rotate: 0, duration: 1.5, stagger: 0.05, ease: 'expo.out' }, '<0.45')
    .to('.hero-foot > *', { y: 0, opacity: 1, duration: 1, stagger: 0.12, ease: 'expo.out' }, '<0.5')
    .to('.nav', { opacity: 1, duration: 0.8 }, '<')
    .set(loader, { display: 'none' });
  await tl;

  gsap.set(lines, { overflow: 'visible' });
  return chars;
}

/* boot */

function failSafe(err) {
  console.error(err);
  root.classList.add('booted', 'revealed');
  const loader = $('.loader');
  if (loader) loader.style.display = 'none';
  if (gsap) gsap.set('.nav, .hero-foot > *', { clearProps: 'all' });
  lenis?.start();
}

async function boot() {
  root.classList.add('booted');
  fillSocials();
  renderWork();
  renderMore();
  renderBench();
  initNavTone();
  initTheme();
  initCopy();
  initMenu();
  initAnchors();
  initTouchPanels();
  initGuide();
  if (finePointer) initCursor({ gsap, reduced });
  fitGiant();
  document.fonts.ready.then(fitGiant);
  window.addEventListener('resize', fitGiant);

  const heroReady = initHero();

  if (!animated) {
    root.classList.add('revealed');
    if (hero) hero.state.reveal = 1;
    heroReady.then(() => { if (hero) { hero.state.reveal = 1; hero.setScroll(0); } });
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  root.classList.add('animated');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  initLenis();

  sectionHeadings();
  aboutScene();
  workScene();
  moreScene();
  expScene();
  marquees();
  bentoScene();
  contactScene();

  const chars = await intro(heroReady);
  heroScroll(chars);
  initBall({ gsap, ScrollTrigger, getPan: () => panTween });
  ScrollTrigger.refresh();
  lenis.start();
  document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

boot().catch(failSafe);
