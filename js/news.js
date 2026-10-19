/* 교육원 소식 줄 읽기. 화면 문장과 기관 내용은 여기 두지 않아요. */
(function (root) {
  'use strict';
  var CATS = ['행사', '과정', '일정변경', '공지', '사진일지', '기타'];

  function idFor(date, title) {
    var s = date + '|' + title;
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'n-' + String(date).replace(/-/g, '') + '-' + h.toString(16);
  }

  function parseSource(raw) {
    var source = String(raw || '').trim();
    var category = '기타';
    var status = '확인됨';
    var m = source.match(/[（(]\s*(행사|과정|일정변경|공지|사진일지|기타)\s*(?:,\s*(?:status\s*)?(확인\s*필요|취소)\s*)?[）)]\s*$/);
    if (m) {
      category = m[1];
      if (m[2] && /취소/.test(m[2])) status = '취소';
      else if (m[2]) status = '확인 필요';
      source = source.slice(0, m.index).trim();
    } else if (/확인\s*필요/.test(source)) status = '확인 필요';
    else if (/취소/.test(source)) status = '취소';
    var link = /^https?:\/\//.test(source) ? source : '';
    return { source: source, source_link: link, category: category, status: status };
  }

  function parseLine(line) {
    var raw = String(line || '').trim();
    if (!raw || raw.charAt(0) === '#') return null;
    var parts = raw.split('|').map(function (s) { return s.trim(); });
    if (parts.length < 3) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parts[0])) return null;
    if (!parts[1]) return null;
    var src = parseSource(parts.slice(3).join(' | '));
    var bot = src.source_link ? '붙여넣기' : (src.source || '붙여넣기');
    return {
      id: idFor(parts[0], parts[1]),
      date: parts[0],
      title: parts[1],
      summary: parts[2] || '',
      source_bot: bot,
      source_link: src.source_link,
      source: src.source_link ? '' : src.source,
      category: src.category,
      status: src.status
    };
  }

  function parsePaste(text) {
    var items = [];
    var skipped = 0;
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (!String(line || '').trim()) return;
      var item = parseLine(line);
      if (!item) { skipped += 1; return; }
      items.push(item);
    });
    return { items: items, skipped: skipped };
  }

  function byNewest(list) {
    return (list || []).slice().sort(function (a, b) {
      if (a.date === b.date) return String(a.title).localeCompare(String(b.title), 'ko');
      return a.date < b.date ? 1 : -1;
    });
  }

  function filterNews(list, f) {
    f = f || {};
    return byNewest(list).filter(function (n) {
      if (!n) return false;
      if (f.category && n.category !== f.category) return false;
      if (f.month && String(n.date || '').slice(0, 7) !== f.month) return false;
      return true;
    });
  }

  var api = { CATS: CATS, idFor: idFor, parseLine: parseLine, parsePaste: parsePaste, byNewest: byNewest, filterNews: filterNews };
  root.APNews = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
