/* 출석부(#/attend) 공용 함수 — 화면(js/modules/attend.js)과 서버(worker/src/index.js)가 같이 씀.
   상태: o 출석 · l 지각 · x 결석 · '' 아직. 출석률은 지각을 출석으로 셈(유진님 결정 전 임시, 화면에 「지각=출석으로 계산」).
   잠금: 수업 날짜 + 7일 23:59(한국 시간)까지 교수가 고침. 그 뒤는 관리자 링크로만 풀기.
   교시 시각: 1~3교시 09:00~11:50, 점심, 4~8교시 13:00~17:50 (50분 수업).
   학생·교수 이름, 시간표는 저장소에 없음. 서버(D1)에만, 관리자 가져오기로 넣음.
   PDF 는 외부 라이브러리 없이 makePdf 가 JPEG 쪽 그림을 A4 PDF 로 묶음.
   시험: node --test tests/attend_core.test.js */
(function (root) {
  'use strict';
  var STATUS = { o: '출석', l: '지각', x: '결석' };
  var PERIOD = { 1: ['09:00', '09:50'], 2: ['10:00', '10:50'], 3: ['11:00', '11:50'], 4: ['13:00', '13:50'], 5: ['14:00', '14:50'], 6: ['15:00', '15:50'], 7: ['16:00', '16:50'], 8: ['17:00', '17:50'] };
  var LOCK_DAYS = 7;
  var NEED = 0.85;
  /* 서버 주소(비밀 아님. 들어가는 열쇠는 교수님별 링크에만) */
  var API_BASE = 'https://hj-attend.yujin06344.workers.dev';

  function clean(s) { return String(s == null ? '' : s).replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function validStatus(st) { return st === '' || Object.prototype.hasOwnProperty.call(STATUS, st); }
  function validDate(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(Date.parse(d + 'T00:00:00Z')); }

  /* 회차 id = 날짜 + 교시 범위 예 20261014-p4-6 */
  function sessionId(date, a, b) { return date.replace(/-/g, '') + '-p' + a + '-' + b; }
  function times(a, b) { return [PERIOD[a][0], PERIOD[b][1]]; }

  function dateText(d, short) {
    var p = d.split('-'), w = '일월화수목금토'.charAt(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay());
    return short ? (+p[1]) + '.' + (+p[2]) + '.(' + w + ')' : p[0] + '. ' + (+p[1]) + '. ' + (+p[2]) + '.(' + w + ')';
  }
  /* 한국 날짜(YYYY-MM-DD) */
  function kstDate(ms) { return new Date((ms == null ? Date.now() : ms) + 9 * 3600e3).toISOString().slice(0, 10); }
  /* 이 회차가 잠기는 때(ms): 날짜 + 7일, 그날 23:59:59.999 KST */
  function lockAt(date) { return Date.parse(date + 'T23:59:59.999+09:00') + LOCK_DAYS * 864e5; }
  function isLocked(date, unlocked, ms) { return !unlocked && (ms == null ? Date.now() : ms) > lockAt(date); }
  /* 한국 시각 HH:MM */
  function hm(iso) { var d = new Date(Date.parse(iso) + 9 * 3600e3); return d.toISOString().slice(11, 16); }
  function mdhm(iso) { var d = new Date(Date.parse(iso) + 9 * 3600e3).toISOString(); return (+d.slice(5, 7)) + '.' + (+d.slice(8, 10)) + '. ' + d.slice(11, 16); }

  /* 명단 읽기 → 이름 목록
     - JSON: ["이름", ...] · {"names": [...]} · [{"이름"|"name": ...}, ...]
     - CSV: 첫 줄에 「이름」/「name」 칸이 있으면 그 칸, 없으면 숫자 아닌 첫 칸 · 그 밖: 한 줄에 한 명 */
  function csvCells(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (q) { if (ch === '"') { if (line.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',' || ch === '\t') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function parseRoster(text) {
    var t = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!t) return [];
    var names;
    if (t.charAt(0) === '[' || t.charAt(0) === '{') {
      var j;
      try { j = JSON.parse(t); } catch (e) { throw new Error('JSON 모양이 아니에요'); }
      var arr = Array.isArray(j) ? j : (j.names || j['이름'] || j.roster || j['명단']);
      if (!Array.isArray(arr)) throw new Error('JSON 에 이름 목록이 없어요');
      names = arr.map(function (x) { return clean(x && typeof x === 'object' ? (x['이름'] || x.name || '') : x); });
    } else {
      var lines = t.split(/\r?\n/), head = csvCells(lines[0]).map(clean), col = -1;
      head.forEach(function (h, i) { if (col < 0 && /^(이름|성명|name)$/i.test(h)) col = i; });
      var body = col >= 0 || /^(no|번호|순번)$/i.test(head[0] || '') ? lines.slice(1) : lines;
      names = body.map(function (ln) {
        var c = csvCells(ln).map(clean);
        if (col >= 0) return c[col] || '';
        for (var i = 0; i < c.length; i++) if (c[i] && !/^\d+$/.test(c[i])) return c[i];
        return '';
      });
    }
    return names.filter(Boolean);
  }

  /* 한 회차 집계: marks = {학생id: {st}} , ids = 명단 학생 id */
  function summary(ids, marks) {
    var c = { named: ids.length, here: 0, late: 0, away: 0 };
    ids.forEach(function (id) { var m = marks[id]; var st = m && m.st; if (st === 'o') c.here++; else if (st === 'l') c.late++; else if (st === 'x') c.away++; });
    c.came = c.here + c.late; c.unset = c.named - c.came - c.away;
    return c;
  }
  /* 학생별 출석률: sessions=[{id,hours}], marks={회차: {학생: st}} → 지각=출석.
     checked = 체크된 수업 시간, came = 출석+지각 시간, total = 과정 전체 시간, need = 85% 시간 */
  function rates(studentIds, sessions, marks) {
    var total = sessions.reduce(function (a, s) { return a + s.hours; }, 0), need = Math.ceil(total * NEED);
    var out = {};
    studentIds.forEach(function (id) {
      var checked = 0, came = 0, away = 0;
      sessions.forEach(function (s) {
        var st = (marks[s.id] || {})[id];
        if (!st) return;
        checked += s.hours;
        if (st === 'o' || st === 'l') came += s.hours; else away += s.hours;
      });
      out[id] = { checked: checked, came: came, away: away, total: total, need: need, rate: checked ? came / checked : null, maxPossible: total - away, ok: total - away >= need };
    });
    return out;
  }

  /* JPEG 쪽들 → A4 PDF(바이트). pages=[{jpeg: Uint8Array, w, h}] */
  function makePdf(pages) {
    var enc = function (s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
    var parts = [], off = 0, xref = [];
    function push(u) { parts.push(u); off += u.length; }
    function obj(n, body, stream) {
      xref[n] = off;
      push(enc(n + ' 0 obj\n' + body + (stream ? '\nstream\n' : '\nendobj\n')));
      if (stream) { push(stream); push(enc('\nendstream\nendobj\n')); }
    }
    var W = 595.28, H = 841.89, n = pages.length, kids = [];
    push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>');
    pages.forEach(function (p, i) {
      var pg = 3 + i * 3, im = pg + 1, ct = pg + 2, cs = enc('q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q');
      obj(pg, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>');
      obj(im, '<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>', p.jpeg);
      obj(ct, '<< /Length ' + cs.length + ' >>', cs);
    });
    var total = 3 + n * 3, xo = off, x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var k = 1; k < total; k++) x += ('0000000000' + xref[k]).slice(-10) + ' 00000 n \n';
    push(enc(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xo + '\n%%EOF\n'));
    var out = new Uint8Array(off), at = 0;
    parts.forEach(function (u) { out.set(u, at); at += u.length; });
    return out;
  }

  var api = { STATUS: STATUS, PERIOD: PERIOD, LOCK_DAYS: LOCK_DAYS, NEED: NEED, API_BASE: API_BASE, clean: clean, validStatus: validStatus, validDate: validDate, sessionId: sessionId, times: times, dateText: dateText, kstDate: kstDate, lockAt: lockAt, isLocked: isLocked, hm: hm, mdhm: mdhm, parseRoster: parseRoster, summary: summary, rates: rates, makePdf: makePdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HJAttend = api;
})(typeof window !== 'undefined' ? window : globalThis);
