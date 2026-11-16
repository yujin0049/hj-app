/* 메뉴·모듈 목록 한 곳. 아래 탭·왼쪽 메뉴·홈 바로가기·더보기가 이 배열만 본다.
   이름(name)은 화면마다 하나만. 새 화면 = js/modules/이름.js + 아래 MENU에 한 줄(module:false 면 기존 화면의 하위 주소). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HJMenu = api.MENU;
  root.HJNav = api;
  root.MODULE_LIST = api.moduleList();
  root.MODULE_EXTRA = api.moduleExtra();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var ATTEND = 'https://hj-attend.yujin06344.workers.dev/';
  var SIDE_ORDER = ['', '업무', '출석', '문서', '일정', '봇보고/현황판', '그 밖'];
  var MORE_ORDER = ['일상·현장', '계획·현황', '공부·규정', '시설', '자료·설정'];

  /* tab: 아래 탭. tabOf: 그 화면을 열 때 켤 탭. sideGroup/moreGroup: 왼쪽·더보기 구역. homeShortcut: 홈 바로가기 후보(홈 본문에는 안 그림). */
  var MENU = [
    { id: 'home', href: '#/home', name: '홈', tab: true, sideGroup: '' },
    { id: 'students', href: '#/students', name: '학생 안내', tab: true, sideGroup: '그 밖' },
    { id: 'work', href: '#/work', name: '실무', tab: true, sideGroup: '업무' },
    { id: 'board', href: '#/board', name: '업무현황표', tab: true, sideGroup: '업무' },
    { id: 'study', href: '#/study', name: '공부', tab: true, sideGroup: '그 밖' },
    { id: 'more', href: '#/more', name: '더보기', tab: true, sideGroup: '그 밖' },

    { id: 'judge', href: '#/judge', name: '판정', tabOf: 'work', sideGroup: '업무', moreGroup: '일상·현장', moreSub: '휴보강 · 계약 · 사전승인' },
    { id: 'docgen', href: '#/docgen', name: '문서 만들기', tabOf: 'work', sideGroup: '업무', moreGroup: '일상·현장', moreSub: '기안·계획서 초안' },
    { id: 'library', href: '#/library', name: '자료함', tabOf: 'work', sideGroup: '업무', moreGroup: '일상·현장', moreSub: '규정 · 양식 · 순서' },
    { id: 'practice', href: '#/practice', name: '연습장', tabOf: 'study', moreGroup: '공부·규정', moreSub: '과제, 익힐 업무, 문제' },
    { id: 'search', href: '#/search', name: '검색', tabOf: 'more' },
    { id: 'news', href: '#/news', name: '교육원 소식', tabOf: 'more', moreGroup: '일상·현장', moreSub: '행사, 일정, 공지' },
    { id: 'computers', href: '#/computers', name: '컴퓨터 현황', tabOf: 'more', moreGroup: '일상·현장', moreSub: '대수, 윈도우 버전' },
    { id: 'dorm', href: '#/dorm', name: '기숙사 현황판', tabOf: 'more', moreGroup: '일상·현장', moreSub: '도면, 기숙사비', homeShortcut: true },
    { id: 'schedule', href: '#/schedule', name: '남은 일정', tabOf: 'more', sideGroup: '일정', moreGroup: '일상·현장', moreSub: '날짜, 담당, 완료', homeShortcut: true },
    { id: 'banner', href: '#/banner', name: '현수막 만들기', tabOf: 'more', moreGroup: '일상·현장', moreSub: '시안, 4m·5m', homeShortcut: true },
    { id: 'lockers', href: '#/lockers', name: '사물함', tabOf: 'more', moreGroup: '일상·현장', moreSub: '색깔 판, 열쇠 수' },
    { id: 'calendar', href: '#/calendar', name: '계획 달력', tabOf: 'more', sideGroup: '일정', moreGroup: '계획·현황', moreSub: '월·주 보기, D-day' },
    { id: 'status', href: '#/status', name: '지출·원인행위 건현황', tabOf: 'work', sideGroup: '업무', moreGroup: '계획·현황', moreSub: '상태·마감·담당 봇', homeShortcut: true },
    { id: 'filefind', href: '#/filefind', name: '파일 찾기', tabOf: 'more', moreGroup: '일상·현장', moreSub: '낱말로 파일 찾기' },
    { id: '3d', href: '#/3d', name: '교육원 전경 3D', tabOf: 'more', moreGroup: '시설', moreSub: '앱 안에서 보기' },
    { id: 'bots', href: '#/bots', name: '봇 작업 현황', tabOf: 'more', sideGroup: '봇보고/현황판', moreGroup: '계획·현황', moreSub: '지금 도는 일 · 마감 임박' },
    { id: 'docreg', href: '#/docreg', name: '문서등록대장 학습', tabOf: 'study', sideGroup: '문서', moreGroup: '공부·규정', moreSub: '분류별 문제' },
    { id: 'who', href: '#/who', name: '학과·사람별 업무', tabOf: 'study', moreGroup: '공부·규정', moreSub: '누구한테 물을지 · 문제' },
    { id: 'regular-docs', href: '#/regular-docs', name: '정례 문서 달력', tabOf: 'study', sideGroup: '문서', moreGroup: '계획·현황', moreSub: '달마다 오는 문서' },
    { id: 'haksa', href: '#/haksa', name: '학사 연습', tabOf: 'more', moreGroup: '공부·규정', moreSub: '통합학사행정 메뉴 · 저장 없음' },
    { id: 'coop', href: '#/coop', name: '협조리스트', tabOf: 'work', sideGroup: '업무', moreGroup: '공부·규정', moreSub: '오늘 Top5 · 휴보강 경로', homeShortcut: true },
    { id: 'todo', href: '#/todo', name: '할 일', tabOf: 'more', sideGroup: '일정', moreGroup: '공부·규정', moreSub: '한 장 리스트' },
    { id: 'ot-attach', href: '#/ot-attach', name: '원인행위 붙임', tabOf: 'work', sideGroup: '업무', moreGroup: '일상·현장', moreSub: '종류별 붙임 순서', homeShortcut: true },
    { id: 'charts', href: '#/charts', name: '그래프', tabOf: 'work', sideGroup: '봇보고/현황판', moreGroup: '계획·현황', moreSub: '잔액·추세·강사료', homeShortcut: true },
    { id: 'docs', href: '#/docs', name: '중요문서', tabOf: 'more', sideGroup: '문서', moreGroup: '계획·현황', moreSub: '외부기관 문서 · 웹으로만', homeShortcut: true },
    { id: 'chat', href: '#/chat', name: '대화방', tabOf: 'work', sideGroup: '봇보고/현황판', moreGroup: '계획·현황', moreSub: '대장↔클로드 방' },
    { id: 'pubdata', href: '#/pubdata', name: '공공데이터', tabOf: 'more', moreGroup: '계획·현황', moreSub: '정비사 응시·취득 대조' },
    { id: 'docsearch', href: '#/docsearch', name: '문서대장 찾기', tabOf: 'more', sideGroup: '문서', moreGroup: '공부·규정', moreSub: '키워드 · 질문 · 부족 부서' },
    { id: 'notice', href: '#/notice', name: '남해캠 공지사항', tabOf: 'more', sideGroup: '문서', moreGroup: '일상·현장', moreSub: '최신 공지 · 검색' },
    { id: 'office-guide', href: '#/office-guide', name: '신입 업무 가이드', tabOf: 'more', sideGroup: '그 밖', moreGroup: '계획·현황', moreSub: '직급·전화·메신저·메일' },
    { id: 'skill-map', href: '#/skill-map', name: '역량맵', tabOf: 'study', sideGroup: '그 밖', moreGroup: '공부·규정', moreSub: '일 글 붙여 찾기 · 약한 칸 · 일 끝내기 퀴즈' },

    { id: 'attend', href: ATTEND, name: '출석부', ext: true, sideGroup: '출석' },

    { id: 'study-must', href: '#/study/must', name: '주무관 필독', tabOf: 'study', moreGroup: '공부·규정', moreSub: '교육원·항공기술 규정 요지', module: false, homeShortcut: true },
    { id: 'changelog', href: '#/study/changelog', name: '변경이력 카드', tabOf: 'study', moreGroup: '공부·규정', moreSub: '표지 캐러셀 · 버전 요지', module: false },
    { id: 'manual', href: '#/more/manual', name: '업무 매뉴얼', tabOf: 'more', moreGroup: '자료·설정', moreSub: '인수인계서로 내보내기', module: false },
    { id: 'budget', href: '#/more/budget', name: '예산 집행률', tabOf: 'more', moreGroup: '자료·설정', moreSub: '빈칸은 확인 필요', module: false },
    { id: 'plan', href: '#/more/plan', name: '사업 기획', tabOf: 'more', moreGroup: '자료·설정', moreSub: '내년 준비 점검', module: false },
    { id: 'roadmap', href: '#/more/roadmap', name: '로봇 로드맵', tabOf: 'more', moreGroup: '자료·설정', moreSub: '내 로봇·3D 공부 단계', module: false },
    { id: 'records', href: '#/more/records', name: '내 기록', tabOf: 'more', moreGroup: '자료·설정', moreSub: '점수와 자주 틀린 규칙', module: false },
    { id: 'rules', href: '#/more/rules', name: '규칙 목록', tabOf: 'more', moreGroup: '자료·설정', moreSub: '문장과 근거를 고칠 수 있어요', module: false },
    { id: 'month', href: '#/more/month', name: '매달 할 일', tabOf: 'more', moreGroup: '자료·설정', moreSub: '알림 문구 수정', module: false },
    { id: 'settings', href: '#/more/settings', name: '설정', tabOf: 'more', moreGroup: '자료·설정', moreSub: '백업, 초기화', module: false },
    { id: 'docreg-cal', href: '#/docreg/cal', name: '문서등록대장 달력', tabOf: 'study', moreGroup: '자료·설정', moreSub: '월별 추세', module: false },
  ];

  function tabs() { return MENU.filter(function (m) { return m.tab; }); }
  function moduleList() { return tabs().map(function (m) { return m.id; }); }
  function moduleExtra() {
    return MENU.filter(function (m) { return !m.tab && m.module !== false && !m.ext; }).map(function (m) { return m.id; });
  }
  function byId(id) {
    for (var i = 0; i < MENU.length; i++) if (MENU[i].id === id) return MENU[i];
    return null;
  }
  function tabOf(id) {
    var m = byId(id);
    if (!m) return 'more';
    if (m.tab) return m.id;
    return m.tabOf || 'more';
  }
  function groupBy(order, key) {
    var map = {};
    MENU.forEach(function (m) {
      if (m[key] == null || m[key] === undefined) return;
      if (key === 'sideGroup' && m.sideGroup === undefined) return;
      var g = m[key];
      if (key === 'moreGroup' && !g) return;
      if (key === 'sideGroup' && g == null) return;
      if (key === 'sideGroup' && !m.sideGroup && m.sideGroup !== '') return;
      if (!map[g]) map[g] = [];
      map[g].push(m);
    });
    return order.filter(function (g) { return map[g] && map[g].length; }).map(function (g) {
      return { group: g, items: map[g] };
    });
  }
  function sideGroups() { return groupBy(SIDE_ORDER, 'sideGroup'); }
  function moreGroups() { return groupBy(MORE_ORDER, 'moreGroup'); }
  function homeShortcuts() { return MENU.filter(function (m) { return m.homeShortcut; }); }
  function names() { return MENU.map(function (m) { return m.name; }); }
  function workTools() {
    return MENU.filter(function (m) { return m.tabOf === 'work' && !m.tab && !m.ext; });
  }
  function uniqueNames() {
    var seen = {}, dups = [];
    names().forEach(function (n) {
      if (seen[n]) dups.push(n);
      seen[n] = 1;
    });
    return dups;
  }

  return {
    ATTEND: ATTEND,
    MENU: MENU,
    SIDE_ORDER: SIDE_ORDER,
    MORE_ORDER: MORE_ORDER,
    tabs: tabs,
    moduleList: moduleList,
    moduleExtra: moduleExtra,
    byId: byId,
    tabOf: tabOf,
    sideGroups: sideGroups,
    moreGroups: moreGroups,
    homeShortcuts: homeShortcuts,
    names: names,
    workTools: workTools,
    uniqueNames: uniqueNames
  };
});
