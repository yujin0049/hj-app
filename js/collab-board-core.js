/* 협업 보드(#/bots 맨 위) 공용 계산 (브라우저·node 같이 씀). 보기 전용이에요. 쓰는 버튼·입력칸 없음.
   자료: data/bot_status.json(현황판) + data/todo.json(내일 할 일). 카드에는 허용 목록 7칸만 남기고 나머지는 버려요.
   허용 목록(계획서 261030_연습장_협업툴_검토_v01): 일 번호 · 짧은 제목 · 봇 이름 · 상태 · 다음 단계 · 시각 · 연습장 링크.
   카드 글은 모두 그냥 글자로만 넣어요(HTML 해석 안 함). 출처: 유진님 10.30. 19:22 「너희들이랑 나랑 협업가능하게 행정업무연습장 개선예정」. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HJBoard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var FIELDS = ['no', 'title', 'bot', 'state', 'next', 'at', 'link'];
  var LABEL = { no: '일 번호', title: '짧은 제목', bot: '봇 이름', state: '상태', next: '다음 단계', at: '시각', link: '연습장 링크' };
  /* 현황판 상태 → 보드 상태. 「유진님 확인 필요」를 맨 위에 둬요. */
  var STATE = { '대기(유진님 몫)': '유진님 확인 필요', '막힘': '막힘', '진행': '진행', '끝': '끝' };
  var ORDER = ['유진님 확인 필요', '막힘', '진행', '끝', '그 밖'];
  var DOT = { '유진님 확인 필요': 'yu', '막힘': 'stop', '진행': 'run', '끝': 'done', '그 밖': 'etc' };
  var BOTS = ['대장', '문서봇', '춘식이', '춘식이2', '춘식이3', '클로드', '유진님'];
  var STALE_H = 72; /* 3일 넘게 안 바뀐 안 끝난 카드 = 「오래 멈춤」 색 */
  var TITLE_MAX = 28, NEXT_MAX = 34;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"'`]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c];
    });
  }
  function clip(s, n) {
    var a = Array.from(String(s || '').replace(/\s+/g, ' ').trim());
    return a.length > n ? a.slice(0, n - 1).join('').trim() + '…' : a.join('');
  }
  /* 짧은 제목: 괄호 속(금액·인원·업체·날짜가 자주 들어감)·[문서번호]·금액·전화/이메일/주민번호 모양을 빼고 28자까지 */
  function scrub(s) {
    var x = String(s == null ? '' : s);
    for (var i = 0; i < 3; i++) x = x.replace(/\([^()]*\)|（[^（）]*）|【[^【】]*】|〔[^〔〕]*〕|\[[^\[\]]*\]/g, ' ');
    x = x.replace(/[(（【〔\[].*$/, ' ') /* 안 닫힌 괄호는 끝까지 버려요 */
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, ' ')
      .replace(/\d{6}[-\s]?[1-8]\d{6}/g, ' ')
      .replace(/(?:\+?82[-.\s]?|0)\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, ' ')
      .replace(/\d{10,}/g, ' ')
      .replace(/[₩\\]\s*\d[\d,.]*/g, ' ')
      .replace(/금\s*\d[\d,.]*/g, ' ')
      .replace(/\d[\d,.]*(?:\s*[억천백만])*\s*(?:원(?:으로|을|이|의|은|과|도|에)?(?!칙|장|래|본|인|문|리|활|서)|KRW)/g, ' ')
      .replace(/\d[\d,.]*(?:\s*[억천백만])+(?![가-힣])/g, ' ')
      .replace(/\d{1,3}(?:,\d{3})+/g, ' ')
      .replace(/[<>]/g, ' ')
      .replace(/\s+([·,])/g, '$1')
      .replace(/([·,])(?:\s*[·,])+/g, '$1')
      .replace(/^[\s·,:—–-]+|[\s·,:—–-]+$/g, '');
    return x;
  }
  function shortTitle(s) { return clip(scrub(s), TITLE_MAX) || '제목 미기재'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  /* 'YYYY-MM-DD HH:MM' 또는 'YYYY-MM-DD' → { text: '10.22.(목) 15:09', ms } (KST 글자 그대로). 모양이 다르면 빈칸 */
  function at(s) {
    var m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d))?/.exec(String(s || ''));
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31 || (m[4] && (+m[4] > 23 || +m[5] > 59))) return { text: '', ms: null };
    var chk = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (chk.getUTCMonth() !== +m[2] - 1 || chk.getUTCDate() !== +m[3]) return { text: '', ms: null };
    var utc = Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0) - 9 * 3600000;
    var wd = WD[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
    return { text: (+m[2]) + '.' + (+m[3]) + '.(' + wd + ')' + (m[4] ? ' ' + m[4] + ':' + m[5] : ''), ms: utc };
  }
  function botName(b) {
    b = String(b || '').trim();
    return BOTS.indexOf(b) >= 0 ? b : (b ? '그 밖의 봇' : '담당 미기재');
  }
  function linkFor(no) { return /^T\d{3,4}$/.test(no) ? '#/bots?t=' + no : '#/todo'; }
  /* 「내일 할 일」(todo.json)에서 T번호가 같은 안 끝난 유진님 일 → 다음 단계 */
  function todoNext(todo, openNo) {
    var o = {}, used = {};
    arr(todo && todo.items).forEach(function (it, i) {
      if (!it || typeof it !== 'object' || it.done) return;
      var m = /\b(T\d{3,4})\b/.exec(String(it.title || ''));
      if (m && openNo && openNo[m[1]] && !o[m[1]]) { o[m[1]] = String(it.title).replace(m[1], '').trim(); used[i] = 1; }
    });
    return { next: o, used: used };
  }
  function nextStep(t, tn) {
    if (t.state === '끝') return '없음(끝났어요)';
    if (!STATE[t.state]) return '현황판에서 상태 확인';
    if (tn[t.t]) return clip('유진님: ' + shortTitle(tn[t.t]), NEXT_MAX);
    if (t.state === '대기(유진님 몫)') {
      var tags = (Array.isArray(t.yujin) ? t.yujin : []).filter(function (g) { return typeof g === 'string'; })
        .map(function (g) { return scrub(g.replace(/^대기:\s*/, '').replace(/^유진님\s*/, '')); }).filter(Boolean);
      return clip('유진님 ' + (tags.length ? tags.slice(0, 2).join('·') : '확인') + ' 기다려요', NEXT_MAX);
    }
    if (t.state === '막힘') return '막힌 곳 풀기(대장이 나눠 줘요)';
    return '봇이 하는 중';
  }
  /* 카드 하나 = 허용 목록 7칸 + stale(색만 바꾸는 참/거짓). 자료의 다른 칸(금액·메모·경로·위험 등)은 하나도 안 옮겨요. */
  function pick(card) {
    var o = {};
    FIELDS.forEach(function (k) { o[k] = String(card[k] == null ? '' : card[k]); });
    o.stale = !!card.stale;
    return o;
  }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function build(status, todo, nowMs) {
    var now = nowMs == null ? Date.now() : nowMs;
    var tasks = arr(status && status.tasks), items = arr(todo && todo.items);
    var cards = [], openNo = {};
    tasks.forEach(function (t) {
      if (t && typeof t === 'object' && /^T\d{3,4}$/.test(String(t.t || '')) && STATE[t.state] && t.state !== '끝') openNo[t.t] = 1;
    });
    var tn = todoNext({ items: items }, openNo);
    tasks.forEach(function (t) {
      if (!t || typeof t !== 'object' || !/^T\d{3,4}$/.test(String(t.t || ''))) return;
      var a = at(t.updated), st = STATE[t.state] || '그 밖';
      var c = pick({ no: t.t, title: shortTitle(t.title), bot: botName(t.bot), state: st, next: nextStep(t, tn.next), at: a.text, link: linkFor(t.t),
        stale: st !== '끝' && a.ms != null && (now - a.ms) > STALE_H * 3600000 });
      c._ms = a.ms; cards.push(c);
    });
    /* 「내일 할 일」 중 안 끝난 것: 열린 현황판 카드의 「다음 단계」로 붙지 않은 것은 모두 따로 유진님 카드 */
    var d = at(todo && todo.date), n = 0;
    items.forEach(function (it, i) {
      if (!it || typeof it !== 'object' || it.done) return;
      n += 1;
      if (tn.used[i]) return;
      var c = pick({ no: '할 일 ' + n, title: shortTitle(it.title), bot: '유진님', state: '유진님 확인 필요', next: '유진님이 해요', at: d.text, link: '#/todo' });
      c._ms = d.ms; cards.push(c);
    });
    return cards;
  }
  function byTime(a, b) { return (b._ms || 0) - (a._ms || 0); }
  /* mode 'state' | 'bot' → [{key, cards}] */
  function group(cards, mode) {
    var m = {}, keys;
    cards.forEach(function (c) { var k = mode === 'bot' ? c.bot : c.state; (m[k] = m[k] || []).push(c); });
    if (mode === 'bot') keys = Object.keys(m).sort(function (a, b) {
      var x = BOTS.indexOf(a), y = BOTS.indexOf(b);
      if (a === '유진님') return -1; if (b === '유진님') return 1;
      return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || (a < b ? -1 : 1);
    });
    else keys = ORDER.filter(function (k) { return m[k]; });
    return keys.map(function (k) {
      var l = m[k].slice().sort(function (a, b) {
        if (mode === 'bot' && a.state !== b.state) return ORDER.indexOf(a.state) - ORDER.indexOf(b.state);
        return byTime(a, b);
      });
      return { key: k, cards: l };
    });
  }
  /* 카드 HTML: 7칸만, 모두 esc. 링크는 앱 안(#/…)만 */
  function cardHTML(c) {
    var href = /^#\/[\w\-/?=]+$/.test(c.link) ? c.link : '#/bots';
    return '<article class="cb-card' + (c.stale ? ' stale' : '') + '" data-no="' + esc(c.no) + '">' +
      '<div class="cb-t1"><span class="cb-dot d-' + (DOT[c.state] || 'run') + '"></span><span class="cb-no">' + esc(c.no) + '</span>' +
      '<span class="cb-st">' + esc(c.state) + (c.stale ? ' · 오래 멈춤' : '') + '</span></div>' +
      '<div class="cb-title">' + esc(c.title) + '</div>' +
      '<div class="cb-meta"><span class="cb-bot">' + esc(c.bot) + '</span><span class="cb-at">' + esc(c.at || '시각 미기재') + '</span></div>' +
      '<div class="cb-next">→ ' + esc(c.next) + '</div>' +
      '<a class="cb-link" href="' + esc(href) + '">연습장에서 보기</a></article>';
  }
  return { FIELDS: FIELDS, LABEL: LABEL, STATE: STATE, ORDER: ORDER, BOTS: BOTS, STALE_H: STALE_H,
    esc: esc, scrub: scrub, shortTitle: shortTitle, at: at, botName: botName, nextStep: nextStep, todoNext: todoNext, pick: pick, build: build, group: group, cardHTML: cardHTML };
});
