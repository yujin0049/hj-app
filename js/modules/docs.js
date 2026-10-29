/* 중요문서 (#/docs): 외부기관(국토교통부·산하기관·교육부·한국산업인력공단 등) 수발신 문서 목록. 자료 = data/docs_important.json
   (볼트 99 봇/스크립트/hj_docs_extract.py, refresh_all 에서 갱신). 메타데이터만(본문·첨부·담당 칸 없음), 비공개 문서는 제목 숨김.
   유진님 「내 휴대폰에 저장은 싫어」 → 서비스워커 캐시 제외(network-only, sw.js), 다운로드·공유 버튼 없음, 화면에서만 열람. 대장 kv 261029 19:05. */
(function (root) {
  'use strict';
  var URL_JSON = 'data/docs_important.json';
  var CSS = [
    '.dc-wrap{max-width:760px;margin:0 auto;padding:0 12px 48px;box-sizing:border-box}',
    '.dc-head{padding:8px 2px 6px}.dc-head h1{margin:0 0 4px;font-size:1.35rem;letter-spacing:-.02em}',
    '.dc-head p{margin:0;font-size:.78rem;color:var(--muted);line-height:1.45}',
    '.dc-bar{position:sticky;top:0;z-index:2;background:var(--bg);padding:8px 0 6px}',
    '.dc-q{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;background:#fff}',
    '.dc-chips{display:flex;gap:6px;overflow-x:auto;padding:8px 0 2px;-webkit-overflow-scrolling:touch;scrollbar-width:none}',
    '.dc-chip{flex:0 0 auto;border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 11px;font:inherit;font-size:.8rem;font-weight:600;color:var(--ink-2);cursor:pointer}',
    '.dc-chip.on{background:var(--ink);border-color:var(--ink);color:#fff}',
    '.dc-chip b{font-weight:800;margin-left:3px;opacity:.7}',
    '.dc-count{font-size:.76rem;color:var(--muted);margin:6px 2px 8px}',
    '.dc-item{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:11px 13px;margin:0 0 8px}',
    '.dc-top{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:.74rem;color:var(--ink-2);margin:0 0 5px}',
    '.dc-org{font-weight:800;color:var(--ink)}',
    '.dc-tag{border-radius:6px;padding:2px 6px;font-weight:700;background:var(--soft)}',
    '.dc-tag.in{background:#E8F3FF;color:#1B64DA}.dc-tag.out{background:#E5F8EF;color:#03875B}',
    '.dc-date{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--muted);font-weight:600}',
    '.dc-t{font-size:.94rem;font-weight:700;line-height:1.4;margin:0 0 4px;word-break:keep-all;overflow-wrap:anywhere}',
    '.dc-t.hid{color:var(--muted);font-weight:600}',
    '.dc-g{font-size:.8rem;color:var(--ink-2);line-height:1.4}',
    '.dc-no{font-size:.72rem;color:var(--muted);margin:4px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}',
    '.dc-empty{text-align:center;padding:24px 8px;color:var(--muted);background:var(--card);border-radius:14px;border:1px solid var(--line)}',
    '.dc-foot{font-size:.72rem;color:var(--muted);margin:12px 2px 0;line-height:1.5}'
  ].join('\n');
  var st = { data: null, org: '', q: '' };

  function style() {
    if (document.getElementById('dc-style')) return;
    var s = document.createElement('style'); s.id = 'dc-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function md(d) { var p = String(d || '').split('-'); return p.length === 3 ? p[0].slice(2) + '.' + Number(p[1]) + '.' + Number(p[2]) + '.' : ''; }
  function match(r, q) {
    if (!q) return true;
    var hay = [r.org, r.t, r.gist, r.no, r.ono, r.dir, r.dept].join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function list(el, api) {
    var esc = api.esc, d = st.data;
    var rows = d.rows.filter(function (r) { return (!st.org || r.org === st.org) && match(r, st.q); });
    var h = '<p class="dc-count">' + rows.length + '건' + (st.org || st.q ? ' (전체 ' + d.total + '건)' : '') + '</p>';
    if (!rows.length) h += '<div class="dc-empty">맞는 문서가 없어요.</div>';
    rows.forEach(function (r) {
      var cls = r.dir === '받음' ? 'in' : (r.dir === '보냄' ? 'out' : '');
      h += '<article class="dc-item"><div class="dc-top"><span class="dc-org">' + esc(r.org) + '</span><span class="dc-tag ' + cls + '">' + esc(r.dir) + '</span>' +
        (r.basis !== '직접' ? '<span class="dc-tag">' + esc(r.basis === '경유' ? '본부 경유' : '제목 언급') + '</span>' : '') +
        '<span class="dc-date">' + esc(md(r.d)) + '</span></div>' +
        (r.pub ? '<p class="dc-t">' + esc(r.t) + '</p>' : '<p class="dc-t hid">비공개 문서 · 제목 숨김</p>') +
        '<div class="dc-g">요지: ' + esc(r.gist) + '</div>' +
        '<div class="dc-no">' + esc(r.no || '') + (r.ono ? (r.no ? ' · ' : '') + '원문 ' + esc(r.ono) : '') + '</div></article>';
    });
    el.querySelector('#dc-list').innerHTML = h;
  }
  function paint(el, api) {
    var esc = api.esc, d = st.data;
    var orgs = (d.org_order || Object.keys(d.orgs || {})).filter(function (o) { return d.orgs[o]; });
    var src = d.sources || [], main = src[0] || {}, rest = src.slice(1);
    var restTo = rest.reduce(function (m, s) { return s.to > m ? s.to : m; }, '');
    var span = '항공정비과 문서대장 ~' + md(main.to) + (rest.length ? ' · 다른 부서 ' + rest.length + '곳 ~' + md(restTo) : '');
    var h = '<div class="dc-wrap"><section class="dc-head"><h1>중요문서</h1><p>외부기관과 주고받은 문서 목록(' + esc(span) + '). 제목·번호만 보여 주고 본문·첨부는 없어요. 이 화면은 휴대폰에 저장되지 않아요.</p></section>' +
      '<div class="dc-bar"><input class="dc-q" id="dc-q" type="search" placeholder="제목·번호·요지 검색" autocomplete="off" enterkeyhint="search" value="' + esc(st.q) + '">' +
      '<div class="dc-chips" id="dc-chips"><button type="button" class="dc-chip' + (st.org ? '' : ' on') + '" data-org="">전체<b>' + d.total + '</b></button>' +
      orgs.map(function (o) { return '<button type="button" class="dc-chip' + (st.org === o ? ' on' : '') + '" data-org="' + esc(o) + '">' + esc(o) + '<b>' + d.orgs[o] + '</b></button>'; }).join('') +
      '</div></div><div id="dc-list"></div>' +
      '<p class="dc-foot">' + esc(d.note || '') + ' · 갱신 ' + esc(d.generated || '') + ' (KST) · 출처: ' + esc((d.sources || []).filter(function (s) { return s.picked; }).map(function (s) { return s.dept + ' ' + s.picked + '건'; }).join(', ')) + '</p></div>';
    el.innerHTML = h;
    list(el, api);
    el.querySelector('#dc-q').addEventListener('input', function (e) { st.q = e.target.value.trim(); list(el, api); });
    el.querySelectorAll('.dc-chip').forEach(function (b) {
      b.onclick = function () {
        st.org = b.getAttribute('data-org');
        el.querySelectorAll('.dc-chip').forEach(function (x) { x.classList.toggle('on', x === b); });
        list(el, api);
      };
    });
  }
  function render(el, api) {
    style();
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    fetch(new URL(URL_JSON, document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('docs'); return r.json(); })
      .then(function (j) { st.data = j; if (!j || !j.rows) throw new Error('docs'); paint(el, api); })
      .catch(function () {
        el.innerHTML = '<section class="card"><h2>중요문서</h2><p>인터넷에 연결돼 있어야 볼 수 있어요. (휴대폰에 저장하지 않는 화면)</p></section>';
      });
  }
  if (root.ShellModules) root.ShellModules.docs = { id: 'docs', tab: '중요문서', icon: '', render: render };
})(typeof window !== 'undefined' ? window : globalThis);
