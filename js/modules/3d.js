/* 교육원 전경 3D: 앱 안 전체 화면. 3D 사이트의 입장 번호 화면을 그대로 틀 안에 띄워요(번호는 여기 없음). */
(function () {
  var SRC = 'https://silseupdong-3d.yujin06344.workers.dev/';
  function src() { return window.AP3D_SRC || SRC; }   // AP3D_SRC: 자동 시험 때만 씀
  var prev = '';
  window.addEventListener('hashchange', function (e) {
    try {
      if (new URL(e.newURL).hash.indexOf('#/3d') === 0) prev = new URL(e.oldURL).hash;
    } catch (err) { prev = ''; }
  });

  function render(el, api) {
    var url = src();
    el.innerHTML = '<div class="v3d" role="dialog" aria-label="교육원 전경 3D">' +
      '<header class="v3d-bar">' +
      '<button class="v3d-btn" id="v3d-back" type="button" aria-label="연습장으로">←<span> 연습장</span></button>' +
      '<b>교육원 전경 3D</b>' +
      '<a class="v3d-btn" id="v3d-open" href="' + api.esc(url) + '" target="_blank" rel="noopener">새 창 ↗</a>' +
      '</header>' +
      '<div class="v3d-stage"><div class="v3d-wait" id="v3d-wait">3D 화면을 여는 중…</div>' +
      '<iframe id="v3d-frame" title="교육원 전경 3D" src="' + api.esc(url) + '" allow="fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe></div>' +
      '<p class="v3d-hint" id="v3d-hint">입장 번호 화면이 나오면 번호를 넣어요. 화면이 비어 있거나 이메일로 들어가려면 「새 창」을 눌러요.</p>' +
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
      var w = el.querySelector('#v3d-wait');
      if (w) w.remove();
      loads += 1;
      var hint = document.getElementById('v3d-hint');
      if (loads >= 2 && hint) hint.classList.add('fade');   // 번호 넣고 넘어가면 안내 숨김
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
