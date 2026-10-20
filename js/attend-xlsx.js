/* 엑셀 양식에 줄 늘리기(ExcelJS). 명단이 양식 줄보다 많을 때 끝 줄을 복사해 늘리고,
   ExcelJS가 따라 옮기지 않는 병합·수식 범위·데이터 유효성·조건부 서식·그림·인쇄 영역을 직접 옮겨요. */
(function (root) {
  'use strict';
  var REF = /('[^']*'!|[A-Za-z0-9_]+!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?::(\$?)([A-Z]{1,3})(\$?)(\d+))?/g;

  /* 수식 안 칸 주소 옮기기. mode 'grow': last 아래 칸은 +extra, last에서 끝나는 범위는 끝을 +extra.
     mode 'row': 끝 줄(last)을 가리키는 상대 주소를 새 줄(to)로(복사된 줄의 수식). */
  function shiftFormula(f, last, extra, mode, to) {
    return String(f).replace(REF, function (m, sh, d1, c1, rd1, r1, d2, c2, rd2, r2) {
      sh = sh || '';
      r1 = Number(r1);
      if (c2) {
        r2 = Number(r2);
        if (mode === 'row') {
          if (!rd1 && r1 === last) r1 = to;
          if (!rd2 && r2 === last) r2 = to;
        } else if (r1 > last) { r1 += extra; r2 += extra; }
        else if (r2 >= last) r2 += extra;
        return sh + d1 + c1 + rd1 + r1 + ':' + d2 + c2 + rd2 + r2;
      }
      if (mode === 'row') { if (!rd1 && r1 === last) r1 = to; }
      else if (r1 > last) r1 += extra;
      return sh + d1 + c1 + rd1 + r1;
    });
  }
  function parseRange(a) {
    var p = String(a).replace(/\$/g, '').match(/^([A-Z]{1,3})(\d+)(?::([A-Z]{1,3})(\d+))?$/);
    return p ? { c1: p[1], r1: +p[2], c2: p[3] || p[1], r2: +(p[4] || p[2]) } : null;
  }
  function growRange(a, last, extra) {
    var r = parseRange(a);
    if (!r) return a;
    if (r.r1 > last) { r.r1 += extra; r.r2 += extra; }
    else if (r.r2 >= last) r.r2 += extra;
    return r.c1 + r.r1 + (r.c1 === r.c2 && r.r1 === r.r2 ? '' : ':' + r.c2 + r.r2);
  }
  function formulaOf(v) { return v && typeof v === 'object' && (v.formula || v.sharedFormula) ? v : null; }

  function growRows(ws, first, last, extra) {
    if (!extra) return;
    /* 병합 */
    var rowPat = [], below = [];
    (ws.model.merges || []).slice().forEach(function (m) {
      var r = parseRange(m);
      if (!r) return;
      if (r.r1 <= last && r.r2 > last) throw new Error('양식의 병합 칸 ' + m + '이 명단 끝 줄(' + last + '행)에 걸쳐 있어요. 양식을 고쳐 주세요.');
      if (r.r1 === last && r.r2 === last) rowPat.push([r.c1, r.c2]);
      if (r.r1 > last) { below.push(r); ws.unMergeCells(m); }
    });
    /* 그림(아래쪽 로고·직인) */
    var imgs = (ws.getImages ? ws.getImages() : []).filter(function (im) { return im.range && im.range.tl && im.range.tl.nativeRow >= last; });
    /* 데이터 유효성 */
    var dvOld = (ws.dataValidations && ws.dataValidations.model) || {}, dvNew = {};
    Object.keys(dvOld).forEach(function (k) {
      var key = k.replace(/^range:/, ''), pre = k.indexOf('range:') === 0 ? 'range:' : '';
      var r = parseRange(key);
      if (!r) { dvNew[k] = dvOld[k]; return; }
      if (r.r1 === last && r.r2 === last) {   // 끝 줄 칸(하나씩 저장된 것)은 새 줄마다 복사
        dvNew[k] = dvOld[k];
        for (var i = 1; i <= extra; i++) dvNew[pre + (r.c1 === r.c2 ? r.c1 + (last + i) : r.c1 + (last + i) + ':' + r.c2 + (last + i))] = dvOld[k];
      } else dvNew[pre + growRange(key, last, extra)] = dvOld[k];
    });
    /* 조건부 서식 */
    (ws.conditionalFormattings || []).forEach(function (cf) {
      cf.ref = String(cf.ref).split(/\s+/).map(function (a) { return growRange(a, last, extra); }).join(' ');
    });

    ws.duplicateRow(last, extra, true);

    below.forEach(function (r) { ws.mergeCells(r.c1 + (r.r1 + extra) + ':' + r.c2 + (r.r2 + extra)); });
    for (var k = 1; k <= extra; k++) rowPat.forEach(function (p) { ws.mergeCells(p[0] + (last + k) + ':' + p[1] + (last + k)); });
    imgs.forEach(function (im) { im.range.tl.nativeRow += extra; if (im.range.br) im.range.br.nativeRow += extra; });
    if (ws.dataValidations) ws.dataValidations.model = dvNew;
    /* 수식: 새 줄은 끝 줄 수식을 자기 줄로, 나머지(위·아래)는 범위를 늘리거나 내려요 */
    ws.eachRow({ includeEmpty: false }, function (row, rn) {
      row.eachCell({ includeEmpty: false }, function (cell) {
        var v = formulaOf(cell.value);
        if (!v || !v.formula) return;
        var nf = rn > last && rn <= last + extra ? shiftFormula(v.formula, last, 0, 'row', rn) : (rn >= first && rn <= last ? v.formula : shiftFormula(v.formula, last, extra, 'grow'));
        if (nf !== v.formula) cell.value = { formula: nf };
      });
    });
    var pa = ws.pageSetup && ws.pageSetup.printArea;
    if (pa) ws.pageSetup.printArea = pa.replace(/(\$?[A-Z]+\$?)(\d+)$/, function (m, col, row) { return col + (Number(row) > last ? Number(row) + extra : row); });
  }

  var api = { growRows: growRows, shiftFormula: shiftFormula, growRange: growRange, formulaOf: formulaOf };
  root.APAttendXlsx = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
