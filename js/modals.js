/* Діалоги: створення шрифту, набір символів, проєкти, накреслення, експорт. */
(function () {
  const FL = (window.FL = window.FL || {});
  const S = FL.store;
  const { h, icon } = FL.ui;
  const NS = 'http://www.w3.org/2000/svg';

  // ── Мініатюра сітки: літери точками
  function gridPreview() {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'wz-preview');
    const draw = (grid) => {
      svg.innerHTML = '';
      const chars = ['A', 'Й', 'g'];
      const P = 10;
      const r = 4.2;
      const gw = grid.cols * P;
      const total = chars.length * gw + (chars.length - 1) * P;
      const top = grid.top || 0;
      const H = (top + grid.rows + grid.desc) * P;
      svg.setAttribute('viewBox', `-4 -4 ${total + 8} ${H + 8}`);
      const all = [];
      chars.forEach((ch, i) => {
        const ox = i * (gw + P);
        for (let y = top + grid.rows - 1; y >= -grid.desc; y--) {
          for (let x = 0; x < grid.cols; x++) {
            const c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', ox + x * P + P / 2);
            c.setAttribute('cy', (top + grid.rows - 1 - y) * P + P / 2);
            c.setAttribute('r', 1);
            c.setAttribute('class', 'pv-cell');
            svg.appendChild(c);
          }
        }
        FL.gen.fromTemplate(ch, grid).forEach(([x, y]) => {
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', ox + x * P + P / 2);
          c.setAttribute('cy', (top + grid.rows - 1 - y) * P + P / 2);
          c.setAttribute('r', r);
          c.setAttribute('class', 'pv-dot');
          svg.appendChild(c);
          all.push(c);
        });
      });
      all.forEach((c) => gsap.set(c, { svgOrigin: c.getAttribute('cx') + ' ' + c.getAttribute('cy') }));
      gsap.fromTo(all, { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(2)', stagger: { each: 0.003, from: 'random' } });
    };
    return { el: svg, draw };
  }

  /** Майстер нового шрифту або редагування набору символів. */
  function wizard(mode) {
    const edit = mode === 'edit';
    const p = S.project;
    const state = {
      name: edit ? p.name : '',
      grid: edit ? Object.assign({}, p.grid) : { cols: 5, rows: 7, desc: 2, top: 2 },
      sets: edit ? Object.assign({}, p.sets) : { latinUpper: true, latinLower: true, cyrUpper: true, cyrLower: true, digits: true, punct: true, symbols: true, currency: true, extras: false },
      custom: edit ? (p.custom || []).join('') : '',
      prefill: true,
    };
    const first = !S.project;
    let m;
    const countEl = h('span', { class: 'wz-count' });
    const countObj = { n: 0 };
    const total = () => {
      const fake = { sets: state.sets, custom: Array.from(state.custom.replace(/\s/g, '')) };
      return FL.charset.charsetOf(fake).length;
    };
    const updateCount = () => {
      gsap.to(countObj, { n: total(), duration: 0.4, ease: 'power2.out', onUpdate: () => (countEl.textContent = Math.round(countObj.n)) });
    };

    const nameInput = h('input', { class: 'field huge', placeholder: 'Назва шрифту', value: state.name, spellcheck: 'false', autofocus: !edit, maxlength: '40' });
    nameInput.addEventListener('input', () => (state.name = nameInput.value));
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());

    const preview = gridPreview();
    const steppers = [
      ['cols', 'Колонки', 3, 12],
      ['rows', 'Рядки', 5, 16],
      ['top', 'Над великими літерами', 0, 4],
      ['desc', 'Під базовою лінією', 0, 4],
    ].map(([k, label, min, max]) =>
      FL.ui.stepper({ label, min, max, value: state.grid[k], onChange: (v) => { state.grid[k] = v; preview.draw(state.grid); } }).el
    );

    const groups = [
      { title: 'Латиниця', ids: ['latinUpper', 'latinLower'] },
      { title: 'Кирилиця · українська', ids: ['cyrUpper', 'cyrLower'] },
      { title: 'Цифри', ids: ['digits'] },
      { title: 'Знаки', ids: ['punct', 'symbols', 'currency', 'extras'] },
    ];
    const chips = h('div', { class: 'wz-sets' },
      groups.map((g) =>
        h('div', { class: 'wz-group' },
          h('div', { class: 'wz-group-title', text: g.title }),
          h('div', { class: 'wz-chips' },
            g.ids.map((id) => {
              const s = FL.charset.SETS.find((x) => x.id === id);
              const b = h('button', { class: 'chip-set' + (state.sets[id] ? ' on' : ''), 'aria-pressed': !!state.sets[id] },
                h('i', { class: 'cs-dot' }),
                h('span', { class: 'cs-label', text: s.label }),
                h('span', { class: 'cs-sub', text: s.group + ' · ' + s.list.length })
              );
              b.addEventListener('click', () => {
                state.sets[id] = !state.sets[id];
                b.classList.toggle('on', state.sets[id]);
                b.setAttribute('aria-pressed', state.sets[id]);
                gsap.fromTo(b.querySelector('.cs-dot'), { scale: 0.4 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
                updateCount();
              });
              return b;
            })
          )
        )
      )
    );
    const customInput = h('input', { class: 'field', placeholder: 'Напр.: ✓ ✕ ☺ ẞ', value: state.custom, spellcheck: 'false' });
    customInput.addEventListener('input', () => { state.custom = customInput.value; updateCount(); });
    customInput.addEventListener('keydown', (e) => e.stopPropagation());

    const startSeg = FL.ui.segmented({
      options: [{ value: true, label: 'Із заготовками' }, { value: false, label: 'З чистого аркуша' }],
      value: true,
      onChange: (v) => (state.prefill = v),
    });

    const submit = h('button', { class: 'btn primary lg', text: edit ? 'Зберегти набір' : 'Створити шрифт' });
    submit.addEventListener('click', () => {
      const custom = Array.from(new Set(Array.from(state.custom.replace(/\s/g, ''))));
      if (!total()) return FL.ui.toast('Виберіть хоча б один набір символів');
      if (edit) {
        const before = new Set(S.charset());
        S.setCharset(state.sets, custom);
        if (state.prefill) {
          S.charset().forEach((ch) => {
            if (before.has(ch) || S.isDrawn(ch)) return;
            const cells = FL.gen.fromTemplate(ch, S.project.grid);
            if (cells.length) S.setCells(ch, cells);
          });
          S.commit();
        }
        FL.ui.toast('Набір оновлено: ' + S.charset().length + ' гліфів');
      } else {
        S.newProject({ name: state.name.trim() || 'Без назви', grid: state.grid, sets: state.sets, custom, prefill: state.prefill });
        FL.ui.toast('Шрифт «' + S.project.name + '» створено');
      }
      m.close();
    });

    const steps = [];
    if (!edit) {
      steps.push(h('section', { class: 'wz-step' }, h('div', { class: 'wz-label' }, h('b', { text: 'Назва' })), nameInput));
      steps.push(
        h('section', { class: 'wz-step' },
          h('div', { class: 'wz-label' }, h('b', { text: 'Сітка' }), h('small', { text: 'Скільки точок у літері. Класика — 5×7, 2 рядки над великими для Й, Ї і 2 рядки під базовою лінією для g, у, Д, Щ. Змінити можна й потім.' })),
          h('div', { class: 'wz-grid' }, h('div', { class: 'wz-steppers' }, steppers), preview.el)
        )
      );
    }
    steps.push(
      h('section', { class: 'wz-step' },
        h('div', { class: 'wz-label' }, h('b', { text: 'Мови й символи' }), h('small', { text: 'Лише вибране з’явиться у вкладках і потрапить у файл шрифту.' })),
        chips,
        h('div', { class: 'wz-custom' }, h('span', { class: 'ctl-label', text: 'Власні гліфи' }), customInput)
      )
    );
    steps.push(
      h('section', { class: 'wz-step' },
        h('div', { class: 'wz-label' }, h('b', { text: edit ? 'Нові гліфи' : 'Початок' }), h('small', { text: edit ? 'Як заповнити гліфи, які щойно додано.' : 'Заготовки — базові форми всіх літер, які потім правите вручну.' })),
        startSeg.el
      )
    );

    const body = h('div', { class: 'wizard' },
      h('header', { class: 'wz-head' },
        h('div', null, h('div', { class: 'ctl-label', text: edit ? 'Шрифт «' + p.name + '»' : 'Font Dog' }), h('h2', { class: 'm-title big', text: edit ? 'Набір символів' : 'Новий точковий шрифт' })),
        first ? null : h('button', { class: 'icon-btn', 'aria-label': 'Закрити', onclick: () => m.close() }, icon('close'))
      ),
      h('div', { class: 'wz-body' }, steps),
      h('footer', { class: 'wz-foot' }, h('div', { class: 'wz-total' }, countEl, h('span', { text: 'гліфів у наборі' })), submit)
    );
    m = FL.ui.modal(body, { width: 640, locked: first, cls: 'wz-modal' });
    preview.draw(state.grid);
    updateCount();
    gsap.from(body.querySelectorAll('.wz-step'), { opacity: 0, y: 14, duration: 0.45, ease: 'power3.out', stagger: 0.06, delay: 0.08 });
  }

  // ── Проєкти
  function projects() {
    let m;
    const list = h('div', { class: 'pj-list' });
    const fmtDate = (t) => {
      try { return new Date(t).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
    };
    const fill = () => {
      list.innerHTML = '';
      const items = S.listProjects();
      items.forEach((it) => {
        const cur = S.project && it.id === S.project.id;
        const row = h('div', { class: 'pj-row' + (cur ? ' current' : '') },
          h('button', { class: 'pj-open', onclick: () => { if (!cur) S.openProject(it.id); m.close(); } },
            h('span', { class: 'pj-name', text: it.name }),
            h('span', { class: 'pj-meta', text: (cur ? 'відкрито · ' : '') + (it.count || '—') + ' гліфів · ' + fmtDate(it.updated) })
          ),
          h('button', { class: 'icon-btn', title: 'Дублювати', 'aria-label': 'Дублювати', onclick: () => { S.duplicateProject(it.id); m.close(); FL.ui.toast('Створено копію'); } }, icon('dup')),
          h('button', { class: 'icon-btn', title: 'Видалити', 'aria-label': 'Видалити', onclick: async () => {
            if (await FL.ui.confirmDialog('Видалити «' + it.name + '»?', 'Шрифт і всі його накреслення буде видалено з цього браузера. Цю дію не скасувати.', 'Видалити', true)) {
              S.deleteProject(it.id);
              fill();
              if (!S.project) { m.close(); wizard('new'); }
            }
          } }, icon('trash'))
        );
        list.appendChild(row);
      });
    };
    fill();
    const nameInput = h('input', { class: 'field big', value: S.project.name, spellcheck: 'false', maxlength: '40' });
    nameInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') nameInput.blur(); });
    nameInput.addEventListener('change', () => { S.rename(nameInput.value); fill(); });
    const fileInput = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      if (!f) return;
      try {
        S.importProjectJSON(await f.text());
        m.close();
        FL.ui.toast('Проєкт імпортовано');
      } catch (e) {
        FL.ui.toast('Файл не схожий на проєкт Font Dog');
      }
    });
    const body = h('div', { class: 'projects' },
      h('header', { class: 'wz-head' }, h('h2', { class: 'm-title', text: 'Шрифти' }), h('button', { class: 'icon-btn', 'aria-label': 'Закрити', onclick: () => m.close() }, icon('close'))),
      h('div', { class: 'pj-current' }, h('span', { class: 'ctl-label', text: 'Назва поточного шрифту' }), nameInput),
      list,
      h('footer', { class: 'pj-foot' },
        h('button', { class: 'btn primary', onclick: () => { m.close(); wizard('new'); } }, icon('plus'), h('span', { text: 'Новий шрифт' })),
        h('span', { class: 'top-spacer' }),
        h('button', { class: 'btn ghost', title: 'Зберегти поточний проєкт у файл', onclick: () => {
          const blob = new Blob([S.exportProjectJSON()], { type: 'application/json' });
          FL.exporter.save(blob, (S.project.name || 'font').replace(/[^\p{L}\p{N}_-]+/gu, '-') + '.fontlab.json');
        } }, icon('download'), h('span', { text: 'Проєкт .json' })),
        h('button', { class: 'btn ghost', onclick: () => fileInput.click() }, icon('upload'), h('span', { text: 'Імпорт' })),
        fileInput
      )
    );
    m = FL.ui.modal(body, { width: 560 });
  }

  // ── Накреслення
  const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

  /** Підбирає вагу точки для нового накреслення: товщає/худне обведенням. */
  function adjustForWeight(params, fromW, toW) {
    const p = Object.assign({}, params);
    const d = (toW - fromW) / 100;
    if (p.fill) {
      const eff = p.size + p.outline + d * 0.07;
      if (eff >= p.size) p.outline = Math.min(0.5, +(eff - p.size).toFixed(3));
      else { p.outline = 0; p.size = Math.max(0.4, +eff.toFixed(3)); }
    } else {
      p.outline = Math.max(0.03, Math.min(0.5, +(p.outline + d * 0.045).toFixed(3)));
    }
    return p;
  }

  function addStylePopover(anchor) {
    const src = S.style();
    const used = new Set(S.project.styles.map((s) => s.weight));
    const nameInput = h('input', { class: 'field', placeholder: 'Назва накреслення', spellcheck: 'false' });
    let weight = WEIGHTS.find((w) => w > src.weight && !used.has(w)) || WEIGHTS.find((w) => !used.has(w)) || 700;
    let auto = true;
    const weightRow = h('div', { class: 'w-chips' });
    const paintW = () => {
      weightRow.innerHTML = '';
      WEIGHTS.forEach((w) => {
        const b = h('button', { class: 'w-chip' + (w === weight ? ' on' : '') + (used.has(w) ? ' used' : ''), title: S.WEIGHT_NAMES[w], text: String(w), onclick: () => {
          weight = w;
          if (!nameInput._touched) nameInput.value = S.WEIGHT_NAMES[w];
          paintW();
        } });
        weightRow.appendChild(b);
      });
    };
    nameInput.value = S.WEIGHT_NAMES[weight];
    nameInput.addEventListener('input', () => (nameInput._touched = true));
    nameInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
    paintW();
    const autoT = FL.ui.toggle({ value: true, label: 'Підлаштувати товщину', onChange: (v) => (auto = v) });
    const go = () => {
      const name = nameInput.value.trim() || S.WEIGHT_NAMES[weight];
      const st = S.duplicateStyle(name, weight);
      if (auto) {
        st.params = adjustForWeight(src.params, src.weight, weight);
        S.rev.style++;
        S.emit('style', { all: true });
        S.commit();
      }
      FL.ui.closePopover();
      FL.ui.toast('Додано накреслення ' + name);
    };
    FL.ui.popover(anchor, h('div', { class: 'menu-block' },
      h('b', { text: 'Нове накреслення' }),
      h('small', { text: 'Копія «' + src.name + '» з усіма налаштуваннями. Малюнок гліфів спільний для всього сімейства.' }),
      h('span', { class: 'ctl-label', text: 'Вага' }),
      weightRow,
      nameInput,
      h('label', { class: 'tgl-row' }, autoT.el, h('span', { text: 'Змінити товщину обведення під вагу' })),
      h('button', { class: 'btn primary sm wide', text: 'Створити', onclick: go })
    ), { cls: 'wide' });
    setTimeout(() => nameInput.focus(), 30);
  }

  function editStylePopover(anchor, st) {
    const nameInput = h('input', { class: 'field', value: st.name, spellcheck: 'false' });
    nameInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') save(); });
    let weight = st.weight;
    const weightRow = h('div', { class: 'w-chips' });
    const paintW = () => {
      weightRow.innerHTML = '';
      WEIGHTS.forEach((w) => weightRow.appendChild(h('button', { class: 'w-chip' + (w === weight ? ' on' : ''), title: S.WEIGHT_NAMES[w], text: String(w), onclick: () => { weight = w; paintW(); } })));
    };
    paintW();
    const save = () => {
      S.updateStyle(st.id, { name: nameInput.value.trim() || st.name, weight });
      FL.ui.closePopover();
    };
    const single = S.project.styles.length < 2;
    FL.ui.popover(anchor, h('div', { class: 'menu-block' },
      h('b', { text: 'Накреслення' }),
      nameInput,
      h('span', { class: 'ctl-label', text: 'Вага (usWeightClass)' }),
      weightRow,
      h('div', { class: 'note-actions' },
        h('button', { class: 'btn primary sm', text: 'Зберегти', onclick: save }),
        h('button', { class: 'btn ghost sm', text: 'Видалити', disabled: single, title: single ? 'У сімействі має лишитися хоча б одне накреслення' : '', onclick: async () => {
          FL.ui.closePopover();
          if (await FL.ui.confirmDialog('Видалити накреслення ' + st.name + '?', 'Його налаштування точок зникнуть. Малюнок гліфів залишиться.', 'Видалити', true)) S.deleteStyle(st.id);
        } })
      )
    ), { cls: 'wide' });
    setTimeout(() => nameInput.select(), 30);
  }

  // ── Експорт
  function exportDialog() {
    let m;
    const p = S.project;
    const fam = h('input', { class: 'field big', value: p.exportName || p.name, spellcheck: 'false', maxlength: '40' });
    fam.addEventListener('keydown', (e) => e.stopPropagation());
    const chosen = new Set(p.styles.map((s) => s.id));
    const formats = new Set(S.ui.formats || ['otf', 'woff2']);
    let caseFb = true;

    const styleRows = p.styles.map((st) => {
      const cv = h('canvas', { class: 'ex-spec' });
      const b = h('button', { class: 'ex-style on', 'aria-pressed': 'true' }, h('i', { class: 'cs-dot' }), h('span', { class: 'ex-sname', text: st.name }), h('span', { class: 'ex-sw', text: String(st.weight) }), cv);
      b.addEventListener('click', () => {
        if (chosen.has(st.id)) chosen.delete(st.id);
        else chosen.add(st.id);
        b.classList.toggle('on', chosen.has(st.id));
        b.setAttribute('aria-pressed', chosen.has(st.id));
        refresh();
      });
      b._paint = () => {
        const c = FL.theme.colors;
        FL.render.drawText(cv, fam.value || p.name, { size: 26, color: c.ink, style: st, wrap: false, width: cv.clientWidth || 300, height: 34, padY: 2 });
      };
      return b;
    });
    fam.addEventListener('input', () => styleRows.forEach((r) => r._paint()));

    const fmtRow = h('div', { class: 'wz-chips' },
      [['otf', 'OTF', 'Для дизайн-програм'], ['woff2', 'WOFF2', 'Для вебу']].map(([id, label, sub]) => {
        const b = h('button', { class: 'chip-set' + (formats.has(id) ? ' on' : '') }, h('i', { class: 'cs-dot' }), h('span', { class: 'cs-label', text: label }), h('span', { class: 'cs-sub', text: sub }));
        b.addEventListener('click', () => {
          if (formats.has(id)) formats.delete(id);
          else formats.add(id);
          b.classList.toggle('on', formats.has(id));
          refresh();
        });
        return b;
      })
    );
    const fbToggle = FL.ui.toggle({ value: true, label: 'Підстановка регістру', onChange: (v) => { caseFb = v; refresh(); } });
    const summary = h('div', { class: 'ex-summary' });
    const goLabel = h('span', { text: 'Завантажити' });
    const go = h('button', { class: 'btn primary lg' }, icon('download'), goLabel);

    function refresh() {
      const cs = S.charset();
      const drawn = cs.filter((ch) => S.isDrawn(ch));
      const empty = cs.filter((ch) => !S.isDrawn(ch));
      const filled = caseFb ? empty.filter((ch) => FL.charset.CASE_PAIRS[ch] && S.isDrawn(FL.charset.CASE_PAIRS[ch])) : [];
      const skipped = empty.filter((ch) => !filled.includes(ch));
      summary.innerHTML = '';
      [
        h('div', null, h('b', { text: String(drawn.length) }), h('span', { text: ' гліфів намальовано' })),
        filled.length ? h('div', null, h('b', { text: String(filled.length) }), h('span', { text: ' підставляться з іншого регістру' })) : null,
        skipped.length ? h('div', { class: 'warn' }, h('b', { text: String(skipped.length) }), h('span', { text: ' порожніх не потраплять у файл: ' + skipped.slice(0, 24).join(' ') + (skipped.length > 24 ? ' …' : '') })) : null,
      ].forEach((el) => el && summary.appendChild(el));
      const files = chosen.size * formats.size;
      go.disabled = !files || !drawn.length;
      goLabel.textContent = files ? 'Завантажити ' + files + ' ' + (files === 1 ? 'файл' : files < 5 ? 'файли' : 'файлів') : 'Виберіть накреслення і формат';
    }

    go.addEventListener('click', async () => {
      const family = fam.value.trim() || p.name;
      p.exportName = family;
      S.ui.formats = Array.from(formats);
      S.saveUI();
      S.save();
      go.disabled = true;
      const label = goLabel;
      try {
        const styles = p.styles.filter((s) => chosen.has(s.id));
        let n = 0;
        for (const st of styles) {
          label.textContent = 'Збираю ' + st.name + '…';
          await new Promise((r) => setTimeout(r, 20));
          const res = await FL.exporter.build(st, family, { caseFallback: caseFb, formats: Array.from(formats), onStatus: (t) => (label.textContent = t) });
          for (const f of res.files) {
            FL.exporter.save(f.blob, f.name);
            n++;
            await new Promise((r) => setTimeout(r, 350));
          }
        }
        FL.ui.toast('Готово: ' + n + ' ' + (n === 1 ? 'файл' : n < 5 ? 'файли' : 'файлів') + ' збережено');
        m.close();
      } catch (e) {
        console.error(e);
        FL.ui.toast('Не вдалося зібрати шрифт: ' + (e && e.message ? e.message : e), { duration: 4 });
        go.disabled = false;
        refresh();
      }
    });

    const body = h('div', { class: 'export' },
      h('header', { class: 'wz-head' }, h('div', null, h('div', { class: 'ctl-label', text: 'Експорт' }), h('h2', { class: 'm-title big', text: 'Зберегти шрифт' })), h('button', { class: 'icon-btn', 'aria-label': 'Закрити', onclick: () => m.close() }, icon('close'))),
      h('div', { class: 'wz-body' },
        h('section', { class: 'wz-step' }, h('div', { class: 'wz-label' }, h('b', { text: 'Назва шрифту' }), h('small', { text: 'Так шрифт називатиметься в меню програм.' })), fam),
        h('section', { class: 'wz-step' }, h('div', { class: 'wz-label' }, h('b', { text: 'Накреслення' }), h('small', { text: 'Кожне — окремий файл одного сімейства.' })), h('div', { class: 'ex-styles' }, styleRows)),
        h('section', { class: 'wz-step' }, h('div', { class: 'wz-label' }, h('b', { text: 'Формат' })), fmtRow,
          h('label', { class: 'tgl-row' }, fbToggle.el, h('span', { text: 'Якщо малих літер немає — підставити великі (і навпаки)' }))),
        summary
      ),
      h('footer', { class: 'wz-foot' }, h('div', { class: 'wz-total small' }, h('span', { text: 'Файли: ' }), h('span', { class: 'mono' })), go)
    );
    m = FL.ui.modal(body, { width: 600 });
    const fn = body.querySelector('.wz-total .mono');
    const showName = () => (fn.textContent = FL.exporter.fileBase(fam.value || p.name, S.style().name) + '.' + (formats.has('otf') || !formats.size ? 'otf' : 'woff2'));
    fam.addEventListener('input', showName);
    showName();
    refresh();
    requestAnimationFrame(() => styleRows.forEach((r) => r._paint()));
  }

  FL.modals = { wizard, projects, exportDialog, addStylePopover, editStylePopover, adjustForWeight };
})();
