(function () {
  var show = 'open';
  var syncing = false;

  function seedOf(api) {
    return (api.pack() && api.pack().entities.schedule) || { items: [] };
  }
  function load(api) {
    var saved = api.scheduleState && api.scheduleState();
    var box = null;
    try { box = APSchedule.readBox(localStorage); } catch (e) { box = null; }
    var state = APSchedule.resolve(seedOf(api), saved, box);
    if (saved) {
      if (saved.scriptUrl) state.scriptUrl = saved.scriptUrl;
      if (saved.editKey) state.editKey = saved.editKey;
      if (!box || !box.at || (saved.at && saved.at >= box.at)) {
        state.syncedAt = saved.syncedAt || '';
      }
    }
    return state;
  }
  function saveLocal(state) {
    try {
      APSchedule.writeBox(localStorage, {
        items: state.items, pending: state.pending, at: state.at, stamp: state.stamp || ''
      });
    } catch (e) {}
  }
  function mark(state) {
    state.at = new Date().toISOString();
    state.pending = true;
    saveLocal(state);
  }
  var conflict = null;   // 시트가 그새 바뀜: { rows, hash }
  var pulled = false;
  var lastFail = 0;     // 이번에 연 뒤 시트를 한 번 읽었는지
  function linked(state) { return APSchedule.allowedUrl(state.scriptUrl) && !!state.editKey; }
  function stored(api, state) {
    saveLocal(state);
    return api.saveSchedule(APSchedule.serial(state));
  }
  function push(api, state, force) {
    if (!linked(state)) return Promise.reject(new Error('link'));
    var body = {
      action: 'schedule', key: state.editKey, editor: APSheet.editor(),
      base: force ? force : (state.base || ''),
      summary: '남은 일정 ' + state.items.length + '개 저장',
      rows: APSchedule.sheetTable(state.items, state.at)
    };
    return APSheet.post(state.scriptUrl, body).then(function (res) {
      if (res && res.conflict) {
        conflict = { rows: res.rows || [], hash: res.hash || '' };
        throw new Error('conflict');
      }
      if (!res || !res.ok) throw new Error((res && res.msg) || 'save');
      conflict = null;
      state.pending = false;
      state.base = res.hash || '';
      state.syncedAt = new Date().toISOString();
      return stored(api, state).then(function () { api.toast('시트에 저장했어요.'); });
    });
  }
  /* 열 때 시트를 읽어 다른 기기(폰↔PC)에서 고친 것을 가져옴 */
  function pull(api, state) {
    return APSheet.post(state.scriptUrl, { action: 'schedule_read', key: state.editKey }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.msg) || 'read');
      if (!res.exists || !(res.rows || []).length) {
        state.base = res.hash || '';
        state.pending = true;              // 시트에 탭이 없으면 지금 목록으로 처음 채움
        return 'seed';
      }
      var items = APSchedule.fromSheet(res.rows);
      if (state.pending && !APSchedule.sameItems(items, state.items) && state.base !== res.hash) {
        conflict = { rows: res.rows, hash: res.hash };
        return 'conflict';
      }
      if (!state.pending) state.items = items;
      state.base = res.hash || '';
      if (!state.pending) state.syncedAt = new Date().toISOString();
      return stored(api, state).then(function () { return 'ok'; });
    });
  }
  function commit(api, state) {
    mark(state);
    api.refresh();
    return api.saveSchedule(APSchedule.serial(state)).then(function () {
      if (!linked(state)) {
        api.toast('이 기기에 저장했어요.');
        return;
      }
      return push(api, state).catch(function (err) {
        api.toast(err && err.message === 'conflict' ? '시트가 그새 바뀌었어요. 위에서 골라 주세요.' : '시트에 못 올렸어요. 이 기기에 저장해 두었어요.');
        api.refresh();
      });
    });
  }
  function maybeSync(api, state) {
    if (syncing || conflict || !linked(state) || Date.now() - lastFail < 30000) return;
    syncing = true;
    var job = pulled ? Promise.resolve('skip') : pull(api, state).then(function (r) { pulled = true; return r; });
    job.then(function (r) {
      if (r === 'conflict') return 'conflict';
      if (state.pending) return push(api, state).then(function () { return 'pushed'; });
      return r;
    }).then(function (r) {
      syncing = false;
      if (r !== 'skip') api.refresh();
    }, function () {
      syncing = false;
      lastFail = Date.now();   // 30초 동안은 저절로 다시 안 보냄(버튼으로는 됨)
      api.refresh();
    });
  }

  function render(el, api) {
    el.classList.add('sched-page');
    var part = api.route().parts[1] || '';
    if (part === 'new') return form(el, api, null);
    if (part === 'link') return link(el, api);
    if (part) return form(el, api, part);
    list(el, api);
  }

  function list(el, api) {
    var state = load(api);
    var today = new Date();
    var c = APSchedule.counts(state.items, today);
    var groups = APSchedule.groups(state.items, today).filter(function (g) {
      if (show === 'done') return g.id === 'done';
      if (show === 'open') return g.id !== 'done';
      return true;
    });
    var h = '<button class="linkish" id="back" type="button">← 더보기</button>';
    h += '<section class="card sched-head"><p class="kicker">현황판</p><h1>남은 일정</h1>';
    h += '<div class="statgrid"><div><b>' + c.over + '</b><span>지남</span></div><div><b>' + c.today + '</b><span>오늘</span></div><div><b>' + c.week + '</b><span>이번 주</span></div><div><b>' + c.open + '</b><span>남은 일</span></div></div>';
    var dated = state.items.filter(function (it) { return it.date; }).length;
    h += '<p class="muted" id="count">전체 ' + state.items.length + '개 · 날짜 있는 일 ' + dated + ' · 수시 ' + (state.items.length - dated) + '</p>';
    h += '<p class="muted" id="sync">' + api.esc(statusText(state)) + '</p>';
    if (conflict) {
      h += '<div class="sched-conflict" id="conflict"><b>시트가 다른 기기에서 먼저 바뀌었어요.</b><p class="muted">시트 ' + conflict.rows.length + '개 · 이 기기 ' + state.items.length + '개. 어느 쪽을 남길까요?</p>' +
        '<div class="row"><button class="btn" id="take" type="button">시트 것 받기</button><button class="btn-ghost" id="mine" type="button">이 기기 것으로 시트 덮기</button></div></div>';
    }
    h += '<div class="row"><button class="btn" id="add" type="button">일정 추가</button>';
    if (state.pending && linked(state) && !conflict) h += '<button class="btn-ghost" id="retry" type="button">시트로 다시 보내기</button>';
    h += '<button class="btn-ghost" id="link" type="button">시트 연결</button></div></section>';
    h += '<div class="chips"><button class="chip' + (show === 'open' ? ' on' : '') + '" type="button" data-show="open">남은 일</button>';
    h += '<button class="chip' + (show === 'all' ? ' on' : '') + '" type="button" data-show="all">전체</button>';
    h += '<button class="chip' + (show === 'done' ? ' on' : '') + '" type="button" data-show="done">완료 ' + c.done + '</button></div>';
    if (!state.items.length) {
      h += '<section class="card"><p>남은 일정이 없어요.</p><p class="muted">추가로 적으면 이 기기에 바로 저장돼요.</p></section>';
    } else if (!groups.length) {
      h += '<section class="card"><p class="muted">' + (show === 'done' ? '완료한 일정이 없어요.' : '남은 일정이 없어요.') + '</p></section>';
    }
    groups.forEach(function (g) {
      h += '<h2 class="sched-group ' + g.id + '">' + g.title + '</h2>';
      g.items.forEach(function (item) { h += row(api, item, today); });
    });
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelector('#add').onclick = function () { api.go('#/schedule/new'); };
    el.querySelector('#link').onclick = function () { api.go('#/schedule/link'); };
    var retry = el.querySelector('#retry');
    if (retry) retry.onclick = function () {
      syncing = true;
      push(api, state).then(function () { syncing = false; api.refresh(); }, function () {
        syncing = false;
        api.toast('시트에 못 올렸어요. 이 기기에 저장해 두었어요.');
        api.refresh();
      });
    };
    var take = el.querySelector('#take');
    if (take) take.onclick = function () {
      state.items = APSchedule.fromSheet(conflict.rows);
      state.base = conflict.hash;
      state.pending = false;
      state.syncedAt = new Date().toISOString();
      conflict = null;
      stored(api, state).then(function () { api.toast('시트 것을 받았어요.'); api.refresh(); });
    };
    var mine = el.querySelector('#mine');
    if (mine) mine.onclick = function () {
      var h2 = conflict.hash;
      conflict = null;
      push(api, state, h2).then(function () { api.refresh(); }, function () { api.toast('시트에 못 올렸어요.'); api.refresh(); });
    };
    el.querySelectorAll('[data-show]').forEach(function (b) {
      b.onclick = function () { show = b.getAttribute('data-show'); api.refresh(); };
    });
    el.querySelectorAll('[data-check]').forEach(function (b) {
      b.onclick = function () {
        state.items = APSchedule.toggle(state.items, b.getAttribute('data-check'));
        commit(api, state);
      };
    });
    el.querySelectorAll('[data-open]').forEach(function (b) {
      b.onclick = function () { api.go('#/schedule/' + b.getAttribute('data-open')); };
    });
    maybeSync(api, state);
  }

  function statusText(state) {
    if (syncing) return '시트와 맞추는 중…';
    if (linked(state) && state.syncedAt && !state.pending) return '✅ 시트와 같아요 · ' + hm(state.syncedAt);
    if (state.pending && linked(state)) return '⚠️ 이 기기에 저장해 두었어요. 인터넷이 되면 시트로 다시 보내요.';
    if (!linked(state)) return '이 기기에만 저장돼요. 폰·PC가 같이 보려면 「시트 연결」을 한 번 해요.';
    return '이 기기에 저장돼요.';
  }
  function hm(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return (d.getMonth() + 1) + '.' + d.getDate() + '. ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function row(api, item, today) {
    var b = APSchedule.bucket(item, today);
    var pill = item.done ? 'done' : b;
    var h = '<article class="sched-row' + (item.done ? ' done' : '') + '">';
    h += '<button class="sched-check' + (item.done ? ' on' : '') + '" type="button" data-check="' + api.esc(item.id) + '" aria-pressed="' + (item.done ? 'true' : 'false') + '" aria-label="완료"></button>';
    h += '<button class="sched-main" type="button" data-open="' + api.esc(item.id) + '">';
    h += '<div class="sched-line"><b class="sched-title">' + api.esc(item.title) + '</b>';
    h += '<span class="pill ' + pill + '">' + api.esc(APSchedule.dday(item, today)) + '</span></div>';
    h += '<div class="sched-meta"><span class="pill soft">' + api.esc(APSchedule.whenLabel(item, today)) + '</span>';
    if (!item.done && b === 'today') h += ' <span class="pill today">오늘</span>';
    else if (!item.done && b === 'week') h += ' <span class="pill week">이번 주</span>';
    else if (!item.done && b === 'over') h += ' <span class="pill over">지남</span>';
    if (item.needsConfirm && !item.done) h += ' <span class="badge warn">확인 필요</span>';
    if (item.owner) h += ' <span>' + api.esc(item.owner) + '</span>';
    h += '</div>';
    if (item.memo || item.confirmNote) h += '<div class="sched-note">' + api.esc(item.confirmNote || item.memo) + '</div>';
    h += '</button></article>';
    return h;
  }

  function form(el, api, id) {
    var state = load(api);
    var item = id ? state.items.filter(function (it) { return it.id === id; })[0] : null;
    if (id && !item) {
      el.innerHTML = '<section class="card"><h1>일정을 찾지 못했어요</h1><button class="btn" id="back" type="button">목록</button></section>';
      el.querySelector('#back').onclick = function () { api.go('#/schedule'); };
      return;
    }
    item = item || { id: '', date: '', end: '', title: '', owner: '', memo: '', done: false, needsConfirm: false, confirmNote: '' };
    var h = '<button class="linkish" id="back" type="button">← 남은 일정</button>';
    h += '<section class="card"><h1>' + (id ? '일정 고치기' : '일정 추가') + '</h1>';
    h += field('할 일', '<input id="f-title" type="text" value="' + api.esc(item.title) + '" autocomplete="off">');
    h += '<div class="row sched-dates">' + field('날짜', '<input id="f-date" type="date" value="' + api.esc(item.date) + '">');
    h += field('끝 날짜', '<input id="f-end" type="date" value="' + api.esc(item.end) + '">') + '</div>';
    h += '<p class="muted">하루짜리는 끝 날짜를 비워요. 날짜가 없으면 수시예요.</p>';
    h += field('담당', '<input id="f-owner" type="text" value="' + api.esc(item.owner) + '" autocomplete="off">');
    h += field('메모', '<textarea id="f-memo">' + api.esc(item.memo) + '</textarea>');
    h += '<label class="opt"><input id="f-confirm" type="checkbox"' + (item.needsConfirm ? ' checked' : '') + '> 확인 필요</label>';
    h += field('확인 메모', '<input id="f-note" type="text" value="' + api.esc(item.confirmNote) + '" autocomplete="off">');
    h += '<label class="opt"><input id="f-done" type="checkbox"' + (item.done ? ' checked' : '') + '> 완료</label>';
    h += '<button class="btn block" id="save" type="button">저장</button>';
    if (id) h += '<button class="btn-ghost block" id="del" type="button">삭제</button>';
    h += '</section>';
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/schedule'); };
    el.querySelector('#save').onclick = function () {
      var raw = readForm(el);
      if (!raw.title) { api.toast('할 일을 적어 주세요.'); return; }
      var next = id ? APSchedule.update(state.items, id, raw) : APSchedule.add(state.items, raw);
      if (!next.ok) { api.toast('저장하지 못했어요.'); return; }
      state.items = next.items;
      commit(api, state).then(function () { api.go('#/schedule'); });
    };
    var del = el.querySelector('#del');
    if (del) del.onclick = function () {
      if (del.getAttribute('data-sure') !== '1') {
        del.textContent = '정말 삭제';
        del.setAttribute('data-sure', '1');
        return;
      }
      state.items = APSchedule.remove(state.items, id);
      commit(api, state).then(function () { api.go('#/schedule'); });
    };
  }
  function field(label, input) {
    return '<label class="field"><span>' + label + '</span>' + input + '</label>';
  }
  function readForm(el) {
    return {
      title: el.querySelector('#f-title').value,
      date: el.querySelector('#f-date').value,
      end: el.querySelector('#f-end').value,
      owner: el.querySelector('#f-owner').value,
      memo: el.querySelector('#f-memo').value,
      needsConfirm: el.querySelector('#f-confirm').checked,
      confirmNote: el.querySelector('#f-note').value,
      done: el.querySelector('#f-done').checked
    };
  }

  function link(el, api) {
    var state = load(api);
    var seed = seedOf(api);
    var h = '<button class="linkish" id="back" type="button">← 남은 일정</button>';
    h += '<section class="card"><h1>시트 연결</h1>';
    h += '<p>고친 일정은 「' + api.esc(seed.sheetTitle || '업무 현황판') + '」 ' + api.esc(seed.tab || '남은일정') + ' 탭에 올립니다.</p>';
    h += '<p class="muted">기숙사 현황판도 이 연결을 같이 써요. 웹앱 주소와 수정 열쇠는 이 기기 저장에만 둡니다. 화면 코드에는 넣지 않아요. 열쇠는 비워 두면 이미 있는 값을 유지해요. 폰과 PC에 한 번씩 넣어요.</p>';
    h += field('웹앱 주소', '<input id="f-url" type="url" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="' + api.esc(state.scriptUrl || '') + '">');
    h += field('수정 열쇠', '<input id="f-key" class="mask" type="text" autocomplete="off" value="">');
    if (seed.sheetUrl) h += '<p><a class="btn-ghost" id="sheet" href="' + api.esc(seed.sheetUrl) + '" target="_blank" rel="noopener">시트 열기</a></p>';
    h += '<button class="btn block" id="save" type="button">연결 저장 후 보내기</button>';
    h += '<p class="muted" id="sync">' + api.esc(statusText(state)) + '</p></section>';
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/schedule'); };
    el.querySelector('#save').onclick = function () {
      var url = el.querySelector('#f-url').value.trim();
      var key = el.querySelector('#f-key').value;
      if (url && !APSchedule.allowedUrl(url)) {
        api.toast('웹앱 주소는 script.google.com 의 /exec 주소예요.');
        return;
      }
      state.scriptUrl = url;
      if (key) state.editKey = key;
      el.querySelector('#f-key').value = '';
      pulled = false;
      conflict = null;
      stored(api, state).then(function () { api.toast(url ? '연결을 저장했어요. 시트와 맞춰요.' : '연결을 뺐어요.'); api.go('#/schedule'); });
    };
  }

  window.ShellModules.schedule = { render: render };
})();
