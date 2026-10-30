/* 표 규칙(그리드솔루션 개발자 피드백, 261031). 화면 모양만 바꿔요. 자료·계산은 건드리지 않음.
   1) 칸 정렬: 숫자=오른쪽(g-num), 긴 문장(4단어 이상)=왼쪽(g-long), 짧은 낱말=가운데(g-short). 머리칸도 같은 줄맞춤.
   2) 표 위 툴바 한 줄(찾기·정렬·개수): [data-grid-for="표 id"]. 찾기·정렬은 보이는 줄만 숨기거나 순서만 바꿔요(자료 그대로).
   3) 한 줄 = 한 행: 넘치면 …(CSS) + title 말풍선(여기서 칸 글자 그대로 넣음). */
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  var NUM = /^[+\-−±]?[\d][\d,.]*\s*(%|원|건|개|명|일|칸|대|회|점|시간|분|쪽|장|권|만원|천원)?$/;
  var KEEP = {}; /* 툴바 입력값을 다시 그릴 때도 이어가요: { 표id: {q, sort, adv} } — 메모리만 */
  function txt(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function words(s) { return s ? s.split(' ').length : 0; }
  function kind(texts) {
    var t = texts.filter(function (s) { return s && s !== '-' && s !== '—'; });
    if (!t.length) return 'g-short';
    if (t.every(function (s) { return NUM.test(s) || /^\d+\s*\/\s*\d+/.test(s); })) return 'g-num';
    var avg = t.reduce(function (a, s) { return a + words(s); }, 0) / t.length;
    var long = t.filter(function (s) { return words(s) >= 4 || s.length >= 18; }).length;
    return (avg >= 3 || long * 2 >= t.length) ? 'g-long' : 'g-short';
  }
  function rowsOf(tb) { return Array.prototype.filter.call(tb.rows, function (r) { return !r.querySelector('td[colspan], th[colspan]'); }); }
  function decorate(tb) {
    if (tb.getAttribute('data-grid') === 'done') return;
    tb.setAttribute('data-grid', 'done');
    tb.classList.add('hj-grid');
    var rows = rowsOf(tb), cols = {};
    var body = rows.filter(function (r) { return !r.parentNode || r.parentNode.tagName !== 'THEAD'; });
    var dataRows = body.filter(function (r) { return r.querySelector('td'); });
    dataRows.forEach(function (r) {
      Array.prototype.forEach.call(r.cells, function (c, i) { (cols[i] = cols[i] || []).push(txt(c)); });
    });
    var kinds = {};
    Object.keys(cols).forEach(function (i) { kinds[i] = kind(cols[i]); });
    Array.prototype.forEach.call(tb.querySelectorAll('td, th'), function (c) {
      var t = txt(c);
      if (t && !c.hasAttribute('title') && !c.querySelector('[title]')) c.setAttribute('title', t);
      if (c.colSpan > 1) return;
      var k = kinds[c.cellIndex];
      if (k && !/\bg-(num|long|short)\b/.test(c.className)) c.classList.add(k);
    });
    if (tb.classList.contains('plain')) fit(tb, kinds, cols);
    if (tb.id) toolbar(tb);
  }
  /* 고정 칸 너비(table.plain): 숫자·짧은 칸은 글자 수만큼, 긴 칸이 나머지. 넘치면 … */
  function em(s) { var w = 0; for (var i = 0; i < s.length; i++) w += /[\u1100-\uffff]/.test(s[i]) ? 1 : 0.58; return w; }
  function fit(tb, kinds, cols) {
    var head = tb.rows[0]; if (!head) return;
    var anyLong = Object.keys(kinds).some(function (i) { return kinds[i] === 'g-long'; });
    if (!anyLong) return;
    Array.prototype.forEach.call(head.cells, function (c, i) {
      if (kinds[i] === 'g-long') return;
      var m = em(txt(c)); (cols[i] || []).forEach(function (t) { m = Math.max(m, em(t)); });
      c.style.width = Math.min(9, Math.max(2.5, m + 1.2)).toFixed(1) + 'em';
    });
  }
  /* 툴바: 찾기(보이는 줄만 숨김)·정렬(줄 순서만)·개수. 상세검색은 <details> 안(각 화면 마크업). */
  function toolbar(tb) {
    var bar = document.querySelector('[data-grid-for="' + tb.id + '"]');
    if (!bar) return;
    var k = KEEP[tb.id] = KEEP[tb.id] || { q: '', sort: '', adv: false };
    var q = bar.querySelector('[data-grid-find]'), so = bar.querySelector('[data-grid-sort]'), cnt = bar.querySelector('[data-grid-count]'), adv = bar.querySelector('details');
    var tbody = tb.tBodies[0]; if (!tbody) return;
    var base = Array.prototype.slice.call(tbody.rows);
    if (so && !so.options.length) {
      so.innerHTML = '<option value="">정렬</option>' + Array.prototype.map.call(tb.tHead ? tb.tHead.rows[0].cells : [], function (h, i) {
        return '<option value="' + i + '">' + txt(h).replace(/[<>&"]/g, '') + ' 순</option>';
      }).join('');
    }
    function apply() {
      var needle = (q ? q.value : '').trim().toLowerCase(), n = 0;
      var list = base.slice();
      if (so && so.value !== '') {
        var i = +so.value, isNum = tb.tHead && tb.tHead.rows[0].cells[i] && tb.tHead.rows[0].cells[i].classList.contains('g-num');
        list.sort(function (a, b) {
          var x = a.cells[i] ? txt(a.cells[i]) : '', y = b.cells[i] ? txt(b.cells[i]) : '';
          if (isNum) return (parseFloat(x.replace(/,/g, '')) || 0) - (parseFloat(y.replace(/,/g, '')) || 0);
          return x.localeCompare(y, 'ko', { numeric: true });
        });
      }
      list.forEach(function (r) {
        var hit = !needle || txt(r).toLowerCase().indexOf(needle) >= 0;
        r.hidden = !hit; if (hit) n++;
        tbody.appendChild(r);
      });
      if (cnt) cnt.textContent = (needle ? n + ' / ' : '') + base.length + '개';
      k.q = q ? q.value : ''; k.sort = so ? so.value : '';
    }
    if (q) { q.value = k.q; q.oninput = apply; }
    if (so) { so.value = k.sort; so.onchange = apply; }
    if (adv) { if (k.adv || adv.querySelector('select option:checked:not([value=""]), input:checked')) adv.open = true; adv.ontoggle = function () { k.adv = adv.open; }; }
    apply();
  }
  function scan(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll) return;
    Array.prototype.forEach.call(rootEl.querySelectorAll('table'), decorate);
    /* 표 모양 카드(협조 결과) 줄: 넘치면 … + 말풍선 */
    Array.prototype.forEach.call(rootEl.querySelectorAll('.cp-grid > *, [data-grid-line]'), function (c) {
      if (!c.hasAttribute('title')) { var t = txt(c); if (t) c.setAttribute('title', t); }
    });
  }
  root.HJGrid = { decorate: decorate, scan: scan, kind: kind };
  function start() {
    var v = document.getElementById('view') || document.body;
    scan(v);
    if (typeof MutationObserver !== 'undefined') new MutationObserver(function () { scan(v); }).observe(v, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
