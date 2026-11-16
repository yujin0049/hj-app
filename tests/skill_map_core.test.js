// 역량맵 낱말 찾기·퀴즈 뽑기·저장 시험: node --test tests/skill_map_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../js/skill-map-core.js');

const root = path.join(__dirname, '..');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'data/skill_map/questions.json'), 'utf8'));
const kw = JSON.parse(fs.readFileSync(path.join(root, 'data/skill_map/keywords.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/skill_map/competencies.json'), 'utf8'));

const IDS = meta.competencies.map((c) => c.id);
const mem = () => {
  const d = {};
  return {
    getItem: (k) => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    _d: d
  };
};

test('16칸·4갈래, 칸마다 문제 5개 이상, src 없는 문제 0', () => {
  assert.equal(IDS.length, 16);
  assert.equal(meta.branches.length, 4);
  const flat = meta.branches.flatMap((b) => b.items);
  assert.deepEqual(flat.slice().sort(), IDS.slice().sort());
  const bad = M.validateBank(bank);
  assert.deepEqual(bad, []);
  const noSrc = bank.questions.filter((q) => !q.src || !String(q.src).trim());
  assert.equal(noSrc.length, 0);
  IDS.forEach((id) => {
    assert.ok(M.readyCount(bank, id) >= 5, id + ' ' + M.readyCount(bank, id));
    assert.equal(M.isReady(bank, id), true);
  });
});

test('src에 금고 경로·옵시디언 주소가 없다', () => {
  bank.questions.forEach((q) => {
    assert.equal(M.srcOk(q), true, q.id);
    assert.equal(/obsidian:\/\//i.test(q.src), false);
    assert.equal(/\/home\/box\//.test(q.src), false);
    assert.equal(/봇공유\//.test(q.src), false);
  });
});

test('낱말 사전으로 글을 찾아 해당 칸을 고른다. 빈 글은 없음', () => {
  assert.deepEqual(M.highlightIds('', kw), []);
  assert.deepEqual(M.highlightIds('   ', kw), []);
  const h = M.match('이번 건은 원인행위서를 쓰고 지출결의 증빙을 붙인 뒤 검수조서를 받는 일이다.', kw);
  const ids = h.map((x) => x.id);
  assert.ok(ids.includes('cause'), ids);
  assert.ok(ids.includes('purchase'), ids);
  const ato = M.highlightIds('국토교통부 전문교육기관 지정과 훈련운영기준 변경', kw);
  assert.ok(ato.includes('ato'), ato);
  const none = M.highlightIds('오늘은 날씨가 맑다', kw);
  assert.deepEqual(none, []);
});

test('일 끝내기 퀴즈는 강조된 칸에서 3문항, 준비 안 된 칸은 빼다', () => {
  const rnd = () => 0.2;
  const got = M.drawQuiz(bank, ['budget', 'haksa', 'ato'], 3, rnd);
  assert.equal(got.length, 3);
  const comps = new Set(got.map((q) => q.competency));
  got.forEach((q) => {
    assert.ok(['budget', 'haksa', 'ato'].includes(q.competency), q.competency);
    assert.ok(q.src);
  });
  assert.ok(comps.size >= 2);
  const empty = M.drawQuiz(bank, [], 3, rnd);
  assert.deepEqual(empty, []);
  const thinBank = { questions: bank.questions.filter((q) => q.competency !== 'excel') };
  assert.equal(M.isReady(thinBank, 'excel'), false);
  const skip = M.drawQuiz(thinBank, ['excel', 'civil'], 3, rnd);
  assert.ok(skip.every((q) => q.competency === 'civil'));
  assert.ok(skip.length <= 3);
  assert.ok(skip.length >= 1);
});

test('저장은 칸 id와 점수만, 약한 칸은 정답률 60% 미만', () => {
  const s = mem();
  let st = M.readScores(s, IDS);
  assert.deepEqual(st, { scores: {} });
  st = M.applyResults(st, [
    { competency: 'budget', correct: true },
    { competency: 'budget', correct: false },
    { competency: 'budget', correct: false },
    { competency: 'haksa', correct: true }
  ]);
  M.writeScores(s, st);
  const raw = JSON.parse(s.getItem(M.STORE_KEY));
  assert.deepEqual(Object.keys(raw), ['scores']);
  assert.deepEqual(raw.scores.budget, { ok: 1, n: 3 });
  assert.deepEqual(raw.scores.haksa, { ok: 1, n: 1 });
  assert.equal(JSON.stringify(raw).includes('원인행위'), false);
  assert.equal(M.isWeak(raw.scores, 'budget'), true);
  assert.equal(M.isWeak(raw.scores, 'haksa'), false);
  assert.equal(M.isWeak(raw.scores, 'ato'), false);
  // 모르는 칸·문항 본문은 버린다
  const dirty = M.cleanScores({ scores: { zz: { ok: 1, n: 1 }, budget: { ok: 2, n: 2, name: 'extra-field' } } }, IDS);
  assert.equal('zz' in dirty.scores, false);
  assert.deepEqual(dirty.scores.budget, { ok: 2, n: 2 });
});

test('빈 자료 안내 문구는 고정', () => {
  assert.equal(M.EMPTY, '데이터 없음');
  assert.equal(M.PENDING, '문제 준비 중(데이터 없음)');
});
