/* 사람별 하는 일 팝업 (261029, 협조 #/coop · 거미줄 #/spider 공용).
   자료: data/people_roles.json (춘식이3이 문서등록대장 기반으로 만듦). 칸 이름이 바뀌면 아래 F(맞춤표) 한 곳만 고치면 됨.

   정해진 모양(261029 춘식이3):
   { "meta": { "id", "generated", "authorized_by", "source_counts": {n_dedup, n_sources, directory}, "rank_note", "notice" },
     "people": [ { "id": "person:이름",            // dept_spider.json 사람 노드 id 와 같음 → 이걸로 이음
                   "label": "이름", "dept": "부서",
                   "rank": "", "rank_inferred": "직위", "rank_confidence": "확정|inferred", "rank_evidence": "…",
                   "roles_summary": "하는 일 2-3줄"(줄바꿈 글 또는 배열),
                   "inferred": false, "inferred_notes": "…",
                   "doc_nos": ["부서-1234", …],
                   "counts": { "기안", "결재", "원기안", "협조제목" },
                   "period": { "first", "last" }, "in_directory": true } ] }
   함께 일하는 사람·부서는 이 파일에 없어서 거미줄(dept_spider.json) 간선에서 같은 id 로 찾아 붙임(결재라인·person-dept 등, 많은 순 5개).
   화면 규칙: inferred=true → 흐린 글자 + 「추론」, rank_confidence=inferred → 직위 옆 「추정」, 협조 개수는 「제목에 협조가 들어간 문서 수」.
   파일이 없거나 비었거나 그 사람이 없으면 「데이터 없음」. 전화·메일 모양 글자는 화면에 안 냄(공개 페이지). */
(function (root) {
  'use strict';
  /* ── 맞춤표: 칸 이름이 바뀌면 여기만 고침(앞에 있는 이름부터 찾음) ── */
  var F = {
    list: ['people', 'persons', 'items'],
    id: ['id'],
    name: ['label', 'name', '이름'],
    dept: ['dept', '부서'],
    rank: ['rank'],
    rankInf: ['rank_inferred'],
    rankConf: ['rank_confidence'],
    roles: ['roles_summary', 'roles', 'duties'],
    text: ['text', 'role', 'label', 't'],
    inferred: ['inferred'],
    inferredNotes: ['inferred_notes'],
    docs: ['doc_nos', 'doc_no', 'docs', 'doc'],
    counts: ['counts'],
    period: ['period'],
    cnt: [['기안', '기안'], ['결재', '결재'], ['원기안', '원기안'], ['협조제목', '제목에 협조가 들어간 문서 수']]
  };
  var MAX_ROLES = 3, MAX_DOCS = 3, MAX_COLLAB = 5;
  var cache = null, spiderCache = null;

  function pick(o, keys) {
    if (!o || typeof o !== 'object') return undefined;
    for (var i = 0; i < keys.length; i++) if (o[keys[i]] != null && o[keys[i]] !== '') return o[keys[i]];
    return undefined;
  }
  function str(v) {
    if (v == null) return '';
    if (typeof v === 'object') v = pick(v, F.text) || '';
    return String(v).replace(/\s+/g, ' ').trim();
  }
  /* 공개 페이지: 휴대전화·이메일·주민번호 모양은 지움 */
  function safe(s) {
    return str(s)
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '')
      .replace(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, '')
      .replace(/\d{6}[-\s]?[1-4]\d{6}/g, '')
      .replace(/\s{2,}/g, ' ').trim();
  }
  function truthy(v) { return v === true || v === 1 || /^(true|추론|추정|inferred|yes|y)$/i.test(String(v == null ? '' : v)); }
  function arr(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
  function lines(v) {
    var out = [];
    arr(v).forEach(function (x) {
      if (typeof x === 'string') x.split(/\r?\n/).forEach(function (t) { out.push(t); });
      else out.push(x);
    });
    return out;
  }

  function normPerson(raw, idHint) {
    if (!raw || typeof raw !== 'object') return null;
    var id = safe(pick(raw, F.id) || idHint || '');
    var name = safe(pick(raw, F.name) || id.replace(/^person:/, ''));
    if (!name) return null;
    if (!id) id = 'person:' + name;
    var inf = truthy(pick(raw, F.inferred));
    var roles = lines(pick(raw, F.roles)).map(function (r) {
      var t = safe(r);
      return t ? { text: t, inferred: (r && typeof r === 'object' && pick(r, F.inferred) != null) ? truthy(pick(r, F.inferred)) : inf } : null;
    }).filter(Boolean);
    var docs = arr(pick(raw, F.docs)).map(safe).filter(Boolean);
    var c = pick(raw, F.counts) || {};
    var counts = F.cnt.map(function (kv) { return c[kv[0]] != null && c[kv[0]] !== '' ? { label: kv[1], n: Number(c[kv[0]]) || 0 } : null; }).filter(Boolean);
    var per = pick(raw, F.period) || {};
    var rank = safe(pick(raw, F.rank));
    var rankInf = safe(pick(raw, F.rankInf));
    var conf = safe(pick(raw, F.rankConf));
    return {
      id: id, name: name, dept: safe(pick(raw, F.dept)),
      rank: rank || rankInf, rankGuess: !rank && !!rankInf && conf !== '확정',
      roles: roles, inferred: inf, inferredNotes: safe(pick(raw, F.inferredNotes)),
      docs: docs, counts: counts,
      period: [safe(per.first), safe(per.last)].filter(Boolean).join(' ~ '),
      collab: []
    };
  }
  /* 파일 전체 → id·이름으로 찾는 사전 */
  function normalize(j) {
    var out = {};
    if (!j) return out;
    var list = Array.isArray(j) ? j : pick(j, F.list);
    if (list && !Array.isArray(list) && typeof list === 'object') {
      Object.keys(list).forEach(function (k) { var p = normPerson(list[k], /^person:/.test(k) ? k : 'person:' + k); if (p) { out[p.id] = p; out[p.name] = out[p.name] || p; } });
    } else {
      arr(list).forEach(function (r) { var p = normPerson(r); if (p) { out[p.id] = p; out[p.name] = out[p.name] || p; } });
    }
    return out;
  }
  /* 거미줄 간선에서 함께 일하는 사람·부서(같은 id) */
  function collabFrom(sp, id) {
    if (!sp || !id) return [];
    var lab = {};
    (sp.nodes || []).forEach(function (n) { lab[n.id] = n; });
    var w = {};
    (sp.edges || []).forEach(function (e) {
      if (e.from !== id && e.to !== id) return;
      var o = e.from === id ? e.to : e.from;
      if (o === id || !lab[o] || (lab[o].type !== 'person' && lab[o].type !== 'dept')) return;
      if (!w[o]) w[o] = { name: lab[o].label || o, kind: lab[o].type, n: 0, est: true };
      w[o].n += e.weight || 1;
      if (!e.est) w[o].est = false;
    });
    return Object.keys(w).map(function (k) { return w[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, MAX_COLLAB)
      .map(function (x) { return { name: safe(x.name), kind: x.kind, inferred: x.est }; });
  }
  function getJSON(f) {
    return fetch(new URL(f, document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(f); return r.json(); });
  }
  function load() {
    if (!cache) cache = getJSON('data/people_roles.json').then(normalize).catch(function () { return {}; });
    return cache;
  }
  function loadSpider() {
    if (!spiderCache) spiderCache = getJSON('data/dept_spider.json').catch(function () { return null; });
    return spiderCache;
  }
  function find(map, name) {
    var n = String(name || '').replace(/^#/, '').replace(/\s*\d{4}$/, '').trim();
    if (!n || !map) return null;
    var bare = n.replace(/\s*(선생님|샘|님|주무관|팀장|과장|실장|센터장)$/, '');
    return map[n] || map['person:' + n] || map[bare] || map['person:' + bare] || null;
  }

  function e(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var TAG = ' <span class="pr-tag">추론</span>';
  var GUESS = ' <span class="pr-tag">추정</span>';
  function html(p, name) {
    var head = '<div class="pr-head"><b>' + e(p ? p.name : name) + '</b>' +
      (p && (p.dept || p.rank) ? '<span class="pr-sub">' + (p.dept ? e(p.dept) : '') + (p.dept && p.rank ? ' · ' : '') +
        (p.rank ? e(p.rank) + (p.rankGuess ? GUESS : '') : '') + '</span>' : '') +
      '<button type="button" class="pr-x" data-pr-close aria-label="닫기">×</button></div>';
    if (!p || (!p.roles.length && !p.docs.length && !p.collab.length && !p.counts.length)) return head + '<p class="pr-none">데이터 없음</p>';
    var h = head;
    if (p.roles.length) {
      h += '<ul class="pr-roles">' + p.roles.slice(0, MAX_ROLES).map(function (r) {
        return '<li' + (r.inferred ? ' class="pr-inf"' : '') + '>' + e(r.text) + (r.inferred ? TAG : '') + '</li>';
      }).join('') + '</ul>';
    } else h += '<p class="pr-none">하는 일: 데이터 없음</p>';
    if (p.inferred && p.inferredNotes) h += '<p class="pr-foot pr-inf">' + e(p.inferredNotes) + '</p>';
    h += '<p class="pr-row"><span class="k">대표 문서</span>' + (p.docs.length ? '<span>' + p.docs.slice(0, MAX_DOCS).map(function (d) {
      return '<span class="pr-doc">' + e(d) + '</span>';
    }).join('') + '</span>' : '<span class="pr-none">데이터 없음</span>') + '</p>';
    h += '<p class="pr-row"><span class="k">함께</span>' + (p.collab.length ? '<span>' + p.collab.map(function (c) {
      return '<span class="pr-c' + (c.inferred ? ' pr-inf' : '') + '">' + e(c.name) + (c.inferred ? GUESS : '') + '</span>';
    }).join('') + '</span>' : '<span class="pr-none">데이터 없음</span>') + '</p>';
    if (p.counts.length || p.period) {
      h += '<p class="pr-cnt">' + p.counts.map(function (c) { return e(c.label) + ' ' + c.n.toLocaleString('ko-KR'); }).join(' · ') +
        (p.period ? (p.counts.length ? ' · ' : '') + '기간 ' + e(p.period) : '') + '</p>';
    }
    return h;
  }
  var CSS = [
    '.pr-back{position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:9998}',
    '.pr-pop{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;box-sizing:border-box;width:min(360px,calc(100vw - 24px));max-height:min(60vh,420px);overflow:auto;background:var(--card,#fff);color:var(--ink,#111);border:1px solid var(--line,#ddd);border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.22);padding:12px 14px;font-size:.88rem;line-height:1.45;overflow-wrap:anywhere}',
    '@media (min-width:700px){.pr-pop{bottom:auto;top:50%;transform:translate(-50%,-50%)}}',
    '.pr-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding-right:28px;position:relative}.pr-head b{font-size:1rem}',
    '.pr-sub{font-size:.78rem;color:var(--muted,#777)}',
    '.pr-x{position:absolute;right:-6px;top:-6px;border:0;background:transparent;font-size:1.3rem;line-height:1;padding:6px 8px;cursor:pointer;color:var(--muted,#777)}',
    '.pr-roles{margin:8px 0 6px;padding-left:1.1em}.pr-roles li{margin:2px 0}',
    '.pr-row{display:flex;gap:8px;margin:4px 0;align-items:baseline}.pr-row .k{flex:0 0 4.2rem;color:var(--muted,#777);font-weight:700;font-size:.8rem}',
    '.pr-doc{display:inline-block;font-weight:700;margin:0 8px 2px 0}',
    '.pr-cnt{font-size:.76rem;color:var(--muted,#777);margin:8px 0 0}',
    '.pr-c{display:inline-block;margin:0 6px 2px 0;padding:1px 8px;border-radius:999px;background:var(--soft,#f3f3f3);font-size:.8rem}',
    '.pr-inf{color:var(--muted,#888);opacity:.85}',
    '.pr-tag{display:inline-block;font-size:.66rem;font-weight:700;border-radius:999px;padding:0 6px;margin-left:2px;background:#fff4e5;color:#7a4a00;vertical-align:1px}',
    '.pr-none{color:var(--muted,#888);margin:8px 0 2px}.pr-row .pr-none{margin:0}',
    '.pr-foot{font-size:.76rem;margin:8px 0 0}',
    '.pr-act{margin:10px 0 0;display:flex;gap:6px;flex-wrap:wrap}.pr-act button{font-size:.8rem;padding:6px 12px;border-radius:999px;border:1px solid var(--line,#ddd);background:var(--soft,#f3f3f3);cursor:pointer;color:var(--ink,#111)}'
  ].join('\n');
  function style() {
    if (document.getElementById('pr-style')) return;
    var s = document.createElement('style');
    s.id = 'pr-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function close() {
    ['pr-pop', 'pr-back'].forEach(function (id) { var x = document.getElementById(id); if (x) x.remove(); });
    document.removeEventListener('keydown', onKey);
  }
  function onKey(ev) { if (ev.key === 'Escape') close(); }
  /* 이름을 받아 팝업을 띄움. actions: [{label, run}] (예: 「이 사람으로 검색」) */
  function open(name, actions) {
    style();
    close();
    var back = document.createElement('div');
    back.id = 'pr-back'; back.className = 'pr-back';
    var pop = document.createElement('div');
    pop.id = 'pr-pop'; pop.className = 'pr-pop';
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', String(name || '') + ' 하는 일');
    pop.innerHTML = html(null, name).replace('<p class="pr-none">데이터 없음</p>', '<p class="pr-none">불러오는 중…</p>');
    document.body.appendChild(back); document.body.appendChild(pop);
    back.onclick = close;
    document.addEventListener('keydown', onKey);
    function wire() {
      var x = pop.querySelector('[data-pr-close]');
      if (x) x.onclick = close;
      (actions || []).forEach(function (a, i) {
        var b = pop.querySelector('[data-pr-act="' + i + '"]');
        if (b) b.onclick = function () { close(); a.run(); };
      });
    }
    wire();
    return Promise.all([load(), loadSpider()]).then(function (got) {
      var map = got[0];
      if (!document.getElementById('pr-pop')) return;
      var p = find(map, name);
      if (p && !p.collab.length) p.collab = collabFrom(got[1], p.id);
      var acts = (actions || []).length ? '<div class="pr-act">' + actions.map(function (a, i) {
        return '<button type="button" data-pr-act="' + i + '">' + e(a.label) + '</button>';
      }).join('') + '</div>' : '';
      pop.innerHTML = html(p, name) + acts;
      wire();
    });
  }
  root.HJPeopleRoles = { F: F, normalize: normalize, find: find, html: html, collabFrom: collabFrom, load: load, open: open, close: close,
    _reset: function () { cache = null; spiderCache = null; } };
})(typeof window !== 'undefined' ? window : globalThis);
