/* Тест-набір під редактором: живий текст поточним шрифтом. */
(function () {
  const FL = (window.FL = window.FL || {});
  const S = FL.store;
  const { h, icon } = FL.ui;

  const SAMPLES = [
    'Чуєш їх, доцю, га? Кумедна ж ти, прощайся без ґольфів!',
    'The quick brown fox jumps over the lazy dog',
    'ЖЕБРАКУЮТЬ ФІЛОСОФИ ПРИ ҐАНКУ ЦЕРКВИ В ГАДЯЧІ, ЩЕ Й ШАТРО ЇХНЄ П’ЯНЕ ЗНАЄМО',
    'SPHINX OF BLACK QUARTZ, JUDGE MY VOW',
    '0123456789 — 12:45 · 3/4/5 · ₴1 250,00 · №7 · «Так!»',
    'Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm\nАа Бб Вв Гг Ґґ Дд Ее Єє Жж Зз Ии Іі Її Йй',
  ];

  let canvas, view, input, raf = 0;
  const T = () => S.ui.tester;

  function render() {
    if (!S.project) return;
    const t = T();
    const c = FL.theme.colors;
    const color = t.invert ? c.bg : c.ink;
    const pad = Math.max(16, Math.min(28, t.size * 0.25));
    FL.render.drawText(canvas, t.text || ' ', { size: t.size, tracking: t.tracking, leading: t.leading, color, padX: pad, padY: pad * 0.6, width: view.clientWidth });
  }
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render();
    });
  }
  const persist = () => S.saveUI();

  /** Тонкий повзунок розміру (як у референсі). */
  function sizeControl() {
    const knob = h('i', { class: 'ls-knob' });
    const line = h('div', { class: 'ls-line' }, knob);
    const val = h('span', { class: 'ls-val' });
    const min = 12;
    const max = 240;
    const el = h('div', { class: 'pill tsize', title: 'Кегль' }, icon('size'), line, val);
    const paint = () => {
      const v = T().size;
      knob.style.left = ((v - min) / (max - min)) * 100 + '%';
      val.textContent = Math.round(v);
    };
    let drag = false;
    const set = (e) => {
      const r = line.getBoundingClientRect();
      T().size = Math.round(min + FL.ui.clamp((e.clientX - r.left) / r.width, 0, 1) * (max - min));
      paint();
      schedule();
    };
    line.addEventListener('pointerdown', (e) => {
      drag = true;
      line.setPointerCapture(e.pointerId);
      set(e);
      gsap.fromTo(knob, { scale: 0.8 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
    });
    line.addEventListener('pointermove', (e) => drag && set(e));
    line.addEventListener('pointerup', () => { drag = false; persist(); });
    paint();
    return el;
  }

  /** Числове поле, яке можна «тягнути» мишею вліво-вправо. */
  function scrub(o) {
    const inp = h('input', { class: 'scrub-in', inputmode: 'decimal', 'aria-label': o.title });
    const el = h('label', { class: 'pill scrub', title: o.title + ' — тягніть вліво/вправо' }, icon(o.icon), inp);
    const paint = () => (inp.value = o.fmt(o.get()));
    let start = null;
    el.addEventListener('pointerdown', (e) => {
      if (document.activeElement === inp) return;
      e.preventDefault();
      start = { x: e.clientX, v: o.get(), moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      if (Math.abs(dx) > 3) start.moved = true;
      if (!start.moved) return;
      el.classList.add('scrubbing');
      o.set(FL.ui.clamp(start.v + Math.round(dx / 2) * o.step, o.min, o.max));
      paint();
      schedule();
    });
    el.addEventListener('pointerup', () => {
      if (!start) return;
      const moved = start.moved;
      start = null;
      el.classList.remove('scrubbing');
      if (!moved) {
        inp.focus();
        inp.select();
      } else persist();
    });
    const commit = () => {
      const n = parseFloat(inp.value.replace(',', '.').replace('−', '-'));
      if (!isNaN(n)) o.set(FL.ui.clamp(o.parse ? o.parse(n) : n, o.min, o.max));
      paint();
      schedule();
      persist();
    };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { commit(); inp.blur(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        o.set(FL.ui.clamp(o.get() + (e.key === 'ArrowUp' ? 1 : -1) * o.step * (e.shiftKey ? 10 : 1), o.min, o.max));
        paint();
        schedule();
      }
    });
    inp.addEventListener('blur', commit);
    paint();
    return el;
  }

  function init() {
    canvas = document.getElementById('testerCanvas');
    view = document.getElementById('testerView');
    input = document.getElementById('testText');
    const bar = document.getElementById('testerBar');
    const t = T();
    if (!t.text) t.text = SAMPLES[0];
    input.value = t.text;
    const grow = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 96) + 'px';
    };
    input.addEventListener('input', () => {
      t.text = input.value;
      grow();
      schedule();
      clearTimeout(input._t);
      input._t = setTimeout(persist, 400);
    });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    requestAnimationFrame(grow);

    const sampleBtn = h('button', { class: 'pill icon-pill', title: 'Інший приклад тексту', 'aria-label': 'Інший приклад тексту' }, icon('shuffle'));
    sampleBtn.addEventListener('click', () => {
      t.sample = (t.sample + 1) % SAMPLES.length;
      t.text = SAMPLES[t.sample];
      input.value = t.text;
      grow();
      persist();
      gsap.fromTo(canvas, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' });
      render();
    });
    const invBtn = h('button', { class: 'pill icon-pill', title: 'Перевірити на темному / світлому', 'aria-label': 'Інвертувати фон перегляду' }, icon('theme'));
    const applyInvert = (animate) => {
      view.classList.toggle('inverted', t.invert);
      invBtn.classList.toggle('on', t.invert);
      if (!animate) return render();
      gsap.to(canvas, { opacity: 0, duration: 0.12, onComplete: () => { render(); gsap.to(canvas, { opacity: 1, duration: 0.25 }); } });
    };
    invBtn.addEventListener('click', () => {
      t.invert = !t.invert;
      persist();
      applyInvert(true);
    });

    bar.append(
      sizeControl(),
      scrub({ icon: 'tracking', title: 'Трекінг, 1/1000 кегля', min: -300, max: 800, step: 5, get: () => t.tracking, set: (v) => (t.tracking = v), fmt: (v) => String(Math.round(v)).replace('-', '−') }),
      scrub({ icon: 'leading', title: 'Інтерліньяж, %', min: 60, max: 300, step: 1, get: () => Math.round(t.leading * 100), set: (v) => (t.leading = v / 100), fmt: (v) => String(Math.round(v)) }),
      sampleBtn,
      invBtn
    );
    applyInvert(false);

    new ResizeObserver(schedule).observe(view);
    ['project', 'style', 'styles', 'glyph', 'grid', 'paint', 'charset'].forEach((ev) => S.on(ev, schedule));
  }

  FL.tester = { init, render: schedule, SAMPLES };
})();
