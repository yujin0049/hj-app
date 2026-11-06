/* 실무 › 자료함: 업무 순서 · 규정 · 양식 · 어디 있나 · 앱 안 · 용어
   내용은 public/library.json. 상세는 #/library/<id> */
(function () {
  var FILE = 'public/library.json';
  var state = { cat: 'proc', q: '' };
  var SHORT = 5; // 카드에 바로 보여 줄 단계 수

  function W() { return window.WorkUI; }
  function esc(s) { return W() ? W().esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function load() {
    if (W()) return W().json(FILE);
    return fetch(new URL(FILE, document.baseURI).href, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(FILE);
      return r.json();
    });
  }

  function catName(d, v) {
    var c = (d.cats || []).filter(function (x) { return x.v === v; })[0];
    return c ? c.t : '';
  }
  function isLong(it) {
    return (it.steps || []).length > SHORT || (it.notes || []).length > 3;
  }
  function hay(it) {
    return [it.title, it.sub, it.basis, it.where].concat(it.steps || [], it.notes || []).join(' ').toLowerCase();
  }
  function match(it, q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    var h = hay(it);
    return words.every(function (w) { return h.indexOf(w) >= 0; });
  }

  var pathStyle = ' style="word-break:break-all;overflow-wrap:anywhere"';
  var listStyle = ' style="margin:8px 0 0;padding-left:1.3em"';

  function metaLines(it) {
    var h = '';
    if (it.basis) h += '<p class="muted" style="margin:8px 0 0"><b>근거</b> ' + esc(it.basis) + '</p>';
    if (it.where) h += '<p class="muted"' + pathStyle.replace('"word', '"margin:4px 0 0;word') + '><b>위치</b> ' + esc(it.where) + '</p>';
    return h;
  }

  function card(d, it, showCat) {
    var steps = it.steps || [], notes = it.notes || [], long = isLong(it);
    var h = '<section class="card" data-item="' + esc(it.id) + '">';
    if (showCat) h += '<p class="kicker">' + esc(catName(d, it.cat)) + '</p>';
    h += '<h2 style="margin:0">' + esc(it.title) + '</h2>';
    if (it.sub) h += '<p class="muted" style="margin:4px 0 0">' + esc(it.sub) + '</p>';
    if (steps.length) {
      h += '<ol' + listStyle + '>' + steps.slice(0, long ? SHORT - 1 : SHORT).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
      if (long && steps.length > SHORT - 1) h += '<p class="muted" style="margin:2px 0 0">… 외 ' + (steps.length - (SHORT - 1)) + '단계</p>';
    } else if (notes.length) {
      h += '<ul' + listStyle + '>' + notes.slice(0, 3).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
      if (notes.length > 3) h += '<p class="muted" style="margin:2px 0 0">… 외 ' + (notes.length - 3) + '줄</p>';
    }
    h += metaLines(it);
    var btns = '';
    if (long || (steps.length && notes.length)) btns += '<button class="btn btn-ghost" type="button" data-open="' + esc(it.id) + '">자세히</button>';
    if (it.link && it.link.href) btns += '<button class="btn' + (btns ? ' btn-ghost' : '') + '" type="button" data-go="' + esc(it.link.href) + '">' + esc(it.link.t || '열기') + ' →</button>';
    if (btns) h += '<div class="row" style="margin-top:10px">' + btns + '</div>';
    return h + '</section>';
  }

  function listHtml(d) {
    var items = d.items || [], q = state.q.trim(), shown;
    if (q) shown = items.filter(function (it) { return match(it, q); });
    else shown = items.filter(function (it) { return it.cat === state.cat; });
    if (!shown.length) {
      return '<section class="card"><p class="muted">' + (q ? '「' + esc(q) + '」 찾은 것이 없어요. 다른 말로 찾아 보세요.' : '이 칸은 아직 비어 있어요.') + '</p></section>';
    }
    var head = q ? '<p class="muted" style="margin:4px 2px 8px">전체에서 ' + shown.length + '개 찾았어요</p>' : '';
    return head + shown.map(function (it, i) {
      return card(d, it, !!q).replace('<section class="card"', '<section class="card" style="animation:w-in .35s var(--w-spring) both;animation-delay:' + Math.min(i, 8) * 40 + 'ms"');
    }).join('');
  }

  function bindList(box, api) {
    box.querySelectorAll('[data-open]').forEach(function (b) {
      b.onclick = function () { api.go('#/library/' + encodeURIComponent(b.getAttribute('data-open'))); };
    });
    box.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { api.go(b.getAttribute('data-go')); };
    });
  }

  function list(el, api, d) {
    var cats = (d.cats || []).map(function (c) { return { v: c.v, t: c.t }; });
    if (!cats.some(function (c) { return c.v === state.cat; }) && cats.length) state.cat = cats[0].v;
    var seg = W() ? W().seg('lib', cats, state.q ? '' : state.cat) : '';
    el.innerHTML = (W() ? W().backBtn : '') +
      '<section class="card"><p class="kicker">실무</p><h1>자료함</h1>' +
      '<p class="muted">' + esc(d.notice || '') + '</p>' +
      '<div class="field" style="margin-bottom:6px"><input type="search" id="lib-q" placeholder="찾기: 견적, 서식28, 휴보강…" autocomplete="off" value="' + esc(state.q) + '" aria-label="자료 찾기"></div>' +
      '<div style="max-width:100%;overflow:hidden">' + seg + '</div>' +
      (d.updated ? '<p class="muted" style="margin:8px 0 0;font-size:.85rem">갱신 ' + esc(d.updated) + '</p>' : '') +
      '</section><div id="lib-list">' + listHtml(d) + '</div>';
    if (W()) W().bindBack(el, api);
    var box = el.querySelector('#lib-list');
    bindList(box, api);

    var input = el.querySelector('#lib-q'), t = null;
    function clearSeg(on) {
      el.querySelectorAll('.w-seg button').forEach(function (b) { b.classList.toggle('on', on && b.getAttribute('data-v') === state.cat); });
      var th = el.querySelector('.w-seg .w-thumb');
      if (th && !on) th.style.opacity = '0';
    }
    input.oninput = function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var had = !!state.q.trim();
        state.q = input.value;
        var has = !!state.q.trim();
        if (had !== has) {
          clearSeg(!has);
          if (!has && W()) W().bindSeg(el, onSeg); // 썸 위치 다시
        }
        box.innerHTML = listHtml(d);
        bindList(box, api);
      }, 120);
    };
    function onSeg(name, v) {
      state.cat = v;
      if (state.q) { state.q = ''; input.value = ''; }
      var html = listHtml(d);
      if (W()) W().swap(box, html, function () { bindList(box, api); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      else { box.innerHTML = html; bindList(box, api); }
    }
    if (W()) W().bindSeg(el, onSeg);
  }

  function detail(el, api, d, id) {
    var it = (d.items || []).filter(function (x) { return x.id === id; })[0];
    var back = '<button class="linkish" id="lib-back" type="button">← 자료함</button>';
    if (!it) {
      el.innerHTML = back + '<section class="card"><h1>찾을 수 없어요</h1><p class="muted">목록에서 다시 골라 주세요.</p></section>';
    } else {
      var h = back + '<section class="card" style="animation:w-in .35s var(--w-spring) both"><p class="kicker">' + esc(catName(d, it.cat)) + '</p><h1>' + esc(it.title) + '</h1>';
      if (it.sub) h += '<p class="muted">' + esc(it.sub) + '</p>';
      if ((it.steps || []).length) h += '<h2>순서</h2><ol' + listStyle + '>' + it.steps.map(function (s) { return '<li style="margin:4px 0">' + esc(s) + '</li>'; }).join('') + '</ol>';
      if ((it.notes || []).length) h += '<h2>' + ((it.steps || []).length ? '알아 둘 것' : '요점') + '</h2><ul' + listStyle + '>' + it.notes.map(function (s) { return '<li style="margin:4px 0">' + esc(s) + '</li>'; }).join('') + '</ul>';
      h += metaLines(it);
      var btns = '<button class="btn btn-ghost" type="button" id="lib-copy">글 복사</button>';
      if (it.link && it.link.href) btns = '<button class="btn" type="button" data-go="' + esc(it.link.href) + '">' + esc(it.link.t || '열기') + ' →</button>' + btns;
      h += '<div class="row" style="margin-top:12px">' + btns + '</div></section>';
      el.innerHTML = h;
      var go = el.querySelector('[data-go]');
      if (go) go.onclick = function () { api.go(go.getAttribute('data-go')); };
      el.querySelector('#lib-copy').onclick = function () {
        var lines = [it.title];
        if (it.sub) lines.push(it.sub);
        (it.steps || []).forEach(function (s, i) { lines.push((i + 1) + '. ' + s); });
        (it.notes || []).forEach(function (s) { lines.push('- ' + s); });
        if (it.basis) lines.push('근거: ' + it.basis);
        if (it.where) lines.push('위치: ' + it.where);
        if (W()) W().copy(lines.join('\n'));
      };
    }
    el.querySelector('#lib-back').onclick = function () { api.go('#/library'); };
  }

  function render(el, api) {
    var id = api.route().parts[1];
    el.innerHTML = (W() ? W().backBtn : '') + '<section class="card"><h1>자료함</h1><p class="muted">불러오는 중…</p></section>';
    if (W()) W().bindBack(el, api);
    load().then(function (d) {
      if (!d || !Array.isArray(d.items)) throw new Error('형식');
      if (id) detail(el, api, d, id);
      else list(el, api, d);
    }).catch(function () {
      el.innerHTML = (W() ? W().backBtn : '') + '<section class="card"><h1>자료함을 열지 못했어요</h1>' +
        '<p class="muted">인터넷 연결을 확인하고 다시 눌러 주세요.</p>' +
        '<div class="row"><button class="btn" type="button" id="lib-retry">다시 불러오기</button></div></section>';
      if (W()) W().bindBack(el, api);
      el.querySelector('#lib-retry').onclick = function () { render(el, api); };
    });
  }

  ShellModules.library = { id: 'library', render: render };
})();
