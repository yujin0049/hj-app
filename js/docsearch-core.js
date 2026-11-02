/* 문서대장 찾기 계산 (#/docsearch). 화면 없이 숫자·목록만 계산해요. node 시험: tests/docsearch_core.test.js
   - 키워드 검색: 제목 낱말(모두 들어 있어야 맞음)·상대 부서·문서번호·기간
   - 질문 검색(키 없이 도는 검색): AI 모델·유료 키를 쓰지 않아요. 질문을 낱말로 자르고(조사 떼기) → 같은 뜻 낱말로 넓히고 →
     제목·분류·상대 부서에 맞은 만큼 점수를 매겨 가까운 문서와 근거 문서번호를 돌려줘요. 「N월」「받은/보낸」도 읽어요. */
(function (root) {
  'use strict';
  // 같은 뜻 낱말 묶음. 한 묶음 안 낱말은 서로 넓혀 찾아요(원래 낱말 1점, 넓힌 낱말 0.6점).
  var SYN = [
    ['강사료', '강의료', '시수', '초과강사료', '특강', '수당', '기타소득'],
    ['출장', '여비', '출장신청서', '출장결과보고', '출장결과보고서', '견학'],
    ['계약', '입찰', '낙찰', '감리', '착수계', '도급', '준공', '검수', '공사'],
    ['원인행위', '지출결의', '지출품의', '지출의뢰', '지급', '집행', '보탬e'],
    ['예산', '사업비', '배정', '이용', '전용'],
    ['연구실', '연구실안전', '안전교육', '건강검진', '정밀안전진단', '안전'],
    ['기숙사', '생활관', '학생생활관', '입사', 'OJNT', '관생'],
    ['글로컬', 'DNA+', '글로컬대학', '글로컬대학사업'],
    ['수요조사', '수요', '조사', '신청'],
    ['교육원', '경남항공교육원', '항공기술교육원', '전문교육기관', '훈련운영기준', '교육규정', 'ATO'],
    ['국토부', '국토교통부', '항공안전정책과'],
    ['과정평가형', '산업인력공단', '외부평가', '공단', '자격'],
    ['표준화', '훈련운영기준', '교육규정'],
    ['캠프', '역량강화', '구술', '모의평가', '모의테스트', '힐링'],
    ['장학', '장학생', '근로장학생', '국가근로'],
    ['휴보강', '휴강', '보강', '결강'],
    ['인사', '인사발령', '임용', '복직', '보직'],
    ['입시', '수시', '면접', '전형', '입학'],
    ['태양광', '옥상방수', '실습동', '항공정비실습동'],
    ['현수막', '홍보'],
    ['RISE', '앵커', '리빙랩'],
    ['개인정보', '정보공개', '보안', '사이버'],
    ['교관', '실기시험관', '교육평가'],
    ['기자재', '재료', '물품', '실습재료'],
    ['졸업', '졸업생', '졸업앨범'],
    ['취업', '현장실습', '채용']
  ];
  var STOP = ['문서', '공문', '관련', '관련된', '대한', '대해', '어떤', '어느', '무슨', '뭐', '뭐야', '무엇', '언제', '어디', '어디서', '누가', '있어', '있나', '있었어', '있는', '있었나',
    '알려줘', '알려', '찾아줘', '찾아', '보여줘', '보여', '했어', '했나', '했는지', '하나', '해야', '해', '좀', '것', '거', '건', '내용', '목록', '정리', '우리', '학과', '혹시', '그', '이', '저',
    '받은', '받았어', '온', '왔어', '보낸', '보냈어', '보냈나', '제출한', '제출했어', '나온', '처리', '처리한', '필요', '필요해', '하는', '해서', '하고', '최근', '요즘'];
  var JOSA = /(으로부터|에서부터|이라도|에게서|으로서|으로써|까지|부터|에서|에게|한테|으로|이랑|하고|이나|처럼|보다|에는|에도|라는|이라|은|는|이|가|을|를|에|의|로|와|과|도|만|요)$/;

  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function squash(s) { return norm(s).replace(/[\s·「」『』()\[\]<>“”"'‘’.,:;!?~-]/g, ''); }
  function shortNo(no) { return String(no || '').replace(/^항공해양방산학부/, ''); }
  function numOf(no) { var m = /-(\d+)$/.exec(String(no || '')); return m ? +m[1] : NaN; }
  function kindOf(k) {
    k = String(k || '');
    if (/접수|수신/.test(k)) return '수신';
    if (/발신/.test(k)) return '발신';
    if (/보고/.test(k)) return '보고';
    return '내부결재';
  }
  function deptShort(to) {
    var s = String(to || '').split('/').pop().replace(/^남해캠퍼스/, '').replace(/\s*(귀하|장님|장)$/, '').trim();
    if (s === '대학행정지원과') s = '행정지원과';
    return s || String(to || '');
  }

  /* docreg.json(공개 행) + docsearch.json extra 행 → 한 목록(날짜 최신 먼저) */
  function buildRows(docreg, extra) {
    var catName = {}, subName = {};
    ((docreg && docreg.cats) || []).forEach(function (c) {
      catName[c.id] = c.name;
      (c.subs || []).forEach(function (s) { subName[s.id] = s.name; });
    });
    var rows = [];
    ((docreg && docreg.docs) || []).forEach(function (d) {
      rows.push({ no: d.no, short: shortNo(d.no), t: d.t || '', d: d.d || '', kind: kindOf(d.kind), to: d.to || '',
        cat: [catName[d.cat] || '', subName[d.sub] || ''].filter(Boolean).join(' › ') });
    });
    var ex = (extra && extra.rows) || [];
    ex.forEach(function (e) {
      rows.push({ no: e[0], short: shortNo(e[0]), t: e[1] || '', d: e[2] || '', kind: kindOf(e[3]), to: e[4] || '', cat: e[5] || '' });
    });
    rows.forEach(function (r) { r.n = numOf(r.no); r.dept = deptShort(r.to); r._t = squash(r.t); r._c = squash(r.cat); r._o = squash(r.to); });
    rows.sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : b.n - a.n; });
    return rows;
  }

  /* 상대 부서 고르기 목록: 많이 나온 순 */
  function deptOptions(rows, max) {
    var c = {};
    rows.forEach(function (r) { if (r.dept && r.dept !== '내부결재') c[r.dept] = (c[r.dept] || 0) + 1; });
    return Object.keys(c).map(function (k) { return { dept: k, n: c[k] }; })
      .sort(function (a, b) { return b.n - a.n || (a.dept < b.dept ? -1 : 1); }).slice(0, max || 40);
  }

  /* 키워드 검색. f = { q, dept, no, from, to, kind } — 비어 있는 칸은 안 거름 */
  function filter(rows, f) {
    f = f || {};
    var words = norm(f.q).split(' ').filter(Boolean).map(squash).filter(Boolean);
    var dept = squash(f.dept), no = String(f.no || '').replace(/\s+/g, '');
    var noDigits = /^\d+$/.test(no) ? +no : null;
    return rows.filter(function (r) {
      for (var i = 0; i < words.length; i++) if (r._t.indexOf(words[i]) < 0 && r._c.indexOf(words[i]) < 0) return false;
      if (dept && r._o.indexOf(dept) < 0 && squash(r.dept).indexOf(dept) < 0) return false;
      if (no) {
        if (noDigits !== null) { if (r.n !== noDigits) return false; }
        else if (squash(r.no).indexOf(squash(no)) < 0) return false;
      }
      if (f.from && r.d < f.from) return false;
      if (f.to && r.d > f.to) return false;
      if (f.kind && r.kind !== f.kind) return false;
      return true;
    });
  }

  /* 질문 → 낱말 (조사 떼기·멈춤말 빼기) */
  function terms(question) {
    var raw = String(question || '').replace(/\d{1,2}\s*월/g, ' ').split(/[\s,.?!·「」『』()\[\]"'“”‘’~/]+/).filter(Boolean);
    var out = [];
    raw.forEach(function (w) {
      var t = w;
      for (var k = 0; k < 2 && t.length > 2 && JOSA.test(t); k++) t = t.replace(JOSA, '');
      if (t.length > 1 && JOSA.test(t) && STOP.indexOf(t.replace(JOSA, '')) >= 0) t = t.replace(JOSA, '');
      if (!t || STOP.indexOf(t) >= 0 || STOP.indexOf(w) >= 0) return;
      if (t.length < 2 && !/^[a-z0-9]$/i.test(t)) return;
      if (out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }
  /* 낱말 → 넓힌 낱말 [{w, weight, from}] */
  function expand(ts) {
    var out = [], seen = {};
    function add(w, weight, from) {
      var k = squash(w);
      if (!k || (seen[k] && seen[k].weight >= weight)) return;
      if (seen[k]) { seen[k].weight = weight; seen[k].from = from; return; }
      seen[k] = { w: w, k: k, weight: weight, from: from };
      out.push(seen[k]);
    }
    ts.forEach(function (t) { add(t, 1, t); });
    ts.forEach(function (t) {
      var tk = squash(t);
      SYN.forEach(function (g) {
        var hit = g.some(function (x) { var xk = squash(x); return xk === tk || (tk.length >= 2 && xk.indexOf(tk) === 0) || (xk.length >= 2 && tk.indexOf(xk) === 0); });
        if (hit) g.forEach(function (x) { add(x, 0.6, t); });
      });
    });
    return out;
  }
  function intent(question) {
    var q = String(question || '');
    var months = [];
    var re = /(\d{1,2})\s*월/g, m;
    while ((m = re.exec(q))) { var n = +m[1]; if (n >= 1 && n <= 12 && months.indexOf(n) < 0) months.push(n); }
    var kind = /(받은|받았|수신|접수|온 |왔)/.test(q) ? '수신' : (/(보낸|보냈|발신|제출한|제출했)/.test(q) ? '발신' : '');
    return { months: months, kind: kind };
  }
  function bigrams(s) { var o = []; for (var i = 0; i < s.length - 1; i++) o.push(s.slice(i, i + 2)); return o; }

  /* 질문 검색. 돌려주는 것: { terms, expanded, intent, hits:[{r, score, matched}], total, summary } */
  function ask(rows, question, opt) {
    opt = opt || {};
    var ts = terms(question), ex = expand(ts), it = intent(question);
    var hits = [];
    if (!ex.length && !it.months.length) return { terms: ts, expanded: ex, intent: it, hits: [], total: 0, summary: null };
    rows.forEach(function (r) {
      var score = 0, matched = [], primary = 0;
      ex.forEach(function (e) {
        var s = 0;
        if (r._t.indexOf(e.k) >= 0) s = 1;
        else if (r._c.indexOf(e.k) >= 0) s = 0.45;
        else if (r._o.indexOf(e.k) >= 0) s = 0.5;
        else if (e.weight === 1 && e.k.length >= 3) {
          var bg = bigrams(e.k), got = bg.filter(function (b) { return r._t.indexOf(b) >= 0; }).length;
          if (got / bg.length >= 0.67) s = 0.35 * got / bg.length;
        }
        if (s) {
          score += s * e.weight * (1 + Math.min(e.k.length, 6) / 12);
          if (matched.indexOf(e.w) < 0) matched.push(e.w);
          if (e.weight === 1 && s >= 0.45) primary++;
        }
      });
      if (!ex.length) score = 1;
      if (ex.length && !score) return;
      if (ts.length > 1) score *= 1 + 0.35 * Math.max(0, primary - 1);
      if (it.months.length) {
        var mo = +String(r.d).slice(5, 7);
        score *= it.months.indexOf(mo) >= 0 ? 1.6 : 0.25;
      }
      if (it.kind) score *= r.kind === it.kind ? 1.25 : 0.8;
      score += (r.d ? (+r.d.slice(5, 7)) : 0) / 1000; // 같은 점수면 최근 것 먼저
      hits.push({ r: r, score: score, matched: matched });
    });
    hits.sort(function (a, b) { return b.score - a.score || (a.r.d < b.r.d ? 1 : -1); });
    var top = hits.length ? hits[0].score : 0;
    var keep = hits.filter(function (h) { return h.score >= top * 0.35; });
    var limit = opt.limit || 12;
    var shown = keep.slice(0, limit);
    return { terms: ts, expanded: ex, intent: it, hits: shown, total: keep.length, summary: summarize(keep) };
  }
  function summarize(hits) {
    if (!hits.length) return null;
    var cat = {}, dept = {}, dmin = '9999', dmax = '0000';
    hits.forEach(function (h) {
      var c = h.r.cat.split(' › ')[0] || '분류 없음'; cat[c] = (cat[c] || 0) + 1;
      if (h.r.dept && h.r.dept !== '내부결재') dept[h.r.dept] = (dept[h.r.dept] || 0) + 1;
      if (h.r.d < dmin) dmin = h.r.d; if (h.r.d > dmax) dmax = h.r.d;
    });
    function top(o, n) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n); }
    return { n: hits.length, from: dmin, to: dmax, cats: top(cat, 3), depts: top(dept, 3), evidence: hits.slice(0, 5).map(function (h) { return h.r.short; }) };
  }

  /* 부족 부서: status 가 「대장 없음」·「부족」인 줄 */
  function gaps(reg) {
    return ((reg && reg.rows) || []).filter(function (r) { return r.status === '대장 없음' || r.status === '부족'; });
  }
  function md(iso) { if (!iso) return '-'; var p = iso.split('-'); return (+p[1]) + '.' + (+p[2]) + '.'; }

  var api = { SYN: SYN, norm: norm, squash: squash, shortNo: shortNo, kindOf: kindOf, deptShort: deptShort, buildRows: buildRows,
    deptOptions: deptOptions, filter: filter, terms: terms, expand: expand, intent: intent, ask: ask, gaps: gaps, md: md };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HJDocSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
