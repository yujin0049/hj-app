// 출석부 서버(worker/src/index.js) 시험: node --test tests/attend_worker.test.js
// 기본: 이 프로세스 안에서 진짜 SQLite(node:sqlite)로 D1 흉내 + worker/schema.sql(트리거 포함).
// 로컬 wrangler dev(빈 D1 — 고친 기록은 지울 수 없어서 매번 새 D1)로 진짜 HTTP 동시 요청:
//   HJ_ATTEND_DEV_URL=http://127.0.0.1:8787 HJ_ATTEND_ADMIN_TOKEN=<bootstrap_admin.mjs 로 만든 열쇠> node --test tests/attend_worker.test.js
// 이름은 가짜(학생1…학생13, 교수A·교수B)만. 날짜는 2099(안 잠김)·2000(잠김).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const URL0 = process.env.HJ_ATTEND_DEV_URL || '';
const ORIGIN = URL0 ? 'https://yujin0049.github.io' : 'http://pages.test';
const NAMES = Array.from({ length: 12 }, (_, i) => '학생' + (i + 1));
const S1 = '20990102-p1-3', S2 = '20990102-p4-6', S3 = '20990103-p1-3', S4 = '20990103-p4-6', S5 = '20990104-p1-3', OLD = '20000103-p1-3';

let call, rawDb = null, ADMIN, TA, TB;
function d1(file) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(file, 'utf8'));
  class Stmt {
    constructor(sql) { this.sql = sql; this.args = []; }
    bind(...a) { this.args = a; return this; }
    _run() { return { results: db.prepare(this.sql).all(...this.args).map((r) => ({ ...r })) }; }
    async all() { return this._run(); }
    async first() { return this._run().results[0] || null; }
    async run() { return this._run(); }
  }
  return {
    raw: db,
    prepare: (sql) => new Stmt(sql),
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((s) => s._run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const H = (t) => ({ Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' });
async function post(p, t, b) { const r = await call(p, { method: 'POST', headers: H(t), body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; }
async function get(p, t) { const r = await call(p, { headers: H(t) }); return { status: r.status, body: await r.json() }; }
let ID = {};
async function ids() { const s = (await get('/api/sheet?s=' + S1, ADMIN)).body; ID = {}; s.students.forEach((x) => { ID[x.name] = x.id; }); return s.students; }
async function mark(t, s, n, st, base) { const r = await post('/api/mark', t, { s, id: ID['학생' + n], st, base }); r.n = n; return r; }
async function sheet(s, t = ADMIN) { const r = await get('/api/sheet?s=' + s, t); assert.equal(r.status, 200); return r.body; }

test.before(async () => {
  if (URL0) {
    ADMIN = process.env.HJ_ATTEND_ADMIN_TOKEN;
    call = (p, init = {}) => fetch(URL0 + p, init);
  } else {
    const W = await import('../worker/src/index.js');
    const db = d1(path.join(__dirname, '..', 'worker', 'schema.sql'));
    rawDb = db.raw;
    ADMIN = W.newToken();
    db.raw.prepare("INSERT INTO tokens (hash, role, prof_id, label, expires_at, created_at) VALUES (?, 'admin', NULL, '관리자', '2999-01-01T00:00:00Z', 'x')").run(await W.sha256hex(ADMIN));
    const env = { DB: db, ALLOWED_ORIGIN: ORIGIN };
    call = (p, init = {}) => W.default.fetch(new Request('http://w' + p, init), env);
  }
  const sess = [
    { date: '2099-01-02', p_from: 1, p_to: 3, subject: '가짜과목1', prof: '교수A' },
    { date: '2099-01-02', p_from: 4, p_to: 6, subject: '가짜과목2', prof: '교수B' },
    { date: '2099-01-03', p_from: 1, p_to: 3, subject: '가짜과목1', prof: '교수A' },
    { date: '2099-01-03', p_from: 4, p_to: 6, subject: '가짜과목2', prof: '교수B' },
    { date: '2099-01-04', p_from: 1, p_to: 3, subject: '가짜과목1', prof: '교수A' },
    { date: '2000-01-03', p_from: 1, p_to: 3, subject: '가짜과목3', prof: '교수A' },
  ];
  const r = await post('/api/admin/import', ADMIN, { students: 'No,이름\n' + NAMES.map((n, i) => (i + 1) + ',' + n).join('\n'), profs: ['교수A', '교수B'], sessions: sess });
  assert.deepEqual(r.body, { ok: true, students: 12, profs: 2, sessions: 6 });
  TA = (await post('/api/admin/token', ADMIN, { role: 'prof', prof: '교수A', expires_at: '2999-01-01T00:00:00Z' })).body.token;
  TB = (await post('/api/admin/token', ADMIN, { role: 'prof', prof: '교수B', expires_at: '2999-01-01T00:00:00Z' })).body.token;
  await ids();
});

test('링크 열쇠: 256비트 무작위 · 교수 이름은 열쇠가 정함 · 틀림/기한 지남 401 · 교수는 관리자 기능 403 · 다른 사이트 403', async () => {
  assert.ok(TA.length >= 43 && /^[A-Za-z0-9_-]+$/.test(TA));
  assert.notEqual(TA, TB);
  assert.deepEqual((await get('/api/me', TA)).body.name, '교수A');
  assert.equal((await get('/api/me', 'x'.repeat(43))).status, 401);
  assert.equal((await call('/api/me')).status, 401);
  const old = (await post('/api/admin/token', ADMIN, { role: 'prof', prof: '교수A', expires_at: '2000-01-01T00:00:00Z' })).body.token;
  assert.equal((await get('/api/me', old)).status, 401);
  assert.equal((await post('/api/admin/import', TA, { profs: ['교수C'] })).status, 403);
  assert.equal((await call('/api/me', { headers: { ...H(TA), Origin: 'https://evil.example' } })).status, 403);
  const ok = await call('/api/me', { headers: { ...H(TA), Origin: ORIGIN } });
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  if (rawDb) {
    const rows = rawDb.prepare('SELECT hash FROM tokens').all();
    assert.ok(rows.every((r) => /^[0-9a-f]{64}$/.test(r.hash)));
    assert.ok(!rows.some((r) => r.hash === TA || r.hash === TB || r.hash === ADMIN)); // 원래 열쇠는 저장 안 함
  }
});

test('고친 사람은 열쇠 주인(화면이 보낸 이름 무시) · 잘못된 값 400', async () => {
  const r = await post('/api/mark', TA, { s: S5, id: ID['학생1'], st: 'o', by: '가짜이름', base: 0 });
  assert.equal(r.body.mark.who, '교수A');
  assert.equal((await post('/api/mark', TA, { s: '20991231-p1-3', id: ID['학생1'], st: 'o' })).status, 400);
  assert.equal((await post('/api/mark', TA, { s: S5, id: ID['학생1'], st: 'q' })).status, 400);
});

test('(a) 두 교수가 다른 학생을 동시에: 둘 다 저장', async () => {
  const [a, b] = await Promise.all([mark(TA, S1, 1, 'o', 0), mark(TB, S1, 2, 'x', 0)]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(a.body.overwrote, false); assert.equal(b.body.overwrote, false);
  const sh = await sheet(S1);
  assert.deepEqual([sh.marks[ID['학생1']].st, sh.marks[ID['학생1']].who], ['o', '교수A']);
  assert.deepEqual([sh.marks[ID['학생2']].st, sh.marks[ID['학생2']].who], ['x', '교수B']);
});

test('(b) 같은 학생을 동시에: 나중 것이 남고 기록에 둘 다 · 늦은 쪽에 「먼저 바꿈」 알림 · 진 쪽은 다음 동기화에 현재 값', async () => {
  const [a, b] = await Promise.all([mark(TA, S2, 3, 'o', 0), mark(TB, S2, 3, 'x', 0)]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  const later = a.body.mark.ver === 2 ? a : b, first = later === a ? b : a;
  assert.equal(first.body.mark.ver, 1);
  assert.equal(later.body.overwrote, true);
  assert.deepEqual(later.body.before, { st: first.body.mark.st, who: first.body.mark.who });
  assert.equal(first.body.overwrote, false);
  const sh = await sheet(S2, first === a ? TA : TB); // 진 쪽이 다시 읽으면
  assert.equal(sh.marks[ID['학생3']].st, later.body.mark.st);
  assert.equal(sh.marks[ID['학생3']].ver, 2);
  const h = sh.history.filter((x) => x.student_id === ID['학생3']).reverse();
  assert.deepEqual(h.map((x) => x.new), [first.body.mark.st, later.body.mark.st]);
  assert.deepEqual(h.map((x) => x.who).sort(), ['교수A', '교수B']);
  assert.equal(h[1].old, first.body.mark.st);
});

test('몰아치기: 2명 × 12명 동시(같은 학생들) → 24번 다 반영, 잃은 쓰기 0', async () => {
  const jobs = [];
  for (const [t, st] of [[TA, 'o'], [TB, 'l']]) for (let n = 1; n <= 12; n++) jobs.push(mark(t, S3, n, st, 0));
  const res = await Promise.all(jobs);
  assert.equal(res.filter((r) => r.status === 200).length, 24);
  const sh = await sheet(S3);
  const hist = sh.history.filter((x) => x.field === 'mark');
  assert.equal(hist.length, 24);
  for (let n = 1; n <= 12; n++) {
    const id = ID['학생' + n], mine = res.filter((r) => r.n === n);
    assert.equal(sh.marks[id].ver, 2);
    assert.equal(sh.marks[id].st, mine.find((r) => r.body.mark.ver === 2).body.mark.st);
    assert.equal(hist.filter((x) => x.student_id === id).length, 2);
  }
});

test('몰아치기: 2명이 반씩 나눠 12명 동시(다른 학생) → 12명 모두 저장', async () => {
  const res = await Promise.all(NAMES.map((_, i) => mark(i < 6 ? TA : TB, S4, i + 1, i % 2 ? 'x' : 'o', 0)));
  assert.equal(res.filter((r) => r.status === 200 && !r.body.overwrote).length, 12);
  const sh = await sheet(S4);
  for (let i = 0; i < 12; i++) assert.equal(sh.marks[ID['학생' + (i + 1)]].st, i % 2 ? 'x' : 'o');
  const ss = (await get('/api/sessions', TA)).body;
  assert.equal(ss.students, 12);
  assert.deepEqual(ss.sessions.find((s) => s.id === S4).count, { o: 6, l: 0, x: 6 });
});

test('감사1: 명단 순서를 바꿔 다시 넣어도 체크는 같은 학생에게(학생 id 기준)', async () => {
  await mark(TA, S5, 5, 'l', null);
  const before = { ...ID };
  const shuffled = NAMES.slice(1).reverse().concat(['학생13']); // 학생1 빠짐, 순서 뒤집힘, 새 학생13
  assert.equal((await post('/api/admin/import', ADMIN, { students: shuffled })).status, 200);
  const sh = await sheet(S5);
  const byName = {}; sh.students.forEach((x) => { byName[x.name] = x.id; });
  assert.equal(sh.students[0].name, '학생12');
  assert.equal(byName['학생5'], before['학생5']);
  assert.equal(sh.marks[byName['학생5']].st, 'l');
  assert.equal(byName['학생1'], undefined);
  for (const n of NAMES.slice(1)) assert.equal(byName[n], before[n]);
  assert.ok(!sh.students.some((x) => x.name === '학생13' && Object.values(before).includes(x.id)));
  assert.equal((await post('/api/admin/import', ADMIN, { students: NAMES })).status, 200); // 원래대로
  await ids();
  assert.equal(ID['학생1'], before['학생1']);
});

test('감사2: 고친 기록은 덧붙이기만(고치기·지우기 막힘)', async () => {
  if (!rawDb) return; // HTTP 모드에서는 DB 를 직접 못 만짐(트리거는 schema.sql 그대로)
  assert.throws(() => rawDb.prepare("UPDATE history SET new = 'o'").run(), /append-only/);
  assert.throws(() => rawDb.prepare('DELETE FROM history').run(), /append-only/);
  assert.ok(rawDb.prepare('SELECT COUNT(*) AS n FROM history').get().n > 0);
});

test('감사4: 수업 7일 뒤 잠김 → 교수 423, 관리자만 풀기(기록 남음), 다시 잠그기', async () => {
  assert.equal((await mark(TA, OLD, 1, 'o', 0)).status, 423);
  assert.equal((await post('/api/admin/unlock', TA, { s: OLD, unlocked: true })).status, 403);
  assert.equal((await post('/api/admin/unlock', ADMIN, { s: OLD, unlocked: true })).status, 200);
  assert.equal((await mark(TA, OLD, 1, 'o', 0)).status, 200);
  assert.equal((await post('/api/admin/unlock', ADMIN, { s: OLD, unlocked: false })).status, 200);
  assert.equal((await mark(TA, OLD, 1, 'x', 1)).status, 423);
  assert.equal((await mark(ADMIN, OLD, 1, 'l', 1)).status, 200);
  const h = (await sheet(OLD)).history.filter((x) => x.field === 'unlock');
  assert.deepEqual(h.map((x) => x.new).reverse(), ['1', '0']);
  assert.ok((await sheet(OLD)).session.locked);
  assert.ok(!(await sheet(S1)).session.locked);
});

test('감사5: 출석률은 지각=출석으로 계산', async () => {
  await mark(TA, S1, 4, 'l', null); // 지각 3시간
  await mark(TB, S2, 4, 'o', null); // 출석 3시간
  // S3 은 몰아치기에서 출석|지각(3시간), S4 는 결석(3시간), S5·OLD 는 없음
  const st = (await get('/api/stats', TA)).body;
  assert.equal(st.note, '지각=출석으로 계산');
  const s4 = st.students.find((x) => x.name === '학생4');
  assert.deepEqual({ checked: s4.checked, came: s4.came, away: s4.away, total: s4.total, need: s4.need, maxPossible: s4.maxPossible, ok: s4.ok, rate: s4.rate },
    { checked: 12, came: 9, away: 3, total: 18, need: 16, maxPossible: 15, ok: false, rate: 0.75 });
});
