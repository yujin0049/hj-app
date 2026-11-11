/* 남해캠 공지사항(#/notice) 계산. 화면 없이 목록 거르기·정렬·원문 주소만. node 시험: tests/notice_core.test.js
   자료: data/notices.json(목차: 연도별 파일·부서·건수) + data/notices/YYYY.json(그 해 글, 최신순). 본문 전문 없음(앞부분 짧게만). */
(function (root) {
  'use strict';
  var KIND = {
    ok: '',
    pii: '개인정보 포함·원문 링크만',
    img: '본문 이미지·원문 보기',
    fail: '본문 못 받음·원문 보기'
  };
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function words(q) { return norm(q).split(' ').filter(Boolean); }
  /* 원문 주소: 목차의 article_url + nttId(숫자만). 다른 주소로는 안 감 */
  function url(index, id) {
    var base = (index && index.article_url) || '';
    if (base.indexOf('https://www.namhae.ac.kr/') !== 0 || !/^\d+$/.test(String(id || ''))) return '';
    return base + id;
  }
  function kindLabel(k) { return KIND[k] || ''; }
  /* 최신순: 날짜↓ · 번호↓ · nttId↓ (생성기 정렬과 같음) */
  function cmp(a, b) {
    if (a.d !== b.d) return a.d < b.d ? 1 : -1;
    var na = a.no == null ? -1 : a.no, nb = b.no == null ? -1 : b.no;
    if (na !== nb) return nb - na;
    return (+b.id || 0) - (+a.id || 0);
  }
  function sortRows(rows) { return rows.slice().sort(cmp); }
  function hay(r) {
    if (!r._h) r._h = norm([r.t, r.dept, (r.f || []).join(' '), r.s || '', r.no == null ? '' : r.no].join(' '));
    return r._h;
  }
  /* 거르기: q(낱말 모두 제목·부서·첨부·요약·번호 안에) · y(연도) · dept(부서 같음) */
  function filter(rows, o) {
    o = o || {};
    var ws = words(o.q), y = String(o.y || ''), dept = String(o.dept || '');
    return rows.filter(function (r) {
      if (y && r.d.slice(0, 4) !== y) return false;
      if (dept && r.dept !== dept) return false;
      if (ws.length) { var h = hay(r); for (var i = 0; i < ws.length; i++) if (h.indexOf(ws[i]) < 0) return false; }
      return true;
    });
  }
  /* 지금 조건에 필요한 연도 파일: 연도를 고르면 그 해만, 낱말·부서가 있으면 전부, 아무것도 없으면 최신 해부터 need 건이 찰 때까지 */
  function yearsFor(index, o, need) {
    var ys = ((index && index.years) || []).map(function (x) { return x; });
    o = o || {};
    if (o.y) return ys.filter(function (x) { return x.y === String(o.y); });
    if (norm(o.q) || o.dept) return ys;
    var out = [], n = 0;
    for (var i = 0; i < ys.length && n < (need || 1); i++) { out.push(ys[i]); n += ys[i].n || 0; }
    return out;
  }
  function latest(rows, n) { return sortRows(rows).slice(0, n || 5); }
  var api = { KIND: KIND, url: url, kindLabel: kindLabel, sortRows: sortRows, filter: filter, yearsFor: yearsFor, latest: latest, words: words };
  root.HJNotice = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
