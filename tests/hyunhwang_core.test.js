// 현황판 건별 수치화 계산 시험: node --test tests/hyunhwang_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../js/hyunhwang-core.js');

const T = (o) => Object.assign({ t: 'T001', title: '일', type: '기타', status: '진행 중', cancelled: false, steps: [], done: 1, total: 3, pct: 33, o: null, o_diff: null, next: '', owner: '봇', due: '' }, o);
const today = '2026-10-22';

test('요약: 전체·평균(취소 뺌)·유진님 몫·마감 7일 이내', () => {
  const ts = [
    T({ t: 'T1', pct: 50, owner: '유진님', due: '2026-10-29' }),
    T({ t: 'T2', pct: 0, due: '2026-10-30' }),
    T({ t: 'T3', pct: 100, status: '완료', owner: '-', due: '2026-10-23' }),
    T({ t: 'T4', pct: null, cancelled: true, owner: '-', due: '2026-10-23' }),
    T({ t: 'T5', pct: 25, owner: '유진님', due: '2026-10-20' })
  ];
  const s = H.summary(ts, today);
  assert.equal(s.all, 5);
  assert.equal(s.cancelled, 1);
  assert.equal(s.avg_pct, Math.round((50 + 0 + 100 + 25) / 4));
  assert.equal(s.open, 3);
  assert.equal(s.yujin, 2);
  assert.equal(s.due7, 1); // T1(D-7)만. T2는 D-8, T5는 지남
  assert.equal(s.overdue, 1);
});
test('정렬: 마감 가까운 순, 마감 없음은 뒤, 끝·취소 빠짐', () => {
  const ts = [T({ t: 'T9' }), T({ t: 'T2', due: '2026-10-30' }), T({ t: 'T3', due: '2026-10-21' }), T({ t: 'T4', status: '완료', owner: '-' })];
  assert.deepEqual(H.openSorted(ts, today).map((t) => t.t), ['T3', 'T2', 'T9']);
});
test('마감 글·단계 글·O칸 차이', () => {
  assert.equal(H.dueLabel(T({ due: '2026-10-21' }), today).cls, 'late');
  assert.equal(H.dueLabel(T({ due: '2026-10-22' }), today).label, '오늘 마감');
  assert.equal(H.dueLabel(T({ due: '2026-10-25' }), today).label, 'D-3');
  assert.equal(H.dueLabel(T({}), today).cls, 'none');
  assert.equal(H.stepText(T({ done: 2, total: 6 })), '2/6단계');
  assert.equal(H.oDiffText(T({ o: 30, o_diff: 3 })), '현황판 30%와 +3');
  assert.equal(H.oDiffText(T({})), '');
});
test('자료 파일: 요약이 스크립트 값과 같고, 진행률 = 끝난 단계 ÷ 전체', () => {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'hyunhwang_score.json'), 'utf8'));
  const s = H.summary(d.tasks, d.summary.today, d.summary.window);
  for (const k of ['all', 'avg_pct', 'yujin', 'due7', 'open', 'cancelled']) assert.equal(s[k], d.summary[k], k);
  for (const t of d.tasks) {
    if (t.cancelled) { assert.equal(t.pct, null); continue; }
    assert.equal(t.pct, Math.round(100 * t.done / t.total), t.t);
    assert.equal(t.steps.filter((x) => x.done).length, t.done, t.t);
    assert.ok(!/^[A-Z]:[\\/]|file:/.test(t.folder || ''), t.t + ' 전체 경로 없음');
  }
});
test('화면: 현황판 화면이 수치화 자료를 읽음', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'bots.js'), 'utf8');
  assert.ok(src.includes('data/hyunhwang_score.json'));
  assert.ok(src.includes('id="hs-score"'));
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').includes('js/hyunhwang-core.js'));
});
