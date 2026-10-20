/* 출석부·서명부: 명단 읽기·제목 줄 찾기·표 만들기. 화면 없이 계산만 해요. 명단은 어디에도 보내지 않아요. */
(function (root) {
  'use strict';
  var FIELDS = [
    { id: 'no', label: '번호', syn: ['번호', '순번', '연번', 'no', 'no.', '순'] },
    { id: 'name', label: '성명', syn: ['성명', '이름', '성함', '학생명', '성명(한글)', '이름(한글)', 'name'] },
    { id: 'gender', label: '성별', syn: ['성별', '남녀'] },
    { id: 'grade', label: '학년', syn: ['학년', '직/학년', '학년/직위', '직위', '직급'] },
    { id: 'sid', label: '학번', syn: ['학번', '교번', '사번', '수험번호'] },
    { id: 'cls', label: '반', syn: ['반', '분반'] },
    { id: 'kind', label: '구분', syn: ['구분'] },
    { id: 'dept', label: '소속', syn: ['소속', '학과', '전공', '부서', '소속학과', '학부'] },
    { id: 'dorm', label: '기숙사', syn: ['기숙사', '기숙사여부'] },
    { id: 'room', label: '호실', syn: ['호실', '기숙사호실', '방', '방번호'] },
    { id: 'status', label: '상태', syn: ['상태'] },
    { id: 'note', label: '비고', syn: ['비고'] }
  ];
  /* 화면에도 엑셀에도 절대 안 나오는 칸 */
  var SENSITIVE = /생년월일|생일|출생|이메일|e-?mail|메일|전화|휴대|핸드폰|연락처|phone|tel|비상|주민|외국인등록|여권|계좌|은행|예금주|주소|address|우편/i;

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }
  function text(v) { return String(v == null ? '' : v).replace(/\r/g, '').trim(); }

  function matchField(h) {
    var n = norm(h);
    if (!n) return null;
    if (SENSITIVE.test(n)) return 'sensitive';
    var best = null, bestLen = 0;
    FIELDS.forEach(function (f) {
      f.syn.forEach(function (s) {
        var ok = n === s || (s.length >= 2 && n.indexOf(s) >= 0 && n.length <= s.length + 4);
        if (ok && (n === s ? 100 : s.length) > bestLen) { best = f.id; bestLen = n === s ? 100 : s.length; }
      });
    });
    return best;
  }

  /* 병합 칸: 제목 줄 근처는 가로·세로 모두, 명단 칸은 세로로만 채워요(학과처럼 여러 줄 묶인 칸). */
  function fillMerges(aoa, merges, headerZone) {
    (merges || []).forEach(function (m) {
      var v = (aoa[m.s.r] || [])[m.s.c];
      if (v == null || v === '') return;
      var horiz = m.e.c > m.s.c;
      if (horiz && m.s.r > headerZone) return;
      for (var r = m.s.r; r <= m.e.r; r++) {
        aoa[r] = aoa[r] || [];
        for (var c = m.s.c; c <= m.e.c; c++) if (aoa[r][c] == null || aoa[r][c] === '') aoa[r][c] = v;
      }
    });
    return aoa;
  }

  function scoreRow(row) {
    var hit = 0, name = false, seen = {};
    (row || []).forEach(function (v) {
      var f = matchField(v);
      if (!f || seen[f] && f !== 'sensitive') return;
      seen[f] = 1;
      hit += 1;
      if (f === 'name') name = true;
    });
    return hit + (name ? 2 : 0);
  }

  function detectHeader(aoa) {
    var best = -1, bestScore = 0;
    for (var r = 0; r < Math.min(aoa.length, 10); r++) {
      var s = scoreRow(aoa[r]);
      if (s > bestScore) { bestScore = s; best = r; }
    }
    return bestScore >= 3 ? best : (best >= 0 && bestScore >= 2 ? best : -1);
  }

  /* aoa: 시트 2차원 배열, merges: SheetJS !merges, hdr: 제목 줄(0부터, 없으면 위 10줄에서 찾아요),
     override: { 열번호: 필드 이름 | '' } 사용자가 드롭다운으로 고친 칸 */
  function readRoster(aoaIn, merges, hdr, override) {
    override = override || {};
    var aoa = aoaIn.map(function (r) { return (r || []).slice(); });
    fillMerges(aoa, merges, 10);
    if (hdr == null || hdr < 0) hdr = detectHeader(aoa);
    var found = hdr >= 0;
    if (!found) hdr = 0;
    var hEnd = found ? hdr : -1;
    if (found) (merges || []).forEach(function (m) { if (m.s.r === hdr && m.e.r > hEnd && m.e.r - hdr <= 2) hEnd = m.e.r; });
    var width = 0;
    aoa.forEach(function (r) { if (r && r.length > width) width = r.length; });
    var head = found ? (aoa[hdr] || []) : [];
    var cols = [], used = {};
    Object.keys(override).forEach(function (k) { if (override[k]) used[override[k]] = Number(k); });
    for (var c = 0; c < width; c++) {
      var label = text(head[c]);
      if (found) for (var k = hdr + 1; k <= hEnd; k++) { var sub = text((aoa[k] || [])[c]); if (sub && sub !== label) label = label ? label + ' ' + sub : sub; }
      var f = found ? matchField(label) : null;
      var hasData = aoa.slice(hEnd + 1).some(function (r) { return r && text(r[c]) !== ''; });
      if (!label && !hasData) continue;
      if (f !== 'sensitive' && Object.prototype.hasOwnProperty.call(override, c)) f = override[c] || null;
      if (f && f !== 'sensitive' && used[f] != null && used[f] !== c) f = null;
      if (f && f !== 'sensitive') used[f] = c;
      cols.push({ idx: c, label: label || ('열 ' + colName(c)), field: f === 'sensitive' ? null : f, sensitive: f === 'sensitive' });
      if (f !== 'sensitive') { var keepRows = aoa.slice(hEnd + 1).filter(function (r) { return r && r.some(function (x) { return text(x) !== ''; }); }).slice(0, 5).map(function (r) { return text((r || [])[c]); }); cols[cols.length - 1].sample = keepRows; }
    }
    var nameCol = used.name != null ? used.name : -1;
    var rows = [], skipped = { blank: 0, header: 0, total: 0 };
    for (var r = hEnd + 1; r < aoa.length; r++) {
      var row = aoa[r] || [];
      var vals = cols.filter(function (cl) { return !cl.sensitive; }).map(function (cl) { return text(row[cl.idx]); });
      if (!vals.some(Boolean)) { skipped.blank += 1; continue; }
      var nm = nameCol >= 0 ? text(row[nameCol]) : '';
      if (nameCol >= 0 && norm(nm) === norm(head[nameCol])) { skipped.header += 1; continue; }
      if (!nm && vals.some(function (v) { return /^(합계|소계|총계|계|출석인원|인원|총원)/.test(norm(v)); })) { skipped.total += 1; continue; }
      if (nameCol >= 0 && !nm && vals.filter(Boolean).length === 1 && /^\d+$/.test(vals.filter(Boolean)[0])) { skipped.blank += 1; continue; }
      var rec = { _row: r + 1, _cells: {} };
      cols.forEach(function (cl) {
        if (cl.sensitive) return;
        var v = text(row[cl.idx]);
        rec._cells[cl.idx] = v;
        if (cl.field && rec[cl.field] == null) rec[cl.field] = v;
      });
      rec.name = rec.name || '';
      rows.push(rec);
    }
    return { headerRow: found ? hdr : -1, headerEnd: hEnd, cols: cols, rows: rows, skipped: skipped, nameCol: nameCol };
  }

  function colName(c) { var s = ''; c += 1; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }

  function checks(rows) {
    var seen = {}, dup = [], blank = [];
    rows.forEach(function (r, i) {
      if (!r.name) { blank.push(i); return; }
      var key = norm(r.name) + '|' + norm(r.sid || '');
      if (seen[key] != null) dup.push([seen[key], i]);
      else seen[key] = i;
    });
    return { dup: dup, blank: blank };
  }

  function sortRows(rows, how) {
    var out = rows.slice();
    if (how === 'name') out.sort(function (a, b) { return String(a.name || '\uffff').localeCompare(String(b.name || '\uffff'), 'ko', { numeric: true }); });
    return out;
  }

  /* 표 한 장: head(칸 이름들), body(줄들), meta */
  function buildTable(form, roster, opt) {
    opt = opt || {};
    var picked = (opt.picked || []).map(function (idx) { return roster.cols.filter(function (c) { return c.idx === idx; })[0]; }).filter(Boolean);
    var dates = (opt.dates || []).filter(Boolean);
    var nSess = form.sessions ? (dates.length || Math.max(1, Math.min(40, opt.sessions || form.sessions.count))) : 0;
    var spec = [];
    form.cols.forEach(function (c) {
      if (c.kind === 'picked') picked.forEach(function (p) { spec.push({ label: p.label, src: 'col', idx: p.idx, field: p.field }); });
      else if (c.kind === 'sessions') for (var i = 0; i < nSess; i++) spec.push({ label: form.sessions.label(i, dates[i] || ''), src: 'blank', session: true });
      else if (c.kind === 'no') spec.push({ label: c.label, src: 'no' });
      else if (c.kind === 'countO') spec.push({ label: c.label, src: 'countO' });
      else if (c.field) spec.push({ label: c.label, src: 'field', field: c.field });
      else spec.push({ label: c.label, src: 'blank', w: c.w });
    });
    var rows = sortRows(roster.rows, opt.sort);
    var body = rows.map(function (r, i) {
      return spec.map(function (s) {
        if (s.src === 'no') return String(i + 1);
        if (s.src === 'col') return r._cells[s.idx] || '';
        if (s.src === 'field') return r[s.field] || '';
        return '';
      });
    });
    var orient = form.orient;
    if (orient === 'auto') orient = (nSess > 6 || spec.length > 10) ? 'landscape' : 'portrait';
    return { spec: spec, head: spec.map(function (s) { return s.label; }), body: body, rows: rows, orient: orient, sessions: nSess, footer: form.footer || '' };
  }

  var api = { FIELDS: FIELDS, SENSITIVE: SENSITIVE, matchField: matchField, detectHeader: detectHeader, readRoster: readRoster, checks: checks, sortRows: sortRows, buildTable: buildTable, colName: colName, fillMerges: fillMerges };
  root.APAttend = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
