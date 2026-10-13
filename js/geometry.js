/* Геометрія точок: метрики, овали, threshold-текстура, контури гліфа.
   Одиниці — одиниці шрифту (UPM 1000), вісь Y вгору, базова лінія = 0.
   Команди контурів — плаский масив: 0 x y (move) · 1 x y (line) · 2 x1 y1 x2 y2 x y (curve) · 3 (close). */
(function () {
  const FL = (window.FL = window.FL || {});
  const TAU = Math.PI * 2;
  const KAPPA = 0.5522847498;
  const UPM = 1000;

  const DEFAULT_PARAMS = {
    gap: 0.12, // відстань між клітинками, частка діаметра точки
    spacing: 1, // міжлітерний інтервал у клітинках
    wordSpace: 3, // ширина пробілу у клітинках
    mono: false,
    size: 1, // масштаб точки
    outline: 0, // товщина обведення, частка діаметра
    fill: true, // суцільна точка або лише контур
    ovalAmount: 0,
    ovalStretch: 0.5,
    angle: 0,
    angleSpread: 180,
    sizeJitter: 0,
    varSeed: 1,
    tex: false,
    threshold: 0.5,
    blur: 0.4,
    noise: 0.6,
    grain: 0.3,
    detail: 0.5,
    texSeed: 1,
  };
  /** Параметри, які можна перевизначити для окремого гліфа. */
  const GLYPH_KEYS = ['size', 'outline', 'fill', 'ovalAmount', 'ovalStretch', 'angle', 'angleSpread', 'sizeJitter', 'varSeed', 'tex', 'threshold', 'blur', 'noise', 'grain', 'detail', 'texSeed'];

  // ── Детермінований випадковий генератор
  function mix(h, v) {
    h ^= v | 0;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }
  function seedOf() {
    let h = 0x9e3779b9;
    for (let i = 0; i < arguments.length; i++) h = mix(h, arguments[i]);
    return h;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function metrics(grid, p) {
    const D = (UPM * 0.7) / grid.rows;
    const G = D * p.gap;
    const P = D + G;
    const capH = grid.rows * P - G;
    const xRows = Math.max(1, Math.round((grid.rows * 5) / 7));
    const xH = xRows * P - G;
    const top = grid.top || 0;
    const asc = Math.round((grid.rows + top) * P + P * 0.4);
    const des = -Math.round(grid.desc * P + P * 0.4);
    return { D, G, P, capH, xH, xRows, top, asc, des, upm: UPM };
  }

  // ── Форма однієї точки

  function ellipse(out, cx, cy, a, b, cs, sn, reverse) {
    const s = reverse ? -1 : 1;
    const T = (u, v) => [cx + u * a * cs - v * b * s * sn, cy + u * a * sn + v * b * s * cs];
    const pts = [
      [1, 0], [1, KAPPA], [KAPPA, 1], [0, 1],
      [-KAPPA, 1], [-1, KAPPA], [-1, 0],
      [-1, -KAPPA], [-KAPPA, -1], [0, -1],
      [KAPPA, -1], [1, -KAPPA], [1, 0],
    ];
    const p0 = T(pts[0][0], pts[0][1]);
    out.push(0, p0[0], p0[1]);
    for (let i = 1; i < 13; i += 3) {
      const c1 = T(pts[i][0], pts[i][1]);
      const c2 = T(pts[i + 1][0], pts[i + 1][1]);
      const e = T(pts[i + 2][0], pts[i + 2][1]);
      out.push(2, c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    }
    out.push(3);
  }

  /** Нерівний край, як після blur + noise + threshold:
      край зсувається на 2σ(0.5 − поріг) і «гуляє» на 2σ·шум·n(θ). */
  function blob(out, cx, cy, R, sx, sy, cs, sn, rnd, p, D, inner) {
    const sigma = p.blur * D * 0.15;
    const shift = (0.5 - p.threshold) * (D * 0.16 + 2 * sigma);
    const amp = 2 * sigma * p.noise;
    // фрактальний шум: кожна наступна октава вдвічі частіша і слабша
    const f0 = 2 + p.grain * 6;
    const g = 0.32 + 0.36 * p.detail;
    const comps = [];
    let sum = 0;
    for (let k = 0, a = 1; k < 6; k++, a *= g) {
      const f = Math.max(2, Math.round(f0 * Math.pow(2, k) * (0.85 + 0.3 * rnd())));
      const ak = a * (0.6 + 0.4 * rnd());
      comps.push(f, ak, rnd() * TAU);
      sum += ak;
    }
    const jit = 0.18 * p.detail * p.detail;
    const norm = 1 / (sum + jit);
    const N = Math.round(64 + p.detail * 64 + p.grain * 32);
    const dir = inner ? -1 : 1;
    const min = D * 0.03;
    for (let i = 0; i < N; i++) {
      const t = (dir * i * TAU) / N;
      let n = jit * (rnd() * 2 - 1);
      for (let j = 0; j < comps.length; j += 3) n += comps[j + 1] * Math.sin(comps[j] * t + comps[j + 2]);
      const d = shift + amp * n * norm;
      let r = inner ? R - d : R + d;
      if (r < min) r = min;
      const u = Math.cos(t) * r * sx;
      const v = Math.sin(t) * r * sy;
      out.push(i === 0 ? 0 : 1, cx + u * cs - v * sn, cy + u * sn + v * cs);
    }
    out.push(3);
  }

  /** Додає до out контури однієї точки з центром (cx, cy). */
  function dot(out, cx, cy, code, x, y, p, D) {
    const r = rng(seedOf(p.varSeed, code, x + 64, y + 64));
    const u0 = r(), u1 = r(), u2 = r(), u3 = r();
    const k = u0 < p.ovalAmount ? p.ovalStretch * 0.85 * (0.35 + 0.65 * u1) : 0;
    const ang = ((p.angle + (u2 - 0.5) * p.angleSpread) * Math.PI) / 180;
    const R = (D / 2) * p.size * (1 + (u3 * 2 - 1) * p.sizeJitter);
    const W = p.outline * D;
    const sx = 1 + k;
    const sy = 1 / (1 + k);
    let Ro;
    let Ri = 0;
    if (p.fill) {
      Ro = R + W / 2;
    } else {
      const w = Math.max(W, D * 0.05);
      Ro = R + w / 2;
      Ri = R - w / 2;
    }
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    if (!p.tex) {
      ellipse(out, cx, cy, Ro * sx, Ro * sy, cs, sn, false);
      if (Ri > D * 0.02) ellipse(out, cx, cy, Ri * sx, Ri * sy, cs, sn, true);
    } else {
      const tr = rng(seedOf(p.texSeed, code, x + 64, y + 64, 7));
      blob(out, cx, cy, Ro, sx, sy, cs, sn, tr, p, D, false);
      if (Ri > D * 0.02) blob(out, cx, cy, Ri, sx, sy, cs, sn, tr, p, D, true);
    }
  }

  function inGrid(x, y, grid) {
    return x >= 0 && x < grid.cols && y >= -grid.desc && y < grid.rows + (grid.top || 0);
  }

  /** Повна побудова гліфа: контури, ширина, позиції точок. */
  function buildGlyph(ch, cells, grid, p) {
    const m = metrics(grid, p);
    const code = ch.codePointAt(0);
    const list = [];
    cells.forEach((k) => {
      const i = k.indexOf(',');
      const x = +k.slice(0, i);
      const y = +k.slice(i + 1);
      if (inGrid(x, y, grid)) list.push(x, y);
    });
    const empty = list.length === 0;
    let minX = 0;
    let maxX = grid.cols - 1;
    if (!p.mono && !empty) {
      minX = Infinity;
      maxX = -Infinity;
      for (let i = 0; i < list.length; i += 2) {
        if (list[i] < minX) minX = list[i];
        if (list[i] > maxX) maxX = list[i];
      }
    }
    const inkW = (maxX - minX) * m.P + m.D;
    const side = m.G + p.spacing * m.P;
    const lsb = side / 2;
    let advance = inkW + side;
    if (ch === ' ') advance = p.mono ? grid.cols * m.P + p.spacing * m.P : p.wordSpace * m.P;
    const cmds = [];
    for (let i = 0; i < list.length; i += 2) {
      const x = list[i];
      const y = list[i + 1];
      dot(cmds, lsb + (x - minX) * m.P + m.D / 2, y * m.P + m.D / 2, code, x, y, p, m.D);
    }
    return { cmds, advance, lsb, inkW, minX, empty, m };
  }

  /** Контури окремої точки в локальних координатах (центр = 0,0). */
  function dotLocal(ch, x, y, p, D) {
    const out = [];
    dot(out, 0, 0, ch.codePointAt(0), x, y, p, D);
    return out;
  }

  function toPath2D(cmds) {
    const path = new Path2D();
    for (let i = 0; i < cmds.length; ) {
      const op = cmds[i];
      if (op === 0) { path.moveTo(cmds[i + 1], -cmds[i + 2]); i += 3; }
      else if (op === 1) { path.lineTo(cmds[i + 1], -cmds[i + 2]); i += 3; }
      else if (op === 2) { path.bezierCurveTo(cmds[i + 1], -cmds[i + 2], cmds[i + 3], -cmds[i + 4], cmds[i + 5], -cmds[i + 6]); i += 7; }
      else { path.closePath(); i += 1; }
    }
    return path;
  }

  /** SVG-шлях: зсув (ox, oy) у координатах SVG (y вниз). */
  function toSVG(cmds, ox, oy) {
    let d = '';
    const f = (v) => Math.round(v * 10) / 10;
    for (let i = 0; i < cmds.length; ) {
      const op = cmds[i];
      if (op === 0) { d += 'M' + f(ox + cmds[i + 1]) + ' ' + f(oy - cmds[i + 2]); i += 3; }
      else if (op === 1) { d += 'L' + f(ox + cmds[i + 1]) + ' ' + f(oy - cmds[i + 2]); i += 3; }
      else if (op === 2) {
        d += 'C' + f(ox + cmds[i + 1]) + ' ' + f(oy - cmds[i + 2]) + ' ' + f(ox + cmds[i + 3]) + ' ' + f(oy - cmds[i + 4]) + ' ' + f(ox + cmds[i + 5]) + ' ' + f(oy - cmds[i + 6]);
        i += 7;
      } else { d += 'Z'; i += 1; }
    }
    return d;
  }

  FL.geo = { UPM, DEFAULT_PARAMS, GLYPH_KEYS, metrics, buildGlyph, dotLocal, toPath2D, toSVG, seedOf, rng, inGrid };
})();
