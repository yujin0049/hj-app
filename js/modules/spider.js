/* 부서 유기연결 거미줄 (#/spider): 역할판28 · 허브 · 놓친연결 · 규정TOP · 그래프.
   data/dept_spider.json. rank=null 유지, rank_inferred만 표시. who_names·절대경로 금지. */
(function (root) {
  'use strict';
  var data = null;
  var tab = 'role'; /* role | hub | missed | reg | graph */
  var q = '';
  var campus = 'all';
  var graphReady = false;
  var graphNet = null;
  var activeKind = 'all';
  var activeDept = '';

  var COLORS = {
    dept: '#5b9fd4',
    person: '#e07a5f',
    reg: '#c9a227',
    content: '#7dcea0'
  };
  var EDGE_COLORS = {
    '발신→수신': '#5b9fd4',
    'title-협조': '#9b7ed9',
    'dept-reg': '#c9a227',
    'content-dept': '#7dcea0',
    '결재라인': '#e07a5f',
    'person-dept': '#e07a5f',
    'word-제목부서': '#4fb3bf',
    'word-업무추정': '#b0b8c4',
    'person-협조': '#d98fb0'
  };
  function openPerson(name) {
    if (root.HJPeopleRoles && name) root.HJPeopleRoles.open(name);
  }
  var HUB_HINT = ['행정지원과', '대학운영실', '글로컬대학사업센터', '글로컬국제협력센터', '경남항공교육원', 'RISE본부'];

  var CSS = [
    '.sp-wrap{max-width:720px;margin:0 auto;padding:0 12px 48px;box-sizing:border-box}',
    '.sp-head{margin:8px 0 12px}.sp-head h1{margin:0;font-size:1.2rem;font-weight:800;letter-spacing:-.02em}',
    '.sp-head p{margin:4px 0 0;font-size:.82rem;color:var(--muted);line-height:1.45}',
    '.sp-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}',
    '.sp-tab{font-size:.8rem;font-weight:700;border-radius:999px;padding:7px 12px;border:1px solid var(--line);background:var(--soft);color:var(--ink-2);cursor:pointer}',
    '.sp-tab.on{background:#e8f1ff;border-color:#8ab4f8;color:#1a4d9e}',
    '.sp-tools{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px;align-items:center}',
    '.sp-tools input,.sp-tools select{flex:1;min-width:120px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);font-size:.9rem;color:var(--ink)}',
    '.sp-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:0 0 8px}',
    '.sp-card h3{margin:0 0 4px;font-size:.98rem;line-height:1.35}',
    '.sp-meta{font-size:.78rem;color:var(--muted);line-height:1.4;margin:2px 0}',
    '.sp-role{font-size:.86rem;color:var(--ink-2);line-height:1.45;margin:6px 0 0}',
    '.sp-badge{display:inline-block;font-size:.7rem;font-weight:700;border-radius:999px;padding:2px 8px;margin-right:4px;background:var(--soft);color:var(--ink-2)}',
    '.sp-badge.miss{background:#fff0f0;color:#a33}',
    '.sp-badge.hub{background:#e8f1ff;color:#1a4d9e}',
    '.sp-badge.inf{background:#fff4e5;color:#7a4a00}',
    '.sp-row{display:flex;justify-content:space-between;gap:8px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line)}',
    '.sp-row:first-child{border-top:0}',
    '.sp-row b{font-size:.9rem}.sp-row .n{font-size:.84rem;font-weight:700;color:#1a4d9e;white-space:nowrap}',
    '.sp-empty{text-align:center;padding:20px 8px;color:var(--muted);font-size:.9rem}',
    '.sp-miss{margin-top:6px;font-size:.82rem;line-height:1.45;color:#a33}',
    '.sp-src{margin-top:4px;font-size:.72rem;color:var(--muted);line-height:1.35}',
    '.sp-net{height:min(62vh,520px);border:1px solid var(--line);border-radius:14px;background:#0f1419;margin:8px 0}',
    '.sp-legend{display:flex;flex-wrap:wrap;gap:8px;font-size:.72rem;color:var(--muted);margin:4px 0 8px}',
    '.sp-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}',
    '.sp-info{font-size:.8rem;line-height:1.45;color:var(--ink-2);background:var(--soft);border-radius:10px;padding:8px 10px;margin:6px 0;display:none}',
    '.sp-info .t{font-weight:700;color:var(--ink);margin-bottom:2px}',
    '.sp-kind{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 8px}',
    '.sp-kind button{font-size:.72rem;padding:5px 9px;border-radius:999px;border:1px solid var(--line);background:var(--card);cursor:pointer;color:var(--ink-2)}',
    '.sp-kind button.on{background:#1a2332;color:#e7ecf3;border-color:#1a2332}',
    '.sp-pname{font:inherit;font-size:.9rem;font-weight:700;border:0;background:transparent;padding:0;color:#b4532f;cursor:pointer;text-decoration:underline dotted}',
    '.sp-info .sp-pname{font-size:.8rem}',
    '.sp-note{font-size:.76rem;color:var(--muted);line-height:1.4;margin:8px 0 0}'
  ].join('\n');

  function style() {
    if (document.getElementById('sp-style')) return;
    var s = document.createElement('style');
    s.id = 'sp-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function load() {
    if (data) return Promise.resolve(data);
    return fetch(new URL('data/dept_spider.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('spider'); return r.json(); })
      .then(function (j) { data = j; return j; })
      .catch(function () { return null; });
  }
  function esc(api, s) { return api.esc(s == null ? '' : String(s)); }
  function fmtN(n) {
    n = Number(n) || 0;
    return n.toLocaleString('ko-KR');
  }
  function isHub(name) {
    return HUB_HINT.indexOf(name) >= 0;
  }
  function board() { return (data && data.dept_role_board) || []; }
  function meta() { return (data && data.meta) || {}; }

  function filterBoard() {
    var needle = (q || '').trim().toLowerCase();
    return board().filter(function (r) {
      if (campus !== 'all' && (r.campus || '') !== campus) return false;
      if (!needle) return true;
      var blob = [r.dept, r.campus, r.role_summary, (r.missed_links || []).join(' ')].join(' ').toLowerCase();
      return blob.indexOf(needle) >= 0;
    }).slice().sort(function (a, b) { return (b.doc_n || 0) - (a.doc_n || 0); });
  }

  function renderRole(api) {
    var rows = filterBoard();
    var campuses = {};
    board().forEach(function (r) { if (r.campus) campuses[r.campus] = 1; });
    var opts = Object.keys(campuses).sort();
    var h = '<div class="sp-tools">' +
      '<input id="sp-q" type="search" placeholder="부서·역할 검색" value="' + esc(api, q) + '" autocomplete="off">' +
      '<select id="sp-campus"><option value="all"' + (campus === 'all' ? ' selected' : '') + '>캠퍼스 전체</option>';
    opts.forEach(function (c) {
      h += '<option value="' + esc(api, c) + '"' + (campus === c ? ' selected' : '') + '>' + esc(api, c) + '</option>';
    });
    h += '</select></div>';
    h += '<p class="sp-meta">부서 역할판 ' + rows.length + ' / ' + board().length + ' · 대장 건수 많은 순</p>';
    if (!rows.length) {
      h += '<div class="sp-empty">검색 결과가 없어요.</div>';
      return h;
    }
    rows.forEach(function (r) {
      var badges = '';
      if (r.campus) badges += '<span class="sp-badge">' + esc(api, r.campus) + '</span>';
      if (isHub(r.dept)) badges += '<span class="sp-badge hub">허브</span>';
      if (r.inferred) badges += '<span class="sp-badge inf">inferred</span>';
      if ((r.missed_links || []).length) badges += '<span class="sp-badge miss">놓친연결 ' + r.missed_links.length + '</span>';
      h += '<article class="sp-card">' +
        '<h3>' + esc(api, r.dept) + ' <span class="sp-meta">· ' + fmtN(r.doc_n) + '건</span></h3>' +
        '<div>' + badges + '</div>' +
        '<p class="sp-role">' + esc(api, r.role_summary || '—') + '</p>' +
        '<p class="sp-meta">발신 ' + fmtN(r.send_out) + ' · 수신 ' + fmtN(r.recv_in) +
        (r.link_n != null ? ' · 연결부서 ' + fmtN(r.link_n) + ' (근거 ' + fmtN(r.link_ev) + (r.link_est ? ' · 추정 ' + fmtN(r.link_est) : '') + ')' : '') + '</p>';
      if ((r.missed_links || []).length) {
        h += '<p class="sp-miss">놓친연결: ' + r.missed_links.map(function (x) { return esc(api, x); }).join(' · ') + '</p>';
      }
      if ((r.duty_sources || []).length) {
        h += '<p class="sp-src">근거: ' + r.duty_sources.map(function (x) { return esc(api, x); }).join(' · ') + '</p>';
      }
      h += '</article>';
    });
    return h;
  }

  function renderHub(api) {
    var tops = (meta().top_발신수신 || []).slice(0, 15);
    var hubs = board().slice().sort(function (a, b) { return (b.doc_n || 0) - (a.doc_n || 0); })
      .filter(function (r) { return isHub(r.dept) || (r.doc_n || 0) >= 1500; })
      .slice(0, 10);
    var h = '<p class="sp-meta">문서 건수·발신수신 축으로 본 허브. 행정지원과·대학운영실·글로컬·교육원·RISE가 중심.</p>';
    h += '<div class="sp-card"><h3>허브 부서</h3>';
    hubs.forEach(function (r) {
      h += '<div class="sp-row"><div><b>' + esc(api, r.dept) + '</b>' +
        (isHub(r.dept) ? ' <span class="sp-badge hub">허브</span>' : '') +
        '<div class="sp-meta">' + esc(api, r.role_summary || '') + '</div></div>' +
        '<span class="n">' + fmtN(r.doc_n) + '</span></div>';
    });
    h += '</div>';
    h += '<div class="sp-card"><h3>TOP 발신→수신</h3>';
    tops.forEach(function (t) {
      h += '<div class="sp-row"><div><b>' + esc(api, t.from) + ' → ' + esc(api, t.to) + '</b></div>' +
        '<span class="n">' + fmtN(t.weight) + '</span></div>';
    });
    h += '</div>';
    return h;
  }

  function renderMissed(api) {
    var map = (data && data.missed_links) || {};
    var keys = Object.keys(map).filter(function (k) {
      var m = map[k] || {};
      return (m.missing && m.missing.length) || (m.weak && m.weak.length);
    });
    var h = '<p class="sp-meta">역할상 기대되지만 문서대장 연결이 약한 축. 확정 누락이 아니라 후보.</p>';
    if (!keys.length) {
      h += '<div class="sp-empty">표시할 놓친연결이 없어요.</div>';
      return h;
    }
    keys.forEach(function (k) {
      var m = map[k];
      h += '<article class="sp-card"><h3>' + esc(api, k) + '</h3>';
      if ((m.missing || []).length) {
        h += '<p class="sp-miss">기대 연결: ' + m.missing.map(function (x) { return esc(api, x); }).join(' · ') + '</p>';
      }
      if ((m.weak || []).length) {
        h += '<p class="sp-meta">약한 축: ' + m.weak.map(function (x) { return esc(api, x); }).join(' · ') + '</p>';
      }
      var role = board().find(function (r) { return r.dept === k; });
      if (role && role.role_summary) h += '<p class="sp-role">' + esc(api, role.role_summary) + '</p>';
      h += '</article>';
    });
    /* also list role-board missed */
    var fromBoard = board().filter(function (r) { return (r.missed_links || []).length; });
    if (fromBoard.length) {
      h += '<div class="sp-card"><h3>역할판 기준</h3>';
      fromBoard.forEach(function (r) {
        h += '<div class="sp-row"><div><b>' + esc(api, r.dept) + '</b><div class="sp-meta">' +
          r.missed_links.map(function (x) { return esc(api, x); }).join(' · ') + '</div></div></div>';
      });
      h += '</div>';
    }
    return h;
  }

  function renderReg(api) {
    var tops = meta().top_규정 || [];
    var cat = (data && data.reg_catalog) || [];
    var h = '<p class="sp-meta">제목 키워드 매칭 기준. 관련란·본문 전수 아님.</p>';
    h += '<div class="sp-card"><h3>규정 TOP</h3>';
    tops.forEach(function (t) {
      h += '<div class="sp-row"><div><b>' + esc(api, t.label) + '</b>' +
        (t.reg_id ? '<div class="sp-meta">' + esc(api, t.reg_id) + '</div>' : '') +
        '</div><span class="n">' + fmtN(t.weight) + '</span></div>';
    });
    h += '</div>';
    if (cat.length) {
      h += '<div class="sp-card"><h3>규정 목록</h3>';
      cat.forEach(function (r) {
        h += '<div class="sp-row"><div><b>' + esc(api, r.label) + '</b>' +
          (r.file ? '<div class="sp-meta">' + esc(api, r.file) + '</div>' : '') +
          ((r.kws || []).length ? '<div class="sp-meta">키워드: ' + r.kws.map(function (k) { return esc(api, k); }).join(' · ') + '</div>' : '') +
          '</div></div>';
      });
      h += '</div>';
    }
    var rim = (data && data.rank_inferred_map) || {};
    var rkeys = Object.keys(rim);
    if (rkeys.length) {
      h += '<div class="sp-card"><h3>rank_inferred (원본 rank=null)</h3>' +
        '<p class="sp-note">문서대장에 직급 컬럼 없음. 근거·confidence 있는 추정만.</p>';
      rkeys.forEach(function (name) {
        var info = rim[name] || {};
        var label = typeof info === 'string' ? info : (info.rank_inferred || info.title || info.rank || '');
        var conf = typeof info === 'object' ? (info.rank_confidence || info.confidence || '') : '';
        var ev = typeof info === 'object' ? (info.rank_evidence || info.evidence || '') : '';
        if (!label) return;
        h += '<div class="sp-row"><div><button type="button" class="sp-pname" data-person="' + esc(api, name) + '">' + esc(api, name) + '</button>' +
          '<div class="sp-meta">' + esc(api, label) +
          (conf ? ' · ' + esc(api, conf) : '') +
          (ev ? ' · ' + esc(api, ev) : '') +
          '</div></div></div>';
      });
      h += '</div>';
    }
    return h;
  }

  function toVisNode(n) {
    var color = COLORS[n.type] || '#8b9bb4';
    var title = (n.type || '') + ' | ' + (n.label || n.id);
    if (n.type === 'dept' && n.role_summary) title += ' | ' + n.role_summary;
    if (n.type === 'person') {
      title += ' | rank=null';
      if (n.rank_inferred) title += ' | rank_inferred=' + n.rank_inferred +
        (n.rank_confidence ? ' [' + n.rank_confidence + ']' : '');
    }
    if (n.type === 'reg' && n.file) title += ' | ' + n.file;
    var value = n.value || Math.max(8, Math.min(40, Math.round(Math.sqrt(n.strength || 1) * 2)));
    return {
      id: n.id,
      label: n.label || n.id,
      group: n.type,
      value: value,
      title: title,
      color: color,
      font: { color: '#e7ecf3', size: n.type === 'dept' ? 14 : 12 }
    };
  }
  function toVisEdge(e) {
    var w = e.weight || 1;
    var width = Math.max(1, Math.min(8, Math.round(Math.log10(w + 1) * 3)));
    var col = EDGE_COLORS[e.kind] || '#8b9bb4';
    return {
      from: e.from,
      to: e.to,
      kind: e.kind,
      weight: w,
      directed: !!e.directed,
      width: width,
      color: { color: col, opacity: 0.55 },
      dashes: !!e.est,
      title: (e.kind || '') + ' · ' + w + (e.est ? ' · 추정' : '') + ((e.samples || []).length ? ' · ' + e.samples.slice(0, 3).join(', ') : ''),
      from_rank_inferred: e.from_rank_inferred || null,
      to_rank_inferred: e.to_rank_inferred || null
    };
  }

  function ensureVis() {
    if (root.vis && root.vis.Network) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('vis')); };
      document.head.appendChild(s);
    });
  }

  function mountGraph(api) {
    var box = document.getElementById('sp-net');
    var info = document.getElementById('sp-info');
    if (!box || !data) return;
    ensureVis().then(function () {
      var nodes = (data.nodes || []).map(toVisNode);
      var edgesAll = (data.edges || []).map(toVisEdge);
      var nodesDS = new root.vis.DataSet(nodes);
      var edgesDS = new root.vis.DataSet([]);
      if (graphNet) {
        try { graphNet.destroy(); } catch (e) {}
        graphNet = null;
      }
      graphNet = new root.vis.Network(box, { nodes: nodesDS, edges: edgesDS }, {
        physics: { barnesHut: { gravitationalConstant: -18000, springLength: 120, springConstant: 0.02 } },
        interaction: { hover: true, tooltipDelay: 80 },
        edges: { smooth: { type: 'continuous' } }
      });
      function refresh() {
        var ed = edgesAll.filter(function (e) {
          if (activeKind !== 'all' && e.kind !== activeKind) return false;
          if (activeDept && e.from !== activeDept && e.to !== activeDept) return false;
          return true;
        });
        var used = {};
        ed.forEach(function (e) { used[e.from] = 1; used[e.to] = 1; });
        if (activeDept) used[activeDept] = 1;
        var show = (activeKind === 'all' && !activeDept)
          ? nodes
          : nodes.filter(function (n) { return used[n.id]; });
        nodesDS.clear(); nodesDS.add(show);
        edgesDS.clear();
        edgesDS.add(ed.map(function (e) {
          var o = {};
          for (var k in e) if (Object.prototype.hasOwnProperty.call(e, k)) o[k] = e[k];
          if (e.directed) o.arrows = 'to';
          return o;
        }));
      }
      refresh();
      graphNet.on('click', function (params) {
        if (!info) return;
        if (!params.nodes.length) { info.style.display = 'none'; return; }
        var id = params.nodes[0];
        var n = (data.nodes || []).find(function (x) { return x.id === id; });
        var linked = (data.edges || []).filter(function (e) { return e.from === id || e.to === id; })
          .sort(function (a, b) { return (b.weight || 0) - (a.weight || 0); }).slice(0, 12);
        var head = n ? n.label : id;
        if (n && n.rank_inferred) head += ' · ' + n.rank_inferred;
        if (n && n.type === 'person') head += ' · rank=null';
        var body = linked.map(function (e) {
          var other = e.from === id ? e.to : e.from;
          var on = (data.nodes || []).find(function (x) { return x.id === other; });
          var arrow = e.directed ? (e.from === id ? ' → ' : ' ← ') : ' ↔ ';
          return esc(api, (on && on.label) || other) + arrow + esc(api, e.kind || '') + ' (' + fmtN(e.weight) + ')' +
            (e.est ? ' <span class="sp-badge inf">추정</span>' : '');
        }).join('<br>');
        info.style.display = 'block';
        info.innerHTML = '<div class="t">' + esc(api, head) + '</div>' +
          (n && n.role_summary ? '<div>' + esc(api, n.role_summary) + '</div>' : '') +
          (n && n.type === 'person' ? '<div><button type="button" class="sp-pname" data-person="' + esc(api, n.label || '') + '">하는 일 보기</button></div>' : '') +
          '<div style="margin-top:6px">' + body + '</div>';
        if (n && n.type === 'person') openPerson(n.label || '');
      });
      graphReady = true;
      var kindBar = document.getElementById('sp-kind');
      if (kindBar) {
        kindBar.onclick = function (ev) {
          var b = ev.target.closest('[data-kind]');
          if (!b) return;
          activeKind = b.getAttribute('data-kind') || 'all';
          kindBar.querySelectorAll('button').forEach(function (x) {
            x.classList.toggle('on', x.getAttribute('data-kind') === activeKind);
          });
          refresh();
        };
      }
      var deptSel = document.getElementById('sp-gdept');
      if (deptSel) {
        deptSel.onchange = function () {
          activeDept = deptSel.value || '';
          refresh();
        };
      }
    }).catch(function () {
      box.innerHTML = '<div class="sp-empty" style="color:#e7ecf3;padding-top:40px">그래프 라이브러리를 못 불러왔어요.</div>';
    });
  }

  function renderGraph(api) {
    var kinds = ['all'].concat(Object.keys(EDGE_COLORS));
    var depts = (data.nodes || []).filter(function (n) { return n.type === 'dept'; })
      .slice().sort(function (a, b) { return (b.strength || b.value || 0) - (a.strength || a.value || 0); });
    var h = '<div class="sp-legend">' +
      '<span><i style="background:#5b9fd4"></i>부서</span>' +
      '<span><i style="background:#e07a5f"></i>사람</span>' +
      '<span><i style="background:#c9a227"></i>규정</span>' +
      '<span><i style="background:#7dcea0"></i>내용</span>' +
      '</div>';
    h += '<div class="sp-kind" id="sp-kind">';
    kinds.forEach(function (k) {
      var lab = k === 'all' ? '전체' : k;
      h += '<button type="button" data-kind="' + esc(api, k) + '"' +
        (activeKind === k ? ' class="on"' : '') + '>' + esc(api, lab) + '</button>';
    });
    h += '</div>';
    h += '<div class="sp-tools"><select id="sp-gdept"><option value="">부서 필터 없음</option>';
    depts.forEach(function (d) {
      h += '<option value="' + esc(api, d.id) + '"' + (activeDept === d.id ? ' selected' : '') + '>' +
        esc(api, d.label) + '</option>';
    });
    h += '</select></div>';
    h += '<div class="sp-net" id="sp-net"></div><div class="sp-info" id="sp-info"></div>';
    h += '<p class="sp-note">노드 ' + fmtN(meta().n_nodes || (data.nodes || []).length) +
      ' · 간선 ' + fmtN(meta().n_edges || (data.edges || []).length) +
      ' · 드래그·확대 가능. 사람 직급은 rank=null, rank_inferred만 툴팁. 점선=추정(업무키워드만).</p>';
    return h;
  }

  function body(api) {
    if (tab === 'hub') return renderHub(api);
    if (tab === 'missed') return renderMissed(api);
    if (tab === 'reg') return renderReg(api);
    if (tab === 'graph') return renderGraph(api);
    return renderRole(api);
  }

  function home(el, api) {
    var m = meta();
    var tabs = [
      { id: 'role', label: '역할판 28' },
      { id: 'hub', label: '허브' },
      { id: 'missed', label: '놓친연결' },
      { id: 'reg', label: '규정 TOP' },
      { id: 'graph', label: '그래프' }
    ];
    var h = '<div class="sp-wrap"><div class="sp-head">' +
      '<h1>부서 거미줄</h1>' +
      '<p>부서 간 유기연결 · 문서↔규정 · 필요부서 · 결재라인 · 대장 ' +
      fmtN(m.n_dedup || 0) + '건 · 역할판 ' + fmtN(m.n_dept_roles || board().length) + '</p>' +
      '</div><div class="sp-tabs">';
    tabs.forEach(function (t) {
      h += '<button type="button" class="sp-tab' + (tab === t.id ? ' on' : '') +
        '" data-tab="' + t.id + '">' + esc(api, t.label) + '</button>';
    });
    h += '</div><div id="sp-body">' + body(api) + '</div>' +
      '<p class="sp-note">직급 원본 없음(rank=null). inferred 직위는 공식 공문 기입 금지.</p></div>';
    el.innerHTML = h;
    /* 261029: 사람 이름을 누르면 하는 일 팝업(js/people-roles.js) */
    var wrap = el.querySelector('.sp-wrap');
    if (wrap) wrap.onclick = function (ev) {
      var t = ev.target.closest && ev.target.closest('[data-person]');
      if (t) openPerson(t.getAttribute('data-person') || '');
    };
    el.querySelectorAll('.sp-tab').forEach(function (btn) {
      btn.onclick = function () {
        tab = btn.getAttribute('data-tab') || 'role';
        home(el, api);
      };
    });
    var qi = el.querySelector('#sp-q');
    if (qi) {
      qi.oninput = function () { q = qi.value || ''; };
      qi.onkeydown = function (ev) {
        if (ev.key === 'Enter') { q = qi.value || ''; home(el, api); }
      };
      var tmr = null;
      qi.addEventListener('input', function () {
        clearTimeout(tmr);
        tmr = setTimeout(function () { q = qi.value || ''; home(el, api); }, 220);
      });
    }
    var cs = el.querySelector('#sp-campus');
    if (cs) {
      cs.onchange = function () { campus = cs.value || 'all'; home(el, api); };
    }
    if (tab === 'graph') mountGraph(api);
  }

  function render(el, api) {
    style();
    if (data) return home(el, api);
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    load().then(function (d) {
      if (!d) {
        el.innerHTML = '<section class="card"><p>⚠ 자료(data/dept_spider.json)를 못 불러왔어요. 새로고침해 주세요.</p></section>';
        return;
      }
      home(el, api);
    });
  }
  if (root.ShellModules) root.ShellModules.spider = { id: 'spider', tab: '거미줄', render: render };
})(typeof window !== 'undefined' ? window : globalThis);
