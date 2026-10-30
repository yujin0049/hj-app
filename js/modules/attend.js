/* 출석부 (#/attend): OJNT 수업 출석을 교수님이 휴대폰으로 직접 체크(출석·지각·결석), 회차별 서명부 PDF.
   출처: 유진님 261030 「교수 전적책임으로 두도록」「접속하기 쉽게 웹에서」「교수님들이 휴대폰으로 체크하고, 나중에 수정하기 용이하게」「여러사람 쓸거고, 동시 접속」(대장 전달).
   출석 책임: 담당 교수. 행정 확인 단계 없음.
   자료: Cloudflare Worker + D1(worker/). 학생·교수 이름, 시간표는 서버에만(저장소에 없음).
   들어오기: 교수님별 링크 #/attend?t=<긴 무작위 열쇠>. 열쇠는 이 기기 localStorage 에만 두고 주소창에서는 바로 지움. 고친 사람 이름은 서버가 열쇠로 정함.
   저장: 누를 때 한 번(학생 한 명 = 한 줄). 20초마다·다시 볼 때 새로 읽어 다른 분이 고친 것을 보여 줌. 먼저 바뀐 값을 덮으면 「다른 분이 먼저 바꿈」 알림.
   잠금: 수업 날짜 + 7일 지나면 잠김(관리자 링크로만 풀기). 출석률: 지각=출석으로 계산.
   화면: #/attend(내 수업 먼저) · #/attend/<회차 id> · #/attend/stats
   js/attend-core.js 는 이 화면을 처음 열 때만 불러옴. PDF 라이브러리 안 씀(직접 만든 JPEG→PDF). 서비스워커는 다른 주소(서버)를 캐시하지 않음. */
(function (root) {
  'use strict';
  var A = null, coreP = null, me = null, poll = null, list = null;
  var KT = 'hj-attend-t', KAPI = 'hj-attend-api';
  var CSS = [
    '.at-head{padding:4px 2px 0}.at-head h1{margin:0 0 2px}.at-head p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45}',
    '.at-card{background:var(--card);border-radius:20px;padding:16px;margin:12px 0}.at-card h2{font-size:1.02rem;margin:0 0 6px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}.at-card h2 small{font-size:.76rem;color:var(--muted);font-weight:500}',
    '.at-resp{display:flex;gap:10px;align-items:flex-start;background:var(--blue-soft);border-radius:16px;padding:12px 14px;margin:12px 0}',
    '.at-resp b{color:var(--navy);font-size:.95rem;white-space:nowrap}.at-resp span{font-size:.8rem;color:var(--ink-2);line-height:1.45}',
    '.at-m{font-size:.8rem;color:var(--muted);line-height:1.5;margin:4px 0}',
    '.at-s{display:block;width:100%;border:0;border-radius:14px;background:var(--soft);padding:12px 14px;margin:8px 0 0;text-align:left;cursor:pointer;color:var(--ink);min-height:48px}',
    '.at-s.mine{background:var(--blue-soft)}.at-s b{font-size:.95rem}.at-s small{display:block;font-size:.76rem;color:var(--muted);margin-top:2px}',
    '.at-s .r{float:right;font-size:.76rem;font-weight:700;color:var(--ok);margin-left:8px}.at-s .r.lk{color:var(--muted)}',
    '.at-day{font-size:.84rem;font-weight:700;color:var(--ink-2);margin:14px 0 0}.at-day.today{color:var(--navy)}',
    '.at-row{display:flex;align-items:center;gap:6px;padding:8px 0;border-top:1px solid var(--line)}.at-row:first-child{border-top:0}',
    '.at-nm{flex:1;min-width:0}.at-nm b{display:block;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.at-nm small{display:block;font-size:.7rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.at-row.chg{background:var(--warnbg);border-radius:10px}.at-row.pend .at-nm small:after{content:" · 보내는 중";color:var(--navy)}',
    '.at-b{flex:0 0 auto;width:68px;min-height:48px;border:0;border-radius:12px;background:var(--soft);color:var(--ink-2);font-weight:700;font-size:.92rem;cursor:pointer}',
    '.at-b.o.on{background:var(--ok);color:#fff}.at-b.l.on{background:var(--warn);color:#fff}.at-b.x.on{background:var(--no);color:#fff}.at-b[disabled]{cursor:default;opacity:.55}.at-b.on[disabled]{opacity:.8}',
    '.at-cnt{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 2px}.at-cnt span{font-size:.78rem;font-weight:700;border-radius:999px;padding:4px 10px;background:var(--soft);color:var(--ink-2)}',
    '.at-cnt .o{background:var(--okbg);color:var(--ok)}.at-cnt .l{background:var(--warnbg);color:var(--warn)}.at-cnt .x{background:var(--nobg);color:var(--no)}',
    '.at-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.at-btns>*{flex:1 1 140px}',
    '.at-note{border-radius:12px;padding:10px 12px;font-size:.84rem;line-height:1.5;margin:8px 0;background:var(--warnbg);color:var(--warn)}.at-note.info{background:var(--blue-soft);color:var(--navy)}',
    '.at-hist{font-size:.78rem;line-height:1.5;color:var(--ink-2);padding:6px 0;border-top:1px solid var(--line)}.at-hist:first-of-type{border-top:0}.at-hist span{color:var(--muted)}',
    '.at-tb{width:100%;border-collapse:collapse;font-size:.84rem}.at-tb th,.at-tb td{padding:8px 4px;border-top:1px solid var(--line);text-align:right}.at-tb th:first-child,.at-tb td:first-child{text-align:left}.at-tb .bad{color:var(--no);font-weight:700}',
    '.at-prev img{display:block;width:100%;border:1px solid var(--line);border-radius:6px;margin:8px 0;background:#fff}',
    '.at-pad{position:fixed;inset:0;background:rgba(25,31,40,.55);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}',
    '.at-pad>div{background:#fff;border-radius:20px;padding:16px;width:100%;max-width:560px}.at-pad canvas{display:block;width:100%;height:200px;border:1px solid var(--line);border-radius:12px;touch-action:none;background:#fff}',
    '.at-in{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit;font-size:.95rem}',
    '@media (min-width:700px){.at-b{width:84px}.at-cols{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:12px;align-items:start}.at-cols>section{margin:12px 0}}'
  ].join('\n');
  function style() { if (document.getElementById('at-style')) return; var s = document.createElement('style'); s.id = 'at-style'; s.textContent = CSS; document.head.appendChild(s); }

  function core() {
    if (root.HJAttend) { A = root.HJAttend; return Promise.resolve(A); }
    if (coreP) return coreP;
    coreP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = new URL('js/attend-core.js?v=2', document.baseURI).href;
      s.onload = function () { A = root.HJAttend; res(A); };
      s.onerror = function () { coreP = null; rej(new Error('attend-core')); };
      document.body.appendChild(s);
    });
    return coreP;
  }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return ''; } return ''; }
  function base() {
    var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? ls(KAPI) : '';
    return (local || A.API_BASE || '').replace(/\/+$/, '');
  }
  function call(path, body) {
    var init = { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + ls(KT) }, cache: 'no-store', referrerPolicy: 'no-referrer' };
    if (body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    return fetch(base() + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; if (!r.ok) { var e = new Error(j.error || ('서버 ' + r.status)); e.status = r.status; e.body = j; throw e; } return j; });
    });
  }
  function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }

  function takeToken(api) {
    var q = new URLSearchParams(api.route().query || '');
    var t = q.get('t');
    if (t && /^[A-Za-z0-9_-]{22,128}$/.test(t)) { ls(KT, t); me = null; list = null; }
    if (t !== null) { try { history.replaceState(null, '', location.pathname + location.search + '#/' + (api.route().parts || ['attend']).join('/')); } catch (e) { /* 그대로 */ } }
  }

  function render(el, api) {
    style(); stopPoll();
    var h = location.hash;
    el.innerHTML = '<p class="at-m">출석부를 여는 중…</p>';
    core().then(function () {
      takeToken(api);
      if (location.hash !== h && location.hash.indexOf('#/attend') !== 0) return;
      var RESP = resp();
      if (!base()) {
        el.innerHTML = head('출석부') + RESP + '<section class="at-card"><div class="at-note">서버 주소가 아직 설정되지 않았어요. 담당자가 서버를 연결하면 교수님별 링크로 열 수 있어요. 지금은 체크·저장할 수 없어요.</div></section>';
        return;
      }
      if (!ls(KT)) {
        el.innerHTML = head('출석부') + RESP + '<section class="at-card"><div class="at-note">교수님별로 받은 링크로 열어 주세요. 링크에 들어가는 열쇠가 있어야 명단을 볼 수 있어요.</div></section>';
        return;
      }
      return (me ? Promise.resolve(me) : call('/api/me').then(function (m) { me = m; return m; })).then(function () {
        var p = api.route().parts || [];
        if (p[1] === 'stats') return statsPage(el, api);
        if (p[1]) return sheetPage(el, api, p[1]);
        return listPage(el, api);
      });
    }).catch(function (e) {
      if (e && e.status === 401) { ls(KT, null); me = null; }
      el.innerHTML = head('출석부') + '<section class="at-card"><div class="at-note">' + api.esc(e && e.status === 401 ? '링크가 맞지 않거나 기한이 지났어요. 새 링크를 받아 주세요.' : '서버에 연결하지 못했어요(' + ((e && e.message) || '') + '). 인터넷을 확인하고 다시 열어 주세요.') + '</div></section>';
    });
  }
  function head(t, sub) { return '<div class="at-head"><h1>' + t + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>'; }
  function resp() { return '<div class="at-resp"><b>출석 책임: 담당 교수</b><span>담당 교수님이 직접 체크하고 서명부 PDF 를 만들어요. 행정실 확인 단계는 없어요. 지각=출석으로 계산(출석률 85%).</span></div>'; }
  function meLine(api) { return '<p class="at-m">' + api.esc(me.name) + (me.role === 'admin' ? ' (관리자 링크)' : ' 교수님') + '으로 접속 · 링크 기한 ' + api.esc(A.mdhm(me.expires_at).split(' ')[0]) + '</p>'; }

  function sBtn(api, s, mine) {
    var c = s.count || { o: 0, l: 0, x: 0 }, done = c.o + c.l + c.x;
    return '<button class="at-s' + (mine ? ' mine' : '') + '" type="button" data-sid="' + api.esc(s.id) + '">' +
      '<span class="r' + (s.locked ? ' lk' : '') + '">' + (s.locked ? '잠김 · ' : '') + (done ? '체크 ' + done + '/' + list.students : '아직') + '</span>' +
      '<b>' + s.p_from + '~' + s.p_to + '교시 ' + api.esc(s.subject) + '</b><small>' + api.esc(A.dateText(s.date, 1)) + ' ' + s.from + '~' + s.to + ' (' + s.hours + '시간) · ' + api.esc(s.prof) + '</small></button>';
  }
  function listPage(el, api) {
    var esc = api.esc;
    call('/api/sessions').then(function (j) {
      list = j;
      var today = j.today, ss = j.sessions;
      var mineToday = ss.filter(function (s) { return s.date === today && s.prof_id === me.prof_id; });
      var otherToday = ss.filter(function (s) { return s.date === today && s.prof_id !== me.prof_id; });
      var mineAll = ss.filter(function (s) { return s.prof_id === me.prof_id && s.date !== today; });
      var byDate = {};
      ss.forEach(function (s) { if (s.date !== today) (byDate[s.date] = byDate[s.date] || []).push(s); });
      var dates = Object.keys(byDate).sort();
      var past = dates.filter(function (d) { return d < today; }).reverse(), next = dates.filter(function (d) { return d > today; });
      function days(ds) { return ds.map(function (d) { return '<p class="at-day">' + esc(A.dateText(d, 1)) + '</p>' + byDate[d].map(function (s) { return sBtn(api, s, s.prof_id === me.prof_id); }).join(''); }).join(''); }
      el.innerHTML = head('출석부', 'OJNT 수업 · 학생 ' + j.students + '명 · 회차 ' + ss.length + '개') + resp() + meLine(api) +
        '<section class="at-card"><h2>오늘 내 수업 <small>' + esc(A.dateText(today, 1)) + '</small></h2>' + (mineToday.length ? mineToday.map(function (s) { return sBtn(api, s, 1); }).join('') : '<p class="at-m">오늘 내 수업은 없어요.</p>') + '</section>' +
        (otherToday.length ? '<section class="at-card"><h2>오늘 다른 수업</h2>' + otherToday.map(function (s) { return sBtn(api, s, 0); }).join('') + '</section>' : '') +
        (mineAll.length && me.role !== 'admin' ? '<section class="at-card"><h2>내 다른 수업 <small>' + mineAll.length + '개</small></h2>' + mineAll.map(function (s) { return sBtn(api, s, 1); }).join('') + '</section>' : '') +
        '<section class="at-card"><h2>다음 수업</h2>' + (next.length ? days(next) : '<p class="at-m">없어요.</p>') + '</section>' +
        '<section class="at-card"><h2>지난 수업 <small>수업 7일 뒤 잠김</small></h2>' + (past.length ? days(past) : '<p class="at-m">없어요.</p>') + '</section>' +
        '<section class="at-card"><h2>출석률</h2><p class="at-m">학생별 출석 시간 · 85% 요건(지각=출석으로 계산)</p><div class="at-btns"><button class="btn-ghost small" type="button" id="at-stats">출석률 보기</button></div></section>';
      el.querySelectorAll('[data-sid]').forEach(function (b) { b.onclick = function () { api.go('#/attend/' + b.getAttribute('data-sid')); }; });
      el.querySelector('#at-stats').onclick = function () { api.go('#/attend/stats'); };
    }).catch(function (e) { el.innerHTML = head('출석부') + '<section class="at-card"><div class="at-note">' + esc(e.message) + '</div></section>'; });
  }

  function statsPage(el, api) {
    var esc = api.esc;
    call('/api/stats').then(function (j) {
      var t = j.students[0] || { total: 0, need: 0 };
      el.innerHTML = '<button class="linkish" id="back" type="button">← 출석부</button>' + head('출석률', '과정 전체 ' + t.total + '시간 · 85% = ' + t.need + '시간 · <b>지각=출석으로 계산</b>') +
        '<section class="at-card"><table class="at-tb"><thead><tr><th>이름</th><th>출석(지각 포함)</th><th>결석</th><th>체크된 시간 중</th><th>85%</th></tr></thead><tbody>' +
        j.students.map(function (s) {
          return '<tr><td>' + esc(s.name) + '</td><td>' + s.came + '시간</td><td>' + s.away + '시간</td><td>' + (s.rate == null ? '-' : Math.round(s.rate * 100) + '%') + '</td><td class="' + (s.ok ? '' : 'bad') + '">' + (s.ok ? '가능' : '못 채움') + '</td></tr>';
        }).join('') + '</tbody></table><p class="at-m">「못 채움」 = 결석 시간이 많아 남은 수업을 다 와도 85%(' + t.need + '시간)에 못 미침. 지각은 지금은 출석으로 셉니다(유진님 결정 전 임시).</p></section>';
      el.querySelector('#back').onclick = function () { api.go('#/attend'); };
    }).catch(function (e) { el.innerHTML = head('출석률') + '<section class="at-card"><div class="at-note">' + esc(e.message) + '</div></section>'; });
  }

  function sheetPage(el, api, sid) {
    var esc = api.esc, d = null, pend = {}, failed = {}, notes = [], changed = {}, profSig = '';
    var mine = location.hash;
    function canEdit() { return d && (!d.session.locked || me.role === 'admin'); }
    function cnt() {
      var c = A.summary(d.students.map(function (s) { return s.id; }), d.marks);
      return '<span class="o">출석 ' + c.here + '</span><span class="l">지각 ' + c.late + '</span><span class="x">결석 ' + c.away + '</span><span>아직 ' + c.unset + '</span><span>명단 ' + c.named + '</span>';
    }
    function rowHtml(s) {
      var m = d.marks[s.id] || {}, st = m.st || '', dis = canEdit() ? '' : ' disabled';
      var meta = m.who ? esc(m.who) + ' ' + esc(A.hm(m.at)) : '아직';
      return '<div class="at-row' + (pend[s.id] ? ' pend' : '') + (changed[s.id] ? ' chg' : '') + '" data-id="' + s.id + '"><span class="at-nm"><b>' + esc(s.name) + '</b><small>' + meta + '</small></span>' +
        ['o', 'l', 'x'].map(function (k) { return '<button type="button" class="at-b ' + k + (st === k ? ' on' : '') + '" data-st="' + k + '" aria-pressed="' + (st === k) + '"' + dis + '>' + A.STATUS[k] + '</button>'; }).join('') + '</div>';
    }
    function noteHtml() {
      var nf = Object.keys(failed).length;
      return notes.map(function (n) { return '<div class="at-note">' + esc(n) + '</div>'; }).join('') +
        (nf ? '<div class="at-note">안 보낸 것 ' + nf + '건 · 인터넷이 돌아오면 다시 보내요 <button class="linkish" type="button" id="at-retry">지금 다시 보내기</button></div>' : '');
    }
    function paintRows() {
      el.querySelector('#at-rows').innerHTML = d.students.map(rowHtml).join('');
      el.querySelector('#at-cnt').innerHTML = cnt();
      el.querySelector('#at-notes').innerHTML = noteHtml();
      var rb = el.querySelector('#at-retry'); if (rb) rb.onclick = retry;
      el.querySelector('#at-hist').innerHTML = histHtml();
    }
    function histHtml() {
      var nm = {}; d.students.forEach(function (s) { nm[s.id] = s.name; });
      if (!d.history.length) return '<p class="at-m">아직 없어요.</p>';
      return d.history.map(function (h) {
        var what = h.field === 'unlock' ? (h.new === '1' ? '잠금 풀기' : '다시 잠그기') : esc(h.name || nm[h.student_id] || '') + ' ' + (A.STATUS[h.old] || '아직') + ' → ' + (A.STATUS[h.new] || '아직') + (h.base_ver != null && h.prev_ver != null && h.base_ver !== h.prev_ver ? ' (먼저 바뀐 값을 덮음)' : '');
        return '<div class="at-hist"><span>' + esc(A.mdhm(h.at)) + ' · ' + esc(h.who) + '</span><br>' + what + '</div>';
      }).join('');
    }
    function draw() {
      var s = d.session, lockMsg = s.locked ? (me.role === 'admin' ? '잠긴 회차예요(수업 7일 뒤). 관리자 링크라 고칠 수 있어요.' : '잠긴 회차예요(수업 7일 뒤). 고치려면 관리자에게 잠금 풀기를 부탁하세요.') : '이 회차는 ' + A.mdhm(s.lock_at) + '까지 고칠 수 있어요.';
      el.classList.add('wide');
      el.innerHTML = '<button class="linkish" id="back" type="button">← 출석부</button>' +
        head(esc(s.subject) + ' · ' + s.p_from + '~' + s.p_to + '교시', esc(A.dateText(s.date)) + ' ' + s.from + '~' + s.to + ' (' + s.hours + '시간) · 담당 ' + esc(s.prof)) + resp() +
        '<div class="at-cols"><section class="at-card"><h2>출석 체크 <small id="at-sync"></small></h2><div class="at-cnt" id="at-cnt"></div>' +
        '<div class="at-note info">' + esc(lockMsg) + (me.role === 'admin' ? ' <button class="linkish" type="button" id="at-lock">' + (s.unlocked ? '다시 잠그기' : (s.locked ? '잠금 풀기' : '')) + '</button>' : '') + '</div>' +
        '<div id="at-notes"></div><div id="at-rows"></div>' +
        (canEdit() ? '<div class="at-btns"><button class="btn-ghost small" type="button" id="at-all">아직인 학생 모두 출석</button></div>' : '') + '</section>' +
        '<div><section class="at-card"><h2>서명부 PDF</h2><p class="at-m">이 기기에서 바로 만들어요(A4). 학생 서명 칸은 비워 둠(종이에 서명). 교수 서명은 PDF 에만 들어가고 서버에 저장하지 않아요.</p>' +
        '<div class="at-btns"><button class="btn-navy small" type="button" id="at-ps">교수 서명(선택)</button><button class="btn small" type="button" id="at-pdf">PDF 만들기</button></div><div class="at-prev" id="at-prev"></div></section>' +
        '<section class="at-card"><h2>고친 기록 <small>지워지지 않음</small></h2><div id="at-hist"></div></section></div></div>';
      paintRows(); sync();
      el.querySelector('#back').onclick = function () { api.go('#/attend'); };
      el.querySelector('#at-rows').onclick = function (e) {
        var b = e.target.closest('button[data-st]'); if (!b || b.disabled) return;
        var id = +b.closest('.at-row').getAttribute('data-id'), m = d.marks[id] || {}, st = b.getAttribute('data-st');
        send(id, m.st === st ? '' : st);
      };
      var all = el.querySelector('#at-all');
      if (all) all.onclick = function () {
        var todo = d.students.filter(function (s) { return !(d.marks[s.id] && d.marks[s.id].st); });
        if (!todo.length) { api.toast('아직인 학생이 없어요.'); return; }
        if (!root.confirm('아직 체크 안 한 ' + todo.length + '명을 모두 「출석」으로 할까요? 실제로 와 있는지 확인했나요?')) return;
        todo.forEach(function (s) { send(s.id, 'o'); });
      };
      var lk = el.querySelector('#at-lock');
      if (lk && lk.textContent) lk.onclick = function () {
        call('/api/admin/unlock', { s: d.session.id, unlocked: !d.session.unlocked }).then(function () { load(); }).catch(function (e) { api.toast(e.message); });
      };
      el.querySelector('#at-ps').onclick = function () { pad('담당 교수 서명(PDF 에만)', function (u) { profSig = u; api.toast(u ? '서명을 PDF 에 넣을게요.' : '서명을 뺐어요.'); }); };
      el.querySelector('#at-pdf').onclick = function () { makePdf(el, api, d, profSig); };
    }
    function sync() { var x = el.querySelector('#at-sync'); if (x) x.textContent = '새로 읽음 ' + A.hm(d.now) + ' · 20초마다'; }
    function send(id, st) {
      var m = d.marks[id] || {};
      var prev = { st: m.st || '', ver: m.ver, who: m.who, at: m.at };
      d.marks[id] = { st: st, ver: m.ver, who: me.name, at: new Date().toISOString() };
      pend[id] = (pend[id] || 0) + 1; delete changed[id];
      paintRows();
      call('/api/mark', { s: sid, id: id, st: st, base: m.ver || 0 }).then(function (r) {
        delete failed[id];
        if (r.overwrote && r.before) notes.unshift('다른 분이 먼저 바꿈: ' + nameOf(id) + ' — ' + (r.before.who || '다른 분') + '이(가) ' + (A.STATUS[r.before.st] || '아직') + '(으)로 바꿔 두었고, 지금 내 선택 ' + (A.STATUS[r.mark.st] || '아직') + '(으)로 저장됐어요.');
        notes = notes.slice(0, 3);
        d.marks[id] = r.mark;
      }).catch(function (e) {
        if (e.status === 423) { d.marks[id] = prev; notes.unshift('잠긴 회차라 저장 못 했어요.'); d.session.locked = true; }
        else if (e.status === 401) { d.marks[id] = prev; notes.unshift('링크 기한이 지났어요. 새 링크를 받아 주세요.'); }
        else if (e.status && e.status < 500) { d.marks[id] = prev; notes.unshift('저장 못 했어요: ' + e.message); }
        else failed[id] = st; /* 인터넷 끊김 등 → 나중에 다시 */
      }).then(function () {
        pend[id]--; if (!pend[id]) delete pend[id];
        if (location.hash === mine) paintRows();
      });
    }
    function retry() { Object.keys(failed).forEach(function (id) { var st = failed[id]; delete failed[id]; send(+id, st); }); }
    function nameOf(id) { var s = d.students.filter(function (x) { return x.id === id; })[0]; return s ? s.name : ''; }
    function load(first) {
      return call('/api/sheet?s=' + encodeURIComponent(sid)).then(function (j) {
        if (location.hash !== mine) return;
        if (!d || first) { d = j; draw(); return; }
        j.students.forEach(function (s) {
          if (pend[s.id] || failed[s.id]) { j.marks[s.id] = d.marks[s.id]; return; }
          var a = d.marks[s.id] || {}, b = j.marks[s.id] || {};
          if ((a.ver || 0) !== (b.ver || 0) && b.who !== me.name) changed[s.id] = 1;
        });
        var wasLocked = d.session.locked;
        d = j;
        if (wasLocked !== d.session.locked) draw(); else { paintRows(); sync(); }
      });
    }
    load(true).then(function () {
      poll = setInterval(function () {
        if (location.hash !== mine) { stopPoll(); return; }
        if (document.visibilityState === 'visible') { retry(); load().catch(function () { /* 다음에 */ }); }
      }, 20000);
    }).catch(function (e) {
      el.innerHTML = '<button class="linkish" id="back" type="button">← 출석부</button><section class="at-card"><div class="at-note">' + esc(e.message) + '</div></section>';
      el.querySelector('#back').onclick = function () { api.go('#/attend'); };
    });
    function wake() { if (location.hash === mine && document.visibilityState === 'visible' && d) { retry(); load().catch(function () { /* 다음에 */ }); } }
    document.addEventListener('visibilitychange', wake);
    root.addEventListener('online', wake);
    root.addEventListener('hashchange', function off() { document.removeEventListener('visibilitychange', wake); root.removeEventListener('online', wake); root.removeEventListener('hashchange', off); });
  }

  /* ── 손가락 서명(교수, PDF 에만) ── */
  function pad(title, done) {
    var o = document.createElement('div');
    o.className = 'at-pad';
    o.innerHTML = '<div role="dialog" aria-label="' + title + '"><h2 style="margin:0 0 8px;font-size:1rem">' + title + '</h2><canvas></canvas>' +
      '<div class="at-btns"><button class="btn-navy small" type="button" data-a="clear">지우기</button><button class="btn-navy small" type="button" data-a="cancel">취소</button><button class="btn small" type="button" data-a="ok">서명 넣기</button></div></div>';
    document.body.appendChild(o);
    var cv = o.querySelector('canvas'), r = cv.getBoundingClientRect(), dpr = Math.min(root.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    var g = cv.getContext('2d'); g.scale(dpr, dpr); g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111';
    var down = false, inked = false, last = null;
    function pt(e) { var b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }
    cv.onpointerdown = function (e) { down = true; last = pt(e); cv.setPointerCapture(e.pointerId); inked = true; };
    cv.onpointermove = function (e) { if (!down) return; var p = pt(e); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; };
    cv.onpointerup = cv.onpointercancel = function () { down = false; };
    o.querySelector('[data-a=clear]').onclick = function () { g.clearRect(0, 0, cv.width, cv.height); inked = false; };
    o.querySelector('[data-a=cancel]').onclick = function () { o.remove(); };
    o.querySelector('[data-a=ok]').onclick = function () { var u = inked ? cv.toDataURL('image/png') : ''; o.remove(); done(u); };
  }

  /* ── PDF: 캔버스에 A4(150dpi) → JPEG → A4 PDF ── */
  var FONT = '"Pretendard","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR","Malgun Gothic",sans-serif';
  function img(src) { return new Promise(function (res) { if (!src) return res(null); var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function drawPage(d, chunk, startNo, pi, pn, profSig, made) {
    var s = d.session, W = 1240, H = 1754, M = 90, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.strokeStyle = '#111'; g.textBaseline = 'middle';
    function t(x, y, str, size, bold, align) { g.font = (bold ? '700 ' : '400 ') + size + 'px ' + FONT; g.textAlign = align || 'left'; g.fillText(str, x, y); }
    function box(x, y, w, h, lw) { g.lineWidth = lw || 1.5; g.strokeRect(x, y, w, h); }
    var y = M + 20;
    t(W / 2, y, '출석부 (서명부)', 46, true, 'center'); y += 54;
    t(W / 2, y, s.subject + ' · ' + s.p_from + '~' + s.p_to + '교시', 26, false, 'center'); y += 50;
    if (pi === 0) {
      var cw = [150, 390, 150, W - 2 * M - 690], rh = 54, info = [
        ['일자', A.dateText(s.date), '시간', s.from + ' ~ ' + s.to + ' (' + s.hours + '시간)'],
        ['과목', s.subject, '교시', s.p_from + '~' + s.p_to + '교시'],
        ['담당 교수', s.prof || '', '출석 책임', '담당 교수']
      ];
      info.forEach(function (r) {
        var x = M;
        r.forEach(function (c, j) { if (j % 2 === 0) { g.fillStyle = '#F2F4F6'; g.fillRect(x, y, cw[j], rh); g.fillStyle = '#111'; } box(x, y, cw[j], rh); t(x + (j % 2 ? 16 : cw[j] / 2), y + rh / 2, c, 24, j % 2 === 0, j % 2 ? 'left' : 'center'); x += cw[j]; });
        y += rh;
      });
      y += 30;
    }
    var col = [90, 330, 150, W - 2 * M - 570], hh = 58, rh2 = 62, x0 = M;
    ['No', '이름', '출석', '서명'].forEach(function (c, j) { g.fillStyle = '#E5E8EB'; g.fillRect(x0, y, col[j], hh); g.fillStyle = '#111'; box(x0, y, col[j], hh); t(x0 + col[j] / 2, y + hh / 2, c, 24, true, 'center'); x0 += col[j]; });
    y += hh;
    chunk.forEach(function (st, k) {
      var x = M, m = d.marks[st.id] || {};
      [String(startNo + k), st.name, A.STATUS[m.st] || '', ''].forEach(function (c, j) { box(x, y, col[j], rh2, 1); if (c) t(x + (j === 1 ? 18 : col[j] / 2), y + rh2 / 2, c, 24, false, j === 1 ? 'left' : 'center'); x += col[j]; });
      y += rh2;
    });
    if (pi === pn - 1) {
      var c = A.summary(d.students.map(function (x) { return x.id; }), d.marks);
      y += 34;
      t(M, y, '출석 ' + c.here + '명 · 지각 ' + c.late + '명 · 결석 ' + c.away + '명' + (c.unset ? ' · 미체크 ' + c.unset + '명' : '') + ' / 명단 ' + c.named + '명', 26, true); y += 44;
      t(M, y, '출석률 계산: 지각=출석으로 계산', 21, false); y += 54;
      t(M, y, '위 출석 사항을 담당 교수가 직접 확인했습니다. (출석 책임: 담당 교수)', 23, false); y += 72;
      t(M, y, '담당 교수 확인', 26, true);
      t(M + 230, y, '성명: ' + (s.prof || ''), 26, false);
      g.lineWidth = 1.2; g.beginPath(); g.moveTo(M + 300, y + 22); g.lineTo(M + 640, y + 22); g.moveTo(M + 760, y + 22); g.lineTo(W - M, y + 22); g.stroke();
      t(M + 690, y, '(서명)', 24, false);
      if (profSig) { var sc = Math.min((W - M - 770) / profSig.width, 90 / profSig.height); g.drawImage(profSig, M + 770, y - 60, profSig.width * sc, profSig.height * sc); }
    }
    t(W / 2, H - 50, (pi + 1) + ' / ' + pn + ' 쪽 · 만든 시각 ' + made + ' (KST) · 이 뒤에 고친 내용은 앱 「고친 기록」 참고', 18, false, 'center');
    return cv;
  }
  function makePdf(el, api, d, sigUrl) {
    var prev = el.querySelector('#at-prev');
    prev.innerHTML = '<p class="at-m">만드는 중…</p>';
    var fontReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all([fontReady, img(sigUrl)]).then(function (r) {
      var rows = d.students, first = 18, more = 26, chunks = [rows.slice(0, first)];
      for (var i = first; i < rows.length; i += more) chunks.push(rows.slice(i, i + more));
      var made = A.dateText(A.kstDate()) + ' ' + A.hm(new Date().toISOString()), start = 1, canvases = [];
      chunks.forEach(function (ch, k) { canvases.push(drawPage(d, ch, start, k, chunks.length, r[1], made)); start += ch.length; });
      var urls = canvases.map(function (cv) { return cv.toDataURL('image/jpeg', 0.9); });
      var pdf = A.makePdf(urls.map(function (u, k) {
        var b = atob(u.split(',')[1]), a = new Uint8Array(b.length);
        for (var q = 0; q < b.length; q++) a[q] = b.charCodeAt(q);
        return { jpeg: a, w: canvases[k].width, h: canvases[k].height };
      }));
      var blob = new Blob([pdf], { type: 'application/pdf' }), name = d.session.id.slice(2, 8) + '_' + d.session.p_from + '-' + d.session.p_to + '교시_' + d.session.subject + '_출석부.pdf';
      prev.innerHTML = '<div class="at-btns"><button class="btn small" type="button" id="at-dl">PDF 저장</button></div><p class="at-m">미리보기 ' + urls.length + '쪽 · ' + api.esc(name) + '</p>' + urls.map(function (u, k) { return '<img alt="서명부 ' + (k + 1) + '쪽 미리보기" src="' + u + '">'; }).join('');
      el.querySelector('#at-dl').onclick = function () {
        var u = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      };
    });
  }

  if (root.ShellModules) root.ShellModules.attend = { id: 'attend', tab: '출석부', render: render };
})(window);
