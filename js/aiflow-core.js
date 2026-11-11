/* 인트라넷 AI 전환 1단계 공용 계산 (브라우저·node 같이 씀). 계획: 「어찌 해야하는지 글을 토대로 다른 전문가거를 배껴서 시스템에 적용하자」.
   메뉴·홈 카드에만 써요. 자료 = 이미 있는 json(bot_status·checks·ojnt_progress·regular_docs·docsearch)만. 새 입력·예시 자료 없음.
   값이 없으면 null → 화면에 「데이터 없음」. 유보(로그인·결제·영구삭제·외부발송·상신)는 자율도와 상관없이 늘 잠금, 여기서 풀지 않음. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HJAIFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var H = (typeof module === 'object' && module.exports) ? require('./homeboard-core.js') : root.HJHomeBoard;
  /* 유보 = 사람 손, 자동 실행 금지 */
  var LOCKS = ['로그인', '결제', '영구삭제', '외부발송', '상신'];
  /* 현황판 「유진님 몫」 꼬리표 → 유보 잠금. 결재(유진님이 올림) = 상신, 발송·제출(밖으로 나감) = 외부발송 */
  var TAG_LOCK = { '로그인': '로그인', '결제': '결제', '발송': '외부발송', '제출': '외부발송', '결재': '상신' };
  var TITLE_LOCK = [[/영구\s*삭제/, '영구삭제'], [/상신/, '상신']];
  /* 자율도 3단(Karpathy 자율도 슬라이더). 건 자료에 autonomy(1~3)가 있을 때만 씀 */
  var LEVELS = ['초안만', '요약보고', '이상치만알림'];
  /* 경계 밖(사람 판단) 꼬리표 */
  var HUMAN_TAGS = ['확인·판단', '유진님 직접', '재개지시'];
  var JUDGE_AFTER = 2; /* 같은 건 보고 전 검사 2회 미달 → 판단요청 */

  function locks(t) {
    var o = [];
    (t.yujin || []).forEach(function (g) { var k = TAG_LOCK[g]; if (k && o.indexOf(k) < 0) o.push(k); });
    TITLE_LOCK.forEach(function (p) { if (p[0].test(t.title || '') && o.indexOf(p[1]) < 0) o.push(p[1]); });
    return LOCKS.filter(function (k) { return o.indexOf(k) >= 0; });
  }
  function level(t) {
    var a = t.autonomy;
    if (typeof a === 'number' && a >= 1 && a <= 3) return LEVELS[a - 1];
    if (typeof a === 'string' && LEVELS.indexOf(a) >= 0) return a;
    return null;
  }
  /* 경계: '밖'(사람 판단, 봇은 추천만) · '안'(봇 초안·취합·대조) · null(담당 봇도 없어 모름) */
  function boundary(t) {
    if (locks(t).length) return '밖';
    if (t.state === '대기(유진님 몫)') return '밖';
    if ((t.yujin || []).some(function (g) { return HUMAN_TAGS.indexOf(g) >= 0; })) return '밖';
    return t.bot ? '안' : null;
  }
  /* 보고 전 검사: 근거·유보·3줄. 근거 = 현황판 「점검」 칸(verified). 유보·3줄·미달 횟수는 건 자료에 check 가 있을 때만 */
  function precheck(t) {
    var c = t.check || {};
    var v = t.verified, ev = null;
    if (typeof c.evidence === 'boolean') ev = c.evidence;
    else if (v) ev = !/^미검증/.test(String(v));
    var fails = typeof c.fails === 'number' ? c.fails : null;
    return {
      근거: ev,
      유보: typeof c.reserved === 'boolean' ? c.reserved : null,
      '3줄': typeof c.lines3 === 'boolean' ? c.lines3 : null,
      fails: fails,
      judge: fails !== null && fails >= JUDGE_AFTER
    };
  }
  function tally(list, f) {
    var o = { pass: 0, fail: 0, none: 0 };
    list.forEach(function (t) { var v = f(t); if (v === true) o.pass += 1; else if (v === false) o.fail += 1; else o.none += 1; });
    return o;
  }
  /* 홈 요약: 안 끝난 건만 */
  function summary(tasks) {
    var open = (tasks || []).filter(H.isOpen);
    var lv = {}, lvAny = false;
    LEVELS.forEach(function (k) { lv[k] = 0; });
    var lk = {}; LOCKS.forEach(function (k) { lk[k] = 0; });
    var lockedN = 0, out = 0, inn = 0, unk = 0, judge = [], failsAny = false;
    open.forEach(function (t) {
      var l = level(t); if (l) { lv[l] += 1; lvAny = true; }
      var ls = locks(t); if (ls.length) lockedN += 1;
      ls.forEach(function (k) { lk[k] += 1; });
      var b = boundary(t); if (b === '밖') out += 1; else if (b === '안') inn += 1; else unk += 1;
      var p = precheck(t); if (p.fails !== null) failsAny = true; if (p.judge) judge.push(t);
    });
    return {
      open: open.length,
      levels: lvAny ? lv : null,
      locked: lockedN, lockBy: lk,
      boundary: { '밖': out, '안': inn, '모름': unk },
      checks: {
        근거: tally(open, function (t) { return precheck(t).근거; }),
        유보: tally(open, function (t) { return precheck(t).유보; }),
        '3줄': tally(open, function (t) { return precheck(t)['3줄']; })
      },
      judge: failsAny ? judge : null
    };
  }
  /* 이상치만(빨간 카드): 출석·마감·기숙사. null = 자료 없음, items 빈 배열 = 이상 없음 */
  function anomalies(src, today) {
    src = src || {};
    var o = { 출석: null, 마감: null, 기숙사: null };
    var att = (src.checks || []).filter(function (c) { return /출석/.test(c['항목'] || '') || /^attend/.test(c.id || ''); });
    if (att.length) o.출석 = att.filter(function (c) { return c['결과'] === '불일치'; }).map(function (c) { return c['항목'] + ' · ' + (c['값'] || ''); });
    if (src.tasks) {
      o.마감 = src.tasks.filter(function (t) { return H.soon(t, today); }).map(function (t) {
        return { t: t.t, title: t.title || '', late: H.overdue(t, today), due: t.due || '' };
      });
    }
    var dorm = [];
    var seen = false;
    (src.checks || []).forEach(function (c) {
      if (!/^ojnt/.test(c.id || '')) return;
      seen = true;
      if (c['결과'] === '불일치') dorm.push(c['항목'] + ' · ' + (c['값'] || ''));
    });
    var p = src.ojnt;
    if (p && Array.isArray(p.items)) {
      seen = true;
      var last = (p.deadlines || []).map(function (d) { return d.date; }).filter(Boolean).sort().pop();
      if (last && last < today) p.items.forEach(function (it) {
        if (typeof it.done === 'number' && typeof it.total === 'number' && it.done < it.total) dorm.push(it.label + ' ' + it.done + '/' + it.total + ' (마감 ' + last.slice(5).replace('-', '.') + '. 지남)');
      });
    }
    if (seen) o.기숙사 = dorm;
    return o;
  }
  /* 문서·규정 답 근거: 내부 최신 문서 + 출처(앱 화면). 날짜가 없으면 null → 「없음」 */
  function docs(src) {
    src = src || {};
    function d(s) { var m = String(s || '').match(/(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; }
    var b = src.bot_status && src.bot_status.handover;
    var rd = src.regular_docs, ds = src.docsearch;
    return [
      { name: '업무방식 정본', doc: b && b.doc || null, date: b ? d(b.saved_at) : null, where: '#/bots', whereLabel: '봇 작업 현황' },
      { name: '정례 문서 달력', doc: rd && rd.source || null, date: rd ? d(rd.refreshed_at) : null, where: '#/regular-docs', whereLabel: '정례 문서 달력' },
      { name: '문서대장 찾기', doc: ds && ds.extra && ds.extra.source || null, date: ds ? d(ds.version) : null, where: '#/docsearch', whereLabel: '문서대장 찾기' }
    ].sort(function (x, y) { /* 최신 먼저, 날짜 없는 것은 뒤 */
      if (!x.date !== !y.date) return x.date ? -1 : 1;
      return x.date < y.date ? 1 : x.date > y.date ? -1 : 0;
    });
  }
  /* 반려 이유 한 줄 누적: 건 자료 rejects(글 배열) 또는 파일 맨 위 rejects. 하나도 없으면 null */
  function rejects(data) {
    if (!data) return null;
    var out = [], any = Array.isArray(data.rejects);
    (data.rejects || []).forEach(function (r) { if (r) out.push({ t: r.t || '', why: String(r.why || r).split('\n')[0] }); });
    (data.tasks || []).forEach(function (t) {
      if (Array.isArray(t.rejects)) { any = true; t.rejects.forEach(function (r) { if (r) out.push({ t: t.t, why: String(r).split('\n')[0] }); }); }
    });
    return any ? out : null;
  }
  return { LOCKS: LOCKS, TAG_LOCK: TAG_LOCK, LEVELS: LEVELS, JUDGE_AFTER: JUDGE_AFTER,
    locks: locks, level: level, boundary: boundary, precheck: precheck, summary: summary, anomalies: anomalies, docs: docs, rejects: rejects };
});
