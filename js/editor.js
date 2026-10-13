/* Редактор гліфа: SVG-сітка, малювання точок, інструменти. */
(function () {
  const FL = (window.FL = window.FL || {});
  const S = FL.store;
  const { h, icon } = FL.ui;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  };

  let svg;
  let L = null; // поточна розкладка
  let layers = {};
  const dots = new Map(); // "x,y" → <g>
  let hover = null;
  let clipboard = null;

  function cellCenter(x, y) {
    const { m, grid } = L;
    return [x * m.P + m.D / 2, (grid.rows + m.top - 1 - y) * m.P + m.D / 2];
  }

  function build() {
    if (!S.project) return;
    const grid = S.project.grid;
    const m = FL.geo.metrics(grid, S.style().params);
    const W = grid.cols * m.P - m.G;
    const H = (m.top + grid.rows + grid.desc) * m.P - m.G;
    const pad = m.D * 0.9;
    L = { grid, m, W, H, pad };
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`);
    layers = {
      tiles: svgEl('g', { class: 'ed-tiles' }),
      guides: svgEl('g', { class: 'ed-guides' }),
      ghost: svgEl('g', { class: 'ed-ghost' }),
      dots: svgEl('g', { class: 'ed-dots' }),
      hover: svgEl('g', { class: 'ed-hover' }),
    };
    Object.values(layers).forEach((g) => svg.appendChild(g));

    const r = m.D * 0.22;
    for (let y = grid.rows + m.top - 1; y >= -grid.desc; y--) {
      for (let x = 0; x < grid.cols; x++) {
        const sx = x * m.P;
        const sy = (grid.rows + m.top - 1 - y) * m.P;
        layers.tiles.appendChild(svgEl('rect', { x: sx, y: sy, width: m.D, height: m.D, rx: r, class: y < 0 ? 'tile desc' : y >= grid.rows ? 'tile above' : 'tile' }));
      }
    }
    // напрямні: базова лінія та висота малих
    const ext = pad * 0.55;
    const baseY = (grid.rows + m.top) * m.P - m.G / 2;
    const xY = (grid.rows + m.top - m.xRows) * m.P - m.G / 2;
    const capY = m.top * m.P - m.G / 2;
    const sw = Math.max(1.2, m.D * 0.018);
    layers.guides.appendChild(svgEl('line', { x1: -ext, x2: W + ext, y1: baseY, y2: baseY, class: 'g-base', 'stroke-width': sw }));
    if (m.xRows < grid.rows) layers.guides.appendChild(svgEl('line', { x1: -ext, x2: W + ext, y1: xY, y2: xY, class: 'g-x', 'stroke-width': sw, 'stroke-dasharray': `${m.D * 0.06} ${m.D * 0.1}` }));
    const label = (txt, y) => {
      const t = svgEl('text', { x: W + ext + m.D * 0.08, y: y + m.D * 0.06, class: 'g-label', 'font-size': m.D * 0.16 });
      t.textContent = txt;
      layers.guides.appendChild(t);
    };
    if (m.top) {
      layers.guides.appendChild(svgEl('line', { x1: -ext, x2: W + ext, y1: capY, y2: capY, class: 'g-cap', 'stroke-width': sw }));
      label('cap', capY);
    }
    label('base', baseY);
    if (m.xRows < grid.rows) label('x', xY);
    hover = svgEl('path', { class: 'hover-dot' });
    layers.hover.appendChild(hover);
    renderGlyph(true);
  }

  function dotPath(ch, x, y, p) {
    const [cx, cy] = cellCenter(x, y);
    return FL.geo.toSVG(FL.geo.dotLocal(ch, x, y, p, L.m.D), cx, cy);
  }

  function makeDot(ch, x, y, p) {
    const g = svgEl('g', { class: 'dot' });
    const path = svgEl('path', { d: dotPath(ch, x, y, p) });
    g.appendChild(path);
    g._xy = [x, y];
    // центр масштабування — точно центр клітинки, заданий до будь-якої анімації
    const [cx, cy] = cellCenter(x, y);
    gsap.set(g, { svgOrigin: cx + ' ' + cy });
    return g;
  }

  /** Повністю перемальовує точки поточного гліфа. */
  function renderGlyph(animate) {
    if (!L) return;
    const ch = S.current;
    const p = S.params(ch);
    dots.forEach((g) => g.remove());
    dots.clear();
    const list = [];
    S.cells(ch).forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      if (!FL.geo.inGrid(x, y, L.grid)) return;
      const g = makeDot(ch, x, y, p);
      layers.dots.appendChild(g);
      dots.set(k, g);
      list.push(g);
    });
    if (animate && list.length) {
      list.sort((a, b) => b._xy[1] - a._xy[1] || a._xy[0] - b._xy[0]);
      gsap.fromTo(list, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.34, ease: 'back.out(1.8)', stagger: { each: Math.min(0.012, 0.3 / list.length) } });
    }
    renderGhost();
  }

  /** Синхронізує точки з даними: нові «випливають», зайві зникають. */
  function syncGlyph() {
    if (!L) return;
    const ch = S.current;
    const want = new Map();
    S.cells(ch).forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      if (FL.geo.inGrid(x, y, L.grid)) want.set(k, [x, y]);
    });
    Array.from(dots.keys()).forEach((k) => {
      if (!want.has(k)) removeDot(...dots.get(k)._xy);
    });
    want.forEach(([x, y], k) => {
      if (!dots.has(k)) addDot(ch, x, y);
    });
  }

  /** Оновлює форму точок без перебудови (зміна параметрів). */
  function refreshShapes() {
    if (!L) return;
    const ch = S.current;
    const p = S.params(ch);
    dots.forEach((g) => {
      const [x, y] = g._xy;
      g.firstChild.setAttribute('d', dotPath(ch, x, y, p));
    });
  }

  function renderGhost() {
    layers.ghost.innerHTML = '';
    if (!S.ui.guide || !L) return;
    const cells = FL.gen.fromTemplate(S.current, L.grid);
    cells.forEach(([x, y]) => {
      const [cx, cy] = cellCenter(x, y);
      layers.ghost.appendChild(svgEl('circle', { cx, cy, r: L.m.D * 0.16, class: 'ghost-dot' }));
    });
  }

  function addDot(ch, x, y) {
    const k = x + ',' + y;
    if (dots.has(k)) return;
    const g = makeDot(ch, x, y, S.params(ch));
    layers.dots.appendChild(g);
    dots.set(k, g);
    gsap.fromTo(g, { scale: 0 }, { scale: 1, duration: 0.36, ease: 'back.out(2.6)' });
  }
  function removeDot(x, y) {
    const k = x + ',' + y;
    const g = dots.get(k);
    if (!g) return;
    dots.delete(k);
    gsap.to(g, { scale: 0, duration: 0.16, ease: 'power2.in', onComplete: () => g.remove() });
  }

  // ── Малювання вказівником
  function cellAt(e) {
    if (!L) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const q = pt.matrixTransform(ctm.inverse());
    const { m, grid } = L;
    const col = Math.floor((q.x + m.G / 2) / m.P);
    const row = Math.floor((q.y + m.G / 2) / m.P);
    const x = col;
    const y = grid.rows + (grid.top || 0) - 1 - row;
    if (!FL.geo.inGrid(x, y, grid)) return null;
    return [x, y];
  }

  let painting = null;
  function apply(x, y) {
    const ch = S.current;
    const on = painting.mode === 'draw';
    if (S.setCell(ch, x, y, on)) {
      painting.changed = true;
      if (on) addDot(ch, x, y);
      else removeDot(x, y);
    }
  }
  function onDown(e) {
    if (e.button !== 0) return;
    const c = cellAt(e);
    if (!c) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const has = S.cells(S.current).has(c[0] + ',' + c[1]);
    painting = { mode: has ? 'erase' : 'draw', last: c, changed: false };
    hideHover();
    apply(c[0], c[1]);
  }
  function onMove(e) {
    const c = cellAt(e);
    if (!painting) {
      showHover(c);
      return;
    }
    if (!c) return;
    const [x0, y0] = painting.last;
    const [x1, y1] = c;
    if (x0 === x1 && y0 === y1) return;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 1; i <= steps; i++) apply(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps));
    painting.last = c;
  }
  function onUp() {
    if (!painting) return;
    const changed = painting.changed;
    painting = null;
    if (changed) S.commit();
  }

  let hoverKey = '';
  function showHover(c) {
    const k = c ? c[0] + ',' + c[1] : '';
    if (k === hoverKey) return;
    hoverKey = k;
    dots.forEach((g) => g.classList.remove('will-erase'));
    if (!c) return hideHover();
    if (dots.has(k)) {
      dots.get(k).classList.add('will-erase');
      hover.style.opacity = 0;
      svg.style.cursor = 'pointer';
      return;
    }
    hover.setAttribute('d', dotPath(S.current, c[0], c[1], S.params(S.current)));
    hover.style.opacity = '';
    svg.style.cursor = 'crosshair';
  }
  function hideHover() {
    hoverKey = '';
    if (hover) hover.style.opacity = 0;
    dots.forEach((g) => g.classList.remove('will-erase'));
  }

  // ── Інструменти
  const tools = {
    clear() {
      if (!S.cells(S.current).size) return;
      S.setCells(S.current, []);
      S.commit();
    },
    invert() {
      const g = L.grid;
      const cur = S.cells(S.current);
      const out = [];
      for (let y = -g.desc; y < g.rows + (g.top || 0); y++) for (let x = 0; x < g.cols; x++) if (!cur.has(x + ',' + y)) out.push([x, y]);
      S.setCells(S.current, out);
      S.commit();
    },
    flipH() {
      S.transform(S.current, (x, y, g) => [g.cols - 1 - x, y]);
      S.commit();
    },
    flipV() {
      S.transform(S.current, (x, y, g) => [x, g.rows + (g.top || 0) - 1 - g.desc - y]);
      S.commit();
    },
    shift(dx, dy) {
      S.transform(S.current, (x, y) => [x + dx, y + dy]);
      S.commit();
    },
    copy() {
      clipboard = Array.from(S.cells(S.current));
      FL.ui.toast('Гліф «' + S.current + '» скопійовано');
    },
    paste() {
      if (!clipboard) return FL.ui.toast('Спершу скопіюйте гліф');
      S.setCells(S.current, clipboard);
      S.commit();
    },
    generate() {
      const cells = FL.gen.fromTemplate(S.current, S.project.grid);
      if (!cells.length) return FL.ui.toast('Для «' + S.current + '» немає шаблону — намалюйте вручну або візьміть системний шрифт');
      S.setCells(S.current, cells);
      S.commit();
    },
  };

  function openGenerate(anchor) {
    const ui = FL.ui;
    const fam = ui.h('input', { class: 'field', value: S.ui.rasterFont || 'Helvetica', placeholder: 'Назва шрифту', spellcheck: 'false' });
    let weight = S.ui.rasterWeight || 400;
    const seg = ui.segmented({ options: [{ value: 400, label: 'Regular' }, { value: 700, label: 'Bold' }], value: weight, small: true, onChange: (v) => (weight = v) });
    let level = 0.42;
    const lv = ui.slider({ label: 'Поріг заповнення', min: 0.1, max: 0.9, step: 0.01, value: level, fmt: (v) => Math.round(v * 100) + '%', onInput: (v) => (level = v) });
    const hasTpl = FL.templates.has(S.current);
    const content = h(
      'div',
      { class: 'gen-pop' },
      h('button', { class: 'menu-item', disabled: !hasTpl, onclick: () => { ui.closePopover(); tools.generate(); } }, icon('wand'), h('span', null, h('b', { text: 'Із шаблону' }), h('small', { text: hasTpl ? 'Базова форма, підігнана під сітку' : 'Для цього символу шаблону немає' }))),
      h('div', { class: 'menu-sep' }),
      h('div', { class: 'menu-block' },
        h('b', { text: 'Із системного шрифту' }),
        h('small', { text: 'Розкладає літеру на клітинки. Найкраще працює на сітках від 7×9.' }),
        fam,
        seg.el,
        lv.el,
        h('button', {
          class: 'btn primary sm wide',
          text: 'Розкласти «' + S.current + '»',
          onclick: () => {
            S.ui.rasterFont = fam.value.trim();
            S.ui.rasterWeight = weight;
            S.saveUI();
            S.setCells(S.current, FL.gen.fromFont(S.current, S.project.grid, fam.value.trim(), weight, level));
            S.commit();
            ui.closePopover();
          },
        })
      )
    );
    ui.popover(anchor, content, { cls: 'wide' });
  }

  // ── Шапка редактора
  let head = {};
  function buildHead() {
    const root = document.getElementById('editorHead');
    const tb = (name, title, fn, cls) => h('button', { class: 'icon-btn' + (cls ? ' ' + cls : ''), title, 'aria-label': title, onclick: fn }, icon(name));
    head.char = h('div', { class: 'cur-char', 'aria-live': 'polite' });
    head.meta = h('div', { class: 'cur-meta' });
    head.ovr = h('button', { class: 'ovr-badge', title: 'Скинути всі налаштування цього гліфа', onclick: () => S.clearOverride(S.current) }, h('span'), icon('reset'));
    head.guide = tb('guide', 'Показати шаблон-підказку', () => {
      S.ui.guide = !S.ui.guide;
      S.saveUI();
      head.guide.classList.toggle('on', S.ui.guide);
      renderGhost();
    });
    head.guide.classList.toggle('on', !!S.ui.guide);
    head.removeCustom = h('button', { class: 'btn ghost sm', text: 'Видалити гліф', onclick: async () => {
      const ch = S.current;
      if (await FL.ui.confirmDialog('Видалити «' + ch + '»?', 'Гліф зникне з набору і з усіх накреслень.', 'Видалити', true)) {
        const list = S.charset();
        const i = list.indexOf(ch);
        S.removeCustom(ch);
        const next = S.charset();
        S.select(next[Math.min(i, next.length - 1)] || next[0]);
      }
    } });
    const genBtn = h('button', { class: 'btn sm', title: 'Згенерувати гліф' }, icon('wand'), h('span', { text: 'Згенерувати' }));
    genBtn.addEventListener('click', () => openGenerate(genBtn));
    root.append(
      h('div', { class: 'ed-id' },
        tb('left', 'Попередній гліф (←)', () => step(-1), 'nav'),
        head.char,
        tb('right', 'Наступний гліф (→)', () => step(1), 'nav'),
        h('div', { class: 'ed-meta' }, head.meta, h('div', { class: 'ed-meta-row' }, head.ovr, head.removeCustom))
      ),
      h('div', { class: 'ed-tools' },
        genBtn,
        h('span', { class: 'tool-sep' }),
        tb('clear', 'Очистити (Delete)', tools.clear),
        tb('invert', 'Інвертувати', tools.invert),
        tb('flipH', 'Віддзеркалити по горизонталі', tools.flipH),
        tb('flipV', 'Віддзеркалити по вертикалі', tools.flipV),
        h('span', { class: 'tool-sep' }),
        h('div', { class: 'nudge' },
          tb('left', 'Зсунути ліворуч (⇧←)', () => tools.shift(-1, 0)),
          h('div', { class: 'nudge-v' }, tb('up', 'Зсунути вгору (⇧↑)', () => tools.shift(0, 1)), tb('down', 'Зсунути вниз (⇧↓)', () => tools.shift(0, -1))),
          tb('right', 'Зсунути праворуч (⇧→)', () => tools.shift(1, 0))
        ),
        h('span', { class: 'tool-sep' }),
        tb('copy', 'Копіювати гліф (⌘C)', tools.copy),
        tb('paste', 'Вставити гліф (⌘V)', tools.paste),
        head.guide
      )
    );
  }

  function updateHead(animate) {
    const ch = S.current;
    const tab = FL.charset.TABS.find((t) => t.id === FL.charset.tabOf(ch, S.project));
    const drawn = S.isDrawn(ch);
    if (head.char.textContent !== ch) {
      head.char.textContent = ch === ' ' ? '␣' : ch;
      if (animate) gsap.fromTo(head.char, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' });
    }
    head.meta.innerHTML = '';
    head.meta.append(
      h('span', { text: FL.charset.codeLabel(ch) }),
      h('span', { text: tab ? tab.label : '' }),
      h('span', { class: drawn ? 'state ok' : 'state', text: drawn ? S.cells(ch).size + ' точок' : 'порожній' })
    );
    const st = S.style();
    const o = st.overrides[ch];
    const n = o ? Object.keys(o).length : 0;
    head.ovr.style.display = n ? '' : 'none';
    head.ovr.firstChild.textContent = 'Власні налаштування: ' + n;
    head.removeCustom.style.display = (S.project.custom || []).includes(ch) && FL.charset.tabOf(ch, S.project) === 'custom' ? '' : 'none';
  }

  function step(d) {
    const list = S.charset();
    const i = list.indexOf(S.current);
    const n = list[(i + d + list.length) % list.length];
    if (n) S.select(n);
  }

  function init() {
    svg = document.getElementById('editor');
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('pointerleave', () => !painting && hideHover());
    buildHead();

    S.on('project', (e) => {
      const g = S.project.grid;
      const m = FL.geo.metrics(g, S.style().params);
      const same = L && e && e.soft && L.grid.cols === g.cols && L.grid.rows === g.rows && L.grid.desc === g.desc && (L.grid.top || 0) === (g.top || 0) && Math.abs(m.P - L.m.P) < 1e-6;
      if (same) {
        L.grid = g;
        refreshShapes();
        syncGlyph();
        renderGhost();
      } else build();
      updateHead(false);
    });
    S.on('grid', () => { build(); updateHead(false); });
    S.on('charset', () => updateHead(false));
    S.on('select', () => { hideHover(); renderGlyph(true); updateHead(true); });
    S.on('glyph', (ch) => {
      if (ch !== S.current) return;
      if (!painting) syncGlyph();
      updateHead(false);
    });
    S.on('style', (e) => {
      if (e.all) {
        const m = FL.geo.metrics(S.project.grid, S.style().params);
        if (!L || Math.abs(m.P - L.m.P) > 1e-6) build();
        else refreshShapes();
      } else if (e.ch === S.current) refreshShapes();
      updateHead(false);
    });
    S.on('styles', () => updateHead(false));
  }

  FL.editor = { init, build, tools, step, renderGlyph };
})();
