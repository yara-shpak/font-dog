/* Дрібні UI-компоненти: повзунки, степери, перемикачі, поповери, модальні вікна, тости. */
(function () {
  const FL = (window.FL = window.FL || {});

  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    kids.flat().forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  };

  const ICONS = {
    undo: '<svg viewBox="0 0 20 20"><path d="M7.5 5 4 8.5 7.5 12"/><path d="M4.5 8.5H12a4 4 0 0 1 0 8H9"/></svg>',
    redo: '<svg viewBox="0 0 20 20"><path d="M12.5 5 16 8.5 12.5 12"/><path d="M15.5 8.5H8a4 4 0 0 0 0 8h3"/></svg>',
    theme: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5a6.5 6.5 0 0 1 0 13z" class="fill"/></svg>',
    chevron: '<svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg>',
    left: '<svg viewBox="0 0 20 20"><path d="m12 5-5 5 5 5"/></svg>',
    right: '<svg viewBox="0 0 20 20"><path d="m8 5 5 5-5 5"/></svg>',
    plus: '<svg viewBox="0 0 20 20"><path d="M10 4.5v11M4.5 10h11"/></svg>',
    minus: '<svg viewBox="0 0 20 20"><path d="M4.5 10h11"/></svg>',
    close: '<svg viewBox="0 0 20 20"><path d="m5.5 5.5 9 9M14.5 5.5l-9 9"/></svg>',
    reset: '<svg viewBox="0 0 20 20"><path d="M5 10a5 5 0 1 0 1.5-3.5"/><path d="M5 4.5V7h2.5"/></svg>',
    wand: '<svg viewBox="0 0 20 20"><path d="m4 16 8.5-8.5"/><path d="m11 6 1.5-1.5 3 3L14 9"/><path d="M15 2.5v2M16 3.5h-2M5 3v2M6 4H4M16.5 12v2M17.5 13h-2"/></svg>',
    clear: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6"/><path d="m6 14 8-8"/></svg>',
    invert: '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="3"/><path d="M4.5 15.5 15.5 4.5V13a3 3 0 0 1-3 3z" class="fill"/></svg>',
    flipH: '<svg viewBox="0 0 20 20"><path d="M10 3v14"/><path d="M7.5 6 3 14h4.5zM12.5 6l4.5 8h-4.5z"/></svg>',
    flipV: '<svg viewBox="0 0 20 20"><path d="M3 10h14"/><path d="M6 7.5 14 3v4.5zM6 12.5l8 4.5v-4.5z"/></svg>',
    up: '<svg viewBox="0 0 20 20"><path d="m5 12 5-5 5 5"/></svg>',
    down: '<svg viewBox="0 0 20 20"><path d="m5 8 5 5 5-5"/></svg>',
    copy: '<svg viewBox="0 0 20 20"><rect x="7" y="7" width="9" height="9" rx="2"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/></svg>',
    paste: '<svg viewBox="0 0 20 20"><rect x="5" y="4.5" width="10" height="12" rx="2"/><path d="M8 4.5V3.5h4v1"/><path d="M8 10h4M8 13h2.5"/></svg>',
    guide: '<svg viewBox="0 0 20 20"><circle cx="6" cy="6" r="1.6"/><circle cx="14" cy="6" r="1.6" class="fill"/><circle cx="6" cy="14" r="1.6" class="fill"/><circle cx="14" cy="14" r="1.6"/></svg>',
    shuffle: '<svg viewBox="0 0 20 20"><path d="M3.5 6.5h3c4 0 3 7 7 7h3"/><path d="M3.5 13.5h3c1.4 0 2.1-.9 2.6-2M16.5 6.5h-3c-1.4 0-2.1.9-2.6 2"/><path d="m14.5 4.5 2 2-2 2M14.5 11.5l2 2-2 2"/></svg>',
    dice: '<svg viewBox="0 0 20 20"><rect x="3.5" y="3.5" width="13" height="13" rx="3.5"/><circle cx="7" cy="7" r="1.1" class="fill"/><circle cx="13" cy="7" r="1.1" class="fill"/><circle cx="10" cy="10" r="1.1" class="fill"/><circle cx="7" cy="13" r="1.1" class="fill"/><circle cx="13" cy="13" r="1.1" class="fill"/></svg>',
    download: '<svg viewBox="0 0 20 20"><path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12"/></svg>',
    upload: '<svg viewBox="0 0 20 20"><path d="M10 13V4M6 8l4-4 4 4M4 16.5h12"/></svg>',
    trash: '<svg viewBox="0 0 20 20"><path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6"/></svg>',
    dup: '<svg viewBox="0 0 20 20"><rect x="7" y="7" width="9" height="9" rx="2"/><rect x="4" y="4" width="9" height="9" rx="2"/></svg>',
    size: '<svg viewBox="0 0 20 20"><path d="M3 5.5h8M7 5.5V15M12 9.5h5M14.5 9.5V15"/></svg>',
    tracking: '<svg viewBox="0 0 20 20"><path d="m3 14 3-8 3 8M4.2 11h3.6M11 6l3 8 3-8"/></svg>',
    leading: '<svg viewBox="0 0 20 20"><path d="M4 4h12M4 16h12"/><path d="m7.5 13 2.5-6 2.5 6M8.4 11h3.2"/></svg>',
    more: '<svg viewBox="0 0 20 20"><circle cx="5" cy="10" r="1.3" class="fill"/><circle cx="10" cy="10" r="1.3" class="fill"/><circle cx="15" cy="10" r="1.3" class="fill"/></svg>',
  };
  const icon = (name) => {
    const s = h('span', { class: 'ic', 'aria-hidden': 'true', html: ICONS[name] || '' });
    return s;
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const snap = (v, step, min) => {
    const n = Math.round((v - min) / step) * step + min;
    return +n.toFixed(6);
  };

  /** Повзунок у вигляді капсули з точками-поділками (як еквалайзер). */
  function slider(o) {
    const min = o.min;
    const max = o.max;
    const step = o.step || 0.01;
    let value = o.value;
    const origin = o.origin !== undefined ? o.origin : min;
    const ticks = h('div', { class: 'sl-ticks' });
    for (let i = 0; i < 9; i++) ticks.appendChild(h('i'));
    const fill = h('div', { class: 'sl-fill' });
    const knob = h('div', { class: 'sl-knob' });
    const rail = h('div', { class: 'sl-rail' }, ticks, fill, knob);
    const track = h('div', { class: 'sl-track' }, rail);
    const valEl = h('span', { class: 'ctl-value', title: 'Натисніть, щоб ввести число' });
    const ovr = h('button', { class: 'ctl-ovr', title: 'Повернути значення шрифту', 'aria-label': 'Скинути перевизначення' }, icon('reset'));
    const el = h(
      'div',
      { class: 'ctl slider', tabindex: '0', role: 'slider', 'aria-label': o.label, 'aria-valuemin': min, 'aria-valuemax': max },
      h('div', { class: 'ctl-head' }, h('span', { class: 'ctl-label', text: o.label }), ovr, valEl),
      track
    );
    if (o.hint) el.title = o.hint;
    const fmt = o.fmt || ((v) => String(v));
    const pct = (v) => ((v - min) / (max - min)) * 100;
    function paint() {
      const p = pct(value);
      const p0 = pct(clamp(origin, min, max));
      knob.style.left = p + '%';
      fill.style.left = 'calc(' + Math.min(p, p0) + '% - 8px)';
      fill.style.width = 'calc(' + Math.abs(p - p0) + '% + 16px)';
      valEl.textContent = fmt(value);
      el.setAttribute('aria-valuenow', value);
      el.setAttribute('aria-valuetext', fmt(value));
    }
    function setValue(v, fire) {
      v = clamp(snap(v, step, min), min, max);
      if (v === value) return;
      value = v;
      paint();
      if (fire && o.onInput) o.onInput(value);
    }
    const proxy = { v: value };
    let tween = null;
    let dragging = false;
    const fromEvent = (e) => {
      const r = rail.getBoundingClientRect();
      return min + clamp((e.clientX - r.left) / r.width, 0, 1) * (max - min);
    };
    track.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.classList.remove('kbd');
      el.focus({ preventScroll: true });
      track.setPointerCapture(e.pointerId);
      dragging = true;
      el.classList.add('dragging');
      const target = clamp(snap(fromEvent(e), step, min), min, max);
      proxy.v = value;
      if (tween) tween.kill();
      tween = gsap.to(proxy, {
        v: target,
        duration: 0.18,
        ease: 'power3.out',
        onUpdate: () => setValue(proxy.v, true),
      });
    });
    track.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (tween && tween.isActive()) tween.kill();
      setValue(fromEvent(e), true);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      if (tween && tween.isActive()) tween.progress(1);
      if (o.onChange) o.onChange(value);
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('dblclick', () => {
      if (o.def === undefined) return;
      setValue(o.def, true);
      if (o.onChange) o.onChange(value);
    });
    el.addEventListener('keydown', (e) => {
      const k = e.key;
      el.classList.add('kbd');
      let d = 0;
      if (k === 'ArrowRight' || k === 'ArrowUp') d = 1;
      else if (k === 'ArrowLeft' || k === 'ArrowDown') d = -1;
      else if (k === 'Home') { setValue(min, true); o.onChange && o.onChange(value); e.preventDefault(); return; }
      else if (k === 'End') { setValue(max, true); o.onChange && o.onChange(value); e.preventDefault(); return; }
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      setValue(value + d * step * (e.shiftKey ? 10 : 1), true);
      clearTimeout(el._kt);
      el._kt = setTimeout(() => o.onChange && o.onChange(value), 350);
    });
    valEl.addEventListener('click', () => {
      const input = h('input', { class: 'ctl-input', value: o.toInput ? o.toInput(value) : value, inputmode: 'decimal' });
      valEl.replaceWith(input);
      input.focus();
      input.select();
      let finished = false;
      const done = (commit) => {
        if (finished) return;
        finished = true;
        if (commit) {
          const n = parseFloat(String(input.value).replace(',', '.'));
          if (!isNaN(n)) {
            setValue(o.fromInput ? o.fromInput(n) : n, true);
            o.onChange && o.onChange(value);
          }
        }
        input.replaceWith(valEl);
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') done(true);
        if (e.key === 'Escape') done(false);
      });
      input.addEventListener('blur', () => done(true), { once: true });
    });
    ovr.addEventListener('click', (e) => {
      e.stopPropagation();
      o.onReset && o.onReset();
    });
    paint();
    return {
      el,
      get: () => value,
      set(v) { value = clamp(v, min, max); paint(); },
      setOverridden(b) { el.classList.toggle('overridden', !!b); },
      setDisabled(b) { el.classList.toggle('disabled', !!b); },
    };
  }

  /** Ціле число з кнопками − / +. */
  function stepper(o) {
    let value = o.value;
    const val = h('span', { class: 'st-value' });
    const dec = h('button', { class: 'st-btn', 'aria-label': 'Менше' }, icon('minus'));
    const inc = h('button', { class: 'st-btn', 'aria-label': 'Більше' }, icon('plus'));
    const el = h('div', { class: 'ctl stepper' }, h('span', { class: 'ctl-label', text: o.label }), h('div', { class: 'st-box' }, dec, val, inc));
    const paint = () => {
      val.textContent = value;
      dec.disabled = value <= o.min;
      inc.disabled = value >= o.max;
    };
    const change = (d) => {
      const v = clamp(value + d, o.min, o.max);
      if (v === value) return;
      value = v;
      paint();
      gsap.fromTo(val, { y: d > 0 ? 6 : -6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: 'power3.out' });
      o.onChange && o.onChange(value);
    };
    dec.addEventListener('click', () => change(-1));
    inc.addEventListener('click', () => change(1));
    paint();
    return { el, get: () => value, set(v) { value = v; paint(); }, setDisabled(b) { el.classList.toggle('disabled', !!b); } };
  }

  /** Сегментований перемикач із плавним індикатором. */
  function segmented(o) {
    let value = o.value;
    const ind = h('i', { class: 'seg-ind' });
    const btns = o.options.map((opt) =>
      h('button', { class: 'seg-btn', 'data-v': String(opt.value), role: 'radio', title: opt.title, onclick: () => select(opt.value, true) }, opt.icon ? icon(opt.icon) : null, opt.label ? h('span', { text: opt.label }) : null)
    );
    const box = h('div', { class: 'seg' + (o.small ? ' sm' : ''), role: 'radiogroup', 'aria-label': o.label || '' }, ind, ...btns);
    const el = o.label && !o.bare ? h('div', { class: 'ctl segctl' }, h('div', { class: 'ctl-head' }, h('span', { class: 'ctl-label', text: o.label }), o.ovr || null), box) : box;
    function place(animate) {
      const b = btns.find((x) => x.dataset.v === String(value));
      btns.forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', x === b);
      });
      if (!b || !b.offsetWidth) {
        requestAnimationFrame(() => b && b.offsetWidth && place(false));
        return;
      }
      const props = { x: b.offsetLeft, width: b.offsetWidth };
      if (animate) gsap.to(ind, Object.assign({ duration: 0.32, ease: 'power3.out' }, props));
      else gsap.set(ind, props);
    }
    function select(v, fire) {
      const changed = v !== value;
      value = v;
      place(true);
      if (fire && changed && o.onChange) o.onChange(v);
    }
    requestAnimationFrame(() => place(false));
    return { el, box, get: () => value, set(v) { value = v; place(true); }, relayout: () => place(false) };
  }

  /** Перемикач-капсула. */
  function toggle(o) {
    let value = !!o.value;
    const knob = h('i');
    const el = h('button', { class: 'tgl', role: 'switch', 'aria-label': o.label || '' }, knob);
    const paint = (animate) => {
      el.classList.toggle('on', value);
      el.setAttribute('aria-checked', value);
      gsap.to(knob, { x: value ? 14 : 0, duration: animate ? 0.28 : 0, ease: 'back.out(2)' });
    };
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      value = !value;
      paint(true);
      o.onChange && o.onChange(value);
    });
    paint(false);
    return { el, get: () => value, set(v) { value = !!v; paint(true); } };
  }

  /** Кнопка «кубик»: обертається при натисканні. */
  function dice(o) {
    const el = h('button', { class: 'dice', title: o.title || 'Випадково', 'aria-label': o.title || 'Випадково' }, icon('dice'), o.label ? h('span', { text: o.label }) : null);
    el.addEventListener('click', () => {
      gsap.fromTo(el.querySelector('svg'), { rotate: 0 }, { rotate: 180, duration: 0.45, ease: 'back.out(1.6)' });
      o.onClick && o.onClick();
    });
    return el;
  }

  // ── Поповер
  let openPop = null;
  function popover(anchor, content, opts) {
    closePopover();
    const el = h('div', { class: 'popover' + (opts && opts.cls ? ' ' + opts.cls : '') }, content);
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const pw = el.offsetWidth;
    let left = r.left + r.width / 2 - pw / 2;
    left = clamp(left, 12, window.innerWidth - pw - 12);
    el.style.left = left + 'px';
    el.style.top = r.bottom + 8 + 'px';
    gsap.fromTo(el, { opacity: 0, y: -6, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power3.out', transformOrigin: '50% 0%' });
    const onDoc = (e) => {
      if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover();
    };
    const onKey = (e) => e.key === 'Escape' && closePopover();
    setTimeout(() => document.addEventListener('pointerdown', onDoc), 0);
    document.addEventListener('keydown', onKey);
    openPop = { el, off: () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onKey); }, onClose: opts && opts.onClose };
    return el;
  }
  function closePopover() {
    if (!openPop) return;
    const p = openPop;
    openPop = null;
    p.off();
    p.onClose && p.onClose();
    gsap.to(p.el, { opacity: 0, y: -4, duration: 0.14, ease: 'power2.in', onComplete: () => p.el.remove() });
  }

  // ── Модальне вікно
  const stack = [];
  function modal(content, opts) {
    opts = opts || {};
    const root = document.getElementById('modalRoot');
    const card = h('div', { class: 'modal' + (opts.cls ? ' ' + opts.cls : ''), role: 'dialog', 'aria-modal': 'true' }, content);
    if (opts.width) card.style.width = 'min(' + opts.width + 'px, calc(100vw - 32px))';
    const back = h('div', { class: 'modal-back' });
    const wrap = h('div', { class: 'modal-wrap' }, back, card);
    root.appendChild(wrap);
    const prevFocus = document.activeElement;
    gsap.fromTo(back, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(card, { opacity: 0, y: 18, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: 'expo.out' });
    const close = () => {
      const i = stack.indexOf(api);
      if (i < 0) return;
      stack.splice(i, 1);
      document.removeEventListener('keydown', onKey, true);
      gsap.to(back, { opacity: 0, duration: 0.2 });
      gsap.to(card, { opacity: 0, y: 10, scale: 0.985, duration: 0.2, ease: 'power2.in', onComplete: () => wrap.remove() });
      opts.onClose && opts.onClose();
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    };
    const onKey = (e) => {
      if (stack[stack.length - 1] !== api) return;
      if (e.key === 'Escape' && !opts.locked) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKey, true);
    if (!opts.locked) back.addEventListener('click', close);
    const api = { close, card };
    stack.push(api);
    setTimeout(() => {
      const f = card.querySelector('[autofocus]') || card.querySelector('input, button');
      f && f.focus({ preventScroll: true });
    }, 60);
    return api;
  }
  const modalOpen = () => stack.length > 0;

  // ── Тост
  function toast(text, opts) {
    const root = document.getElementById('toastRoot');
    const el = h('div', { class: 'toast' }, text);
    root.appendChild(el);
    gsap.fromTo(el, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.32, ease: 'back.out(1.8)' });
    gsap.to(el, { y: 8, opacity: 0, duration: 0.25, delay: (opts && opts.duration) || 2.2, onComplete: () => el.remove() });
  }

  function confirmDialog(title, text, okLabel, danger) {
    return new Promise((resolve) => {
      let m;
      const done = (v) => { m.close(); resolve(v); };
      const body = h(
        'div',
        { class: 'confirm' },
        h('h3', { class: 'm-title', text: title }),
        h('p', { class: 'm-text', text }),
        h('div', { class: 'm-actions' }, h('button', { class: 'btn ghost', text: 'Скасувати', onclick: () => done(false) }), h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), text: okLabel, autofocus: true, onclick: () => done(true) }))
      );
      m = modal(body, { width: 420, onClose: () => resolve(false) });
    });
  }

  FL.ui = { h, icon, ICONS, slider, stepper, segmented, toggle, dice, popover, closePopover, modal, modalOpen, toast, confirmDialog, clamp };
})();
