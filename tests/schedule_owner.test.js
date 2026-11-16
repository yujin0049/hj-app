// 일정 담당 칸 가림: node --test tests/schedule_owner.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/schedule.js');

test('담당 칸은 직함만 남기거나 담당자로 바꾼다', () => {
  assert.equal(A.maskOwner(''), '');
  assert.equal(A.maskOwner('본인'), '본인');
  assert.equal(A.maskOwner('교수님'), '교수님');
  assert.equal(A.maskOwner('SheetOwner 교수님'), '교수님');
  assert.equal(A.maskOwner('from-sheet'), '담당자');
  assert.equal(A.cleanItem({ id: 's-a', owner: 'SheetOwner 교수님', title: '받기' }).owner, '교수님');
  assert.equal(A.cleanItem({ id: 's-b', owner: 'from-sheet' }).owner, '담당자');
  assert.equal(A.cleanItem({ id: 's-c', owner: '본인' }).owner, '본인');
});
