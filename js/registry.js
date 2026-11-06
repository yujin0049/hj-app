/* 기능 모듈 목록. 새 기능 = js/modules/이름.js 파일 하나 + 아래 배열에 한 줄. */
(function (root) {
  'use strict';
  root.MODULE_LIST = ['home', 'students', 'work', 'board', 'study', 'more'];
  root.MODULE_EXTRA = ['judge', 'docgen', 'library', 'practice', 'search', 'news', 'computers', 'dorm', 'schedule', 'banner'];
})(typeof globalThis !== 'undefined' ? globalThis : this);
