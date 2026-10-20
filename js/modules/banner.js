(function () {
  var FORM = 'ap3-banner-form';
  var VERS = 'ap3-banner-ver';
  var logo = null;
  var logoCleared = false;
  var pageW = 4000;
  var planeHref = '';
  var theme = 'blue';
  var tsize = 'l';
  var expLoad = null;
  function exporter() {
    if (window.APBannerExport) return Promise.resolve(window.APBannerExport);
    if (!expLoad) expLoad = new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = new URL('js/banner-export.js?v=1', document.baseURI).href;
      sc.onload = function () { res(window.APBannerExport); };
      sc.onerror = function () { expLoad = null; rej(new Error('lib')); };
      document.head.appendChild(sc);
    });
    return expLoad;
  }
  var DEFAULTS = {
    title: '사천 에어쇼 현장견학',
    subtitle: '글로컬 대학사업',
    date: '2026.10.23',
    place: '',
    host: '국립창원대학교 남해캠퍼스',
    w: 4000
  };

  function readStore(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || {}; }
    catch (e) { return {}; }
  }
  function writeStore(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function fields() {
    return [
      ['bn-title', 'title'],
      ['bn-subtitle', 'subtitle'],
      ['bn-date', 'date'],
      ['bn-place', 'place'],
      ['bn-host', 'host']
    ];
  }
  function readInputs(el) {
    var d = {};
    fields().forEach(function (pair) {
      var node = el.querySelector('#' + pair[0]);
      d[pair[1]] = node ? node.value : '';
    });
    return d;
  }
  function saveInputs(d) {
    var box = { title: d.title || '', subtitle: d.subtitle || '', date: d.date || '', place: d.place || '', host: d.host || '', w: pageW, theme: theme, size: tsize };
    if (logoCleared) box.noLogo = true;
    else if (logo && logo.custom && logo.kind === 'svg' && logo.content && logo.content.length < 200000) box.logo = logo;
    else if (logo && logo.custom && logo.kind === 'img' && logo.href && logo.href.length < 400000) box.logo = logo;
    writeStore(FORM, box);
  }
  function assetUrl(file) {
    return new URL(file, document.baseURI).href;
  }
  function blobUrl(blob) {
    return new Promise(function (res, rej) {
      var rd = new FileReader();
      rd.onload = function () { res(rd.result); };
      rd.onerror = rej;
      rd.readAsDataURL(blob);
    });
  }
  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function nextFile(title, key, kind, ext) {
    var map = readStore(VERS);
    if (theme !== 'blue') kind += '_' + themeName();
    var base = APBannerName.yymmdd(new Date()) + '_' + APBannerName.stem(title) + '_시안' + key + '_' + pageW + 'x900_' + kind + (ext && ext !== 'svg' ? '_' + ext : '');
    var n = APBannerName.bump(map, base);
    writeStore(VERS, map);
    var name = APBannerName.fileName(new Date(), title, key, kind, n, pageW);
    return ext && ext !== 'svg' ? name.replace(/\.svg$/, '.' + ext) : name;
  }
  function themeName() {
    var t = (BannerCore.themes || []).filter(function (x) { return x.id === theme; })[0];
    return t ? t.name : '';
  }

  function formValues(saved) {
    if (!saved || !Object.keys(saved).length) return Object.assign({}, DEFAULTS);
    return saved;
  }
  function render(el, api) {
    el.classList.add('wide');
    var saved = formValues(readStore(FORM));
    logoCleared = !!saved.noLogo;
    if (!logo && saved.logo) { logo = saved.logo; logo.custom = true; }
    pageW = Number(saved.w) === 5000 ? 5000 : 4000;
    theme = (BannerCore.themes || []).some(function (t) { return t.id === saved.theme; }) ? saved.theme : 'blue';
    tsize = (BannerCore.sizes || []).some(function (z) { return z.id === saved.size; }) ? saved.size : 'l';
    var h = '<div class="bn">';
    h += '<button class="linkish" id="back" type="button">← 더보기</button>';
    h += '<section class="card"><p class="kicker" id="bn-kicker">' + (pageW === 5000 ? '5m × 0.9m' : '4m × 0.9m') + '</p><h1>현수막 만들기</h1>';
    h += '<p class="muted">칸에 쓰면 기본 시안 5개와 예전 현수막 3개가 바로 나와요. 가로는 4m 또는 5m. 입력은 이 기기에 남아요.</p>';
    h += '<div class="bn-size" role="group" aria-label="현수막 가로">';
    h += '<button type="button" data-w="4000">4000×900mm</button>';
    h += '<button type="button" data-w="5000">5000×900mm</button></div>';
    h += '<div class="bn-opts"><div><span class="flabel">색</span><div class="bn-themes" role="group" aria-label="색 테마">';
    (BannerCore.themes || []).forEach(function (t) {
      h += '<button type="button" data-theme="' + t.id + '" aria-label="' + t.name + '"><i style="background:' + t.color + '"></i>' + t.name + '</button>';
    });
    h += '</div></div><div><span class="flabel">제목 글자</span><div class="bn-size bn-tsize" role="group" aria-label="제목 글자 크기">';
    (BannerCore.sizes || []).forEach(function (z) {
      h += '<button type="button" data-ts="' + z.id + '">' + z.name + '</button>';
    });
    h += '</div></div></div>';
    h += '<div class="bn-grid">';
    h += field('제목', '<textarea id="bn-title" rows="2" placeholder="행사 이름">' + api.esc(saved.title || '') + '</textarea><p class="muted">줄을 바꾸면 그 자리에서 두 줄이 돼요.</p>', true);
    h += field('부제', '<input id="bn-subtitle" type="text" placeholder="한 줄 설명" value="' + api.esc(saved.subtitle || '') + '">', true);
    h += field('일시', '<input id="bn-date" type="text" placeholder="2026. 11. 6.(금)" value="' + api.esc(saved.date || '') + '">');
    h += field('장소', '<input id="bn-place" type="text" placeholder="장소" value="' + api.esc(saved.place || '') + '">');
    h += field('주최/주관', '<input id="bn-host" type="text" placeholder="주최 · 주관" value="' + api.esc(saved.host || '') + '">', true);
    h += '<div class="full"><span class="flabel">로고</span><div class="row"><button class="btn-ghost" id="logo-pick" type="button">로고 넣기</button><button class="btn-ghost" id="logo-clear" type="button">로고 빼기</button><span class="muted" id="logo-name"></span></div>';
    h += '<input id="logo" class="hidden" type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"></div>';
    h += '</div><p class="muted" id="bn-status"></p></section><div id="bn-out"></div>';
    h += '<section class="card"><p><b>파일</b></p><p class="muted">편집용 SVG는 글자가 살아 있어요. 피그마에서 고치려면 PC에 Pretendard가 있어야 해요. 인쇄용 SVG·PDF는 글자를 외곽선으로 바꿔요. 업체에는 PDF(실제 크기 mm)를, 카톡·미리보기에는 PNG를 주세요. 색과 제목 글자 크기는 위에서 골라요.</p></section></div>';
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelector('#logo-pick').onclick = function () { el.querySelector('#logo').click(); };
    el.querySelector('#logo').onchange = function (e) { onLogo(el, api, e); };
    el.querySelector('#logo-clear').onclick = function () {
      logo = null;
      logoCleared = true;
      el.querySelector('#logo').value = '';
      paintLogo(el);
      saveInputs(readInputs(el));
      paint(el, api);
    };
    el.querySelectorAll('[data-w]').forEach(function (btn) {
      btn.onclick = function () {
        pageW = Number(btn.getAttribute('data-w')) === 5000 ? 5000 : 4000;
        markSize(el);
        saveInputs(readInputs(el));
        paint(el, api);
      };
    });
    el.querySelectorAll('[data-theme]').forEach(function (btn) {
      btn.onclick = function () { theme = btn.getAttribute('data-theme'); markSize(el); saveInputs(readInputs(el)); paint(el, api); };
    });
    el.querySelectorAll('[data-ts]').forEach(function (btn) {
      btn.onclick = function () { tsize = btn.getAttribute('data-ts'); markSize(el); saveInputs(readInputs(el)); paint(el, api); };
    });
    markSize(el);
    fields().forEach(function (pair) {
      el.querySelector('#' + pair[0]).addEventListener('input', function () {
        saveInputs(readInputs(el));
        paint(el, api);
      });
    });
    paintLogo(el);
    paint(el, api);
    loadAssets(el, api);
  }
  function markSize(el) {
    el.querySelectorAll('[data-w]').forEach(function (btn) {
      btn.classList.toggle('on', Number(btn.getAttribute('data-w')) === pageW);
    });
    el.querySelectorAll('[data-theme]').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-theme') === theme);
      btn.setAttribute('aria-pressed', btn.getAttribute('data-theme') === theme ? 'true' : 'false');
    });
    el.querySelectorAll('[data-ts]').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-ts') === tsize);
    });
    var kicker = el.querySelector('#bn-kicker');
    if (kicker) kicker.textContent = pageW === 5000 ? '5m × 0.9m' : '4m × 0.9m';
  }
  function loadAssets(el, api) {
    if (!planeHref) {
      fetch(assetUrl('img/banner-plane.png')).then(function (res) {
        if (!res.ok) throw new Error('plane');
        return res.blob();
      }).then(blobUrl).then(function (href) {
        planeHref = href;
        if (document.body.contains(el)) paint(el, api);
      }).catch(function () {});
    }
    if (!logo && !logoCleared) {
      fetch(assetUrl('img/logo-clean.png')).then(function (res) {
        if (!res.ok) throw new Error('logo');
        return res.blob();
      }).then(blobUrl).then(function (href) {
        if (logoCleared || (logo && logo.custom)) return;
        var im = new Image();
        im.onload = function () {
          if (logoCleared || (logo && logo.custom)) return;
          logo = { kind: 'img', href: href, w: im.naturalWidth, h: im.naturalHeight, custom: false };
          if (!document.body.contains(el)) return;
          paintLogo(el);
          paint(el, api);
        };
        im.src = href;
      }).catch(function () {});
    }
  }

  function field(label, input, full) {
    return '<label class="' + (full ? 'full ' : '') + 'field"><span>' + label + '</span>' + input + '</label>';
  }
  function paintLogo(el) {
    var name = el.querySelector('#logo-name');
    if (!name) return;
    name.textContent = logo ? (logo.custom ? (logo.kind === 'svg' ? 'SVG 로고' : '그림 로고') : '기본 로고') : '';
  }
  function onLogo(el, api, e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    if (/svg/i.test(f.type) || /\.svg$/i.test(f.name)) {
      rd.onload = function () {
        logo = BannerCore.parseSvgLogo(String(rd.result || ''));
        if (logo) { logo.custom = true; logoCleared = false; }
        else api.toast('SVG 로고를 읽지 못했어요.');
        paintLogo(el);
        saveInputs(readInputs(el));
        paint(el, api);
      };
      rd.readAsText(f);
      return;
    }
    rd.onload = function () {
      var im = new Image();
      im.onload = function () {
        logo = { kind: 'img', href: rd.result, w: im.naturalWidth, h: im.naturalHeight, custom: true };
        logoCleared = false;
        paintLogo(el);
        saveInputs(readInputs(el));
        paint(el, api);
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  }
  function paint(el, api) {
    var out = el.querySelector('#bn-out');
    if (!out || !window.BannerCore) return;
    var data = readInputs(el);
    var list = BannerCore.buildAll(data, logoCleared ? null : logo, { w: pageW, plane: planeHref, theme: theme, size: tsize });
    out.innerHTML = '';
    var lastGroup = '';
    list.forEach(function (d) {
      if (d.group !== lastGroup) {
        var label = document.createElement('p');
        label.className = 'bn-group';
        label.textContent = d.group;
        out.appendChild(label);
        lastGroup = d.group;
      }
      var box = document.createElement('section');
      box.className = 'card bn-design';
      box.innerHTML = '<div class="bn-head"><h2>시안 ' + api.esc(d.key) + ' · ' + api.esc(d.name) + '</h2><div class="row"></div></div><div class="bn-preview" data-mm="' + d.w + '"></div>';
      var row = box.querySelector('.row');
      row.appendChild(fileBtn('편집용 SVG', function () {
        download(nextFile(data.title, d.key, '편집용'), d.svg);
      }));
      row.appendChild(fileBtn('인쇄용 SVG', function (btn) {
        printFile(api, btn, data.title, d);
      }));
      row.appendChild(fileBtn('PNG', function (btn) {
        imageFile(api, btn, data.title, d, 'png');
      }));
      row.appendChild(fileBtn('PDF', function (btn) {
        imageFile(api, btn, data.title, d, 'pdf');
      }));
      var preview = box.querySelector('.bn-preview');
      preview.innerHTML = d.svg.replace(/<\?xml[^>]*\?>/, '');
      var svg = preview.querySelector('svg');
      if (svg) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.querySelectorAll('[id]').forEach(function (node) {
          node.setAttribute('data-layer', node.id);
          node.removeAttribute('id');
        });
      }
      out.appendChild(box);
    });
  }
  function fileBtn(label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = label;
    b.onclick = function () { onClick(b); };
    return b;
  }
  function printFile(api, btn, title, design) {
    var status = document.getElementById('bn-status');
    btn.disabled = true;
    if (status) status.textContent = '인쇄용 글꼴을 받는 중이에요.';
    APBannerOutline.loadFonts().then(function (fonts) {
      var printed = APBannerOutline.outlineSvg(design.svg, fonts);
      var left = (printed.match(/<text /g) || []).length;
      if (status) status.textContent = left ? '로고 안의 글자는 그대로 있을 수 있어요.' : '인쇄용 파일을 받았어요.';
      btn.disabled = false;
      download(nextFile(title, design.key, '인쇄용'), printed);
    }).catch(function () {
      btn.disabled = false;
      if (status) status.textContent = '';
      api.toast('인쇄용 글꼴을 받지 못했어요. 편집용 파일은 받을 수 있어요.');
    });
  }

  /* PNG·PDF: 글자를 외곽선으로 바꾼 인쇄용 SVG에서 만들어요(글꼴이 없는 PC·업체에서도 똑같이 보임) */
  function imageFile(api, btn, title, design, ext) {
    var status = document.getElementById('bn-status');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '만드는 중…';
    if (status) status.textContent = (ext === 'pdf' ? 'PDF' : 'PNG') + ' 파일을 만드는 중이에요.';
    Promise.all([APBannerOutline.loadFonts(), exporter()]).then(function (r) {
      var printed = APBannerOutline.outlineSvg(design.svg, r[0]);
      return ext === 'pdf' ? r[1].pdf(printed) : r[1].png(printed, 8000);
    }).then(function (blob) {
      window.APBannerExport.save(nextFile(title, design.key, ext === 'pdf' ? '인쇄용' : '이미지', ext), blob);
      if (status) status.textContent = ext === 'pdf'
        ? 'PDF를 받았어요. 실제 크기 ' + design.w + '×900mm, 글자는 외곽선이에요.'
        : 'PNG를 받았어요. 가로 8000px(미리보기·메신저용). 업체에는 PDF를 주세요.';
    }).catch(function () {
      if (status) status.textContent = '';
      api.toast('파일을 만들지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = label;
    });
  }

  window.ShellModules.banner = { render: render };
})();
