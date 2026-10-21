/* 사물함 판: 번호·위치·열쇠 수·상태만 보여요. 이름·학번·전화는 받지도, 저장하지도 않아요.
   자료: data/lockers.json (엑셀봇 CSV → tools/make_lockers.py). 「CSV 넣기」는 이 브라우저 안에서만 읽고
   localStorage 에만 저장해요(어디에도 올리지 않음). 돈(보증금·분실비)은 다루지 않아요. */
(function (root) {
  'use strict';
  var KEY = 'hj-lockers-import';
  var STATUSES = ['빈칸', '사용', '확인 필요', '사용 중지'];
  var ST_CLASS = { '빈칸': 'lk-empty', '사용': 'lk-used', '확인 필요': 'lk-check', '사용 중지': 'lk-off' };
  var COLS = ['번호', '위치', '열쇠수', '상태', '시작일', '반납일'];
  /* 개인정보로 보이는 열 이름 (js/dorm.js DROP 과 같은 목록 + 이름·학번·연락처 등) */
  var DROP = { '전화': 1, '휴대폰': 1, '전화번호': 1, '비밀번호': 1, '암호': 1, '주민번호': 1, '주민등록번호': 1, 'phone': 1, 'ip': 1 };
  DROP['pass' + 'word'] = 1;
  var PII_HEAD = /(이름|성명|성함|학번|학생|사용자|신청자|대여자|전화|휴대폰|핸드폰|연락처|폰|phone|tel|mobile|주민|생년|생일|birth|주소|address|메일|email|계좌|account|은행|bank|비밀번호|암호|name|학과|소속)/i;
  var PII_VAL = [
    ['전화번호', /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/],
    ['주민번호', /\d{6}\s?-\s?[1-4]\d{6}/],
    ['이메일', /[\w.+-]+@[\w-]+\.[\w.]+/]
  ];

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function flat(s) { return norm(s).replace(/\s+/g, '').toLowerCase(); }
  function isPiiHead(h) { var f = flat(h); return !!f && (!!DROP[f] || PII_HEAD.test(f)); }
  function colOf(h) {
    var f = flat(h).replace(/[()]/g, '');
    if (f === '번호' || f === '사물함번호' || f === '사물함') return '번호';
    if (f === '위치' || f === '장소') return '위치';
    if (f === '열쇠수' || f === '열쇠' || f === '열쇠개수' || f === '키' || f === '키수') return '열쇠수';
    if (f === '상태') return '상태';
    if (f === '시작일' || f === '사용시작일' || f === '대여일') return '시작일';
    if (f === '반납일' || f === '반납예정일') return '반납일';
    return '';
  }
  function place(v) {
    var f = flat(v);
    if (!f) return '';
    if (/^5101(호)?$/.test(f)) return '5101호';
    if (/^2층휴게실$|^2층$/.test(f)) return '2층 휴게실';
    var n = norm(v);
    /* 사람 이름이 위치 칸에 들어오는 것을 막아요: 숫자나 장소 글자가 있어야 해요 */
    if (n.length > 20 || !/(\d|휴게실|복도|로비|강의실|사무실|실습동|창고)/.test(n)) return null;
    return n;
  }
  /* 번호: 「12」「12번」「5101-012」「2층-038」 → 「12」「38」. 숫자만 7자리 넘으면(학번 모양) 버려요(null). */
  function lockerNo(v) {
    var n = norm(v).replace(/\s+/g, '').replace(/번$/, '');
    if (!n) return '';
    if (/^\d{7,}$/.test(n)) return null;
    var m = n.match(/^(?:[0-9A-Za-z]{1,5}층?-)?([0-9A-Za-z]{1,4})$/);
    if (!m) return null;
    return /^\d+$/.test(m[1]) ? String(parseInt(m[1], 10)) : m[1].toUpperCase();
  }
  function status(v) {
    var f = flat(v);
    if (f === '빈칸' || f === '빈' || f === '비어있음' || f === '공실' || f === '미사용') return '빈칸';
    if (f === '사용' || f === '사용중' || f === '배정') return '사용';
    if (f === '확인필요' || f === '확인') return '확인 필요';
    if (f === '사용중지' || f === '중지' || f === '고장' || f === '폐쇄') return '사용 중지';
    return null;
  }
  function day(v) {
    var m = norm(v).match(/^(20\d{2})[-./ ]\s*(\d{1,2})[-./ ]\s*(\d{1,2})\.?$/);
    if (!m) return '';
    var p = function (n) { return String(+n).padStart(2, '0'); };
    return m[1] + '-' + p(m[2]) + '-' + p(m[3]);
  }
  function natCmp(a, b) {
    var x = String(a), y = String(b), nx = parseInt(x, 10), ny = parseInt(y, 10);
    if (!isNaN(nx) && !isNaN(ny) && nx !== ny) return nx - ny;
    return x < y ? -1 : x > y ? 1 : 0;
  }

  /* CSV 글자 → 2차원 배열 (따옴표·줄바꿈·BOM 처리) */
  function parseCsv(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    var rows = [], row = [], cell = '', q = false;
    var sep = (text.split(/\r?\n/)[0] || '').indexOf('\t') >= 0 && (text.split(/\r?\n/)[0] || '').indexOf(',') < 0 ? '\t' : ',';
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return norm(x); }); });
  }

  /* 표 → 깨끗한 사물함 목록. 개인정보 열은 버리고 경고를 남겨요. */
  function fromTable(table) {
    var out = { items: [], dropped: [], ignored: [], warnings: [], ok: false };
    if (!table.length) { out.warnings.push('빈 파일이에요.'); return out; }
    var head = table[0], map = [];
    head.forEach(function (h, i) {
      var name = norm(h);
      if (isPiiHead(name)) { out.dropped.push(name); map[i] = ''; return; }
      var c = colOf(name);
      if (!c && name) out.ignored.push(name);
      map[i] = c;
    });
    var need = ['번호', '위치'].filter(function (c) { return map.indexOf(c) < 0; });
    if (need.length) { out.warnings.push('필수 열이 없어요: ' + need.join(', ') + ' (필요한 열: ' + COLS.join(',') + ')'); return out; }
    var blankSt = 0, seen = {}, piiCells = 0, badLoc = 0, badNo = 0, dup = 0, zeroOff = 0, unk = 0, badKey = 0;
    for (var r = 1; r < table.length; r++) {
      var src = {};
      table[r].forEach(function (v, i) {
        if (!map[i]) return;
        var hit = PII_VAL.some(function (p) { return p[1].test(String(v)); });
        if (hit) { piiCells++; return; }
        src[map[i]] = v;
      });
      var no = lockerNo(src['번호']);
      if (no === '') continue;
      if (!no) { badNo++; continue; } /* 7자리 넘는 숫자는 학번일 수 있어 버려요 */
      var loc = place(src['위치']);
      if (!loc) { badLoc++; continue; }
      var id = loc + '|' + no;
      if (seen[id]) { dup++; continue; }
      seen[id] = 1;
      var kraw = norm(src['열쇠수']).replace(/개$/, '');
      var keys = /^\d$/.test(kraw) ? +kraw : null;
      if (keys === null) badKey++;
      var st = status(src['상태']);
      if (!st) { st = '확인 필요'; if (norm(src['상태'])) unk++; else blankSt++; }
      if (keys === null) st = st === '사용 중지' ? st : '확인 필요';
      if (keys === 0 && st !== '사용 중지') { st = '사용 중지'; zeroOff++; }
      out.items.push({ '번호': no, '위치': loc, '열쇠수': keys, '상태': st, '시작일': day(src['시작일']), '반납일': day(src['반납일']) });
    }
    if (out.dropped.length) out.warnings.push('개인정보로 보이는 열을 빼고 넣었어요: ' + out.dropped.join(', '));
    if (piiCells) out.warnings.push('전화번호·주민번호·이메일처럼 보이는 칸 ' + piiCells + '개를 비웠어요.');
    if (badNo) out.warnings.push('사물함 번호가 아닌 것 같은 줄 ' + badNo + '개를 뺐어요(학번일 수 있어요).');
    if (badLoc) out.warnings.push('위치를 알 수 없는 줄 ' + badLoc + '개를 뺐어요.');
    if (dup) out.warnings.push('같은 위치·번호가 겹친 줄 ' + dup + '개는 첫 줄만 썼어요.');
    if (zeroOff) out.warnings.push('열쇠 0개 사물함 ' + zeroOff + '개는 「사용 중지」로 바꿨어요.');
    if (badKey) out.warnings.push('열쇠 수가 비었거나 이상한 ' + badKey + '개는 「확인 필요」로 뒀어요.');
    if (blankSt) out.warnings.push('상태가 빈 ' + blankSt + '개는 「확인 필요」로 뒀어요.');
    if (unk) out.warnings.push('상태 글자를 알 수 없는 ' + unk + '개는 「확인 필요」로 뒀어요.');
    if (out.ignored.length) out.warnings.push('쓰지 않는 열은 무시했어요: ' + out.ignored.join(', '));
    out.ok = out.items.length > 0;
    if (!out.ok) out.warnings.push('넣을 사물함이 없어요.');
    return out;
  }

  function summarize(items) {
    var by = {}, all = { total: 0, keys: { 0: 0, 1: 0, 2: 0, u: 0 } };
    STATUSES.forEach(function (s) { all[s] = 0; });
    items.forEach(function (it) {
      var l = by[it['위치']];
      if (!l) { l = by[it['위치']] = { total: 0, keys: { 0: 0, 1: 0, 2: 0, u: 0 } }; STATUSES.forEach(function (s) { l[s] = 0; }); }
      [l, all].forEach(function (o) {
        o.total++; o[it['상태']]++;
        var k = it['열쇠수'];
        if (k == null) o.keys.u++; else o.keys[k >= 2 ? 2 : k]++;
      });
    });
    return { by: by, all: all };
  }
  /* 배정 추천: 빈칸 중 열쇠 2개(이상) 먼저, 그다음 1개. 0개는 사용 중지라 안 나와요. */
  function recommend(items, loc) {
    return items.filter(function (it) {
      return it['상태'] === '빈칸' && it['열쇠수'] >= 1 && (!loc || it['위치'] === loc);
    }).sort(function (a, b) {
      var ka = Math.min(a['열쇠수'], 2), kb = Math.min(b['열쇠수'], 2);
      if (ka !== kb) return kb - ka;
      if (a['위치'] !== b['위치']) return a['위치'] < b['위치'] ? -1 : 1;
      return natCmp(a['번호'], b['번호']);
    });
  }
  /* sections: 자료(lockers.json sections)에 적힌 위치는 칸이 0개여도 늘 보여 줘요(예: 2층 학생 사물함, T053) */
  function locations(items, sections) {
    var order = ['엔진실습실 1층', '엔진실습실 2층', '5101호', '2층 휴게실'], seen = {};
    (sections || []).forEach(function (sc) { if (sc && sc['위치']) seen[sc['위치']] = 1; });
    items.forEach(function (it) { seen[it['위치']] = 1; });
    var rest = Object.keys(seen).filter(function (l) { return order.indexOf(l) < 0; }).sort();
    return order.filter(function (l) { return seen[l]; }).concat(rest);
  }

  root.APLockers = { locations: locations, lockerNo: lockerNo, parseCsv: parseCsv, fromTable: fromTable, summarize: summarize, recommend: recommend, isPiiHead: isPiiHead, STATUSES: STATUSES, COLS: COLS };

  /* ---------- 화면 ---------- */
  var seed = null, view = { loc: '', st: '', sel: '', more: false, report: null };
  var CSS = [
    '.lk-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:10px 0 0;font-size:.88rem;color:var(--ink-2)}',
    '.lk-legend span{display:inline-flex;align-items:center;gap:6px}',
    '.lk-sw{width:18px;height:18px;border-radius:6px;display:inline-block;border:2px solid transparent}',
    '.lk-filters{display:grid;gap:8px;margin-top:12px}',
    '.lk-filters .chips{flex-wrap:nowrap}',
    '.card .chip{background:var(--soft)}.card .chip.on{background:var(--navy)}',
    '.lk-loc{margin:18px 0 0}.lk-loc h2{display:flex;align-items:baseline;gap:8px;margin:0 0 4px;font-size:1.15rem}',
    '.lk-loc h2 small{font-size:.85rem;color:var(--muted);font-weight:600}',
    '.lk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:6px;margin-top:10px}',
    '.lk-cell{position:relative;aspect-ratio:1/1;min-height:44px;border-radius:12px;border:2px solid transparent;font-weight:800;font-size:.95rem;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;font-variant-numeric:tabular-nums;letter-spacing:-.03em}',
    '.lk-cell .k{position:absolute;right:3px;bottom:2px;font-size:10px;line-height:1;font-weight:800;opacity:.85}',
    '.lk-cell.sel{outline:3px solid var(--ink);outline-offset:1px}',
    '.lk-empty,.lk-sw.lk-empty{background:#fff;border-color:var(--ok);color:var(--ok)}',
    '.lk-used,.lk-sw.lk-used{background:var(--navy);color:#fff}',
    '.lk-check,.lk-sw.lk-check{background:var(--warnbg);border-color:var(--warn);color:var(--warn)}',
    '.lk-off,.lk-sw.lk-off{background:repeating-linear-gradient(135deg,#E5E8EB 0 6px,#F2F4F6 6px 12px);color:#8B95A1}',
    '.lk-sum{width:100%;border-collapse:collapse;font-size:.92rem;font-variant-numeric:tabular-nums}',
    '.lk-sum th,.lk-sum td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}',
    '.lk-sum th:first-child,.lk-sum td:first-child{text-align:left}',
    '.lk-sum thead th{color:var(--muted);font-weight:700;font-size:.82rem}',
    '.lk-rec{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.lk-rec button{border:0;border-radius:12px;background:var(--soft);padding:8px 10px;font-weight:700;min-height:44px;cursor:pointer}',
    '.lk-rec button i{font-style:normal;color:var(--ok);font-size:.8rem;margin-left:4px}',
    '.lk-rec button.k1 i{color:var(--warn)}',
    '.lk-detail{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:8px 0 0}',
    '.lk-detail dt{color:var(--muted)}.lk-detail dd{margin:0;font-weight:700}',
    '.lk-file{display:block;margin-top:10px}',
    '.lk-file input{width:100%;min-height:48px;padding:10px;border-radius:12px;background:var(--soft);border:1px dashed #C9CFD6}',
    '.lk-warn li{margin:2px 0}',
    '.lk-top{display:grid;gap:12px}',
    '.lk-statgrid{grid-template-columns:repeat(2,1fr)}',
    '@media(min-width:720px){.lk-statgrid{grid-template-columns:repeat(4,1fr)}.lk-top{grid-template-columns:1fr 1fr}.lk-top .card{margin:0}.lk-filters{grid-template-columns:auto 1fr;align-items:center}}',
    '@media(min-width:720px){.lk-grid{grid-template-columns:repeat(auto-fill,minmax(52px,1fr))}}'
  ].join('\n');
  function style() {
    if (document.getElementById('lk-style')) return;
    var s = document.createElement('style'); s.id = 'lk-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function saved() {
    try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && Array.isArray(j.items) ? j : null; } catch (e) { return null; }
  }
  function loadSeed() {
    if (seed) return Promise.resolve(seed);
    return fetch(new URL('data/lockers.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('lockers.json'); return r.json(); })
      .then(function (j) { seed = j && Array.isArray(j.items) ? j : { items: [] }; return seed; });
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function paint(el, api) {
    var mine = saved();
    var data = mine || seed || { items: [] };
    var items = data.items;
    var sum = summarize(items), secs = Array.isArray(data.sections) ? data.sections : [], locs = locations(items, secs);
    var secNote = function (l) { var sc = secs.filter(function (x) { return x && x['위치'] === l; })[0]; return sc && sc.note ? sc.note : ''; };
    var zero = { total: 0, '빈칸': 0, '사용': 0, '확인 필요': 0, '사용 중지': 0 };
    if (view.loc && locs.indexOf(view.loc) < 0) view.loc = '';
    var scope = view.loc ? (sum.by[view.loc] || sum.all) : sum.all;
    var e = api.esc;
    var h = '<button class="linkish" id="back" type="button">← 더보기</button>';
    h += '<section class="card"><p class="kicker">사물함 판</p><h1>사물함</h1>' +
      '<p class="muted">번호·위치·열쇠 수·상태만 보여요. 이름·학번·전화는 넣지 않아요. 돈은 받지 않는 방식이에요.</p>';
    if (mine) h += '<div class="okbox" id="lk-src">이 기기에 넣은 CSV예요 · ' + e(String(mine.at || '').slice(0, 16).replace('T', ' ')) + ' · ' + items.length + '개</div>';
    else if (data.assumed) h += '<div class="warnbox" id="lk-assumed"><b>아직 확인 전 자료예요' + (data.version ? ' (' + e(data.version) + ')' : '') + '.</b> ' + e(data.note || '열쇠함 사진 확인 후 v02로 갱신할 예정이에요.') + '</div>';
    else if (data.sample) h += '<div class="warnbox" id="lk-sample"><b>예시 데이터예요.</b> 실제 사물함이 아니에요. 엑셀봇이 만든 CSV를 넣으면 바뀌어요.</div>';
    h += '<div class="statgrid lk-statgrid" style="margin-top:12px">' +
      '<div><b id="n-empty">' + scope['빈칸'] + '</b><span>빈 사물함</span></div>' +
      '<div><b id="n-used">' + scope['사용'] + '</b><span>사용</span></div>' +
      '<div><b id="n-check">' + scope['확인 필요'] + '</b><span>확인 필요</span></div>' +
      '<div><b id="n-off">' + scope['사용 중지'] + '</b><span>사용 중지</span></div></div>' +
      '<p class="muted" style="margin:10px 0 0" id="n-scope">' + e(view.loc || '전체') + ' ' + scope.total + '개 · 열쇠 2개 ' + scope.keys[2] + ' · 1개 ' + scope.keys[1] + ' · 0개 ' + scope.keys[0] + (scope.keys.u ? ' · 모름 ' + scope.keys.u : '') + '</p>' +
      '<div class="lk-legend" aria-label="색 설명">' + STATUSES.map(function (s) { return '<span><i class="lk-sw ' + ST_CLASS[s] + '"></i>' + s + '</span>'; }).join('') +
      '<span class="muted">모서리 숫자 = 열쇠 수</span></div></section>';

    /* 위치별 표 */
    h += '<section class="card"><h2 style="margin:0 0 6px">위치별 현황</h2><div class="scroll"><table class="lk-sum" id="lk-sum"><thead><tr><th>위치</th><th>전체</th><th>빈칸</th><th>사용</th><th>확인 필요</th><th>사용 중지</th></tr></thead><tbody>';
    locs.forEach(function (l) {
      var s = sum.by[l] || zero;
      h += '<tr data-loc="' + e(l) + '"><td><b>' + e(l) + '</b></td><td>' + s.total + '</td><td>' + s['빈칸'] + '</td><td>' + s['사용'] + '</td><td>' + s['확인 필요'] + '</td><td>' + s['사용 중지'] + '</td></tr>';
    });
    h += '<tr><td><b>합계</b></td><td>' + sum.all.total + '</td><td>' + sum.all['빈칸'] + '</td><td>' + sum.all['사용'] + '</td><td>' + sum.all['확인 필요'] + '</td><td>' + sum.all['사용 중지'] + '</td></tr></tbody></table></div></section>';

    /* 배정 추천 + 선택 정보 */
    var rec = recommend(items, view.loc);
    var r2 = rec.filter(function (x) { return x['열쇠수'] >= 2; }).length;
    var shown = view.more ? rec : rec.slice(0, 12);
    h += '<div class="lk-top"><section class="card" id="lk-rec-card"><h2 style="margin:0">배정 추천</h2>' +
      '<p class="muted" style="margin:4px 0 0">빈 사물함 중 열쇠 2개(학생 1·행정실 1)부터, 그다음 1개짜리예요. 열쇠 0개는 사용 중지라 빼요.</p>' +
      '<p style="margin:8px 0 0" id="rec-n"><b>' + rec.length + '개</b> <span class="muted">열쇠 2개 ' + r2 + ' · 1개 ' + (rec.length - r2) + '</span></p>' +
      '<div class="lk-rec" id="lk-rec">' + shown.map(function (x) {
        var k = Math.min(x['열쇠수'], 2);
        return '<button type="button" class="k' + k + '" data-pick="' + e(x['위치'] + '|' + x['번호']) + '">' + e(x['위치']) + ' ' + e(x['번호']) + '번<i>열쇠 ' + x['열쇠수'] + '</i></button>';
      }).join('') + '</div>' +
      (rec.length > 12 ? '<button class="btn-ghost small block" style="margin-top:8px" id="rec-more" type="button">' + (view.more ? '접기' : '모두 보기 (' + rec.length + '개)') + '</button>' : '') +
      (rec.length ? '' : '<p class="muted" id="rec-none">' + (scope.keys.u === scope.total ? '열쇠 수가 아직 비어 있어 추천할 수 없어요. 열쇠 수가 채워지면(v02) 바로 보여요.' : '추천할 빈 사물함이 없어요.') + '</p>') + '</section>';
    var sel = view.sel && items.filter(function (x) { return x['위치'] + '|' + x['번호'] === view.sel; })[0];
    h += '<section class="card" id="lk-detail-card"><h2 style="margin:0">' + (sel ? e(sel['위치']) + ' ' + e(sel['번호']) + '번' : '사물함 고르기') + '</h2>';
    if (sel) {
      var late = sel['상태'] === '사용' && sel['반납일'] && sel['반납일'] < today();
      h += '<dl class="lk-detail" id="lk-detail"><dt>상태</dt><dd><span class="lk-sw ' + ST_CLASS[sel['상태']] + '" style="width:12px;height:12px;vertical-align:-1px"></span> ' + e(sel['상태']) + '</dd>' +
        '<dt>열쇠</dt><dd>' + (sel['열쇠수'] == null ? '확인 필요' : sel['열쇠수'] + '개') + '</dd>' +
        '<dt>시작일</dt><dd>' + e(sel['시작일'] || '-') + '</dd><dt>반납일</dt><dd>' + e(sel['반납일'] || '-') + (late ? ' <span class="badge warn">반납일 지남</span>' : '') + '</dd></dl>';
      if (sel['열쇠수'] === 0) h += '<p class="muted" style="margin:8px 0 0">열쇠가 없어 사용 중지예요. 새 열쇠는 예산 문제라 따로 정해요.</p>';
    } else h += '<p class="muted" style="margin:6px 0 0">판에서 번호를 누르면 열쇠 수와 날짜가 보여요.</p>';
    h += '</section></div>';

    /* 거르기 + 판 */
    h += '<section class="card"><h2 style="margin:0">사물함 판</h2><div class="lk-filters">' +
      '<span class="muted">위치</span><div class="chips" id="f-loc">' + [''].concat(locs).map(function (l) {
        return '<button type="button" class="chip' + (view.loc === l ? ' on' : '') + '" data-loc="' + e(l) + '">' + e(l || '전체') + '</button>';
      }).join('') + '</div>' +
      '<span class="muted">상태</span><div class="chips" id="f-st">' + [''].concat(STATUSES).map(function (s) {
        return '<button type="button" class="chip' + (view.st === s ? ' on' : '') + '" data-st="' + e(s) + '">' + e(s || '전체') + (s ? ' ' + scope[s] : '') + '</button>';
      }).join('') + '</div></div>';
    var visible = 0;
    locs.filter(function (l) { return !view.loc || l === view.loc; }).forEach(function (l) {
      var list = items.filter(function (x) { return x['위치'] === l && (!view.st || x['상태'] === view.st); })
        .sort(function (a, b) { return natCmp(a['번호'], b['번호']); });
      visible += list.length;
      h += '<div class="lk-loc" data-board="' + e(l) + '"><h2>' + e(l) + ' <small>' + list.length + '개' + (view.st ? ' · ' + e(view.st) : '') + '</small></h2>';
      if (!list.length) h += '<p class="muted"' + (secNote(l) ? ' data-empty-section' : '') + '>' + e(secNote(l) && !items.some(function (x) { return x['위치'] === l; }) ? secNote(l) : '해당하는 사물함이 없어요.') + '</p>';
      else h += '<div class="lk-grid">' + list.map(function (x) {
        var id = x['위치'] + '|' + x['번호'];
        var k = x['열쇠수'] == null ? '?' : x['열쇠수'];
        return '<button type="button" class="lk-cell ' + ST_CLASS[x['상태']] + (view.sel === id ? ' sel' : '') + '" data-locker="' + e(id) + '" data-st="' + e(x['상태']) + '" data-keys="' + k + '" aria-label="' + e(x['위치'] + ' ' + x['번호'] + '번, ' + x['상태'] + ', 열쇠 ' + k + '개') + '">' + e(x['번호']) + '<span class="k">' + k + '</span></button>';
      }).join('') + '</div>';
      h += '</div>';
    });
    h += '<p class="muted" style="margin:12px 0 0" id="n-visible">보이는 사물함 ' + visible + '개</p></section>';

    /* CSV 넣기 */
    h += '<section class="card" id="lk-import"><h2 style="margin:0">CSV 넣기</h2>' +
      '<p class="muted" style="margin:4px 0 0">엑셀봇이 만든 CSV(' + COLS.join(',') + ')를 고르세요. 이 브라우저 안에서만 읽고 이 기기에만 저장해요. 어디에도 올리지 않아요.</p>' +
      '<p class="muted" style="margin:4px 0 0">이름·학번·전화 같은 열이 있으면 빼고 넣어요.</p>' +
      '<label class="lk-file"><input type="file" id="lk-csv" accept=".csv,.tsv,.txt,text/csv"></label>';
    if (view.report) {
      var rp = view.report;
      h += '<div class="' + (rp.dropped.length || !rp.ok ? 'warnbox' : 'okbox') + '" id="lk-report" style="margin-top:10px">' +
        (rp.ok ? '<b>' + rp.items.length + '개 넣었어요.</b>' : '<b>넣지 못했어요.</b>') +
        (rp.warnings.length ? '<ul class="lk-warn" style="margin:6px 0 0;padding-left:18px">' + rp.warnings.map(function (w) { return '<li>' + e(w) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }
    h += '<div class="row" style="margin-top:10px;gap:8px;display:flex;flex-wrap:wrap">' +
      '<button class="btn-ghost small" type="button" id="lk-template" style="flex:1">빈 양식 CSV 받기</button>' +
      (mine ? '<button class="btn-navy small" type="button" id="lk-reset" style="flex:1">넣은 CSV 지우고 기본 자료 보기</button>' : '') + '</div></section>';

    el.innerHTML = h;
    bind(el, api);
  }

  function bind(el, api) {
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelectorAll('#f-loc [data-loc]').forEach(function (b) { b.onclick = function () { view.loc = b.getAttribute('data-loc'); view.more = false; paint(el, api); }; });
    el.querySelectorAll('#f-st [data-st]').forEach(function (b) { b.onclick = function () { view.st = b.getAttribute('data-st'); paint(el, api); }; });
    el.querySelectorAll('[data-locker]').forEach(function (b) {
      b.onclick = function () {
        view.sel = b.getAttribute('data-locker'); paint(el, api);
        var d = el.querySelector('#lk-detail-card'); if (d && window.innerWidth < 720) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };
    });
    el.querySelectorAll('[data-pick]').forEach(function (b) {
      b.onclick = function () {
        view.sel = b.getAttribute('data-pick'); view.st = ''; paint(el, api);
        var c = el.querySelector('[data-locker="' + view.sel.replace(/"/g, '\\"') + '"]'); if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' });
      };
    });
    var more = el.querySelector('#rec-more'); if (more) more.onclick = function () { view.more = !view.more; paint(el, api); };
    var reset = el.querySelector('#lk-reset');
    if (reset) reset.onclick = function () {
      if (!confirm('이 기기에 넣은 사물함 CSV를 지우고 기본 자료로 돌아갈까요?')) return;
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
      view.report = null; view.sel = ''; view.loc = ''; view.st = '';
      loadSeed().catch(function () { seed = { items: [] }; }).then(function () { api.toast('기본 자료로 돌아왔어요.'); paint(el, api); });
    };
    el.querySelector('#lk-template').onclick = function () {
      var csv = '\uFEFF' + COLS.join(',') + '\n1,5101호,2,빈칸,,\n2,2층 휴게실,1,사용,2026-09-01,2027-02-26\n';
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = '사물함_양식.csv'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    el.querySelector('#lk-csv').onchange = function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { api.toast('파일이 너무 커요(2MB 넘음).'); return; }
      f.arrayBuffer().then(function (buf) {
        var text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
        catch (e) { text = new TextDecoder('euc-kr').decode(buf); } /* 엑셀 기본 저장(CP949) */
        var rp = fromTable(parseCsv(text));
        view.report = { ok: rp.ok, items: rp.items, dropped: rp.dropped, warnings: rp.warnings };
        if (rp.ok) {
          try {
            localStorage.setItem(KEY, JSON.stringify({ at: new Date().toISOString(), items: rp.items, dropped: rp.dropped }));
            view.sel = ''; view.loc = ''; view.st = '';
            api.toast(rp.dropped.length ? '개인정보 열을 빼고 넣었어요.' : rp.items.length + '개 넣었어요.');
          } catch (e) { view.report.ok = false; view.report.warnings.push('이 기기 저장 공간이 꽉 찼어요.'); }
        }
        paint(el, api);
        var r = el.querySelector('#lk-report'); if (r) r.scrollIntoView({ block: 'center' });
      });
    };
  }

  function render(el, api) {
    style();
    el.classList.add('wide');
    var tb = document.querySelector('.tabs [data-tab="more"]'); /* 더보기 탭 밑 화면 (app.js 안 건드림) */
    if (tb) tb.classList.add('on');
    if (saved()) { paint(el, api); loadSeed().catch(function () { /* 넣은 CSV로 계속 봐요 */ }); return; }
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    loadSeed().then(function () { paint(el, api); }).catch(function () {
      seed = { items: [] }; paint(el, api);
      api.toast('사물함 자료 파일을 불러오지 못했어요. CSV를 넣어 주세요.');
    });
  }

  if (root.ShellModules) root.ShellModules.lockers = { id: 'lockers', tab: '사물함', render: render };
})(typeof window !== 'undefined' ? window : globalThis);
