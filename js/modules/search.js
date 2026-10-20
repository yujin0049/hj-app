(function () {
  var icon = '';
  function render(el, api) {
    var q = '';
    try { q = decodeURIComponent(api.route().parts.slice(1).join('/') || ''); } catch (e) { q = ''; }
    var box = document.getElementById('find-q');
    if (box && q) box.value = q;
    var view = api.unlocked() ? api.pack() : null;
    var hits = APSearch.searchAll(api.guide(), view, q);
    var h = '<section class="card"><p class="kicker">검색</p><h1>' + (q ? api.esc(q) : '검색어를 적어 주세요') + '</h1>';
    h += '<p class="muted">' + (api.unlocked() ? '학생 안내와 행정 자료를 함께 찾아요.' : '학생 안내만 찾아요. 공개 자료를 받으면 나머지도 같이 나와요.') + '</p></section>';
    if (q && !hits.length) h += '<section class="card"><p>해당하는 글이 없어요.</p></section>';
    hits.forEach(function (hit) {
      h += '<button class="list-btn" type="button" data-go="' + api.esc(hit.href) + '"><span class="badge">' + api.esc(hit.zone) + '</span> <b>' + api.esc(hit.title) + '</b><div class="item-meta">' + api.esc(hit.text) + '</div></button>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { api.go(b.getAttribute('data-go')); };
    });
  }
  ShellModules.search = { id: 'search', tab: '', icon: icon, render: render };
})();
