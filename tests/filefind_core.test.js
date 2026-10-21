// 파일 찾기 시험: node --test tests/filefind_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/filefind-core.js');

test('옵시디언 검색 주소: 볼트·낱말 인코딩, 빈 값이면 빈 주소', () => {
  assert.equal(F.obsidianSearchUrl('옵시디언', '특강 견적'),
    'obsidian://search?vault=' + encodeURIComponent('옵시디언') + '&query=' + encodeURIComponent('특강 견적'));
  assert.equal(F.obsidianSearchUrl('', '특강'), '');
  assert.equal(F.obsidianSearchUrl('옵시디언', '   '), '');
});
test('PC 명령: 낱말마다 따옴표, 따옴표·줄바꿈은 지움(명령 끼워 넣기 막기)', () => {
  assert.equal(F.findCmd('기숙사 신청서'), 'python find_file.py "기숙사" "신청서"');
  assert.equal(F.findCmd('a" & del x\n'), 'python find_file.py "a" "&" "del" "x"');
  assert.equal(F.findCmd(''), '');
});
test('다운로드 정리 명령 3개: 미리보기가 첫째, 첫째에는 --apply 없음', () => {
  assert.equal(F.SORT_CMDS.length, 3);
  assert.ok(!/--apply/.test(F.SORT_CMDS[0].cmd));
  assert.ok(F.SORT_CMDS.every((s) => !/del |rm |Remove-Item/.test(s.cmd)));
});
test('업무 낱말판: 이름·낱말 있음, 폴더 경로 없음', () => {
  assert.ok(F.TOPICS.length >= 10);
  for (const t of F.TOPICS) {
    assert.ok(t.name && t.q && t.words.length);
    assert.ok(!/[A-Z]:\\|file:\/\//.test(JSON.stringify(t)));
  }
});
