/* hj-exaone-proxy: #/chat 「EXAONE 시험 칸」 전용 중계 Worker (기존 hj-chat-relay 와 따로 — 대장↔클로드 방에 영향 없음).
   - 받는 것: POST /chat {messages:[{role:'user'|'assistant', content}]} (최근 8개·합계 4000자 이하).
   - 보내는 곳: EXAONE(OpenAI 호환) POST https://api.exaone.ai/v1/chat/completions, model=k-exaone_v2.5, reasoning_effort=low.
   - 돌려주는 것: {ok:true, text} — 최종 답(choices[0].message.content)만. 추론(reasoning_content)은 버려요.
   - 열쇠: Worker 비밀 EXAONE_API_KEY 하나뿐(코드·화면·로그에 없음). 없으면 503 {error:'키 미설정'}.
   - 막는 것: 허용 출처(ALLOW_ORIGINS, 쉼표) 밖·출처 없는 요청 403, 16KB 넘으면 413, JSON 아니면 415/400,
     IP당 분당 RATE_PER_MIN 번·전체 분당 RATE_ALL_PER_MIN 번(Worker 인스턴스 메모리, 최선 노력) 넘으면 429.
   - 기록 안 함: console 출력 없음, 요청 본문·답을 저장하지 않음(D1·KV 없음).
   출처: 유진님 11.10. 22:36 「ㄱ」(대장 전달, 춘식이 exaone_trial). */
export const MODEL = 'k-exaone_v2.5', UPSTREAM = 'https://api.exaone.ai/v1/chat/completions';
export const MAX_BODY = 16384, MAX_MSGS = 8, MAX_CHARS = 4000, MAX_TOKENS = 2048, RATE_PER_MIN = 6, RATE_ALL_PER_MIN = 40, TIMEOUT_MS = 60000;
const NO_KEY = '키 미설정';

/* 요청 검사(순수 함수): 맞으면 {ok:true, messages}, 아니면 {ok:false, status, error} */
export function checkRequest(text) {
  if (typeof text !== 'string' || !text) return { ok: false, status: 400, error: 'empty' };
  if (new TextEncoder().encode(text).length > MAX_BODY) return { ok: false, status: 413, error: 'too-big' };
  let j;
  try { j = JSON.parse(text); } catch (e) { return { ok: false, status: 400, error: 'not-json' }; }
  if (!j || typeof j !== 'object' || Array.isArray(j) || Object.keys(j).join(',') !== 'messages') return { ok: false, status: 400, error: 'shape' };
  const ms = j.messages;
  if (!Array.isArray(ms) || !ms.length || ms.length > MAX_MSGS) return { ok: false, status: 400, error: 'messages' };
  let total = 0;
  const out = [];
  for (const m of ms) {
    if (!m || typeof m !== 'object' || Object.keys(m).sort().join(',') !== 'content,role') return { ok: false, status: 400, error: 'shape' };
    if (m.role !== 'user' && m.role !== 'assistant') return { ok: false, status: 400, error: 'role' };
    if (typeof m.content !== 'string' || !m.content.trim()) return { ok: false, status: 400, error: 'content' };
    total += m.content.length;
    out.push({ role: m.role, content: m.content });
  }
  if (total > MAX_CHARS) return { ok: false, status: 413, error: 'too-long' };
  if (out[out.length - 1].role !== 'user') return { ok: false, status: 400, error: 'last-not-user' };
  return { ok: true, messages: out };
}

/* EXAONE 응답에서 최종 답만 꺼냄(추론 reasoning_content 는 절대 안 씀). 없으면 null */
export function pickAnswer(j) {
  const c = j && Array.isArray(j.choices) && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  return typeof c === 'string' && c.trim() ? c.trim() : null;
}

/* 분당 횟수 세기(이 Worker 인스턴스 메모리). 여러 인스턴스로 갈리면 조금 더 통과할 수 있어요(최선 노력). */
const hits = new Map();
export function rateHit(tag, nowMs) {
  const minute = Math.floor((nowMs == null ? Date.now() : nowMs) / 60000);
  for (const k of hits.keys()) if (!k.endsWith(':' + minute)) hits.delete(k);
  const a = 'ip:' + tag + ':' + minute, b = 'all:' + minute;
  const ca = (hits.get(a) || 0) + 1, cb = (hits.get(b) || 0) + 1;
  if (ca > RATE_PER_MIN || cb > RATE_ALL_PER_MIN) return false;
  hits.set(a, ca); hits.set(b, cb);
  return true;
}
export function _resetRate() { hits.clear(); }

function origins(env) { return String(env.ALLOW_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean); }
function cors(req, env) {
  const o = req.headers.get('Origin');
  const h = { 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
  if (o && origins(env).includes(o)) {
    h['Access-Control-Allow-Origin'] = o;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}
function json(obj, status, h) { return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, h) }); }
async function ipTag(req) {
  const ip = req.headers.get('CF-Connecting-IP') || 'none';
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hj-exaone-proxy:' + ip)));
  return Array.from(d.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(req, env, ctx, deps) {
    const doFetch = (deps && deps.fetch) || fetch;
    const url = new URL(req.url), h = cors(req, env), o = req.headers.get('Origin'), allowed = !!o && origins(env).includes(o);
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: h });
    if (req.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: h });
    if (url.pathname !== '/chat') return json({ error: 'not-found' }, 404, h);
    if (req.method !== 'POST') return json({ error: 'method' }, 405, h);
    if (!allowed) return json({ error: 'origin' }, 403, h);
    if (+(req.headers.get('Content-Length') || 0) > MAX_BODY) return json({ error: 'too-big' }, 413, h);
    if (!/^application\/json\b/i.test(req.headers.get('Content-Type') || '')) return json({ error: 'type' }, 415, h);
    const c = checkRequest(await req.text());
    if (!c.ok) return json({ error: c.error }, c.status, h);
    if (!rateHit(await ipTag(req))) return json({ error: 'rate' }, 429, Object.assign({ 'Retry-After': '60' }, h));
    const key = typeof env.EXAONE_API_KEY === 'string' ? env.EXAONE_API_KEY.trim() : '';
    if (!key) return json({ error: NO_KEY }, 503, h);
    let r;
    try {
      r = await doFetch(UPSTREAM, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages: c.messages, reasoning_effort: 'low', max_tokens: MAX_TOKENS, stream: false }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch (e) {
      return json({ error: 'upstream-unreachable' }, 502, h);
    }
    if (r.status === 401 || r.status === 403) return json({ error: 'key-rejected' }, 502, h);
    if (r.status === 429) return json({ error: 'upstream-rate' }, 429, Object.assign({ 'Retry-After': '60' }, h));
    if (!r.ok) return json({ error: 'upstream', code: r.status }, 502, h);
    let j;
    try { j = await r.json(); } catch (e) { return json({ error: 'upstream-shape' }, 502, h); }
    const text = pickAnswer(j);
    if (!text) return json({ error: 'empty-answer' }, 502, h);
    return json({ ok: true, text }, 200, h);
  }
};
