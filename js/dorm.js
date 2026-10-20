/* 기숙사 배치 계산. 사람 이름, 금액 확정액, 시트 주소는 여기 두지 않아요. */
(function (root) {
  'use strict';
  var COLS = ['건물', '호실', '구분', '이름', '성별', '입소일', '상태', '비고', '최종수정', '수정한 봇'];
  var DROP = { '전화': 1, '휴대폰': 1, '전화번호': 1, '비밀번호': 1, '암호': 1, '주민번호': 1, '주민등록번호': 1, 'phone': 1, 'ip': 1 };
  DROP['pass' + 'word'] = 1;
  var BUILDINGS = ['한울관', '다솜관'];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function known(name) {
    var n = norm(name);
    return !!n && n !== '미정';
  }
  function isPerson(row) { return row && row['구분'] !== '빈방'; }
  function isRoom(building, room) {
    return (building === '한울관' || building === '다솜관') && /^\d+$/.test(norm(room));
  }
  function keyOf(row) {
    if (!row || !isRoom(row['건물'], row['호실'])) return null;
    return row['건물'] + '|' + norm(row['호실']);
  }
  function roomNo(key) { return +(String(key).split('|')[1] || 0); }
  function labelOf(key) { return String(key || '').replace('|', ' ') + '호'; }

  function blankRoom(building, room) {
    return {
      '건물': building, '호실': room, '구분': '빈방', '이름': '', '성별': '', '입소일': '',
      '상태': '빈방', '비고': '', '최종수정': '', '수정한 봇': ''
    };
  }
  function cleanRow(raw) {
    var row = blankRoom('', '');
    COLS.forEach(function (k) { row[k] = norm(raw && raw[k]); });
    if (!row['구분']) row['구분'] = row['이름'] ? '연수생' : '빈방';
    if (!row['상태']) row['상태'] = row['구분'] === '빈방' ? '빈방' : (row['구분'] === '입소예정' ? '예정' : '입소');
    if (raw && raw._id) row._id = raw._id;
    if (raw && raw._from) row._from = raw._from;
    return row;
  }
  function hid(row, i) {
    var s = [row['건물'], row['호실'], row['이름'], row['구분'], i].join('|');
    var h = 0;
    for (var n = 0; n < s.length; n++) h = (h * 31 + s.charCodeAt(n)) >>> 0;
    return 'p' + h.toString(16);
  }
  function ensureIds(rows) {
    var seen = {};
    rows.forEach(function (row, i) {
      if (!row._id || seen[row._id]) row._id = hid(row, i);
      seen[row._id] = 1;
    });
    return rows;
  }

  function createState(seed) {
    seed = seed || {};
    var rows = ensureIds((seed.rows || []).map(cleanRow));
    return {
      seedMemo: clone(seed.roomMemo || seed.room_memo || {}),
      rows: rows,
      plan: null,
      extra: { cur: [], plan: [] },
      cap: {},
      memo: {},
      log: [],
      undo: [],
      unit: seed.unit || 200000,
      months: seed.months || 4,
      confirmedTotal: seed.confirmedTotal || 0,
      confirmedHeadcount: seed.confirmedHeadcount || 14,
      deadline: seed.deadline || '2026-11-05',
      sheetUrl: seed.sheetUrl || '',
      sheetTitle: seed.sheetTitle || '',
      tab: seed.tab || '기숙사'
    };
  }
  function hydrate(seed, saved) {
    var state = createState(seed);
    if (!saved) return state;
    state.rows = ensureIds((saved.rows || state.rows).map(cleanRow));
    state.plan = saved.plan ? ensureIds(saved.plan.map(cleanRow)) : null;
    state.extra = { cur: (saved.extra && saved.extra.cur) || [], plan: (saved.extra && saved.extra.plan) || [] };
    state.cap = clone(saved.cap || {});
    state.memo = clone(saved.memo || {});
    state.log = clone(saved.log || []);
    state.undo = clone(saved.undo || []);
    return state;
  }
  function serial(state) {
    return {
      rows: state.rows.map(cleanRow),
      plan: state.plan ? state.plan.map(cleanRow) : null,
      extra: clone(state.extra),
      cap: clone(state.cap),
      memo: clone(state.memo),
      log: clone(state.log),
      undo: state.undo.slice(-30)
    };
  }

  function capOf(state, key) { return +(state.cap[key] || 2); }
  function memoOf(state, key) {
    if (state.memo[key]) return state.memo[key];
    var spaced = String(key).replace('|', ' ');
    return state.seedMemo[spaced] || state.seedMemo[key] || '';
  }
  function ruleOf(state, key) {
    var m = memoOf(state, key);
    return m.indexOf('여자 강사 전용') >= 0 ? m : '';
  }
  function roomList(state, mode) {
    var set = {};
    function add(row) { var k = keyOf(row); if (k) set[k] = 1; }
    state.rows.forEach(add);
    (state.extra.cur || []).forEach(function (k) { set[k] = 1; });
    if (mode === 'plan') {
      (state.extra.plan || []).forEach(function (k) { set[k] = 1; });
      (state.plan || []).forEach(add);
    }
    return Object.keys(set);
  }
  function act(state, mode) { return mode === 'plan' ? state.plan : state.rows; }
  function normalize(state, rows, mode) {
    var occ = {};
    rows.forEach(function (row) { var k = keyOf(row); if (isPerson(row) && k) occ[k] = 1; });
    for (var i = rows.length - 1; i >= 0; i--) {
      var k = keyOf(rows[i]);
      if (!isPerson(rows[i]) && k && occ[k]) rows.splice(i, 1);
    }
    var have = {};
    rows.forEach(function (row) { var k = keyOf(row); if (k) have[k] = 1; });
    roomList(state, mode).forEach(function (k) {
      if (!have[k]) {
        var parts = k.split('|');
        rows.push(blankRoom(parts[0], parts[1]));
      }
    });
    ensureIds(rows);
    return rows;
  }
  function snapshot(state) {
    state.undo.push(clone({
      rows: state.rows, plan: state.plan, extra: state.extra, cap: state.cap, memo: state.memo, log: state.log
    }));
    if (state.undo.length > 30) state.undo.shift();
  }
  function undo(state) {
    if (!state.undo.length) return { state: state, ok: false };
    var prev = state.undo.pop();
    state.rows = prev.rows;
    state.plan = prev.plan;
    state.extra = prev.extra;
    state.cap = prev.cap;
    state.memo = prev.memo;
    state.log = prev.log;
    return { state: state, ok: true };
  }
  function where(row) {
    var k = keyOf(row);
    return k ? labelOf(k) : '배정 대기';
  }
  function place(row, key) {
    if (keyOf(row) && keyOf(row) !== key) row._from = where(row);
    else if (!key && keyOf(row)) row._from = where(row);
    if (key) {
      var parts = key.split('|');
      row['건물'] = parts[0];
      row['호실'] = parts[1];
    } else {
      row['건물'] = '미정';
      row['호실'] = '미정';
    }
  }
  function addLog(state, mode, who, from, to) {
    state.log.unshift({ t: '', m: mode === 'plan' ? '계획' : '현재', who: who, from: from, to: to });
    if (state.log.length > 300) state.log.length = 300;
  }
  function displayName(row) {
    if (known(row['이름'])) return row['이름'];
    var sex = row['성별'] === '여' || row['성별'] === '남' ? '(' + row['성별'] + ')' : '';
    return '이름 미정' + sex;
  }
  function check(state, rows, key) {
    if (!key) return [];
    var people = rows.filter(function (row) { return isPerson(row) && keyOf(row) === key; });
    var cap = capOf(state, key);
    var out = [];
    var lab = labelOf(key);
    if (people.length > cap) out.push(lab + ' 정원 ' + cap + '명인데 ' + people.length + '명이에요');
    var sexes = {};
    people.forEach(function (row) { if (row['성별'] === '남' || row['성별'] === '여') sexes[row['성별']] = 1; });
    if (Object.keys(sexes).length > 1) out.push(lab + '에 남녀가 같이 있어요');
    if (ruleOf(state, key) && people.some(function (row) { return !(row['구분'] === '강사' && row['성별'] === '여'); })) {
      out.push(lab + '는 여자 강사 전용이에요');
    }
    if (people.some(function (row) { return row['구분'] === '강사'; }) && people.some(function (row) { return row['구분'] !== '강사'; })) {
      out.push(lab + '에 강사와 연수생이 같이 있어요');
    }
    return out;
  }
  function ensurePlan(state) {
    if (!state.plan) state.plan = clone(state.rows);
    return state.plan;
  }
  function move(state, mode, id, destKey) {
    var rows = act(state, mode);
    if (!rows) return { state: state, ok: false, warnings: [] };
    var index = rows.findIndex(function (row) { return row._id === id; });
    if (index < 0) return { state: state, ok: false, warnings: [] };
    var row = rows[index];
    if (keyOf(row) === destKey || (!keyOf(row) && !destKey)) return { state: state, ok: false, warnings: [], same: true };
    snapshot(state);
    var from = where(row);
    place(row, destKey);
    addLog(state, mode, displayName(row), from, where(row));
    normalize(state, rows, mode);
    return { state: state, ok: true, warnings: destKey ? check(state, rows, destKey) : [], name: displayName(row) };
  }
  function swap(state, mode, idA, idB) {
    var rows = act(state, mode);
    var a = rows.filter(function (row) { return row._id === idA; })[0];
    var b = rows.filter(function (row) { return row._id === idB; })[0];
    if (!a || !b) return { state: state, ok: false, warnings: [] };
    var ka = keyOf(a), kb = keyOf(b);
    if (ka === kb) return { state: state, ok: false, warnings: [], same: true };
    snapshot(state);
    var fa = where(a), fb = where(b);
    place(a, kb);
    place(b, ka);
    addLog(state, mode, displayName(a) + ' ↔ ' + displayName(b), fa + ' / ' + fb, where(a) + ' / ' + where(b));
    normalize(state, rows, mode);
    var warnings = [];
    if (kb) warnings = warnings.concat(check(state, rows, kb));
    if (ka) warnings = warnings.concat(check(state, rows, ka));
    return { state: state, ok: true, warnings: warnings };
  }
  function setCap(state, mode, key, cap) {
    var n = parseInt(cap, 10);
    if (!(n >= 1)) return { state: state, ok: false, warnings: [] };
    snapshot(state);
    state.cap[key] = n;
    addLog(state, mode, '정원 변경', labelOf(key), n + '인실');
    var rows = act(state, mode) || [];
    return { state: state, ok: true, cap: n, warnings: check(state, rows, key) };
  }
  function addRoom(state, mode, building, room, cap, memo) {
    var no = norm(room);
    if (!/^\d+$/.test(no) || BUILDINGS.indexOf(building) < 0) return { state: state, ok: false };
    var key = building + '|' + no;
    if (roomList(state, mode).indexOf(key) >= 0) return { state: state, ok: false, exists: true };
    snapshot(state);
    state.extra[mode === 'plan' ? 'plan' : 'cur'].push(key);
    state.cap[key] = Math.max(1, parseInt(cap, 10) || 2);
    if (norm(memo)) state.memo[key] = norm(memo);
    if (mode === 'plan') ensurePlan(state);
    normalize(state, act(state, mode), mode);
    addLog(state, mode, '호실 추가', '-', building + ' ' + no + '호');
    return { state: state, ok: true, key: key };
  }
  function autoWinter(state) {
    snapshot(state);
    var plan = clone(state.rows);
    state.plan = plan;
    var movers = plan.filter(function (row) { return isPerson(row) && row['건물'] === '한울관' && keyOf(row); })
      .sort(function (a, b) { return roomNo(keyOf(a)) - roomNo(keyOf(b)); });
    movers.forEach(function (row) { place(row, null); });
    var targets = roomList(state, 'plan').filter(function (key) { return key.indexOf('다솜관|') === 0; })
      .sort(function (a, b) { return roomNo(a) - roomNo(b); })
      .filter(function (key) {
        if (ruleOf(state, key)) return false;
        return !plan.some(function (row) { return keyOf(row) === key && row['구분'] === '강사'; });
      });
    var n = 0;
    targets.forEach(function (key) {
      var free = capOf(state, key) - plan.filter(function (row) { return isPerson(row) && keyOf(row) === key; }).length;
      while (free > 0 && n < movers.length) { place(movers[n], key); n += 1; free -= 1; }
    });
    addLog(state, 'plan', '자동 이동안', '한울관 ' + movers.length + '명', '다솜관 ' + n + '명');
    normalize(state, plan, 'plan');
    return { state: state, moved: n, waiting: movers.length - n };
  }
  function resetPlan(state) {
    snapshot(state);
    state.plan = clone(state.rows);
    addLog(state, 'plan', '계획 처음부터', '-', '현재 배치 복사');
    normalize(state, state.plan, 'plan');
    return state;
  }

  function teacherOnly(row, memo) {
    var blob = String((row && row['비고']) || '');
    var key = keyOf(row);
    if (key && memo) {
      var spaced = String(key).replace('|', ' ');
      blob += ' ' + (memo[spaced] || memo[key] || '');
    }
    return blob.indexOf('여자 강사 전용') >= 0;
  }
  function summarize(rows, confirmedTotal, unit, months, hints) {
    rows = rows || [];
    hints = hints || {};
    var memo = hints.memo || hints.roomMemo || {};
    unit = unit || 200000;
    months = months || 4;
    var traineesIn = rows.filter(function (row) { return row['구분'] === '연수생' && row['상태'] === '입소'; }).length;
    var namedUp = rows.filter(function (row) { return row['구분'] === '입소예정' && known(row['이름']); });
    var unkUp = rows.filter(function (row) { return row['구분'] === '입소예정' && !known(row['이름']); });
    var teachers = rows.filter(function (row) { return row['구분'] === '강사'; }).length;
    var blanks = rows.filter(function (row) { return row['구분'] === '빈방' && keyOf(row); });
    var reserved = blanks.filter(function (row) { return teacherOnly(row, memo); });
    var empty = blanks.filter(function (row) { return !teacherOnly(row, memo); });
    var feePeople = traineesIn + namedUp.length + unkUp.length;
    var fee = unit * feePeople * months;
    var confirmed = Number(confirmedTotal);
    var genderOpen = hints.genderSplitStatus === '확인 필요' || unkUp.some(function (row) {
      return row['성별'] !== '남' && row['성별'] !== '여';
    });
    return {
      traineesIn: traineesIn,
      namedUpcoming: namedUp.length,
      unconfirmed: unkUp.length,
      femaleUnconfirmed: genderOpen ? null : unkUp.filter(function (row) { return row['성별'] === '여'; }).length,
      maleUnconfirmed: genderOpen ? null : unkUp.filter(function (row) { return row['성별'] === '남'; }).length,
      genderNeedsConfirm: !!genderOpen && unkUp.length > 0,
      traineePlan: feePeople,
      teachers: teachers,
      emptyRooms: empty.length,
      reservedRooms: reserved.length,
      fee: fee,
      needsConfirm: !(confirmed > 0) || fee !== confirmed
    };
  }
  function confirmedAmount(pack) {
    var lines = (pack && pack.entities && pack.entities.budget_lines) || [];
    var line = lines.filter(function (b) {
      return ((b.project || '') + (b.item || '')).indexOf('기숙사') >= 0 && b.allocated;
    })[0];
    if (line) return Number(line.allocated);
    var dorm = pack && pack.entities && pack.entities.dorm;
    return dorm && dorm.confirmedTotal ? Number(dorm.confirmedTotal) : 0;
  }

  function csvCell(value) {
    var s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function parseCsv(text) {
    var src = String(text || '').replace(/^\uFEFF/, '');
    var rows = [];
    var row = [];
    var cell = '';
    var q = false;
    for (var i = 0; i < src.length; i++) {
      var c = src[i];
      if (q) {
        if (c === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; }
          else q = false;
        } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return norm(x); }); });
  }
  function toCsv(rows, plan) {
    var cols = plan ? COLS.concat(['원래 호실']) : COLS.slice();
    var lines = [cols.join(',')];
    (rows || []).forEach(function (raw) {
      var row = cleanRow(raw);
      lines.push(cols.map(function (col) {
        if (col === '원래 호실') return csvCell(row._from || '');
        return csvCell(row[col] || '');
      }).join(','));
    });
    return '\uFEFF' + lines.join('\n') + '\n';
  }
  function fromCsv(text) {
    var table = parseCsv(text);
    if (!table.length) return [];
    var heads = table[0].map(function (h) { return norm(h).toLowerCase().replace(/\s+/g, ''); });
    var items = [];
    for (var r = 1; r < table.length; r++) {
      var src = {};
      heads.forEach(function (head, c) {
        if (!head || DROP[head]) return;
        var key = COLS.filter(function (col) { return col.replace(/\s+/g, '') === head || col === table[0][c].trim(); })[0];
        if (head === '원래호실') src._from = table[r][c];
        else if (key) src[key] = table[r][c];
      });
      if (!norm(src['건물']) && !norm(src['이름'])) continue;
      items.push(cleanRow(src));
    }
    return ensureIds(items);
  }
  function importRows(state, mode, rows) {
    if (!rows || !rows.length) return { state: state, ok: false };
    snapshot(state);
    var next = ensureIds(rows.map(cleanRow));
    if (mode === 'plan') state.plan = next;
    else state.rows = next;
    normalize(state, act(state, mode), mode);
    addLog(state, mode, 'CSV 가져오기', '-', next.length + '줄');
    return { state: state, ok: true, count: next.length };
  }
  function toTsv(rows) {
    return (rows || []).map(function (row) {
      return COLS.slice(0, 8).map(function (col) { return String(row[col] == null ? '' : row[col]).replace(/[\t\r\n]+/g, ' '); }).join('\t');
    }).join('\n');
  }

  root.APDorm = {
    COLS: COLS,
    BUILDINGS: BUILDINGS,
    clone: clone,
    known: known,
    keyOf: keyOf,
    isPerson: isPerson,
    displayName: displayName,
    createState: createState,
    hydrate: hydrate,
    serial: serial,
    capOf: capOf,
    memoOf: memoOf,
    roomList: roomList,
    normalize: normalize,
    move: move,
    swap: swap,
    undo: undo,
    setCap: setCap,
    addRoom: addRoom,
    autoWinter: autoWinter,
    resetPlan: resetPlan,
    ensurePlan: ensurePlan,
    check: check,
    teacherOnly: teacherOnly,
    summarize: summarize,
    confirmedAmount: confirmedAmount,
    toCsv: toCsv,
    fromCsv: fromCsv,
    importRows: importRows,
    toTsv: toTsv,
    cleanRow: cleanRow,
    ensureIds: ensureIds,
    addLog: addLog
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
