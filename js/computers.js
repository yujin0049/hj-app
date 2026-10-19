/* 컴퓨터 현황 계산과 CSV. 사람 이름과 기관 목록은 여기 두지 않아요. IP 칸은 받지 않아요. */
(function (root) {
  'use strict';
  var FIELDS = ['id', 'affiliation', 'user_type', 'user', 'location', 'purpose', 'maker', 'model', 'made_on', 'purchase_year', 'network', 'os_version', 'replace_when', 'replace_target', 'counted', 'note', 'status'];
  var HEADS = {
    '번호': 'id', 'id': 'id',
    '소속': 'affiliation', 'affiliation': 'affiliation',
    '사용자구분': 'user_type', 'user_type': 'user_type',
    '사용자': 'user', 'user': 'user',
    '위치': 'location', 'location': 'location',
    '용도': 'purpose', 'purpose': 'purpose',
    '제조사': 'maker', 'maker': 'maker',
    '모델': 'model', 'model': 'model',
    '제조일': 'made_on', 'made_on': 'made_on',
    '구입연도': 'purchase_year', 'purchase_year': 'purchase_year',
    '망구분': 'network', 'network': 'network',
    '윈도우버전': 'os_version', 'os': 'os_version', 'os_version': 'os_version',
    '교체시기': 'replace_when', 'replace_when': 'replace_when',
    '교체대상': 'replace_target', 'replace_target': 'replace_target',
    '대수포함': 'counted', 'counted': 'counted',
    '비고': 'note', 'note': 'note',
    '상태': 'status', 'status': 'status'
  };
  var BLOCKED = { ip: 1, 'ip주소': 1, '아이피': 1, 'ip address': 1 };

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function keyPart(s) { return norm(s).toLowerCase(); }
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
  function makeId(num, row) {
    var n = norm(num);
    if (n) return n;
    return 'x-' + hash([row.affiliation, row.user_type, row.location, row.model].map(keyPart).join('|'));
  }
  function dedupeKey(row) {
    return keyPart(row && row.id) + '\n' + keyPart(row && row.location) + '\n' + keyPart(row && row.model);
  }
  function parseMark(raw) {
    var s = norm(raw);
    var note = '';
    var m = s.match(/[（(]([^)）]*)[)）]\s*$/);
    if (m) note = norm(m[1]);
    var head = s.replace(/[（(].*$/, '').trim().toUpperCase();
    var yes = head === 'O' || head === 'Y' || head === 'TRUE' || head === '1' || head === '예' || head === '포함';
    return { yes: yes, present: s.length > 0, note: note };
  }
  function statusOf(os, given) {
    var g = norm(given).replace(/\s+/g, '');
    if (g === '확인됨') return '확인됨';
    if (g === '확인필요') return '확인 필요';
    return norm(os) ? '확인됨' : '확인 필요';
  }
  function blankRow() {
    return {
      id: '', affiliation: '', user_type: '', user: '', location: '', purpose: '',
      maker: '', model: '', made_on: '', purchase_year: '', network: '', os_version: '',
      replace_when: '', replace_target: false, counted: true, note: '', status: ''
    };
  }
  function sanitize(row) {
    var out = blankRow();
    FIELDS.forEach(function (k) {
      if (row && row[k] != null && k !== 'replace_target' && k !== 'counted') out[k] = norm(row[k]);
    });
    out.replace_target = !!(row && row.replace_target);
    out.counted = row && row.counted === false ? false : true;
    out.status = statusOf(out.os_version, out.status);
    out.id = norm(out.id);
    return out;
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
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return norm(x); }); });
  }

  function rowsFromCsv(text) {
    var table = parseCsv(text);
    if (!table.length) return [];
    var map = table[0].map(function (h) { return norm(h).toLowerCase().replace(/\s+/g, ''); });
    var items = [];
    for (var r = 1; r < table.length; r++) {
      var src = blankRow();
      var noteFromCount = '';
      var sawCounted = false;
      var rawId = '';
      for (var c = 0; c < map.length; c++) {
        var head = map[c];
        if (!head || BLOCKED[head]) continue;
        var field = HEADS[head];
        if (!field) continue;
        var val = table[r][c] == null ? '' : table[r][c];
        if (field === 'replace_target') src.replace_target = parseMark(val).yes;
        else if (field === 'counted') {
          var mark = parseMark(val);
          sawCounted = true;
          src.counted = mark.present ? mark.yes : true;
          noteFromCount = mark.note;
        } else if (field === 'id') rawId = val;
        else src[field] = val;
      }
      if (!sawCounted) src.counted = true;
      if (!norm(src.note) && noteFromCount) src.note = noteFromCount;
      src.id = makeId(rawId, src);
      src.status = statusOf(src.os_version, src.status);
      items.push(sanitize(src));
    }
    return items;
  }

  function sameRecord(a, b) {
    var x = sanitize(a);
    var y = sanitize(b);
    return FIELDS.every(function (k) { return String(x[k]) === String(y[k]); });
  }

  function mergeImport(existing, incoming) {
    var rows = (existing || []).map(sanitize);
    var index = {};
    rows.forEach(function (row, i) { index[dedupeKey(row)] = i; });
    function locate(inc) {
      var k = dedupeKey(inc);
      if (index[k] != null) return index[k];
      if (inc.id && inc.id.indexOf('x-') !== 0) {
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].id === inc.id) return i;
        }
      }
      return -1;
    }
    var added = 0;
    var updated = 0;
    var skipped = 0;
    (incoming || []).forEach(function (raw) {
      var inc = sanitize(raw);
      var at = locate(inc);
      if (at < 0) {
        index[dedupeKey(inc)] = rows.length;
        rows.push(inc);
        added += 1;
        return;
      }
      if (sameRecord(rows[at], inc)) { skipped += 1; return; }
      delete index[dedupeKey(rows[at])];
      inc.id = rows[at].id;
      rows[at] = inc;
      index[dedupeKey(inc)] = at;
      updated += 1;
    });
    return { rows: rows, added: added, updated: updated, skipped: skipped };
  }

  function summarize(list) {
    var versions = {};
    var total = 0;
    var unconfirmed = 0;
    var replace = 0;
    var excluded = 0;
    (list || []).forEach(function (raw) {
      var row = sanitize(raw);
      if (!row.counted) { excluded += 1; return; }
      total += 1;
      var v = row.os_version;
      if (!v) unconfirmed += 1;
      else versions[v] = (versions[v] || 0) + 1;
      if (row.replace_target) replace += 1;
    });
    return { total: total, excluded: excluded, versions: versions, unconfirmed: unconfirmed, replace: replace, rows: (list || []).length };
  }

  function filterComputers(list, f) {
    f = f || {};
    return (list || []).filter(function (raw) {
      var row = sanitize(raw);
      if (f.version) {
        var v = row.os_version || '미확인';
        if (v !== f.version) return false;
      }
      if (f.location && row.location !== f.location) return false;
      if (f.replace && !row.replace_target) return false;
      if (f.unconfirmed && row.os_version) return false;
      return true;
    });
  }

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCsv(list) {
    var head = ['번호', '소속', '사용자구분', '사용자', '위치', '제조사', '모델', '제조일', '구입연도', '망구분', '윈도우버전', '교체시기', '교체대상', '대수포함', '비고', '상태'];
    var lines = [head.join(',')];
    (list || []).forEach(function (raw) {
      var row = sanitize(raw);
      var count = row.counted ? 'O' : (row.note ? 'X(' + row.note + ')' : 'X');
      var num = row.id.indexOf('x-') === 0 ? '' : row.id;
      lines.push([
        num, row.affiliation, row.user_type, row.user, row.location, row.maker, row.model, row.made_on,
        row.purchase_year, row.network, row.os_version, row.replace_when, row.replace_target ? 'O' : 'X',
        count, row.counted ? row.note : '', row.status
      ].map(csvCell).join(','));
    });
    return '\uFEFF' + lines.join('\n') + '\n';
  }

  root.APComputers = {
    FIELDS: FIELDS,
    dedupeKey: dedupeKey,
    parseCsv: parseCsv,
    rowsFromCsv: rowsFromCsv,
    mergeImport: mergeImport,
    summarize: summarize,
    filterComputers: filterComputers,
    sanitize: sanitize,
    toCsv: toCsv
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
