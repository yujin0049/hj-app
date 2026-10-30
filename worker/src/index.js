/* 출석부 서버 (Cloudflare Worker + D1)
   - 들어오기: 교수님별 링크의 긴 무작위 열쇠(128비트 이상) → Authorization: Bearer. D1 에는 SHA-256 만. 기한 지나면 401.
     누가 고쳤는지는 열쇠 주인(교수 이름 / 관리자)으로 서버가 적음(화면이 보낸 이름을 믿지 않음).
   - 교수: 회차 목록·회차 표 보기, 학생 한 명씩 출석/지각/결석 고치기(누를 때 한 번 저장).
     수업 날짜 + 7일 지나면 잠김(423). 관리자 링크로만 풀기·고치기.
   - 관리자: 명단·교수·시간표 가져오기(이름으로 맞춰 id 유지), 교수님별 링크 만들기, 잠금 풀기.
   - 동시 접속: 학생 한 명 = marks 한 줄 UPSERT(D1 batch = 한 트랜잭션). 같은 학생을 동시에 고치면 나중 것이 남고 history 에 둘 다.
     화면이 보던 버전(base)과 실제 덮은 버전(prev)이 다르면 overwrote=true + 앞 값·앞사람을 돌려줌.
   - history 는 덧붙이기만(schema.sql 트리거). CORS: ALLOWED_ORIGIN 에서 온 브라우저 요청만. 열쇠·이름을 console 에 남기지 않음.
   공용 기준(상태·잠금·출석률)은 화면과 같은 js/attend-core.js. */
import '../../js/attend-core.js';

const A = globalThis.HJAttend;
const enc = new TextEncoder();

function origins(env) { return String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean); }
function cors(req, env) {
  const o = req.headers.get('Origin');
  const h = { 'Vary': 'Origin' };
  if (o && origins(env).includes(o)) {
    h['Access-Control-Allow-Origin'] = o;
    h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}
function json(req, env, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...cors(req, env) } });
}
export async function sha256hex(s) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
export function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32)); // 256비트
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function nowIso() { return new Date().toISOString(); }

async function auth(req, env) {
  const m = /^Bearer ([A-Za-z0-9_-]{22,128})$/.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const t = await env.DB.prepare('SELECT t.role, t.prof_id, t.label, t.expires_at, p.name AS prof FROM tokens t LEFT JOIN profs p ON p.id = t.prof_id WHERE t.hash = ?1 AND t.revoked = 0').bind(await sha256hex(m[1])).first();
  if (!t || Date.parse(t.expires_at) < Date.now()) return null;
  return { role: t.role, prof_id: t.prof_id, name: t.role === 'prof' ? t.prof : t.label, expires_at: t.expires_at };
}

async function getSession(db, sid) {
  return db.prepare('SELECT s.*, p.name AS prof FROM sessions s LEFT JOIN profs p ON p.id = s.prof_id WHERE s.id = ?1').bind(sid).first();
}
function sessOut(s) {
  const [from, to] = A.times(s.p_from, s.p_to);
  return { id: s.id, date: s.date, p_from: s.p_from, p_to: s.p_to, from, to, hours: s.hours, subject: s.subject, prof_id: s.prof_id, prof: s.prof || '', unlocked: !!s.unlocked, locked: A.isLocked(s.date, s.unlocked), lock_at: new Date(A.lockAt(s.date)).toISOString() };
}

async function sessions(db) {
  const [ss, n, rows] = await db.batch([
    db.prepare('SELECT s.*, p.name AS prof FROM sessions s LEFT JOIN profs p ON p.id = s.prof_id ORDER BY s.date, s.p_from'),
    db.prepare('SELECT COUNT(*) AS n FROM students WHERE active = 1'),
    db.prepare("SELECT m.session, m.status, COUNT(*) AS n FROM marks m JOIN students s ON s.id = m.student_id AND s.active = 1 WHERE m.status != '' GROUP BY m.session, m.status"),
  ]);
  const cnt = {};
  for (const r of rows.results) (cnt[r.session] = cnt[r.session] || { o: 0, l: 0, x: 0 })[r.status] = r.n;
  return { students: n.results[0].n, today: A.kstDate(), sessions: ss.results.map((s) => ({ ...sessOut(s), count: cnt[s.id] || { o: 0, l: 0, x: 0 } })) };
}

async function sheet(db, s) {
  const [st, mk, hi] = await db.batch([
    db.prepare('SELECT id, name, no FROM students WHERE active = 1 ORDER BY no, id'),
    db.prepare('SELECT student_id, status, ver, who, at FROM marks WHERE session = ?1').bind(s.id),
    db.prepare('SELECT h.id, h.student_id, st.name, h.field, h.old, h.new, h.who, h.at, h.base_ver, h.prev_ver FROM history h LEFT JOIN students st ON st.id = h.student_id WHERE h.session = ?1 ORDER BY h.id DESC LIMIT 60').bind(s.id),
  ]);
  const marks = {};
  for (const r of mk.results) marks[r.student_id] = { st: r.status, ver: r.ver, who: r.who, at: r.at };
  return { session: sessOut(s), students: st.results, marks, history: hi.results, now: nowIso() };
}

async function stats(db) {
  const [st, ss, mk] = await db.batch([
    db.prepare('SELECT id, name, no FROM students WHERE active = 1 ORDER BY no, id'),
    db.prepare('SELECT id, date, hours FROM sessions ORDER BY date, p_from'),
    db.prepare("SELECT session, student_id, status FROM marks WHERE status != ''"),
  ]);
  const marks = {};
  for (const r of mk.results) (marks[r.session] = marks[r.session] || {})[r.student_id] = r.status;
  const r = A.rates(st.results.map((x) => x.id), ss.results, marks);
  return { note: '지각=출석으로 계산', need: A.NEED, students: st.results.map((x) => ({ id: x.id, name: x.name, no: x.no, ...r[x.id] })) };
}

async function mark(db, me, b) {
  const id = Number(b.id), st = b.st == null ? '' : String(b.st);
  if (!A.validStatus(st)) return [400, { error: '상태는 출석·지각·결석 중 하나' }];
  if (!Number.isInteger(id) || id < 1) return [400, { error: '학생 번호가 이상해요' }];
  const s = await getSession(db, String(b.s || ''));
  if (!s) return [400, { error: '회차가 없어요' }];
  if (A.isLocked(s.date, s.unlocked) && me.role !== 'admin') return [423, { error: '잠긴 회차(수업 7일 뒤). 관리자만 풀 수 있어요', locked: true }];
  const ok = await db.prepare('SELECT 1 AS ok FROM students WHERE id = ?1 AND active = 1').bind(id).first();
  if (!ok) return [404, { error: '명단에 없는 학생' }];
  const base = Number.isInteger(b.base) ? b.base : null, at = nowIso(), sid = s.id;
  const r = await db.batch([
    db.prepare("INSERT INTO history (session, student_id, field, old, new, who, at, base_ver, prev_ver) VALUES (?1, ?2, 'mark', (SELECT status FROM marks WHERE session = ?1 AND student_id = ?2), ?3, ?4, ?5, ?6, (SELECT ver FROM marks WHERE session = ?1 AND student_id = ?2))").bind(sid, id, st, me.name, at, base),
    db.prepare('SELECT h.old, h.prev_ver, (SELECT who FROM marks WHERE session = ?1 AND student_id = ?2) AS prev_who FROM history h WHERE h.id = last_insert_rowid()').bind(sid, id),
    db.prepare('INSERT INTO marks (session, student_id, status, ver, who, at) VALUES (?1, ?2, ?3, 1, ?4, ?5) ON CONFLICT (session, student_id) DO UPDATE SET status = excluded.status, ver = marks.ver + 1, who = excluded.who, at = excluded.at').bind(sid, id, st, me.name, at),
    db.prepare('SELECT status, ver, who, at FROM marks WHERE session = ?1 AND student_id = ?2').bind(sid, id),
  ]);
  const prev = r[1].results[0] || {}, m = r[3].results[0], prevVer = prev.prev_ver == null ? 0 : prev.prev_ver;
  const overwrote = base != null && prevVer !== base;
  return [200, { ok: true, id, mark: { st: m.status, ver: m.ver, who: m.who, at: m.at }, overwrote, before: overwrote ? { st: prev.old || '', who: prev.prev_who || '' } : null }];
}

/* 관리자: 명단·교수·시간표 가져오기. 이름으로 맞춰 id 유지(명단 순서가 바뀌어도 체크는 그 학생에게 그대로). */
async function importAll(db, b) {
  const out = {};
  const stmts = [];
  if (b.students != null) {
    let names;
    try { names = (Array.isArray(b.students) ? b.students.map(A.clean) : A.parseRoster(String(b.students))).map((n) => n.slice(0, 20)).filter(Boolean); }
    catch (e) { return [400, { error: e.message }]; }
    if (!names.length || names.length > 200) return [400, { error: '학생 1~200명' }];
    if (new Set(names).size !== names.length) return [400, { error: '같은 이름이 두 번 있어요(구분해서 적어 주세요)' }];
    stmts.push(db.prepare('UPDATE students SET active = 0'));
    names.forEach((n, i) => stmts.push(db.prepare('INSERT INTO students (name, no, active) VALUES (?1, ?2, 1) ON CONFLICT (name) DO UPDATE SET no = excluded.no, active = 1').bind(n, i + 1)));
    out.students = names.length;
  }
  if (Array.isArray(b.profs)) {
    b.profs.map(A.clean).filter(Boolean).forEach((n) => stmts.push(db.prepare('INSERT OR IGNORE INTO profs (name) VALUES (?1)').bind(n.slice(0, 20))));
    out.profs = b.profs.length;
  }
  if (stmts.length) await db.batch(stmts);
  if (Array.isArray(b.sessions)) {
    const ss = [];
    for (const s of b.sessions) {
      const a = Number(s.p_from), z = Number(s.p_to);
      if (!A.validDate(s.date) || !A.PERIOD[a] || !A.PERIOD[z] || z < a || !A.clean(s.subject)) return [400, { error: '시간표 줄이 이상해요', row: s }];
      ss.push(db.prepare('INSERT INTO sessions (id, date, p_from, p_to, hours, subject, prof_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, (SELECT id FROM profs WHERE name = ?7)) ON CONFLICT (id) DO UPDATE SET subject = excluded.subject, prof_id = excluded.prof_id, hours = excluded.hours')
        .bind(A.sessionId(s.date, a, z), s.date, a, z, z - a + 1, A.clean(s.subject).slice(0, 30), A.clean(s.prof || '')));
    }
    if (ss.length) await db.batch(ss);
    out.sessions = ss.length;
  }
  return [200, { ok: true, ...out }];
}

async function makeToken(db, b) {
  const role = b.role === 'admin' ? 'admin' : 'prof';
  let profId = null, label = A.clean(b.label || '관리자').slice(0, 20);
  if (role === 'prof') {
    const p = await db.prepare('SELECT id, name FROM profs WHERE name = ?1').bind(A.clean(b.prof)).first();
    if (!p) return [404, { error: '교수 목록에 없는 이름' }];
    profId = p.id; label = p.name;
  }
  const exp = String(b.expires_at || '');
  if (isNaN(Date.parse(exp))) return [400, { error: 'expires_at(ISO) 필요' }];
  const t = newToken();
  await db.prepare('INSERT INTO tokens (hash, role, prof_id, label, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(await sha256hex(t), role, profId, label, new Date(Date.parse(exp)).toISOString(), nowIso()).run();
  return [200, { ok: true, token: t, role, label, expires_at: new Date(Date.parse(exp)).toISOString() }];
}

async function unlock(db, me, b) {
  const s = await getSession(db, String(b.s || ''));
  if (!s) return [400, { error: '회차가 없어요' }];
  const v = b.unlocked ? 1 : 0;
  await db.batch([
    db.prepare("INSERT INTO history (session, student_id, field, old, new, who, at) VALUES (?1, NULL, 'unlock', ?2, ?3, ?4, ?5)").bind(s.id, String(s.unlocked), String(v), me.name, nowIso()),
    db.prepare('UPDATE sessions SET unlocked = ?2 WHERE id = ?1').bind(s.id, v),
  ]);
  return [200, { ok: true, session: sessOut({ ...s, unlocked: v }) }];
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname.replace(/\/+$/, '');
    const o = req.headers.get('Origin');
    if (o && !origins(env).includes(o)) return new Response('origin', { status: 403 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
    const out = (r) => json(req, env, r[1], r[0]);
    if (p === '/api/health') return json(req, env, { ok: true, db: !!env.DB });
    if (!env.DB) return json(req, env, { error: '서버 설정 전' }, 503);
    const me = await auth(req, env);
    if (!me) return json(req, env, { error: '링크가 맞지 않거나 기한이 지났어요' }, 401);
    const body = req.method === 'POST' ? await req.json().catch(() => null) : null;
    if (req.method === 'POST' && (!body || typeof body !== 'object')) return json(req, env, { error: 'JSON' }, 400);
    if (p.startsWith('/api/admin/')) {
      if (me.role !== 'admin') return json(req, env, { error: '관리자 링크만' }, 403);
      if (req.method !== 'POST') return json(req, env, { error: 'POST' }, 405);
      if (p === '/api/admin/import') return out(await importAll(env.DB, body));
      if (p === '/api/admin/token') return out(await makeToken(env.DB, body));
      if (p === '/api/admin/unlock') return out(await unlock(env.DB, me, body));
      return json(req, env, { error: '없음' }, 404);
    }
    if (req.method === 'GET' && p === '/api/me') return json(req, env, me);
    if (req.method === 'GET' && p === '/api/sessions') return json(req, env, await sessions(env.DB));
    if (req.method === 'GET' && p === '/api/stats') return json(req, env, await stats(env.DB));
    if (req.method === 'GET' && p === '/api/sheet') {
      const s = await getSession(env.DB, url.searchParams.get('s') || '');
      if (!s) return json(req, env, { error: '회차가 없어요' }, 400);
      return json(req, env, await sheet(env.DB, s));
    }
    if (req.method === 'POST' && p === '/api/mark') return out(await mark(env.DB, me, body));
    return json(req, env, { error: '없음' }, 404);
  },
};
