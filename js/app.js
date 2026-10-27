/* 행정 연습장 껍데기. 잠금 없이 바로 열려요. 자료는 public-pack.json + dorm.json. */
(function () {
  'use strict';
  var OLD_DBS = ['ap3', 'vault', 'ap2', 'ap'];
  var STORE = 'ap3-public';

  var state = { pack: null, edits: null, records: null, guide: null, booted: false };
  window.ShellModules = window.ShellModules || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function emptyEdits() {
    return { rules: {}, monthly: {}, monthlyAdded: [], monthlyDeleted: [], budget: {}, work_items: null, news: {}, newsAdded: [], newsDeleted: [], computersList: null, dorm: null, schedule: null };
  }
  function copyRow(row) { return Object.assign({}, row); }
  function newsRows(pack, ed) {
    var deleted = ed.newsDeleted || [];
    var patches = ed.news || {};
    var ids = {};
    var rows = (pack.entities.news || []).filter(function (n) { return deleted.indexOf(n.id) < 0; }).map(function (n) {
      ids[n.id] = 1;
      return Object.assign({}, n, patches[n.id] || {});
    });
    (ed.newsAdded || []).forEach(function (n) {
      if (deleted.indexOf(n.id) >= 0 || ids[n.id]) return;
      rows.push(Object.assign({}, n, patches[n.id] || {}));
    });
    return rows;
  }
  function computerRows(pack, ed) {
    if (ed.computersList) return ed.computersList.map(copyRow);
    return (pack.entities.computers || []).map(copyRow);
  }
  function scheduleView(pack, ed) {
    var seed = (pack.entities && pack.entities.schedule) || {};
    var saved = ed.schedule;
    var items = (saved && Array.isArray(saved.items)) ? saved.items : (seed.items || []);
    return {
      sheetTitle: seed.sheetTitle || '',
      tab: seed.tab || '남은일정',
      sheetUrl: seed.sheetUrl || '',
      scriptUrl: (saved && saved.scriptUrl) || seed.scriptUrl || '',
      items: items.map(copyRow),
      pending: !!(saved && saved.pending),
      syncedAt: (saved && saved.syncedAt) || '',
      at: (saved && saved.at) || ''
    };
  }
  function emptyRecords() {
    var id = (crypto.randomUUID && crypto.randomUUID()) || ('d' + Date.now());
    return { deviceId: id, updatedAt: new Date().toISOString(), tasks: {}, questions: {}, study: { done: {} }, learning: {}, continue: {}, drafts: {}, lastBackupAt: null };
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add('hidden'); }, 2400);
  }

  /* 예전 PIN 저장소(IndexedDB)는 열 때마다 지워요. 다시는 잠금 화면이 나오지 않게. */
  function purgeOld() {
    var jobs = [];
    try {
      OLD_DBS.forEach(function (name) {
        jobs.push(new Promise(function (res) {
          try {
            var r = indexedDB.deleteDatabase(name);
            r.onsuccess = r.onerror = r.onblocked = function () { res(); };
          } catch (e) { res(); }
          setTimeout(res, 1500);
        }));
      });
    } catch (e) { /* indexedDB 없음 */ }
    try {
      ['ap3-vault', 'ap3-lock', 'ap3-pin', 'ap3-online'].forEach(function (k) { localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch (e) { /* 저장소 없음 */ }
    return Promise.all(jobs);
  }

  function view() {
    var p = state.pack || { appTitle: '행정 연습장', packVersion: '', corrections: [], catalogs: {}, entities: {} };
    var ed = state.edits || emptyEdits();
    var rules = (p.entities.rules || []).map(function (r) { return Object.assign({}, r, (ed.rules || {})[r.id] || {}); });
    var deleted = ed.monthlyDeleted || [];
    var todos = (p.entities.monthly_todos || []).filter(function (t) { return deleted.indexOf(t.id) < 0; })
      .map(function (t) { return Object.assign({}, t, (ed.monthly || {})[t.id] || {}); })
      .concat(ed.monthlyAdded || []);
    var budget = (p.entities.budget_lines || []).map(function (b) { return Object.assign({}, b, (ed.budget || {})[b.id] || {}); });
    var work = ed.work_items ? ed.work_items.map(function (w) { return Object.assign({}, w); }) : (p.entities.work_items || []).map(function (w) { return Object.assign({}, w); });
    return {
      appTitle: p.appTitle || '행정 연습장',
      packVersion: p.packVersion || '',
      corrections: p.corrections || [],
      catalogs: p.catalogs || {},
      conflicts: (ed.conflicts || []).slice(),
      entities: Object.assign({}, p.entities, { rules: rules, monthly_todos: todos, budget_lines: budget, work_items: work, news: newsRows(p, ed), computers: computerRows(p, ed), schedule: scheduleView(p, ed) })
    };
  }

  function readStore() {
    var edits = emptyEdits();
    var records = emptyRecords();
    try {
      var raw = localStorage.getItem(STORE);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && obj.edits) edits = Object.assign(emptyEdits(), obj.edits);
        if (obj && obj.records && obj.records.deviceId) records = obj.records;
      }
    } catch (e) { /* 이 기기 저장이 없으면 빈 기록 */ }
    return { edits: edits, records: records };
  }
  function persist() {
    if (!state.edits || !state.records) return Promise.resolve();
    state.records.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORE, JSON.stringify({ edits: state.edits, records: state.records })); }
    catch (e) { toast('이 기기 저장 공간이 꽉 찼어요.'); }
    return Promise.resolve();
  }
  function bump() { /* 예전 자동 잠금 타이머 자리. 이제 잠그지 않아요. */ }

  function parseHash() {
    var h = (location.hash || '#/home').replace(/^#\/?/, '');
    var q = '';
    var qi = h.indexOf('?');
    if (qi >= 0) { q = h.slice(qi + 1); h = h.slice(0, qi); }
    var parts = h.split('/').filter(Boolean);
    if (!parts.length) parts = ['home'];
    try { parts = parts.map(function (p) { return decodeURIComponent(p); }); } catch (e) { /* keep raw */ }
    return { name: parts[0], parts: parts, query: q };
  }

  function api() {
    return {
      pack: view,
      records: function () {
        if (!state.records) state.records = emptyRecords();
        return state.records;
      },
      route: parseHash,
      go: function (hash) { location.hash = hash; },
      unlocked: function () { return !!state.pack; },
      guide: function () { return state.guide || { sections: [] }; },
      esc: esc,
      won: APGrade.won,
      num: APGrade.num,
      gradeTask: APGrade.gradeTask,
      filterQuestions: APGrade.filterQuestions,
      amountText: APGrade.amountText,
      toast: toast,
      refresh: renderRoute,
      save: persist,
      touch: bump,
      patchRule: function (id, obj) {
        state.edits.rules[id] = Object.assign({}, state.edits.rules[id] || {}, obj);
        return persist();
      },
      patchTodo: function (id, obj) {
        var added = (state.edits.monthlyAdded || []).filter(function (t) { return t.id === id; })[0];
        if (added) Object.assign(added, obj);
        else state.edits.monthly[id] = Object.assign({}, state.edits.monthly[id] || {}, obj);
        return persist();
      },
      addTodo: function (obj) {
        state.edits.monthlyAdded.push(obj);
        return persist();
      },
      deleteTodo: function (id) {
        state.edits.monthlyAdded = (state.edits.monthlyAdded || []).filter(function (t) { return t.id !== id; });
        if ((state.pack.entities.monthly_todos || []).some(function (t) { return t.id === id; })) state.edits.monthlyDeleted.push(id);
        return persist();
      },
      patchBudget: function (id, obj) {
        state.edits.budget[id] = Object.assign({}, state.edits.budget[id] || {}, obj);
        return persist();
      },
      setWorkItems: function (list) {
        state.edits.work_items = list;
        return persist();
      },
      saveNews: function (item) {
        var ed = state.edits;
        ed.news = ed.news || {};
        ed.newsAdded = ed.newsAdded || [];
        ed.newsDeleted = (ed.newsDeleted || []).filter(function (id) { return id !== item.id; });
        var inPack = (state.pack.entities.news || []).some(function (n) { return n.id === item.id; });
        var idx = ed.newsAdded.findIndex(function (n) { return n.id === item.id; });
        if (idx >= 0) ed.newsAdded[idx] = Object.assign({}, ed.newsAdded[idx], item);
        else if (inPack) ed.news[item.id] = Object.assign({}, ed.news[item.id] || {}, item);
        else ed.newsAdded.push(item);
        return persist();
      },
      deleteNews: function (id) {
        var ed = state.edits;
        ed.newsAdded = (ed.newsAdded || []).filter(function (n) { return n.id !== id; });
        ed.newsDeleted = ed.newsDeleted || [];
        if ((state.pack.entities.news || []).some(function (n) { return n.id === id; }) && ed.newsDeleted.indexOf(id) < 0) ed.newsDeleted.push(id);
        if (ed.news) delete ed.news[id];
        return persist();
      },
      importNews: function (items) {
        var ed = state.edits;
        ed.newsAdded = ed.newsAdded || [];
        ed.newsDeleted = ed.newsDeleted || [];
        var have = {};
        newsRows(state.pack, ed).forEach(function (n) { have[n.id] = 1; });
        var added = 0;
        var skipped = 0;
        (items || []).forEach(function (item) {
          if (have[item.id]) { skipped += 1; return; }
          have[item.id] = 1;
          ed.newsAdded.push(item);
          added += 1;
        });
        return persist().then(function () { return { added: added, skipped: skipped }; });
      },
      saveComputer: function (item) {
        var rows = computerRows(state.pack, state.edits);
        var idx = rows.findIndex(function (r) { return r.id === item.id; });
        if (idx >= 0) rows[idx] = item;
        else rows.push(item);
        state.edits.computersList = rows;
        return persist();
      },
      importComputers: function (items) {
        var merged = APComputers.mergeImport(computerRows(state.pack, state.edits), items);
        state.edits.computersList = merged.rows;
        return persist().then(function () { return merged; });
      },
      dormState: function () { return state.edits && state.edits.dorm; },
      saveDorm: function (payload) {
        state.edits.dorm = payload;
        return persist();
      },
      scheduleState: function () { return state.edits && state.edits.schedule; },
      saveSchedule: function (payload) {
        state.edits.schedule = payload;
        return persist();
      },
      markStudy: function (day, on) {
        if (on) state.records.study.done[day] = new Date().toISOString();
        else delete state.records.study.done[day];
        state.records.continue.studyDay = day;
        return persist();
      },
      saveTask: function (id, points) {
        var t = state.records.tasks[id] || { best: 0, attempts: 0 };
        t.attempts += 1;
        t.last = points;
        t.best = Math.max(t.best || 0, points);
        t.at = new Date().toISOString();
        state.records.tasks[id] = t;
        state.records.continue.taskId = id;
        return persist();
      },
      saveDraft: function (id, draft) {
        state.records.drafts[id] = draft;
        return persist();
      },
      saveQuestion: function (id, ok) {
        state.records.questions[id] = { ok: !!ok, at: new Date().toISOString() };
        state.records.continue.questionId = id;
        try {
          if (!ok) {
            var q = JSON.parse(localStorage.getItem('ap3-wrong-queue') || '[]').filter(function (x) { return x !== id; });
            q.push(id);
            localStorage.setItem('ap3-wrong-queue', JSON.stringify(q));
          } else {
            localStorage.setItem('ap3-wrong-queue', JSON.stringify(
              JSON.parse(localStorage.getItem('ap3-wrong-queue') || '[]').filter(function (x) { return x !== id; })
            ));
          }
        } catch (e) { /* 오답 큐 저장 실패는 기록만으로 충분 */ }
        return persist();
      },
      weekEngine: function () { return weekEngine(state.pack || { entities: {}, catalogs: {} }); },
      setStudyWeek: function (weekId) {
        try {
          if (weekId) localStorage.setItem('ap3-week-override', weekId);
          else localStorage.removeItem('ap3-week-override');
        } catch (e) { /* */ }
        return Promise.resolve(weekEngine(state.pack || { entities: {}, catalogs: {} }));
      },
      setWeekForce: function (force) {
        try {
          if (force) localStorage.setItem('ap3-week-force', force);
          else localStorage.removeItem('ap3-week-force');
        } catch (e) { /* */ }
        return Promise.resolve(weekEngine(state.pack || { entities: {}, catalogs: {} }));
      },
      wrongDeck: function () {
        var self = this;
        return wrongDeckApi({ records: function () { return state.records; } });
      },
      markLearning: function (id, on) {
        if (on) state.records.learning[id] = new Date().toISOString();
        else delete state.records.learning[id];
        return persist();
      },
      exportBackup: function () {
        state.records.lastBackupAt = new Date().toISOString();
        persist();
        return { kind: 'hj-backup', savedAt: state.records.lastBackupAt, edits: state.edits, records: state.records };
      },
      importBackup: function (obj) {
        if (!obj || obj.kind !== 'hj-backup' || !obj.edits || !obj.records) return Promise.resolve(false);
        state.edits = Object.assign(emptyEdits(), obj.edits);
        state.records = obj.records.deviceId ? obj.records : emptyRecords();
        return persist().then(function () { return true; });
      },
      resetAll: function () {
        try { localStorage.removeItem(STORE); } catch (e) { /* 저장이 없어도 지운 것으로 봄 */ }
        state.edits = emptyEdits();
        state.records = emptyRecords();
        toast('이 기기의 고친 내용을 지웠어요.');
        renderRoute();
        return Promise.resolve();
      }
    };
  }

  function renderRoute() {
    var route = parseHash();
    var id = route.name;
    if (!ShellModules[id]) id = 'home';
    var tabId = id === 'practice' ? 'study' : (id === 'news' || id === 'computers' || id === 'dorm' || id === 'schedule' || id === 'banner' ? 'more' : (id === 'bots' || id === 'haksa' || id === 'coop' ? 'home' : (id === 'docreg' || id === 'who' || id === 'regular-docs' ? 'study' : id)));
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === tabId);
    });
    var el = document.getElementById('view');
    var mod = ShellModules[id];
    el.classList.remove('wide');
    el.innerHTML = '';
    try { mod.render(el, api()); }
    catch (e) {
      el.innerHTML = '<section class="card"><h2>화면을 열지 못했어요</h2><p class="muted">' + esc(e.message || e) + '</p></section>';
    }
    window.scrollTo(0, 0);
  }

  function buildTabs() {
    var nav = document.getElementById('tabs');
    nav.innerHTML = '';
    (window.MODULE_LIST || []).forEach(function (id) {
      var mod = ShellModules[id];
      if (!mod) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-tab', id);
      b.innerHTML = (mod.icon || '') + '<span>' + esc(mod.tab || id) + '</span>';
      b.onclick = function () { location.hash = '#/' + id; };
      nav.appendChild(b);
    });
  }

  function isPack(o) {
    return !!(o && o.entities && typeof o.entities === 'object');
  }

  function loadModules() {
    var base = new URL('./', document.baseURI);
    var list = (window.MODULE_LIST || []).concat(window.MODULE_EXTRA || []);
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve();
      var id = list[i++];
      return new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = new URL('js/modules/' + id + '.js?v=30', base).href;
        s.onload = function () { res(); };
        s.onerror = function () { rej(new Error(id)); };
        document.body.appendChild(s);
      }).then(next);
    }
    return next();
  }

  function paintShell() {
    var lock = document.getElementById('lock');
    if (lock) lock.remove();
    document.getElementById('shell').classList.remove('hidden');
    if (!state.edits) state.edits = emptyEdits();
    if (!state.records) state.records = emptyRecords();
    var v = view();
    document.getElementById('title').textContent = '행정 업무 연습장';
    /* 예전엔 여기 「자료 2026-10-19」(public-pack.json packVersion = 공부·규칙 자료판 만든 날)를 띄웠는데, 오늘 날짜·갱신 시각처럼 읽혀 헷갈려서 뺌.
       그 날짜는 더보기 첫 카드에 「공부·규칙 자료판 YYYY-MM-DD」로 보여요. 화면별 갱신 시각은 각 화면이 직접(달력 띠·봇 작업 현황). */
    document.getElementById('sub').textContent = '';
    document.title = '행정 업무 연습장';
    buildTabs();
    if (!location.hash) location.hash = '#/home';
    renderRoute();
  }
  function getJson(file) {
    return fetch(new URL(file, document.baseURI).href, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error(file);
      return res.json();
    });
  }
  /* 점 경로로 안쪽 칸 찾기 (예 "blocks.5", "rows.1.1"). 없으면 null */
  function walk(o, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (o == null || typeof o !== 'object' || !(keys[i] in o)) return null;
      o = o[keys[i]];
    }
    return o;
  }
  /* 원문 대조로 고친 카드 칸 덮어쓰기 (data/card_overrides.json, 키 = 묶음:id)
     목록이 아닌 묶음(manual 등)은 묶음:경로. 칸 이름에 점이 있으면 이미 있는 안쪽 칸만 바꿈.
     파이썬판: tools/link_sources.py apply_overrides (시험 tests/test_practical_std.py) */
  function applyOverrides(pack, ov) {
    if (!ov) return;
    Object.keys(ov).forEach(function (key) {
      var at = key.indexOf(':');
      if (key.charAt(0) === '_' || at < 0) return;
      var id = key.slice(at + 1), ent = pack.entities[key.slice(0, at)], targets = [];
      if (Array.isArray(ent)) targets = ent.filter(function (c) { return c && String(c.id) === id; });
      else if (ent && typeof ent === 'object') {
        var t = walk(ent, id.split('.'));
        if (t && typeof t === 'object') targets = [t];
      }
      targets.forEach(function (c) {
        Object.keys(ov[key]).forEach(function (f) {
          if (f.indexOf('.') < 0) { c[f] = ov[key][f]; return; }
          var ks = f.split('.'), last = ks.pop(), o = walk(c, ks);
          if (o && typeof o === 'object' && last in o) o[last] = ov[key][f];
        });
      });
    });
    if (ov._practical_standard) state.regNote = ov._practical_standard.note;
  }
  /* 「규정 원문 경계는 …」 메모부터 그 글 끝까지 작은 글씨로 (화면 글자만, 자료는 그대로) */
  var NO_NOTE = { TEXTAREA: 1, OPTION: 1, SCRIPT: 1, STYLE: 1, TITLE: 1 };
  function styleNotes(el) {
    var note = state.regNote;
    if (!el || !note) return;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, hits = [];
    while ((n = w.nextNode())) {
      var p = n.parentNode;
      if (n.nodeValue.indexOf(note) < 0 || !p || NO_NOTE[p.nodeName] || (p.classList && p.classList.contains('reg-note'))) continue;
      hits.push(n);
    }
    hits.forEach(function (t) {
      var rest = t.splitText(t.nodeValue.indexOf(note));
      var s = document.createElement('small');
      s.className = 'reg-note';
      s.textContent = rest.nodeValue;
      rest.parentNode.replaceChild(s, rest);
    });
  }
  /* data/extra_questions.json 의 문제를 묶음 끝에 붙임(같은 id는 건너뜀) */
  function addExtraQuestions(pack, extra) {
    if (!extra || !Array.isArray(extra.questions)) return;
    var qs = pack.entities.questions = pack.entities.questions || [];
    var have = {};
    qs.forEach(function (q) { if (q) have[q.id] = 1; });
    extra.questions.forEach(function (q) { if (q && q.id && !have[q.id]) { qs.push(q); have[q.id] = 1; } });
  }
  /* P002: competency_map_v02.json — questions/learning_items/study_days/tasks 에 competency_id 덧붙임(이미 있으면 유지) */
  function applyCompetencyMap(pack, map) {
    if (!map) return;
    var byL = map.by_학습id || map.by_업무id || {};
    var byDay = map.by_study_day || {};
    var byTask = map.by_task || {};
    var weeks = map.weeks || {};
    var dayWeek = {};
    Object.keys(weeks).forEach(function (wid) {
      (weeks[wid].study_days || []).forEach(function (d) { dayWeek[String(d)] = wid; });
    });
    (pack.entities.questions || []).forEach(function (q) {
      if (!q || q.competency_id) return;
      var cid = byL[q.업무id];
      if (cid) q.competency_id = cid;
    });
    (pack.entities.learning_items || []).forEach(function (it) {
      if (!it || it.competency_id) return;
      var cid = byL[it.id];
      if (cid) it.competency_id = cid;
    });
    (pack.entities.study_days || []).forEach(function (d) {
      if (!d) return;
      var key = String(d.day);
      if (!d.competency_id && byDay[key]) d.competency_id = byDay[key];
      if (!d.week_id && dayWeek[key]) d.week_id = dayWeek[key];
    });
    (pack.entities.tasks || []).forEach(function (t) {
      if (!t) return;
      if (!t.competency_id && byTask[t.id]) t.competency_id = byTask[t.id];
    });
    pack.catalogs = pack.catalogs || {};
    pack.catalogs.competencies = map.competencies || pack.catalogs.competencies;
    pack.catalogs.study_weeks = weeks;
    pack.catalogs.ladder = map.ladder || pack.catalogs.ladder;
    pack.catalogs.p002 = {
      deadline: map.deadline || '2027-02-28',
      weekly_hours_default: map.weekly_hours_default != null ? map.weekly_hours_default : 3,
      decisions: map.decisions || {}
    };
  }
  /* P002: t020_zero_tolerance.json — 과제·문제 붙임(같은 id 건너뜀). 파일 없어도 깨지지 않음 */
  function mergeT020(pack, zt) {
    if (!zt) return;
    if (Array.isArray(zt.questions)) addExtraQuestions(pack, { questions: zt.questions });
    if (!Array.isArray(zt.tasks)) return;
    var ts = pack.entities.tasks = pack.entities.tasks || [];
    var have = {};
    ts.forEach(function (t) { if (t) have[t.id] = 1; });
    zt.tasks.forEach(function (t) { if (t && t.id && !have[t.id]) { ts.push(t); have[t.id] = 1; } });
  }
  /* P002: 주간 엔진(04 스펙) — N주·사다리·force·주당 3h(대장 결정) */
  function weekEngine(pack) {
    var weeks = (pack.catalogs && pack.catalogs.study_weeks) || {};
    var ladder = (pack.catalogs && pack.catalogs.ladder) || {};
    var conf = (pack.catalogs && pack.catalogs.p002) || {};
    var ids = Object.keys(weeks).sort();
    var now = new Date();
    var deadline = new Date((conf.deadline || '2027-02-28') + 'T23:59:59');
    var N = Math.max(1, Math.ceil((deadline - now) / 86400000 / 7));
    var force = '';
    var hours = conf.weekly_hours_default != null ? conf.weekly_hours_default : 3;
    try {
      force = localStorage.getItem('ap3-week-force') || '';
      var h = localStorage.getItem('ap3-weekly-hours');
      if (h) hours = Number(h) || hours;
    } catch (e) { /* */ }
    /* 사다리 칸(월 기준) */
    var y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
    var ladderKey = '2026.10하~11';
    if (y > 2027 || (y === 2027 && m >= 2)) ladderKey = '2027.2';
    else if (y === 2027 && m === 1) ladderKey = '2027.1';
    else if (y === 2026 && m >= 12) ladderKey = '2026.12';
    else if (y === 2026 && (m > 11 || (m === 11) || (m === 10 && d >= 16))) ladderKey = '2026.10하~11';
    var lad = ladder[ladderKey] || {};
    if (!force && lad.force_default) force = lad.force_default;
    var override = '';
    try { override = localStorage.getItem('ap3-week-override') || ''; } catch (e2) { /* */ }
    var weekId = '';
    if (override && weeks[override]) weekId = override;
    else if (ids.length) {
      var start = new Date(now.getFullYear(), now.getMonth(), 1);
      var diff = Math.floor((now - start) / 86400000);
      weekId = ids[Math.min(ids.length - 1, Math.floor(diff / 7))] || ids[0];
    }
    var meta = weeks[weekId] || {};
    var want = {};
    (meta.study_days || []).forEach(function (x) { want[x] = 1; });
    var days = (pack.entities.study_days || []).filter(function (sd) { return want[sd.day]; });
    var learn = (pack.entities.learning_items || []).filter(function (it) {
      return it && lad.cps && lad.cps.indexOf(it.competency_id) >= 0;
    }).slice(0, hours < 3 ? 1 : 2);
    var forceTask = null;
    if (force) {
      forceTask = (pack.entities.tasks || []).filter(function (t) {
        return t && (t.id === force || t.id === force.toLowerCase() || (t.title && t.title.indexOf(force) >= 0));
      })[0] || { id: force, title: force };
    }
    return {
      weekId: weekId, label: meta.label || weekId, days: days, allWeeks: weeks,
      N: N, force: force, hours: hours, ladderKey: ladderKey, ladderLabel: lad.label || '',
      cps: lad.cps || [], learn: learn, forceTask: forceTask
    };
  }
  /* P002: 오답 덱(05) — 큐 + Anki 간격(1·3·7·14·30) + kind 시드 */
  var WRONG_Q = 'ap3-wrong-queue';
  var WRONG_META = 'ap3-wrong-meta';
  var INTERVALS = [1, 3, 7, 14, 30];
  function wrongDeckApi(api) {
    function readQ() {
      try { return JSON.parse(localStorage.getItem(WRONG_Q) || '[]'); } catch (e) { return []; }
    }
    function writeQ(arr) {
      try { localStorage.setItem(WRONG_Q, JSON.stringify(arr)); } catch (e) { /* */ }
    }
    function readMeta() {
      try { return JSON.parse(localStorage.getItem(WRONG_META) || '{}'); } catch (e) { return {}; }
    }
    function writeMeta(m) {
      try { localStorage.setItem(WRONG_META, JSON.stringify(m)); } catch (e) { /* */ }
    }
    function seedCards() {
      var pack = state.pack || {};
      return (pack.catalogs && pack.catalogs.wrong_anki && pack.catalogs.wrong_anki.cards) || [];
    }
    function missedIds() {
      var rec = (api.records() && api.records().questions) || {};
      var ids = Object.keys(rec).filter(function (id) { return rec[id] && rec[id].ok === false; });
      var q = readQ();
      q.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
      var meta = readMeta();
      var now = Date.now();
      return ids.filter(function (id) {
        var m = meta[id];
        if (!m || !m.due) return true;
        return new Date(m.due).getTime() <= now;
      });
    }
    return {
      list: missedIds,
      intervals: INTERVALS,
      seeds: seedCards,
      enqueue: function (id, kind) {
        if (!id) return;
        var q = readQ().filter(function (x) { return x !== id; });
        q.push(id);
        writeQ(q);
        var meta = readMeta();
        var step = 0;
        if (meta[id] && meta[id].ok === false) step = 0;
        meta[id] = {
          kind: kind || (meta[id] && meta[id].kind) || '',
          step: 0,
          due: new Date().toISOString(),
          ok: false
        };
        writeMeta(meta);
      },
      dequeue: function (id) {
        writeQ(readQ().filter(function (x) { return x !== id; }));
        var meta = readMeta();
        var m = meta[id] || { step: 0 };
        var step = Math.min(INTERVALS.length - 1, (m.step || 0) + 1);
        if (step >= INTERVALS.length - 1 && m.step >= INTERVALS.length - 1) {
          delete meta[id];
        } else {
          var due = new Date();
          due.setDate(due.getDate() + INTERVALS[step]);
          meta[id] = { kind: m.kind || '', step: step, due: due.toISOString(), ok: true };
        }
        writeMeta(meta);
      },
      next: function () {
        var ids = missedIds();
        return ids.length ? ids[0] : null;
      },
      meta: readMeta
    };
  }
  function loadData() {
    return Promise.all([
      getJson('public-pack.json').catch(function () { return null; }),
      getJson('dorm.json').catch(function () { return null; }),
      getJson('data/card_overrides.json').catch(function () { return null; }),
      getJson('data/ojnt_headcount.json').catch(function () { return null; }),
      getJson('data/extra_questions.json').catch(function () { return null; }),
      getJson('data/competency_map_v02.json').catch(function () { return null; }),
      getJson('data/t020_zero_tolerance.json').catch(function () { return null; }),
      getJson('data/wrong_anki_seed.json').catch(function () { return null; })
    ]).then(function (r) {
      var pack = isPack(r[0]) ? r[0] : { appTitle: '행정 업무 연습장', packVersion: '', corrections: [], catalogs: {}, entities: {} };
      if (r[1]) pack.entities.dorm = r[1];
      applyOverrides(pack, r[2]);
      if (window.APDorm && APDorm.applyHeadcount) APDorm.applyHeadcount(pack, r[3]);
      addExtraQuestions(pack, r[4]);
      applyCompetencyMap(pack, r[5]);
      mergeT020(pack, r[6]);
      pack.catalogs = pack.catalogs || {};
      if (r[7]) pack.catalogs.wrong_anki = r[7];
      pack._p002 = { competencyMap: r[5], t020: r[6], wrongAnki: r[7] };
      return pack;
    });
  }
  function registerSw() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { updateViaCache: 'none' }).then(function (reg) {
      try { reg.update(); } catch (e) { /* 다음에 다시 */ }
    }).catch(function () {});
  }
  function boot() {
    purgeOld().then(loadModules).then(function () {
      return getJson('public/guide.json').catch(function () { return { sections: [], notice: '안내 글을 불러오지 못했어요.' }; });
    }).then(function (guide) {
      state.guide = guide;
      window.addEventListener('hashchange', renderRoute);
      document.getElementById('find').onsubmit = function (e) {
        e.preventDefault();
        location.hash = '#/search/' + encodeURIComponent(document.getElementById('find-q').value.trim());
      };
      registerSw();
      var vw = document.getElementById('view');
      if (window.MutationObserver) new MutationObserver(function () { styleNotes(vw); }).observe(vw, { childList: true, subtree: true });
      return loadData();
    }).then(function (pack) {
      state.pack = pack;
      var saved = readStore();
      state.edits = saved.edits;
      state.records = saved.records;
      paintShell();
    }).catch(function (e) {
      document.getElementById('view').innerHTML = '<section class="card"><h1>화면 파일을 불러오지 못했어요</h1><p class="muted">새로고침해 주세요. (' + esc(e && e.message || e) + ')</p></section>';
    });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
