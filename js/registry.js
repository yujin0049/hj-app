/* 기능 모듈 목록. 새 기능 = js/modules/이름.js 파일 하나 + 아래 배열에 한 줄. */
(function (root) {
  'use strict';
  root.MODULE_LIST = ['home', 'students', 'board', 'study', 'more'];
  root.MODULE_EXTRA = ['practice', 'search', 'news', 'computers', 'dorm', 'schedule', 'banner'];
  root.MODULE_LOCK = { board: 1, study: 1, more: 1, practice: 1, news: 1, computers: 1, dorm: 1, schedule: 1, banner: 1 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
