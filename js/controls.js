/* Права панель: налаштування сітки, точки, випадковості й threshold-текстури. */
(function () {
  const FL = (window.FL = window.FL || {});
  const S = FL.store;
  const { h, icon } = FL.ui;

  const pct = (v) => Math.round(v * 100) + '%';
  const int100 = (v) => String(Math.round(v * 100));
  const cellsFmt = (v) => (Math.round(v * 100) / 100).toString().replace('.', ',') + ' кл.';
  const deg = (v) => Math.round(v) + '°';
  const P100 = { toInput: (v) => Math.round(v * 100), fromInput: (n) => n / 100 };

  const SECTIONS = [
    {
      id: 'grid',
      title: 'Сітка',
      note: 'спільна для сімейства',
      family: true,
      items: [
        { key: 'cols', type: 'stepper', label: 'Колонки', min: 3, max: 12, target: 'grid' },
        { key: 'rows', type: 'stepper', label: 'Рядки', min: 5, max: 16, target: 'grid' },
        { key: 'top', type: 'stepper', label: 'Рядки над великими літерами', min: 0, max: 4, target: 'grid' },
        { key: 'desc', type: 'stepper', label: 'Рядки під базовою лінією', min: 0, max: 4, target: 'grid' },
        { key: 'gap', type: 'slider', label: 'Відстань між клітинками', min: 0, max: 1, step: 0.01, fmt: pct, io: P100, family: true },
      ],
    },
    {
      id: 'rhythm',
      title: 'Ритм',
      family: true,
      items: [
        { key: 'spacing', type: 'slider', label: 'Міжлітерний інтервал', min: 0, max: 4, step: 0.25, fmt: cellsFmt, family: true },
        { key: 'wordSpace', type: 'slider', label: 'Ширина пробілу', min: 1, max: 8, step: 0.5, fmt: cellsFmt, family: true },
        { key: 'mono', type: 'seg', label: 'Ширина гліфів', options: [{ value: false, label: 'Пропорційна' }, { value: true, label: 'Моноширинна' }], family: true },
      ],
    },
    {
      id: 'dot',
      title: 'Точка',
      items: [
        { key: 'size', type: 'slider', label: 'Розмір', min: 0.4, max: 1.3, step: 0.01, fmt: pct, io: P100, origin: 1 },
        { key: 'outline', type: 'slider', label: 'Товщина обведення', min: 0, max: 0.5, step: 0.005, fmt: pct, io: P100, hint: 'Обведення додає вагу точці. Для сімейства: Light — тонке, Bold — товсте.' },
        { key: 'fill', type: 'seg', label: 'Заливка', options: [{ value: true, label: 'Суцільна' }, { value: false, label: 'Лише контур' }] },
      ],
    },
    {
      id: 'vary',
      title: 'Випадковість',
      seed: 'varSeed',
      items: [
        { key: 'ovalAmount', type: 'slider', label: 'Скільки точок овальні', min: 0, max: 1, step: 0.01, fmt: pct, io: P100 },
        { key: 'ovalStretch', type: 'slider', label: 'Витягнутість овалу', min: 0, max: 1, step: 0.01, fmt: pct, io: P100 },
        { key: 'angle', type: 'slider', label: 'Кут нахилу', min: -90, max: 90, step: 1, fmt: deg, origin: 0 },
        { key: 'angleSpread', type: 'slider', label: 'Розкид кута', min: 0, max: 180, step: 1, fmt: deg },
        { key: 'sizeJitter', type: 'slider', label: 'Розкид розміру', min: 0, max: 0.1, step: 0.005, fmt: (v) => '±' + (Math.round(v * 1000) / 10).toString().replace('.', ',') + '%', io: P100 },
      ],
    },
    {
      id: 'tex',
      title: 'Threshold',
      toggle: 'tex',
      seed: 'texSeed',
      items: [
        { key: 'threshold', type: 'slider', label: 'Поріг', min: 0, max: 1, step: 0.01, fmt: int100, io: P100, origin: 0.5, hint: 'Нижче — точки товщають і зливаються, вище — худнуть' },
        { key: 'blur', type: 'slider', label: 'Розмиття', min: 0, max: 1, step: 0.01, fmt: int100, io: P100, hint: 'Наскільки далеко може «гуляти» край. 0 — ідеальне коло' },
        { key: 'noise', type: 'slider', label: 'Шум', min: 0, max: 1.5, step: 0.01, fmt: int100, io: P100 },
        { key: 'grain', type: 'slider', label: 'Зерно', min: 0, max: 1, step: 0.01, fmt: int100, io: P100, hint: 'Розмір горбиків: менше — великі горби, більше — дрібне зерно' },
        { key: 'detail', type: 'slider', label: 'Рваність краю', min: 0, max: 1, step: 0.01, fmt: int100, io: P100 },
      ],
    },
  ];

  let root, scopeSeg, scopeNote;
  const ctl = new Map(); // key → {api, item, wrap}
  const sectionEls = new Map();

  const scope = () => S.ui.scope;
  const glyphMode = () => scope() === 'glyph';
  const current = (item) => (item.target === 'grid' ? S.project.grid[item.key] : glyphMode() ? S.params(S.current)[item.key] : S.style().params[item.key]);
  const isGlyphKey = (k) => FL.geo.GLYPH_KEYS.includes(k);

  function setValue(item, v) {
    if (item.target === 'grid') return S.setGrid(item.key, v);
    if (item.key !== 'tex' && SECTIONS.find((s) => s.id === 'tex').items.some((i) => i.key === item.key) && !current({ key: 'tex' })) {
      S.setParam('tex', true, scope());
    }
    S.setParam(item.key, v, glyphMode() && isGlyphKey(item.key) ? 'glyph' : 'font');
  }
  const resetOverride = (key) => S.clearOverride(S.current, key);

  function makeControl(item) {
    let api;
    if (item.type === 'slider') {
      api = FL.ui.slider({
        label: item.label,
        min: item.min,
        max: item.max,
        step: item.step,
        value: current(item),
        def: FL.geo.DEFAULT_PARAMS[item.key],
        origin: item.origin,
        fmt: item.fmt,
        hint: item.hint,
        toInput: item.io && item.io.toInput,
        fromInput: item.io && item.io.fromInput,
        onInput: (v) => setValue(item, v),
        onChange: () => S.commit(),
        onReset: () => resetOverride(item.key),
      });
    } else if (item.type === 'stepper') {
      api = FL.ui.stepper({
        label: item.label,
        min: item.min,
        max: item.max,
        value: current(item),
        onChange: (v) => {
          setValue(item, v);
          S.commit();
        },
      });
    } else if (item.type === 'seg') {
      const ovr = h('button', { class: 'ctl-ovr', title: 'Повернути значення шрифту', onclick: () => resetOverride(item.key) }, icon('reset'));
      api = FL.ui.segmented({
        label: item.label,
        options: item.options,
        value: current(item),
        ovr,
        onChange: (v) => {
          setValue(item, v);
          S.commit();
        },
      });
      api.setOverridden = (b) => api.el.classList.toggle('overridden', !!b);
      api.setDisabled = (b) => api.el.classList.toggle('disabled', !!b);
    }
    ctl.set(item.key, { api, item });
    return api.el;
  }

  function buildSection(sec) {
    const body = h('div', { class: 'sec-body' });
    const inner = h('div', { class: 'sec-inner' });
    sec.items.forEach((it) => inner.appendChild(makeControl(it)));
    if (sec.seed) {
      const seedRow = h('div', { class: 'seed-row' },
        h('span', { class: 'ctl-label', text: 'Варіант розкладу' }),
        h('span', { class: 'seed-val' }),
        FL.ui.dice({ title: 'Інший випадковий розклад', label: 'Перемішати', onClick: () => {
          setValue({ key: sec.seed }, 1 + Math.floor(Math.random() * 99999));
          S.commit();
        } })
      );
      seedRow._seedKey = sec.seed;
      inner.appendChild(seedRow);
      sectionEls.set(sec.id + ':seed', seedRow);
    }
    if (sec.id === 'grid') {
      inner.appendChild(
        h('button', { class: 'btn ghost sm wide', text: 'Перегенерувати гліфи під цю сітку', onclick: async () => {
          const ok = await FL.ui.confirmDialog('Перегенерувати гліфи?', 'Усі гліфи, що мають шаблон, буде перемальовано під сітку ' + S.project.grid.cols + '×' + S.project.grid.rows + '. Ваші правки в них зникнуть (можна скасувати через ⌘Z).', 'Перегенерувати');
          if (!ok) return;
          S.charset().forEach((ch) => {
            const cells = FL.gen.fromTemplate(ch, S.project.grid);
            if (cells.length) S.setCells(ch, cells);
          });
          S.commit();
          FL.ui.toast('Гліфи підігнано під нову сітку');
        } })
      );
    }
    body.appendChild(inner);

    const chev = h('span', { class: 'sec-chev' }, icon('chevron'));
    let tgl = null;
    if (sec.toggle) {
      tgl = FL.ui.toggle({ label: sec.title, value: current({ key: sec.toggle }), onChange: (v) => {
        setValue({ key: sec.toggle }, v);
        S.commit();
      } });
      ctl.set(sec.toggle, { api: tgl, item: { key: sec.toggle } });
    }
    const headBtn = h('button', { class: 'sec-title' }, h('span', { text: sec.title }), sec.note ? h('small', { text: sec.note }) : null);
    const head = h('div', { class: 'sec-head' }, headBtn, tgl ? tgl.el : null, chev);
    const el = h('section', { class: 'sec' + (sec.note ? ' has-note' : ''), 'data-sec': sec.id }, head, body);
    const collapsed = !!S.ui.sections[sec.id];
    if (collapsed) {
      el.classList.add('collapsed');
      body.style.height = '0px';
    }
    const toggleOpen = () => {
      const isCol = el.classList.toggle('collapsed');
      S.ui.sections[sec.id] = isCol;
      S.saveUI();
      if (isCol) gsap.to(body, { height: 0, duration: 0.32, ease: 'power3.inOut' });
      else gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: 0.36, ease: 'power3.out', onComplete: () => (body.style.height = '') });
      gsap.to(chev, { rotate: isCol ? -90 : 0, duration: 0.3, ease: 'power3.out' });
    };
    headBtn.addEventListener('click', toggleOpen);
    chev.addEventListener('click', toggleOpen);
    if (collapsed) gsap.set(chev, { rotate: -90 });
    sectionEls.set(sec.id, el);
    return el;
  }

  function sync() {
    if (!S.project) return;
    const st = S.style();
    const o = st.overrides[S.current] || {};
    const gm = glyphMode();
    ctl.forEach(({ api, item }) => {
      const v = current(item);
      if (api.get() !== v) api.set(v);
      const glyphable = item.target !== 'grid' && isGlyphKey(item.key);
      if (api.setOverridden) api.setOverridden(gm && glyphable && item.key in o);
      if (api.setDisabled) api.setDisabled(gm && !glyphable);
    });
    SECTIONS.forEach((sec) => {
      const el = sectionEls.get(sec.id);
      el.classList.toggle('locked', gm && !!sec.family);
      if (sec.toggle) el.classList.toggle('off', !current({ key: sec.toggle }));
      const seedRow = sectionEls.get(sec.id + ':seed');
      if (seedRow) {
        seedRow.querySelector('.seed-val').textContent = '#' + current({ key: sec.seed });
        seedRow.classList.toggle('overridden', gm && sec.seed in o);
      }
    });
    syncScope();
  }

  function syncScope() {
    const ch = S.current;
    const label = scopeSeg.box.querySelector('[data-v="glyph"] span');
    if (label) label.textContent = 'Лише «' + (ch === ' ' ? '␣' : ch) + '»';
    if (scopeSeg.get() !== scope()) scopeSeg.set(scope());
    scopeNote.innerHTML = '';
    const add = (...els) => els.forEach((el) => el && scopeNote.appendChild(el));
    const st = S.style();
    const n = Object.keys(st.overrides).filter((k) => Object.keys(st.overrides[k]).length).length;
    if (glyphMode()) {
      const has = S.hasOverride(ch);
      add(
        h('p', { text: 'Зміни точки, випадковості й текстури стосуються тільки цього гліфа. Сітка й ритм — спільні.' }),
        has
          ? h('div', { class: 'note-actions' },
              h('button', { class: 'btn sm', text: 'Застосувати до всього шрифту', onclick: () => {
                const o = Object.assign({}, st.overrides[ch]);
                Object.keys(o).forEach((k) => S.setParam(k, o[k], 'font'));
                S.clearOverride(ch);
                FL.ui.toast('Налаштування «' + ch + '» тепер для всього шрифту');
              } }),
              h('button', { class: 'btn ghost sm', text: 'Скинути', onclick: () => S.clearOverride(ch) }))
          : null
      );
    } else if (n) {
      add(
        h('p', { text: 'Гліфів із власними налаштуваннями: ' + n + '. Для них частина змін не діятиме.' }),
        h('div', { class: 'note-actions' }, h('button', { class: 'btn ghost sm', text: 'Скинути всі', onclick: () => {
          Object.keys(st.overrides).forEach((k) => delete st.overrides[k]);
          S.rev.style++;
          S.emit('style', { all: true });
          S.commit();
        } }))
      );
    }
    scopeNote.style.display = scopeNote.childNodes.length ? '' : 'none';
  }

  function init() {
    root = document.getElementById('controls');
    const scopeRoot = document.getElementById('scope');
    scopeSeg = FL.ui.segmented({
      label: 'Застосувати',
      bare: true,
      options: [{ value: 'font', label: 'Увесь шрифт' }, { value: 'glyph', label: 'Лише «A»' }],
      value: S.ui.scope,
      onChange: (v) => {
        S.ui.scope = v;
        S.saveUI();
        sync();
        gsap.fromTo(root, { opacity: 0.4 }, { opacity: 1, duration: 0.3 });
      },
    });
    scopeNote = h('div', { class: 'scope-note' });
    scopeRoot.append(h('div', { class: 'scope-label' }, h('span', { class: 'ctl-label', text: 'Де діють зміни' })), scopeSeg.el, scopeNote);
    SECTIONS.forEach((sec) => root.appendChild(buildSection(sec)));

    S.on('project', sync);
    S.on('style', sync);
    S.on('styles', sync);
    S.on('grid', sync);
    S.on('select', sync);
    sync();
  }

  FL.controls = { init, sync };
})();
