/* 대장↔클로드 채팅방 (#/chat): 열쇠를 넣어야만 읽혀요. 저장소(공개)에는 암호문만 있어요.
   방 파일: chat 가지의 chat/room.json(사이트 배포 아님). 읽는 곳: GitHub API(약 1분 캐시) 먼저, 막히면 raw(약 5분 캐시, ?t= 무시) — 261031 춘식이2. 쓰기는 tools/hj_chat.mjs 로만(화면에서 보내기 없음: 정적 사이트에 토큰을 둘 수 없어서).
   열쇠는 이 탭 메모리에만(풀린 CryptoKey 만 들고, 글자는 바로 지움) · localStorage·쿠키 안 씀 · 새로고침하면 다시 잠김.
   출처: 유진님 10.30. 19:43 「거기에 클로드 pc연결끊겨도 채팅방형식으로 답할 수 있게 만들어. 대장-클로드랑」.
   계획·지켜지는 것/안 지켜지는 것: 봇공유/조사/261030_대장클로드_채팅방_계획_v01.md */
(function (root) {
  'use strict';
  var RAW = 'https://raw.githubusercontent.com/yujin0049/hj-app/chat/chat/room.json';
  /* API 는 CORS 허용·캐시 약 60초(raw 는 약 300초, ?t= 를 무시해 「새로 읽기」에도 옛 판이 와요). 로그인 없이 IP당 시간당 60번 → 넘거나 막히면 raw 로. */
  var API = 'https://api.github.com/repos/yujin0049/hj-app/contents/chat/room.json?ref=chat';
  var key = null, room = null, msgs = null, err = '', busy = false, tried = false, via = '', gotAt = null;
  var CSS = [
    '.ch-wrap{max-width:680px;margin:0 auto;padding:0 12px 48px;box-sizing:border-box}',
    '.ch-head h1{margin:6px 0 4px;font-size:1.35rem;letter-spacing:-.02em}',
    '.ch-why{font-size:.82rem;color:var(--muted);line-height:1.45;margin:0 0 10px}',
    '.ch-lock{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;text-align:center}',
    '.ch-lock .ic{font-size:2rem;line-height:1;margin:4px 0 6px}',
    '.ch-lock label{display:block;font-weight:700;margin:6px 0}',
    '.ch-lock input{width:100%;box-sizing:border-box;min-height:48px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:1rem;background:var(--soft);color:var(--ink)}',
    '.ch-lock .btn{width:100%;margin-top:10px}',
    '.ch-err{color:var(--no);background:var(--nobg);border-radius:10px;padding:8px 10px;font-size:.88rem;margin:10px 0 0}',
    '.ch-bar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:0 0 10px;flex-wrap:wrap}',
    '.ch-bar .st{font-size:.85rem;color:var(--ok);font-weight:700}',
    '.ch-bar button{min-height:44px;border-radius:12px;border:0;padding:0 14px;font-weight:700;background:var(--soft);color:var(--navy);cursor:pointer}',
    '.ch-list{display:flex;flex-direction:column;gap:8px}',
    '.ch-msg{display:flex;flex-direction:column;max-width:86%}',
    '.ch-msg.l{align-self:flex-start}.ch-msg.r{align-self:flex-end;align-items:flex-end}.ch-msg.c{align-self:center;align-items:center}',
    '.ch-who{font-size:.75rem;color:var(--muted);margin:0 4px 2px;font-weight:700}.ch-who time{font-weight:400}',
    '.ch-b{white-space:pre-wrap;overflow-wrap:anywhere;word-break:keep-all;line-height:1.45;font-size:.95rem;border-radius:16px;padding:9px 12px;background:var(--card);border:1px solid var(--line);color:var(--ink)}',
    '.ch-msg.r .ch-b{background:var(--blue-soft);border-color:transparent}',
    '.ch-msg.c .ch-b{background:var(--soft);font-size:.85rem}',
    '.ch-msg.bad .ch-b{background:var(--warnbg);color:var(--warn);border-color:transparent}',
    '.ch-empty{text-align:center;color:var(--muted);padding:24px 8px}',
    '.ch-got{font-size:.75rem;color:var(--muted);margin:8px 2px 0;text-align:right}',
    '.ch-how{font-size:.8rem;color:var(--muted);line-height:1.5;margin:14px 2px 0}.ch-how code{font-size:.76rem;word-break:break-all}',
    '@media (prefers-reduced-motion:reduce){.ch-wrap *{transition:none!important;animation:none!important}}'
  ].join('\n');
  function style() {
    if (document.getElementById('ch-style')) return;
    var s = document.createElement('style'); s.id = 'ch-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function loadCore() {
    if (root.HJChat) return Promise.resolve(true);
    return new Promise(function (ok) {
      var s = document.createElement('script'); s.src = 'js/chat-crypto.js?v=79';
      s.onload = function () { ok(!!root.HJChat); }; s.onerror = function () { ok(false); };
      document.head.appendChild(s);
    });
  }
  function b64json(b64) {
    var bin = atob(String(b64).replace(/\s+/g, '')), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder('utf-8').decode(u));
  }
  function get(url, unwrap) {
    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) return 'none';
        if (!r.ok) throw new Error('room ' + r.status);
        return r.json().then(unwrap);
      });
  }
  function fromApi(j) {
    /* 1MB 넘는 파일은 content 가 비어 와요 → raw 로 넘김 */
    if (!j || j.encoding !== 'base64' || !j.content) throw new Error('api-big');
    return b64json(j.content);
  }
  function same(j) { return j; }
  function fetchRoom() {
    var h = location.hostname, p;
    if (h === 'localhost' || h === '127.0.0.1') p = get(new URL('chat/room.json', document.baseURI).href, same).then(function (j) { via = '이 컴퓨터'; return j; });
    else p = get(API, fromApi).then(function (j) { via = 'GitHub API'; return j; }, function () {
      return get(RAW, same).then(function (j) { via = 'raw(최대 5분 늦음)'; return j; });
    });
    return p.then(function (j) { room = j === 'none' ? 'none' : j; gotAt = new Date(); return room; });
  }
  function gotHTML(esc) {
    if (!gotAt) return '';
    var t = ('0' + gotAt.getHours()).slice(-2) + ':' + ('0' + gotAt.getMinutes()).slice(-2) + ':' + ('0' + gotAt.getSeconds()).slice(-2);
    return '<p class="ch-got" id="ch-got">받은 곳 ' + esc(via) + ' · ' + t + ' 받음</p>';
  }
  var WHY = '이 방은 <b>열쇠가 있어야</b> 읽혀요. 저장소에는 알아볼 수 없는 암호문만 올라가요(AES-GCM). ' +
    '다만 <b>글이 몇 개인지·언제 올라왔는지</b>는 누구나 볼 수 있어요. 그래서 개인정보·금액·공문 본문은 넣지 않아요.';
  function lockedHTML(esc) {
    return '<section class="ch-lock" id="ch-lock"><div class="ic" aria-hidden="true">🔒</div><p><b>잠겨 있어요</b></p>' +
      '<form id="ch-form" autocomplete="off"><label for="ch-key">열쇠</label>' +
      '<input id="ch-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="계정 메모의 hj-chat 열쇠" required>' +
      '<button class="btn" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? '여는 중…' : '열기') + '</button></form>' +
      (err ? '<div class="ch-err" role="alert">' + esc(err) + '</div>' : '') + '</section>';
  }
  function openHTML(esc) {
    var C = root.HJChat;
    var list = msgs.length ? msgs.map(C.bubbleHTML).join('') : '<p class="ch-empty">아직 글이 없어요.</p>';
    return '<div class="ch-bar"><span class="st">🔓 열림 · 글 ' + msgs.length + '개 <small title="계정 메모의 방 지문과 같아야 해요">· 방 지문 ' + esc(C.fingerprint(room)) + '</small></span><span><button type="button" id="ch-re">새로 읽기</button> <button type="button" id="ch-lockbtn">잠그기</button></span></div>' +
      '<div class="ch-list" id="ch-list" aria-live="polite">' + list + '</div>';
  }
  function paint(el, api) {
    var esc = api.esc, body;
    if (!root.HJChat) body = '<div class="ch-err">암호 파일(js/chat-crypto.js)을 못 불러왔어요. 새로고침해 주세요.</div>';
    else if (room === 'none') body = '<p class="ch-empty" id="ch-none">방이 아직 없어요. 대장이 열쇠를 정하고 방을 만들면 열려요.</p>';
    else if (!room) body = '<p class="ch-empty">불러오는 중…</p>';
    else if (room === 'fail') body = '<div class="ch-err">방 파일을 못 불러왔어요. 인터넷을 확인하고 새로고침해 주세요.</div>';
    else body = (key && msgs ? openHTML(esc) : lockedHTML(esc)) + gotHTML(esc);
    el.innerHTML = '<div class="ch-wrap"><header class="ch-head"><h1>대장↔클로드 방</h1><p class="ch-why">' + WHY + '</p></header>' + body +
      '<p class="ch-how">글 쓰기는 이 화면이 아니라 도구로 해요: <code>node tools/hj_chat.mjs post --from 클로드 --text "…"</code> (열쇠는 HJ_CHAT_KEY 환경변수). 업무 PC가 꺼져 있어도 claude.ai 웹·휴대폰에서 돼요. <a href="#/bots">봇 현황으로</a></p></div>';
    var f = el.querySelector('#ch-form');
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      var inp = el.querySelector('#ch-key'), pass = inp.value; inp.value = '';
      busy = true; err = ''; paint(el, api);
      root.HJChat.unlock(pass, room).then(function (k) { key = k; return root.HJChat.readAll(k, room); })
        .then(function (m) { msgs = m; }, function (x) { key = null; msgs = null; err = (x && x.message) || '열쇠가 달라요'; })
        .then(function () { pass = ''; busy = false; paint(el, api); });
    };
    var re = el.querySelector('#ch-re');
    if (re) re.onclick = function () {
      fetchRoom().then(function () { return room && room !== 'none' ? root.HJChat.readAll(key, room) : []; })
        .then(function (m) { msgs = m; paint(el, api); }, function () { room = 'fail'; paint(el, api); });
    };
    var lb = el.querySelector('#ch-lockbtn');
    if (lb) lb.onclick = function () { key = null; msgs = null; paint(el, api); };
  }
  function render(el, api) {
    style();
    paint(el, api);
    var need = [loadCore()];
    if (!tried) { tried = true; need.push(fetchRoom().catch(function () { room = 'fail'; tried = false; })); }
    Promise.all(need).then(function () { if (el.querySelector('.ch-wrap')) paint(el, api); });
  }
  if (root.ShellModules) root.ShellModules.chat = { id: 'chat', tab: '대장↔클로드 방', render: render };
})(typeof window !== 'undefined' ? window : globalThis);
