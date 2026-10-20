/* 현수막 PNG·PDF 만들기. 모두 브라우저 안에서만(서버로 안 보냄).
   PNG: 인쇄용(글자 외곽선) SVG → 캔버스, 가로 8000px.
   PDF: 인쇄용 SVG → jsPDF + svg2pdf(벡터), 실제 크기 4000(5000)×900mm. 라이브러리는 PDF 누를 때만 불러요. */
(function (root) {
  'use strict';
  var loaded = {};
  function src(file) { return new URL(file, document.baseURI).href; }
  function loadScript(file) {
    if (loaded[file]) return loaded[file];
    loaded[file] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src(file);
      s.onload = function () { res(); };
      s.onerror = function () { delete loaded[file]; rej(new Error('lib')); };
      document.head.appendChild(s);
    });
    return loaded[file];
  }
  function svgSize(svg) {
    var m = String(svg).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    return m ? { w: +m[1], h: +m[2] } : { w: 4000, h: 900 };
  }
  function png(svg, pxW) {
    var size = svgSize(svg);
    pxW = pxW || 8000;
    var pxH = Math.round(pxW * size.h / size.w);
    var text = String(svg).replace(/width="[\d.]+mm" height="[\d.]+mm"/, 'width="' + pxW + '" height="' + pxH + '"');
    var url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = pxW; c.height = pxH;
          var g = c.getContext('2d');
          g.fillStyle = '#fff'; g.fillRect(0, 0, pxW, pxH);
          g.drawImage(im, 0, 0, pxW, pxH);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) { if (b) res(b); else rej(new Error('png')); }, 'image/png');
        } catch (e) { URL.revokeObjectURL(url); rej(e); }
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('svg')); };
      im.src = url;
    });
  }
  function pdf(svg) {
    var size = svgSize(svg);
    return loadScript('js/vendor/jspdf.umd.min.js').then(function () {
      return loadScript('js/vendor/svg2pdf.umd.min.js');
    }).then(function () {
      var J = root.jspdf && root.jspdf.jsPDF;
      if (!J) throw new Error('lib');
      var doc = new J({ orientation: 'landscape', unit: 'mm', format: [size.w, size.h], compress: true });
      var holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:10px;height:10px;overflow:hidden';
      holder.innerHTML = String(svg).replace(/<\?xml[^>]*\?>/, '');
      document.body.appendChild(holder);
      var el = holder.querySelector('svg');
      return doc.svg(el, { x: 0, y: 0, width: size.w, height: size.h }).then(function () {
        holder.remove();
        doc.setProperties({ title: '현수막 ' + size.w + '×' + size.h + 'mm', creator: '행정 업무 연습장' });
        return doc.output('blob');
      }, function (e) { holder.remove(); throw e; });
    });
  }
  function save(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  root.APBannerExport = { png: png, pdf: pdf, save: save, size: svgSize };
})(typeof globalThis !== 'undefined' ? globalThis : this);
