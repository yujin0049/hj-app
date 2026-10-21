/* 교육원 전경 3D: 앱 안 전체 화면. 모델은 이 저장소 3d/ 폴더(도면의 일반 실 이름만, 서버·편집 저장값 없음). */
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
      '<div class="v3d-stage"><iframe id="v3d-frame" title="교육원 전경 3D" src="3d/index.html?v=17" allow="fullscreen"></iframe></div>' +
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
