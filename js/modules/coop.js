/* 원큐 협조리스트 (#/coop): 구글형 자연어 검색(중간 위치) → 선택 칩 제안 → 한 장 결과.
   해시태그 입력 강제 없음. 인스타피드·긴 표 나열 금지. who_names·90_개인정보 원본 깃금지. */
(function (root) {
  'use strict';
  var data = null;
  var q = '';
  var active = []; /* {kind,label,q,kw?} */
  var openId = '';
  var moreOpen = false;
  var CSS = [
    '.cp-wrap{max-width:680px;margin:0 auto;padding:0 12px 48px;box-sizing:border-box}',
    '.cp-hero{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - 160px);padding:24px 0 40px;transition:min-height .2s ease}',
    '.cp-hero.is-search{min-height:0;padding:20px 0 8px;justify-content:flex-start}',
    '.cp-logo{font-size:1.75rem;font-weight:800;letter-spacing:-.03em;margin:0 0 22px;text-align:center}',
    '.cp-hero.is-search .cp-logo{font-size:1.15rem;margin:0 0 12px}',
    '.cp-search-box{display:flex;align-items:center;gap:10px;width:100%;max-width:584px;padding:14px 18px;border:1px solid var(--line);border-radius:999px;background:var(--card);box-shadow:0 1px 6px rgba(0,0,0,.08)}',
    '.cp-search-box:focus-within{border-color:#4285f4;box-shadow:0 1px 6px rgba(66,133,244,.28)}',
    '.cp-search-box svg{flex:0 0 auto;opacity:.55}',
    '.cp-search{flex:1;border:0;outline:0;background:transparent;font-size:1.05rem;color:var(--ink);min-width:0}',
    '.cp-active{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;width:100%;max-width:584px;margin:10px 0 0;min-height:0}',
    '.cp-suggest{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:100%;max-width:584px;margin:12px 0 0}',
    '.cp-chip{font-size:.8rem;font-weight:700;border-radius:999px;padding:6px 12px;border:1px solid var(--line);background:var(--soft);color:var(--ink-2);cursor:pointer}',
    '.cp-chip.on{background:#e8f1ff;border-color:#8ab4f8;color:#1a4d9e}',
    '.cp-chip.x{padding-right:8px}',
    '.cp-chip .rm{margin-left:4px;opacity:.7}',
    '.cp-chip.kind-person{background:#f3e8ff;border-color:#d2b4f8;color:#5b2d8e}',
    '.cp-chip.kind-dept{background:#e7f6ef;border-color:#9fd9bd;color:#0d5c3d}',
    '.cp-chip.kind-period{background:#fff4e5;border-color:#f0c48a;color:#7a4a00}',
    '.cp-chip.kind-kw{background:#e8f1ff;border-color:#8ab4f8;color:#1a4d9e}',
    '.cp-shortcuts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:100%;max-width:584px;margin:18px 0 0}',
    '.cp-sc{font-size:.84rem;padding:8px 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);cursor:pointer;color:var(--ink)}',
    '.cp-sc:hover{border-color:#8ab4f8}',
    '.cp-hint{text-align:center;font-size:.8rem;color:var(--muted);margin:10px 0 0;line-height:1.45;max-width:584px}',
    '.cp-results{margin-top:8px}',
    '.cp-one{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:0 0 10px}',
    '.cp-one h3{margin:0 0 8px;font-size:1.02rem;line-height:1.35}',
    '.cp-grid{display:grid;grid-template-columns:4.5rem 1fr;gap:4px 8px;font-size:.88rem;line-height:1.45}',
    '.cp-grid .k{color:var(--muted);font-weight:700}.cp-grid .v{color:var(--ink-2)}',
    '.cp-one details{margin-top:8px}.cp-one summary{cursor:pointer;font-size:.82rem;color:var(--muted);font-weight:700}',
    '.cp-extra{margin-top:6px;font-size:.84rem;line-height:1.45;color:var(--ink-2)}',
    '.cp-empty{text-align:center;padding:16px 8px;color:var(--muted);font-size:.9rem;line-height:1.5}',
    '.cp-more{margin-top:20px}.cp-more summary{cursor:pointer;font-weight:700;font-size:.88rem;padding:8px 4px;color:var(--muted)}',
    '.cp-card{background:var(--card);border-radius:14px;padding:12px;margin:8px 0;border:1px solid var(--line)}.cp-card h2{font-size:.92rem;margin:0 0 6px}',
    '.cp-m{font-size:.78rem;color:var(--muted);line-height:1.45;margin:3px 0}',
    '.cp-warn{border-radius:10px;padding:8px 10px;background:var(--warnbg);color:#7a4a00;font-size:.8rem;line-height:1.4;margin:6px 0}',
    '.cp-item{border-radius:10px;padding:8px 10px;background:var(--soft);margin:0 0 4px}.cp-item b{display:block;font-size:.86rem}.cp-item span{font-size:.8rem;color:var(--ink-2);line-height:1.4}',
    '.cp-path{border-top:1px solid var(--line);padding:6px 0}.cp-path:first-of-type{border-top:0}.cp-path b{font-size:.84rem}.cp-path p{margin:2px 0 0;font-size:.8rem;color:var(--ink-2);line-height:1.4}',
    '.cp-rule{padding:6px 0;border-top:1px solid var(--line)}.cp-rule:first-of-type{border-top:0}.cp-rule b{font-size:.82rem}.cp-rule span{display:block;font-size:.8rem;color:var(--ink-2);margin-top:2px}',
    '.cp-p{border-radius:10px;padding:8px 10px;background:var(--soft);margin:0 0 4px}.cp-p b{font-size:.86rem}'
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
  function iconSearch() {
    return '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 14 15.5l.27.28v.79L20 21.5 21.5 20l-6-6zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>';
  }
  function kwList() { return data.keywords || []; }
  function kwById(id) {
    for (var i = 0; i < kwList().length; i++) if (kwList()[i].id === id) return kwList()[i];
    return null;
  }
  function chipKey(c) { return (c.kind || 'kw') + ':' + (c.label || c.q || ''); }
  function hasChip(c) {
    var k = chipKey(c);
    return active.some(function (a) { return chipKey(a) === k; });
  }
  function toggleChip(c) {
    var k = chipKey(c);
    var i = -1;
    for (var n = 0; n < active.length; n++) if (chipKey(active[n]) === k) { i = n; break; }
    if (i >= 0) active.splice(i, 1);
    else active.push(c);
  }
  function rowBlob(row) {
    return [row.work, row.status, row.dept, row.phone, row.who, row.line, row.note, (row.tags || []).join(' '), row.money].join(' ').toLowerCase();
  }
  function matchRow(row, needle) {
    var b = rowBlob(row);
    if (active.length) {
      var ok = active.every(function (c) {
        var qq = (c.q || c.label || '').toLowerCase();
        if (!qq) return true;
        if (c.kw && (row.tags || []).indexOf(c.kw) >= 0) return true;
        return b.indexOf(qq) >= 0;
      });
      if (!ok) return false;
    }
    if (!needle) return true;
    return b.indexOf(needle) >= 0;
  }
  function approvalLine(row) {
    var blob = [row.who, row.line, row.note, row.dept].join(' ');
    if (/결재|전결|센터장/.test(blob)) return row.line || row.who || '—';
    if (/결의/.test(blob)) return '결의 창구 포함 · ' + (row.phone || '');
    return row.line || '—';
  }
  function buildSuggest(needle) {
    var out = [];
    var n = (needle || '').replace(/^#/, '').toLowerCase();
    function push(c) {
      if (hasChip(c)) return;
      if (n) {
        var lab = (c.label || '').toLowerCase();
        var qq = (c.q || '').toLowerCase();
        if (lab.indexOf(n) < 0 && qq.indexOf(n) < 0) {
          if (c.kind === 'kw') {
            var k = kwById(c.kw);
            var aliases = (k && k.aliases) || [];
            if (!aliases.some(function (a) { return String(a).toLowerCase().indexOf(n) >= 0; })) return;
          } else return;
        }
      }
      out.push(c);
    }
    kwList().forEach(function (k) {
      push({ kind: 'kw', label: '#' + k.label, q: k.label, kw: k.id });
    });
    (data.suggest_people || []).forEach(function (p) {
      push({ kind: 'person', label: '#' + p.label, q: p.q || p.label });
    });
    (data.suggest_depts || []).forEach(function (p) {
      push({ kind: 'dept', label: '#' + p.label, q: p.q || p.label });
    });
    (data.suggest_periods || []).forEach(function (p) {
      push({ kind: 'period', label: '#' + p.label, q: p.q || p.label });
    });
    return out.slice(0, 12);
  }
  function home(el, api) {
    var esc = api.esc;
    var needle = (q || '').trim().toLowerCase();
    var hasQuery = !!(needle || active.length);
    var rows = (data.rows || []).filter(function (r) { return matchRow(r, needle); });
    var suggest = buildSuggest(q || '');
    var shortcuts = data.shortcuts || [];

    var activeHtml = active.map(function (c, i) {
      return '<button type="button" class="cp-chip on x kind-' + esc(c.kind || 'kw') + '" data-rm="' + i + '">' +
        esc(c.label || c.q) + '<span class="rm" aria-hidden="true">×</span></button>';
    }).join('');

    var suggestHtml = suggest.map(function (c) {
      return '<button type="button" class="cp-chip kind-' + esc(c.kind || 'kw') + '" data-add="' + esc(chipKey(c)) + '" data-kind="' + esc(c.kind || 'kw') + '" data-label="' + esc(c.label || '') + '" data-q="' + esc(c.q || '') + '" data-kw="' + esc(c.kw || '') + '">' +
        esc(c.label) + '</button>';
    }).join('');

    var scHtml = shortcuts.map(function (s) {
      return '<button type="button" class="cp-sc" data-sc="' + esc(s.q || s.label) + '" data-kw="' + esc(s.kw || '') + '">' + esc(s.label) + '</button>';
    }).join('');

    var results = '';
    if (!hasQuery) {
      results = '';
    } else if (!rows.length) {
      results = '<div class="cp-empty">맞는 협조가 없어요. 칩을 빼거나 다른 말을 쳐 보세요.</div>';
    } else {
      results = '<p class="cp-hint">' + rows.length + '건 · 한 장에 일주인·내선·돈처리·결재·한줄만</p><div class="cp-results">' +
        rows.map(function (r, idx) {
          var id = 'r' + idx;
          var open = openId === id;
          return '<article class="cp-one"><h3>' + esc(r.work) + '</h3>' +
            '<div class="cp-grid">' +
            '<div class="k">일주인</div><div class="v">' + esc(r.who || '—') + '</div>' +
            '<div class="k">내선</div><div class="v">' + esc(r.phone || '—') + '</div>' +
            '<div class="k">돈처리</div><div class="v">' + esc(r.money || '—') + '</div>' +
            '<div class="k">결재</div><div class="v">' + esc(approvalLine(r)) + '</div>' +
            '<div class="k">한줄</div><div class="v">' + esc(r.line || '—') + '</div>' +
            '</div>' +
            '<details' + (open ? ' open' : '') + ' data-oid="' + id + '"><summary>부서·상태·비고</summary>' +
            '<div class="cp-extra">부서: ' + esc(r.dept || '—') +
            (r.status ? '<br>상태: ' + esc(r.status) : '') +
            (r.note && r.note !== '—' ? '<br>비고: ' + esc(r.note) : '') +
            '</div></details></article>';
        }).join('') + '</div>';
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
        (p.listed ? '' : ' <span class="cp-chip kind-period">미등재</span>') +
        '<p class="cp-m">' + esc(p.phone_note || '') + '</p>' +
        '<p class="cp-m">주업무: ' + esc(p.job || '') + '</p></div>';
    }).join('');

    el.innerHTML =
      '<div class="cp-wrap">' +
      '<div class="cp-hero' + (hasQuery ? ' is-search' : '') + '">' +
      '<h1 class="cp-logo">협조 검색</h1>' +
      '<div class="cp-search-box">' + iconSearch() +
      '<input class="cp-search" id="cp-q" type="search" placeholder="강사료 세금 어디로? 자연어로 검색" value="' + esc(q) + '" autocomplete="off" aria-label="협조 검색">' +
      '</div>' +
      (activeHtml ? '<div class="cp-active" id="cp-active">' + activeHtml + '</div>' : '') +
      (suggestHtml ? '<div class="cp-suggest" id="cp-suggest">' + suggestHtml + '</div>' : '') +
      (!hasQuery ? '<div class="cp-shortcuts" id="cp-sc">' + scHtml + '</div><p class="cp-hint">해시태그는 선택이에요. 쳐 보면 #키워드 #사람 #부서 #기간 칩이 따라붙습니다.</p>' : '') +
      '</div>' +
      results +
      '<details class="cp-more" id="cp-more"' + (moreOpen ? ' open' : '') + '>' +
      '<summary>참고만 펼치기 (Top5·규칙·번호부)</summary>' +
      '<div class="cp-warn">' + esc(data.notice || '') + '</div>' +
      '<section class="cp-card"><h2>교육원에 바로 쓸 것</h2>' + edu + '</section>' +
      '<section class="cp-card"><h2>오늘 당장 Top5</h2>' + top + '</section>' +
      '<section class="cp-card"><h2>휴보강 경로</h2>' + paths + '</section>' +
      '<section class="cp-card"><h2>한 줄 규칙</h2>' + rules + '</section>' +
      '<section class="cp-card"><h2>번호부 등재 담당자</h2>' + people +
      '<p class="cp-m">출처: ' + esc(data.source || '') + '. 실명상세·who_names는 90_개인정보만.</p></section>' +
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
        var t = ev.target.closest('[data-add]');
        if (!t) return;
        toggleChip({ kind: t.getAttribute('data-kind'), label: t.getAttribute('data-label'), q: t.getAttribute('data-q'), kw: t.getAttribute('data-kw') || undefined });
        home(el, api);
        var again = el.querySelector('#cp-q');
        if (again) again.focus();
      };
    }
    var act = el.querySelector('#cp-active');
    if (act) {
      act.onclick = function (ev) {
        var t = ev.target.closest('[data-rm]');
        if (!t) return;
        var i = parseInt(t.getAttribute('data-rm'), 10);
        if (!isNaN(i)) active.splice(i, 1);
        home(el, api);
      };
    }
    var sc = el.querySelector('#cp-sc');
    if (sc) {
      sc.onclick = function (ev) {
        var t = ev.target.closest('[data-sc]');
        if (!t) return;
        var qq = t.getAttribute('data-sc') || '';
        var kw = t.getAttribute('data-kw') || '';
        q = qq;
        active = [];
        if (kw) {
          var k = kwById(kw);
          if (k) active.push({ kind: 'kw', label: '#' + k.label, q: k.label, kw: k.id });
        }
        home(el, api);
        var again = el.querySelector('#cp-q');
        if (again) again.focus();
      };
    }
    el.querySelectorAll('details[data-oid]').forEach(function (d) {
      d.ontoggle = function () {
        if (d.open) openId = d.getAttribute('data-oid') || '';
        else if (openId === d.getAttribute('data-oid')) openId = '';
      };
    });
    var det = el.querySelector('#cp-more');
    if (det) det.ontoggle = function () { moreOpen = !!det.open; };
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
