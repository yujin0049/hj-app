/* 숫자 신선도: built_at 기준 「읽은 시각 / 오늘 사용 가능」. 없으면 「데이터 없음」.
   브라우저·node 같이 씀. 하루(한국 날짜)가 지나면 오늘 사용 불가. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HJFresh = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var NODATA = '데이터 없음';
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayKST(nowMs) {
    var d = new Date((nowMs == null ? Date.now() : nowMs) + 9 * 3600000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  /* 자료 객체의 읽은 시각. built_at 만 쓴다. 다른 칸으로 지어내지 않음. */
  function builtAtOf(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var v = obj.built_at;
    if (v == null || v === '') return null;
    return String(v);
  }
  /* '2026-11-11 10:02', '2026-11-11T10:02+09:00', '2026-11-11' → 한국 날짜 */
  function dateKST(raw) {
    var s = String(raw || '').trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    if (m[4] == null) return m[1] + '-' + m[2] + '-' + m[3];
    var hasOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
    if (hasOffset) {
      var t = Date.parse(s);
      if (isNaN(t)) return m[1] + '-' + m[2] + '-' + m[3];
      return todayKST(t);
    }
    /* 오프셋 없으면 한국 시각으로 읽음 */
    return m[1] + '-' + m[2] + '-' + m[3];
  }
  function formatRead(raw) {
    var s = String(raw || '').trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return s;
    var t = m[1] + '-' + m[2] + '-' + m[3];
    if (m[4] != null) t += ' ' + m[4] + ':' + m[5];
    return t + ' (KST)';
  }
  function freshness(obj, nowMs) {
    var raw = builtAtOf(obj);
    if (!raw) {
      return { missing: true, usableToday: false, readAt: '', date: '', text: NODATA };
    }
    var d = dateKST(raw);
    if (!d) {
      return { missing: true, usableToday: false, readAt: '', date: '', text: NODATA };
    }
    var usable = d === todayKST(nowMs);
    var read = formatRead(raw);
    return {
      missing: false,
      usableToday: usable,
      readAt: read,
      date: d,
      text: '읽은 시각 ' + read + ' / ' + (usable ? '오늘 사용 가능' : '오늘 사용 불가')
    };
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function lineHtml(obj, nowMs, escapeFn) {
    var f = freshness(obj, nowMs);
    var e = escapeFn || esc;
    var cls = 'fresh-line' + (f.missing ? ' fresh-none' : (f.usableToday ? ' fresh-ok' : ' fresh-no'));
    return '<p class="' + cls + '" id="fresh-line">' + e(f.text) + '</p>';
  }
  return {
    NODATA: NODATA,
    todayKST: todayKST,
    builtAtOf: builtAtOf,
    dateKST: dateKST,
    formatRead: formatRead,
    freshness: freshness,
    lineHtml: lineHtml
  };
});
