/* Стан застосунку: проєкти, накреслення, гліфи, історія, автозбереження. */
(function () {
  const FL = (window.FL = window.FL || {});
  const { DEFAULT_PARAMS, GLYPH_KEYS } = FL.geo;
  const LS_INDEX = 'fontlab:index';
  const LS_PROJECT = 'fontlab:p:';
  const LS_LAST = 'fontlab:last';
  const LS_UI = 'fontlab:ui';

  const listeners = {};
  const on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  const emit = (ev, data) => (listeners[ev] || []).forEach((fn) => fn(data));

  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  function safeGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function safeSet(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function safeDel(k) {
    try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
  }

  const WEIGHT_NAMES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };

  function makeStyle(name, weight, params) {
    return { id: uid(), name, weight, params: Object.assign({}, DEFAULT_PARAMS, params || {}), overrides: {} };
  }

  // ── Серіалізація: у пам'яті гліфи — Set("x,y"), у сховищі — масиви
  function serialize(p) {
    const glyphs = {};
    Object.keys(p.glyphs).forEach((ch) => (glyphs[ch] = Array.from(p.glyphs[ch])));
    return JSON.stringify(Object.assign({}, p, { glyphs }));
  }
  /** Незмінені шаблонні гліфи (Й, Ї) переводить на версію під нову висоту сітки. */
  function retemplate(p, before, after) {
    const changed = [];
    Object.keys(FL.templates.TALL).forEach((ch) => {
      const g = p.glyphs[ch];
      if (!g) return;
      const was = FL.gen.fromTemplate(ch, before).map(([x, y]) => x + ',' + y);
      if (was.length !== g.size || !was.every((k) => g.has(k))) return;
      p.glyphs[ch] = new Set(FL.gen.fromTemplate(ch, after).map(([x, y]) => x + ',' + y));
      changed.push(ch);
    });
    return changed;
  }

  function hydrate(json) {
    const p = typeof json === 'string' ? JSON.parse(json) : json;
    const glyphs = {};
    Object.keys(p.glyphs || {}).forEach((ch) => (glyphs[ch] = new Set(p.glyphs[ch])));
    p.glyphs = glyphs;
    p.grid = Object.assign({ cols: 5, rows: 7, desc: 2 }, p.grid);
    if (p.grid.top === undefined) {
      p.grid.top = 2;
      retemplate(p, Object.assign({}, p.grid, { top: 0 }), p.grid);
    }
    p.custom = p.custom || [];
    p.styles = (p.styles || []).map((s) => Object.assign(s, { params: Object.assign({}, DEFAULT_PARAMS, s.params), overrides: s.overrides || {} }));
    if (!p.styles.length) p.styles.push(makeStyle('Regular', 400));
    if (!p.styles.find((s) => s.id === p.activeStyle)) p.activeStyle = p.styles[0].id;
    return p;
  }

  const S = {
    project: null,
    ui: Object.assign(
      { theme: null, tab: 'latin', scope: 'font', guide: false, sections: {}, tester: { text: '', size: 56, tracking: 0, leading: 1.15, invert: false, sample: 0 } },
      JSON.parse(safeGet(LS_UI) || '{}')
    ),
    current: 'A',
    rev: { style: 1, glyph: {} },
    on,
    emit,
  };

  // ── Доступ
  S.style = () => S.project.styles.find((s) => s.id === S.project.activeStyle) || S.project.styles[0];
  S.charset = () => FL.charset.charsetOf(S.project);
  S.cells = (ch) => S.project.glyphs[ch] || new Set();
  S.isDrawn = (ch) => {
    const g = S.project.glyphs[ch];
    if (!g || !g.size) return false;
    const grid = S.project.grid;
    for (const k of g) {
      const i = k.indexOf(',');
      if (FL.geo.inGrid(+k.slice(0, i), +k.slice(i + 1), grid)) return true;
    }
    return false;
  };
  S.params = (ch, style) => {
    const st = style || S.style();
    const o = ch && st.overrides[ch];
    return o ? Object.assign({}, st.params, o) : st.params;
  };
  S.hasOverride = (ch, style) => {
    const o = (style || S.style()).overrides[ch];
    return !!(o && Object.keys(o).length);
  };
  S.glyphKey = (ch, style) => (style || S.style()).id + ':' + S.rev.style + ':' + (S.rev.glyph[ch] || 0);

  // ── Збереження
  let saveTimer = 0;
  function persist() {
    if (!S.project) return;
    S.project.updated = Date.now();
    const ok = safeSet(LS_PROJECT + S.project.id, serialize(S.project));
    const idx = listProjects().filter((x) => x.id !== S.project.id);
    idx.unshift({ id: S.project.id, name: S.project.name, updated: S.project.updated, count: S.charset().length });
    safeSet(LS_INDEX, JSON.stringify(idx));
    safeSet(LS_LAST, S.project.id);
    emit('saved', ok);
  }
  S.save = () => {
    emit('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 220);
  };
  S.saveUI = () => safeSet(LS_UI, JSON.stringify(S.ui));

  function listProjects() {
    try { return JSON.parse(safeGet(LS_INDEX) || '[]'); } catch (e) { return []; }
  }
  S.listProjects = listProjects;

  // ── Історія (знімки стану)
  const history = { stack: [], index: -1 };
  function snapshot() {
    const p = S.project;
    const glyphs = {};
    Object.keys(p.glyphs).forEach((ch) => (glyphs[ch] = Array.from(p.glyphs[ch])));
    return JSON.stringify({ grid: p.grid, sets: p.sets, custom: p.custom, glyphs, styles: p.styles, activeStyle: p.activeStyle, name: p.name });
  }
  function resetHistory() {
    history.stack = [snapshot()];
    history.index = 0;
    emit('history');
  }
  S.commit = () => {
    const snap = snapshot();
    if (history.stack[history.index] === snap) return;
    history.stack.length = history.index + 1;
    history.stack.push(snap);
    if (history.stack.length > 150) history.stack.shift();
    history.index = history.stack.length - 1;
    emit('history');
    S.save();
  };
  function restore(snap) {
    const d = JSON.parse(snap);
    const p = S.project;
    p.grid = d.grid;
    p.sets = d.sets;
    p.custom = d.custom;
    p.name = d.name;
    p.glyphs = {};
    Object.keys(d.glyphs).forEach((ch) => (p.glyphs[ch] = new Set(d.glyphs[ch])));
    p.styles = d.styles;
    p.activeStyle = d.activeStyle;
    S.rev.style++;
    S.rev.glyph = {};
    emit('project', { soft: true });
    S.save();
  }
  S.canUndo = () => history.index > 0;
  S.canRedo = () => history.index < history.stack.length - 1;
  S.undo = () => {
    if (!S.canUndo()) return;
    history.index--;
    restore(history.stack[history.index]);
    emit('history');
  };
  S.redo = () => {
    if (!S.canRedo()) return;
    history.index++;
    restore(history.stack[history.index]);
    emit('history');
  };

  // ── Проєкти
  S.newProject = (opts) => {
    const p = {
      id: uid(),
      name: opts.name || 'Без назви',
      created: Date.now(),
      updated: Date.now(),
      grid: Object.assign({ cols: 5, rows: 7, desc: 2, top: 2 }, opts.grid),
      sets: Object.assign({}, opts.sets),
      custom: opts.custom || [],
      glyphs: {},
      styles: [makeStyle('Regular', 400)],
    };
    p.activeStyle = p.styles[0].id;
    if (opts.prefill) {
      FL.charset.charsetOf(p).forEach((ch) => {
        const cells = FL.gen.fromTemplate(ch, p.grid);
        if (cells.length) p.glyphs[ch] = new Set(cells.map(([x, y]) => x + ',' + y));
      });
    }
    S.load(p);
    persist();
    return p;
  };

  S.load = (p) => {
    S.project = p;
    S.rev.style++;
    S.rev.glyph = {};
    const cs = S.charset();
    if (!cs.includes(S.current)) S.current = cs[0] || 'A';
    const tab = FL.charset.tabOf(S.current, p);
    S.ui.tab = tab;
    resetHistory();
    emit('project', { soft: false });
  };

  S.openProject = (id) => {
    const raw = safeGet(LS_PROJECT + id);
    if (!raw) return false;
    S.load(hydrate(raw));
    safeSet(LS_LAST, id);
    return true;
  };

  S.restoreLast = () => {
    const id = safeGet(LS_LAST);
    if (id && S.openProject(id)) return true;
    const list = listProjects();
    return list.length ? S.openProject(list[0].id) : false;
  };

  S.duplicateProject = (id) => {
    const raw = safeGet(LS_PROJECT + id);
    if (!raw) return;
    const p = hydrate(raw);
    p.id = uid();
    p.name = p.name + ' копія';
    p.created = p.updated = Date.now();
    S.load(p);
    persist();
  };

  S.deleteProject = (id) => {
    safeDel(LS_PROJECT + id);
    safeSet(LS_INDEX, JSON.stringify(listProjects().filter((x) => x.id !== id)));
    if (S.project && S.project.id === id) {
      S.project = null;
      if (!S.restoreLast()) emit('noproject');
    }
  };

  S.exportProjectJSON = () => serialize(S.project);
  S.importProjectJSON = (text) => {
    const p = hydrate(text);
    p.id = uid();
    p.updated = Date.now();
    S.load(p);
    persist();
  };

  S.rename = (name) => {
    S.project.name = name.trim() || 'Без назви';
    emit('name');
    S.commit();
  };

  // ── Гліфи
  S.select = (ch) => {
    if (!ch) return;
    S.current = ch;
    const tab = FL.charset.tabOf(ch, S.project);
    if (tab !== S.ui.tab) {
      S.ui.tab = tab;
      emit('tab');
    }
    emit('select', ch);
  };

  S.setCell = (ch, x, y, on) => {
    let g = S.project.glyphs[ch];
    if (!g) g = S.project.glyphs[ch] = new Set();
    const k = x + ',' + y;
    if (on === g.has(k)) return false;
    if (on) g.add(k);
    else g.delete(k);
    S.rev.glyph[ch] = (S.rev.glyph[ch] || 0) + 1;
    emit('glyph', ch);
    S.save();
    return true;
  };

  S.setCells = (ch, cells) => {
    S.project.glyphs[ch] = new Set(cells.map((c) => (Array.isArray(c) ? c[0] + ',' + c[1] : c)));
    S.rev.glyph[ch] = (S.rev.glyph[ch] || 0) + 1;
    emit('glyph', ch);
    S.save();
  };

  S.transform = (ch, fn) => {
    const g = S.cells(ch);
    const grid = S.project.grid;
    const next = [];
    g.forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      const r = fn(x, y, grid);
      if (r) next.push(r);
    });
    S.setCells(ch, next);
  };

  S.addCustom = (chars) => {
    const added = [];
    Array.from(chars).forEach((ch) => {
      if (/\s/.test(ch)) return;
      if (S.charset().includes(ch)) return;
      S.project.custom.push(ch);
      added.push(ch);
    });
    if (added.length) {
      emit('charset');
      S.commit();
    }
    return added;
  };

  S.removeCustom = (ch) => {
    S.project.custom = S.project.custom.filter((c) => c !== ch);
    delete S.project.glyphs[ch];
    emit('charset');
    S.commit();
  };

  S.setCharset = (sets, custom) => {
    S.project.sets = Object.assign({}, sets);
    S.project.custom = custom;
    if (!S.charset().includes(S.current)) S.current = S.charset()[0] || 'A';
    S.ui.tab = FL.charset.tabOf(S.current, S.project);
    emit('charset');
    S.commit();
  };

  // ── Параметри
  S.setGrid = (key, value) => {
    const before = Object.assign({}, S.project.grid);
    S.project.grid[key] = value;
    S.rev.style++;
    if (key === 'top') retemplate(S.project, before, S.project.grid).forEach((ch) => (S.rev.glyph[ch] = (S.rev.glyph[ch] || 0) + 1));
    emit('grid');
    S.save();
  };

  S.setParam = (key, value, scope) => {
    const st = S.style();
    if (scope === 'glyph' && GLYPH_KEYS.includes(key)) {
      const ch = S.current;
      const o = (st.overrides[ch] = st.overrides[ch] || {});
      o[key] = value;
      S.rev.glyph[ch] = (S.rev.glyph[ch] || 0) + 1;
      emit('style', { ch });
    } else {
      st.params[key] = value;
      S.rev.style++;
      emit('style', { all: true });
    }
    S.save();
  };

  S.clearOverride = (ch, key) => {
    const st = S.style();
    const o = st.overrides[ch];
    if (!o) return;
    if (key) delete o[key];
    if (!key || !Object.keys(o).length) delete st.overrides[ch];
    S.rev.glyph[ch] = (S.rev.glyph[ch] || 0) + 1;
    emit('style', { ch });
    S.commit();
  };

  // ── Накреслення (сімейство)
  S.setActiveStyle = (id) => {
    if (S.project.activeStyle === id) return;
    S.project.activeStyle = id;
    emit('styles');
    emit('style', { all: true });
    S.save();
  };

  S.duplicateStyle = (name, weight) => {
    const src = S.style();
    const st = makeStyle(name, weight, src.params);
    st.overrides = JSON.parse(JSON.stringify(src.overrides));
    const i = S.project.styles.indexOf(src);
    S.project.styles.splice(i + 1, 0, st);
    S.project.styles.sort((a, b) => a.weight - b.weight);
    S.project.activeStyle = st.id;
    emit('styles');
    emit('style', { all: true });
    S.commit();
    return st;
  };

  S.updateStyle = (id, patch) => {
    const st = S.project.styles.find((s) => s.id === id);
    if (!st) return;
    Object.assign(st, patch);
    S.project.styles.sort((a, b) => a.weight - b.weight);
    emit('styles');
    S.commit();
  };

  S.deleteStyle = (id) => {
    if (S.project.styles.length < 2) return;
    S.project.styles = S.project.styles.filter((s) => s.id !== id);
    if (S.project.activeStyle === id) S.project.activeStyle = S.project.styles[0].id;
    emit('styles');
    emit('style', { all: true });
    S.commit();
  };

  S.WEIGHT_NAMES = WEIGHT_NAMES;
  S.makeStyle = makeStyle;
  S.hydrate = hydrate;
  FL.store = S;
})();
