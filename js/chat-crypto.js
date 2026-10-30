/* 대장↔클로드 채팅방 암호 공용 파일 (브라우저 화면 · node 도구 둘 다 씀, 전역 HJChat).
   저장소(공개)에는 암호문만: {v, salt, iter, check, msgs:[{id, iv, ct}]}. 보낸 사람·시각·본문은 모두 ct 안.
   열쇠 글자 → PBKDF2-SHA256(ITER번) → AES-GCM 256. 글마다 무작위 IV 12바이트, 방 salt+글 번호(id)를 AAD 로 묶어 다른 방·다른 번호로 옮겨 붙이기를 막음.
   글 번호 = m + 보낸 시각(YYMMDDHHMMSS) + - + 무작위 6자 → 두 곳에서 동시에 써도 번호가 안 겹치고, 합칠 때는 번호로 합집합(merge, 열쇠 필요 없음).
   열쇠는 어디에도 저장하지 않아요(정본: 볼트 00 홈/계정_메모.md, 대장·유진님이 넣음). 계획: 봇공유/조사/261030_대장클로드_채팅방_계획_v01.md */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HJChat = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  var MAX_ADD = 50, MAX_MSGS = 5000;
  var V = 1, ITER = 600000, MIN_ITER = 600000, CHECK = 'hj-chat-ok', MAX_TEXT = 4000, MIN_KEY = 20;
  var FROM = ['대장', '클로드', '유진님', '춘식이', '춘식이2', '춘식이3', '문서봇'];
  function subtle() { var c = root.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto); if (!c || !c.subtle) throw new Error('이 브라우저는 암호 기능(WebCrypto)이 없어요'); return c; }
  function enc(s) { return new TextEncoder().encode(s); }
  function dec(b) { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
  function b64(u8) { var s = ''; u8 = new Uint8Array(u8); for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { if (typeof s !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) throw new Error('b64'); var t = atob(s), u = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }
  function rand(n) { var u = new Uint8Array(n); subtle().getRandomValues(u); return u; }
  var ID_RE = /^m\d{12}-[0-9a-f]{6}$/;
  function aad(room, id) { return enc('hj-chat:v' + V + ':' + room.salt + ':' + id); }
  function deriveKey(pass, room) {
    if (typeof pass !== 'string' || !pass) return Promise.reject(new Error('열쇠가 비었어요'));
    var iter = +room.iter;
    if (!(iter >= MIN_ITER && iter <= 5000000)) return Promise.reject(new Error('방 파일의 반복 횟수가 이상해요'));
    var c = subtle();
    return c.subtle.importKey('raw', enc(pass), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return c.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(room.salt), iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function seal(key, room, id, obj) {
    var iv = rand(12);
    return subtle().subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: aad(room, id) }, key, enc(JSON.stringify(obj)))
      .then(function (ct) { return { id: id, iv: b64(iv), ct: b64(ct) }; });
  }
  function open(key, room, m) {
    return Promise.resolve().then(function () {
      return subtle().subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv), additionalData: aad(room, m.id) }, key, unb64(m.ct));
    }).then(function (pt) { return JSON.parse(dec(pt)); });
  }
  function valid(room) { return !!room && room.v === V && typeof room.salt === 'string' && /^[A-Za-z0-9+/]{22}==$/.test(room.salt) && !!room.check && typeof room.check.iv === 'string' && typeof room.check.ct === 'string' && Array.isArray(room.msgs) && (room.drop == null || Array.isArray(room.drop)); }
  /* 방 새로 만들기(대장이 한 번): salt 무작위 + 확인용 낱말 암호문 */
  function initRoom(pass) {
    if (typeof pass !== 'string' || Array.from(pass).length < MIN_KEY) return Promise.reject(new Error('열쇠는 ' + MIN_KEY + '자 이상이어야 해요'));
    var room = { v: V, salt: b64(rand(16)), iter: ITER, check: null, msgs: [] };
    return deriveKey(pass, room).then(function (k) { return seal(k, room, 'check', { ok: CHECK }); }).then(function (c) { room.check = c; return room; });
  }
  /* 열쇠 맞는지: 틀리면 reject('열쇠가 달라요') */
  function unlock(pass, room) {
    if (!valid(room)) return Promise.reject(new Error('방 파일 모양이 달라요'));
    return deriveKey(pass, room).then(function (k) {
      return open(k, room, { id: 'check', iv: room.check.iv, ct: room.check.ct }).then(function (o) { if (!o || o.ok !== CHECK) throw 0; return k; }, function () { throw new Error('열쇠가 달라요'); });
    });
  }
  function cleanFrom(s) { return FROM.indexOf(s) >= 0 ? s : '그 밖'; }
  function cleanText(s) { return Array.from(String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '')).slice(0, MAX_TEXT).join(''); }
  /* 모든 글 풀기: 깨진 글은 {bad:true} 로(위조·다른 열쇠), 순서는 파일 순서 */
  function readAll(key, room) {
    var seen = {};
    return Promise.all(sorted(room.msgs).map(function (m) {
      if (!m || typeof m.id !== 'string' || !ID_RE.test(m.id) || seen[m.id]) return { id: String(m && m.id), bad: true };
      seen[m.id] = 1;
      return open(key, room, m).then(function (o) {
        /* 글 안의 번호·시각이 바깥 번호와 같아야 함(번호 바꿔 붙이기 막기) */
        if (!o || o.id !== m.id || idOf(o.at) !== m.id.slice(1, 13)) return { id: m.id, bad: true };
        return { id: m.id, from: cleanFrom(o.from), at: String(o.at || ''), text: cleanText(o.text) };
      }, function () { return { id: m.id, bad: true }; });
    }));
  }
  function idOf(at) { var m = /^20(\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(String(at || '')); return m ? m.slice(1).join('') : ''; }
  function hex(n) { return Array.from(rand(n)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, n * 2); }
  function newId(atIso) { var t = idOf(atIso); if (!t) throw new Error('시각 모양이 달라요'); return 'm' + t + '-' + hex(3); }
  function sorted(msgs) { return (msgs || []).slice().sort(function (a, b) { a = String(a && a.id); b = String(b && b.id); return a < b ? -1 : (a > b ? 1 : 0); }); }
  function shapeOk(m) { return !!m && typeof m.id === 'string' && ID_RE.test(m.id) && typeof m.iv === 'string' && /^[A-Za-z0-9+/]{16}$/.test(m.iv) && typeof m.ct === 'string' && m.ct.length <= 24000 && /^[A-Za-z0-9+/]+={0,2}$/.test(m.ct); }
  /* 두 방 파일 합치기(열쇠 필요 없음, 모으기 workflow 용): 같은 방(salt·iter·check 같음)일 때만, 번호로 합집합.
     base.drop(지운 번호 목록, 대장이 손으로)에 있는 번호는 다시 안 살림. 한 번에 50개·방 전체 5000개까지(쓰레기 글 폭탄 막기). */
  function merge(base, extra) {
    if (!valid(base) || !valid(extra)) throw new Error('방 파일 모양이 달라요');
    if (base.salt !== extra.salt || base.iter !== extra.iter || JSON.stringify(base.check) !== JSON.stringify(extra.check)) throw new Error('다른 방이에요(합치지 않음)');
    var have = {}, out = JSON.parse(JSON.stringify(base)), added = 0;
    out.msgs.forEach(function (m) { if (m && m.id) have[m.id] = 1; });
    (base.drop || []).forEach(function (id) { have[String(id)] = 1; });
    extra.msgs.forEach(function (m) {
      if (added >= MAX_ADD || out.msgs.length >= MAX_MSGS) return;
      if (shapeOk(m) && !have[m.id]) { have[m.id] = 1; out.msgs.push({ id: m.id, iv: m.iv, ct: m.ct }); added++; }
    });
    out.msgs = sorted(out.msgs);
    return { room: out, added: added };
  }
  /* 방 지문: salt 앞 8자(공개값). 열쇠가 맞으면 이미 같은 방이라 보호를 더하지는 않고, 「다른 방 파일을 보고 있나」 눈으로 확인하는 용도만 */
  function fingerprint(room) { return String(room && room.salt || '').slice(0, 8); }
  /* 글 하나 덧붙이기(도구용): 새 room 을 돌려줌 */
  function post(key, room, from, text, atIso) {
    var t = cleanText(text).trim();
    if (!t) return Promise.reject(new Error('글이 비었어요'));
    if (FROM.indexOf(from) < 0) return Promise.reject(new Error('보낸 사람은 ' + FROM.join('·') + ' 중 하나'));
    var id = newId(atIso);
    return seal(key, room, id, { id: id, from: from, at: atIso, text: t }).then(function (m) { var r = JSON.parse(JSON.stringify(room)); r.msgs.push(m); r.msgs = sorted(r.msgs); return r; });
  }
  /* 화면용: 시각 'YYYY-MM-DDTHH:MM…' → '10.30.(금) 19:43' (서울 시간 그대로 적힌 값) */
  function atText(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(s || ''));
    if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return (+m[2]) + '.' + (+m[3]) + '.(' + '일월화수목금토'[d.getUTCDay()] + ') ' + m[4] + ':' + m[5];
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"'`]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]; }); }
  function side(from) { return from === '대장' ? 'l' : (from === '클로드' ? 'r' : 'c'); }
  /* 말풍선 HTML: 모두 글자로만(esc), 줄바꿈은 CSS white-space 로 */
  function bubbleHTML(m) {
    if (m.bad) return '<div class="ch-msg c bad"><div class="ch-b">풀 수 없는 글이에요(다른 열쇠이거나 고쳐진 글) · ' + esc(m.id) + '</div></div>';
    var who = cleanFrom(m.from);
    return '<div class="ch-msg ' + side(who) + '"><div class="ch-who">' + esc(who) + ' <time>' + esc(atText(m.at)) + '</time></div><div class="ch-b">' + esc(m.text) + '</div></div>';
  }
  return { V: V, ITER: ITER, MIN_KEY: MIN_KEY, FROM: FROM, MAX_TEXT: MAX_TEXT, deriveKey: deriveKey, ID_RE: ID_RE, initRoom: initRoom, unlock: unlock, readAll: readAll, post: post, valid: valid, merge: merge, fingerprint: fingerprint, newId: newId, atText: atText, esc: esc, bubbleHTML: bubbleHTML, _seal: seal };
});
