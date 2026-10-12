import { coverFit, clamp, lerp } from './lib.js';

// Hero portrait renderer. Raw WebGL1, one full-screen triangle, no library.
// The photo is shown in monochrome; the cursor leaves a trail that bends the
// image and lets the original colour through.

const TRAIL = 20;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec4 uCover;          // scale.xy, offset.xy (object-fit: cover)
uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;        // 0 at rest, 1 when the hero has scrolled away
uniform float uReveal;        // intro wipe, 0..1
uniform float uZoom;
uniform vec3 uTrail[${TRAIL}];// xy in screen uv, z strength
uniform vec3 uBg;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec2 toImage(vec2 uv) { return uv * uCover.xy + uCover.zw; }

vec3 sampleImg(vec2 uv) { return texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb; }

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;

  // slow zoom toward the upper middle, where the face sits
  vec2 anchor = vec2(0.5, 0.62);
  uv = anchor + (uv - anchor) / uZoom;

  // cursor trail: soft blobs that push pixels outward
  vec2 p = vec2(uv.x * aspect, uv.y);
  float infl = 0.0;
  vec2 push = vec2(0.0);
  for (int i = 0; i < ${TRAIL}; i++) {
    vec3 t = uTrail[i];
    vec2 d = p - vec2(t.x * aspect, t.y);
    float f = exp(-dot(d, d) / 0.018) * t.z;
    infl += f;
    push += d * f;
  }
  infl = clamp(infl, 0.0, 1.0);

  // barely-there breathing so the still frame never looks frozen
  uv.x += sin(uv.y * 5.0 + uTime * 0.5) * 0.0012;
  uv -= push * 0.09;

  vec2 iuv = toImage(uv);

  // depth: keep the subject sharp, soften the busy background
  vec2 sd = (iuv - vec2(0.5, 0.45)) / vec2(0.2, 0.55);
  float bgMask = smoothstep(0.7, 1.4, length(sd));
  float blur = (0.007 + uScroll * 0.01) * bgMask;
  vec3 col = sampleImg(iuv) * 0.2;
  col += sampleImg(iuv + vec2( blur, 0.0)) * 0.1;
  col += sampleImg(iuv + vec2(-blur, 0.0)) * 0.1;
  col += sampleImg(iuv + vec2(0.0,  blur)) * 0.1;
  col += sampleImg(iuv + vec2(0.0, -blur)) * 0.1;
  col += sampleImg(iuv + vec2( blur,  blur) * 0.7) * 0.1;
  col += sampleImg(iuv + vec2(-blur,  blur) * 0.7) * 0.1;
  col += sampleImg(iuv + vec2( blur, -blur) * 0.7) * 0.1;
  col += sampleImg(iuv + vec2(-blur, -blur) * 0.7) * 0.1;

  // a hint of lens split where the cursor has been, kept faint on purpose
  float split = infl * 0.0018;
  col.r = mix(col.r, sampleImg(iuv + vec2(split, 0.0)).r, infl * 0.6);
  col.b = mix(col.b, sampleImg(iuv - vec2(split, 0.0)).b, infl * 0.6);

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  lum = smoothstep(0.02, 0.98, lum);
  vec3 mono = vec3(lum);
  // revealed colour is slightly desaturated so it reads as film, not saturated
  vec3 film = mix(vec3(lum), col, 0.8);
  col = mix(mono, film, smoothstep(0.08, 0.85, infl));
  col *= mix(1.0, 0.62, bgMask);

  // legibility for the name and footer copy
  float vig = length((vUv - vec2(0.5, 0.55)) * vec2(1.0, 1.2));
  col *= 1.0 - 0.55 * smoothstep(0.25, 0.95, vig);
  col *= mix(1.0, 0.35, uScroll);

  col += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.07;

  // intro: the photo rises out of the dark with a ragged edge
  float t = uReveal * 1.4 - 0.2;
  float edge = vUv.y + (noise(vUv * vec2(6.0, 3.0) + uTime * 0.2) - 0.5) * 0.18;
  float a = 1.0 - smoothstep(t - 0.1, t, edge);
  gl_FragColor = vec4(mix(uBg, col, a), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return s;
}

export function createHero(canvas, img, { focus = [0.5, 0.18], autoWander = false, reduced = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL unavailable');

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const u = {};
  for (const name of ['uTex', 'uCover', 'uRes', 'uTime', 'uScroll', 'uReveal', 'uZoom', 'uTrail', 'uBg']) {
    u[name] = gl.getUniformLocation(prog, name);
  }
  gl.uniform1i(u.uTex, 0);
  gl.uniform3f(u.uBg, 10 / 255, 10 / 255, 10 / 255);

  const trail = new Float32Array(TRAIL * 3);
  const state = {
    scroll: 0,
    reveal: reduced ? 1 : 0,
    zoom: reduced ? 1.06 : 1.22,
    targetZoom: 1.06,
    mouse: { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, inside: false, presence: 0 },
    head: 1,
    time: 0,
    running: false,
    visible: true,
    raf: 0,
    last: 0,
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.uRes, w, h);
    const c = coverFit(w, h, img.naturalWidth || img.width, img.naturalHeight || img.height, focus[0], focus[1]);
    gl.uniform4f(u.uCover, c.sx, c.sy, c.ox, c.oy);
    if (!state.running) draw();
  }

  function pointer(e) {
    const r = canvas.getBoundingClientRect();
    state.mouse.tx = (e.clientX - r.left) / r.width;
    state.mouse.ty = 1 - (e.clientY - r.top) / r.height;
    state.mouse.inside = state.mouse.tx >= 0 && state.mouse.tx <= 1 && state.mouse.ty >= 0 && state.mouse.ty <= 1;
  }
  const leave = () => { state.mouse.inside = false; };

  function step(dt) {
    const m = state.mouse;
    if (autoWander && !m.inside) {
      const t = state.time * 0.35;
      m.tx = 0.5 + Math.sin(t * 1.3) * 0.22;
      m.ty = 0.62 + Math.sin(t * 0.9) * 0.18;
    }
    const prevX = m.x;
    const prevY = m.y;
    const k = 1 - Math.pow(0.0015, dt);
    m.x = lerp(m.x, m.tx, k);
    m.y = lerp(m.y, m.ty, k);
    const speed = Math.hypot(m.x - prevX, m.y - prevY) / Math.max(dt, 1e-3);
    const want = m.inside || autoWander ? 0.55 : 0;
    m.presence = lerp(m.presence, want, 1 - Math.pow(0.02, dt));

    const decay = Math.pow(0.12, dt);
    for (let i = 1; i < TRAIL; i++) trail[i * 3 + 2] *= decay;

    if (speed > 0.02) {
      const i = state.head;
      trail[i * 3] = m.x;
      trail[i * 3 + 1] = m.y;
      trail[i * 3 + 2] = clamp(speed * 0.35, 0, 0.9);
      state.head = state.head + 1 >= TRAIL ? 1 : state.head + 1;
    }
    trail[0] = m.x;
    trail[1] = m.y;
    trail[2] = m.presence;

    state.zoom = lerp(state.zoom, state.targetZoom + state.scroll * 0.18, 1 - Math.pow(0.05, dt));
  }

  function draw() {
    gl.uniform1f(u.uTime, state.time);
    gl.uniform1f(u.uScroll, state.scroll);
    gl.uniform1f(u.uReveal, state.reveal);
    gl.uniform1f(u.uZoom, state.zoom);
    gl.uniform3fv(u.uTrail, trail);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    state.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (state.last || now)) / 1000);
    state.last = now;
    if (!state.visible || document.hidden) return;
    state.time += dt;
    step(dt);
    draw();
  }

  const io = new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting; });
  io.observe(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  if (!reduced) {
    window.addEventListener('pointermove', pointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
  }
  resize();

  return {
    gl,
    start() {
      if (reduced) { draw(); return; }
      if (state.running) return;
      state.running = true;
      state.raf = requestAnimationFrame(frame);
    },
    setScroll(p) {
      state.scroll = clamp(p, 0, 1);
      if (!state.running) draw();
    },
    // GSAP tweens these directly during the intro
    get state() { return state; },
    destroy() {
      cancelAnimationFrame(state.raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', pointer);
      document.documentElement.removeEventListener('pointerleave', leave);
    },
  };
}
