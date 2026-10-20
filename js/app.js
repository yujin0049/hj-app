/* 빈 껍데기. 기관 내용·사람 이름·금액은 가져온 데이터 묶음에만 있어요. */
(function () {
  'use strict';
  var PIN_ITER = 100000;
  var BACKUP_ITER = 150000;
  var LOCK_MS = 5 * 60 * 1000;
  var DB_NAME = 'ap3';

  var state = {
    pin: null, key: null, env: null, pack: null, edits: null, records: null, guide: null,
    fails: 0, lockedUntil: 0, lastActive: Date.now(), hiddenAt: 0, booted: false
  };
  window.ShellModules = window.ShellModules || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function emptyEdits() {
    return { rules: {}, monthly: {}, monthlyAdded: [], monthlyDeleted: [], budget: {}, work_items: null, news: {}, newsAdded: [], newsDeleted: [], computersList: null, dorm: null };
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
  function emptyRecords() {
    var id = (crypto.randomUUID && crypto.randomUUID()) || ('d' + Date.now());
    return { deviceId: id, updatedAt: new Date().toISOString(), tasks: {}, questions: {}, study: { done: {} }, learning: {}, continue: {}, drafts: {}, lastBackupAt: null };
  }
  function waitMs(fails) {
    if (fails < 5) return 0;
    return Math.min(15 * 60 * 1000, 30000 * Math.pow(2, fails - 5));
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

  function openDb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet(key) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv', 'readonly');
        var q = tx.objectStore('kv').get(key);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function idbSet(key, val) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbDel(key) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(key);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function view() {
    var p = state.pack;
    if (!p) return null;
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
      entities: Object.assign({}, p.entities, { rules: rules, monthly_todos: todos, budget_lines: budget, work_items: work, news: newsRows(p, ed), computers: computerRows(p, ed) })
    };
  }

  function payload() {
    state.records.updatedAt = new Date().toISOString();
    return { pack: state.pack, edits: state.edits, records: state.records, savedAt: state.records.updatedAt };
  }
  function persist() {
    if (!state.key || !state.env) return Promise.resolve();
    return APCrypto.encryptWithKey(payload(), state.key, { iter: state.env.iter, salt: state.env.salt }).then(function (env) {
      state.env = env;
      return idbSet('vault', { env: env, fails: state.fails || 0, lockedUntil: 0 });
    });
  }

  function bump() { state.lastActive = Date.now(); }
  function setLockButton() {
    var b = document.getElementById('lock-btn');
    if (b) b.textContent = state.key ? '잠금' : '열기';
  }
  function lockNow() {
    state.pin = null;
    state.key = null;
    state.pack = null;
    state.edits = null;
    state.records = null;
    document.getElementById('lock').classList.add('hidden');
    document.getElementById('shell').classList.remove('hidden');
    document.title = '행정 연습장';
    var title = document.getElementById('title');
    if (title) title.textContent = '행정 연습장';
    var sub = document.getElementById('sub');
    if (sub) sub.textContent = '';
    setLockButton();
    var id = parseHash().name;
    if (window.MODULE_LOCK && window.MODULE_LOCK[id]) location.hash = '#/home';
    else renderRoute();
  }
  function armWatch() {
    document.addEventListener('pointerdown', bump);
    document.addEventListener('keydown', bump);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) state.hiddenAt = Date.now();
      else if (state.key && state.hiddenAt && Date.now() - state.hiddenAt >= LOCK_MS) lockNow();
      else state.hiddenAt = 0;
    });
    setInterval(function () {
      if (state.key && Date.now() - state.lastActive >= LOCK_MS) lockNow();
    }, 15000);
  }

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
      records: function () { return state.records; },
      route: parseHash,
      go: function (hash) { location.hash = hash; },
      unlocked: function () { return !!state.key; },
      guide: function () { return state.guide || { sections: [] }; },
      openLock: function () { showUnlock(); },
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
      lock: lockNow,
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
        return persist();
      },
      markLearning: function (id, on) {
        if (on) state.records.learning[id] = new Date().toISOString();
        else delete state.records.learning[id];
        return persist();
      },
      exportSealed: function (secret, mode) {
        var body = mode === 'pack' ? { kind: 'pack', pack: state.pack, edits: state.edits } : { kind: 'backup', pack: state.pack, edits: state.edits, records: state.records };
        return APCrypto.encryptJson(body, secret, BACKUP_ITER).then(function (r) {
          state.records.lastBackupAt = new Date().toISOString();
          return persist().then(function () { return r.env; });
        });
      },
      changePin: function (next) {
        return APCrypto.encryptJson(payload(), next, PIN_ITER).then(function (r) {
          state.pin = next;
          state.key = r.key;
          state.env = r.env;
          return idbSet('vault', { env: r.env, fails: 0, lockedUntil: 0 });
        });
      },
      resetAll: function () {
        return idbDel('vault').then(function () { lockNow(); showImport(); });
      },
      importText: importText,
      replacePack: function (pack, opts) {
        opts = opts || {};
        state.pack = pack;
        if (!opts.keepEdits) state.edits = emptyEdits();
        if (!opts.keepRecords) state.records = emptyRecords();
        return persist();
      }
    };
  }

  function renderRoute() {
    var route = parseHash();
    var id = route.name;
    if (!ShellModules[id]) id = 'home';
    var tabId = id === 'practice' ? 'study' : (id === 'news' || id === 'computers' || id === 'dorm' ? 'more' : id);
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === tabId);
    });
    if (window.MODULE_LOCK && window.MODULE_LOCK[id] && !state.key) {
      showUnlock();
      return;
    }
    document.getElementById('lock').classList.add('hidden');
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

  function enterApp() {
    document.getElementById('lock').classList.add('hidden');
    document.getElementById('shell').classList.remove('hidden');
    setLockButton();
    var v = view();
    document.getElementById('title').textContent = v.appTitle;
    document.getElementById('sub').textContent = v.packVersion ? ('묶음 ' + v.packVersion) : '';
    document.title = v.appTitle;
    buildTabs();
    if (!location.hash) location.hash = '#/home';
    renderRoute();
    bump();
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

  function keypad(onDone, opts) {
    opts = opts || {};
    var entered = '';
    var wrap = document.createElement('div');
    var dots = document.createElement('div');
    dots.className = 'dots';
    function paint() {
      dots.innerHTML = '';
      for (var i = 0; i < 6; i++) {
        var s = document.createElement('i');
        if (i < entered.length) s.className = 'on';
        dots.appendChild(s);
      }
    }
    paint();
    var pad = document.createElement('div');
    pad.className = 'pad';
    function push(d) {
      if (entered.length >= 6) return;
      entered += d;
      paint();
      if (entered.length === 6) onDone(entered, reset);
    }
    function reset() { entered = ''; paint(); }
    '123456789'.split('').forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = d;
      b.setAttribute('data-k', d);
      b.onclick = function () { push(d); };
      pad.appendChild(b);
    });
    var blank = document.createElement('button');
    blank.type = 'button';
    blank.className = 'ghost';
    blank.tabIndex = -1;
    blank.setAttribute('aria-hidden', 'true');
    var zero = document.createElement('button');
    zero.type = 'button';
    zero.textContent = '0';
    zero.setAttribute('data-k', '0');
    zero.onclick = function () { push('0'); };
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'ghost';
    back.textContent = '지움';
    back.setAttribute('aria-label', '한 자리 지우기');
    back.onclick = function () { entered = entered.slice(0, -1); paint(); };
    pad.appendChild(blank);
    pad.appendChild(zero);
    pad.appendChild(back);
    wrap.appendChild(dots);
    wrap.appendChild(pad);
    return wrap;
  }

  function lockBox(html) {
    var root = document.getElementById('lock');
    root.classList.remove('hidden');
    root.innerHTML = '<div class="panel card">' + html + '</div>';
    return root.querySelector('.panel');
  }

  function showImport() {
    var panel = lockBox(
      '<p class="kicker">빈 앱</p><h1>행정 연습장</h1>' +
      '<p>이 화면에는 업무 내용이 없어요. 데이터 묶음 파일을 가져온 뒤, 6자리 PIN으로 이 기기에만 잠가 저장해요.</p>' +
      '<div class="warnbox"><b>PIN을 잊으면 복구할 수 없어요.</b><br>초기화하고 묶음을 다시 가져와야 해요. 점수는 백업이 있을 때만 되살릴 수 있어요.</div>' +
      '<p class="muted">홈 화면에 추가하면 앱처럼 열려요. Safari 공유 단추 → 홈 화면에 추가. 묶음은 홈 화면 앱에서 가져오세요.</p>' +
      '<label class="btn block" for="pack-file">데이터 묶음 가져오기</label>' +
      '<input id="pack-file" type="file" accept="application/json,.json" class="hidden">' +
      '<p id="import-msg" class="muted"></p>' +
      '<button class="btn-ghost block" id="pub" type="button">학생 안내만 보기</button>'
    );
    panel.querySelector('#pub').onclick = function () {
      document.getElementById('lock').classList.add('hidden');
      location.hash = '#/students';
    };
    panel.querySelector('#pack-file').onchange = function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        importText(String(reader.result || ''), null).then(function (info) {
          if (!info.ok) { panel.querySelector('#import-msg').textContent = info.message; return; }
          if (info.needSecret) askSecret(String(reader.result || ''));
          else askNewPin(info.pack, info.restored);
        }).catch(function (err) {
          panel.querySelector('#import-msg').textContent = '파일을 읽지 못했어요.';
        });
      };
      reader.readAsText(file);
    };
  }

  function askSecret(text) {
    var panel = lockBox(
      '<p class="kicker">잠긴 파일</p><h1>암호 입력</h1>' +
      '<p>이 파일은 PIN이 아니라 8자 이상 암호로 잠겨 있어요.</p>' +
      '<label class="field"><span>암호</span><input id="pw" type="text" autocomplete="off" autocapitalize="off"></label>' +
      '<button class="btn block" id="pw-go" type="button">열기</button>' +
      '<p id="import-msg" class="muted"></p>' +
      '<button class="btn-ghost block" id="back" type="button">뒤로</button>'
    );
    panel.querySelector('#back').onclick = showImport;
    panel.querySelector('#pw-go').onclick = function () {
      var pw = panel.querySelector('#pw').value;
      importText(text, pw).then(function (info) {
        if (!info.ok) { panel.querySelector('#import-msg').textContent = info.message; return; }
        askNewPin(info.pack, info.restored);
      });
    };
  }

  function isPack(o) {
    return !!(o && o.format === 'admin-practice-pack' && o.entities && Array.isArray(o.entities.tasks) && Array.isArray(o.entities.rules) && Array.isArray(o.entities.questions) && Array.isArray(o.entities.study_days));
  }

  function importText(text, secret) {
    var obj;
    try { obj = JSON.parse(text); }
    catch (e) { return Promise.resolve({ ok: false, message: 'JSON 파일이 아니에요.' }); }
    if (obj && obj.sealed) {
      if (!secret) return Promise.resolve({ ok: false, needSecret: true, message: '암호가 필요해요.' });
      if (String(secret).length < 8) return Promise.resolve({ ok: false, message: '암호는 8자 이상이에요.' });
      return APCrypto.decryptJson(obj, secret).then(function (r) {
        if (!r.ok) return { ok: false, message: '암호가 맞지 않아요.' };
        var body = r.value || {};
        var pack = body.pack || (isPack(body) ? body : null);
        if (!isPack(pack)) return { ok: false, message: '묶음 형식이 아니에요.' };
        return { ok: true, pack: pack, restored: body.records ? body : null };
      });
    }
    if (!isPack(obj)) return Promise.resolve({ ok: false, message: '데이터 묶음 형식이 아니에요.' });
    return Promise.resolve({ ok: true, pack: obj, restored: null });
  }

  function askNewPin(pack, restored) {
    var first = '';
    var panel = lockBox(
      '<p class="kicker">PIN</p><h1>6자리 PIN 정하기</h1>' +
      '<p id="pin-help">같은 번호를 한 번 더 입력해요. 이 PIN은 어디에도 저장하지 않아요.</p>' +
      '<div class="warnbox">잊으면 복구할 수 없어요.</div><div id="pad"></div>'
    );
    panel.querySelector('#pad').appendChild(keypad(function (pin, reset) {
      if (!first) {
        first = pin;
        panel.querySelector('#pin-help').textContent = '한 번 더 눌러 주세요.';
        reset();
        return;
      }
      if (pin !== first) {
        first = '';
        panel.querySelector('#pin-help').textContent = '두 번이 달랐어요. 처음부터 다시 정해요.';
        reset();
        return;
      }
      var edits = (restored && restored.edits) || emptyEdits();
      var records = (restored && restored.records) || emptyRecords();
      var body = { pack: pack, edits: edits, records: records, savedAt: new Date().toISOString() };
      APCrypto.encryptJson(body, pin, PIN_ITER).then(function (r) {
        state.pin = pin;
        state.key = r.key;
        state.env = r.env;
        state.pack = pack;
        state.edits = edits;
        state.records = records;
        state.fails = 0;
        return idbSet('vault', { env: r.env, fails: 0, lockedUntil: 0 });
      }).then(function () {
        var done = lockBox(
          '<h1>저장했어요</h1>' +
          '<div class="warnbox">원본 파일을 파일 앱에서 지워 주세요. PIN을 잊으면 복구할 수 없어요. 백업은 설정에서, PIN과 다른 8자 이상 암호로 내보내요.</div>' +
          '<button class="btn block" id="go" type="button">시작하기</button>'
        );
        done.querySelector('#go').onclick = enterApp;
      });
    }));
  }

  function showUnlock() {
    idbGet('vault').then(function (vault) {
      if (!vault || !vault.env) { showImport(); return; }
      state.fails = vault.fails || 0;
      state.lockedUntil = vault.lockedUntil || 0;
      var left = state.lockedUntil - Date.now();
      var panel = lockBox(
        '<p class="kicker">잠금</p><h1>PIN 6자리</h1>' +
        '<p class="muted">5분 동안 쉬거나 화면을 벗어나면 다시 잠겨요.</p>' +
        '<p id="lock-msg" class="warnbox"' + (left > 0 ? '' : ' hidden') + '>' + (left > 0 ? ('잠시 뒤 다시 시도해요. ' + Math.ceil(left / 1000) + '초') : '') + '</p>' +
        '<div id="pad"></div>' +
        '<p class="muted">PIN을 잊었다면 복구할 수 없어요. 아래는 이 기기의 저장만 지워요.</p>' +
        '<button class="btn-ghost block" id="wipe" type="button">저장 지우고 묶음 다시 가져오기</button>' +
        '<button class="btn-ghost block" id="pub" type="button">학생 안내만 보기</button>'
      );
      panel.querySelector('#pub').onclick = function () {
        document.getElementById('lock').classList.add('hidden');
        if (window.MODULE_LOCK && window.MODULE_LOCK[parseHash().name]) location.hash = '#/students';
      };
      panel.querySelector('#wipe').onclick = function () {
        if (confirm('이 기기에 잠긴 내용과 점수를 지울까요? PIN으로는 되돌릴 수 없어요.')) {
          idbDel('vault').then(showImport);
        }
      };
      if (left > 0) return;
      panel.querySelector('#pad').appendChild(keypad(function (pin, reset) {
        APCrypto.decryptJson(vault.env, pin).then(function (r) {
          if (!r.ok) {
            state.fails += 1;
            var wait = waitMs(state.fails);
            var until = wait ? Date.now() + wait : 0;
            state.lockedUntil = until;
            idbSet('vault', { env: vault.env, fails: state.fails, lockedUntil: until }).then(function () {
              var msg = panel.querySelector('#lock-msg');
              msg.classList.remove('hidden');
              msg.textContent = wait ? ('PIN이 아니에요. ' + Math.ceil(wait / 1000) + '초 뒤에 다시 시도해요.') : 'PIN이 아니에요.';
              reset();
              if (wait) panel.querySelector('#pad').innerHTML = '';
            });
            return;
          }
          var body = r.value || {};
          state.pin = pin;
          state.key = r.key;
          state.env = vault.env;
          state.pack = body.pack;
          state.edits = body.edits || emptyEdits();
          state.records = body.records || emptyRecords();
          state.fails = 0;
          idbSet('vault', { env: vault.env, fails: 0, lockedUntil: 0 }).then(enterApp);
        });
      }));
    }).catch(function () {
      lockBox('<h1>저장소를 열 수 없어요</h1><p>브라우저가 암호화를 지원하는 주소(https 또는 이 컴퓨터의 로컬 주소)에서 열어 주세요.</p>');
    });
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
        s.src = new URL('js/modules/' + id + '.js', base).href;
        s.onload = function () { res(); };
        s.onerror = function () { rej(new Error(id)); };
        document.body.appendChild(s);
      }).then(next);
    }
    return next();
  }

  function boot() {
    if (!crypto.subtle) {
      lockBox('<h1>암호화를 쓸 수 없어요</h1><p>https 주소로 열어 주세요.</p>');
      return;
    }
    loadModules().then(function () {
      return fetch(new URL('public/guide.json', document.baseURI).href).then(function (r) {
        if (!r.ok) throw new Error('guide');
        return r.json();
      }).catch(function () { return { sections: [], notice: '안내 글을 불러오지 못했어요.' }; });
    }).then(function (guide) {
      state.guide = guide;
      armWatch();
      window.addEventListener('hashchange', function () { bump(); renderRoute(); });
      document.getElementById('find').onsubmit = function (e) {
        e.preventDefault();
        bump();
        location.hash = '#/search/' + encodeURIComponent(document.getElementById('find-q').value.trim());
      };
      document.getElementById('lock-btn').onclick = function () {
        if (state.key) lockNow();
        else showUnlock();
      };
      if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch(function () {});
      }
      document.getElementById('shell').classList.remove('hidden');
      setLockButton();
      buildTabs();
      if (!location.hash) location.hash = '#/home';
      renderRoute();
    }).catch(function () {
      lockBox('<h1>화면 파일을 불러오지 못했어요</h1><p>같은 폴더의 파일을 함께 올려 두었는지 확인해 주세요.</p>');
    });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
