/* 숫자 신선도: source_at 기준 「오늘 사용 가능」 / 「N일 전 자료」.
   브라우저·node 같이 씀. 원자료 시각이 오늘(한국 날짜)이면 오늘 사용 가능.
   현황은 원자료·변환을 같이, 할 일·예산은 마지막 수정을 보여 준다.
   두 시각이 모두 없으면 「데이터 없음」. 지어내지 않음. */
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
  function fieldOf(obj, key) {
    if (!obj || typeof obj !== 'object') return null;
    var v = obj[key];
    if (v == null || v === '') return null;
    return String(v);
  }
  function builtAtOf(obj) { return fieldOf(obj, 'built_at'); }
  function sourceAtOf(obj) { return fieldOf(obj, 'source_at'); }
  /* ISO·오프셋이 있으면 한국 시각 부품으로, 없으면 적힌 숫자를 한국 시각으로 읽음 */
  function partsKST(raw) {
    var s = String(raw || '').trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    if (m[4] != null && /[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      var t = Date.parse(s);
      if (!isNaN(t)) {
        var d = new Date(t + 9 * 3600000);
        return [d.getUTCFullYear(), pad(d.getUTCMonth() + 1), pad(d.getUTCDate()), pad(d.getUTCHours()), pad(d.getUTCMinutes())];
      }
    }
    return [m[1], m[2], m[3], m[4] || null, m[5] || null];
  }
  function dateKST(raw) {
    var p = partsKST(raw);
    if (!p) return null;
    return p[0] + '-' + p[1] + '-' + p[2];
  }
  function formatRead(raw) {
    var p = partsKST(raw);
    if (!p) return String(raw || '');
    var t = p[0] + '-' + p[1] + '-' + p[2];
    if (p[3] != null) t += ' ' + p[3] + ':' + p[4];
    return t + ' (KST)';
  }
  function formatMDHM(raw) {
    var p = partsKST(raw);
    if (!p) return String(raw || '');
    var t = p[1] + '.' + p[2] + '.';
    if (p[3] != null) t += ' ' + p[3] + ':' + p[4];
    return t;
  }
  function formatHM(raw) {
    var p = partsKST(raw);
    if (!p || p[3] == null) return formatMDHM(raw);
    return p[3] + ':' + p[4];
  }
  function daysBetween(from, to) {
    var a = String(from || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var b = String(to || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!a || !b) return 0;
    var ms = Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3]);
    return Math.round(ms / 86400000);
  }
  function freshness(obj, nowMs) {
    var src = sourceAtOf(obj);
    var built = builtAtOf(obj);
    if (!src && !built) {
      return { missing: true, usableToday: false, daysAgo: 0, readAt: '', date: '', kind: 'none', text: NODATA };
    }
    var today = todayKST(nowMs);
    var d = src ? dateKST(src) : '';
    var usable = !!(d && d === today);
    var days = d ? daysBetween(d, today) : 0;
    var tag = (src && d) ? (' / ' + (usable ? '오늘 사용 가능' : (days + '일 전 자료'))) : '';
    var text, kind;
    if (src && built) {
      kind = 'converted';
      text = '원자료 ' + formatMDHM(src) + ' · 변환 ' + formatHM(built) + tag;
    } else if (src) {
      kind = 'git';
      text = '마지막 수정 ' + formatMDHM(src) + tag;
    } else {
      kind = 'built';
      text = '변환 ' + formatHM(built);
    }
    return {
      missing: false,
      usableToday: usable,
      daysAgo: src ? days : 0,
      readAt: src ? formatMDHM(src) : '',
      date: d || '',
      kind: kind,
      text: text
    };
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function lineHtml(obj, nowMs, escapeFn) {
    var f = freshness(obj, nowMs);
    var e = escapeFn || esc;
    var cls = 'fresh-line';
    if (f.missing) cls += ' fresh-none';
    else if (sourceAtOf(obj)) cls += f.usableToday ? ' fresh-ok' : ' fresh-no';
    return '<p class="' + cls + '" id="fresh-line">' + e(f.text) + '</p>';
  }
  return {
    NODATA: NODATA,
    todayKST: todayKST,
    builtAtOf: builtAtOf,
    sourceAtOf: sourceAtOf,
    dateKST: dateKST,
    formatRead: formatRead,
    formatMDHM: formatMDHM,
    formatHM: formatHM,
    freshness: freshness,
    lineHtml: lineHtml
  };
});
