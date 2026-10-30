/* 계획 달력·현황표 공용 계산 (브라우저·node 같이 씀). 날짜는 모두 'YYYY-MM-DD' 글자, 오늘은 한국 시간(KST) 기준. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HJCal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var DONE = { '완료': 1, '취소': 1, '끝남': 1 };
  var DAY = 86400000;
  function pad(n) { return String(n).padStart(2, '0'); }
  /* 지금 시각(ms) → 한국 날짜. 기기 시간대와 관계없이 UTC+9 */
  function todayKST(nowMs) {
    var d = new Date((nowMs == null ? Date.now() : nowMs) + 9 * 3600000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function toUTC(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fromUTC(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { return fromUTC(toUTC(s) + n * DAY); }
  function diffDays(a, b) { return Math.round((toUTC(b) - toUTC(a)) / DAY); } /* b - a */
  function weekday(s) { return new Date(toUTC(s)).getUTCDay(); } /* 0=일 */
  function weekStart(s) { return addDays(s, -weekday(s)); } /* 일요일 시작 */
  function weekDays(s) { var a = weekStart(s), out = []; for (var i = 0; i < 7; i++) out.push(addDays(a, i)); return out; }
  function monthGrid(y, m) { /* m: 1~12 → 6주×7일 */
    var first = y + '-' + pad(m) + '-01', start = weekStart(first), out = [];
    for (var i = 0; i < 42; i++) out.push(addDays(start, i));
    return out;
  }
  function isDone(st) { var m = String(st || '').trim().match(/^(완료|취소|끝남)/); return !!(m && DONE[m[1]]); }
  /* 마감 상태: done(끝남) · late(지연, 마감 지남) · today(오늘) · soon(D-3 이내) · later */
  function dueState(date, today, status) {
    if (!date) return { cls: 'none', n: null, label: '마감 없음' };
    var n = diffDays(today, date);
    if (isDone(status)) return { cls: 'done', n: n, label: String(status) };
    if (n < 0) return { cls: 'late', n: n, label: '지연 ' + (-n) + '일' };
    if (n === 0) return { cls: 'today', n: 0, label: 'D-day' };
    if (n <= 3) return { cls: 'soon', n: n, label: 'D-' + n };
    return { cls: 'later', n: n, label: 'D-' + n };
  }
  /* 화면 안 찾기(261030 목록 UX): 띄어 쓴 낱말이 모두 들어 있으면 맞음. 대소문자·띄어쓰기 무시.
     보는 칸: T번호·제목·단계·봇·분야·상태·종류·조건·유진님 꼬리표 */
  function normQ(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ''); }
  function matchQ(x, q) {
    var words = String(q || '').trim().split(/\s+/).map(normQ).filter(Boolean);
    if (!words.length) return true;
    var hay = normQ([x.t, x.title, x.step, x.bot, x.group, x.status, x.kind, x.cond].concat(x.yujin || []).join(' '));
    return words.every(function (w) { return hay.indexOf(w) >= 0; });
  }
  /* 거르기: f = {bot, status, group, lanes:{yujin:1,...}, showDone, q} */
  function pass(x, f) {
    f = f || {};
    if (f.q && !matchQ(x, f.q)) return false;
    if (f.bot && (x.bot || '') !== f.bot) return false;
    if (f.status && x.status !== f.status) return false;
    if (f.group && x.group !== f.group) return false;
    if (f.lanes && x.lane && !f.lanes[x.lane]) return false;
    if (!f.showDone && isDone(x.status)) return false;
    return true;
  }
  /* 갱신 상태: 실패·24시간 넘음 → 경고 */
  function staleness(meta, nowMs) {
    if (!meta || !meta.refreshed_iso) return { warn: true, why: '갱신 기록이 없어요' };
    var age = ((nowMs == null ? Date.now() : nowMs) - Date.parse(meta.refreshed_iso)) / 3600000;
    var lim = meta.stale_hours || 24;
    if (meta.last_try_ok === false) return { warn: true, why: '마지막 갱신(' + meta.last_try + ')이 실패했어요. 보이는 자료는 ' + meta.refreshed_at + ' 것이에요.', age: age };
    if (age > lim) return { warn: true, why: Math.floor(age) + '시간 넘게 갱신이 안 됐어요(' + lim + '시간 기준).', age: age };
    return { warn: false, age: age };
  }
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function md(s) { var p = String(s).split('-'); return (+p[1]) + '.' + (+p[2]) + '.(' + WD[weekday(s)] + ')'; }
  return { todayKST: todayKST, addDays: addDays, diffDays: diffDays, weekday: weekday, weekStart: weekStart, weekDays: weekDays,
    monthGrid: monthGrid, isDone: isDone, dueState: dueState, pass: pass, matchQ: matchQ, staleness: staleness, md: md, WD: WD,
    PEOPLE_API: 'api/people' };
});
