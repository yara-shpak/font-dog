/* Експорт: OTF (CFF) через opentype.js і WOFF2 (власний пакувальник + Brotli). */
(function () {
  const FL = (window.FL = window.FL || {});
  const S = FL.store;

  // ── Транслітерація для технічних (ASCII) назв
  const TR = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ъ: '', ё: 'io' };
  function translit(s) {
    return Array.from(s)
      .map((c) => {
        const lo = c.toLowerCase();
        if (TR[lo] === undefined) return c;
        const t = TR[lo];
        return c !== lo && t ? t[0].toUpperCase() + t.slice(1) : t;
      })
      .join('')
      .replace(/[’'ʼ`]/g, '');
  }
  const ascii = (s) => translit(s).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
  const psPart = (s) => ascii(s).replace(/[^A-Za-z0-9]/g, '') || 'Font';

  // ── Побудова OTF
  function toOTPath(cmds) {
    const path = new opentype.Path();
    let lx = NaN;
    let ly = NaN;
    const R = Math.round;
    for (let i = 0; i < cmds.length; ) {
      const op = cmds[i];
      if (op === 0) {
        lx = R(cmds[i + 1]);
        ly = R(cmds[i + 2]);
        path.moveTo(lx, ly);
        i += 3;
      } else if (op === 1) {
        const x = R(cmds[i + 1]);
        const y = R(cmds[i + 2]);
        if (x !== lx || y !== ly) path.lineTo(x, y);
        lx = x;
        ly = y;
        i += 3;
      } else if (op === 2) {
        lx = R(cmds[i + 5]);
        ly = R(cmds[i + 6]);
        path.curveTo(R(cmds[i + 1]), R(cmds[i + 2]), R(cmds[i + 3]), R(cmds[i + 4]), lx, ly);
        i += 7;
      } else {
        path.close();
        i += 1;
      }
    }
    return path;
  }

  function notdef(m, width) {
    const p = new opentype.Path();
    const t = Math.round(m.D * 0.12);
    const x0 = Math.round(m.P * 0.5);
    const x1 = Math.round(width - m.P * 0.5);
    const y1 = Math.round(m.capH);
    p.moveTo(x0, 0); p.lineTo(x1, 0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.close();
    p.moveTo(x0 + t, t); p.lineTo(x0 + t, y1 - t); p.lineTo(x1 - t, y1 - t); p.lineTo(x1 - t, t); p.close();
    return new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: Math.round(width), path: p });
  }

  function buildOTF(style, family, opts) {
    const p = S.project;
    const m = FL.geo.metrics(p.grid, style.params);
    const cs = S.charset();
    const monoW = p.grid.cols * m.P + style.params.spacing * m.P;
    const space = FL.geo.buildGlyph(' ', new Set(), p.grid, style.params);
    const glyphs = [notdef(m, monoW), new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: Math.round(space.advance), path: new opentype.Path() })];
    glyphs[1].addUnicode(0xa0);
    const byChar = new Map([[' ', glyphs[1]]]);
    const names = new Set(['.notdef', 'space']);

    cs.forEach((ch) => {
      if (ch === ' ' || !S.isDrawn(ch)) return;
      const b = FL.geo.buildGlyph(ch, S.cells(ch), p.grid, S.params(ch, style));
      let name = FL.charset.glyphName(ch);
      while (names.has(name)) name += '.alt';
      names.add(name);
      const g = new opentype.Glyph({ name, unicode: ch.codePointAt(0), advanceWidth: Math.round(b.advance), path: toOTPath(b.cmds) });
      glyphs.push(g);
      byChar.set(ch, g);
    });
    if (glyphs.length < 3) throw new Error('немає жодного намальованого гліфа');

    const mapped = new Set(byChar.keys());
    const link = (ch, target) => {
      if (mapped.has(ch) || !byChar.has(target)) return;
      byChar.get(target).addUnicode(ch.codePointAt(0));
      mapped.add(ch);
    };
    if (opts.caseFallback) Object.keys(FL.charset.CASE_PAIRS).forEach((ch) => link(ch, FL.charset.CASE_PAIRS[ch]));
    Object.keys(FL.charset.ALIASES).forEach((ch) => {
      const t = FL.charset.ALIASES[ch];
      if (t !== ' ') link(ch, t);
    });

    // Назви: Regular/Bold — класична пара; решта — окрема «родина» + typographic names
    const styleName = style.name.trim() || 'Regular';
    const ribbi = /^(regular|bold)$/i.test(styleName);
    const famA = ascii(family) || 'Dot Font';
    const styA = ascii(styleName) || 'Regular';
    const localized = famA !== family.trim() || styA !== styleName;
    const legacyFamily = ribbi ? famA : famA + ' ' + styA;
    const legacySub = ribbi ? styA : 'Regular';
    const isBold = /^bold$/i.test(styleName);

    const font = new opentype.Font({
      familyName: legacyFamily,
      styleName: legacySub,
      fullName: famA + ' ' + styA,
      postScriptName: psPart(family) + '-' + psPart(styleName),
      designer: 'Font Dog',
      manufacturer: 'Font Dog',
      version: 'Version 1.000',
      description: 'Dot-matrix font made in Font Dog',
      unitsPerEm: m.upm,
      ascender: m.asc,
      descender: m.des,
      weightClass: style.weight || 400,
      widthClass: 5,
      fsSelection: isBold ? 0x20 : 0x40,
      glyphs,
      tables: { os2: { ulCodePageRange1: 1 | 4, sTypoLineGap: 0 } },
    });
    font.names.preferredFamily = { en: famA };
    font.names.preferredSubfamily = { en: styA };
    if (localized) {
      font.names.fontFamily.uk = ribbi ? family.trim() : family.trim() + ' ' + styleName;
      font.names.fullName.uk = family.trim() + ' ' + styleName;
      font.names.preferredFamily.uk = family.trim();
      font.names.preferredSubfamily.uk = styleName;
    }
    const buf = font.toArrayBuffer();
    return { buffer: patchHead(buf, isBold ? 1 : 0), file: psPart(family) + '-' + psPart(styleName) };
  }

  // ── Робота з бінарним sfnt
  function tables(buf) {
    const dv = new DataView(buf);
    const n = dv.getUint16(4);
    const list = [];
    for (let i = 0; i < n; i++) {
      const o = 12 + i * 16;
      list.push({
        rec: o,
        tag: String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3)),
        offset: dv.getUint32(o + 8),
        length: dv.getUint32(o + 12),
      });
    }
    return { flavor: dv.getUint32(0), list };
  }
  function checksum(dv, off, len) {
    let sum = 0;
    const end = off + Math.ceil(len / 4) * 4;
    for (let p = off; p < end; p += 4) {
      let v = 0;
      for (let b = 0; b < 4; b++) v = v * 256 + (p + b < off + len && p + b < dv.byteLength ? dv.getUint8(p + b) : 0);
      sum = (sum + v) % 4294967296;
    }
    return sum >>> 0;
  }
  /** Ставить macStyle у head і перераховує контрольні суми. */
  function patchHead(buf, macStyle) {
    const dv = new DataView(buf);
    const t = tables(buf).list.find((x) => x.tag === 'head');
    if (!t) return buf;
    dv.setUint16(t.offset + 44, macStyle);
    dv.setUint32(t.offset + 8, 0);
    dv.setUint32(t.rec + 4, checksum(dv, t.offset, t.length));
    const total = checksum(dv, 0, buf.byteLength);
    dv.setUint32(t.offset + 8, (0xb1b0afba - total) >>> 0);
    return buf;
  }

  // ── WOFF2
  const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

  function base128(n) {
    const out = [];
    do {
      out.unshift(n & 0x7f);
      n = Math.floor(n / 128);
    } while (n > 0);
    for (let i = 0; i < out.length - 1; i++) out[i] |= 0x80;
    return out;
  }

  let brotliP = null;
  function loadBrotli() {
    if (!brotliP) {
      brotliP = import('https://cdn.jsdelivr.net/npm/brotli-wasm@3.0.1/index.web.js').then((mod) => mod.default);
      brotliP.catch(() => (brotliP = null));
    }
    return brotliP;
  }

  /** Пакує CFF-шрифт у WOFF2 (null-трансформації, один Brotli-потік). */
  async function toWOFF2(buf) {
    const { flavor, list } = tables(buf);
    const src = new Uint8Array(buf);
    const totalData = list.reduce((a, t) => a + t.length, 0);
    const stream = new Uint8Array(totalData);
    let pos = 0;
    const dir = [];
    list.forEach((t) => {
      stream.set(src.subarray(t.offset, t.offset + t.length), pos);
      pos += t.length;
      const idx = KNOWN.indexOf(t.tag);
      if (idx >= 0) dir.push(idx);
      else {
        dir.push(63);
        for (let i = 0; i < 4; i++) dir.push(t.tag.charCodeAt(i));
      }
      dir.push(...base128(t.length));
    });
    const brotli = FL.exporter.brotli || (await loadBrotli());
    const compressed = brotli.compress(stream, { quality: 11 });
    const headerLen = 48;
    const dataOff = headerLen + dir.length;
    const total = dataOff + compressed.length;
    const padded = Math.ceil(total / 4) * 4;
    const sfntSize = 12 + 16 * list.length + list.reduce((a, t) => a + Math.ceil(t.length / 4) * 4, 0);
    const out = new Uint8Array(padded);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, 0x774f4632); // 'wOF2'
    dv.setUint32(4, flavor);
    dv.setUint32(8, padded);
    dv.setUint16(12, list.length);
    dv.setUint16(14, 0);
    dv.setUint32(16, sfntSize);
    dv.setUint32(20, compressed.length);
    dv.setUint16(24, 1);
    dv.setUint16(26, 0);
    // метадані та приватний блок відсутні — нулі
    out.set(dir, headerLen);
    out.set(compressed, dataOff);
    return out;
  }

  async function build(style, family, opts) {
    const otf = buildOTF(style, family, opts);
    const files = [];
    if (opts.formats.includes('otf')) files.push({ name: otf.file + '.otf', blob: new Blob([otf.buffer], { type: 'font/otf' }) });
    if (opts.formats.includes('woff2')) {
      opts.onStatus && opts.onStatus('Стискаю WOFF2…');
      const w = await toWOFF2(otf.buffer);
      files.push({ name: otf.file + '.woff2', blob: new Blob([w], { type: 'font/woff2' }) });
    }
    return { files, otf: otf.buffer };
  }

  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const fileBase = (family, styleName) => psPart(family) + '-' + psPart(styleName || 'Regular');

  FL.exporter = { fileBase, build, buildOTF, toWOFF2, save, translit, loadBrotli, base128, patchHead };
})();
