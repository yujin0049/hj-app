/* 교육원 전경 3D: 앱 안 전체 화면. 모델은 이 저장소 3d/ 폴더(새 버전 3d/, 이전 버전 3d/v01/, 이름표 3d/assets/labels.json — 사람 이름 없음). 버전 전환은 이 파일의 HJ3D. */
(function () {
  var V3D = { 'new': '3d/index.html', old: '3d/v01/index.html' };
  function ver3d() { try { return sessionStorage.getItem('hj3dVer') === 'old' ? 'old' : 'new'; } catch (e) { return 'new'; } }
  function verBtns() {
    var v = ver3d();
    return '<div class="v3d-ver" role="group" aria-label="3D 버전">' +
      '<button type="button" data-3dver="new" aria-pressed="' + (v === 'new') + '">새 버전</button>' +
      '<button type="button" data-3dver="old" aria-pressed="' + (v === 'old') + '">이전 버전</button></div>';
  }
  if (!window.__hj3dVerBound) {
    window.__hj3dVerBound = true;
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-3dver]');
      if (!b) return;
      var v = b.getAttribute('data-3dver') === 'old' ? 'old' : 'new';
      try { sessionStorage.setItem('hj3dVer', v); } catch (err) { /* 무시 */ }
      document.querySelectorAll('[data-3dver]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-3dver') === v)); });
      document.querySelectorAll('iframe[data-3dframe]').forEach(function (f) {
        f.src = V3D[v] + (f.getAttribute('data-3dframe') === 'embed' ? '?embed=1&v=18' : '?v=18');
      });
    });
  }
  window.HJ3D = { src: function (embed) { return V3D[ver3d()] + (embed ? '?embed=1&v=18' : '?v=18'); }, btns: verBtns };
})();
(function () {
  var SITE = 'https://silseupdong-3d.yujin06344.workers.dev/';
  var prev = '';
  window.addEventListener('hashchange', function (e) {
    try {
      if (new URL(e.newURL).hash.indexOf('#/3d') === 0) prev = new URL(e.oldURL).hash;
    } catch (err) { prev = ''; }
  });
  function render(el, api) {
    el.innerHTML = '<div class="v3d" role="dialog" aria-label="교육원 전경 3D">' +
      '<header class="v3d-bar">' +
      '<button class="v3d-btn" id="v3d-back" type="button" aria-label="홈으로">←<span> 홈</span></button>' +
      '<b>교육원 전경 3D</b>' +
      '<a class="v3d-btn" href="' + SITE + '" target="_blank" rel="noopener">편집본 ↗</a>' +
      '</header>' +
      (window.HJ3D ? window.HJ3D.btns() : '') +
      '<div class="v3d-stage"><iframe id="v3d-frame" data-3dframe="full" title="교육원 전경 3D" src="' + (window.HJ3D ? window.HJ3D.src(false) : '3d/index.html?v=18') + '" allow="fullscreen"></iframe></div>' +
      '</div>';
    document.documentElement.classList.add('v3d-on');
    var off = function () {
      document.documentElement.classList.remove('v3d-on');
      window.removeEventListener('hashchange', off);
    };
    window.addEventListener('hashchange', off);
    el.querySelector('#v3d-back').onclick = function () {
      api.go(prev && prev.indexOf('#/3d') !== 0 ? prev : '#/home');
    };
  }
  window.ShellModules['3d'] = { render: render };
})();
