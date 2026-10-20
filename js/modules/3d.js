/* 교육원 전경 3D: 앱 안 전체 화면. 3D 사이트(로그인 뒤에서만 열림)를 그대로 틀 안에 띄워요. 모델 자료는 이 저장소에 없음. */
(function () {
  var SRC = 'https://silseupdong-3d.yujin06344.workers.dev/';
  // 주소 순서: window.AP3D_SRC(자동 시험 때만) → data/config.json 의 threeD.src → 기본 주소
  function okSrc(s) {
    try {
      var u = new URL(String(s || ''));
      if (u.protocol === 'https:' && /\.workers\.dev$/.test(u.hostname)) return true;
      return !!window.AP3D_SRC && s === window.AP3D_SRC && /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
    } catch (e) { return false; }
  }
  function src() {
    if (window.AP3D_SRC && okSrc(window.AP3D_SRC)) return Promise.resolve(window.AP3D_SRC);
    return fetch('data/config.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (cfg) {
        var s = cfg && cfg.threeD && cfg.threeD.src;
        return okSrc(s) ? s : SRC;
      });
  }
  var prev = '';
  window.addEventListener('hashchange', function (e) {
    try {
      if (new URL(e.newURL).hash.indexOf('#/3d') === 0) prev = new URL(e.oldURL).hash;
    } catch (err) { prev = ''; }
  });

  function render(el, api) {
    el.innerHTML = '<div class="v3d" role="dialog" aria-label="교육원 전경 3D">' +
      '<header class="v3d-bar">' +
      '<button class="v3d-btn" id="v3d-back" type="button" aria-label="연습장으로">←<span> 연습장</span></button>' +
      '<b>교육원 전경 3D</b>' +
      '<a class="v3d-btn" id="v3d-open" href="#/3d" target="_blank" rel="noopener">새 창 ↗</a>' +
      '</header>' +
      '<div class="v3d-stage"><div class="v3d-wait" id="v3d-wait">3D 화면을 여는 중…</div>' +
      '<iframe id="v3d-frame" title="교육원 전경 3D" allow="fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe></div>' +
      '<p class="v3d-hint" id="v3d-hint">교육원 전경 3D (v02 모델은 3D 사이트 배포 뒤 보여요). 화면이 비어 있으면 「새 창」을 눌러요.</p>' +
      '</div>';
    document.documentElement.classList.add('v3d-on');
    var off = function () {
      document.documentElement.classList.remove('v3d-on');
      window.removeEventListener('hashchange', off);
    };
    window.addEventListener('hashchange', off);
    var frame = el.querySelector('#v3d-frame');
    var loads = 0;
    frame.addEventListener('load', function () {
      if (!frame.getAttribute('src')) return;
      var w = el.querySelector('#v3d-wait');
      if (w) w.remove();
      loads += 1;
      var hint = document.getElementById('v3d-hint');
      if (loads >= 2 && hint) hint.classList.add('fade');   // 로그인하고 넘어가면 안내 숨김
    });
    src().then(function (url) {
      frame.setAttribute('src', url);
      el.querySelector('#v3d-open').setAttribute('href', url);
    });
    setTimeout(function () {
      var hint = document.getElementById('v3d-hint');
      if (hint) hint.classList.add('fade');
    }, 9000);
    el.querySelector('#v3d-back').onclick = function () {
      api.go(prev && prev.indexOf('#/3d') !== 0 ? prev : '#/home');
    };
  }

  window.ShellModules['3d'] = { render: render };
})();
