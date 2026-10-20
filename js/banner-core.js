/* 현수막 생성기 공통 배치 엔진 (HTML·명령줄 스크립트가 같이 씀)
   크기: 가로 4000 또는 5000 × 세로 900 (1단위 = 1mm). 시안은 designs 에 하나씩 추가한다. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./widths.json'));
  else root.BannerCore = factory(root.BANNER_WIDTHS);
})(typeof self !== 'undefined' ? self : this, function (WID) {
  'use strict';
  let W = 4000;
  const H = 900, M = 160;
  const C = { blue: '#3182F6', blueDark: '#1B64DA', blue50: '#E8F3FF', dark: '#191F28',
    g700: '#4E5968', g600: '#6B7684', g500: '#8B95A1', g200: '#E5E8EB', g100: '#F2F4F6', white: '#FFFFFF' };
  // 글자 윗선·아랫선 (em 기준, 한글 기준 대략값)
  const TOP = 0.80, BOT = 0.08;

  const r = v => (Math.round(v * 10) / 10).toString();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s == null ? '' : s).replace(/[\t\r ]+/g, ' ').trim();

  function adv(ch, wt) {
    const t = WID.w[String(wt)]; const c = ch.codePointAt(0);
    if (t[c] != null) return t[c];
    if (c >= 0xAC00 && c <= 0xD7A3) return WID.hangul;
    if (c >= 0x4E00 && c <= 0x9FFF) return WID.hangul;
    return WID.def[String(wt)];
  }
  function measure(s, size, wt) { let a = 0; for (const ch of s) a += adv(ch, wt); return a * size / WID.upm; }
  function fit(s, maxW, maxSize, wt) { const m = measure(s, 1, wt); return m > 0 ? Math.min(maxSize, maxW / m) : maxSize; }

  // 글자 하나 (x는 항상 시작점으로 계산해서 넣음 → 피그마·인쇄용이 똑같이 나옴)
  function T(s, x, y, size, wt, fill, opt) {
    opt = opt || {};
    const w = measure(s, size, wt);
    let sx = x; if (opt.anchor === 'middle') sx = x - w / 2; else if (opt.anchor === 'end') sx = x - w;
    const op = opt.opacity != null && opt.opacity < 1 ? ` fill-opacity="${opt.opacity}"` : '';
    return `<text x="${r(sx)}" y="${r(y)}" font-family="Pretendard" font-size="${r(size)}" font-weight="${wt}" fill="${fill}"${op}>${esc(s)}</text>`;
  }
  const G = (id, body) => body ? `<g id="${id}">${body}</g>` : '';

  // 제목: 한 줄 또는 두 줄 중 더 크게 나오는 쪽
  function splitTwo(s, wt) {
    const words = s.split(' '); if (words.length < 2) return null;
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const m = Math.max(measure(a, 1, wt), measure(b, 1, wt));
      if (!best || m < best.m) best = { m, lines: [a, b] };
    }
    return best.lines;
  }
  function fitBlock(lines, bw, bh, maxSize, wt, lh) {
    const n = lines.length, wmax = Math.max.apply(null, lines.map(l => measure(l, 1, wt)));
    return Math.min(maxSize, bw / wmax, bh / (TOP + BOT + (n - 1) * lh));
  }
  function fitTitle(title, bw, bh, maxSize, wt, lh) {
    wt = wt || 800; lh = lh || 1.12;
    const raw = String(title || '').split(/\n/).map(norm).filter(Boolean);
    if (!raw.length) return { lines: [], size: 0, lh };
    if (raw.length > 1) { const L = raw.slice(0, 3); return { lines: L, size: fitBlock(L, bw, bh, maxSize, wt, lh), lh }; }
    const one = fitBlock(raw, bw, bh, maxSize, wt, lh);
    const two = splitTwo(raw[0], wt);
    if (two) { const s2 = fitBlock(two, bw, bh, maxSize * 0.82, wt, lh); if (s2 > one * 1.3) return { lines: two, size: s2, lh }; }
    return { lines: raw, size: one, lh };
  }
  // 상자 안에 여러 줄 (세로 가운데)
  function drawLines(ft, bx, by, bw, bh, wt, fill, align, valign) {
    const n = ft.lines.length; if (!n) return '';
    const s = ft.size, blockH = (TOP + BOT + (n - 1) * ft.lh) * s;
    let top = by; if (valign !== 'top') top = by + (bh - blockH) / (valign === 'bottom' ? 1 : 2);
    let out = '';
    ft.lines.forEach((l, i) => {
      const y = top + TOP * s + i * ft.lh * s;
      const x = align === 'middle' ? bx + bw / 2 : align === 'end' ? bx + bw : bx;
      out += T(l, x, y, s, wt, fill, { anchor: align });
    });
    return out;
  }

  // 로고
  function parseSvgLogo(text) {
    const m = text.match(/<svg\b[^>]*>/i); if (!m) return null;
    const tag = m[0];
    const vb = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    let w, h;
    if (vb) { const p = vb[1].trim().split(/[\s,]+/).map(Number); w = p[2]; h = p[3]; }
    else { const ww = tag.match(/\swidth\s*=\s*["']([\d.]+)/i), hh = tag.match(/\sheight\s*=\s*["']([\d.]+)/i); w = ww ? +ww[1] : 100; h = hh ? +hh[1] : 100; }
    return { kind: 'svg', content: text, w, h };
  }
  function logoMarkup(logo, bx, by, bw, bh, ax, ay) {
    if (!logo || !logo.w || !logo.h) return '';
    const s = Math.min(bw / logo.w, bh / logo.h), w = logo.w * s, h = logo.h * s;
    const x = ax === 'left' ? bx : ax === 'right' ? bx + bw - w : bx + (bw - w) / 2;
    const y = ay === 'top' ? by : ay === 'bottom' ? by + bh - h : by + (bh - h) / 2;
    if (logo.kind === 'svg') {
      let s2 = logo.content.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();
      s2 = s2.replace(/<svg\b([^>]*)>/i, (all, a) => {
        a = a.replace(/\s(width|height|x|y|preserveAspectRatio)\s*=\s*("[^"]*"|'[^']*')/gi, '');
        if (!/viewBox/i.test(a)) a += ` viewBox="0 0 ${logo.w} ${logo.h}"`;
        return `<svg${a} x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" preserveAspectRatio="xMidYMid meet">`;
      });
      return s2;
    }
    return `<image x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" preserveAspectRatio="xMidYMid meet" xlink:href="${logo.href}" href="${logo.href}"/>`;
  }

  // 일시·장소 한 줄: 「일시 값   장소 값」
  function infoItems(d) { const a = []; if (d.date) a.push(['일시', d.date]); if (d.place) a.push(['장소', d.place]); return a; }
  function infoRow(items, x, y, maxSize, maxW, anchor, col) {
    if (!items.length) return { svg: '', w: 0 };
    const LW = 700, VW = 600;
    const unit = sz => items.reduce((acc, it, i) => acc + measure(it[0], sz, LW) + 0.45 * sz + measure(it[1], sz, VW) + (i ? 1.6 * sz : 0), 0);
    let size = Math.min(maxSize, maxW / unit(1));
    const total = unit(size);
    let cx = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
    let svg = '';
    items.forEach((it, i) => {
      let g = '';
      if (i) { // 구분선
        const lx = cx + 0.8 * size;
        g += `<rect x="${r(lx - 2)}" y="${r(y - 0.72 * size)}" width="4" height="${r(0.8 * size)}" fill="${col.sep}"/>`;
        cx += 1.6 * size;
      }
      g += T(it[0], cx, y, size, LW, col.label, { opacity: col.labelOp }); cx += measure(it[0], size, LW) + 0.45 * size;
      g += T(it[1], cx, y, size, VW, col.value, { opacity: col.valueOp }); cx += measure(it[1], size, VW);
      svg += G(it[0], g);
    });
    return { svg, w: total, size };
  }

  function wrapSvg(name, body) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="900mm" viewBox="0 0 ${W} 900">\n<!-- 현수막 ${name} · ${W}×900mm (1단위=1mm) · 글꼴 Pretendard -->\n${body}\n</svg>\n`;
  }

  // ───────── 시안들 ─────────
  const designs = [];

  // A. 왼쪽 정렬 큰 제목
  designs.push({ key: 'A', name: '왼쪽 정렬', build(d, logo) {
    let b = G('배경', `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.white}"/>`);
    b += G('장식', `<rect x="0" y="${H - 28}" width="${W}" height="28" fill="${C.blue}"/><rect x="${M}" y="118" width="96" height="14" rx="7" fill="${C.blue}"/>`);
    const logoW = logo ? 640 : 0;
    if (logo) b += G('로고', logoMarkup(logo, W - M - 600, 110, 600, 170, 'right', 'top'));
    if (d.subtitle) b += G('부제', T(d.subtitle, M, 250, fit(d.subtitle, W - 2 * M - logoW, 84, 700), 700, C.blue));
    b += G('제목', drawLines(fitTitle(d.title, W - 2 * M, 340, 310), M, 300, W - 2 * M, 340, 800, C.dark, 'start'));
    const ir = infoRow(infoItems(d), M, 785, 74, (W - 2 * M) * 0.6, 'start', { label: C.blue, value: C.dark, sep: C.g200 });
    b += ir.svg;
    if (d.host) { const hw = W - 2 * M - ir.w - 140; b += G('주최주관', T(d.host, W - M, 785, fit(d.host, hw, 56, 600), 600, C.g600, { anchor: 'end' })); }
    return b;
  } });

  // B. 가운데 정렬
  designs.push({ key: 'B', name: '가운데 정렬', build(d, logo) {
    let b = G('배경', `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.g100}"/>`);
    if (logo) b += G('로고', logoMarkup(logo, 120, 100, 440, 140, 'left', 'top'));
    if (d.subtitle) {
      const maxW = W - 2 * (logo ? 640 : 400);
      const sz = fit(d.subtitle, maxW - 120, 72, 700), tw = measure(d.subtitle, sz, 700), ph = sz * 1.7;
      b += G('부제', `<rect x="${r(W / 2 - tw / 2 - 0.8 * sz)}" y="${r(175 - ph / 2)}" width="${r(tw + 1.6 * sz)}" height="${r(ph)}" rx="${r(ph / 2)}" fill="${C.white}"/>` +
        T(d.subtitle, W / 2, 175 + 0.36 * sz, sz, 700, C.blue, { anchor: 'middle' }));
    }
    b += G('제목', drawLines(fitTitle(d.title, W - 400, 330, 300), 200, 260, W - 400, 330, 800, C.dark, 'middle'));
    b += infoRow(infoItems(d), W / 2, 715, 76, W - 800, 'middle', { label: C.blue, value: C.dark, sep: '#D1D6DB' }).svg;
    if (d.host) b += G('주최주관', T(d.host, W / 2, 822, fit(d.host, W - 800, 50, 600), 600, C.g500, { anchor: 'middle' }));
    return b;
  } });

  // C. 블루 배경 반전
  designs.push({ key: 'C', name: '블루 배경', build(d, logo) {
    let b = G('배경', `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.blue}"/>`);
    b += G('장식', `<circle cx="3720" cy="-60" r="560" fill="${C.white}" fill-opacity="0.08"/><circle cx="3980" cy="900" r="360" fill="${C.white}" fill-opacity="0.06"/><circle cx="${M + 48}" cy="128" r="12" fill="${C.white}" fill-opacity="0.9"/>`);
    let logoW = 0;
    if (logo) {
      const s = Math.min(520 / logo.w, 120 / logo.h), lw = logo.w * s, cw = lw + 96, ch = 180;
      logoW = cw + 60;
      b += G('로고', `<rect x="${r(W - M - cw)}" y="105" width="${r(cw)}" height="${ch}" rx="40" fill="${C.white}"/>` + logoMarkup(logo, W - M - cw + 48, 135, lw, 120, 'center', 'center'));
    }
    if (d.subtitle) b += G('부제', T(d.subtitle, M + 90, 155, fit(d.subtitle, W - 2 * M - 90 - logoW, 72, 700), 700, C.white, { opacity: 0.9 }));
    b += G('제목', drawLines(fitTitle(d.title, W - 2 * M - (logo ? 0 : 300), 350, 310), M, 250, W - 2 * M - (logo ? 0 : 300), 350, 800, C.white, 'start'));
    // 일시·장소 알약 모양
    let x = M; const sz0 = 62, items = infoItems(d);
    const pillW = it => measure(it[0], sz0, 600) + 0.45 * sz0 + measure(it[1], sz0, 700) + 2 * 52;
    const totalW = items.reduce((a, it) => a + pillW(it) + 28, 0);
    const maxInfo = (W - 2 * M) * 0.62, k = totalW > maxInfo ? maxInfo / totalW : 1, sz = sz0 * k, ph = 124 * Math.max(k, 0.7), py = 690;
    items.forEach(it => {
      const pw = pillW(it) * k;
      let g = `<rect x="${r(x)}" y="${py}" width="${r(pw)}" height="${r(ph)}" rx="${r(ph / 2)}" fill="${C.white}" fill-opacity="0.16"/>`;
      const by = py + ph / 2 + 0.36 * sz;
      g += T(it[0], x + 52 * k, by, sz, 600, C.white, { opacity: 0.75 });
      g += T(it[1], x + 52 * k + measure(it[0], sz, 600) + 0.45 * sz, by, sz, 700, C.white);
      b += G(it[0], g); x += pw + 28 * k;
    });
    if (d.host) b += G('주최주관', T(d.host, W - M, py + ph / 2 + 0.36 * 54, fit(d.host, W - 2 * M - (x - M) - 120, 54, 600), 600, C.white, { anchor: 'end', opacity: 0.85 }));
    return b;
  } });

  // D. 로고 강조 (왼쪽 큰 로고 칸)
  designs.push({ key: 'D', name: '로고 강조', build(d, logo) {
    const PW = 1180, X0 = PW + 180, RW = W - X0 - M;
    let b = G('배경', `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.white}"/><rect x="0" y="0" width="${PW}" height="${H}" fill="${C.blue50}"/>`);
    let titleY = 150, titleH = 430;
    if (logo) {
      b += G('로고', logoMarkup(logo, 150, 150, PW - 300, 600, 'center', 'center'));
      if (d.subtitle) b += G('부제', T(d.subtitle, X0, 240, fit(d.subtitle, RW, 76, 700), 700, C.blue));
      titleY = 285; titleH = 305;
    } else if (d.subtitle) {
      // 로고가 없으면 부제를 로고 칸에 크게
      const words = norm(d.subtitle);
      let lines = [words];
      const two = splitTwo(words, 800); if (two) lines = two;
      const ft = { lines, lh: 1.25, size: fitBlock(lines, PW - 280, 520, 150, 800, 1.25) };
      b += G('부제', drawLines(ft, 140, 190, PW - 280, 520, 800, C.blue, 'middle'));
    }
    b += G('제목', drawLines(fitTitle(d.title, RW, titleH, 300), X0, titleY, RW, titleH, 800, C.dark, 'start'));
    b += infoRow(infoItems(d), X0, 728, 72, RW, 'start', { label: C.blue, value: C.dark, sep: C.g200 }).svg;
    if (d.host) b += G('주최주관', T(d.host, X0, 822, fit(d.host, RW, 50, 600), 600, C.g600));
    return b;
  } });

  // E. 정보 카드 (오른쪽에 일시·장소 카드)
  designs.push({ key: 'E', name: '정보 카드', build(d, logo) {
    const CX = 2660, CW = W - M - CX, LW = CX - M - 160;
    let b = G('배경', `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.white}"/>`);
    let logoW = 0;
    if (logo) { b += G('로고', logoMarkup(logo, M + LW - 520, 150, 520, 130, 'right', 'top')); logoW = 580; }
    if (d.subtitle) b += G('부제', T(d.subtitle, M, 250, fit(d.subtitle, LW - logoW, 80, 700), 700, C.blue));
    b += G('제목', drawLines(fitTitle(d.title, LW, 360, 300), M, 300, LW, 360, 800, C.dark, 'start'));
    if (d.host) b += G('주최주관', T(d.host, M, 790, fit(d.host, LW, 56, 600), 600, C.g600));
    const items = infoItems(d), n = items.length;
    if (n) {
      const gap = 32, ch = n === 1 ? 360 : 300, totalH = n * ch + (n - 1) * gap;
      let y = (H - totalH) / 2;
      items.forEach(it => {
        const vs = fit(it[1], CW - 150, 110, 800);
        let g = `<rect x="${CX}" y="${r(y)}" width="${CW}" height="${ch}" rx="48" fill="${C.g100}"/>`;
        g += T(it[0], CX + 75, y + 105, 58, 700, C.blue);
        g += T(it[1], CX + 75, y + ch - 70, vs, 800, C.dark);
        b += G(it[0], g); y += ch + gap;
      });
    }
    return b;
  } });

  // 오른쪽 작은 비행기 (예전 남색 시안). 큰 비행기 그림은 호출하는 쪽에서 넣는다.
  function sidePlane(x, y, len, fill) {
    const h = len * 0.34;
    return `<g transform="translate(${r(x)} ${r(y)})">` +
      `<path d="M0 ${r(h * 0.42)} L${r(len * 0.55)} ${r(h * 0.28)} L${r(len)} ${r(h * 0.46)} L${r(len * 0.62)} ${r(h * 0.55)} L${r(len * 0.48)} ${r(h)} L${r(len * 0.34)} ${r(h * 0.58)} L${r(len * 0.22)} ${r(h * 0.72)} L${r(len * 0.12)} ${r(h * 0.5)} Z" fill="${fill}"/>` +
      `<path d="M${r(-len * 0.55)} ${r(h * 0.62)} H${r(len * 0.05)}" fill="none" stroke="${fill}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M${r(-len * 0.35)} ${r(h * 0.82)} H${r(len * 0.02)}" fill="none" stroke="${fill}" stroke-width="2" stroke-linecap="round" opacity="0.45"/>` +
      `</g>`;
  }
  function planeBox(opt) {
    const href = opt && opt.plane;
    const pw = Math.min(1360, H * (858 / 575));
    if (!href) return { svg: sidePlane(W - 980, 180, 860, C.blue), w: 980 };
    return {
      svg: `<image x="${r(W - pw)}" y="0" width="${r(pw)}" height="${H}" preserveAspectRatio="xMaxYMid meet" href="${href}" xlink:href="${href}"/>`,
      w: pw * 0.72
    };
  }

  // F. 예전 현수막 v03. 흰 바탕, 큰 제목, 오른쪽 비행기.
  designs.push({ key: 'F', name: '비행기', group: '예전 현수막', build(d, logo, opt) {
    const plane = planeBox(opt);
    const left = 150;
    const textW = Math.max(1400, W - plane.w - left - 40);
    let b = G('배경', `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.white}"/>`);
    b += G('장식', plane.svg);
    if (d.subtitle) b += G('부제', T(d.subtitle, left, 200, fit(d.subtitle, textW, 88, 700), 700, '#1D2636'));
    b += G('제목', drawLines(fitTitle(d.title, textW, 400, 300), left, 230, textW, 420, 800, '#1D2636', 'start'));
    let x = left;
    const by = 770;
    if (logo) {
      b += G('로고', logoMarkup(logo, left, 640, 200, 150, 'left', 'center'));
      x = left + 220;
    }
    if (d.host) {
      const hs = fit(d.host, Math.min(1100, textW * 0.46), 58, 600);
      b += G('주최주관', T(d.host, x, by, hs, 600, '#5D6978'));
      x += measure(d.host, hs, 600) + 40;
    }
    const bits = [];
    if (d.date) bits.push(d.date);
    if (d.place) bits.push(d.place);
    if (bits.length) {
      const label = bits.join('   ');
      const sz = fit(label, Math.max(280, textW - (x - left)), 58, 600);
      b += G('일시', `<rect x="${r(x)}" y="${r(by - 46)}" width="4" height="62" rx="2" fill="#96A0AC"/>` + T(label, x + 28, by, sz, 600, '#317BBF'));
    }
    if (d.place) b += G('장소', '');
    return b;
  } });

  // G. 예전 현수막 v04. 남색 바탕, 왼쪽 흰 카드.
  designs.push({ key: 'G', name: '남색 카드', group: '예전 현수막', build(d, logo) {
    const navy = '#0C3D86';
    const cardW = Math.min(1360, Math.max(980, W * 0.28));
    const cardH = 540;
    const cardX = 100;
    const cardY = 150;
    let b = G('배경', `<rect x="0" y="0" width="${W}" height="${H}" fill="${navy}"/>`);
    b += G('장식', `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="36" fill="${C.white}"/>`);
    const pad = 48;
    let textX = cardX + pad;
    let textW = cardW - pad * 2;
    if (logo) {
      b += G('로고', logoMarkup(logo, cardX + pad, cardY + 70, 180, 400, 'left', 'center'));
      textX = cardX + pad + 200;
      textW = cardW - pad * 2 - 200;
    }
    if (d.subtitle) b += G('부제', T(d.subtitle, textX, cardY + 210, fit(d.subtitle, textW, 64, 800), 800, '#1D2636'));
    if (d.host) b += G('주최주관', T(d.host, textX, cardY + 300, fit(d.host, textW, 40, 600), 600, '#5D6978'));
    const titleX = cardX + cardW + 80;
    const titleW = W - titleX - 140;
    b += G('제목', drawLines(fitTitle(d.title, titleW, 300, 210), titleX, 180, titleW, 320, 800, C.white, 'start'));
    const y = 730;
    let info = `<line x1="${titleX}" y1="${y}" x2="${r(W - 200)}" y2="${y}" stroke="${C.white}" stroke-opacity="0.45" stroke-width="3"/>`;
    info += sidePlane(W - 250, y - 36, 160, C.white);
    if (d.date) info += T(d.date, titleX, y - 22, fit(d.date, titleW * 0.55, 52, 600), 600, C.white);
    b += G('일시', info);
    if (d.place) b += G('장소', T(d.place, titleX, 820, fit(d.place, titleW, 40, 600), 600, C.white, { opacity: 0.85 }));
    return b;
  } });

  // H. 참고로 받은 현수막. 양쪽 파란 꺾임, 큰 한 줄 제목.
  designs.push({ key: 'H', name: '참고', group: '예전 현수막', build(d, logo) {
    const edge = '#1E5BB8';
    const edge2 = '#4C97FF';
    let deco = `<polygon points="0,0 460,0 0,${H}" fill="${edge}"/>`;
    deco += `<polygon points="0,0 250,0 0,520" fill="${edge2}"/>`;
    deco += `<polygon points="${W},0 ${W - 420},0 ${W},${H}" fill="${edge}"/>`;
    deco += `<polygon points="${W},${H} ${W - 220},${H} ${W},340" fill="${edge2}"/>`;
    let b = G('배경', `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.white}"/>`);
    b += G('장식', deco);
    const left = 170;
    let textX = left;
    if (logo) {
      b += G('로고', logoMarkup(logo, left, 70, 150, 220, 'left', 'top'));
      textX = left + 170;
    }
    if (d.subtitle) b += G('부제', T(d.subtitle, textX, 150, fit(d.subtitle, 980, 70, 800), 800, edge));
    if (d.host) b += G('주최주관', T(d.host, textX, 220, fit(d.host, 1100, 42, 600), 600, '#1D2636'));
    const titleW = W - 300;
    b += G('제목', drawLines(fitTitle(d.title, titleW, 430, 280), 150, 270, titleW, 430, 800, '#191F28', 'start'));
    const meta = [d.date, d.place].filter(Boolean).join('    ');
    if (meta) b += G('일시', T(meta, W / 2, 830, fit(meta, titleW, 52, 600), 600, '#191F28', { anchor: 'middle' }));
    return b;
  } });

  function clean(d) {
    d = d || {};
    const pick = (...ks) => { for (const k of ks) if (d[k] != null && String(d[k]).trim() !== '') return String(d[k]); return ''; };
    return {
      title: pick('title', '제목').replace(/\r/g, '').split('\n').map(norm).filter(Boolean).join('\n'),
      subtitle: norm(pick('subtitle', '부제')), date: norm(pick('date', '일시')),
      place: norm(pick('place', '장소')), host: norm(pick('host', '주최주관', '주최/주관', '주최')),
    };
  }
  function buildAll(data, logo, opt) {
    W = opt && Number(opt.w) === 5000 ? 5000 : 4000;
    const d = clean(data);
    const extra = opt || {};
    return designs.map(x => ({
      key: x.key,
      name: x.name,
      group: x.group || '기본 시안',
      w: W,
      h: H,
      svg: wrapSvg(`시안${x.key} ${x.name}`, x.build(d, logo || null, extra))
    }));
  }
  return { buildAll, parseSvgLogo, measure, designs: designs.map(x => ({ key: x.key, name: x.name, group: x.group || '기본 시안' })), widths: [4000, 5000], W, H };
});
