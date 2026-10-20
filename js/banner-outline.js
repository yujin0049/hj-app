/* 편집용 SVG의 Pretendard 글자를 인쇄용 외곽선으로 바꿉니다. 글꼴은 받을 때만 불러요. */
(function (root) {
  'use strict';
  var RE = /<text x="([-\d.]+)" y="([-\d.]+)" font-family="Pretendard" font-size="([\d.]+)" font-weight="(\d+)" fill="([^"]+)"((?: fill-opacity="[\d.]+")?)>([\s\S]*?)<\/text>/g;
  var URLS = {
    '600': 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-SemiBold.otf',
    '700': 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf',
    '800': 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-ExtraBold.otf'
  };
  var cache = {};

  function decode(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function outlineSvg(svg, fonts) {
    var out = String(svg).replace(RE, function (all, x, y, size, wt, fill, op, text) {
      var font = fonts && (fonts[wt] || fonts[String(wt)]);
      if (!font || typeof font.getPath !== 'function') return all;
      var label = decode(text);
      var path = font.getPath(label, +x, +y, +size);
      var d = path && path.toPathData ? path.toPathData(2) : '';
      if (!d) return all;
      return '<path d="' + d + '" fill="' + fill + '"' + (op || '') + ' aria-label="' + esc(label) + '"/>';
    });
    return out.replace('· 글꼴 Pretendard -->', '· 인쇄용: 글자 외곽선(패스) 처리됨 -->');
  }
  function loadFonts() {
    if (!root.opentype) return Promise.reject(new Error('fontlib'));
    var weights = ['600', '700', '800'];
    return Promise.all(weights.map(function (wt) {
      if (cache[wt]) return Promise.resolve(cache[wt]);
      return fetch(URLS[wt]).then(function (res) {
        if (!res.ok) throw new Error('font');
        return res.arrayBuffer();
      }).then(function (buf) {
        cache[wt] = root.opentype.parse(buf);
        return cache[wt];
      });
    })).then(function () { return cache; });
  }
  root.APBannerOutline = { outlineSvg: outlineSvg, loadFonts: loadFonts, urls: URLS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
