// AI 전환 1단계 계산 시험: node --test tests/aiflow_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/aiflow-core.js');

const T = (o) => Object.assign({ t: 'T001', title: '일', bot: '문서봇', state: '진행', raw: '진행 중', due: '', updated: '2026-11-10 09:00', yujin: [], verified: null }, o);
const today = '2026-11-11';

test('유보 잠금 5개는 고정, 꼬리표·제목으로 잠금(결재=상신, 발송·제출=외부발송)', () => {
  assert.deepEqual(A.LOCKS, ['로그인', '결제', '영구삭제', '외부발송', '상신']);
  assert.deepEqual(A.locks(T({ yujin: ['결재', '결제'] })), ['결제', '상신']);
  assert.deepEqual(A.locks(T({ yujin: ['발송', '제출'] })), ['외부발송']);
  assert.deepEqual(A.locks(T({ title: '자료 영구 삭제 요청' })), ['영구삭제']);
  assert.deepEqual(A.locks(T({ yujin: ['KORUS 입력'] })), []);
});

test('자율도: 값 있으면 그 값, 없으면 기본 1단(초안만, 임시)', () => {
  assert.equal(A.DEFAULT_LEVEL, '초안만');
  assert.equal(A.level(T({})), '초안만');
  assert.equal(A.explicitLevel(T({})), null);
  assert.equal(A.level(T({ autonomy: 1 })), '초안만');
  assert.equal(A.level(T({ autonomy: '이상치만알림' })), '이상치만알림');
  assert.equal(A.level(T({ autonomy: 7 })), '초안만');
  assert.deepEqual(A.summary([T({}), T({ autonomy: 2 })]).levels, { 초안만: 1, 요약보고: 1, 이상치만알림: 0 });
  assert.equal(A.summary([T({}), T({ autonomy: 2 })]).levelsDefault, 1);
  assert.deepEqual(A.locks(T({ yujin: ['결재'], autonomy: 3 })), ['상신']); // 자율도와 상관없이 잠금 그대로
});

test('잠긴 건은 자율도가 있어도 경계 밖(추천만)', () => {
  assert.equal(A.boundary(T({ yujin: ['결재'], autonomy: 3 })), '밖');
  assert.equal(A.boundary(T({ state: '대기(유진님 몫)' })), '밖');
  assert.equal(A.boundary(T({ yujin: ['확인·판단'] })), '밖');
  assert.equal(A.boundary(T({})), '안');
  assert.equal(A.boundary(T({ bot: '' })), null);
});

test('보고 전 검사: 근거=점검 칸, 나머지는 자료 없으면 null, 2회 미달이면 판단요청', () => {
  assert.equal(A.precheck(T({ verified: '봇 대조 10.21.' })).근거, true);
  assert.equal(A.precheck(T({ verified: '미검증' })).근거, false);
  assert.equal(A.precheck(T({})).근거, null);
  assert.equal(A.precheck(T({})).유보, null);
  assert.equal(A.precheck(T({ check: { fails: 1 } })).judge, false);
  assert.equal(A.precheck(T({ check: { fails: 2 } })).judge, true);
  assert.equal(A.summary([T({})]).judge, null);
  assert.equal(A.summary([T({ check: { fails: 2 } }), T({ check: { fails: 0 } })]).judge.length, 1);
});

test('이상치: 자료 없으면 null, 있으면 이상만', () => {
  const a = A.anomalies({}, today);
  assert.deepEqual(a, { 출석: null, 마감: null, 기숙사: null, 예산: null });
  const b = A.anomalies({ tasks: [T({ due: '2026-11-01' }), T({ due: '2026-12-01' }), T({ state: '끝', raw: '완료', due: '2026-11-01' })],
    checks: [{ id: 'ojnt-x', 항목: '대조', 결과: '일치', 값: '1' }],
    ojnt: { items: [{ label: '서류', done: 12, total: 12 }], deadlines: [{ date: '2026-11-05' }] } }, today);
  assert.equal(b.마감.length, 1);
  assert.equal(b.마감[0].late, true);
  assert.deepEqual(b.기숙사, []);
  assert.equal(b.출석, null);
  const c = A.anomalies({ checks: [{ id: 'ojnt-y', 항목: '대조', 결과: '불일치', 값: '2' }],
    ojnt: { items: [{ label: '서류', done: 3, total: 12 }], deadlines: [{ date: '2026-11-20' }] } }, today);
  assert.equal(c.기숙사.length, 1, '마감 전 미완료는 이상 아님, 불일치만');
});

test('문서 근거: 최신 먼저, 없으면 null(화면 「없음」)', () => {
  const d = A.docs({ bot_status: { handover: { doc: 'a', saved_at: '2026-11-07 19:29' } }, regular_docs: { refreshed_at: '2026-10-21 12:03' } });
  assert.deepEqual(d.map((x) => x.date), ['2026-11-07', '2026-10-21', null]);
  assert.equal(d[2].doc, null);
});

test('반려 이유: 한 줄만, 없으면 null', () => {
  assert.equal(A.rejects({ tasks: [T({})] }), null);
  assert.deepEqual(A.rejects({ tasks: [T({ rejects: ['양식 틀림\n자세히'] })] }), [{ t: 'T001', why: '양식 틀림' }]);
});

test('실제 자료(data/*.json)로: 예시 없이 숫자가 맞물림', () => {
  const d = require('../data/bot_status.json');
  const s = A.summary(d.tasks);
  assert.equal(s.boundary['밖'] + s.boundary['안'] + s.boundary['모름'], s.open);
  assert.equal(s.levels['초안만'], s.open); // 현황판에 자율도 칸 없음 → 모두 기본값(초안만)
  assert.equal(s.levelsDefault, s.open);
  const an = A.anomalies({ tasks: d.tasks, checks: require('../data/checks.json'), ojnt: require('../data/ojnt_progress.json') }, today);
  assert.equal(an.출석, null); // 출석 대조 자료는 이 앱 json 에 없음
  assert.ok(Array.isArray(an.마감) && Array.isArray(an.기숙사));
});

test('연말 집행·불용 위험: 파일 없음·빈 파일 → null(「데이터 없음」, 빨강 아님)', () => {
  assert.equal(A.budgetRisk(null), null);
  assert.equal(A.budgetRisk(undefined), null);
  assert.equal(A.budgetRisk([]), null);
  assert.equal(A.budgetRisk({}), null);
  assert.equal(A.anomalies({}, today).예산, null);
});

test('연말 집행·불용 위험: 기준(field·threshold)이 없으면 자료가 있어도 절대 빨강 안 됨', () => {
  assert.equal(A.BUDGET_RISK.field, null);
  assert.equal(A.BUDGET_RISK.threshold, null);
  assert.equal(A.budgetReady(), false);
  const rows = [{ a: 1 }];
  assert.equal(A.budgetRisk(rows), null);
  assert.equal(A.anomalies({ budget: rows }, today).예산, null);
  assert.equal(A.budgetRisk(rows, { field: 'a', threshold: null }), null);
  // 기준을 시험용으로 넣었을 때만 넘은 줄을 냄(실제 기준값 아님)
  assert.equal(A.budgetRisk(rows, { field: 'a', threshold: 0 }).length, 1);
  assert.deepEqual(A.budgetRisk(rows, { field: 'a', threshold: 1 }), []);
});

test('예산 위험 자료 파일은 저장소에 만들지 않음(원본 표 생기기 전)', () => {
  assert.equal(require('node:fs').existsSync(require('node:path').join(__dirname, '..', 'data', 'budget_risk.json')), false);
});
