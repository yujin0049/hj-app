/* 통합학사행정 연습 모사 (#/haksa, #/haksa/bach810 …).
   메뉴·필터·컬럼은 2026-10-27 긁기에 있는 것만. 실서버 호출·저장 없음.
   필터 값은 이 탭 메모리에만 두고 localStorage에 쓰지 않는다. */
(function () {
  var ui = { open: {}, queried: {}, demo: {}, filters: {} };

  var WORKS = ['학적', '교과', '수업', '수강', '성적', '장학', '등록', '졸업', '학생', '증명', '강의평가', '비교과', '상담', '쿼리'];

  var HAKSA = [
    { id: 'jeok', label: '학적', children: [
      { id: 'jeok-base', label: '학적기본관리', children: [
        { id: 'roster', label: '재학생명부', stub: '본문 미확인. 메뉴 이름만 긁기에 있습니다.' },
        { id: 'stu-info', label: '학생정보조회', stub: '본문 미확인. 메뉴 이름만 긁기에 있습니다.' },
        { id: 'stu-search', label: '학생명단검색', stub: '본문 미확인. 메뉴 이름만 긁기에 있습니다.' }
      ] },
      { id: 'moe', label: '교육부보고자료관리', stub: '본문 미확인. 메뉴 이름만 긁기에 있습니다.' }
    ] },
    { id: 'curr-root', label: '교과', children: [
      { id: 'curriculum', label: '교육과정관리', stub: '본문 미확장. 긁기에서 화면을 열지 못했습니다.' }
    ] },
    { id: 'class-root', label: '수업', children: [
      { id: 'class-base', label: '기초사항', children: [
        { id: 'plan-print', label: '강의계획서출력', stub: '본문 미확장. 긁기에서 화면을 열지 못했습니다.' }
      ] },
      { id: 'open-root', label: '개설과목', children: [
        { id: 'bach810', label: '강좌별수강인원', code: 'BACH810' }
      ] },
      { id: 'field', label: '현장실습', stub: '본문 미확장. 긁기에서 화면을 열지 못했습니다.' }
    ] },
    { id: 'enroll-root', label: '수강', children: [
      { id: 'enroll-base', label: '수강관리', children: [
        { id: 'enroll-hist', label: '개인별 수강신청 내역조회', stub: '하위 화면 미확장. 필터와 컬럼을 확인하지 못했습니다.' },
        { id: 'enroll-tt', label: '개인시간표조회', stub: '하위 화면 미확장. 필터와 컬럼을 확인하지 못했습니다.' },
        { id: 'enroll-cert', label: '수강신청확인서', stub: '하위 화면 미확장. 필터와 컬럼을 확인하지 못했습니다.' }
      ] },
      { id: 'enroll-supp', label: '기초학습전공보충과목 수강신청', stub: '하위 화면 미확장. 필터와 컬럼을 확인하지 못했습니다.' }
    ] },
    { id: 'grade-root', label: '성적', children: [
      { id: 'grade-in', label: '성적입력', children: [
        { id: 'bach313', label: '열람성적조회', code: 'BACH313' }
      ] },
      { id: 'grade-view', label: '성적조회', stub: '하위 화면 미확장. 필터와 컬럼을 확인하지 못했습니다.' },
      { id: 'grade-stat', label: '통계자료', stub: '하위 화면 미확장. 필터와 컬럼을 확인하지 못했습니다.' }
    ] },
    { id: 'extra-root', label: '비교과관리', children: [
      { id: 'bach644', label: '학사력관리', code: 'BACH644' },
      { id: 'bach643', label: '비교과목 관리', code: 'BACH643' },
      { id: 'bach642', label: '비교과 과정 개설', code: 'BACH642' },
      { id: 'extra-plan', label: '비교과 학습계획서' },
      { id: 'bach640', label: '비교과 신청', code: 'BACH640' },
      { id: 'extra-score', label: '비교과 성적입력', stub: '긁기에서 본문을 확인하지 못했습니다. 필터와 컬럼은 넣지 않았습니다.' },
      { id: 'bach638', label: '비교과 성적조회', code: 'BACH638' },
      { id: 'bach795', label: '비교과 출석부', code: 'BACH795' }
    ] }
  ];

  var TOPS = [
    { id: 'haksa', label: '학사행정', tree: HAKSA },
    { id: 'ilban', label: '일반행정', tree: [
      { id: 'insa', label: '인사관리', stub: '하위 미확장.' }
    ] },
    { id: 'common', label: '공통관리', tree: [
      { id: 'sys', label: '시스템관리', stub: '하위 미확장.' }
    ] },
    { id: 'fav', label: '즐겨찾기', stub: '하위 미확장.' },
    { id: 'flow', label: '업무순서관리', code: 'CMRS039', stub: '하위 미확장. 긁기에서 본문은 제목·새로고침·즐겨찾기·도움말만 보였습니다.', chrome: ['새로고침', '즐겨찾기', '도움말'] }
  ];

  var SCREENS = {
    bach810: {
      title: '강좌별수강인원', code: 'BACH810', aka: '강좌개설검증',
      filters: [
        { key: 'year', label: '년도', type: 'text', def: '2026' },
        { key: 'term', label: '학기', type: 'select', def: '1학기', options: ['1학기', '2학기'] },
        { key: 'closed', label: '폐강강좌포함', type: 'check', def: false }
      ],
      tables: [{
        cols: ['No', '년도', '학기', '학과코드', '학과명', '과목코드', '과목명', '과목영문명', '학년', '반', '이수구분', '과목구분', '교번', '성명', '직급명', '실습구분', '학점', '이론시간', '실습시간', 'CNT'],
        demo: ['예시', '2026', '1학기', 'EX00', '예시학과', 'EXSUBJ', '예시과목', 'Example Course', '1', '가', '예시', '예시', 'E000', '예시교수', '예시직급', '예시', '2', '1', '1', '0']
      }]
    },
    bach313: {
      title: '열람성적조회', code: 'BACH313',
      notes: ['강의평가 완료해야 열람 가능.'],
      filters: [
        { key: 'year', label: '년도', type: 'text', def: '', placeholder: '예: 2026' },
        { key: 'term', label: '학기', type: 'select', def: '', placeholder: '선택', options: ['1학기', '2학기'] },
        { key: 'sid', label: '학번', type: 'text', def: '', placeholder: '예시만 · 저장 안 함' }
      ],
      tables: [{
        cols: ['NO', '이수구분', '교과목번호', '교과목명', '분반', '학점', '담당교수', '성적', '인정성적', '등급', '평점'],
        demo: ['예시', '예시', 'EX-000', '예시과목', '가', '2', '예시교수', '-', '-', '-', '-']
      }]
    },
    bach644: {
      title: '학사력관리', code: 'BACH644',
      filters: [
        { key: 'year', label: '년도', type: 'text', def: '', placeholder: '예: 2026' },
        { key: 'term', label: '학기', type: 'select', def: '', placeholder: '선택', options: ['1학기', '2학기'] },
        { key: 'work', label: '업무구분', type: 'select', def: '', placeholder: '선택', options: WORKS }
      ],
      tables: [{
        cols: ['No', '상태', '년도', '학기코드', '학사업무구분', '학사일정', '시작일자', '종료일자', '시작시각', '종료시각', '적용년도', '적용학기', '비고'],
        demo: ['예시', '예시', '2026', '2', '비교과', '예시일정', '2026-01-01', '2026-01-02', '09:00', '18:00', '2026', '2', '예시']
      }]
    },
    bach643: {
      title: '비교과목 관리', code: 'BACH643',
      hint: '사용여부 선택값은 긁기에 없어 사용·미사용만 두었습니다.',
      filters: [
        { key: 'code', label: '비교과코드', type: 'text', def: '' },
        { key: 'name', label: '명', type: 'text', def: '' },
        { key: 'use', label: '사용여부', type: 'select', def: '', placeholder: '선택', options: ['사용', '미사용'] }
      ],
      tables: [{
        cols: ['No', '상태', '비교과코드', '비교과목명', '인정시수(이론/실습)', '시수', '신설일자', '사용여부'],
        demo: ['예시', '예시', 'EX00', '예시비교과', '0/0', '0', '2026-01-01', '사용']
      }]
    },
    bach642: {
      title: '비교과 과정 개설', code: 'BACH642',
      notes: ['비교과 과정 개설 기간이 아닙니다. 조회만 가능합니다.'],
      filters: [
        { key: 'year', label: '년도', type: 'text', def: '2026' },
        { key: 'term', label: '학기', type: 'select', def: '2학기', options: ['1학기', '2학기'] },
        { key: 'dept', label: '대상학과', type: 'text', def: '', placeholder: '비어 있음' },
        { key: 'ban', label: '대상반구분', type: 'select', def: '본과', options: ['본과'] }
      ],
      tables: [
        {
          title: '비교과목정보',
          cols: ['No', '비교과코드', '비교과명', '총시수', '이론시수', '실습시수', '신설일자'],
          demo: ['예시', 'EX00', '예시비교과', '0', '0', '0', '2026-01-01']
        },
        {
          title: '과정목록',
          cols: ['No', '상태', '이수학년', '분반', '비교과코드', '비교과명', '담당교번', '담당교수명', '총시수', '이론시수', '실습시수'],
          demo: ['예시', '예시', '1', '가', 'EX00', '예시비교과', 'E000', '예시교수', '0', '0', '0']
        }
      ]
    },
    'extra-plan': {
      title: '비교과 학습계획서',
      notes: ['교수학습계획서 입력기간이 아닙니다. 조회만 가능합니다.', '기간 2026.07.23~2026.10.19'],
      filters: [
        { key: 'who', label: '교번/성명', type: 'text', def: '', placeholder: '예시만 · 저장 안 함' },
        { key: 'course', label: '개설과목', type: 'text', def: '', placeholder: '예시과목' }
      ],
      tables: [{
        cols: ['년도', '학기', '교번/성명', '개설과목'],
        demo: ['2026', '2학기', 'E000 / 예시교수', '예시과목']
      }]
    },
    bach640: {
      title: '비교과 신청', code: 'BACH640',
      filters: [
        { key: 'year', label: '년도', type: 'text', def: '', placeholder: '예: 2026' },
        { key: 'term', label: '학기', type: 'select', def: '', placeholder: '선택', options: ['1학기', '2학기'] },
        { key: 'sid', label: '학번', type: 'text', def: '', placeholder: '예시만 · 저장 안 함' }
      ],
      tables: [
        {
          title: '신청내역',
          cols: ['No', '년도', '학기', '분반', '비교과코드', '비교과명', '인정시수', '이론/실습시수', '신청일자', '취소'],
          demo: ['예시', '2026', '2', '가', 'EX00', '예시비교과', '0', '0/0', '2026-01-01', '동작 없음']
        },
        {
          title: '교육과정정보',
          cols: ['No', '이수학년', '분반', '개설학과코드', '학과명', '비교과코드', '비교과명', '인정시수', '이론', '실습', '신청'],
          demo: ['예시', '1', '가', 'EX00', '예시학과', 'EX00', '예시비교과', '0', '0', '0', '동작 없음']
        }
      ]
    },
    bach638: {
      title: '비교과 성적조회', code: 'BACH638',
      filters: [
        { key: 'sid', label: '학번', type: 'text', def: '', placeholder: '예시만 · 저장 안 함' },
        { key: 'name', label: '성명', type: 'text', def: '', placeholder: '예시학생' }
      ],
      tables: [{
        cols: ['No', '년도', '학기', '학과', '학과명', '학년', '반', '학번', '성명', '비교과코드', '비교과명', '교번', '교수명', '시수', '이론', '실습', '점수', '등급', '평점'],
        demo: ['예시', '2026', '2', 'EX', '예시학과', '1', '가', '예시-0000', '예시학생', 'EX00', '예시비교과', 'E000', '예시교수', '0', '0', '0', '-', '-', '-']
      }]
    },
    bach795: {
      title: '비교과 출석부', code: 'BACH795',
      attendance: true,
      notes: ['컬럼은 긁기에서 확인하지 못했습니다. 조회와 팝업보기(인쇄)만 있습니다.'],
      filters: [
        { key: 'year', label: '년도', type: 'text', def: '', placeholder: '예: 2026' },
        { key: 'term', label: '학기', type: 'select', def: '', placeholder: '선택', options: ['1학기', '2학기'] },
        { key: 'pid', label: '교번', type: 'text', def: '', placeholder: '예시만 · 저장 안 함' },
        { key: 'course', label: '개설과목', type: 'text', def: '', placeholder: '예시과목' }
      ]
    }
  };

  function topById(id) {
    for (var i = 0; i < TOPS.length; i++) if (TOPS[i].id === id) return TOPS[i];
    return TOPS[0];
  }
  function walk(nodes, id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return nodes[i];
      if (nodes[i].children) {
        var hit = walk(nodes[i].children, id);
        if (hit) return hit;
      }
    }
    return null;
  }
  function locate(id) {
    for (var i = 0; i < TOPS.length; i++) {
      if (!TOPS[i].tree) continue;
      var node = walk(TOPS[i].tree, id);
      if (node) return { top: TOPS[i], node: node };
    }
    return null;
  }
  function pathTo(nodes, id, acc) {
    for (var i = 0; i < nodes.length; i++) {
      var next = acc.concat([nodes[i]]);
      if (nodes[i].id === id) return next;
      if (nodes[i].children) {
        var hit = pathTo(nodes[i].children, id, next);
        if (hit) return hit;
      }
    }
    return null;
  }
  function readRoute(parts) {
    if (!parts[1]) return { top: topById('haksa'), leaf: '', missing: false };
    if (parts[1] === 'top') {
      var known = parts[2] && topById(parts[2]).id === parts[2];
      return { top: known ? topById(parts[2]) : topById('haksa'), leaf: '', missing: parts[2] && !known };
    }
    var found = locate(parts[1]);
    if (!found) return { top: topById('haksa'), leaf: parts[1], missing: true };
    return { top: found.top, leaf: parts[1], node: found.node, missing: false };
  }
  function branchOpen(top, id, leaf) {
    if (Object.prototype.hasOwnProperty.call(ui.open, id)) return !!ui.open[id];
    if (!leaf || !top.tree) return false;
    var path = pathTo(top.tree, leaf, []);
    if (!path) return false;
    return path.some(function (n) { return n.id === id && n.children; });
  }
  function vals(id, screen) {
    if (!ui.filters[id]) {
      var bag = {};
      (screen.filters || []).forEach(function (f) { bag[f.key] = f.def; });
      ui.filters[id] = bag;
    }
    return ui.filters[id];
  }
  function chev() {
    return '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 11 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function treeHtml(api, nodes, top, leaf) {
    var h = '';
    nodes.forEach(function (n) {
      if (n.children && n.children.length) {
        var open = branchOpen(top, n.id, leaf);
        h += '<div class="hk-node"><button type="button" class="hk-branch" data-branch="' + api.esc(n.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + chev() + api.esc(n.label) + '</button>';
        h += '<div class="hk-kids"' + (open ? '' : ' hidden') + '>' + treeHtml(api, n.children, top, leaf) + '</div></div>';
      } else {
        var on = n.id === leaf;
        h += '<button type="button" class="hk-leaf' + (on ? ' on' : '') + '" data-leaf="' + api.esc(n.id) + '"' + (on ? ' aria-current="page"' : '') + '>' + api.esc(n.label) + (n.code ? '<small>' + api.esc(n.code) + '</small>' : '') + '</button>';
      }
    });
    return h;
  }
  function fieldHtml(api, f, val) {
    if (f.type === 'check') {
      return '<label class="hk-check"><input data-fkey="' + api.esc(f.key) + '" type="checkbox"' + (val ? ' checked' : '') + '><span>' + api.esc(f.label) + '</span></label>';
    }
    var h = '<label class="hk-field"><span>' + api.esc(f.label) + '</span>';
    if (f.type === 'select') {
      h += '<select data-fkey="' + api.esc(f.key) + '">';
      if (f.placeholder) h += '<option value="">' + api.esc(f.placeholder) + '</option>';
      (f.options || []).forEach(function (o) {
        h += '<option value="' + api.esc(o) + '"' + (val === o ? ' selected' : '') + '>' + api.esc(o) + '</option>';
      });
      h += '</select>';
    } else {
      h += '<input data-fkey="' + api.esc(f.key) + '" type="text" autocomplete="off" value="' + api.esc(val || '') + '"' + (f.placeholder ? ' placeholder="' + api.esc(f.placeholder) + '"' : '') + '>';
    }
    return h + '</label>';
  }
  function countText(id) {
    if (ui.demo[id]) return '예시 1건 · 실데이터 0건';
    if (ui.queried[id]) return '0건';
    return '조회 전';
  }
  function tableHtml(api, table, id) {
    var h = '<section class="hk-block">';
    if (table.title) h += '<h2>' + api.esc(table.title) + '</h2>';
    h += '<div class="hk-scroll"><table class="hk-table"><thead><tr>';
    table.cols.forEach(function (c) { h += '<th scope="col">' + api.esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    if (ui.demo[id]) {
      if (!table.demo || table.demo.length !== table.cols.length) {
        h += '<tr><td class="hk-empty" colspan="' + table.cols.length + '">예시 칸 수가 컬럼과 맞지 않습니다.</td></tr>';
      } else {
        h += '<tr class="hk-demo">';
        table.demo.forEach(function (cell) { h += '<td>' + api.esc(cell) + '</td>'; });
        h += '</tr>';
      }
    } else {
      var msg = ui.queried[id] ? '0건. 이 조건의 행이 없어요.' : '조회 전. 실데이터는 없어요.';
      h += '<tr><td class="hk-empty" colspan="' + table.cols.length + '">' + api.esc(msg) + '</td></tr>';
    }
    return h + '</tbody></table></div></section>';
  }
  function crumb(api, route) {
    var bits = [route.top.label];
    if (route.leaf && route.top.tree) {
      var path = pathTo(route.top.tree, route.leaf, []) || [];
      path.forEach(function (n) { bits.push(n.label); });
    }
    return '<nav class="hk-crumb" aria-label="경로">' + bits.map(function (b, i) {
      return (i ? '<span aria-hidden="true">/</span>' : '') + '<span>' + api.esc(b) + '</span>';
    }).join('') + '</nav>';
  }
  function screenMain(api, route) {
    var node = route.node;
    var screen = SCREENS[route.leaf];
    if (!screen) {
      var head = crumb(api, route) + '<h1>' + api.esc(node.label) + '</h1>' + (node.code ? '<p class="hk-code">' + api.esc(node.code) + '</p>' : '');
      if (node.children) return head + '<p class="hk-lead">왼쪽에서 하위 메뉴를 고르세요.</p>';
      return head + '<p class="hk-stub">' + api.esc(node.stub || '하위 미확장.') + '</p>';
    }
    var bag = vals(route.leaf, screen);
    var meta = [screen.code, screen.aka].filter(Boolean).join(' · ');
    var h = crumb(api, route) + '<h1>' + api.esc(screen.title) + '</h1>' + (meta ? '<p class="hk-code">' + api.esc(meta) + '</p>' : '');
    (screen.notes || []).forEach(function (n) { h += '<p class="hk-note">' + api.esc(n) + '</p>'; });
    h += '<form id="hk-form" autocomplete="off">';
    h += '<div class="hk-filters">';
    (screen.filters || []).forEach(function (f) { h += fieldHtml(api, f, bag[f.key]); });
    h += '</div>';
    if (screen.hint) h += '<p class="hk-hint">' + api.esc(screen.hint) + '</p>';
    h += '<div class="hk-actions"><button class="btn small" type="submit">조회</button>';
    if (!screen.attendance) h += '<button class="btn-ghost small" id="hk-demo" type="button" aria-pressed="' + (ui.demo[route.leaf] ? 'true' : 'false') + '">' + (ui.demo[route.leaf] ? '예시 숨기기' : '예시 한 줄') + '</button>';
    if (screen.attendance) h += '<button class="btn-ghost small" type="button" disabled>팝업보기(인쇄)</button>';
    h += '</div></form>';
    if (screen.attendance && ui.queried[route.leaf]) h += '<p class="hk-count">0건</p><p class="hk-stub">조회해도 출석 표는 비어 있습니다. 인쇄하지 않습니다.</p>';
    else if (screen.attendance) h += '<p class="hk-count">조회 전</p><p class="hk-hint">인쇄 버튼은 꺼 두었습니다. 서버로 나가지 않습니다.</p>';
    else {
      h += '<p class="hk-count">' + api.esc(countText(route.leaf)) + '</p>';
      if (ui.demo[route.leaf]) h += '<p class="hk-hint">노란 줄은 예시입니다. 실명·학번이 아닙니다.</p>';
      (screen.tables || []).forEach(function (table) { h += tableHtml(api, table, route.leaf); });
    }
    return h;
  }
  function landing(api, top) {
    if (!top.tree || !top.tree.length) {
      var h = '<h1>' + api.esc(top.label) + '</h1>';
      if (top.code) h += '<p class="hk-code">' + api.esc(top.code) + '</p>';
      h += '<p class="hk-stub">' + api.esc(top.stub || '하위 미확장.') + '</p>';
      if (top.chrome && top.chrome.length) {
        h += '<div class="hk-actions">';
        top.chrome.forEach(function (label) {
          h += '<button type="button" class="btn-ghost small" disabled>' + api.esc(label) + '</button>';
        });
        h += '</div><p class="hk-hint">이 버튼은 누르지 못합니다. 서버로 나가지 않습니다.</p>';
      }
      return h;
    }
    var html = '<h1>' + api.esc(top.label) + '</h1><p class="hk-lead">왼쪽 메뉴를 누르면 그 화면의 필터와 빈 표가 나옵니다. 저장되지 않습니다.</p>';
    if (top.id === 'haksa') {
      html += '<div class="hk-picks">';
      top.tree.forEach(function (n) {
        html += '<button type="button" class="hk-pick" data-branch="' + api.esc(n.id) + '">' + api.esc(n.label) + '</button>';
      });
      html += '</div>';
    }
    return html;
  }
  function shell(api, route, main) {
    var h = '<div class="hk">';
    h += '<p class="hk-banner" role="status">연습용 모사 UI · 실서버 연동 없음 · 개인정보·저장 없음</p>';
    h += '<div class="hk-who"><strong>직속기구 / 글로컬대학 사업센터 (연습·읽기전용)</strong><span>통합학사행정시스템</span></div>';
    h += '<nav class="hk-nav" aria-label="상위 메뉴">';
    TOPS.forEach(function (t) {
      var on = t.id === route.top.id;
      h += '<button type="button" data-top="' + api.esc(t.id) + '"' + (on ? ' aria-current="page"' : '') + '>' + api.esc(t.label) + '</button>';
    });
    h += '</nav><div class="hk-body">';
    h += '<nav class="hk-side" aria-label="메뉴 트리"><p class="hk-side-label">' + api.esc(route.top.label) + '</p>';
    if (route.top.tree && route.top.tree.length) h += treeHtml(api, route.top.tree, route.top, route.leaf);
    else h += '<p class="hk-stub">하위 메뉴 없음</p>';
    h += '</nav><div class="hk-main">' + main + '</div></div></div>';
    return h;
  }

  function render(el, api) {
    el.classList.add('wide');
    var route = readRoute(api.route().parts);
    var main;
    if (route.missing) {
      main = '<h1>없는 화면</h1><p class="hk-stub">이 주소의 메뉴는 긁기에 없습니다.</p><p><button class="btn small" type="button" data-top="haksa">학사행정으로</button></p>';
    } else if (route.leaf && route.node) main = screenMain(api, route);
    else main = landing(api, route.top);
    el.innerHTML = shell(api, route, main);
    bind(el, api, route);
  }

  function bind(el, api, route) {
    function paint() { render(el, api); }
    el.querySelectorAll('[data-fkey]').forEach(function (node) {
      node.addEventListener(node.type === 'checkbox' || node.tagName === 'SELECT' ? 'change' : 'input', function () {
        if (!route.leaf || !ui.filters[route.leaf]) return;
        ui.filters[route.leaf][node.getAttribute('data-fkey')] = node.type === 'checkbox' ? node.checked : node.value;
      });
    });
    var form = el.querySelector('#hk-form');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      ui.queried[route.leaf] = true;
      api.toast('연습 조회 · 서버 호출 없음');
      paint();
    });
    el.onclick = function (e) {
      var branch = e.target.closest && e.target.closest('[data-branch]');
      if (branch && el.contains(branch)) {
        var id = branch.getAttribute('data-branch');
        var sideBtn = el.querySelector('.hk-side [data-branch="' + id + '"]');
        var now = sideBtn ? sideBtn.getAttribute('aria-expanded') === 'true' : !!ui.open[id];
        ui.open[id] = !now;
        if (sideBtn) {
          sideBtn.setAttribute('aria-expanded', ui.open[id] ? 'true' : 'false');
          var kids = sideBtn.parentNode.querySelector(':scope > .hk-kids');
          if (kids) kids.hidden = !ui.open[id];
          if (branch !== sideBtn && sideBtn.scrollIntoView) sideBtn.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      var leaf = e.target.closest && e.target.closest('[data-leaf]');
      if (leaf && el.contains(leaf)) { api.go('#/haksa/' + leaf.getAttribute('data-leaf')); return; }
      var top = e.target.closest && e.target.closest('[data-top]');
      if (top && el.contains(top)) {
        var tid = top.getAttribute('data-top');
        api.go(tid === 'haksa' ? '#/haksa' : '#/haksa/top/' + tid);
        return;
      }
      var demo = e.target.closest && e.target.closest('#hk-demo');
      if (demo && el.contains(demo)) {
        ui.demo[route.leaf] = !ui.demo[route.leaf];
        paint();
      }
    };
  }

  Object.keys(SCREENS).forEach(function (id) {
    (SCREENS[id].tables || []).forEach(function (t) {
      if (t.demo && t.demo.length !== t.cols.length) throw new Error('haksa demo ' + id);
    });
  });

  window.ShellModules.haksa = { id: 'haksa', tab: '', icon: '', render: render };
})();
