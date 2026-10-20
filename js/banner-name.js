/* 현수막 파일 이름. YYMMDD_내용_시안_용도_v01 */
(function (root) {
  'use strict';
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function yymmdd(d) {
    d = d || new Date();
    return String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate());
  }
  function stem(title) {
    var s = String(title || '').replace(/[\t\r\n ]+/g, '').replace(/[\\/:*?"<>|]/g, '');
    if (!s) s = '현수막';
    return s.slice(0, 24);
  }
  function fileName(date, title, key, kind, ver, size) {
    var n = ver || 1;
    var v = n < 10 ? '0' + n : String(n);
    var wide = size ? '_' + size + 'x900' : '';
    return yymmdd(date) + '_' + stem(title) + '_시안' + key + wide + '_' + kind + '_v' + v + '.svg';
  }
  function bump(map, base) {
    var n = (map[base] || 0) + 1;
    map[base] = n;
    return n;
  }
  root.APBannerName = { yymmdd: yymmdd, stem: stem, fileName: fileName, bump: bump };
})(typeof globalThis !== 'undefined' ? globalThis : this);
