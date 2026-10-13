/* Запуск: шапка, сімейство накреслень, гарячі клавіші. */
(function () {
  const FL = (window.FL = window.FL || {});
  const S = FL.store;
  const { h, icon } = FL.ui;

  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reducedMotion) gsap.globalTimeline.timeScale(40);

  /** Лого: T і G плавно з'їжджають на рядок угору (FON DOT → FONT DOG), пауза 3 с, назад, пауза 3 с — і по колу. */
  function animateLogo() {
    const slides = document.querySelectorAll('.logo-type .lt-slide');
    if (!slides.length || reducedMotion) return;
    const move = { duration: 0.9, ease: 'power3.inOut', stagger: 0.08 };
    gsap
      .timeline({ repeat: -1, delay: 3 })
      .to(slides, Object.assign({ yPercent: -100 }, move))
      .to(slides, Object.assign({ yPercent: 0 }, move), '+=3')
      .to({}, { duration: 3 });
  }

  // ── Назва шрифту, набрана самим шрифтом
  let wordmark;
  let wmRaf = 0;
  function paintWordmark() {
    if (wmRaf) return;
    wmRaf = requestAnimationFrame(() => {
      wmRaf = 0;
      if (!S.project) return;
      const st = S.style();
      const m = FL.geo.metrics(S.project.grid, st.params);
      const size = (22 / m.capH) * m.upm;
      const name = S.project.name;
      const w = Math.min(360, Math.ceil(FL.render.measure(name, size, st)) + 4);
      const k = size / m.upm;
      const cut = m.top * m.P * k;
      const hgt = Math.ceil((m.asc - m.des) * k - cut);
      wordmark.style.width = w + 'px';
      FL.render.drawText(wordmark, name, { size, color: FL.theme.colors.ink, wrap: false, width: w, height: hgt, leading: 1, padY: -cut });
    });
  }

  // ── Накреслення (пігулки в шапці)
  let famEl, famInd;
  function buildFamily(animate) {
    famEl.innerHTML = '';
    famInd = h('i', { class: 'fam-ind' });
    famEl.appendChild(famInd);
    S.project.styles.forEach((st) => {
      const b = h('button', { class: 'fam-pill', role: 'tab', 'data-id': st.id, title: st.name + ' · ' + st.weight + (st.id === S.project.activeStyle ? ' — натисніть, щоб змінити' : '') }, h('span', { text: st.name }), h('small', { text: String(st.weight) }));
      b.addEventListener('click', () => {
        if (st.id === S.project.activeStyle) FL.modals.editStylePopover(b, st);
        else S.setActiveStyle(st.id);
      });
      famEl.appendChild(b);
    });
    const add = h('button', { class: 'fam-add', title: 'Додати накреслення (Light, Bold…)', 'aria-label': 'Додати накреслення' }, icon('plus'));
    add.addEventListener('click', () => FL.modals.addStylePopover(add));
    famEl.appendChild(add);
    placeFam(animate);
  }
  function placeFam(animate) {
    const b = famEl.querySelector(`[data-id="${S.project.activeStyle}"]`);
    famEl.querySelectorAll('.fam-pill').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-selected', x === b);
    });
    if (!b) return;
    if (!b.offsetWidth) return requestAnimationFrame(() => placeFam(false));
    const props = { x: b.offsetLeft, width: b.offsetWidth };
    if (animate) gsap.to(famInd, Object.assign({ duration: 0.4, ease: 'expo.out' }, props));
    else gsap.set(famInd, props);
  }

  function initHeader() {
    wordmark = document.getElementById('wordmark');
    famEl = document.getElementById('family');
    document.getElementById('projectBtn').addEventListener('click', () => FL.modals.projects());
    document.getElementById('editSetBtn').addEventListener('click', () => FL.modals.wizard('edit'));
    document.getElementById('exportBtn').addEventListener('click', () => FL.modals.exportDialog());
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    undoBtn.addEventListener('click', S.undo);
    redoBtn.addEventListener('click', S.redo);
    const themeBtn = document.getElementById('themeBtn');
    themeBtn.addEventListener('click', () => {
      S.ui.theme = FL.theme.name === 'light' ? 'dark' : 'light';
      S.saveUI();
      FL.theme.set(S.ui.theme, true);
      gsap.fromTo(themeBtn.querySelector('svg'), { rotate: 0 }, { rotate: 180, duration: 0.5, ease: 'power3.inOut' });
    });
    const saveEl = document.getElementById('saveState');
    S.on('saving', () => {
      saveEl.textContent = 'Зберігаю…';
      saveEl.classList.add('busy');
    });
    S.on('saved', (ok) => {
      saveEl.textContent = ok ? 'Збережено' : 'Не вдалося зберегти';
      saveEl.classList.toggle('err', !ok);
      saveEl.classList.remove('busy');
    });
    const hist = () => {
      undoBtn.disabled = !S.canUndo();
      redoBtn.disabled = !S.canRedo();
    };
    S.on('history', hist);
    hist();

    S.on('project', () => { buildFamily(false); paintWordmark(); });
    S.on('styles', () => { buildFamily(true); paintWordmark(); });
    S.on('name', paintWordmark);
    S.on('style', paintWordmark);
    S.on('grid', paintWordmark);
    S.on('glyph', paintWordmark);
    S.on('paint', paintWordmark);
    window.addEventListener('resize', () => placeFam(false));
  }

  // ── Гарячі клавіші
  function typing() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }
  function onKey(e) {
    if (!S.project || FL.ui.modalOpen()) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      if (typing()) return;
      e.preventDefault();
      if (e.shiftKey) S.redo();
      else S.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      if (typing()) return;
      e.preventDefault();
      S.redo();
      return;
    }
    if (typing()) return;
    if (mod && e.key.toLowerCase() === 'c' && !String(window.getSelection())) {
      e.preventDefault();
      FL.editor.tools.copy();
      return;
    }
    if (mod && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      FL.editor.tools.paste();
      return;
    }
    if (mod || e.altKey) return;
    const a = document.activeElement;
    if (a && a.getAttribute && a.getAttribute('role') === 'slider') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.shiftKey) {
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
        FL.editor.tools.shift(d[0], d[1]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') FL.editor.step(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      FL.editor.tools.clear();
      return;
    }
    if (e.key.length === 1 || Array.from(e.key).length === 1) {
      const ch = e.key;
      if (ch !== ' ' && S.charset().includes(ch)) {
        e.preventDefault();
        S.select(ch);
      }
    }
  }

  // ── Старт
  let started = false;
  function start() {
    if (started) return;
    started = true;
    FL.editor.init();
    FL.glyphs.init();
    FL.controls.init();
    FL.tester.init();
    initHeader();
    S.emit('project', { soft: false });
    document.body.classList.add('ready');
    gsap.from(['.top', '.glyphs-panel', '.stage', '.controls-panel'], { opacity: 0, y: 14, duration: 0.6, ease: 'expo.out', stagger: 0.07 });
  }

  function boot() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!S.ui.theme || !FL.render.THEMES[S.ui.theme]) S.ui.theme = prefersDark ? 'dark' : 'light';
    FL.theme.set(S.ui.theme, false);
    animateLogo();
    document.addEventListener('keydown', onKey);
    if (S.restoreLast()) start();
    else {
      S.on('project', start);
      document.body.classList.add('ready');
      FL.modals.wizard('new');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
