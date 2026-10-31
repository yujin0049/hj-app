/* hj-chat-relay: 대장↔클로드 방(#/chat)의 「보내기」 중계 Worker + D1(무료).
   - 받는 것: 암호문 봉투만 {fp, msg:{id, iv, ct}} (js/chat-crypto.js 가 만든 모양). 평문·다른 모양은 400.
   - 열쇠도 GitHub 토큰도 없음. 이 Worker 는 글을 풀 수 없어요(보관·전달만).
   - 막는 것: 크기 8KB, IP당 분당 10번(IP 는 SHA-256 앞 16자로만 저장), 방 지문(salt 앞 8자) 다르면 403, 허용 출처 밖 브라우저 403.
   - 읽기: GET /msgs?since=<n> → {fp, last, msgs:[{n,id,iv,ct}]} (공개 암호문, chat-collect 가 chat/room.json 에 합침).
   설정(비밀 아님, Worker 변수): ROOM_FP, ALLOW_ORIGINS(쉼표). D1 바인딩: DB. 표: schema.sql
   출처: 유진님 10.31. 「대장. 클로드 채팅방 맘췄어」 → 춘식이 p1 채팅방 입력칸. */
export const MAX_BODY = 8192, RATE_PER_MIN = 10, PAGE = 200, MAX_ROWS = 5000;
const ID_RE = /^m\d{12}-[0-9a-f]{6}$/, IV_RE = /^[A-Za-z0-9+/]{16}$/, B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/* 봉투 검사(순수 함수, 시험에서 직접 부름): 맞으면 {ok:true, msg}, 아니면 {ok:false, status, error} */
export function checkEnvelope(text, roomFp, nowMs) {
  if (typeof text !== 'string' || !text) return { ok: false, status: 400, error: 'empty' };
  if (new TextEncoder().encode(text).length > MAX_BODY) return { ok: false, status: 413, error: 'too-big' };
  let j;
  try { j = JSON.parse(text); } catch (e) { return { ok: false, status: 400, error: 'not-json' }; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { ok: false, status: 400, error: 'shape' };
  const keys = Object.keys(j).sort().join(',');
  if (keys !== 'fp,msg') return { ok: false, status: 400, error: 'shape' };
  const m = j.msg;
  if (!m || typeof m !== 'object' || Object.keys(m).sort().join(',') !== 'ct,id,iv') return { ok: false, status: 400, error: 'shape' };
  if (typeof j.fp !== 'string' || !roomFp || j.fp !== roomFp) return { ok: false, status: 403, error: 'other-room' };
  if (typeof m.id !== 'string' || !ID_RE.test(m.id)) return { ok: false, status: 400, error: 'id' };
  if (typeof m.iv !== 'string' || !IV_RE.test(m.iv)) return { ok: false, status: 400, error: 'iv' };
  if (typeof m.ct !== 'string' || !B64_RE.test(m.ct) || m.ct.length % 4 !== 0) return { ok: false, status: 400, error: 'ct' };
  /* AES-GCM: 본문 1바이트 이상 + 꼬리표 16바이트 → base64 24자 이상 */
  if (m.ct.length < 24) return { ok: false, status: 400, error: 'ct' };
  /* 글 번호 안의 시각(서울)이 지금과 하루 넘게 다르면 거절(옛 번호로 끼워 넣기 막기) */
  const t = m.id.slice(1, 13);
  const at = Date.UTC(2000 + +t.slice(0, 2), +t.slice(2, 4) - 1, +t.slice(4, 6), +t.slice(6, 8) - 9, +t.slice(8, 10), +t.slice(10, 12));
  if (!isFinite(at) || Math.abs(at - (nowMs == null ? Date.now() : nowMs)) > 86400000) return { ok: false, status: 400, error: 'time' };
  return { ok: true, msg: { id: m.id, iv: m.iv, ct: m.ct } };
}

function origins(env) { return String(env.ALLOW_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean); }
function cors(req, env) {
  const o = req.headers.get('Origin');
  const h = { 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
  if (o && origins(env).includes(o)) {
    h['Access-Control-Allow-Origin'] = o;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}
function json(obj, status, h) { return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, h) }); }
async function ipTag(req) {
  const ip = req.headers.get('CF-Connecting-IP') || 'none';
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hj-chat-relay:' + ip)));
  return Array.from(d.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), h = cors(req, env), o = req.headers.get('Origin');
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: h });
    if (req.method === 'OPTIONS') return new Response(null, { status: o && origins(env).includes(o) ? 204 : 403, headers: h });
    if (url.pathname === '/msgs' && req.method === 'GET') {
      if (o && !origins(env).includes(o)) return json({ error: 'origin' }, 403, h);
      const since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0);
      const r = await env.DB.prepare('SELECT n, id, iv, ct FROM msgs WHERE n > ? ORDER BY n LIMIT ?').bind(since, PAGE).all();
      const rows = r.results || [];
      return json({ fp: env.ROOM_FP, last: rows.length ? rows[rows.length - 1].n : since, more: rows.length === PAGE, msgs: rows }, 200, h);
    }
    if (url.pathname === '/msg' && req.method === 'POST') {
      if (!o || !origins(env).includes(o)) return json({ error: 'origin' }, 403, h);
      const len = +(req.headers.get('Content-Length') || 0);
      if (len > MAX_BODY) return json({ error: 'too-big' }, 413, h);
      if (!/^application\/json\b/i.test(req.headers.get('Content-Type') || '')) return json({ error: 'type' }, 415, h);
      const text = await req.text();
      const c = checkEnvelope(text, env.ROOM_FP);
      if (!c.ok) return json({ error: c.error }, c.status, h);
      const tag = await ipTag(req), minute = Math.floor(Date.now() / 60000);
      const rl = await env.DB.prepare('INSERT INTO rl (ip, minute, c) VALUES (?, ?, 1) ON CONFLICT (ip, minute) DO UPDATE SET c = c + 1 RETURNING c').bind(tag, minute).first();
      if (rl && rl.c > RATE_PER_MIN) return json({ error: 'rate' }, 429, Object.assign({ 'Retry-After': '60' }, h));
      if (minute % 10 === 0) await env.DB.prepare('DELETE FROM rl WHERE minute < ?').bind(minute - 10).run();
      const cnt = await env.DB.prepare('SELECT COUNT(*) AS k FROM msgs').first();
      if (cnt && cnt.k >= MAX_ROWS) return json({ error: 'full' }, 507, h);
      const ins = await env.DB.prepare('INSERT OR IGNORE INTO msgs (id, iv, ct, at) VALUES (?, ?, ?, ?)').bind(c.msg.id, c.msg.iv, c.msg.ct, new Date().toISOString()).run();
      const row = await env.DB.prepare('SELECT n FROM msgs WHERE id = ?').bind(c.msg.id).first();
      return json({ ok: true, n: row && row.n, dup: !(ins.meta && ins.meta.changes) }, 200, h);
    }
    return json({ error: 'not-found' }, 404, h);
  }
};
