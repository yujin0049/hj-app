// 메뉴 한 목록: node --test tests/menu_registry.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/registry.js');

test('탭·모듈 목록이 레지스트리에서 나온다', () => {
  assert.deepEqual(N.moduleList(), ['home', 'students', 'work', 'board', 'study', 'more']);
  assert.ok(N.moduleExtra().includes('office-guide'));
  assert.ok(N.moduleExtra().includes('status'));
  assert.ok(!N.moduleExtra().includes('skill-map'));
});

test('이름이 겹치지 않는다', () => {
  assert.deepEqual(N.uniqueNames(), []);
  assert.equal(N.byId('status').name, '지출·원인행위 건현황');
  assert.equal(N.byId('board').name, '업무현황표');
  assert.equal(N.byId('work').name, '실무');
  assert.equal(N.byId('todo').name, '할 일');
  assert.equal(N.byId('month').name, '매달 할 일');
});

test('실무 도구는 실무 탭이 켜지고, 예전처럼 홈 탭이 켜지지 않는다', () => {
  ['judge', 'docgen', 'library', 'coop', 'ot-attach', 'charts', 'status', 'chat'].forEach((id) => {
    assert.equal(N.tabOf(id), 'work', id);
  });
  assert.equal(N.tabOf('todo'), 'more');
  assert.equal(N.tabOf('docreg'), 'study');
  assert.equal(N.tabOf('home'), 'home');
});

test('탭·왼쪽 메뉴·홈 바로가기·더보기가 같은 MENU 에서 나온다', () => {
  const ids = new Set(N.MENU.map((m) => m.id));
  N.tabs().forEach((m) => assert.ok(ids.has(m.id)));
  N.sideGroups().forEach((g) => g.items.forEach((m) => assert.ok(ids.has(m.id))));
  N.moreGroups().forEach((g) => g.items.forEach((m) => assert.ok(ids.has(m.id))));
  N.homeShortcuts().forEach((m) => assert.ok(ids.has(m.id)));
  assert.ok(N.sideGroups().some((g) => g.group === '업무'));
  assert.ok(N.moreGroups().some((g) => g.group === '일상·현장' && g.items.length));
  assert.ok(N.homeShortcuts().length >= 1);
});

test('출석부는 공식 주소이고 모듈이 아니다', () => {
  const a = N.byId('attend');
  assert.equal(a.href, 'https://hj-attend.yujin06344.workers.dev/');
  assert.equal(a.ext, true);
  assert.ok(!N.moduleExtra().includes('attend'));
});
