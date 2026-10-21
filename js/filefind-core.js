/* 파일 찾기 핵심 계산(화면 없음): 옵시디언 검색 주소, PC 명령 줄. node 시험: tests/filefind_core.test.js
   공개 저장소라 실제 파일 목록·폴더 경로·사람 이름은 넣지 않아요. 낱말만. */
(function (root) {
  'use strict';
  /* 업무 낱말판: 99 봇/스크립트/download_sort_rules.json 의 규칙 이름·낱말과 같은 묶음(폴더 경로는 빼고 낱말만) */
  var TOPICS = [
    { name: '특강·산업기사', q: '특강', words: ['특강', '산업기사', '자격증'] },
    { name: '강사료·출석부', q: '강사료', words: ['초과강사료', '출석부', '강의확인서', '지급의뢰'] },
    { name: '기숙사·OJNT', q: '기숙사', words: ['기숙사', 'OJNT', '입사신청'] },
    { name: '어학연수', q: '어학연수', words: ['어학연수', '싱가포르', '해외취업'] },
    { name: '재료·견적', q: '견적', words: ['재료', '견적', '실험실습'] },
    { name: '기자재·납품', q: '기자재', words: ['기자재', '구매사양', '납품'] },
    { name: '교육원 지출', q: '지출', words: ['지출', '품의', '거래명세'] },
    { name: '현장견학', q: '견학', words: ['현장견학', '에어쇼'] },
    { name: '국토부·훈련운영기준', q: '훈련운영기준', words: ['국토교통부', '조치결과', '정기검사'] },
    { name: '규정·지침', q: '규정', words: ['규정', '지침', '세칙'] },
    { name: '주간업무보고', q: '주간업무보고', words: ['주간업무보고', '주간일정'] },
    { name: '시험·종합평가', q: '중간고사', words: ['중간고사', '종합평가', '이수증'] },
    { name: '사물함', q: '사물함', words: ['사물함'] },
    { name: '도면', q: '도면', words: ['도면', '평면도'] },
    { name: '글로컬 공통', q: '글로컬', words: ['글로컬', '교부통지'] }
  ];
  function clean(q) { return String(q == null ? '' : q).replace(/["'`\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function obsidianSearchUrl(vault, q) {
    q = clean(q);
    if (!vault || !q) return '';
    return 'obsidian://search?vault=' + encodeURIComponent(vault) + '&query=' + encodeURIComponent(q);
  }
  /* find_file.py 는 낱말마다 따로 받아요(모두 들어간 경로). 따옴표로 하나씩 감쌈 */
  function findCmd(q) {
    var w = clean(q).split(' ').filter(Boolean);
    if (!w.length) return '';
    return 'python find_file.py ' + w.map(function (x) { return '"' + x + '"'; }).join(' ');
  }
  var SORT_CMDS = [
    { step: '① 미리보기(아무것도 안 옮김)', cmd: 'python download_sort.py' },
    { step: '② 고른 것만 옮기기(제안목록.tsv 「옮길곳」 칸을 고친 뒤)', cmd: 'python download_sort.py --apply --plan 제안목록.tsv' },
    { step: '③ 잘못 옮겼으면 되돌리기', cmd: 'python download_sort.py --undo move_log.tsv' }
  ];
  root.HJFileFind = { TOPICS: TOPICS, SORT_CMDS: SORT_CMDS, clean: clean, obsidianSearchUrl: obsidianSearchUrl, findCmd: findCmd };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HJFileFind;
})(typeof window !== 'undefined' ? window : globalThis);
