/* Набори символів, вкладки і генерація гліфів під будь-яку сітку. */
(function () {
  const FL = (window.FL = window.FL || {});

  const SETS = [
    { id: 'latinUpper', tab: 'latin', group: 'Великі', label: 'A–Z', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
    { id: 'latinLower', tab: 'latin', group: 'Малі', label: 'a–z', chars: 'abcdefghijklmnopqrstuvwxyz' },
    { id: 'cyrUpper', tab: 'cyr', group: 'Великі', label: 'А–Я', chars: 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ' },
    { id: 'cyrLower', tab: 'cyr', group: 'Малі', label: 'а–я', chars: 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя' },
    { id: 'digits', tab: 'num', group: 'Цифри', label: '0–9', chars: '0123456789' },
    { id: 'punct', tab: 'sym', group: 'Пунктуація', label: '. , ! ? « »', chars: '.,:;!?\'"’‘“”„«»-–—…()[]{}/\\|_' },
    { id: 'symbols', tab: 'sym', group: 'Знаки', label: '@ # % & + =', chars: '@#%&*+=<>^~`°·•×÷№§' },
    { id: 'currency', tab: 'sym', group: 'Валюти', label: '$ € ₴ £', chars: '$€₴£' },
    { id: 'extras', tab: 'sym', group: 'Стрілки й іконки', label: '→ ↑ ♥ ★', chars: '→←↑↓♥★●' },
  ];
  SETS.forEach((s) => (s.list = Array.from(s.chars)));

  const TABS = [
    { id: 'latin', label: 'Латиниця', short: 'Aa' },
    { id: 'cyr', label: 'Кирилиця', short: 'Аа' },
    { id: 'num', label: 'Цифри', short: '01' },
    { id: 'sym', label: 'Символи', short: '#?' },
    { id: 'custom', label: 'Власні', short: '✦' },
  ];

  const TAB_OF = {};
  SETS.forEach((s) => s.list.forEach((ch) => (TAB_OF[ch] = s.tab)));

  /** Пари регістрів для підстановки відсутніх малих/великих літер. */
  const CASE_PAIRS = {};
  [['latinUpper', 'latinLower'], ['cyrUpper', 'cyrLower']].forEach(([u, l]) => {
    const U = SETS.find((s) => s.id === u).list;
    const L = SETS.find((s) => s.id === l).list;
    U.forEach((ch, i) => {
      CASE_PAIRS[ch] = L[i];
      CASE_PAIRS[L[i]] = ch;
    });
  });

  /** Типографські відповідники: якщо символу немає, беремо інший. */
  const ALIASES = { 'ʼ': '’', "'": '’', '’': "'", '‘': "'", '"': '”', '“': '"', '”': '"', '—': '–', '–': '-', '−': '-', ' ': ' ' };

  function charsetOf(project) {
    const out = [];
    const seen = new Set();
    SETS.forEach((s) => {
      if (!project.sets[s.id]) return;
      s.list.forEach((ch) => {
        if (!seen.has(ch)) { seen.add(ch); out.push(ch); }
      });
    });
    (project.custom || []).forEach((ch) => {
      if (!seen.has(ch)) { seen.add(ch); out.push(ch); }
    });
    return out;
  }

  function tabOf(ch, project) {
    if (project && (project.custom || []).includes(ch) && !TAB_OF[ch]) return 'custom';
    return TAB_OF[ch] || 'custom';
  }

  /** Групи для вкладки (з урахуванням вибраних наборів). */
  function groupsFor(tab, project) {
    if (tab === 'custom') {
      const list = (project.custom || []).filter((ch) => !TAB_OF[ch]);
      return [{ id: 'custom', group: 'Власні гліфи', list }];
    }
    return SETS.filter((s) => s.tab === tab && project.sets[s.id]).map((s) => ({ id: s.id, group: s.group, list: s.list }));
  }

  function setsForTab(tab) {
    return SETS.filter((s) => s.tab === tab);
  }

  function codeLabel(ch) {
    const cp = ch.codePointAt(0);
    return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  }

  function glyphName(ch) {
    if (ch === ' ') return 'space';
    if (/^[A-Za-z]$/.test(ch)) return ch;
    const cp = ch.codePointAt(0);
    return cp > 0xffff ? 'u' + cp.toString(16).toUpperCase() : 'uni' + cp.toString(16).toUpperCase().padStart(4, '0');
  }

  // ── Генерація ────────────────────────────────────────────────────────────

  const key = (x, y) => x + ',' + y;

  /** Масштабує шаблон 5×7(+2) на іншу сітку, «перемальовуючи» його каркас лініями. */
  function resample(cells, grid) {
    if (!cells) return [];
    const desc = grid.desc;
    const top = grid.top || 0;
    const fit = cells.filter(([, y]) => y >= -desc && y < 7 + top);
    if (grid.cols === 5 && grid.rows === 7) return fit.map(([x, y]) => [x, y]);

    const has = new Set(cells.map(([x, y]) => key(x, y)));
    const mx = (x) => (x * (grid.cols - 1)) / 4;
    const my = (y) => (y > 6 ? grid.rows - 1 + ((y - 6) * top) / 2 : y >= 0 ? (y * (grid.rows - 1)) / 6 : (y * desc) / 2);
    const out = new Map();
    const cx = (grid.cols - 1) / 2;
    // половинки округлюємо до центру, щоб симетричні літери лишались симетричними
    const roundX = (v) => (Math.abs(v - Math.floor(v) - 0.5) < 1e-6 ? (v < cx ? Math.ceil(v) : Math.floor(v)) : Math.round(v));
    const plot = (fx, fy) => {
      const x = roundX(fx);
      const y = Math.round(fy);
      if (x < 0 || x >= grid.cols || y < -desc || y >= grid.rows + top) return;
      out.set(key(x, y), [x, y]);
    };
    const line = (x0, y0, x1, y1) => {
      const ax = mx(x0), ay = my(y0), bx = mx(x1), by = my(y1);
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let i = 0; i <= steps; i++) plot(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps);
    };
    cells.forEach(([x, y]) => {
      if ((y < 0 && desc === 0) || (y > 6 && top === 0)) return;
      plot(mx(x), my(y));
      [[1, 0], [0, 1], [1, 1], [1, -1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (!has.has(key(nx, ny))) return;
        if ((ny < 0 || y < 0) && desc === 0) return;
        if ((ny > 6 || y > 6) && top === 0) return;
        if (dx && dy && (has.has(key(nx, y)) || has.has(key(x, ny)))) return;
        line(x, y, nx, ny);
      });
    });
    return Array.from(out.values());
  }

  function fromTemplate(ch, grid) {
    return resample(FL.templates.cellsOf(ch, { tall: (grid.top || 0) >= 2 }), grid);
  }

  let rasterCanvas = null;
  /** Растеризує символ системним шрифтом у сітку (добре для великих сіток). */
  function fromFont(ch, grid, family, weight, level) {
    const S = 16;
    const W = grid.cols * S;
    const top = grid.top || 0;
    const H = (top + grid.rows + grid.desc) * S;
    if (!rasterCanvas) rasterCanvas = document.createElement('canvas');
    const c = rasterCanvas;
    c.width = W * 3;
    c.height = H * 2;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const fam = `${weight} 100px ${family ? `"${family}", ` : ''}sans-serif`;
    ctx.font = fam;
    const capM = ctx.measureText('H');
    const capPx = capM.actualBoundingBoxAscent || 72;
    const px = (100 * grid.rows * S) / capPx;
    ctx.font = `${weight} ${px}px ${family ? `"${family}", ` : ''}sans-serif`;
    ctx.clearRect(0, 0, c.width, c.height);
    const m = ctx.measureText(ch);
    const inkW = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width);
    const scaleX = inkW > W ? W / inkW : 1;
    ctx.save();
    ctx.translate(W / 2, 0);
    ctx.scale(scaleX, 1);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(ch, -inkW / 2 + (m.actualBoundingBoxLeft || 0), (top + grid.rows) * S);
    ctx.restore();
    const data = ctx.getImageData(0, 0, W, H).data;
    const out = [];
    for (let r = 0; r < top + grid.rows + grid.desc; r++) {
      for (let x = 0; x < grid.cols; x++) {
        let sum = 0;
        for (let yy = 0; yy < S; yy++) {
          for (let xx = 0; xx < S; xx++) sum += data[((r * S + yy) * W + (x * S + xx)) * 4 + 3];
        }
        if (sum / (S * S * 255) > level) out.push([x, top + grid.rows - 1 - r]);
      }
    }
    return out;
  }

  FL.charset = { SETS, TABS, ALIASES, CASE_PAIRS, charsetOf, tabOf, groupsFor, setsForTab, codeLabel, glyphName, key };
  FL.gen = { fromTemplate, fromFont, resample };
})();
