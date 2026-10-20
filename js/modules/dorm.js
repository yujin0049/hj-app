(function () {
  var SEL = null;
  var lastTap = { id: '', t: 0 };
  var showLog = false;
  var editing = null;

  function seedOf(api) { return (api.pack() && api.pack().entities.dorm) || { rows: [] }; }
  function load(api) {
    var saved = api.dormState && api.dormState();
    return saved ? APDorm.hydrate(seedOf(api), saved) : APDorm.createState(seedOf(api));
  }
  function modeOf(api) {
    var q = new URLSearchParams(api.route().query || '');
    return q.get('mode') === 'plan' ? 'plan' : 'cur';
  }
  function goMode(api, mode) { api.go(mode === 'plan' ? '#/dorm?mode=plan' : '#/dorm'); }
  function won(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
  function finePointer() {
    return window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  }

  /* ── 시트 「기숙사」 탭 바로 저장 (남은 일정과 같은 연결) ── */
  var META = 'ap3-dorm-sheet';
  var sync = { busy: false, timer: null, conflict: null, pulled: false, lastFail: 0, msg: '' };
  function meta() {
    try { return JSON.parse(localStorage.getItem(META) || 'null') || null; } catch (e) { return null; }
  }
  function setMeta(m) { try { localStorage.setItem(META, JSON.stringify(m)); } catch (e) {} }
  function getMeta(api) {
    var m = meta();
    if (!m) m = { pending: !!(api.dormState && api.dormState()), base: '', planBase: '', syncedAt: '' };
    return m;
  }
  function link(api) {
    var s = (api.scheduleState && api.scheduleState()) || {};
    var url = s.scriptUrl || '';
    var key = s.editKey || '';
    return (window.APSchedule && APSchedule.allowedUrl(url) && key) ? { url: url, key: key } : null;
  }
  function sheetRows(rows, plan) {
    return (rows || []).map(function (raw) {
      var r = APDorm.cleanRow(raw);
      var o = {};
      APDorm.COLS.slice(0, 8).forEach(function (c) { o[c] = r[c] || ''; });
      if (plan) o['원래 호실'] = raw._from || '';
      return o;
    });
  }
  function fromSheet(list, plan) {
    return (list || []).map(function (o) {
      var r = APDorm.cleanRow(o);
      if (plan && o['원래 호실']) r._from = o['원래 호실'];
      return r;
    });
  }
  function sig(rows) {
    return JSON.stringify(sheetRows(rows).map(function (o) { return APDorm.COLS.slice(0, 8).map(function (c) { return o[c]; }).join('|'); }).sort());
  }
  function adopt(api, st, res) {
    st.rows = APDorm.ensureIds(fromSheet(res.rows));
    if (res.plan && res.plan.rows && res.plan.rows.length) st.plan = APDorm.ensureIds(fromSheet(res.plan.rows, true));
    APDorm.normalize(st, st.rows, 'cur');
    if (st.plan) APDorm.normalize(st, st.plan, 'plan');
    st.undo = [];
    APDorm.addLog(st, 'cur', '시트에서 받음', '-', res.rows.length + '줄');
    return api.saveDorm(APDorm.serial(st));
  }
  function push(api, force) {
    var L = link(api);
    if (!L) return Promise.reject(new Error('link'));
    var m = getMeta(api);
    var st = load(api);
    return APSheet.post(L.url, { action: 'read', key: L.key }).then(function (cur) {
      if (!cur || !cur.ok) throw new Error((cur && cur.msg) || 'read');
      if (!force && cur.hash !== m.base && sig(cur.rows) !== sig(st.rows)) {
        sync.conflict = cur;
        throw new Error('conflict');
      }
      var body = {
        action: 'sync', key: L.key, editor: APSheet.editor(),
        summary: '연습장 기숙사 ' + st.rows.length + '줄' + (st.plan ? ' + 겨울계획 ' + st.plan.length + '줄' : '') + ' 저장',
        cur: { replace: sheetRows(st.rows), base: cur.hash }
      };
      if (st.plan) body.plan = { replace: sheetRows(st.plan, true), base: (cur.plan && cur.plan.hash) || '' };
      return APSheet.post(L.url, body);
    }).then(function (res) {
      if (res && res.conflict) { sync.conflict = res; throw new Error('conflict'); }
      if (!res || !res.ok) throw new Error((res && res.msg) || 'save');
      sync.conflict = null;
      setMeta({ pending: false, base: res.hash || '', planBase: (res.plan && res.plan.hash) || '', syncedAt: new Date().toISOString() });
    });
  }
  function pull(api) {
    var L = link(api);
    var m = getMeta(api);
    return APSheet.post(L.url, { action: 'read', key: L.key }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.msg) || 'read');
      var st = load(api);
      var same = sig(res.rows) === sig(st.rows);
      if (same) { m.base = res.hash; if (!m.pending) m.syncedAt = new Date().toISOString(); setMeta(m); return 'same'; }
      if (m.pending && res.hash !== m.base) { sync.conflict = res; return 'conflict'; }
      if (m.pending) return 'push';
      return adopt(api, st, res).then(function () {
        setMeta({ pending: false, base: res.hash, planBase: (res.plan && res.plan.hash) || '', syncedAt: new Date().toISOString() });
        return 'adopted';
      });
    });
  }
  function runSync(api, force) {
    if (sync.busy || !link(api)) return;
    if (!force && (sync.conflict || Date.now() - sync.lastFail < 30000)) return;
    if (!force && sync.pulled && !getMeta(api).pending) return;   // 할 일 없음
    sync.busy = true;
    paintSync(api);
    var job = (sync.pulled || force) ? Promise.resolve('push') : pull(api).then(function (r) { sync.pulled = true; return r; });
    job.then(function (r) {
      if (r === 'conflict') return r;
      if (force || getMeta(api).pending) return push(api, force).then(function () { api.toast('시트에 저장했어요.'); return 'pushed'; });
      return r;
    }).then(function (r) {
      sync.busy = false;
      if (r === 'adopted') api.toast('시트에서 새 배치를 받았어요.');
      if (r === 'adopted' || r === 'conflict' || force) api.refresh(); else paintSync(api);   // 저장만 됐으면 화면을 다시 그리지 않음(누르는 중 흔들림 방지)
    }, function (err) {
      sync.busy = false;
      if (!(err && err.message === 'conflict')) { sync.lastFail = Date.now(); sync.msg = (err && err.message) || ''; }
      api.refresh();
    });
  }
  function withSheet(api) {
    var o = Object.assign({}, api);
    o.saveDorm = function (payload) {
      return api.saveDorm(payload).then(function () {
        var m = getMeta(api);
        m.pending = true;
        setMeta(m);
        if (!link(api)) return;
        clearTimeout(sync.timer);
        sync.timer = setTimeout(function () { sync.lastFail = 0; runSync(o); }, 700);
      });
    };
    return o;
  }
  function syncText(api) {
    var m = getMeta(api);
    if (!link(api)) return '이 기기에만 저장돼요. 「남은 일정 → 시트 연결」을 한 번 하면 「기숙사」 탭에 바로 저장돼요.';
    if (sync.busy) return '시트와 맞추는 중…';
    if (sync.conflict) return '⚠️ 시트가 다른 곳에서 먼저 바뀌었어요. 아래에서 골라 주세요.';
    if (m.pending) return '⚠️ 이 기기에 저장해 두었어요. 시트로 다시 보내요.' + (sync.msg && sync.msg !== 'Failed to fetch' ? ' (' + sync.msg + ')' : '');
    if (m.syncedAt) {
      var d = new Date(m.syncedAt);
      return '✅ 「기숙사」 탭과 같아요 · ' + (d.getMonth() + 1) + '.' + d.getDate() + '. ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    return '시트와 맞추는 중…';
  }
  function paintSync(api) {
    var n = document.getElementById('dorm-sync');
    if (n) n.textContent = syncText(api);
    var b = document.getElementById('dorm-push');
    if (b && !getMeta(api).pending) b.remove();
  }
  function syncHtml(api) {
    var h = '<p class="muted" id="dorm-sync">' + api.esc(syncText(api)) + '</p>';
    if (link(api) && getMeta(api).pending && !sync.busy && !sync.conflict) h += '<button class="btn-ghost small" id="dorm-push" type="button">시트로 다시 보내기</button>';
    if (sync.conflict) {
      h += '<div class="sched-conflict" id="dorm-conflict"><b>시트와 이 기기 배치가 달라요.</b><p class="muted">다른 기기나 시트에서 먼저 고쳤어요. 어느 쪽을 남길까요?</p>' +
        '<div class="row"><button class="btn" id="dorm-take" type="button">시트 것 받기</button><button class="btn-ghost" id="dorm-mine" type="button">이 기기 것으로 시트 덮기</button></div></div>';
    }
    return h;
  }
  function bindSync(el, api) {
    var b = el.querySelector('#dorm-push');
    if (b) b.onclick = function () { sync.lastFail = 0; runSync(api); };
    var t = el.querySelector('#dorm-take');
    if (t) t.onclick = function () {
      var res = sync.conflict;
      sync.conflict = null;
      adopt(api, load(api), res).then(function () {
        setMeta({ pending: false, base: res.hash, planBase: (res.plan && res.plan.hash) || '', syncedAt: new Date().toISOString() });
        api.toast('시트 것을 받았어요.');
        api.refresh();
      });
    };
    var mi = el.querySelector('#dorm-mine');
    if (mi) mi.onclick = function () { sync.conflict = null; runSync(api, true); };
  }

  function render(el, api) {
    api = withSheet(api);
    el.classList.add('wide');
    var parts = api.route().parts;
    if (parts[1] === 'import') return importer(el, api);
    board(el, api);
  }

  function board(el, api) {
    var state = load(api);
    var mode = modeOf(api);
    if (mode === 'plan') APDorm.ensurePlan(state);
    var rows = mode === 'plan' ? state.plan : state.rows;
    var seed = seedOf(api);
    var sum = APDorm.summarize(state.rows, APDorm.confirmedAmount(api.pack()), seed.unit, seed.months, {
      memo: seed.roomMemo, genderSplitStatus: seed.genderSplitStatus
    });
    var h = '<div class="dorm' + (mode === 'plan' ? ' plan-mode' : '') + '">';
    h += '<button class="linkish" id="back" type="button">← 더보기</button>';
    h += head(api, sum, seed);
    h += controls(state, mode);
    if (mode === 'plan') {
      h += '<div class="dorm-planbar"><button class="btn" id="auto" type="button">한울관 전원 다솜관으로 이동안 만들기</button>' +
        '<button class="btn-ghost" id="plan-reset" type="button">계획 처음부터(현재 배치 복사)</button>' +
        '<span class="muted">계획은 따로 저장돼요. 현재 배치는 안 바뀌어요.</span></div>';
    }
    h += '<div class="dorm-sel" id="sel"></div>';
    h += '<div class="dorm-grid"><div id="plan-h"></div><div id="plan-d"></div><aside id="wait"></aside></div>';
    h += '<div class="dorm-log' + (showLog ? ' on' : '') + '" id="log"></div>';
    h += '<p class="muted">옮기기: 이름을 누른 뒤 방을 누르세요. 사람 위에 누르면 둘이 바뀝니다. 컴퓨터에서는 끌어다 놓아도 돼요. 방 번호 옆 인실을 누르면 정원을 바꿔요. 이름을 두 번 누르면 고칩니다.</p>';
    h += '</div>';
    if (editing) h += editor(api, state, mode);
    el.innerHTML = h;
    el.querySelector('#plan-h').innerHTML = building(api, state, rows, mode, '한울관');
    el.querySelector('#plan-d').innerHTML = building(api, state, rows, mode, '다솜관');
    el.querySelector('#wait').innerHTML = waiting(api, state, rows, mode, seed);
    el.querySelector('#log').innerHTML = logHtml(api, state);
    el.querySelector('#sel').innerHTML = selHtml(api, rows);
    bind(el, api, state, mode, rows);
    bindSync(el, api);
    runSync(api);
  }

  function head(api, sum, seed) {
    var feeClass = sum.needsConfirm ? ' warn' : '';
    return '<section class="card"><p class="kicker">OJNT · 싱가포르 과정</p><h1>기숙사 현황판</h1>' +
      '<div class="statgrid">' +
      '<div><b>' + sum.traineePlan + '</b><span>연수생 인원</span></div>' +
      '<div><b>' + sum.unconfirmed + '</b><span>추가 입소 예정</span></div>' +
      '<div><b>' + sum.teachers + '</b><span>강사</span></div>' +
      '<div><b>' + sum.emptyRooms + '</b><span>빈방</span></div></div>' +
      '<p class="item-meta">입소 ' + sum.traineesIn + '명' + (sum.namedUpcoming ? ' · 이름 있는 예정 ' + sum.namedUpcoming + '명' : '') +
      ' · 미확정 ' + sum.unconfirmed + '명' + (sum.reservedRooms ? ' · 여자 강사 전용 ' + sum.reservedRooms + '실' : '') + '</p>' +
      (sum.genderNeedsConfirm ? '<p><span class="badge warn">확인 필요</span> ' + api.esc(seed.genderSplitNote || '미확정 인원의 성별 구성은 확인 필요예요.') + '</p>' : '') +
      '<p class="item-meta">강사는 다솜관. 계획서 인원에는 넣지 않아요. 생활관비는 본인 부담이라 기숙사비에서 빠져요.</p>' +
      '<p><b>기숙사비</b> ' + won(sum.fee) + (sum.needsConfirm ? ' <span class="badge warn">확인 필요</span>' : ' <span class="badge ok">확정액과 같음</span>') + '</p>' +
      '<p class="muted' + feeClass + '">' + won(seed.unit || 200000) + ' × 연수생 ' + sum.traineePlan + '명 × ' + (seed.months || 4) + '개월. 예산의 기숙사 확정액과 다르면 확인 필요예요.</p>' +
      '<p>' + api.esc(seed.candidateNote || '여성 2명은 같은 방 배정 후보예요. 아직 확정이 아니에요.') + '</p>' +
      '<p><b>' + api.esc(seed.deadlineNote || '마감 11.5.(목)') + '</b></p>' +
      '<div class="row"><a class="btn-ghost" id="sheet" target="_blank" rel="noopener">시트 열기</a>' +
      '<button class="btn-ghost" id="import" type="button">CSV 가져오기</button></div>' +
      syncHtml(api) +
      '<p class="muted">「' + api.esc(seed.sheetTitle || '업무 현황판') + '」 ' + api.esc(seed.tab || '기숙사') + ' 탭과 같이 써요. 겨울방학 계획은 「기숙사_겨울계획」 탭. 전화번호·비밀번호·주민번호는 받지 않아요.</p></section>' +
      '<div class="dorm-legend"><span><i class="sw occ"></i>연수생</span><span><i class="sw tch"></i>강사</span><span><i class="sw hold"></i>여자 강사 전용</span><span><i class="sw pend"></i>예정</span><span><i class="sw emp"></i>미배정(빈방)</span><span><i class="sw half"></i>빈자리 있음</span></div>' +
      '<p class="muted">' + api.esc(seed.roomListNote || '층별 호실 목록은 아직 다 몰라요. 자료에 없는 방은 만들지 않아요.') + '</p>';
  }

  function controls(state, mode) {
    return '<div class="dorm-ctl"><div class="dorm-seg">' +
      '<button type="button" data-mode="cur"' + (mode === 'cur' ? ' class="on"' : '') + '>현재 배치</button>' +
      '<button type="button" data-mode="plan"' + (mode === 'plan' ? ' class="on"' : '') + '>❄️ 겨울방학 이동 계획</button></div>' +
      '<button class="btn-ghost" id="undo" type="button"' + (state.undo.length ? '' : ' disabled') + '>↶ 되돌리기' + (state.undo.length ? ' (' + state.undo.length + ')' : '') + '</button>' +
      '<button class="btn-ghost" id="log-btn" type="button">변경 내역 ' + state.log.length + '</button>' +
      '<button class="btn-ghost" id="tsv" type="button">엑셀용 복사</button>' +
      '<button class="btn-ghost" id="csv-cur" type="button">CSV 현재</button>' +
      '<button class="btn-ghost" id="csv-plan" type="button">CSV 계획</button></div>';
  }

  function building(api, state, rows, mode, name) {
    var keys = APDorm.roomList(state, mode).filter(function (k) { return k.indexOf(name + '|') === 0; })
      .sort(function (a, b) { return (+a.split('|')[1]) - (+b.split('|')[1]); });
    var occ = 0, emp = 0, people = 0;
    var body = '';
    [3, 2, 1].forEach(function (floor) {
      var fk = keys.filter(function (k) { return String(k.split('|')[1])[0] === String(floor); });
      body += '<div class="dorm-fl"><div class="dorm-fn">' + floor + 'F</div><div class="dorm-rs">';
      if (!fk.length) body += '<span class="muted">자료에 있는 호실 없음</span>';
      fk.forEach(function (key) {
        var pp = rows.map(function (row, i) { return [row, i]; }).filter(function (pair) {
          return APDorm.isPerson(pair[0]) && APDorm.keyOf(pair[0]) === key;
        });
        var cap = APDorm.capOf(state, key);
        var n = pp.length;
        var isT = pp.some(function (pair) { return pair[0]['구분'] === '강사'; });
        var pend = n && pp.every(function (pair) { return pair[0]['상태'] === '예정'; });
        var memo = APDorm.memoOf(state, key);
        var rule = memo.indexOf('여자 강사 전용') >= 0;
        var cls = rule && !n ? 'hold' : !n ? 'emp' : isT ? 'tch' : pend ? 'pend' : 'occ';
        var half = n > 0 && n < cap && !isT && !rule;
        var over = n > cap;
        if (n) { occ += 1; people += n; } else if (rule) { /* 연수생 빈방이 아님 */ } else emp += 1;
        body += '<div class="rb ' + cls + (half ? ' half' : '') + (over ? ' over' : '') + '" data-key="' + api.esc(key) + '">';
        body += '<div class="rh"><b>' + api.esc(key.split('|')[1]) + '호</b><button class="capb" type="button" data-cap="' + api.esc(key) + '">' + cap + '인실</button></div>';
        if (rule) body += '<div class="mm">여자 강사 전용</div>';
        body += '<div class="cs">';
        pp.forEach(function (pair) { body += chip(api, pair[0]); });
        if (!n && rule) body += '<span class="slot">연수생 방 아님</span>';
        else if (!n) body += '<span class="slot">빈자리 ' + cap + '</span>';
        else if (!isT && !rule && cap - n > 0) body += '<span class="slot">+' + (cap - n) + ' 가능</span>';
        body += '</div><div class="ft">' + (rule && !n ? '여자 강사 전용' : (over ? '정원 초과 ' : (n ? (isT ? '강사 ' : '') + '배정 ' : '미배정 ')) + n + '/' + cap);
        if (half) body += ' · 빈자리 ' + (cap - n);
        body += '</div></div>';
      });
      body += '<button class="addr" type="button" data-add="' + name + '|' + floor + '">+ 호실 추가</button></div></div>';
    });
    return '<section class="bld"><div class="bh"><b>' + name + '</b><span>자료에 있는 방 ' + keys.length + '실 · 배정 ' + occ + ' · 미배정 ' + emp + ' · ' + people + '명</span></div>' + body + '</section>';
  }

  function shortDay(value) {
    var m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    return Number(m[2]) + '.' + Number(m[3]) + '.';
  }
  function chip(api, row) {
    var sex = row['성별'] === '여' ? ' f' : row['성별'] === '남' ? ' m' : '';
    var on = SEL === row._id ? ' sel' : '';
    var when = row['상태'] === '예정' ? shortDay(row['입소일']) : '';
    return '<button class="pc' + sex + on + '" type="button" data-pid="' + api.esc(row._id) + '"' + (finePointer() ? ' draggable="true"' : '') + '>' +
      api.esc(APDorm.displayName(row)) + (row['상태'] === '예정' ? ' ·예정' : '') + (when ? ' · ' + when : '') + '</button>';
  }

  function waiting(api, state, rows, mode, seed) {
    var list = rows.filter(function (row) { return APDorm.isPerson(row) && !APDorm.keyOf(row); });
    var title = mode === 'plan' ? '배정 필요' : '배정 대기';
    var h = '<div class="wait" data-wait="1"><div class="wt">' + title + ' <b>' + list.length + '명</b></div>';
    h += mode === 'plan' ? '<span class="badge">겨울방학 이동 계획</span>' : '<span class="badge warn">' + api.esc(seed.deadlineNote || '마감 11.5.(목)') + '</span>';
    if (!list.length) h += '<p class="muted">대기 인원이 없어요.</p>';
    list.forEach(function (row) {
      var day = shortDay(row['입소일']);
      var genderOpen = !APDorm.known(row['이름']) && (seed.genderSplitStatus === '확인 필요' || (row['성별'] !== '남' && row['성별'] !== '여'));
      h += '<div class="wr">' + chip(api, row) + '<div class="item-meta">' +
        (row._from ? '원래 ' + api.esc(row._from) + ' · ' : '') + '입소 ' + api.esc(day || row['입소일'] || '미정') +
        (genderOpen ? ' · <span class="badge warn">성별 확인 필요</span>' : '') + '</div></div>';
    });
    h += '<p class="muted">여기로 옮기면 ' + title + '로 빠져요.</p></div>';
    return h;
  }

  function logHtml(api, state) {
    if (!state.log.length) return '<p class="muted">아직 옮긴 기록이 없어요.</p>';
    return state.log.slice(0, 40).map(function (item) {
      return '<div class="li"><span class="badge' + (item.m === '계획' ? '' : ' ok') + '">' + api.esc(item.m) + '</span> <b>' +
        api.esc(item.who) + '</b> · ' + api.esc(item.from) + ' → ' + api.esc(item.to) + '</div>';
    }).join('');
  }
  function selHtml(api, rows) {
    if (!SEL) return '';
    var row = rows.filter(function (r) { return r._id === SEL; })[0];
    if (!row) return '';
    var place = APDorm.keyOf(row) ? APDorm.keyOf(row).replace('|', ' ') + '호' : '배정 대기';
    return '선택: <b>' + api.esc(APDorm.displayName(row)) + '</b> (' + api.esc(place) + '). 옮길 방이나 바꿀 사람을 누르세요. ' +
      '<button class="btn-ghost" id="to-wait" type="button">대기열로 빼기</button> <button class="btn-ghost" id="sel-clear" type="button">취소</button>';
  }

  function bind(el, api, state, mode, rows) {
    var sheet = el.querySelector('#sheet');
    if (sheet) {
      var url = seedOf(api).sheetUrl || '';
      if (url) sheet.href = url;
      else { sheet.removeAttribute('href'); sheet.onclick = function (e) { e.preventDefault(); api.toast('시트 주소가 묶음에 없어요.'); }; }
    }
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelector('#import').onclick = function () { api.go('#/dorm/import' + (mode === 'plan' ? '?mode=plan' : '')); };
    el.querySelectorAll('[data-mode]').forEach(function (b) {
      b.onclick = function () { SEL = null; goMode(api, b.getAttribute('data-mode')); };
    });
    el.querySelector('#undo').onclick = function () {
      var st = load(api);
      var res = APDorm.undo(st);
      if (!res.ok) { api.toast('되돌릴 게 없어요.'); return; }
      SEL = null;
      api.saveDorm(APDorm.serial(st)).then(function () { api.toast('되돌렸어요.'); api.refresh(); });
    };
    el.querySelector('#log-btn').onclick = function () { showLog = !showLog; api.refresh(); };
    el.querySelector('#tsv').onclick = function () {
      var text = APDorm.toTsv(rows);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { api.toast(rows.length + '줄을 복사했어요.'); }, function () { fallbackCopy(api, text); });
      } else fallbackCopy(api, text);
    };
    el.querySelector('#csv-cur').onclick = function () { download(APDorm.toCsv(load(api).rows, false), '기숙사-현재.csv'); };
    el.querySelector('#csv-plan').onclick = function () {
      var st = load(api);
      APDorm.ensurePlan(st);
      download(APDorm.toCsv(st.plan, true), '기숙사-계획.csv');
    };
    var auto = el.querySelector('#auto');
    if (auto) auto.onclick = function () {
      var st = load(api);
      var res = APDorm.autoWinter(st);
      SEL = null;
      api.saveDorm(APDorm.serial(st)).then(function () {
        api.toast('다솜관에 ' + res.moved + '명, 배정 필요 ' + res.waiting + '명');
        api.refresh();
      });
    };
    var reset = el.querySelector('#plan-reset');
    if (reset) reset.onclick = function () {
      var st = load(api);
      APDorm.resetPlan(st);
      api.saveDorm(APDorm.serial(st)).then(function () { api.toast('계획을 현재 배치로 다시 시작했어요.'); api.refresh(); });
    };
    el.querySelectorAll('.pc').forEach(function (node) {
      var id = node.getAttribute('data-pid');
      node.onclick = function (ev) {
        ev.stopPropagation();
        var now = Date.now();
        if (lastTap.id === id && now - lastTap.t < 450) {
          lastTap = { id: '', t: 0 };
          if (mode === 'cur') { editing = id; SEL = null; api.refresh(); }
          else api.toast('계획에서는 옮기기만 돼요.');
          return;
        }
        lastTap = { id: id, t: now };
        if (!SEL) { SEL = id; api.refresh(); return; }
        if (SEL === id) { SEL = null; api.refresh(); return; }
        var st = load(api);
        if (mode === 'plan') APDorm.ensurePlan(st);
        var res = APDorm.swap(st, mode, SEL, id);
        SEL = null;
        after(api, st, res);
      };
      if (finePointer()) {
        node.ondragstart = function (ev) {
          SEL = id;
          ev.dataTransfer.setData('text/plain', id);
          ev.dataTransfer.effectAllowed = 'move';
        };
        node.ondragover = function (ev) { ev.preventDefault(); node.classList.add('dz'); };
        node.ondragleave = function () { node.classList.remove('dz'); };
        node.ondrop = function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var from = ev.dataTransfer.getData('text/plain');
          if (!from || from === id) return;
          var st = load(api);
          if (mode === 'plan') APDorm.ensurePlan(st);
          var res = APDorm.swap(st, mode, from, id);
          SEL = null;
          after(api, st, res);
        };
      }
    });
    function dropZone(node, dest) {
      node.onclick = function (ev) {
        if (ev.target.closest('.pc, .capb, .addr')) return;
        if (SEL) {
          var st = load(api);
          if (mode === 'plan') APDorm.ensurePlan(st);
          var res = APDorm.move(st, mode, SEL, dest);
          SEL = null;
          after(api, st, res);
          return;
        }
        api.toast('이름을 먼저 누르세요.');
      };
      node.ondragover = function (ev) { ev.preventDefault(); node.classList.add('dz'); };
      node.ondragleave = function (ev) { if (!node.contains(ev.relatedTarget)) node.classList.remove('dz'); };
      node.ondrop = function (ev) {
        ev.preventDefault();
        var from = ev.dataTransfer.getData('text/plain') || SEL;
        if (!from) return;
        var st = load(api);
        if (mode === 'plan') APDorm.ensurePlan(st);
        var res = APDorm.move(st, mode, from, dest);
        SEL = null;
        after(api, st, res);
      };
    }
    el.querySelectorAll('.rb').forEach(function (node) { dropZone(node, node.getAttribute('data-key')); });
    var wait = el.querySelector('[data-wait]');
    if (wait) dropZone(wait, null);
    el.querySelectorAll('[data-cap]').forEach(function (node) {
      node.onclick = function (ev) {
        ev.stopPropagation();
        var key = node.getAttribute('data-cap');
        var cur = APDorm.capOf(state, key);
        var next = cur >= 4 ? 1 : cur + 1;
        var st = load(api);
        var res = APDorm.setCap(st, mode, key, next);
        after(api, st, res, key.replace('|', ' ') + '호 → ' + next + '인실');
      };
    });
    el.querySelectorAll('[data-add]').forEach(function (node) {
      node.onclick = function (ev) {
        ev.stopPropagation();
        var parts = node.getAttribute('data-add').split('|');
        var no = window.prompt(parts[0] + ' ' + parts[1] + '층에 넣을 호실 번호', parts[1] + '01');
        if (no == null) return;
        var st = load(api);
        if (mode === 'plan') APDorm.ensurePlan(st);
        var res = APDorm.addRoom(st, mode, parts[0], no, 2, '');
        if (!res.ok) { api.toast(res.exists ? '이미 있는 방이에요.' : '호실 번호는 숫자로 적어 주세요.'); return; }
        after(api, st, res, parts[0] + ' ' + String(no).trim() + '호를 추가했어요.');
      };
    });
    var toWait = el.querySelector('#to-wait');
    if (toWait) toWait.onclick = function () {
      var st = load(api);
      if (mode === 'plan') APDorm.ensurePlan(st);
      var res = APDorm.move(st, mode, SEL, null);
      SEL = null;
      after(api, st, res);
    };
    var clear = el.querySelector('#sel-clear');
    if (clear) clear.onclick = function () { SEL = null; api.refresh(); };
    if (editing) bindEditor(el, api, mode);
  }

  function after(api, state, res, okMsg) {
    if (res && res.same) { api.refresh(); return; }
    if (res && res.ok === false) { api.toast('옮기지 못했어요.'); return; }
    api.saveDorm(APDorm.serial(state)).then(function () {
      if (res && res.warnings && res.warnings.length) api.toast(res.warnings.join(' · '));
      else if (okMsg) api.toast(okMsg);
      else if (res && res.ok) api.toast('배치를 저장했어요.');
      api.refresh();
    });
  }

  function editor(api, state, mode) {
    var rows = mode === 'plan' ? state.plan : state.rows;
    var row = rows.filter(function (r) { return r._id === editing; })[0];
    if (!row) { editing = null; return ''; }
    function opt(list, cur) {
      return list.map(function (v) { return '<option' + (cur === v ? ' selected' : '') + '>' + v + '</option>'; }).join('');
    }
    return '<section class="card dorm-edit"><h2>고치기</h2>' +
      field('e-name', '이름', api.esc(row['이름'])) +
      '<div class="row"><label class="field"><span>건물</span><select id="e-bld">' + opt(['한울관', '다솜관', '미정'], row['건물']) + '</select></label>' +
      field('e-room', '호실', api.esc(row['호실'])) + '</div>' +
      '<div class="row"><label class="field"><span>구분</span><select id="e-type">' + opt(['연수생', '강사', '입소예정', '빈방'], row['구분']) + '</select></label>' +
      '<label class="field"><span>상태</span><select id="e-st">' + opt(['입소', '예정', '빈방'], row['상태']) + '</select></label></div>' +
      '<div class="row"><label class="field"><span>성별</span><select id="e-sex"><option value=""></option>' +
      ['남', '여', '미정'].map(function (v) { return '<option' + (row['성별'] === v ? ' selected' : '') + '>' + v + '</option>'; }).join('') +
      '</select></label>' + field('e-date', '입소일', api.esc(row['입소일'])) + '</div>' +
      field('e-note', '비고', api.esc(row['비고'])) +
      '<p class="muted">전화번호, 비밀번호, 주민번호는 적지 않아요.</p>' +
      '<div class="row"><button class="btn" id="e-save" type="button">저장</button><button class="btn-ghost" id="e-cancel" type="button">닫기</button></div></section>';
  }
  function field(id, label, value) {
    return '<label class="field"><span>' + label + '</span><input id="' + id + '" type="text" value="' + value + '"></label>';
  }
  function bindEditor(el, api, mode) {
    el.querySelector('#e-cancel').onclick = function () { editing = null; api.refresh(); };
    el.querySelector('#e-save').onclick = function () {
      var st = load(api);
      if (mode === 'plan') APDorm.ensurePlan(st);
      var rows = mode === 'plan' ? st.plan : st.rows;
      var row = rows.filter(function (r) { return r._id === editing; })[0];
      if (!row) return;
      st.undo.push(JSON.parse(JSON.stringify({ rows: st.rows, plan: st.plan, extra: st.extra, cap: st.cap, memo: st.memo, log: st.log })));
      row['이름'] = document.getElementById('e-name').value.trim();
      row['건물'] = document.getElementById('e-bld').value;
      row['호실'] = document.getElementById('e-room').value.trim() || '미정';
      row['구분'] = document.getElementById('e-type').value;
      row['상태'] = document.getElementById('e-st').value;
      row['성별'] = document.getElementById('e-sex').value;
      row['입소일'] = document.getElementById('e-date').value.trim();
      row['비고'] = document.getElementById('e-note').value.trim();
      row['수정한 봇'] = '이 기기';
      APDorm.normalize(st, rows, mode);
      editing = null;
      api.saveDorm(APDorm.serial(st)).then(function () { api.toast('저장했어요.'); api.refresh(); });
    };
  }

  function importer(el, api) {
    var mode = modeOf(api);
    el.classList.add('wide');
    el.innerHTML = '<button class="linkish" id="back" type="button">← 기숙사 현황판</button><section class="card"><h1>CSV 가져오기</h1>' +
      '<p class="muted">첫 줄은 머리글. 건물, 호실, 구분, 이름, 성별, 입소일, 상태, 비고. ' + (mode === 'plan' ? '겨울방학 계획' : '현재 배치') + '을 이 표로 바꿉니다. 전화번호·비밀번호·주민번호 열은 버려요.</p>' +
      '<label class="field"><span>CSV</span><textarea id="blob"></textarea></label>' +
      '<button class="btn block" id="go" type="button">넣기</button></section>';
    el.querySelector('#back').onclick = function () { goMode(api, mode); };
    el.querySelector('#go').onclick = function () {
      var rows = APDorm.fromCsv(document.getElementById('blob').value);
      if (!rows.length) { api.toast('읽을 줄이 없어요.'); return; }
      var st = load(api);
      if (mode === 'plan') APDorm.ensurePlan(st);
      var res = APDorm.importRows(st, mode, rows);
      api.saveDorm(APDorm.serial(st)).then(function () { api.toast(res.count + '줄을 넣었어요.'); goMode(api, mode); });
    };
  }

  function download(text, name) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function fallbackCopy(api, text) {
    var area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); api.toast('복사했어요.'); }
    catch (e) { api.toast('복사가 막혔어요. CSV로 저장해 주세요.'); }
    area.remove();
  }

  ShellModules.dorm = { id: 'dorm', tab: '', icon: '', render: render };
})();
