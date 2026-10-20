/* 기능 모듈 목록. 새 기능 = js/modules/이름.js 파일 하나 + 아래 배열에 한 줄. */
(function (root) {
  'use strict';
  root.MODULE_LIST = ['home', 'students', 'board', 'study', 'more'];
  root.MODULE_EXTRA = ['practice', 'search', 'news', 'computers', 'dorm', 'schedule', 'banner'];
  root.MODULE_LOCK = { dorm: 1 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
