/* 원큐 협조리스트 (#/coop): 구글형 자연어 검색(중간 위치) → 선택 칩 제안 → 한 장 결과 + 체인 거미줄.
   261029: 부서 거미줄(#/spider) 자료를 여기로 합침(js/coop-graph.js) — 부서·사람 이름으로 찾으면 하는 일·이어진 부서·규정·결재라인,
   일 낱말로 찾으면 누구와 협조·어느 규정. #부서 #사람 칩. (유진님 10.29. 「1번 자료 활용해서 2번에 보충」「1번은 지워」)
   해시태그 입력 강제 없음. 인스타피드·전체그래프·긴 표 나열 금지. who_names·90_개인정보 원본 깃금지. */
(function (root) {
  'use strict';
  var data = null;
  var q = '';
  var active = []; /* {kind,label,q,kw?} */
  var openId = '';
  var moreOpen = false;
  /* 261030 목록 UX(근거: 봇공유/조사/261029_hj-app_목록기능검토_v01 「앞 12건만·정렬 없음」): 결과는 10건씩 「더 보기」, 정렬 고르기.
     찾는 말·칩이 바뀌면 다시 10건부터. 정렬·보이는 개수는 이 화면 안 메모리에만(저장 안 함). */
  var PAGE = 10;
  var SORTS = [['rel', '기본 순서'], ['work', '일 이름 가나다'], ['dept', '부서 가나다'], ['status', '상태별']];
  var sortBy = 'rel';
  var limit = PAGE;
  var listKey = '';
  var graph = null; /* HJCoopGraph.build 결과(거미줄+사람별 하는 일). 못 읽으면 null → 데이터 없음 */
  function G() { return root.HJCoopGraph || null; }
  var CSS = [
    '.cp-wrap{max-width:680px;margin:0 auto;padding:0 0 48px;box-sizing:border-box}',
    '.cp-hero{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - 160px);padding:24px 0 40px;transition:min-height .2s ease}',
    '.cp-hero.is-search{min-height:0;padding:20px 0 8px;justify-content:flex-start}',
    '.cp-logo{font-size:1.75rem;font-weight:800;letter-spacing:-.03em;margin:0 0 22px;text-align:center}',
    '.cp-hero.is-search .cp-logo{font-size:1.15rem;margin:0 0 12px}',
    '.cp-search-box{display:flex;align-items:center;gap:10px;width:100%;max-width:584px;padding:14px 18px;border:1px solid var(--line);border-radius:999px;background:var(--card);box-shadow:0 1px 6px rgba(0,0,0,.08)}',
    '.cp-search-box:focus-within{border-color:var(--navy);box-shadow:0 2px 8px rgba(27,100,218,.16)}',
    '.cp-search-box svg{flex:0 0 auto;opacity:.55}',
    '.cp-search{flex:1;border:0;outline:0;background:transparent;font-size:1.05rem;color:var(--ink);min-width:0}',
    '.cp-active{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;width:100%;max-width:584px;margin:10px 0 0;min-height:0}',
    '.cp-suggest{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:100%;max-width:584px;margin:12px 0 0}',
    '.cp-chip{font-size:.8rem;font-weight:700;border-radius:999px;padding:6px 12px;border:1px solid var(--line);background:var(--soft);color:var(--ink-2);cursor:pointer}',
    '.cp-chip.on{background:var(--accent-soft,#EAF1FC);border-color:var(--accent,#1B64DA);color:var(--accent,#1B64DA)}',
    '.cp-chip.x{padding-right:8px}',
    '.cp-chip .rm{margin-left:4px;opacity:.7}',
    '.cp-chip.kind-person{background:#fff;border-color:var(--g-300,#D1D6DB);color:var(--ink-2)}',
    '.cp-chip.kind-dept{background:var(--g-100,#F2F4F6);border-color:var(--g-200,#E5E8EB);color:var(--ink-2)}',
    '.cp-chip.kind-period{background:#fff;border-color:var(--g-300,#D1D6DB);border-style:dashed;color:var(--ink-2)}',
    '.cp-chip.kind-kw{background:var(--accent-soft,#EAF1FC);border-color:#B9CFF3;color:var(--accent,#1B64DA)}',
    '.cp-shortcuts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:100%;max-width:584px;margin:18px 0 0}',
    '.cp-sc{font-size:.84rem;padding:8px 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);cursor:pointer;color:var(--ink)}',
    '.cp-sc:hover{border-color:var(--navy)}',
    '.cp-hint{text-align:center;font-size:.84rem;color:var(--muted);margin:10px 0 0;line-height:1.45;max-width:584px}',
    '.cp-results{margin-top:8px}',
    '.cp-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px;margin-top:10px}.cp-bar .cp-hint{margin:0;text-align:left;flex:1 1 180px}',
    '.cp-sort{display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--muted);font-weight:700}',
    '.cp-sort select{width:auto;margin:0;min-height:44px;border:1px solid var(--line);border-radius:10px;padding:6px 8px;background:var(--card);font-size:.84rem;color:var(--ink-2);max-width:100%}',
    '.cp-morebtn{display:block;width:100%;min-height:44px;margin:4px 0 10px;border:1px solid var(--line);border-radius:12px;background:var(--card);font-size:.88rem;font-weight:700;color:var(--navy);cursor:pointer}',
    '.cp-morebtn small{font-weight:600;color:var(--muted)}.cp-morebtn.ghost{color:var(--muted)}',
    '.cp-one:focus{outline:2px solid var(--navy);outline-offset:2px}',
    '.cp-one{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:0 0 10px}',
    '.cp-one h3{margin:0 0 8px;font-size:1.02rem;line-height:1.35}',
    '.cp-grid{display:grid;grid-template-columns:4.5rem 1fr;gap:4px 8px;font-size:.88rem;line-height:1.45}',
    '.cp-grid .k{color:var(--muted);font-weight:700}.cp-grid .v{color:var(--ink-2)}',
    '.cp-one details{margin-top:8px}.cp-one summary{cursor:pointer;font-size:.82rem;color:var(--muted);font-weight:700}',
    '.cp-extra{margin-top:6px;font-size:.84rem;line-height:1.45;color:var(--ink-2)}',
    '.cp-empty{text-align:center;padding:16px 8px;color:var(--muted);font-size:.9rem;line-height:1.5}',
    '.cp-more{margin-top:20px}.cp-more summary{cursor:pointer;font-weight:700;font-size:.88rem;padding:8px 4px;color:var(--muted)}',
    '.cp-card{background:var(--card);border-radius:14px;padding:12px;margin:8px 0;border:1px solid var(--line)}.cp-card h2{font-size:.92rem;margin:0 0 6px}',
    '.cp-m{font-size:.82rem;color:var(--muted);line-height:1.45;margin:3px 0}',
    '.cp-warn{border-radius:10px;padding:8px 10px;background:var(--warnbg);color:#7a4a00;font-size:.8rem;line-height:1.4;margin:6px 0}',
    '.cp-item{border-radius:10px;padding:8px 10px;background:var(--soft);margin:0 0 4px}.cp-item b{display:block;font-size:.86rem}.cp-item span{font-size:.8rem;color:var(--ink-2);line-height:1.4}',
    '.cp-path{border-top:1px solid var(--line);padding:6px 0}.cp-path:first-of-type{border-top:0}.cp-path b{font-size:.84rem}.cp-path p{margin:2px 0 0;font-size:.8rem;color:var(--ink-2);line-height:1.4}',
    '.cp-rule{padding:6px 0;border-top:1px solid var(--line)}.cp-rule:first-of-type{border-top:0}.cp-rule b{font-size:.82rem}.cp-rule span{display:block;font-size:.8rem;color:var(--ink-2);margin-top:2px}',
    '.cp-p{border-radius:10px;padding:8px 10px;background:var(--soft);margin:0 0 4px}.cp-p b{font-size:.86rem}',
    '.cp-chain{margin:12px 0 4px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}',
    '.cp-chain-title{font-size:.78rem;font-weight:700;color:var(--muted);margin:0 0 8px}',
    '.cp-chain-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
    '.cp-node{font-size:.82rem;font-weight:700;border-radius:999px;padding:7px 12px;border:1px solid var(--g-300,#D1D6DB);background:#fff;color:var(--ink-2);cursor:pointer}',
    '.cp-node .ext{font-weight:600;opacity:.75;margin-left:4px;font-size:.76rem}',
    '.cp-arrow{color:var(--muted);font-weight:700;font-size:.9rem;padding:0 2px}',
    '.cp-chain-note{font-size:.76rem;color:var(--muted);margin:6px 0 0;line-height:1.35}'
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
  /* 결과 목록 정렬(순수 함수, 시험용으로 _list 에 내보냄). 원래 자리(i)는 펼침 상태 열쇠로 씀. 같은 값이면 원래 순서 */
  function sortRows(list, by) {
    var key = { work: 'work', dept: 'dept', status: 'status' }[by];
    var out = list.slice();
    if (!key) return out;
    out.sort(function (a, b) {
      var x = String(a.r[key] || '').trim(), y = String(b.r[key] || '').trim();
      if (!x !== !y) return x ? -1 : 1; /* 빈칸은 맨 뒤 */
      return x.localeCompare(y, 'ko') || a.i - b.i;
    });
    return out;
  }
  function pageOf(total, lim) {
    var shown = Math.min(total, Math.max(PAGE, lim || PAGE));
    return { shown: shown, rest: total - shown, next: Math.min(PAGE, total - shown) };
  }
  function chainList() { return (data && data.chains) || []; }
  function matchChains(needle, chips) {
    var n = (needle || '').trim().toLowerCase();
    var chipQs = (chips || []).map(function (c) { return (c.q || c.label || '').toLowerCase().replace(/^#/, ''); });
    var out = [];
    chainList().forEach(function (ch) {
      var hit = false;
      var kws = ch.keywords || [];
      var nodes = ch.nodes || [];
      for (var i = 0; i < kws.length; i++) {
        var kw = String(kws[i] || '').toLowerCase();
        if (!kw) continue;
        if (n && n.indexOf(kw) >= 0) { hit = true; break; }
        if (chipQs.some(function (cq) { return cq && (cq.indexOf(kw) >= 0 || kw.indexOf(cq) >= 0); })) { hit = true; break; }
      }
      if (!hit) {
        for (var j = 0; j < nodes.length; j++) {
          var nm = String((nodes[j] && nodes[j].name) || '').toLowerCase();
          if (!nm) continue;
          if (n && n.indexOf(nm) >= 0) { hit = true; break; }
          if (chipQs.some(function (cq) { return cq && cq.indexOf(nm) >= 0; })) { hit = true; break; }
        }
      }
      if (hit) out.push(ch);
    });
    return out;
  }

  function isLeaveQuery(needle, chips) {
    var blob = String(needle || '').toLowerCase();
    (chips || []).forEach(function (c) {
      blob += ' ' + String(c.q || c.label || c.kw || '').toLowerCase();
    });
    return /휴보강|휴강|보강|leave/.test(blob);
  }
  function prepareChainsForRender(chains, needle, chips) {
    var leaveQ = isLeaveQuery(needle, chips);
    return (chains || []).map(function (ch) {
      var nodes = (ch.nodes || []).map(function (n) {
        var o = {};
        for (var k in n) if (Object.prototype.hasOwnProperty.call(n, k)) o[k] = n[k];
        if (leaveQ && o && (o.name === '한혜연' || String(o.ext || '') === '7333')) {
          o.demote = true;
          o.optional = true;
        }
        return o;
      });
      return { id: ch.id, label: ch.label, keywords: ch.keywords, nodes: nodes };
    });
  }

  function renderChainBlock(esc, chains) {
    if (!chains || !chains.length) return '';
    return chains.map(function (ch) {
      var all = (ch.nodes || []).filter(function (n) { return n && n.name; });
      var nodes = all.filter(function (n) { return !n.optional && !n.demote; });
      if (!nodes.length) nodes = all.filter(function (n) { return !n.demote; });
      if (!nodes.length) nodes = all;
      var demoted = all.filter(function (n) { return n.demote; });
      var row = nodes.map(function (n, i) {
        var btn = '<button type="button" class="cp-node" data-chain-q="' + esc(n.name) + '">' +
          esc(n.name) + (n.ext ? '<span class="ext">' + esc(n.ext) + '</span>' : '') + '</button>';
        return (i ? '<span class="cp-arrow" aria-hidden="true">→</span>' : '') + btn;
      }).join('');
      var note = '';
      if (demoted.length) {
        note = '<p class="cp-chain-note">참고(담당아님): ' + demoted.map(function (n) {
          return esc(n.name) + (n.ext ? ' ' + esc(n.ext) : '');
        }).join(' · ') + '</p>';
      }
      return '<div class="cp-chain" data-chain="' + esc(ch.id || '') + '">' +
        '<p class="cp-chain-title">거미줄 · ' + esc(ch.label || ch.id || '흐름') + '</p>' +
        '<div class="cp-chain-row">' + row + '</div>' + note + '</div>';
    }).join('');
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
    var leaveQ = isLeaveQuery(n, active);
    (data.suggest_people || []).forEach(function (p) {
      var lab = p.label || p.q || '';
      if (leaveQ && (lab === '한혜연' || String(p.q || '') === '한혜연')) return;
      push({ kind: 'person', label: '#' + p.label, q: p.q || p.label });
    });
    (data.suggest_depts || []).forEach(function (p) {
      push({ kind: 'dept', label: '#' + p.label, q: p.q || p.label });
    });
    (data.suggest_periods || []).forEach(function (p) {
      push({ kind: 'period', label: '#' + p.label, q: p.q || p.label });
    });
    /* 거미줄 부서·사람(#부서 #사람): 칠 때만 */
    if (n && G()) {
      var seen = {};
      out.forEach(function (c) { seen[c.label] = 1; });
      G().suggest(graph, n, 6).forEach(function (c) { if (!seen[c.label] && !hasChip(c)) { seen[c.label] = 1; out.unshift(c); } });
    }
    return out.slice(0, 12);
  }
  function home(el, api) {
    var esc = api.esc;
    var needle = (q || '').trim().toLowerCase();
    var hasQuery = !!(needle || active.length);
    var rows = (data.rows || []).map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return matchRow(x.r, needle); });
    var key = needle + '|' + active.map(chipKey).join(',');
    if (key !== listKey) { listKey = key; limit = PAGE; }
    rows = sortRows(rows, sortBy);
    var pg = pageOf(rows.length, limit);
    var cg = G();
    var graphHtml = hasQuery && cg ? cg.html(graph, cg.search(graph, needle, active)) : '';
    var graphNone = hasQuery && (!cg || !graph || (!graph.hasSpider && !graph.hasPeople)) ? '<p class="cp-hint">부서·사람 자료: 데이터 없음</p>' : '';
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
      results = graphHtml ? '' : '<div class="cp-empty">맞는 협조가 없어요. 칩을 빼거나 다른 말을 쳐 보세요.</div>';
    } else {
      var sortHtml = rows.length > 1 ? '<label class="cp-sort"><span>정렬</span><select id="cp-sort" aria-label="결과 정렬">' +
        SORTS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sortBy ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' : '';
      results = '<div class="cp-bar"><p class="cp-hint" id="cp-count">' + rows.length + '건' + (pg.rest > 0 ? ' 중 ' + pg.shown + '건 보기' : '') + ' · 한 장에 일주인·내선·돈처리·결재·한줄만</p>' + sortHtml + '</div><div class="cp-results" id="cp-results">' +
        rows.slice(0, pg.shown).map(function (x, n) {
          var r = x.r;
          var id = 'r' + x.i;
          var open = openId === id;
          return '<article class="cp-one" tabindex="-1" data-n="' + n + '"><h3>' + esc(r.work) + '</h3>' +
            '<div class="cp-grid">' +
            '<div class="k">일주인</div><div class="v">' + esc(r.who || '—') + '</div>' +
            '<div class="k">내선</div><div class="v">' + esc(r.phone || '—') + '</div>' +
            '<div class="k">돈처리</div><div class="v">' + esc(r.money || '—') + '</div>' +
            '<div class="k">결재</div><div class="v">' + esc(approvalLine(r)) + '</div>' +
            '<div class="k">한줄</div><div class="v">' + esc(r.line || '—') + '</div>' +
            (cg && graph ? '<div class="k">규정</div><div class="v">' + esc(cg.regsFor(graph, [r.work, (r.tags || []).join(' '), r.line, r.note].join(' ')).join(' · ') || '—') + '</div>' : '') +
            '</div>' +
            '<details' + (open ? ' open' : '') + ' data-oid="' + id + '"><summary>부서·상태·비고</summary>' +
            '<div class="cp-extra">부서: ' + esc(r.dept || '—') +
            (r.status ? '<br>상태: ' + esc(r.status) : '') +
            (r.note && r.note !== '—' ? '<br>비고: ' + esc(r.note) : '') +
            '</div></details></article>';
        }).join('') + '</div>' +
        (pg.rest > 0 ? '<button type="button" class="cp-morebtn" id="cp-morebtn" aria-controls="cp-results">' + pg.next + '건 더 보기 <small>(남은 ' + pg.rest + '건)</small></button>'
          : (rows.length > PAGE ? '<button type="button" class="cp-morebtn ghost" id="cp-lessbtn" aria-controls="cp-results">처음 ' + PAGE + '건만 보기</button>' : ''));
    }

    results = graphNone + graphHtml + results;
    var chainHtml = hasQuery ? renderChainBlock(esc, prepareChainsForRender(matchChains(needle, active), needle, active)) : '';
    if (chainHtml && results) results = results + chainHtml;
    else if (chainHtml) results = chainHtml;

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
      (!hasQuery ? '<div class="cp-shortcuts" id="cp-sc">' + scHtml + '</div><p class="cp-hint">해시태그는 선택이에요. 쳐 보면 #키워드 #사람 #부서 #기간 칩이 따라붙습니다. 부서·사람 이름을 치면 하는 일·이어진 부서·규정이 나와요.</p>' : '') +
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
    el.querySelectorAll('[data-cg-q]').forEach(function (btn) {
      btn.onclick = function () {
        var name = btn.getAttribute('data-cg-q') || '';
        if (!name) return;
        q = '';
        active = [{ kind: btn.getAttribute('data-cg-kind') === 'person' ? 'person' : 'dept', label: '#' + name, q: name }];
        home(el, api);
        el.scrollIntoView && el.scrollIntoView({ block: 'start' });
      };
    });
    el.querySelectorAll('[data-chain-q]').forEach(function (btn) {
      btn.onclick = function () {
        var qq = btn.getAttribute('data-chain-q') || '';
        if (!qq) return;
        q = qq;
        active = [];
        home(el, api);
        var again = el.querySelector('#cp-q');
        if (again) again.focus();
      };
    });
    var so = el.querySelector('#cp-sort');
    if (so) so.onchange = function () { sortBy = so.value; limit = PAGE; home(el, api); var again = el.querySelector('#cp-sort'); if (again) again.focus(); };
    var mb = el.querySelector('#cp-morebtn');
    if (mb) mb.onclick = function () {
      var from = Math.max(PAGE, limit);
      limit = from + PAGE;
      home(el, api);
      var first = el.querySelector('.cp-one[data-n="' + from + '"]'); /* 새로 나온 첫 장으로 초점(화면은 그대로) */
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
    };
    var lb = el.querySelector('#cp-lessbtn');
    if (lb) lb.onclick = function () {
      limit = PAGE;
      home(el, api);
      var bar = el.querySelector('#cp-count');
      if (bar && bar.scrollIntoView) bar.scrollIntoView({ block: 'nearest' });
    };
    var det = el.querySelector('#cp-more');
    if (det) det.ontoggle = function () { moreOpen = !!det.open; };
  }
  function render(el, api) {
    style();
    if (G()) G().style();
    if (data) return home(el, api);
    el.innerHTML = '<section class="card sk" aria-busy="true"><p class="muted">불러오는 중…</p><i></i><i></i><i></i></section>';
    Promise.all([load(), G() ? G().load().catch(function () { return null; }) : null]).then(function (got) {
      var d = got[0];
      graph = got[1];
      if (!d) {
        el.innerHTML = '<section class="card"><p>⚠ 자료(data/coop.json)를 못 불러왔어요. 새로고침해 주세요.</p></section>';
        return;
      }
      home(el, api);
    });
  }
  if (root.ShellModules) root.ShellModules.coop = { id: 'coop', tab: '협조', render: render,
    _list: { PAGE: PAGE, SORTS: SORTS, sortRows: sortRows, pageOf: pageOf } /* 시험용 */ };
})(typeof window !== 'undefined' ? window : globalThis);
