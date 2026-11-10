/* #/chat 「EXAONE 시험 칸」: 대장↔클로드 방 아래에 붙는 따로 된 칸(방 열쇠·방 글과 섞이지 않음).
   - 보내는 곳: 중계 Worker hj-exaone-proxy(worker/exaone-proxy/) 의 /chat 하나. EXAONE 열쇠는 Worker 비밀에만 있어요(이 화면엔 없음).
   - 화면엔 최종 답(text)만 보여요. 추론 과정(reasoning_content)은 Worker 가 버리고, 여기서도 안 읽어요.
   - 대화는 이 탭 메모리에만(저장 안 함, 새로고침하면 사라짐). 최근 8개까지만 같이 보내요.
   - 열쇠가 아직 없으면 Worker 가 {error:'키 미설정'} → 「키 미설정」 안내만.
   출처: 유진님 11.10. 22:36 「ㄱ」(대장 전달, 춘식이 exaone_trial). */
(function (root) {
  'use strict';
  var PROXY = 'https://hj-exaone-proxy.yujin06344.workers.dev';
  var NOTICE = '개인정보·내부문서는 외부(EXAONE)로 보내지 마세요';
  var MAX_IN = 1500, KEEP = 8;
  var turns = [], draft = '', busy = false, note = '', noteKind = '', cur = null;  /* cur = 지금 붙어 있는 칸(위 방이 다시 그려져도 새 칸에 그림) */
  var CSS = [
    '.ex-wrap{max-width:680px;margin:18px auto 0;padding:0 12px 48px;box-sizing:border-box}',
    '.ex-pane{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px}',
    '.ex-pane h2{margin:0 0 4px;font-size:1.1rem;letter-spacing:-.02em}',
    '.ex-why{font-size:.8rem;color:var(--muted);line-height:1.45;margin:0 0 10px}',
    '.ex-list{display:flex;flex-direction:column;gap:8px;margin:0 0 10px}',
    '.ex-msg{max-width:86%;white-space:pre-wrap;overflow-wrap:anywhere;word-break:keep-all;line-height:1.45;font-size:.95rem;border-radius:16px;padding:9px 12px;border:1px solid var(--line);background:var(--soft);color:var(--ink)}',
    '.ex-msg.user{align-self:flex-end;background:var(--blue-soft);border-color:transparent}',
    '.ex-msg.assistant{align-self:flex-start}',
    '.ex-notice{font-size:.85rem;font-weight:800;color:var(--warn);background:var(--warnbg);border-radius:10px;padding:8px 10px;margin:0 0 8px}',
    '.ex-form{display:flex;gap:8px;align-items:flex-end}',
    '.ex-form textarea{flex:1;min-width:0;min-height:48px;max-height:40vh;resize:vertical;box-sizing:border-box;border:1px solid var(--line);border-radius:14px;padding:11px 12px;font:inherit;font-size:1rem;line-height:1.4;background:var(--soft);color:var(--ink)}',
    '.ex-form button{flex:0 0 auto;min-width:64px;min-height:48px;border:0;border-radius:14px;padding:0 14px;font-weight:800;font-size:1rem;background:var(--navy);color:#fff;cursor:pointer}',
    '.ex-form button[disabled]{opacity:.55;cursor:default}',
    '.ex-note{font-size:.82rem;margin:8px 2px 0;color:var(--muted)}.ex-note.bad{color:var(--no);background:var(--nobg);border-radius:10px;padding:8px 10px}',
    '.ex-note.nokey{color:var(--warn);background:var(--warnbg);border-radius:10px;padding:8px 10px;font-weight:700}'
  ].join('\n');
  function style() {
    if (!root.document || document.getElementById('ex-style')) return;
    var s = document.createElement('style'); s.id = 'ex-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  /* Worker 답에서 보여 줄 글만 꺼냄: {ok,text} 의 text 하나. 추론(reasoning_content)·원본 choices 는 안 봐요. */
  function answerOf(j) {
    return j && j.ok === true && typeof j.text === 'string' && j.text.trim() ? j.text.trim() : null;
  }
  /* 실패 → 화면 문구 */
  function errText(status, j) {
    var e = j && j.error;
    if (e === '키 미설정') return { kind: 'nokey', text: '키 미설정 · EXAONE 열쇠를 아직 안 넣었어요(유진님 발급 뒤 Worker 비밀로 넣으면 바로 돼요).' };
    if (e === 'rate' || e === 'upstream-rate' || status === 429) return { kind: 'bad', text: '너무 자주 보냈어요. 1분 뒤 다시 보내 주세요' };
    if (e === 'origin') return { kind: 'bad', text: '이 주소에서는 보낼 수 없어요(허용된 앱 주소에서만)' };
    if (e === 'too-long' || e === 'too-big') return { kind: 'bad', text: '글이 너무 길어요(나눠서 보내 주세요)' };
    if (e === 'key-rejected') return { kind: 'bad', text: 'EXAONE 이 열쇠를 거절했어요(' + ((j && j.code) || '') + ', 열쇠 확인 필요)' };
    var d = j && typeof j.detail === 'string' && j.detail ? ' · ' + j.detail.slice(0, 120) : '';
    return { kind: 'bad', text: '답을 못 받았어요(' + (status || '연결 안 됨') + (e ? ' ' + e : '') + ')' + d };
  }
  function repaint() { if (cur) paint(cur.slot, cur.api); }
  function ask(text) {
    busy = true; note = ''; noteKind = '';
    turns.push({ role: 'user', content: text }); draft = '';
    repaint();
    var body = JSON.stringify({ messages: turns.slice(-KEEP) });
    return root.fetch(PROXY + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, cache: 'no-store' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var a = r.ok ? answerOf(j) : null;
          if (a) { turns.push({ role: 'assistant', content: a }); return; }
          var e = errText(r.status, j); throw Object.assign(new Error(e.text), { kind: e.kind });
        });
      })
      .catch(function (x) {
        turns.pop(); draft = text;
        note = (x && x.message) || '답을 못 받았어요'; noteKind = (x && x.kind) || 'bad';
      })
      .then(function () { busy = false; repaint(); });
  }
  function paint(slot, api) {
    if (!slot) return;
    var esc = api.esc;
    var list = turns.map(function (t) {
      return '<div class="ex-msg ' + (t.role === 'user' ? 'user' : 'assistant') + '">' + esc(t.content) + '</div>';
    }).join('');
    slot.innerHTML = '<div class="ex-wrap"><section class="ex-pane" id="ex-pane" aria-labelledby="ex-h"><h2 id="ex-h">EXAONE 시험 칸</h2>' +
      '<p class="ex-why">K-EXAONE 2.5(LG, 외부 서비스)에 물어보는 시험 칸이에요. 대장↔클로드 방과 따로예요. 대화는 이 탭에만 있고 저장하지 않아요. 답만 보여요(생각 과정은 숨김).</p>' +
      '<div class="ex-list" id="ex-list" aria-live="polite">' + list + (busy ? '<div class="ex-msg assistant" id="ex-wait">답 기다리는 중…</div>' : '') + '</div>' +
      '<p class="ex-notice" id="ex-notice" role="note">' + esc(NOTICE) + '</p>' +
      '<form class="ex-form" id="ex-form" autocomplete="off"><label for="ex-text" style="position:absolute;left:-9999px">EXAONE 에 보낼 글</label>' +
      '<textarea id="ex-text" rows="2" maxlength="' + MAX_IN + '" placeholder="EXAONE 에 물어보기 (외부로 나가요)"' + (busy ? ' disabled' : '') + '>' + esc(draft) + '</textarea>' +
      '<button type="submit" id="ex-go"' + (busy ? ' disabled' : '') + '>' + (busy ? '보내는 중' : '보내기') + '</button></form>' +
      (note ? '<p class="ex-note ' + esc(noteKind) + '" id="ex-err" role="alert">' + esc(note) + '</p>' : '') +
      '</section></div>';
    var f = slot.querySelector('#ex-form'), ta = slot.querySelector('#ex-text');
    if (ta) {
      ta.oninput = function () { draft = ta.value; };
      ta.onkeydown = function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (f.requestSubmit) f.requestSubmit(); else f.onsubmit(e); } };
    }
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      if (busy) return;
      var t = (ta.value || '').trim();
      if (!t) { note = '글이 비었어요'; noteKind = 'bad'; paint(slot, api); return; }
      ask(t);
    };
  }
  function mount(slot, api) { if (!slot) return; cur = { slot: slot, api: api }; style(); paint(slot, api); }
  root.HJExaone = { mount: mount, answerOf: answerOf, errText: errText, PROXY: PROXY, NOTICE: NOTICE };
})(typeof window !== 'undefined' ? window : globalThis);
