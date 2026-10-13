/* Кеш геометрії гліфів, тема і малювання на canvas (картки, тест-текст, назва). */
(function () {
  const FL = (window.FL = window.FL || {});
  const S = FL.store;

  // ── Тема
  const THEMES = {
    light: { bg: '#E4E4E1', panel: '#EBEBE8', tile: '#D9D9D5', tile2: '#D0D0CB', line: '#C5C5C0', muted: '#84847E', ink: '#0B0B0B', paper: '#F6F6F4', pill: '#F1F1EE', pill2: '#E1E1DD' },
    dark: { bg: '#0B0B0B', panel: '#101010', tile: '#1A1A1A', tile2: '#141414', line: '#262626', muted: '#76766F', ink: '#F1F1EC', paper: '#171717', pill: '#161616', pill2: '#222222' },
  };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const theme = { name: 'light', colors: Object.assign({}, THEMES.light) };

  function applyColors(colors) {
    theme.colors = colors;
    const st = document.documentElement.style;
    Object.keys(colors).forEach((k) => st.setProperty('--' + k, colors[k]));
    S.emit('paint');
  }

  theme.set = (name, animate) => {
    const from = Object.assign({}, theme.colors);
    const to = THEMES[name];
    theme.name = name;
    document.documentElement.dataset.theme = name;
    if (!animate) return applyColors(Object.assign({}, to));
    const a = {}, b = {};
    Object.keys(to).forEach((k) => { a[k] = hex(from[k]); b[k] = hex(to[k]); });
    const o = { t: 0 };
    gsap.to(o, {
      t: 1,
      duration: 0.5,
      ease: 'power2.inOut',
      onUpdate() {
        const c = {};
        Object.keys(b).forEach((k) => (c[k] = toHex(a[k].map((v, i) => v + (b[k][i] - v) * o.t))));
        applyColors(c);
      },
    });
  };

  // ── Кеш гліфів
  const cache = new Map();
  function glyph(ch, style) {
    const st = style || S.style();
    const id = st.id + '|' + ch;
    const key = S.glyphKey(ch, st);
    const hit = cache.get(id);
    if (hit && hit.key === key) return hit;
    const b = FL.geo.buildGlyph(ch, S.cells(ch), S.project.grid, S.params(ch, st));
    b.key = key;
    b.path = FL.geo.toPath2D(b.cmds);
    cache.set(id, b);
    return b;
  }

  let setCache = { rev: -1, set: new Set() };
  let charsetRev = 0;
  S.on('charset', () => charsetRev++);
  S.on('project', () => { charsetRev++; cache.clear(); });
  function inSet(ch) {
    if (setCache.rev !== charsetRev) setCache = { rev: charsetRev, set: new Set(S.charset()) };
    return setCache.set.has(ch);
  }
  const usable = (ch) => inSet(ch) && S.isDrawn(ch);

  /** Який гліф показати для символу: сам, інший регістр або типографський відповідник. */
  function resolve(ch, opts) {
    if (ch === ' ') return ' ';
    if (usable(ch)) return ch;
    const fb = !opts || opts.caseFallback !== false;
    const pair = FL.charset.CASE_PAIRS[ch];
    if (fb && pair && usable(pair)) return pair;
    const al = FL.charset.ALIASES[ch];
    if (al) {
      if (al === ' ') return ' ';
      if (usable(al)) return al;
      const al2 = FL.charset.ALIASES[al];
      if (al2 && al2 !== ch && usable(al2)) return al2;
    }
    return null;
  }

  // ── Canvas
  function fitCanvas(canvas, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    return { ctx, dpr };
  }

  /** Гліф у картці: масштаб за повною сіткою, щоб усі картки були співмірні. */
  function drawCard(canvas, ch, color, style) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const { ctx, dpr } = fitCanvas(canvas, w, h);
    canvas.style.height = '';
    if (!S.isDrawn(ch)) return;
    const g = glyph(ch, style);
    const m = g.m;
    const grid = S.project.grid;
    const boxW = grid.cols * m.P - m.G;
    const top = m.capH + m.top * m.P;
    const bot = -grid.desc * m.P;
    const pad = m.D * 0.8;
    const s = Math.min(w / (boxW + pad * 2), h / (top - bot + pad * 2));
    const ox = w / 2 - (g.lsb + g.inkW / 2) * s;
    const by = h / 2 + ((top + bot) / 2) * s;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * by);
    ctx.fillStyle = color;
    ctx.fill(g.path);
  }

  /** Розкладка тексту з переносом слів. Повертає рядки з позиціями гліфів. */
  function layout(text, opts) {
    const st = opts.style || S.style();
    const p = st.params;
    const m = FL.geo.metrics(S.project.grid, p);
    const scale = opts.size / m.upm;
    const track = (opts.tracking || 0) * (m.upm / 1000);
    const missingW = S.project.grid.cols * m.P * 0.8 + m.P;
    const maxW = opts.maxWidth ? opts.maxWidth / scale : Infinity;
    const lines = [];
    String(text).split('\n').forEach((para) => {
      let line = [];
      let x = 0;
      let lastSpace = -1;
      Array.from(para).forEach((raw) => {
        const r = resolve(raw, opts);
        const item = { raw, ch: r, x: 0, w: 0 };
        item.w = r ? glyph(r, st).advance : missingW;
        item.w += track;
        if (x + item.w > maxW && line.length && raw !== ' ') {
          if (lastSpace >= 0) {
            const rest = line.slice(lastSpace + 1);
            lines.push(line.slice(0, lastSpace));
            line = rest;
            x = 0;
            line.forEach((it) => { it.x = x; x += it.w; });
          } else {
            lines.push(line);
            line = [];
            x = 0;
          }
          lastSpace = -1;
        }
        item.x = x;
        x += item.w;
        if (raw === ' ') lastSpace = line.length;
        line.push(item);
      });
      lines.push(line);
    });
    return { lines, m, scale, st };
  }

  function drawText(canvas, text, opts) {
    const w = opts.width || canvas.clientWidth;
    const L = layout(text, Object.assign({}, opts, { maxWidth: opts.wrap === false ? 0 : w - (opts.padX || 0) * 2 }));
    const { m, scale, st } = L;
    const lineH = (m.asc - m.des) * scale * (opts.leading || 1.15);
    const h = opts.height || Math.max(lineH, L.lines.length * lineH) + (opts.padY || 0) * 2;
    const { ctx, dpr } = fitCanvas(canvas, w, h);
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = opts.color;
    const x0 = opts.padX || 0;
    const y0 = (opts.padY || 0) + (m.asc + ((opts.leading || 1.15) - 1) * (m.asc - m.des) / 2) * scale;
    L.lines.forEach((line, li) => {
      const by = y0 + li * lineH;
      line.forEach((it) => {
        if (it.raw === ' ') return;
        const px = x0 + it.x * scale;
        if (it.ch) {
          const g = glyph(it.ch, st);
          ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * px, dpr * by);
          ctx.fill(g.path);
        } else {
          ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * px, dpr * by);
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = m.D * 0.25;
          ctx.strokeStyle = opts.color;
          ctx.strokeRect(m.P * 0.5, -m.capH, it.w - m.P - (opts.tracking || 0), m.capH);
          ctx.restore();
        }
      });
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { height: h, lines: L.lines.length };
  }

  /** Ширина рядка у пікселях (для назви в шапці). */
  function measure(text, size, style) {
    const L = layout(text, { size, style, wrap: false });
    const line = L.lines[0] || [];
    const last = line[line.length - 1];
    return last ? (last.x + last.w) * L.scale : 0;
  }

  FL.theme = theme;
  FL.render = { THEMES, glyph, resolve, inSet, usable, drawCard, drawText, layout, measure, fitCanvas, cache };
})();
