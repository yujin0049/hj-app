/* 남은 일정 계산. 사람 이름, 시트 주소, 수정 열쇠는 여기 두지 않아요. */
(function (root) {
  'use strict';
  var HEAD = ['아이디', '날짜', '끝날짜', '할일', '담당', '메모', '완료', '확인필요', '확인메모', '고친때'];
  var BOX = 'ap3-schedule-outbox';
  var GROUPS = [
    ['over', '지남'],
    ['today', '오늘'],
    ['week', '이번 주'],
    ['later', '이후'],
    ['anytime', '수시'],
    ['done', '완료']
  ];

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function ymd(d) {
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function parseDate(s) {
    var m = norm(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
    return d;
  }
  function dayOf(today) {
    if (today && typeof today.getFullYear === 'function') return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return parseDate(today) || new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  }
  function cleanItem(raw) {
    raw = raw || {};
    var date = parseDate(raw.date) ? norm(raw.date) : '';
    var end = parseDate(raw.end) ? norm(raw.end) : '';
    if (end && date && end < date) end = '';
    return {
      id: norm(raw.id),
      date: date,
      end: end,
      title: norm(raw.title),
      owner: norm(raw.owner),
      memo: norm(raw.memo),
      done: raw.done === true || raw.done === 'Y' || raw.done === '완료',
      needsConfirm: raw.needsConfirm === true || raw.needsConfirm === 'Y',
      confirmNote: norm(raw.confirmNote)
    };
  }
  function freshId(items) {
    var id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if ((items || []).some(function (it) { return it.id === id; })) return freshId(items);
    return id;
  }
  function ensureIds(items) {
    var seen = {};
    items.forEach(function (item) {
      if (!item.id || seen[item.id]) item.id = freshId(items);
      seen[item.id] = 1;
    });
    return items;
  }
  function copy(item) { return cleanItem(item); }

  function createState(seed) {
    seed = seed || {};
    return {
      items: ensureIds((seed.items || []).map(cleanItem)),
      sheetUrl: seed.sheetUrl || '',
      sheetTitle: seed.sheetTitle || '',
      tab: seed.tab || '남은일정',
      scriptUrl: norm(seed.scriptUrl),
      editKey: '',
      pending: false,
      syncedAt: '',
      base: '',
      at: ''
    };
  }
  function hydrate(seed, saved) {
    var state = createState(seed);
    if (!saved) return state;
    if (Array.isArray(saved.items)) state.items = ensureIds(saved.items.map(cleanItem));
    if (saved.scriptUrl) state.scriptUrl = norm(saved.scriptUrl);
    if (saved.editKey) state.editKey = String(saved.editKey);
    state.pending = !!saved.pending;
    state.syncedAt = saved.syncedAt || '';
    state.base = saved.base || '';
    state.at = saved.at || '';
    return state;
  }
  function serial(state) {
    return {
      items: state.items.map(cleanItem),
      scriptUrl: state.scriptUrl || '',
      editKey: state.editKey || '',
      pending: !!state.pending,
      syncedAt: state.syncedAt || '',
      base: state.base || '',
      at: state.at || ''
    };
  }
  function resolve(seed, saved, box) {
    var state = hydrate(seed, saved);
    if (box && Array.isArray(box.items) && box.at && (!state.at || box.at > state.at)) {
      state.items = ensureIds(box.items.map(cleanItem));
      state.pending = !!box.pending;
      state.at = box.at;
    }
    return state;
  }

  function weekEnd(day) {
    var d = dayOf(day);
    var wd = d.getDay();
    var toSun = wd === 0 ? 0 : 7 - wd;
    d.setDate(d.getDate() + toSun);
    return d;
  }
  function startOf(item) { return parseDate(item.date); }
  function endOf(item) { return parseDate(item.end) || parseDate(item.date); }

  function bucket(item, today) {
    var t = dayOf(today);
    if (item.done) return 'done';
    if (!item.date) return 'anytime';
    var start = startOf(item);
    var end = endOf(item);
    var ts = ymd(t);
    if (ymd(end) < ts) return 'over';
    if (ymd(start) <= ts && ts <= ymd(end)) return 'today';
    if (ymd(start) <= ymd(weekEnd(t))) return 'week';
    return 'later';
  }
  function dday(item, today) {
    if (!item.date) return '수시';
    var t = dayOf(today);
    var start = startOf(item);
    var end = endOf(item);
    if (ymd(start) <= ymd(t) && ymd(t) <= ymd(end)) {
      return ymd(start) === ymd(end) ? '오늘' : '진행';
    }
    var target = ymd(t) < ymd(start) ? start : end;
    var diff = Math.round((target - t) / 86400000);
    if (diff === 0) return '오늘';
    if (diff > 0) return 'D-' + diff;
    return 'D+' + (-diff);
  }
  function whenLabel(item, today) {
    if (!item.date) return '수시';
    var t = dayOf(today);
    function short(s) {
      var p = parseDate(s);
      var body = (p.getMonth() + 1) + '.' + p.getDate() + '.';
      if (p.getFullYear() !== t.getFullYear()) return p.getFullYear() + '.' + body;
      return body;
    }
    var a = short(item.date);
    if (item.end && item.end !== item.date) return a + '~' + short(item.end);
    return a;
  }
  function sortItems(items) {
    return items.slice().sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      if (!a.date && !b.date) return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
    });
  }
  function counts(items, today) {
    var c = { over: 0, today: 0, week: 0, later: 0, anytime: 0, done: 0, confirm: 0, open: 0 };
    (items || []).forEach(function (item) {
      var b = bucket(item, today);
      c[b] += 1;
      if (!item.done) {
        c.open += 1;
        if (item.needsConfirm) c.confirm += 1;
      }
    });
    return c;
  }
  function groups(items, today) {
    var bags = {};
    GROUPS.forEach(function (g) { bags[g[0]] = []; });
    sortItems(items || []).forEach(function (item) { bags[bucket(item, today)].push(item); });
    return GROUPS.filter(function (g) { return bags[g[0]].length; }).map(function (g) {
      return { id: g[0], title: g[1], items: bags[g[0]] };
    });
  }

  function add(items, raw) {
    var item = cleanItem(raw);
    if (!item.title) return { ok: false, items: items, item: null };
    if (!item.id || items.some(function (it) { return it.id === item.id; })) item.id = freshId(items);
    return { ok: true, items: items.map(copy).concat([item]), item: item };
  }
  function update(items, id, raw) {
    var found = null;
    var next = items.map(function (it) {
      if (it.id !== id) return copy(it);
      found = cleanItem(Object.assign({}, it, raw, { id: it.id }));
      return found;
    });
    return { ok: !!found && !!found.title, items: found ? next : items, item: found };
  }
  function remove(items, id) {
    return items.filter(function (it) { return it.id !== id; }).map(copy);
  }
  function toggle(items, id) {
    return items.map(function (it) {
      var c = copy(it);
      if (c.id === id) c.done = !c.done;
      return c;
    });
  }

  function sheetTable(items, at) {
    var rows = [HEAD.slice()];
    sortItems(items || []).forEach(function (item) {
      rows.push([
        item.id, item.date, item.end, item.title, item.owner, item.memo,
        item.done ? 'Y' : '', item.needsConfirm ? 'Y' : '', item.confirmNote, at || ''
      ]);
    });
    return rows;
  }
  function postBody(key, rows, stamp) {
    return JSON.stringify({ key: String(key || ''), tab: '남은일정', stamp: String(stamp || ''), rows: rows });
  }
  /* 시트 「남은일정」 탭 줄 → 앱 항목 */
  function fromSheet(rows) {
    return ensureIds((rows || []).map(function (o) {
      return cleanItem({
        id: o['아이디'], date: o['날짜'], end: o['끝날짜'], title: o['할일'], owner: o['담당'], memo: o['메모'],
        done: norm(o['완료']) === 'Y', needsConfirm: norm(o['확인필요']) === 'Y', confirmNote: o['확인메모']
      });
    }).filter(function (it) { return it.title; }));
  }
  function sameItems(a, b) {
    var key = function (list) { return JSON.stringify(sortItems((list || []).map(cleanItem))); };
    return key(a) === key(b);
  }
  function allowedUrl(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(norm(url));
  }
  function stamp() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function readBox(storage) {
    try {
      var raw = storage.getItem(BOX);
      if (!raw) return null;
      var box = JSON.parse(raw);
      if (!box || !Array.isArray(box.items)) return null;
      return {
        items: box.items.map(cleanItem),
        pending: !!box.pending,
        at: box.at || '',
        stamp: box.stamp || ''
      };
    } catch (e) { return null; }
  }
  function writeBox(storage, box) {
    storage.setItem(BOX, JSON.stringify({
      items: (box.items || []).map(cleanItem),
      pending: !!box.pending,
      at: box.at || '',
      stamp: box.stamp || ''
    }));
  }

  /* 구글 시트 웹앱(Apps Script) 부르기. 남은 일정·기숙사가 같이 씀. 주소·열쇠는 기기 저장에서만 받음 */
  function sheetPost(url, body, ms) {
    if (!allowedUrl(url)) return Promise.reject(new Error('link'));
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 20000);
    return fetch(norm(url), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      cache: 'no-store',
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }, function (err) { clearTimeout(timer); throw err; });
  }
  function editorName() {
    var phone = false;
    try { phone = matchMedia('(pointer: coarse)').matches; } catch (e) {}
    return '연습장 ' + (phone ? '폰' : 'PC');
  }
  root.APSheet = { post: sheetPost, editor: editorName };

  root.APSchedule = {
    cleanItem: cleanItem,
    createState: createState,
    hydrate: hydrate,
    serial: serial,
    resolve: resolve,
    bucket: bucket,
    dday: dday,
    whenLabel: whenLabel,
    sortItems: sortItems,
    counts: counts,
    groups: groups,
    add: add,
    update: update,
    remove: remove,
    toggle: toggle,
    sheetTable: sheetTable,
    postBody: postBody,
    allowedUrl: allowedUrl,
    fromSheet: fromSheet,
    sameItems: sameItems,
    stamp: stamp,
    readBox: readBox,
    writeBox: writeBox,
    boxKey: BOX
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
