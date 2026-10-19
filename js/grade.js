/* 채점 엔진. 규칙 문장은 데이터 묶음에만 있고, 여기에는 검사 종류만 있어요.
   단계 순서를 틀리면 0점. 그 외에는 규칙마다 같은 몫의 부분 점수. */
(function (root) {
  'use strict';

  function num(v) {
    if (v === null || v === undefined) return NaN;
    var s = String(v).replace(/[,\s원명]/g, '');
    return s === '' ? NaN : Number(s);
  }
  function won(n) {
    if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
    return Number(n).toLocaleString('ko-KR') + '원';
  }
  function korean(n) {
    n = Math.floor(Number(n));
    if (!n) return '영';
    var D = '영일이삼사오육칠팔구';
    var S = ['천', '백', '십', ''];
    var B = ['', '만', '억', '조'];
    var g = [];
    while (n > 0) { g.push(n % 10000); n = Math.floor(n / 10000); }
    var out = '';
    for (var i = g.length - 1; i >= 0; i--) {
      if (!g[i]) continue;
      var s = String(g[i]).padStart(4, '0');
      var p = '';
      for (var j = 0; j < 4; j++) {
        var d = Number(s[j]);
        if (d) p += D[d] + S[j];
      }
      out += p + B[i];
    }
    return out;
  }
  function normKo(s) { return String(s || '').replace(/\s/g, '').replace(/일(?=[십백천])/g, ''); }
  function amountText(n) { return '금' + Number(n).toLocaleString('ko-KR') + '원(금' + korean(n) + '원)'; }
  function checkAmountText(text, n) {
    var t = String(text || '').replace(/\s/g, '');
    var m = t.match(new RegExp('금' + Number(n).toLocaleString('ko-KR') + '원\\(금([가-힣]+)원\\)'));
    return !!m && normKo(m[1]) === normKo(korean(n));
  }

  function row(check, pass, okMsg, failMsg, extra) {
    extra = extra || {};
    var scored = extra.score !== undefined ? extra.score : check.score !== false;
    return {
      rule: extra.rule || check.rule || '',
      label: extra.label || check.label || extra.rule || check.rule || '',
      pass: scored ? !!pass : null,
      explain: (scored ? (pass ? (okMsg || check.ok || '') : (failMsg || check.fail || '')) : (check.explain || '')),
      basis: check.basis || '',
      zero: !!(extra.zero || check.zero),
      score: !!scored,
      field: extra.field || check.field || ''
    };
  }

  function evalDocs(check, answer) {
    var docs = (answer && answer.docs) || [];
    var types = docs.map(function (d) { return d.type; });
    var match = null;
    (check.variants || []).forEach(function (v) {
      if (match) return;
      if (v.length === types.length && v.every(function (s, i) { return s.type === types[i]; })) match = v;
    });
    if (check.forbid && types.some(function (t) { return check.forbid.indexOf(t) >= 0; })) match = null;
    var out = [];
    out.push(row(check, !!match, check.orderOk, check.orderFail, { zero: !!check.zero, rule: check.rule, label: check.orderLabel || '단계 순서' }));
    if (check.checkDept) {
      var deptOk = !!(match && docs.every(function (d, i) { return d.dept === match[i].dept; }));
      out.push(row(check, deptOk, check.deptOk, check.deptFail, { zero: false, rule: check.deptRule || check.rule, label: check.deptLabel || '처리 부서' }));
    }
    if (check.category) {
      var catOk = docs.length > 0 && docs.every(function (d) { return d.category === check.category; });
      out.push(row(check, catOk, check.catOk, check.catFail, { rule: check.catRule || check.rule, label: check.catLabel || '예산과목' }));
    }
    if (check.amount != null) {
      var amtOk = docs.length > 0 && docs.every(function (d) { return num(d.amount) === Number(check.amount); });
      out.push(row(check, amtOk, check.amtOk, check.amtFail, { rule: check.amtRule || check.rule, label: check.amtLabel || '금액' }));
    }
    if (check.causeBefore) {
      var i = types.indexOf('원인행위');
      var j = types.indexOf('납품');
      var ok = i >= 0 && j >= 0 && i < j;
      out.push(row(check, ok, check.causeOk, check.causeFail, { zero: !!check.causeZero, rule: check.causeRule || check.rule, label: check.causeLabel || '원인행위 시점' }));
    }
    return out;
  }

  function evalOne(check, answer) {
    answer = answer || {};
    if (check.kind === 'docs') return evalDocs(check, answer);
    if (check.kind === 'note') {
      return row(check, true, '', '', { score: false, rule: check.rule, label: check.label || '참고' });
    }
    if (check.kind === 'choice') {
      var v = answer[check.field];
      var exp = check.expect;
      var ok = Array.isArray(exp) ? exp.indexOf(v) >= 0 : v === exp;
      return row(check, ok);
    }
    if (check.kind === 'number') {
      return row(check, num(answer[check.field]) === Number(check.expect));
    }
    if (check.kind === 'order') {
      var got = answer[check.field] || [];
      var want = check.expect || [];
      var same = got.length === want.length && got.every(function (x, i) { return x === want[i]; });
      return row(check, same);
    }
    if (check.kind === 'set') {
      var g = answer[check.field] || [];
      var e = check.expect || [];
      var ignore = check.ignore || [];
      var miss = e.filter(function (x) { return g.indexOf(x) < 0; });
      var extra = g.filter(function (x) { return e.indexOf(x) < 0 && ignore.indexOf(x) < 0; });
      return row(check, miss.length === 0 && extra.length === 0);
    }
    if (check.kind === 'amountText') {
      return row(check, checkAmountText(answer[check.field], check.expect));
    }
    if (check.kind === 'regex') {
      var re = new RegExp(check.pattern, check.flags || '');
      return row(check, re.test(String(answer[check.field] == null ? '' : answer[check.field])));
    }
    if (check.kind === 'notRegex') {
      var re2 = new RegExp(check.pattern, check.flags || '');
      return row(check, !re2.test(String(answer[check.field] == null ? '' : answer[check.field])));
    }
    if (check.kind === 'minLen') {
      return row(check, String(answer[check.field] == null ? '' : answer[check.field]).trim().length >= Number(check.expect));
    }
    if (check.kind === 'countMax') {
      var fields = check.fields || [];
      var skip = check.skip || [];
      var count = {};
      var missing = false;
      fields.forEach(function (f) {
        var val = answer[f];
        if (val == null || val === '' || skip.indexOf(val) >= 0) { missing = true; return; }
        count[val] = (count[val] || 0) + 1;
      });
      var over = Object.keys(count).filter(function (k) { return count[k] > check.max; });
      return row(check, !missing && over.length === 0);
    }
    return row(check, false, '', '알 수 없는 검사');
  }

  function gradeTask(task, answer) {
    var results = [];
    ((task && task.checks) || []).forEach(function (c) {
      var part = evalOne(c, answer);
      if (Array.isArray(part)) results.push.apply(results, part);
      else results.push(part);
    });
    var scored = results.filter(function (r) { return r.score; });
    var passed = scored.filter(function (r) { return r.pass; }).length;
    var orderFail = results.some(function (r) { return r.score && r.zero && !r.pass; });
    var points = !scored.length ? 0 : (orderFail ? 0 : Math.round(passed / scored.length * 100));
    return { points: points, orderFail: orderFail, results: results };
  }

  function filterQuestions(list, f) {
    f = f || {};
    return (list || []).filter(function (q) {
      if (!q) return false;
      if (q.hold || q.상태 === '보류' || q.검증 === '보류') return false;
      if (f.bucket && q.bucket !== f.bucket) return false;
      if (f.type && q.유형 !== f.type) return false;
      if (f.level && q.난이도 !== f.level) return false;
      if (f.work && q.업무id !== f.work) return false;
      return true;
    });
  }

  var api = {
    num: num, won: won, korean: korean, amountText: amountText, checkAmountText: checkAmountText,
    gradeTask: gradeTask, filterQuestions: filterQuestions
  };
  root.APGrade = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
