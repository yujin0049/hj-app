/* 더보기 > 볼트 문서: 잠긴 API(js/vault-api.js)의 옵시디언 볼트 문서. 폴더 나무·검색·문서·마지막 갱신.
   문서 글은 js/vault-md.js 가 textContent 로만 그려요. 볼트 글은 기기에 저장하지 않아요. */
(function () {
  var icon = '';
  var DETAIL = {
    locked: '로그인이 필요해요. 잠긴 연습장 주소에서 이메일 코드로 로그인한 뒤 다시 열어 주세요.',
    missing: '이 주소에는 볼트 문서가 없어요. 공개 연습장에서는 볼트 문서를 보여 주지 않아요.',
    down: '잠긴 서버에 연결하지 못했어요. 인터넷을 확인하고 다시 불러와 주세요.'
  };
  function stateBox(api, kind, status) {
    var title = kind === 'empty' ? '아직 올린 문서가 없어요' : (kind === 'gone' ? '없는 문서예요' : '잠긴 연습장에서만 보여요');
    var detail = kind === 'empty' ? '봇이 볼트 문서 팩을 올리면 여기에 보여요.' : (kind === 'gone' ? '볼트에서 지워졌거나 옮겨졌을 수 있어요.' : (DETAIL[kind] || DETAIL.down));
    return '<section class="card vault-state" data-vault-state="' + api.esc(kind) + '"' + (status ? ' data-status="' + api.esc(status) + '"' : '') + '>' +
      '<h2>' + api.esc(title) + '</h2><p class="muted">' + api.esc(detail) + '</p>' +
      '<button class="btn-ghost block" id="vault-retry" type="button">다시 불러오기</button></section>';
  }
  function bindCommon(el, api, back) {
    var b = el.querySelector('#back');
    if (b) b.onclick = function () { api.go(back); };
    var r = el.querySelector('#vault-retry');
    if (r) r.onclick = function () { VaultApi.index(true).then(api.refresh, api.refresh); };
  }
  function shortPath(ix, p) {
    var base = ix && ix.vault_root ? ix.vault_root + '/' : '';
    return base && p.indexOf(base) === 0 ? p.slice(base.length) : p;
  }
  function matches(d, q) {
    return !q || (d.title + ' ' + d.path + ' ' + (d.aliases || []).join(' ') + ' ' + (d.headings || []).join(' ') + ' ' + d.folder).toLowerCase().indexOf(q) >= 0;
  }
  /* 경로로 폴더 나무 만들기 */
  function tree(ix, docs) {
    var top = { name: '', dirs: {}, order: [], docs: [], n: 0 };
    docs.forEach(function (d) {
      var parts = shortPath(ix, d.path).split('/'), cur = top;
      top.n++;
      parts.slice(0, -1).forEach(function (p) {
        if (!cur.dirs[p]) { cur.dirs[p] = { name: p, dirs: {}, order: [], docs: [], n: 0 }; cur.order.push(p); }
        cur = cur.dirs[p];
        cur.n++;
      });
      cur.docs.push(d);
    });
    return top;
  }
  function treeHtml(api, t, depth, open) {
    var h = '';
    t.order.slice().sort().forEach(function (k) {
      var c = t.dirs[k];
      h += '<details class="vault-dir lv' + Math.min(depth, 3) + '"' + (open || depth === 0 ? ' open' : '') + '><summary><b>' + api.esc(c.name) + '</b> <span class="muted">' + c.n + '개</span></summary>' +
        treeHtml(api, c, depth + 1, open) + '</details>';
    });
    t.docs.slice().sort(function (a, b) { return a.path < b.path ? -1 : 1; }).forEach(function (d) {
      h += '<button class="list-btn" type="button" data-vdoc="' + api.esc(d.id) + '"><b>' + api.esc(d.title) + '</b>' +
        '<div class="item-meta">' + api.esc(d.folder) + ' · 수정 ' + api.esc(d.modified || '') + '</div></button>';
    });
    return h;
  }
  function bindDocs(el, api) {
    el.querySelectorAll('[data-vdoc]').forEach(function (b) {
      b.onclick = function () { api.go('#/vault/doc/' + b.getAttribute('data-vdoc')); };
    });
  }
  function queryOf(api) {
    var m = /(?:^|&)q=([^&]*)/.exec(api.route().query || '');
    try { return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; } catch (e) { return ''; }
  }

  function listView(el, api) {
    el.innerHTML = '<button class="linkish" id="back" type="button">← 더보기</button>' +
      '<section class="card"><h1>볼트 문서</h1><p class="muted">옵시디언 볼트의 규칙·일정·보고서·프로세스·규정을 자동으로 읽어요. 잠긴 연습장에서만 보여요.</p>' +
      '<p class="muted" id="vault-gen">불러오는 중…</p>' +
      '<input id="vault-q" type="search" placeholder="문서 찾기 (제목·본문)" autocomplete="off" aria-label="볼트 문서 찾기"></section>' +
      '<div id="vault-list"></div><div id="vault-hits"></div>';
    bindCommon(el, api, '#/more');
    var qEl = el.querySelector('#vault-q');
    qEl.value = queryOf(api);
    VaultApi.index().then(function (ix) {
      var docs = ix.docs || [];
      var gen = el.querySelector('#vault-gen');
      if (!docs.length) {
        gen.textContent = ix.generated ? '마지막 갱신 ' + ix.generated : '';
        el.querySelector('#vault-list').innerHTML = stateBox(api, 'empty');
        bindCommon(el, api, '#/more');
        return;
      }
      gen.textContent = '마지막 갱신 ' + (ix.generated || '-') + ' · 문서 ' + docs.length + '개';
      var listEl = el.querySelector('#vault-list'), hitsEl = el.querySelector('#vault-hits'), timer = null;
      function draw() {
        var raw = qEl.value.trim(), q = raw.toLowerCase();
        try { history.replaceState(null, '', '#/vault' + (raw ? '?q=' + encodeURIComponent(raw) : '')); } catch (e) { /* 주소 못 바꿔도 됨 */ }
        var shown = docs.filter(function (d) { return matches(d, q); });
        listEl.innerHTML = shown.length ? '<section class="card vault-tree" data-count="' + shown.length + '">' + treeHtml(api, tree(ix, shown), 0, !!q) + '</section>' :
          '<section class="card"><p class="muted">제목·경로에서 찾은 문서가 없어요.</p></section>';
        hitsEl.innerHTML = '';
        bindDocs(el, api);
        clearTimeout(timer);
        if (q.length < 2) return;
        timer = setTimeout(function () {
          VaultApi.search(q).then(function (r) {
            if (qEl.value.trim().toLowerCase() !== q) return;
            var hs = r.hits || [];
            hitsEl.innerHTML = '<section class="card vault-hits" data-hits="' + hs.length + '"><h2>본문에서 찾음 ' + hs.length + '개</h2>' + hs.map(function (x) {
              return '<button class="list-btn" type="button" data-vdoc="' + api.esc(x.id) + '"><b>' + api.esc(x.title) + '</b><div class="item-meta">' +
                api.esc(x.folder) + ' · …' + api.esc(x.snip) + '…</div></button>';
            }).join('') + (hs.length ? '' : '<p class="muted">본문에 없는 말이에요.</p>') + '</section>';
            bindDocs(el, api);
          }, function () {
            hitsEl.innerHTML = '<section class="card"><p class="muted">본문 검색을 못 했어요. 다시 해 주세요.</p></section>';
          });
        }, 250);
      }
      qEl.oninput = draw;
      draw();
    }, function (e) {
      el.querySelector('#vault-gen').textContent = '';
      el.querySelector('#vault-list').innerHTML = stateBox(api, e.kind || 'down', e.status);
      bindCommon(el, api, '#/more');
    });
  }

  function docView(el, api, id) {
    el.innerHTML = '<button class="linkish" id="back" type="button">← 볼트 문서</button><section class="card vault-doc"><p class="muted">불러오는 중…</p></section>';
    bindCommon(el, api, '#/vault');
    var ixP = VaultApi.index().catch(function () { return null; });
    Promise.all([VaultApi.doc(id), ixP]).then(function (r) {
      var d = r[0] || {}, ix = r[1];
      var box = el.querySelector('.vault-doc');
      box.innerHTML = '<p class="kicker">' + api.esc(d.folder || '') + '</p><h1>' + api.esc(d.title || '') + '</h1>' +
        '<p class="muted vault-path">' + api.esc(shortPath(ix, d.path || '')) + ' · 수정 ' + api.esc(d.modified || '') + '</p>' +
        '<p class="muted">마지막 갱신 ' + api.esc(d.generated || (ix && ix.generated) || '-') +
        (d.masked_rrn ? ' · 주민번호 ' + Number(d.masked_rrn) + '곳 가림' : '') + '</p><div class="vault-body"></div>';
      var body = box.querySelector('.vault-body');
      if (d.kind === 'json') body.appendChild(VaultMd.plainPre(d.text));
      else body.appendChild(VaultMd.render(d.text, { resolve: VaultApi.resolver(ix), skipTitle: d.title }));
    }, function (e) {
      ixP.then(function (ix) {
        var kind = e.kind === 'missing' && ix ? 'gone' : (e.kind || 'down');
        el.querySelector('.vault-doc').outerHTML = stateBox(api, kind, e.status);
        bindCommon(el, api, '#/vault');
      });
    });
  }

  function render(el, api) {
    var parts = api.route().parts;
    if (parts[1] === 'doc' && parts[2]) return docView(el, api, parts[2]);
    return listView(el, api);
  }
  ShellModules.vault = { id: 'vault', tab: '볼트 문서', icon: icon, render: render };
})();
