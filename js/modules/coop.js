/* 원큐 협조리스트 (#/coop): 구글식 검색 → 키워드 칩 → 협조 결과.
   출처: 조사/261027_유진님업무_협조리스트_v02 · 키워드맵 요지(원본·who_names 깃금지)
   정적 data/coop.json 만. 브라우저 저장소에 쓰지 않음. 공문 발송 UI 없음. 휴대전화(010) 없음. */
(function (root) {
  'use strict';
  var data = null;
  var q = '';
  var active = []; /* keyword ids */
  var moreOpen = false;
  var CSS = [
    '.cp-wrap{max-width:720px;margin:0 auto;padding:8px 4px 40px}',
    '.cp-brand{text-align:center;padding:28px 8px 8px}.cp-brand h1{margin:0;font-size:1.85rem;letter-spacing:-.02em;font-weight:800}',
    '.cp-brand p{margin:8px 0 0;color:var(--muted);font-size:.86rem;line-height:1.45}',
    '.cp-search-box{display:flex;align-items:center;gap:10px;margin:18px 0 10px;padding:14px 18px;border:1px solid var(--line);border-radius:999px;background:var(--card);box-shadow:0 1px 6px rgba(0,0,0,.06)}',
    '.cp-search-box:focus-within{border-color:#4285f4;box-shadow:0 1px 6px rgba(66,133,244,.25)}',
    '.cp-search-box svg{flex:0 0 auto;opacity:.55}',
    '.cp-search{flex:1;border:0;outline:0;background:transparent;font-size:1.05rem;color:var(--ink);min-width:0}',
    '.cp-suggest{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:6px 0 16px;min-height:28px}',
    '.cp-chip{font-size:.8rem;font-weight:700;border-radius:999px;padding:6px 12px;border:1px solid var(--line);background:var(--soft);color:var(--ink-2);cursor:pointer}',
    '.cp-chip.on{background:#e8f1ff;border-color:#8ab4f8;color:#1a4d9e}',
    '.cp-chip.ph{background:#e8f1ff;color:#1a4d9e;cursor:default;border:0;padding:2px 8px;font-size:.72rem}',
    '.cp-chip.st{background:var(--okbg);color:#037A4B;cursor:default;border:0;padding:2px 8px;font-size:.72rem}',
    '.cp-chip.kw{background:#fff7e6;color:#7a4a00;cursor:default;border:0;padding:2px 8px;font-size:.72rem}',
    '.cp-hint{text-align:center;font-size:.8rem;color:var(--muted);margin:0 0 12px;line-height:1.45}',
    '.cp-results{margin-top:4px}',
    '.cp-row{background:var(--card);border-radius:16px;padding:14px 16px;margin:0 0 10px;border:1px solid var(--line)}',
    '.cp-row h3{margin:0 0 6px;font-size:1rem;line-height:1.4}',
    '.cp-meta{display:grid;gap:4px;margin-top:8px}',
    '.cp-meta p{margin:0;font-size:.86rem;line-height:1.45;color:var(--ink-2)}',
    '.cp-meta b{color:var(--ink);font-weight:700}',
    '.cp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}',
    '.cp-empty{text-align:center;padding:28px 12px;color:var(--muted);font-size:.92rem;line-height:1.5}',
    '.cp-more{margin-top:18px}.cp-more summary{cursor:pointer;font-weight:700;font-size:.92rem;padding:10px 4px;color:var(--ink-2)}',
    '.cp-card{background:var(--card);border-radius:16px;padding:14px;margin:10px 0;border:1px solid var(--line)}.cp-card h2{font-size:.98rem;margin:0 0 8px}',
    '.cp-m{font-size:.8rem;color:var(--muted);line-height:1.5;margin:4px 0}',
    '.cp-warn{border-radius:12px;padding:10px 12px;background:var(--warnbg);color:#7a4a00;font-size:.84rem;line-height:1.45;margin:8px 0}',
    '.cp-item{border-radius:12px;padding:10px 12px;background:var(--soft);margin:0 0 6px}.cp-item b{display:block;font-size:.9rem;margin-bottom:2px}.cp-item span{font-size:.84rem;line-height:1.45;color:var(--ink-2)}',
    '.cp-path{border-top:1px solid var(--line);padding:8px 0}.cp-path:first-of-type{border-top:0;padding-top:0}.cp-path b{font-size:.88rem}.cp-path p{margin:4px 0 0;font-size:.84rem;line-height:1.45;color:var(--ink-2)}',
    '.cp-rule{padding:8px 0;border-top:1px solid var(--line)}.cp-rule:first-of-type{border-top:0}.cp-rule b{font-size:.86rem}.cp-rule span{display:block;font-size:.84rem;line-height:1.45;color:var(--ink-2);margin-top:2px}',
    '.cp-p{border-radius:12px;padding:10px 12px;background:var(--soft);margin:0 0 6px}.cp-p b{font-size:.9rem}'
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
  function keywords() {
    return data.keywords || [];
  }
  function kwById(id) {
    for (var i = 0; i < keywords().length; i++) if (keywords()[i].id === id) return keywords()[i];
    return null;
  }
  function toggleKw(id) {
    var i = active.indexOf(id);
    if (i >= 0) active.splice(i, 1);
    else active.push(id);
  }
  function matchingSuggest(needle) {
    var list = keywords();
    if (!needle) return list;
    var n = needle.toLowerCase();
    return list.filter(function (k) {
      if ((k.label || '').toLowerCase().indexOf(n) >= 0) return true;
      return (k.aliases || []).some(function (a) { return String(a).toLowerCase().indexOf(n) >= 0; });
    });
  }
  function rowBlob(row) {
    return [row.work, row.status, row.dept, row.phone, row.who, row.line, row.note, (row.tags || []).join(' '), row.money].join(' ').toLowerCase();
  }
  function matchRow(row, needle) {
    var tags = row.tags || [];
    if (active.length) {
      var hit = active.some(function (id) { return tags.indexOf(id) >= 0; });
      if (!hit) {
        /* also allow alias text match when tags missing */
        hit = active.some(function (id) {
          var k = kwById(id);
          if (!k) return false;
          var b = rowBlob(row);
          if (b.indexOf((k.label || '').toLowerCase()) >= 0) return true;
          return (k.aliases || []).some(function (a) { return b.indexOf(String(a).toLowerCase()) >= 0; });
        });
      }
      if (!hit) return false;
    }
    if (!needle) return true;
    return rowBlob(row).indexOf(needle) >= 0;
  }
  function iconSearch() {
    return '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 14 15.5l.27.28v.79L20 21.5 21.5 20l-6-6zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>';
  }
  function home(el, api) {
    var esc = api.esc;
    var needle = (q || '').trim().toLowerCase();
    var rows = (data.rows || []).filter(function (r) { return matchRow(r, needle); });
    var suggest = matchingSuggest(needle);
    var hasQuery = !!(needle || active.length);

    var chipHtml = suggest.map(function (k) {
      var on = active.indexOf(k.id) >= 0 ? ' on' : '';
      return '<button type="button" class="cp-chip' + on + '" data-kw="' + esc(k.id) + '">' + esc(k.label) + '</button>';
    }).join('');

    var hintBits = active.map(function (id) {
      var k = kwById(id);
      return k ? (k.label + ': ' + (k.hint || '')) : '';
    }).filter(Boolean);
    if (needle && !active.length && suggest.length === 1 && suggest[0].hint) {
      hintBits.push(suggest[0].label + ': ' + suggest[0].hint);
    }

    var results;
    if (!hasQuery) {
      results = '<div class="cp-empty">업무·부서·내선을 검색하거나, 아래 키워드를 눌러 보세요.<br>결과가 부서·내선·일주인·돈처리로 정리됩니다.</div>';
    } else if (!rows.length) {
      results = '<div class="cp-empty">검색 결과가 없어요. 키워드를 바꾸거나 지워 보세요.</div>';
    } else {
      results = rows.map(function (r) {
        var tagChips = (r.tags || []).map(function (id) {
          var k = kwById(id);
          return k ? '<span class="cp-chip kw">' + esc(k.label) + '</span>' : '';
        }).join('');
        return '<article class="cp-row"><h3>' + esc(r.work) + '</h3>' +
          '<div class="cp-chips">' +
          (r.status ? '<span class="cp-chip st">' + esc(r.status) + '</span>' : '') +
          tagChips +
          '</div>' +
          '<div class="cp-meta">' +
          '<p><b>부서</b> ' + esc(r.dept || '—') + '</p>' +
          '<p><b>내선</b> ' + esc(r.phone || '—') + '</p>' +
          '<p><b>일주인</b> ' + esc(r.who || '—') + '</p>' +
          '<p><b>돈처리</b> ' + esc(r.money || '—') + (r.line ? ' · ' + esc(r.line) : '') + '</p>' +
          (r.note && r.note !== '—' ? '<p><b>비고</b> ' + esc(r.note) + '</p>' : '') +
          '</div></article>';
      }).join('');
      results = '<p class="cp-hint">' + rows.length + '건 · 키워드가 검색에 따라붙고, 아래가 협조 리스트예요.</p><div class="cp-results">' + results + '</div>';
    }

    var edu = (data.edu_now || []).map(function (t) {
      return '<div class="cp-item"><b>' + esc(t.title) + '</b><span>' + inline(esc, t.body) + '</span></div>';
    }).join('');
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
        (p.listed ? '' : ' <span class="cp-chip st">미등재</span>') +
        '<p class="cp-m">' + esc(p.phone_note || '') + '</p>' +
        '<p class="cp-m">주업무: ' + esc(p.job || '') + '</p></div>';
    }).join('');

    el.innerHTML =
      '<div class="cp-wrap">' +
      '<div class="cp-brand"><h1>협조 검색</h1>' +
      '<p>자료 ' + esc(data.version || '') + ' · ' + esc(data.updated || '') + ' · 내선만 · 저장·공문 발송 없음</p></div>' +
      '<div class="cp-search-box">' + iconSearch() +
      '<input class="cp-search" id="cp-q" type="search" placeholder="강사료, 휴보강, 재료, 내선…" value="' + esc(q) + '" autocomplete="off" aria-label="협조 검색">' +
      '</div>' +
      '<div class="cp-suggest" id="cp-suggest">' + chipHtml + '</div>' +
      (hintBits.length ? '<p class="cp-hint">' + esc(hintBits.join(' · ')) + '</p>' : '') +
      results +
      '<details class="cp-more" id="cp-more"' + (moreOpen ? ' open' : '') + '>' +
      '<summary>참고 자료 접기/펼치기 (Top5·규칙·번호부·휴보강 경로)</summary>' +
      '<div class="cp-warn">' + esc(data.notice || '') + '</div>' +
      '<section class="cp-card"><h2>교육원에 바로 쓸 것</h2>' + edu + '</section>' +
      '<section class="cp-card"><h2>오늘 당장 Top5</h2>' + top + '</section>' +
      '<section class="cp-card"><h2>휴보강 경로</h2>' + paths + '</section>' +
      '<section class="cp-card"><h2>한 줄 규칙</h2>' + rules + '</section>' +
      '<section class="cp-card"><h2>번호부 등재 담당자</h2>' + people +
      '<p class="cp-m" style="margin-top:10px">출처: ' + esc(data.source || '') + '. 실명상세·who_names는 90_개인정보만.</p></section>' +
      '</details></div>';

    var inp = el.querySelector('#cp-q');
    if (inp) {
      inp.oninput = function () {
        q = inp.value || '';
        home(el, api);
        var again = el.querySelector('#cp-q');
        if (again) { again.focus(); var v = again.value; again.value = ''; again.value = v; }
      };
    }
    var sug = el.querySelector('#cp-suggest');
    if (sug) {
      sug.onclick = function (ev) {
        var t = ev.target;
        if (!t || !t.getAttribute) return;
        var id = t.getAttribute('data-kw');
        if (!id) return;
        toggleKw(id);
        home(el, api);
        var again = el.querySelector('#cp-q');
        if (again) again.focus();
      };
    }
    var det = el.querySelector('#cp-more');
    if (det) {
      det.ontoggle = function () { moreOpen = !!det.open; };
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
