/* 봇 작업 현황 공용 계산 (브라우저·node 같이 씀). 자료: data/bot_status.json (현황판 → 99 봇/스크립트/bot_status_build.py).
   날짜는 'YYYY-MM-DD' 글자, 오늘은 한국 시간(KST). 개인정보 없음(봇 이름·T번호·업무 이름만). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HJBots = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var DAY = 86400000;
  var STATES = ['진행', '대기(유진님 몫)', '막힘', '끝'];
  var DOT = { '진행': 'run', '대기(유진님 몫)': 'yu', '막힘': 'stop', '끝': 'done' };
  var SHORT = { '진행': '진행', '대기(유진님 몫)': '유진님 몫', '막힘': '막힘', '끝': '끝' };
  var YU_KINDS = ['로그인', '결제', '결재', 'KORUS 입력', '제출', '확인·판단', '유진님 직접', '대기: PC'];
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayKST(nowMs) {
    var d = new Date((nowMs == null ? Date.now() : nowMs) + 9 * 3600000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function toUTC(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function diffDays(a, b) { return Math.round((toUTC(b) - toUTC(a)) / DAY); }
  function md(s) { if (!s) return ''; var p = String(s).split('-'); return (+p[1]) + '.' + (+p[2]) + '.(' + WD[new Date(toUTC(s)).getUTCDay()] + ')'; }
  /* 마감: late(지남) · today · soon(D-3 이내) · later · none · done */
  function due(t, today) {
    if (t.state === '끝') return { cls: 'done', n: null, label: t.due ? md(t.due) : '' };
    if (!t.due) return { cls: 'none', n: null, label: '마감 없음' };
    var n = diffDays(today, t.due);
    if (n < 0) return { cls: 'late', n: n, label: (-n) + '일 지남' };
    if (n === 0) return { cls: 'today', n: 0, label: '오늘 마감' };
    return { cls: n <= 3 ? 'soon' : 'later', n: n, label: 'D-' + n };
  }
  var RANK = { late: 0, today: 1, soon: 2, later: 3, none: 4, done: 5 };
  function sortTasks(list, today) {
    return list.slice().sort(function (a, b) {
      var da = due(a, today), db = due(b, today);
      if (RANK[da.cls] !== RANK[db.cls]) return RANK[da.cls] - RANK[db.cls];
      var x = a.due || '9999', y = b.due || '9999';
      if (x !== y) return x < y ? -1 : 1;
      return a.t < b.t ? -1 : a.t > b.t ? 1 : 0;
    });
  }
  /* 맨 위 세 묶음: 유진님이 해야 할 것 · 마감 임박(D-3 이내, 지난 것 포함) · 감사 위험 */
  function sections(tasks, today) {
    var open = sortTasks(tasks.filter(function (t) { return t.state !== '끝'; }), today);
    return {
      yujin: open.filter(function (t) { return t.state === '대기(유진님 몫)' || (t.yujin && t.yujin.length); }),
      soon: open.filter(function (t) { var c = due(t, today).cls; return c === 'late' || c === 'today' || c === 'soon'; }),
      risk: open.filter(function (t) { return t.risk && t.risk.length; })
    };
  }
  /* f = {state: '' | 상태, bot: '' | 봇 이름, q: 낱말} */
  function filter(tasks, f) {
    f = f || {};
    var q = String(f.q || '').trim().toLowerCase();
    return tasks.filter(function (t) {
      if (f.state && t.state !== f.state) return false;
      if (!f.state && !f.showDone && t.state === '끝') return false;
      if (f.bot === '(미기재)' ? !!t.bot : (f.bot && t.bot !== f.bot)) return false;
      if (q && (t.t + ' ' + t.title + ' ' + (t.bot || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function counts(tasks) {
    var c = { all: tasks.length };
    STATES.forEach(function (s) { c[s] = 0; });
    tasks.forEach(function (t) { if (c[t.state] != null) c[t.state] += 1; });
    return c;
  }
  function bots(tasks) {
    var o = {};
    tasks.forEach(function (t) { if (t.bot) o[t.bot] = (o[t.bot] || 0) + 1; });
    return Object.keys(o).sort();
  }
  function progressText(p) { return (p === null || p === undefined || p === '') ? '미기재' : (Math.max(0, Math.min(100, +p)) + '%'); }
  function verifiedText(v) { return v ? ('점검 ' + v) : '미기재'; }
  /* 갱신이 오래됐는지: 기본 3시간(30분 주기의 6배) */
  function stale(data, nowMs, hours) {
    if (!data || !data.built_iso) return { warn: true, why: '갱신 기록이 없어요' };
    var age = ((nowMs == null ? Date.now() : nowMs) - Date.parse(data.built_iso)) / 3600000;
    var lim = hours || 3;
    if (age > lim) return { warn: true, age: age, why: Math.floor(age) + '시간 넘게 새로 읽지 않았어요(' + data.built_at + ' 기준)' };
    return { warn: false, age: age };
  }
  return { STATES: STATES, DOT: DOT, SHORT: SHORT, YU_KINDS: YU_KINDS, todayKST: todayKST, diffDays: diffDays, md: md, due: due,
    sortTasks: sortTasks, sections: sections, filter: filter, counts: counts, bots: bots,
    progressText: progressText, verifiedText: verifiedText, stale: stale };
});
