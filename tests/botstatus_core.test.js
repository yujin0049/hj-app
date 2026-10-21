// 봇 작업 현황 계산 시험: node --test tests/botstatus_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const B = require('../js/botstatus-core.js');

const T = (o) => Object.assign({ t: 'T001', title: '일', bot: '춘식이', state: '진행', raw: '진행 중', progress: null, verified: null, due: '', updated: '', yujin: [], risk: [] }, o);
const today = '2026-10-21';

test('마감: 지남·오늘·D-3·그 뒤·없음·끝', () => {
  assert.equal(B.due(T({ due: '2026-10-19' }), today).label, '2일 지남');
  assert.equal(B.due(T({ due: '2026-10-19' }), today).cls, 'late');
  assert.equal(B.due(T({ due: '2026-10-21' }), today).cls, 'today');
  assert.equal(B.due(T({ due: '2026-10-24' }), today).cls, 'soon');
  assert.equal(B.due(T({ due: '2026-10-25' }), today).cls, 'later');
  assert.equal(B.due(T({ due: '' }), today).cls, 'none');
  assert.equal(B.due(T({ due: '2026-10-01', state: '끝' }), today).cls, 'done');
});
test('KST 오늘', () => {
  assert.equal(B.todayKST(Date.UTC(2026, 9, 21, 14, 59)), '2026-10-21');
  assert.equal(B.todayKST(Date.UTC(2026, 9, 21, 15, 0)), '2026-10-22');
});
test('정렬: 지난 것 → 임박 → 그 뒤 → 마감 없음 → 끝', () => {
  const l = B.sortTasks([T({ t: 'T5', state: '끝', due: '2026-10-01' }), T({ t: 'T4' }), T({ t: 'T3', due: '2026-11-30' }),
    T({ t: 'T2', due: '2026-10-22' }), T({ t: 'T1', due: '2026-10-20' })], today);
  assert.deepEqual(l.map((x) => x.t), ['T1', 'T2', 'T3', 'T4', 'T5']);
});
test('맨 위 세 묶음', () => {
  const l = [T({ t: 'A', state: '대기(유진님 몫)', yujin: ['결재'], due: '2026-10-23' }), T({ t: 'B', due: '2026-10-22' }),
    T({ t: 'C', risk: ['감사·검사'] }), T({ t: 'D', state: '끝', yujin: ['결재'], risk: ['증빙'], due: '2026-10-21' })];
  const s = B.sections(l, today);
  assert.deepEqual(s.yujin.map((x) => x.t), ['A']);
  assert.deepEqual(s.soon.map((x) => x.t), ['B', 'A']);
  assert.deepEqual(s.risk.map((x) => x.t), ['C']);
});
test('거르기: 기본은 끝 빼기, 상태·봇·낱말', () => {
  const l = [T({ t: 'T1' }), T({ t: 'T2', state: '끝' }), T({ t: 'T3', bot: '규정봇', title: '감사 대비' }), T({ t: 'T4', bot: '' })];
  assert.deepEqual(B.filter(l, {}).map((x) => x.t), ['T1', 'T3', 'T4']);
  assert.deepEqual(B.filter(l, { state: '끝' }).map((x) => x.t), ['T2']);
  assert.deepEqual(B.filter(l, { bot: '규정봇' }).map((x) => x.t), ['T3']);
  assert.deepEqual(B.filter(l, { bot: '(미기재)' }).map((x) => x.t), ['T4']);
  assert.deepEqual(B.filter(l, { q: '감사' }).map((x) => x.t), ['T3']);
});
test('유진님 몫: 확정 먼저 정렬·카드 숫자·묶음 꼬리표는 추정 아님', () => {
  const l = [T({ t: 'G', state: '대기(유진님 몫)', yujin: ['결재'], yujin_src: '추정', yujin_guess: ['결재'], due: '2026-10-22' }),
    T({ t: 'S', state: '대기(유진님 몫)', yujin: ['제출'], yujin_src: '현황판', yujin_guess: [], due: '2026-11-30' }),
    T({ t: 'P', state: '대기(유진님 몫)', yujin: ['대기: PC', '결재'], yujin_src: '추정', yujin_guess: ['결재'], due: '2026-10-23' }),
    T({ t: 'B', state: '대기(유진님 몫)', yujin: ['대기: PC'], yujin_src: '묶음', yujin_guess: [] }),
    T({ t: 'D', state: '끝', yujin: ['제출'], yujin_src: '현황판' })];
  assert.deepEqual(B.sections(l, today).yujin.map((x) => x.t), ['S', 'G', 'P', 'B']);
  assert.deepEqual(B.yujinSplit(l), { sure: 1, guess: 2, bundle: 1 });
  assert.equal(B.isGuessTag(l[2], '대기: PC'), false);
  assert.equal(B.isGuessTag(l[2], '결재'), true);
  assert.equal(B.isGuessTag(T({ yujin_src: '추정' }), '결재'), true); // 예전 자료(yujin_guess 없음)
  assert.deepEqual(B.sortTasks(l.slice(0, 2), today, { confirmFirst: 1 }).map((x) => x.t), ['S', 'G']);
  assert.deepEqual(B.sortTasks(l.slice(0, 2), today).map((x) => x.t), ['G', 'S']);
});
test('진행률·검증 빈칸은 미기재', () => {
  assert.equal(B.progressText(null), '미기재');
  assert.equal(B.progressText(40), '40%');
  assert.equal(B.progressText(140), '100%');
  assert.equal(B.verifiedText(null), '미기재');
  assert.equal(B.verifiedText('클로드 10.21.'), '점검 클로드 10.21.');
});
test('오래된 자료 경고(3시간)', () => {
  const d = { built_iso: '2026-10-21T20:00+09:00', built_at: '2026-10-21 20:00' };
  assert.equal(B.stale(d, Date.parse('2026-10-21T22:00+09:00')).warn, false);
  assert.equal(B.stale(d, Date.parse('2026-10-21T23:30+09:00')).warn, true);
  assert.equal(B.stale({}, 0).warn, true);
});
test('실제 data/bot_status.json 모양: 4가지 상태만, 사람 칸 없음', () => {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'bot_status.json'), 'utf8'));
  assert.ok(d.tasks.length > 0);
  const keys = new Set(['t', 'title', 'bot', 'state', 'raw', 'progress', 'verified', 'due', 'updated', 'yujin', 'yujin_src', 'yujin_guess', 'risk']);
  for (const t of d.tasks) {
    assert.ok(B.STATES.includes(t.state), t.t + ' ' + t.state);
    assert.ok(['현황판', '추정', '묶음', ''].includes(t.yujin_src), t.t + ' yujin_src');
    for (const g of t.yujin_guess) assert.ok(t.yujin.includes(g));
    if (t.yujin_src !== '추정') assert.equal(t.yujin_guess.length, 0);
    if (!t.yujin.length) assert.equal(t.yujin_src, '');
    assert.match(t.t, /^T\d{2,4}$/);
    for (const k of Object.keys(t)) assert.ok(keys.has(k), '모르는 칸 ' + k);
  }
  const c = B.counts(d.tasks);
  assert.equal(c.all, d.counts.all);
});
