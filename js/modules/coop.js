/* 원큐 협조리스트 (#/coop): 유진님 업무별 협조처·휴보강 경로·번호부 등재 주업무.
   출처: 조사/261027_유진님업무_협조리스트_v01 · 261027_전화번호부_담당자_주업무_v01
   정적 data/coop.json 만. 브라우저 저장소에 쓰지 않음. 공문 발송 UI 없음. 휴대전화(010) 없음. */
(function (root) {
  'use strict';
  var data = null;
  var q = '';
  var CSS = [
    '.cp-head{padding:4px 2px 0}.cp-head h1{margin:0 0 2px}.cp-head p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45}',
    '.cp-card{background:var(--card);border-radius:20px;padding:16px;margin:12px 0}.cp-card h2{font-size:1.02rem;margin:0 0 8px}',
    '.cp-m{font-size:.8rem;color:var(--muted);line-height:1.5;margin:4px 0}',
    '.cp-warn{border-radius:12px;padding:10px 12px;background:var(--warnbg);color:#7a4a00;font-size:.84rem;line-height:1.45;margin:8px 0 0}',
    '.cp-top{display:flex;flex-direction:column;gap:8px}.cp-top .cp-item{border-radius:14px;padding:12px 14px;background:var(--soft)}',
    '.cp-top .cp-item b{display:block;font-size:.95rem;margin-bottom:4px}.cp-top .cp-item span{font-size:.86rem;line-height:1.45;color:var(--ink-2)}',
    '.cp-path{border-top:1px solid var(--line);padding:10px 0}.cp-path:first-of-type{border-top:0;padding-top:0}',
    '.cp-path b{font-size:.9rem}.cp-path p{margin:4px 0 0;font-size:.86rem;line-height:1.45;color:var(--ink-2)}',
    '.cp-search{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:.95rem;background:var(--card);color:var(--ink);margin:0 0 10px}',
    '.cp-row{border-top:1px solid var(--line);padding:12px 0}.cp-row:first-of-type{border-top:0}',
    '.cp-row h3{margin:0 0 4px;font-size:.95rem;line-height:1.4}.cp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}',
    '.cp-chip{font-size:.72rem;font-weight:700;border-radius:999px;padding:2px 8px;background:var(--soft);color:var(--ink-2)}',
    '.cp-chip.ph{background:#e8f1ff;color:#1a4d9e}.cp-chip.st{background:var(--okbg);color:#037A4B}',
    '.cp-rule{display:grid;grid-template-columns:1fr;gap:6px;padding:10px 0;border-top:1px solid var(--line)}.cp-rule:first-of-type{border-top:0}',
    '.cp-rule b{font-size:.88rem}.cp-rule span{font-size:.86rem;line-height:1.45;color:var(--ink-2)}',
    '.cp-ppl{display:grid;gap:10px}.cp-p{border-radius:14px;padding:12px 14px;background:var(--soft)}',
    '.cp-p b{font-size:.95rem}.cp-p .cp-m{margin-top:4px}'
  ].join('\n');

  function style() {
    if (document.getElementById('cp-style')) return;
    var s = document.createElement('style');
    s.id = 'cp-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function load() {
    if (data) return Promise.resolve(data);
    return fetch(new URL('data/coop.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('coop'); return r.json(); })
      .then(function (j) { data = j; return j; })
      .catch(function () { return null; });
  }
  function inline(esc, s) {
    return esc(s || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }
  function matchRow(row, needle) {
    if (!needle) return true;
    var blob = [row.work, row.status, row.dept, row.phone, row.who, row.line, row.note].join(' ').toLowerCase();
    return blob.indexOf(needle) >= 0;
  }
  function home(el, api) {
    var esc = api.esc;
    var needle = (q || '').trim().toLowerCase();
    var rows = (data.rows || []).filter(function (r) { return matchRow(r, needle); });
    var top = (data.top5 || []).map(function (t, i) {
      return '<div class="cp-item"><b>' + (i + 1) + '. ' + esc(t.title) + '</b><span>' + inline(esc, t.to) + '</span></div>';
    }).join('');
    var paths = (data.leave_paths || []).map(function (p) {
      return '<div class="cp-path"><b>' + esc(p.item) + '</b><p>' + esc(p.body) + '</p></div>';
    }).join('');
    var rules = (data.rules || []).map(function (r) {
      return '<div class="cp-rule"><b>언제: ' + esc(r.when) + '</b><span>→ ' + esc(r.then) + '</span></div>';
    }).join('');
    var people = (data.people || []).map(function (p) {
      return '<div class="cp-p"><b>' + esc(p.name) + '</b>' +
        (p.listed ? '' : ' <span class="cp-chip">미등재</span>') +
        '<p class="cp-m">' + esc(p.phone_note || '') + '</p>' +
        '<p class="cp-m">주업무: ' + esc(p.job || '') + '</p></div>';
    }).join('');
    var table = rows.map(function (r) {
      return '<article class="cp-row"><h3>' + esc(r.work) + '</h3>' +
        '<div class="cp-chips">' +
        (r.status ? '<span class="cp-chip st">' + esc(r.status) + '</span>' : '') +
        (r.phone ? '<span class="cp-chip ph">' + esc(r.phone) + '</span>' : '') +
        (r.dept ? '<span class="cp-chip">' + esc(r.dept) + '</span>' : '') +
        '</div>' +
        '<p class="cp-m">담당·주업무: ' + esc(r.who || '—') + '</p>' +
        '<p class="cp-m">한 줄: ' + esc(r.line || '—') + '</p>' +
        (r.note && r.note !== '—' ? '<p class="cp-m">비고: ' + esc(r.note) + '</p>' : '') +
        '</article>';
    }).join('');
    el.innerHTML =
      '<div class="cp-head"><h1>협조리스트 (원큐)</h1>' +
      '<p>업무별 협조처 · 휴보강 경로 · 번호부 등재 주업무. 자료 ' + esc(data.version || '') + ' · ' + esc(data.updated || '') + '</p>' +
      '<div class="cp-warn">' + esc(data.notice || '') + '</div></div>' +
      '<section class="cp-card"><h2>오늘 당장 Top5</h2><div class="cp-top">' + top + '</div></section>' +
      '<section class="cp-card"><h2>휴보강 경로</h2>' + paths + '</section>' +
      '<section class="cp-card"><h2>협조 표 <small class="cp-m">' + rows.length + ' / ' + (data.rows || []).length + '건</small></h2>' +
      '<input class="cp-search" id="cp-q" type="search" placeholder="부서·내선·업무 검색" value="' + esc(q) + '" autocomplete="off">' +
      (table || '<p class="cp-m">검색 결과가 없어요.</p>') + '</section>' +
      '<section class="cp-card"><h2>한 줄 규칙</h2>' + rules + '</section>' +
      '<section class="cp-card"><h2>번호부 등재 담당자</h2><div class="cp-ppl">' + people + '</div>' +
      '<p class="cp-m" style="margin-top:10px">출처: ' + esc(data.source || '') + '. 성명은 번호부 등재분만. 저장·공문 발송 없음.</p></section>';
    var inp = el.querySelector('#cp-q');
    if (inp) {
      inp.oninput = function () {
        q = inp.value || '';
        home(el, api);
        var again = el.querySelector('#cp-q');
        if (again) { again.focus(); var v = again.value; again.value = ''; again.value = v; }
      };
    }
  }
  function render(el, api) {
    style();
    if (data) return home(el, api);
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    load().then(function (d) {
      if (!d) {
        el.innerHTML = '<section class="card"><p>⚠ 자료(data/coop.json)를 못 불러왔어요. 새로고침해 주세요.</p></section>';
        return;
      }
      home(el, api);
    });
  }
  if (root.ShellModules) root.ShellModules.coop = { id: 'coop', tab: '협조', render: render };
})(typeof window !== 'undefined' ? window : globalThis);
