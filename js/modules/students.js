(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  function plain(s) { return String(s || '').replace(/\*\*/g, ''); }
  function blocksHtml(api, blocks) {
    return (blocks || []).map(function (b) {
      if (b.type === 'h') return '<h2>' + api.esc(plain(b.text)) + '</h2>';
      if (b.type === 'p') return '<p>' + api.esc(plain(b.text)) + '</p>';
      if (b.type === 'ul') return '<ul>' + (b.items || []).map(function (it) { return '<li>' + api.esc(plain(it)) + '</li>'; }).join('') + '</ul>';
      if (b.type === 'table') {
        var h = '<div class="scroll"><table class="plain"><tr>' + (b.head || []).map(function (c) { return '<th>' + api.esc(plain(c)) + '</th>'; }).join('') + '</tr>';
        (b.rows || []).forEach(function (r) { h += '<tr>' + r.map(function (c) { return '<td>' + api.esc(plain(c)) + '</td>'; }).join('') + '</tr>'; });
        return h + '</table></div>';
      }
      return '';
    }).join('');
  }

  function render(el, api) {
    var guide = api.guide();
    var id = api.route().parts[1];
    var sec = (guide.sections || []).filter(function (s) { return s.id === id; })[0];
    if (sec) {
      el.innerHTML = '<button class="linkish" id="back" type="button">← 학생 안내</button><section class="card"><p class="kicker">알림 없음</p><h1>' + api.esc(sec.title) + '</h1>' + blocksHtml(api, sec.blocks) + '</section>';
      el.querySelector('#back').onclick = function () { api.go('#/students'); };
      return;
    }
    var h = '<section class="card"><p class="kicker">공개</p><h1>학생 안내</h1><p>' + api.esc(guide.notice || '알림은 보내지 않아요.') + '</p></section>';
    (guide.sections || []).forEach(function (s) {
      h += '<button class="list-btn" type="button" data-id="' + api.esc(s.id) + '"><b>' + api.esc(s.title) + '</b></button>';
    });
    if (!(guide.sections || []).length) h += '<section class="card"><p>안내 글을 불러오지 못했어요.</p></section>';
    el.innerHTML = h;
    el.querySelectorAll('[data-id]').forEach(function (b) {
      b.onclick = function () { api.go('#/students/' + b.getAttribute('data-id')); };
    });
  }
  ShellModules.students = { id: 'students', tab: '학생', icon: icon, render: render };
})();