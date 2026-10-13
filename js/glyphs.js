/* Ліва панель: вкладки наборів і сітка карток гліфів. */
(function () {
  const FL = (window.FL = window.FL || {});
  const S = FL.store;
  const { h, icon } = FL.ui;

  let tabsEl, indEl, scrollEl, progText, progBar;
  const tabBtns = new Map();
  const cards = new Map();
  let dirty = new Set();
  let dirtyAll = false;
  let raf = 0;

  function counts(tab) {
    let total = 0;
    let drawn = 0;
    FL.charset.groupsFor(tab, S.project).forEach((g) =>
      g.list.forEach((ch) => {
        total++;
        if (S.isDrawn(ch)) drawn++;
      })
    );
    return { total, drawn };
  }

  function buildTabs() {
    tabsEl.innerHTML = '';
    tabBtns.clear();
    indEl = h('i', { class: 'tab-ind' });
    tabsEl.appendChild(indEl);
    FL.charset.TABS.forEach((t) => {
      const cnt = h('span', { class: 'tab-count' });
      const b = h('button', { class: 'tab', role: 'tab', 'data-tab': t.id, onclick: () => switchTab(t.id) }, h('span', { class: 'tab-label', text: t.label }), cnt);
      b._cnt = cnt;
      tabBtns.set(t.id, b);
      tabsEl.appendChild(b);
    });
    updateCounts();
    placeIndicator(false);
  }

  function placeIndicator(animate) {
    const b = tabBtns.get(S.ui.tab);
    tabBtns.forEach((x, id) => {
      x.classList.toggle('on', id === S.ui.tab);
      x.setAttribute('aria-selected', id === S.ui.tab);
    });
    if (!b) return;
    if (!b.offsetWidth) return requestAnimationFrame(() => placeIndicator(false));
    const props = { x: b.offsetLeft, y: b.offsetTop, width: b.offsetWidth, height: b.offsetHeight };
    if (animate) gsap.to(indEl, Object.assign({ duration: 0.36, ease: 'power3.out' }, props));
    else gsap.set(indEl, props);
    if (animate) b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  function updateCounts() {
    let all = 0;
    let done = 0;
    FL.charset.TABS.forEach((t) => {
      const c = counts(t.id);
      const b = tabBtns.get(t.id);
      if (b) {
        b._cnt.textContent = !c.total ? '' : c.drawn === c.total ? String(c.total) : c.drawn + '/' + c.total;
        b.classList.toggle('muted', !c.total && t.id !== 'custom');
      }
    });
    S.charset().forEach((ch) => {
      all++;
      if (S.isDrawn(ch)) done++;
    });
    progText.textContent = done + ' з ' + all + ' гліфів намальовано';
    gsap.to(progBar, { scaleX: all ? done / all : 0, duration: 0.5, ease: 'power3.out' });
  }

  function switchTab(id) {
    if (S.ui.tab === id) return;
    S.ui.tab = id;
    S.saveUI();
    placeIndicator(true);
    buildGrid(true);
    const first = FL.charset.groupsFor(id, S.project).reduce((a, g) => a || g.list[0], null);
    if (first && FL.charset.tabOf(S.current, S.project) !== id) S.select(first);
  }

  function makeCard(ch) {
    const canvas = h('canvas');
    const el = h(
      'button',
      { class: 'gcard', 'data-ch': ch, title: ch + ' · ' + FL.charset.codeLabel(ch), onclick: () => S.select(ch) },
      canvas,
      h('span', { class: 'gc-ph', text: ch }),
      h('span', { class: 'gc-lbl', text: ch }),
      h('i', { class: 'gc-ovr' })
    );
    el._canvas = canvas;
    cards.set(ch, el);
    return el;
  }

  function cardState(ch) {
    const el = cards.get(ch);
    if (!el) return;
    el.classList.toggle('active', ch === S.current);
    el.classList.toggle('empty', !S.isDrawn(ch));
    el.classList.toggle('ovr', S.hasOverride(ch));
  }

  function paintCard(ch) {
    const el = cards.get(ch);
    if (!el) return;
    cardState(ch);
    const c = FL.theme.colors;
    FL.render.drawCard(el._canvas, ch, ch === S.current ? c.bg : c.ink);
  }

  function schedule(ch) {
    if (ch) dirty.add(ch);
    else dirtyAll = true;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (dirtyAll) cards.forEach((_, k) => paintCard(k));
      else dirty.forEach((k) => paintCard(k));
      dirty = new Set();
      dirtyAll = false;
    });
  }

  function addCustomPopover(anchor) {
    const input = h('input', { class: 'field big', placeholder: '✓ ✕ ☺ ẞ', spellcheck: 'false', autocomplete: 'off' });
    const go = () => {
      const added = S.addCustom(input.value);
      FL.ui.closePopover();
      if (added.length) {
        S.select(added[0]);
        FL.ui.toast(added.length === 1 ? 'Додано гліф «' + added[0] + '»' : 'Додано гліфів: ' + added.length);
      } else if (input.value.trim()) FL.ui.toast('Ці символи вже є в наборі');
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') go();
    });
    FL.ui.popover(
      anchor,
      h('div', { class: 'menu-block' }, h('b', { text: 'Новий гліф' }), h('small', { text: 'Введіть або вставте один чи кілька символів Unicode.' }), input, h('button', { class: 'btn primary sm wide', text: 'Додати до набору', onclick: go }))
    );
    setTimeout(() => input.focus(), 30);
  }

  function buildGrid(animate) {
    scrollEl.innerHTML = '';
    cards.clear();
    const tab = S.ui.tab;
    const groups = FL.charset.groupsFor(tab, S.project);
    const sections = [];
    if (tab !== 'custom' && !groups.length) {
      const sets = FL.charset.setsForTab(tab);
      scrollEl.appendChild(
        h('div', { class: 'empty-state' },
          h('p', { text: 'Цих символів немає у наборі шрифту.' }),
          h('button', { class: 'btn sm', text: 'Додати ' + sets.map((s) => s.label).join(', '), onclick: () => {
            const next = Object.assign({}, S.project.sets);
            sets.forEach((s) => (next[s.id] = true));
            S.setCharset(next, S.project.custom);
            S.charset().forEach((ch) => {
              if (!S.project.glyphs[ch] && FL.charset.tabOf(ch, S.project) === tab) {
                const cells = FL.gen.fromTemplate(ch, S.project.grid);
                if (cells.length) S.setCells(ch, cells);
              }
            });
            S.commit();
          } })
        )
      );
      return;
    }
    groups.forEach((g) => {
      const grid = h('div', { class: 'gc-grid' });
      g.list.forEach((ch) => grid.appendChild(makeCard(ch)));
      if (tab === 'custom') {
        const add = h('button', { class: 'gcard add', title: 'Додати власний гліф', 'aria-label': 'Додати власний гліф' }, icon('plus'));
        add.addEventListener('click', () => addCustomPopover(add));
        grid.appendChild(add);
      }
      const sec = h('section', { class: 'gc-sec' }, h('div', { class: 'gc-head' }, h('span', { text: g.group }), h('span', { class: 'gc-n', text: g.list.length ? String(g.list.length) : '' })), grid);
      if (tab === 'custom' && !g.list.length) sec.appendChild(h('p', { class: 'gc-hint', text: 'Тут живуть ваші гліфи: іконки, стрілки, лігатурні знаки. Натисніть «+», щоб додати.' }));
      scrollEl.appendChild(sec);
      sections.push(sec);
    });
    schedule();
    if (animate) {
      const all = scrollEl.querySelectorAll('.gcard');
      gsap.fromTo(all, { opacity: 0, y: 8, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out', stagger: { each: Math.min(0.008, 0.35 / all.length) } });
    }
    requestAnimationFrame(() => {
      const cur = cards.get(S.current);
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    });
  }

  function init() {
    tabsEl = document.getElementById('tabs');
    scrollEl = document.getElementById('glyphScroll');
    progText = document.getElementById('progressText');
    progBar = document.getElementById('progressBar');

    document.getElementById('fillMissingBtn').addEventListener('click', () => {
      let n = 0;
      S.charset().forEach((ch) => {
        if (S.isDrawn(ch)) return;
        const cells = FL.gen.fromTemplate(ch, S.project.grid);
        if (cells.length) {
          S.setCells(ch, cells);
          n++;
        }
      });
      if (n) {
        S.commit();
        FL.ui.toast('Згенеровано порожніх гліфів: ' + n);
      } else FL.ui.toast('Порожніх гліфів із шаблонами немає');
    });

    new ResizeObserver(() => schedule()).observe(scrollEl);
    window.addEventListener('resize', () => placeIndicator(false));

    S.on('project', () => { buildTabs(); buildGrid(false); });
    S.on('charset', () => { buildTabs(); buildGrid(false); });
    S.on('tab', () => { placeIndicator(true); buildGrid(true); });
    S.on('grid', () => { schedule(); updateCounts(); });
    S.on('style', (e) => schedule(e.all ? null : e.ch));
    S.on('paint', () => schedule());
    S.on('glyph', (ch) => { schedule(ch); updateCounts(); });
    let prev = null;
    S.on('select', (ch) => {
      if (prev && prev !== ch) schedule(prev);
      schedule(ch);
      prev = ch;
      const el = cards.get(ch);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        gsap.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      }
    });
  }

  FL.glyphs = { init, schedule, updateCounts };
})();
