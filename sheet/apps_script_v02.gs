/**
 * 업무 현황판_v01 ↔ 행정 업무 연습장 · 기숙사 현황판 연결 (apps_script_v02, 2026-10-21)
 * v01(기숙사 현황판)과 같은 주소·같은 열쇠를 그대로 써요. v01 기능은 하나도 안 바뀌어요.
 * 새로 생긴 것
 *   - 남은 일정: POST {action:'schedule_read', key}  → {ok, rows:[{아이디,날짜,...}], hash}
 *                POST {action:'schedule', key, editor, base, rows:[[아이디,날짜,끝날짜,할일,담당,메모,완료,확인필요,확인메모,고친때], ...]}
 *                → 「남은일정」 탭 전체를 받은 줄로 바꿈(base가 지금 시트 hash와 다르면 conflict). 탭이 없으면 만듦
 *   - 기숙사 연습장 저장: action 'sync' (cur.replace + plan.replace, base 검사) — v01 'undo'와 같은 방식
 * 붙일 곳: 그 시트 → 확장 프로그램 → Apps Script. 배포 → 배포 관리 → ✏️ → 버전: 새 버전 → 배포 (URL 그대로)
 * 열쇠: 프로젝트 설정 → 스크립트 속성 EDIT_KEY (코드에는 절대 넣지 않음)
 *
 * ── 아래는 v01 설명 그대로 ──
   OJNT 기숙사 현황판 ↔ 구글 시트 「업무 현황판_v01」 연결 (apps_script_v01, 2026-10-20)
 * 붙일 곳: 그 시트 → 확장 프로그램 → Apps Script. 배포 → 새 배포 → 웹 앱 (실행: 나, 액세스: 모든 사용자).
 *
 * 읽기: GET ?action=read  또는  POST {"action":"read"}
 * 쓰기: POST (Content-Type: text/plain, 본문은 JSON)
 *   { action: 'update'|'move'|'swap'|'add'|'delete'|'capacity'|'room'|'plan'|'undo',
 *     editor: '고친 사람 이름', summary: '사람이 읽는 한 줄', key: (EDIT_KEY 쓸 때만),
 *     cur:   { ops: [ {op:'set', r:행번호, old:{A~H}, new:{A~H}}, {op:'delete', r, old}, {op:'append', new} ] }
 *            또는 { replace: [행...], base: '읽을 때 받은 hash' }   (되돌리기)
 *     plan:  { replace: [행...], base: hash }   → 「기숙사_겨울계획」 탭
 *     rooms: { replace: [행...], base: hash }   → 「기숙사_호실설정」 탭 (정원·메모·추가한 방)
 *   }
 * 옛 값이 지금 시트와 다르면 아무것도 안 쓰고 conflict:true + 새 자료를 돌려줘요(다른 사람이 먼저 고침 → 다시 읽기).
 * 전화번호·주민번호처럼 보이는 값은 거절해요.
 * (선택) 스크립트 속성 EDIT_KEY 를 넣으면, 같은 key 를 보낸 요청만 받아요.
 */
var TAB = '기숙사', PLAN_TAB = '기숙사_겨울계획', ROOM_TAB = '기숙사_호실설정', LOG_TAB = '기숙사_변경내역';
var COLS = ['건물', '호실', '구분', '이름', '성별', '입소일', '상태', '비고', '최종수정', '수정한 봇'];
var DATA = 8; // A~H 가 내용, I~J 는 도장
var PLAN_COLS = COLS.concat(['원래 호실']);
var ROOM_COLS = ['건물', '호실', '정원', '메모', '적용', '최종수정', '수정한 봇'];
var LOG_COLS = ['시각', '고친 사람', '종류', '탭', '내용', '자세히'];
var ACTIONS = ['update', 'move', 'swap', 'add', 'delete', 'capacity', 'room', 'plan', 'undo', 'sync'];
var SCHED_TAB = '남은일정';
var SCHED_COLS = ['아이디', '날짜', '끝날짜', '할일', '담당', '메모', '완료', '확인필요', '확인메모', '고친때'];
var MAX_ROWS = 500, MAX_CELL = 500;

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!keyOk_(p.key)) return out_({ ok: false, msg: '열쇠(key)가 맞지 않아요' });
  return out_(readAll_());
}

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return out_({ ok: false, msg: 'JSON을 읽을 수 없어요' }); }
  if (!keyOk_(body.key)) return out_({ ok: false, msg: '열쇠(key)가 맞지 않아요' });
  if (body.action === 'read' || !body.action) return out_(readAll_());
  if (body.action === 'schedule_read') return out_(readSchedule_());
  if (body.action === 'schedule') {
    var lk = LockService.getScriptLock();
    if (!lk.tryLock(15000)) return out_({ ok: false, busy: true, msg: '다른 사람이 저장 중이에요. 잠시 뒤 다시 해 주세요' });
    try { return out_(writeSchedule_(body)); }
    catch (err2) { return out_({ ok: false, msg: '저장 실패: ' + (err2 && err2.message || err2) }); }
    finally { lk.releaseLock(); }
  }
  if (ACTIONS.indexOf(body.action) < 0) return out_({ ok: false, msg: '모르는 action: ' + body.action });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return out_({ ok: false, busy: true, msg: '다른 사람이 저장 중이에요. 잠시 뒤 다시 해 주세요' });
  try {
    return out_(write_(body));
  } catch (err) {
    return out_({ ok: false, msg: '저장 실패: ' + (err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- 쓰기 ----------
function write_(body) {
  var editor = cleanName_(body.editor);
  var bot = '현황판(' + editor + ')';
  var now = nowKST_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB);
  if (!sh) return { ok: false, msg: '「' + TAB + '」 탭이 없어요' };

  // 1) 민감정보 검사 (모든 새 값)
  var bad = findSensitive_(body);
  if (bad) return { ok: false, blocked: true, msg: '전화번호·주민번호처럼 보이는 값이 있어 저장하지 않았어요: ' + bad };

  // 2) 모두 먼저 확인 (하나라도 안 맞으면 아무것도 안 씀)
  var cur = readTab_(sh, COLS.length);
  var curOps = (body.cur && body.cur.ops) || null;
  var curRep = (body.cur && body.cur.replace) || null;
  var c = conflict_(cur, curOps, curRep, body.cur && body.cur.base);
  if (c) return conflictOut_(c);
  var planSh = null, roomSh = null;
  if (body.plan) {
    planSh = ensureTab_(ss, PLAN_TAB, PLAN_COLS);
    if (!Array.isArray(body.plan.replace)) return { ok: false, msg: 'plan.replace 가 없어요' };
    if (body.plan.base !== hash_(readTab_(planSh, PLAN_COLS.length).values)) return conflictOut_('겨울방학 계획을 다른 사람이 먼저 고쳤어요');
  }
  if (body.rooms) {
    roomSh = ensureTab_(ss, ROOM_TAB, ROOM_COLS);
    if (!Array.isArray(body.rooms.replace)) return { ok: false, msg: 'rooms.replace 가 없어요' };
    if (body.rooms.base !== hash_(readTab_(roomSh, ROOM_COLS.length).values)) return conflictOut_('호실 설정(정원·메모)을 다른 사람이 먼저 고쳤어요');
  }
  var sizes = [curRep, body.plan && body.plan.replace, body.rooms && body.rooms.replace, curOps];
  for (var s = 0; s < sizes.length; s++) if (sizes[s] && sizes[s].length > MAX_ROWS) return { ok: false, msg: '줄이 너무 많아요' };

  // 3) 쓰기
  var detail = [];
  if (curOps && curOps.length) detail = detail.concat(applyOps_(sh, curOps, now, bot));
  if (curRep) detail.push(replaceCur_(sh, cur, curRep, now, bot));
  if (planSh) { writeAll_(planSh, PLAN_COLS, body.plan.replace.map(function (r) { return rowOf_(r, PLAN_COLS, now, bot); })); detail.push('겨울계획 ' + body.plan.replace.length + '줄 저장'); }
  if (roomSh) { writeAll_(roomSh, ROOM_COLS, body.rooms.replace.map(function (r) { return rowOf_(r, ROOM_COLS, now, bot); })); detail.push('호실설정 ' + body.rooms.replace.length + '줄 저장'); }
  if (!detail.length) { var r0 = readAll_(); r0.nochange = true; return r0; }

  var tabs = [curOps && curOps.length || curRep ? TAB : '', planSh ? PLAN_TAB : '', roomSh ? ROOM_TAB : ''].filter(String).join(', ');
  var logSh = ensureTab_(ss, LOG_TAB, LOG_COLS);
  logSh.appendRow([now, editor, body.action, tabs, clip_(String(body.summary || detail.join(' / ')), 300), clip_(detail.join(' / '), 1500)].map(String));
  var res = readAll_();
  res.saved = now;
  return res;
}

function conflict_(cur, ops, rep, base) {
  if (rep) {
    if (!Array.isArray(rep)) return 'cur.replace 가 목록이 아니에요';
    if (base !== hash_(cur.values)) return '기숙사 탭을 다른 사람이 먼저 고쳤어요';
    return '';
  }
  if (!ops) return '';
  var last = cur.values.length + 1, seen = {};
  for (var i = 0; i < ops.length; i++) {
    var o = ops[i];
    if (o.op === 'append') { if (!o['new']) return 'append 에 new 가 없어요'; continue; }
    if (o.op !== 'set' && o.op !== 'delete') return '모르는 op: ' + o.op;
    var r = Number(o.r);
    if (!(r >= 2 && r <= last && r === Math.floor(r))) return r + '행이 지금 시트에 없어요';
    if (seen[r]) return r + '행을 두 번 고치려고 해요';
    seen[r] = 1;
    if (o.op === 'set' && !o['new']) return 'set 에 new 가 없어요';
    var now = cur.values[r - 2], who = norm_(o.old && o.old['이름']);
    if (norm_(now[3]) !== who) return '다른 사람이 먼저 고쳤어요 (' + (who || '빈 줄') + ' 줄이 그사이 바뀌거나 자리가 움직였어요)';
    for (var k = 0; k < DATA; k++) {
      var want = norm_(o.old && o.old[COLS[k]]);
      if (norm_(now[k]) !== want) return '다른 사람이 먼저 고쳤어요 (' + r + '행 ' + (norm_(o.old && o.old['이름']) || norm_(o.old && o.old['건물']) + ' ' + norm_(o.old && o.old['호실'])) + ' · ' + COLS[k] + ' ' + (want || '-') + ' → 지금 ' + (norm_(now[k]) || '-') + ')';
    }
  }
  return '';
}

function applyOps_(sh, ops, now, bot) {
  var d = [];
  ops.forEach(function (o) {
    if (o.op !== 'set') return;
    var row = rowOf_(o['new'], COLS, now, bot);
    var rg = sh.getRange(Number(o.r), 1, 1, COLS.length);
    rg.setNumberFormat('@').setValues([row]);
    d.push(o.r + '행 고침: ' + diffTxt_(o.old, o['new']));
  });
  ops.filter(function (o) { return o.op === 'delete'; })
    .sort(function (a, b) { return b.r - a.r; })
    .forEach(function (o) { sh.deleteRow(Number(o.r)); d.push(o.r + '행 지움: ' + short_(o.old)); });
  var add = ops.filter(function (o) { return o.op === 'append'; }).map(function (o) { return rowOf_(o['new'], COLS, now, bot); });
  if (add.length) {
    var start = Math.max(sh.getLastRow(), 1) + 1;
    sh.getRange(start, 1, add.length, COLS.length).setNumberFormat('@').setValues(add);
    add.forEach(function (r) { d.push('줄 추가: ' + r.slice(0, 4).join(' ')); });
  }
  return d;
}

// 되돌리기: 탭 전체를 받은 줄로 바꿈. 안 바뀐 줄은 원래 도장을 그대로 둠.
function replaceCur_(sh, cur, rep, now, bot) {
  var pool = {};
  cur.values.forEach(function (v) { var k = v.slice(0, DATA).map(norm_).join('\u0001'); (pool[k] = pool[k] || []).push(v); });
  var rows = rep.map(function (r) {
    var v = rowOf_(r, COLS, now, bot), k = v.slice(0, DATA).map(norm_).join('\u0001');
    if (pool[k] && pool[k].length) { var old = pool[k].shift(); v[8] = String(old[8]); v[9] = String(old[9]); }
    return v;
  });
  writeAll_(sh, COLS, rows);
  return '기숙사 탭 전체 ' + rows.length + '줄로 되돌림';
}

function writeAll_(sh, cols, rows) {
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, cols.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, cols.length).setNumberFormat('@').setValues(rows);
}

// ---------- 남은 일정 ----------
function readSchedule_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SCHED_TAB);
  if (!sh) return { ok: true, now: nowKST_(), exists: false, rows: [], hash: hash_([]) };
  var cur = readTab_(sh, SCHED_COLS.length);
  var rows = cur.values.filter(function (v) { return norm_(v[0]) || norm_(v[3]); }).map(function (v) {
    var o = {}; SCHED_COLS.forEach(function (c, k) { o[c] = String(v[k]); }); return o;
  });
  return { ok: true, now: nowKST_(), exists: true, rows: rows, hash: hash_(cur.values) };
}
function writeSchedule_(body) {
  var rows = body.rows;
  if (!Array.isArray(rows)) return { ok: false, msg: 'rows 가 없어요' };
  if (rows.length && Array.isArray(rows[0]) && norm_(rows[0][0]) === SCHED_COLS[0]) rows = rows.slice(1); // 머리줄은 빼기
  if (rows.length > MAX_ROWS) return { ok: false, msg: '줄이 너무 많아요' };
  for (var i = 0; i < rows.length; i++) if (!Array.isArray(rows[i])) return { ok: false, msg: (i + 1) + '번째 줄이 목록이 아니에요' };
  var bad = findSensitive_(rows);
  if (bad) return { ok: false, blocked: true, msg: '전화번호·주민번호처럼 보이는 값이 있어 저장하지 않았어요: ' + bad };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureTab_(ss, SCHED_TAB, SCHED_COLS);
  var before = readTab_(sh, SCHED_COLS.length).values;
  if (body.base != null && body.base !== '' && body.base !== hash_(before)) {
    var r = readSchedule_(); r.ok = false; r.conflict = true; r.msg = '남은일정 탭을 다른 곳에서 먼저 고쳤어요. 새로 읽었어요'; return r;
  }
  var now = nowKST_();
  var clean = rows.map(function (v) {
    return SCHED_COLS.map(function (c, k) { return clip_(norm_(v[k]), MAX_CELL); });
  });
  writeAll_(sh, SCHED_COLS, clean);
  var editor = cleanName_(body.editor);
  var logSh = ensureTab_(ss, LOG_TAB, LOG_COLS);
  logSh.appendRow([now, editor, 'schedule', SCHED_TAB, clip_(String(body.summary || ('남은 일정 ' + clean.length + '줄 저장')), 300), '남은 일정 ' + before.length + '줄 → ' + clean.length + '줄'].map(String));
  var res = readSchedule_();
  res.saved = now;
  return res;
}

// ---------- 읽기 ----------
function readAll_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB);
  if (!sh) return { ok: false, msg: '「' + TAB + '」 탭이 없어요' };
  var cur = readTab_(sh, COLS.length);
  var rows = [];
  cur.values.forEach(function (v, i) {
    if (!norm_(v[0]) && !norm_(v[3])) return; // 빈 줄은 건너뜀(행 번호는 그대로)
    var o = { _r: i + 2 };
    COLS.forEach(function (c, k) { o[c] = String(v[k]); });
    rows.push(o);
  });
  var res = { ok: true, now: nowKST_(), rows: rows, hash: hash_(cur.values) };
  [[PLAN_TAB, PLAN_COLS, 'plan'], [ROOM_TAB, ROOM_COLS, 'rooms']].forEach(function (t) {
    var s = ss.getSheetByName(t[0]), vals = s ? readTab_(s, t[1].length).values : [];
    res[t[2]] = {
      rows: vals.filter(function (v) { return v.some(function (x) { return norm_(x); }); })
        .map(function (v) { var o = {}; t[1].forEach(function (c, k) { o[c] = String(v[k]); }); return o; }),
      hash: hash_(vals)
    };
  });
  var lg = ss.getSheetByName(LOG_TAB), logs = [];
  if (lg && lg.getLastRow() >= 2) {
    var n = Math.min(60, lg.getLastRow() - 1);
    logs = lg.getRange(lg.getLastRow() - n + 1, 1, n, 5).getDisplayValues().reverse()
      .map(function (v) { return { t: v[0], who: v[1], act: v[2], tab: v[3], txt: v[4] }; });
  }
  res.log = logs;
  return res;
}

function readTab_(sh, ncol) {
  var last = sh.getLastRow();
  var values = last >= 2 ? sh.getRange(2, 1, last - 1, ncol).getDisplayValues() : [];
  // 끝쪽 빈 줄은 빼기
  while (values.length && !values[values.length - 1].some(function (x) { return norm_(x); })) values.pop();
  return { values: values };
}

// ---------- 도우미 ----------
function ensureTab_(ss, name, cols) {
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}
function rowOf_(o, cols, now, bot) {
  o = o || {};
  return cols.map(function (c) {
    if (c === '최종수정') return now;
    if (c === '수정한 봇') return bot;
    return clip_(norm_(o[c]), MAX_CELL);
  });
}
function hash_(values) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(values), Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function norm_(v) { return v == null ? '' : String(v).trim(); }
function clip_(s, n) { s = String(s); return s.length > n ? s.slice(0, n) : s; }
function short_(o) { o = o || {}; return [o['건물'], o['호실'], o['구분'], o['이름']].map(norm_).join(' '); }
function diffTxt_(a, b) {
  a = a || {}; b = b || {};
  var t = [];
  for (var k = 0; k < DATA; k++) { var c = COLS[k]; if (norm_(a[c]) !== norm_(b[c])) t.push(c + ' ' + (norm_(a[c]) || '-') + '→' + (norm_(b[c]) || '-')); }
  return short_(a) + (t.length ? ' (' + t.join(', ') + ')' : '');
}
function nowKST_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
function cleanName_(s) {
  s = norm_(s).replace(/[\u0000-\u001f<>()=+@]/g, '').slice(0, 20);
  return s || '익명';
}
function keyOk_(k) {
  var want = PropertiesService.getScriptProperties().getProperty('EDIT_KEY');
  return !want || String(k || '') === want;
}
var SENSITIVE = [
  /\d{6}\s*[-–]\s*[1-4]\d{6}/,                 // 주민등록번호
  /(^|\D)\d{6}[1-4]\d{6}(\D|$)/,              // 붙여 쓴 주민번호(13자리)
  /(^|\D)01[016789][\s.\-]?\d{3,4}[\s.\-]?\d{4}(\D|$)/,  // 휴대전화
  /(^|\D)0\d{1,2}[\s.\-)]\d{3,4}[\s.\-]\d{4}(\D|$)/      // 일반 전화 (예: 055-123-4567)
];
function isSensitive_(s) { s = String(s); return SENSITIVE.some(function (re) { return re.test(s); }); }
function findSensitive_(v) {
  if (v == null) return '';
  if (typeof v === 'string') return isSensitive_(v) ? v.replace(/\d/g, '*').slice(0, 30) : '';
  if (typeof v === 'number') return isSensitive_(String(v)) ? '(숫자)' : '';
  if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) { var a = findSensitive_(v[i]); if (a) return a; } return ''; }
  if (typeof v === 'object') {
    for (var k in v) {
      if (k === 'old' || k === 'base' || k === 'key') continue; // 옛 값·hash 는 검사하지 않음
      var b = findSensitive_(v[k]); if (b) return b;
    }
  }
  return '';
}
function conflictOut_(msg) { var r = readAll_(); r.ok = false; r.conflict = true; r.msg = msg + '. 새로 읽었어요. 다시 해 주세요'; return r; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// 편집기에서 한 번 눌러 보는 시험(시트는 안 바꿈): 실행 → testRead
function testRead() { Logger.log(JSON.stringify(readAll_()).slice(0, 2000)); Logger.log(JSON.stringify(readSchedule_()).slice(0, 1000)); }
