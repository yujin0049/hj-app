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
  /* 화면에도 엑셀에도 절대 안 나오는 칸(칸 이름 기준). 조금 넓게 막아요(hotel 같은 말도 걸려도 괜찮아요). */
  var SENSITIVE = /생년|생일|출생|birth|dob|나이|연령|이메일|e-?mail|메일|전화|휴대|핸드폰|연락처|^h\.?p\.?$|mobile|cell|contact|phone|tel|카톡|kakao|비상|긴급|보호자|학부모|부모|주민|외국인등록|여권|passport|신분증|계좌|은행|bank|account|예금주|주소|address|우편|zip|자택|거주|건강|질병|병력|알레르기|장애|혈액|복용|특이사항/i;
  /* 다른 사람 이름·다른 전공이라 성명·소속으로 읽으면 안 되는 칸 */
  var NOT_FIELD = { name: /보호자|학부모|부모|지도교수|교수|강사|담당자|확인자|작성자/, dept: /부전공|복수전공|연계전공/ };
  /* 값으로 찾는 개인정보(칸 이름이 없거나 이상할 때) */
  var VALUE_PAT = [
    /^(\+?82[-.\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}$/,      // 휴대폰
    /^0\d{1,2}[-.\s)]\d{3,4}[-.\s]\d{4}$/,                          // 일반 전화
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,                                   // 이메일
    /^\d{6}[-\s]?[1-8]\d{6}$/                                       // 주민·외국인등록번호
  ];
  var BIRTH_PAT = /^(19|20)\d{2}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}\.?$/;  // 생년월일(칸 이름이 없을 때만)

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }
  function text(v) { return String(v == null ? '' : v).replace(/\r/g, '').trim(); }

  /* 칸 이름 → { field, score }. 정확히 같으면 100, 포함이면 동의어 길이. */
  function scoreField(h) {
    var n = norm(h);
    if (!n) return null;
    if (SENSITIVE.test(n)) return { field: 'sensitive', score: 1000 };
    var best = null, bestScore = 0;
    FIELDS.forEach(function (f) {
      if (NOT_FIELD[f.id] && NOT_FIELD[f.id].test(n)) return;
      f.syn.forEach(function (s) {
        var sc = n === s ? 100 : ((s.length >= 2 && n.indexOf(s) >= 0 && n.length <= s.length + 4) ? s.length : 0);
        if (sc > bestScore) { best = f.id; bestScore = sc; }
      });
    });
    return best ? { field: best, score: bestScore } : null;
  }
  function matchField(h) { var r = scoreField(h); return r ? r.field : null; }

  /* 값 5개 중 절반 넘게 개인정보 모양이면 민감 칸 */
  function valueSensitive(samples, labelEmpty) {
    var vals = samples.filter(Boolean);
    if (!vals.length) return false;
    var hit = vals.filter(function (v) {
      v = String(v).trim();
      return VALUE_PAT.some(function (re) { return re.test(v); }) || (labelEmpty && BIRTH_PAT.test(v));
    }).length;
    return hit * 2 > vals.length;
  }

  /* 병합 칸: 제목 줄(headerEnd까지)은 가로·세로 모두, 명단 칸은 세로로만 채워요(학과처럼 여러 줄 묶인 칸).
     명단 아래 '합계'(A:C 병합)가 성명 칸으로 번지지 않게 가로 채우기는 제목 줄까지만 해요. */
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
    function copy() { return aoaIn.map(function (r) { return (r || []).slice(); }); }
    if (hdr == null || hdr < 0) hdr = detectHeader(fillMerges(copy(), merges, 9));   // 찾을 때만 위 10줄 가로 채우기
    var found = hdr >= 0;
    var hEnd = found ? hdr : -1;
    if (found) (merges || []).forEach(function (m) { if (m.s.r === hdr && m.e.r > hEnd && m.e.r - hdr <= 2) hEnd = m.e.r; });
    var aoa = fillMerges(copy(), merges, hEnd);
    var width = 0;
    aoa.forEach(function (r) { if (r && r.length > width) width = r.length; });
    var head = found ? (aoa[hdr] || []) : [];
    var dataRows = aoa.slice(hEnd + 1).filter(function (r) { return r && r.some(function (x) { return text(x) !== ''; }); });
    /* 1) 열마다 이름·점수·민감 여부 */
    var cand = [];
    for (var c = 0; c < width; c++) {
      var label = text(head[c]);
      if (found) for (var k = hdr + 1; k <= hEnd; k++) { var sub = text((aoa[k] || [])[c]); if (sub && sub !== label) label = label ? label + ' ' + sub : sub; }
      var hasData = dataRows.some(function (r) { return text(r[c]) !== ''; });
      if (!label && !hasData) continue;
      var sf = found ? scoreField(label) : null;
      var sens = !!(sf && sf.field === 'sensitive');
      if (!found) for (var t = 0; t < Math.min(aoa.length, 10) && !sens; t++) { var top = norm((aoa[t] || [])[c]); if (top && SENSITIVE.test(top)) sens = true; }
      var sample = dataRows.slice(0, 5).map(function (r) { return text(r[c]); });
      if (!sens && valueSensitive(sample, !label)) sens = true;
      cand.push({ idx: c, label: label, sf: sens ? null : sf, sens: sens, sample: sample });
    }
    /* 2) 필드마다 점수가 가장 높은 열(같으면 왼쪽). 손으로 고친 칸이 먼저. */
    var used = {};
    Object.keys(override).forEach(function (k) { if (override[k]) used[override[k]] = Number(k); });
    var best = {};
    cand.forEach(function (x) {
      if (x.sens || !x.sf || Object.prototype.hasOwnProperty.call(override, x.idx)) return;
      var f = x.sf.field;
      if (used[f] != null) return;
      if (!best[f] || x.sf.score > best[f].score) best[f] = { idx: x.idx, score: x.sf.score };
    });
    Object.keys(best).forEach(function (f) { used[f] = best[f].idx; });
    var cols = cand.map(function (x) {
      var f = null;
      if (!x.sens) {
        if (Object.prototype.hasOwnProperty.call(override, x.idx)) f = override[x.idx] || null;
        else if (x.sf && used[x.sf.field] === x.idx) f = x.sf.field;
      }
      var col = { idx: x.idx, label: x.label || ('열 ' + colName(x.idx)), field: f, sensitive: x.sens };
      if (!x.sens) col.sample = x.sample;
      return col;
    });
    var nameCol = used.name != null ? used.name : -1;
    var rows = [], skipped = { blank: 0, header: 0, total: 0 };
    var TOTAL = /^(합계|소계|총계|총원|계|출석인원|인원|총인원|합)$/;
    for (var r = hEnd + 1; r < aoa.length; r++) {
      var row = aoa[r] || [];
      var vals = cols.filter(function (cl) { return !cl.sensitive; }).map(function (cl) { return text(row[cl.idx]); });
      if (!vals.some(Boolean)) { skipped.blank += 1; continue; }
      var nm = nameCol >= 0 ? text(row[nameCol]) : '';
      if (nameCol >= 0 && found && norm(nm) === norm(head[nameCol])) { skipped.header += 1; continue; }
      if (TOTAL.test(norm(nm)) || (!nm && vals.some(function (v) { return /^(합계|소계|총계|총원|계|출석인원|인원)/.test(norm(v)); }))) { skipped.total += 1; continue; }
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
    var fixed = form.tpl && form.tpl.sess;   // 양식 파일이 있는 서식은 칸 수·이름을 엑셀 양식과 똑같이
    var nSess = !form.sessions ? 0 : fixed ? fixed.count : (dates.length || Math.max(1, Math.min(40, opt.sessions || form.sessions.count)));
    var sessLabel = fixed && fixed.label ? fixed.label : form.sessions && form.sessions.label;
    var spec = [];
    form.cols.forEach(function (c) {
      if (c.kind === 'picked') picked.forEach(function (p) { spec.push({ label: p.label, src: 'col', idx: p.idx, field: p.field }); });
      else if (c.kind === 'sessions') for (var i = 0; i < nSess; i++) spec.push({ label: sessLabel(i, dates[i] || ''), src: 'blank', session: true });
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
    return { spec: spec, head: spec.map(function (s) { return s.label; }), body: body, rows: rows, orient: orient, sessions: nSess, footer: form.footer || '', droppedDates: Math.max(0, dates.length - nSess) };
  }

  var api = { FIELDS: FIELDS, SENSITIVE: SENSITIVE, matchField: matchField, scoreField: scoreField, valueSensitive: valueSensitive, detectHeader: detectHeader, readRoster: readRoster, checks: checks, sortRows: sortRows, buildTable: buildTable, colName: colName, fillMerges: fillMerges };
  root.APAttend = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
