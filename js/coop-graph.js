/* 협조 검색(#/coop) 보충: 부서 거미줄(dept_spider.json) + 사람별 하는 일(people_roles.json) 261029.
   (유진님 10.29. 「앱 기능 1번 자료 활용해서 2번에 보충하고 디벨롭해」「그리고 1번은 지워 기능」 → #/spider 화면은 _archive/ 로, 자료는 여기서 읽음)
   부서·사람 이름으로 찾으면 하는 일·대장 건수·이어진 부서·규정·결재라인·근거 파일 이름을 한 장에.
   일·낱말로 찾으면 「이 일은 어느 부서·누구와 협조, 어느 규정」 안내.
   화면 규칙: inferred=true → 흐린 글자 + 「추론」, rank_confidence=inferred → 직위 옆 「추정」, 추정 간선 → 「추정」,
   협조 개수는 「제목에 협조가 들어간 문서 수」, 사람 규정은 「관련 추정 규정」(제목 낱말로 맞춘 것), 파일 없음 → 「데이터 없음」.
   전화·내선·메일 모양 글자는 이 파일에서 안 냄(공개 페이지). 칸 이름이 바뀌면 F 한 곳만 고침. */
(function (root) {
  'use strict';
  var F = {
    list: ['people', 'persons', 'items'],
    name: ['label', 'name'],
    roles: ['roles_summary', 'roles'],
    counts: [['기안', ['기안']], ['접수', ['접수']], ['결재', ['결재']], ['원문기안', ['원문기안', '원기안']], ['제목에 협조가 들어간 문서 수', ['협조제목']]],
    linkKinds: { '발신→수신': 1, 'title-협조': 1, 'word-제목부서': 1, 'word-업무추정': 1 }
  };
  var MAX = { roles: 3, docs: 3, links: 5, regs: 3, people: 5, appr: 2, cards: 3 };

  function pick(o, keys) {
    if (!o || typeof o !== 'object') return undefined;
    for (var i = 0; i < keys.length; i++) if (o[keys[i]] != null && o[keys[i]] !== '') return o[keys[i]];
    return undefined;
  }
  function arr(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
  /* 공개 페이지: 휴대전화·이메일·주민번호·내선 모양은 지움 */
  function safe(s) {
    if (s == null) return '';
    if (typeof s === 'object') s = pick(s, ['text', 'label', 'name']) || '';
    return String(s)
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '')
      .replace(/0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/g, '')
      .replace(/\d{6}[-\s]?[1-4]\d{6}/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  /* 근거 파일: 폴더·확장자 빼고 이름만 */
  function fileName(p) { return safe(String(p || '').split('/').pop().replace(/\.(md|json|jsonl|xlsx?|csv)$/i, '')); }
  function truthy(v) { return v === true || /^(true|추론|추정|inferred)$/i.test(String(v == null ? '' : v)); }
  function bare(s) { return safe(s).replace(/^[#@]/, '').replace(/\s*(선생님|샘|님|주무관|팀장|과장|실장|센터장)$/, ''); }

  function person(raw, sp) {
    var id = safe(raw.id) || ('person:' + safe(pick(raw, F.name)));
    var name = safe(pick(raw, F.name)) || id.replace(/^person:/, '');
    if (!name) return null;
    var inf = truthy(raw.inferred);
    var c = raw.counts || {};
    var counts = F.counts.map(function (kv) {
      var v = pick(c, kv[1]);
      return v == null ? null : { label: kv[0], n: Number(v) || 0 };
    }).filter(Boolean);
    var rank = safe(raw.rank), rankInf = safe(raw.rank_inferred), conf = safe(raw.rank_confidence);
    var per = raw.period || {};
    return {
      kind: 'person', id: id, name: name, dept: safe(raw.dept), inDir: raw.in_directory !== false,
      rank: rank || rankInf, rankGuess: !rank && !!rankInf && conf !== '확정',
      roles: arr(raw.roles_summary).map(safe).filter(Boolean),
      inferred: inf, notes: arr(raw.inferred_notes).map(safe).filter(Boolean),
      docs: arr(raw.doc_nos).map(safe).filter(Boolean),
      counts: counts,
      links: arr(raw.links_dept).map(function (l) { return { name: safe(l.dept || l.name), n: Number(l.n) || 0, est: false }; }).filter(function (l) { return l.name; }),
      regs: arr(raw.regs).map(function (r) { return { name: safe(r.name || r.label), n: Number(r.n) || 0 }; }).filter(function (r) { return r.name; }),
      period: [safe(per.first), safe(per.last)].filter(Boolean).join(' ~ '),
      appr: [], fromFile: true
    };
  }

  /* 두 파일 → 찾기 사전. sp·pr 은 없어도 됨(null) */
  function build(sp, pr) {
    var idx = { depts: {}, persons: {}, regs: [], contents: [], hasSpider: !!(sp && sp.nodes), hasPeople: false };
    var nodes = {};
    ((sp && sp.nodes) || []).forEach(function (n) { nodes[n.id] = n; });
    var board = {};
    ((sp && sp.dept_role_board) || []).forEach(function (b) { board[b.dept] = b; });
    var missed = (sp && sp.missed_links) || {};
    function dept(label) {
      if (!label) return null;
      if (!idx.depts[label]) {
        var n = nodes['dept:' + label] || {}, b = board[label] || {};
        idx.depts[label] = {
          kind: 'dept', id: 'dept:' + label, name: safe(label),
          role: safe(b.role_summary || n.role_summary), inferred: truthy(b.inferred) || truthy(n.role_inferred),
          campus: safe(b.campus || n.campus), docN: Number(b.doc_n || n.doc_n) || 0,
          sendOut: Number(b.send_out) || 0, recvIn: Number(b.recv_in) || 0,
          sources: arr(b.duty_sources || n.duty_sources).map(fileName).filter(Boolean),
          missed: arr((missed[label] || {}).missing).map(safe),
          links: {}, regs: {}, people: {}, appr: {}
        };
      }
      return idx.depts[label];
    }
    var pnode = {};
    Object.keys(nodes).forEach(function (k) {
      var n = nodes[k];
      if (n.type === 'dept') dept(n.label);
      else if (n.type === 'reg') idx.regs.push({ id: n.id, name: safe(n.label), kws: arr(n.kws).map(String), depts: {} });
      else if (n.type === 'content') idx.contents.push({ id: n.id, name: safe(n.label), depts: {} });
      else if (n.type === 'person') pnode[n.id] = n;
    });
    var regById = {}, conById = {};
    idx.regs.forEach(function (r) { regById[r.id] = r; });
    idx.contents.forEach(function (c) { conById[c.id] = c; });
    function lab(id) { return nodes[id] ? nodes[id].label : String(id || '').replace(/^\w+:/, ''); }
    function add(map, key, n, est) {
      if (!map[key]) map[key] = { name: safe(key), n: 0, est: true };
      map[key].n += n; if (!est) map[key].est = false;
    }
    var personDept = {}, apprBy = {};
    ((sp && sp.edges) || []).forEach(function (e) {
      var a = nodes[e.from], b = nodes[e.to], w = Number(e.weight) || 1;
      if (!a || !b) return;
      if (F.linkKinds[e.kind] && a.type === 'dept' && b.type === 'dept' && a.id !== b.id) {
        add(dept(a.label).links, b.label, w, !!e.est); add(dept(b.label).links, a.label, w, !!e.est);
      } else if (e.kind === 'dept-reg') {
        var d = a.type === 'dept' ? a : b, r = a.type === 'reg' ? a : b;
        if (d.type === 'dept' && regById[r.id]) { add(dept(d.label).regs, r.label, w, !!e.est); add(regById[r.id].depts, d.label, w, !!e.est); }
      } else if (e.kind === 'content-dept') {
        var cc = a.type === 'content' ? a : b, dd = a.type === 'dept' ? a : b;
        if (conById[cc.id] && dd.type === 'dept') add(conById[cc.id].depts, dd.label, w, !!e.est);
      } else if (e.kind === 'person-dept') {
        var p = a.type === 'person' ? a : b, d2 = a.type === 'dept' ? a : b;
        if (d2.type === 'dept') { add(dept(d2.label).people, p.label, w, !!e.est); (personDept[p.id] = personDept[p.id] || {})[d2.label] = w; }
      } else if (e.kind === '결재라인' && e.from !== e.to) {
        var t = { text: safe(lab(e.from)) + ' → ' + safe(lab(e.to)), n: w };
        (apprBy[e.from] = apprBy[e.from] || []).push(t);
        (apprBy[e.to] = apprBy[e.to] || []).push(t);
      }
    });
    /* 사람: people_roles 가 먼저, 없으면 거미줄 사람 노드 */
    var list = pr ? (Array.isArray(pr) ? pr : pick(pr, F.list)) : null;
    arr(list).forEach(function (raw) {
      var p = raw && typeof raw === 'object' ? person(raw) : null;
      if (!p) return;
      idx.persons[p.name] = p; idx.hasPeople = true;
    });
    Object.keys(pnode).forEach(function (id) {
      var n = pnode[id], name = safe(n.label);
      if (!name || idx.persons[name]) return;
      var pd = personDept[id] || {};
      var top = Object.keys(pd).sort(function (x, y) { return pd[y] - pd[x]; });
      idx.persons[name] = { kind: 'person', id: id, name: name, dept: safe(top[0] || ''), inDir: true,
        rank: safe(n.rank || n.rank_inferred), rankGuess: !n.rank && !!n.rank_inferred && n.rank_confidence !== '확정',
        roles: [], inferred: false, notes: [], docs: [], counts: [], links: [], regs: [], period: '', appr: [], fromFile: false };
    });
    Object.keys(idx.persons).forEach(function (k) {
      var p = idx.persons[k];
      p.appr = (apprBy[p.id] || []).sort(function (x, y) { return y.n - x.n; }).slice(0, MAX.appr);
      if (p.dept && idx.depts[p.dept]) {
        var dp = idx.depts[p.dept].people;
        if (!dp[p.name]) dp[p.name] = { name: p.name, n: 0, est: !!p.inferred };
        p.appr.forEach(function (a) { var d = idx.depts[p.dept].appr; if (!d[a.text]) d[a.text] = a; });
      }
    });
    function top(map, n) { return Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) { return y.n - x.n; }).slice(0, n); }
    Object.keys(idx.depts).forEach(function (k) {
      var d = idx.depts[k];
      d.links = top(d.links, MAX.links); d.regs = top(d.regs, MAX.regs);
      d.people = top(d.people, MAX.people); d.appr = top(d.appr, MAX.appr);
    });
    idx.regs.forEach(function (r) { r.depts = top(r.depts, 3); });
    idx.contents.forEach(function (c) { c.depts = top(c.depts, 3); });
    return idx;
  }

  function terms(needle, chips) {
    var t = String(needle || '').split(/[\s,]+/).map(bare).filter(function (x) { return x.length >= 2 || /\*/.test(x); });
    (chips || []).forEach(function (c) { var q = bare(c.q || c.label || ''); if (q) t.push(q); });
    var seen = {};
    return t.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
  }
  function sumCounts(p) { return p.counts.reduce(function (a, c) { return a + c.n; }, 0); }
  /* 찾기: 부서·사람 이름이면 그 카드, 일 낱말이면 협조 안내(규정·부서·사람) */
  function search(idx, needle, chips) {
    var out = { depts: [], persons: [], guide: null };
    if (!idx) return out;
    var ts = terms(needle, chips);
    if (!ts.length) return out;
    var kinds = {};
    (chips || []).forEach(function (c) { kinds[bare(c.q || c.label || '')] = c.kind; });
    var dn = Object.keys(idx.depts), pn = Object.keys(idx.persons);
    ts.forEach(function (t) {
      if (kinds[t] !== 'person') dn.forEach(function (k) {
        if ((k === t || k.indexOf(t) >= 0 || (t.length >= 3 && t.indexOf(k) >= 0)) && out.depts.indexOf(idx.depts[k]) < 0) out.depts.push(idx.depts[k]);
      });
      if (kinds[t] !== 'dept') pn.forEach(function (k) {
        if ((k === t || (t.length >= 2 && k.indexOf(t) === 0) || (k.length >= 2 && t.indexOf(k) >= 0)) && out.persons.indexOf(idx.persons[k]) < 0) out.persons.push(idx.persons[k]);
      });
    });
    out.depts = out.depts.slice(0, MAX.cards); out.persons = out.persons.slice(0, MAX.cards);
    /* 일 낱말 → 규정·부서·사람 */
    var words = ts.filter(function (t) { return !idx.depts[t] && !idx.persons[t] && kinds[t] !== 'person' && kinds[t] !== 'dept'; });
    if (words.length) {
      var regs = idx.regs.filter(function (r) {
        return words.some(function (w) { return r.name.indexOf(w) >= 0 || r.kws.some(function (k) { return k && (k.indexOf(w) >= 0 || w.indexOf(k) >= 0); }); });
      }).slice(0, 3);
      var cons = idx.contents.filter(function (c) {
        return words.some(function (w) { return c.name.indexOf(w) >= 0 || c.name.split('·').some(function (p) { return p.length >= 2 && w.indexOf(p) >= 0; }); });
      });
      var dw = {};
      regs.concat(cons).forEach(function (x) { x.depts.forEach(function (d) { if (!dw[d.name]) dw[d.name] = { name: d.name, n: 0, est: d.est }; dw[d.name].n += d.n; if (!d.est) dw[d.name].est = false; }); });
      var depts = Object.keys(dw).map(function (k) { return dw[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 3);
      var people = pn.map(function (k) { return idx.persons[k]; }).filter(function (p) {
        return p.fromFile && words.some(function (w) { return p.roles.some(function (r) { return r.indexOf(w) >= 0; }); });
      }).sort(function (a, b) { return sumCounts(b) - sumCounts(a); }).slice(0, MAX.people);
      if (regs.length || depts.length || people.length) out.guide = { regs: regs, depts: depts, people: people };
    }
    return out;
  }
  /* 입력 중 #부서 #사람 칩 */
  function suggest(idx, typed, limit) {
    var n = bare(typed);
    if (!idx || !n) return [];
    var out = [];
    Object.keys(idx.depts).forEach(function (k) { if (k.indexOf(n) >= 0) out.push({ kind: 'dept', label: '#' + k, q: k }); });
    Object.keys(idx.persons).forEach(function (k) { if (k.indexOf(n) === 0) out.push({ kind: 'person', label: '#' + k, q: k }); });
    return out.slice(0, limit || 6);
  }
  /* 협조 행 한 줄에 맞는 규정(키워드) */
  function regsFor(idx, text) {
    if (!idx || !text) return [];
    return idx.regs.filter(function (r) { return r.kws.some(function (k) { return k && k.length >= 2 && text.indexOf(k) >= 0; }); }).slice(0, 2).map(function (r) { return r.name; });
  }

  /* ── 그리기 ── */
  function e(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var INF = ' <span class="cg-tag">추론</span>', EST = ' <span class="cg-tag">추정</span>';
  var NONE = '<span class="cg-none">데이터 없음</span>';
  function num(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function chip(x, kind, unit) {
    return '<button type="button" class="cg-c' + (x.est ? ' cg-inf' : '') + '" data-cg-q="' + e(x.name) + '" data-cg-kind="' + kind + '">' +
      e(x.name) + (x.n ? ' <small>' + num(x.n) + (unit || '') + '</small>' : '') + (x.est ? EST : '') + '</button>';
  }
  function row(k, v) { return '<div class="k">' + k + '</div><div class="v">' + (v || NONE) + '</div>'; }
  function deptCard(d) {
    var h = '<article class="cg-card" data-cg-dept="' + e(d.name) + '"><h3><span class="cg-kind">#부서</span> ' + e(d.name) +
      (d.campus ? ' <small>' + e(d.campus) + '</small>' : '') + '</h3><div class="cg-grid">';
    h += row('하는 일', d.role ? '<span' + (d.inferred ? ' class="cg-inf"' : '') + '>' + e(d.role) + (d.inferred ? INF : '') + '</span>' : '');
    h += row('대장', d.docN ? '문서 ' + num(d.docN) + '건' + (d.sendOut || d.recvIn ? ' (발신 ' + num(d.sendOut) + ' · 수신 ' + num(d.recvIn) + ')' : '') : '');
    h += row('사람', d.people.map(function (p) { return chip({ name: p.name, est: p.est }, 'person'); }).join(''));
    h += row('이어진 부서', d.links.map(function (l) { return chip(l, 'dept', '건'); }).join('') +
      (d.missed.length ? '<span class="cg-miss">놓친 연결: ' + d.missed.map(e).join(' · ') + '</span>' : ''));
    h += row('규정', d.regs.map(function (r) { return '<span class="cg-reg">' + e(r.name) + ' <small>' + num(r.n) + '건</small></span>'; }).join(''));
    h += row('결재라인', d.appr.map(function (a) { return '<span class="cg-ap">' + e(a.text) + ' <small>' + num(a.n) + '건</small></span>'; }).join(''));
    h += '</div>' + (d.sources.length ? '<p class="cg-src">근거 파일: ' + d.sources.map(e).join(' · ') + '</p>' : '') + '</article>';
    return h;
  }
  function personCard(p) {
    var h = '<article class="cg-card" data-cg-person="' + e(p.name) + '"><h3><span class="cg-kind">#사람</span> ' + e(p.name) +
      (p.dept || p.rank ? ' <small>' + e(p.dept) + (p.dept && p.rank ? ' · ' : '') + (p.rank ? e(p.rank) + (p.rankGuess ? EST : '') : '') + '</small>' : '') + '</h3>';
    if (!p.fromFile) h += '<p class="cg-none">하는 일: 데이터 없음 (사람별 자료 없음)</p><div class="cg-grid">';
    else {
      h += '<div class="cg-grid">';
      h += row('하는 일', p.roles.length ? '<ul class="cg-roles' + (p.inferred ? ' cg-inf' : '') + '">' + p.roles.slice(0, MAX.roles).map(function (r) {
        return '<li>' + e(r) + '</li>'; }).join('') + '</ul>' + (p.inferred ? INF : '') : '');
      h += row('대장', p.counts.length ? p.counts.map(function (c) { return e(c.label) + ' ' + num(c.n); }).join(' · ') + (p.period ? '<br><small>' + e(p.period) + '</small>' : '') : '');
      h += row('대표 문서', p.docs.slice(0, MAX.docs).map(function (d) { return '<span class="cg-doc">' + e(d) + '</span>'; }).join(''));
    }
    h += row('이어진 부서', p.links.slice(0, MAX.links).map(function (l) { return chip(l, 'dept', '건'); }).join(''));
    if (p.fromFile) h += row('관련 추정 규정', p.regs.slice(0, MAX.regs).map(function (r) { return '<span class="cg-reg cg-inf">' + e(r.name) + ' <small>' + num(r.n) + '건</small></span>'; }).join(''));
    h += row('결재라인', p.appr.map(function (a) { return '<span class="cg-ap">' + e(a.text) + ' <small>' + num(a.n) + '건</small></span>'; }).join(''));
    h += '</div>' + (p.inferred && p.notes.length ? '<p class="cg-src cg-inf">' + p.notes.map(e).join(' ') + '</p>' : '') + '</article>';
    return h;
  }
  function guideCard(g) {
    return '<article class="cg-card cg-guide"><h3>누구와 협조 · 어느 규정</h3><div class="cg-grid">' +
      row('규정', g.regs.map(function (r) { return '<span class="cg-reg">' + e(r.name) + '</span>'; }).join('')) +
      row('협조 부서', g.depts.map(function (d) { return chip(d, 'dept', '건'); }).join('')) +
      row('하는 사람', g.people.map(function (p) { return chip({ name: p.name, est: p.inferred }, 'person'); }).join('')) +
      '</div><p class="cg-src">부서·규정은 문서대장 제목 낱말로 맞춘 것(거미줄 자료).</p></article>';
  }
  /* idx 없음(파일 못 읽음) → 데이터 없음 한 줄 */
  function html(idx, res) {
    if (!idx || (!idx.hasSpider && !idx.hasPeople)) return '';
    var h = '';
    if (res.guide) h += guideCard(res.guide);
    h += res.depts.map(deptCard).join('') + res.persons.map(personCard).join('');
    return h ? '<div class="cg-wrap">' + h + '</div>' : '';
  }
  var CSS = [
    '.cg-wrap{margin:4px 0 8px}',
    '.cg-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:0 0 10px;font-size:.86rem;line-height:1.45;overflow-wrap:anywhere}',
    '.cg-card h3{margin:0 0 8px;font-size:1rem;line-height:1.35}.cg-card h3 small{font-weight:600;color:var(--muted);font-size:.78rem}',
    '.cg-kind{font-size:.7rem;font-weight:800;border-radius:999px;padding:1px 7px;background:#e7f6ef;color:#0d5c3d;vertical-align:2px}',
    '[data-cg-person] .cg-kind{background:#f3e8ff;color:#5b2d8e}.cg-guide h3{color:#1a4d9e}',
    '.cg-grid{display:grid;grid-template-columns:5.2rem 1fr;gap:5px 8px}.cg-grid .k{color:var(--muted);font-weight:700;font-size:.8rem}.cg-grid .v{color:var(--ink-2);min-width:0}',
    '.cg-c{display:inline-block;margin:0 5px 4px 0;padding:2px 9px;border-radius:999px;border:1px solid var(--line);background:var(--soft);font-size:.8rem;color:var(--ink);cursor:pointer}',
    '.cg-c small,.cg-reg small,.cg-ap small{color:var(--muted);font-size:.72rem}',
    '.cg-reg,.cg-ap,.cg-doc{display:inline-block;margin:0 8px 2px 0}.cg-doc{font-weight:700}',
    '.cg-roles{margin:0;padding-left:1.05em}.cg-roles li{margin:1px 0}',
    '.cg-inf{color:var(--muted);opacity:.88}',
    '.cg-tag{display:inline-block;font-size:.64rem;font-weight:700;border-radius:999px;padding:0 6px;margin-left:2px;background:#fff4e5;color:#7a4a00;vertical-align:1px;opacity:1}',
    '.cg-none{color:var(--muted)}.cg-card>.cg-none{margin:0 0 6px}',
    '.cg-miss{display:block;font-size:.76rem;color:#9a3b00;margin-top:2px}',
    '.cg-src{font-size:.74rem;color:var(--muted);margin:8px 0 0}'
  ].join('\n');
  function style() {
    if (typeof document === 'undefined' || document.getElementById('cg-style')) return;
    var s = document.createElement('style'); s.id = 'cg-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  var cache = null;
  function getJSON(f) {
    return fetch(new URL(f, document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(f); return r.json(); }).catch(function () { return null; });
  }
  function load() {
    if (!cache) cache = Promise.all([getJSON('data/dept_spider.json'), getJSON('data/people_roles.json')])
      .then(function (g) { return build(g[0], g[1]); });
    return cache;
  }
  root.HJCoopGraph = { F: F, build: build, search: search, suggest: suggest, regsFor: regsFor, html: html, style: style, load: load,
    safe: safe, fileName: fileName, _reset: function () { cache = null; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HJCoopGraph;
})(typeof window !== 'undefined' ? window : globalThis);
