/* 실무 > 문서 만들기: 칸 채우면 기안·계획서·카톡 초안 → 복사.
   틀은 public/docgen.json (실제 결재 문서 틀에서 이름·번호·금액 뺀 것).
   입력한 내용은 이 기기(localStorage)에만 남아요. */
(function () {
  var FILE = 'public/docgen.json';
  var BLANK = '【 】';
  var KEY = 'docgen:';
  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  var CIRCLE = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

  /* ── 저장 (이 기기만) ── */
  function load(id) {
    try { var s = localStorage.getItem(KEY + id); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function save(id, st) {
    try { localStorage.setItem(KEY + id, JSON.stringify(st)); } catch (e) { /* 저장 못 해도 화면은 그대로 */ }
  }
  function drop(id) {
    try { localStorage.removeItem(KEY + id); } catch (e) { /* 무시 */ }
  }

  /* ── 숫자·날짜 ── */
  function toNum(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function hasNum(v) { return /\d/.test(String(v == null ? '' : v)); }
  function comma(n) { return Math.round(n).toLocaleString('ko-KR'); }
  /* 10630000 → 일천육십삼만 (공문 금액 한글 표기) */
  function korean(n) {
    n = Math.floor(Math.abs(n));
    if (!n) return '영';
    var d = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    var small = ['', '십', '백', '천'], big = ['', '만', '억', '조'];
    var out = '', g = 0;
    while (n > 0) {
      var part = n % 10000, s = '';
      for (var i = 0; i < 4; i++) {
        var x = Math.floor(part / Math.pow(10, i)) % 10;
        if (x) s = d[x] + small[i] + s;
      }
      if (s) out = s + big[g] + out;
      n = Math.floor(n / 10000);
      g++;
    }
    return out;
  }
  function fmtDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return v || '';
    var dt = new Date(+m[1], +m[2] - 1, +m[3]);
    return m[1] + '. ' + (+m[2]) + '. ' + (+m[3]) + '.(' + DAYS[dt.getDay()] + ')';
  }

  /* ── 상태 ── */
  function freshState(t) {
    var st = { f: {}, t: {}, sep: 'tab' };
    (t.fields || []).forEach(function (f) {
      st.f[f.key] = f.default != null ? f.default : (f.type === 'select' && f.options ? f.options[0] : '');
    });
    (t.tables || []).forEach(function (tb) {
      var rows = (tb.default || []).map(function (r) { return Object.assign({}, r); });
      while (rows.length < (tb.min || 1)) rows.push({});
      st.t[tb.key] = rows;
    });
    return st;
  }
  function stateFor(t) {
    var st = freshState(t), old = load(t.id);
    if (!old) return st;
    if (old.f) Object.keys(st.f).forEach(function (k) { if (old.f[k] != null) st.f[k] = old.f[k]; });
    if (old.t) Object.keys(st.t).forEach(function (k) { if (Array.isArray(old.t[k]) && old.t[k].length) st.t[k] = old.t[k]; });
    if (old.sep) st.sep = old.sep;
    return st;
  }

  /* ── 초안 글 만들기 ── */
  function rowFilled(tb, r) {
    return tb.cols.some(function (c) { return c.type !== 'calc' && String(r[c.key] || '').trim(); });
  }
  function cellText(tb, c, r) {
    var v = r[c.key];
    if (c.type === 'calc' && tb.calc) {
      if (!hasNum(r[tb.calc.a]) || !hasNum(r[tb.calc.b])) return BLANK;
      return comma(toNum(r[tb.calc.a]) * toNum(r[tb.calc.b]));
    }
    v = String(v == null ? '' : v).trim();
    if (!v) return c.opt ? '' : BLANK;
    if (c.type === 'number') return hasNum(v) ? comma(toNum(v)) : v;
    return v;
  }
  function tableSum(tb, rows) {
    if (!tb.sum) return null;
    var any = false, total = 0;
    rows.forEach(function (r) {
      var v;
      if (tb.calc && tb.sum.col === tb.calc.out) {
        if (!hasNum(r[tb.calc.a]) || !hasNum(r[tb.calc.b])) return;
        v = toNum(r[tb.calc.a]) * toNum(r[tb.calc.b]);
      } else {
        if (!hasNum(r[tb.sum.col])) return;
        v = toNum(r[tb.sum.col]);
      }
      any = true;
      total += v;
    });
    return any ? total : null;
  }
  function tableText(tb, rows, sep) {
    var used = rows.filter(function (r) { return rowFilled(tb, r); });
    if (!used.length) used = [{}];
    if (tb.line) {
      return used.map(function (r, i) {
        return tb.line.replace(/\{\{([^}]+)\}\}/g, function (_, k) {
          if (k === 'n') return CIRCLE.charAt(i) || (i + 1) + '.';
          var c = tb.cols.filter(function (x) { return x.key === k; })[0];
          return c ? cellText(tb, c, r) : BLANK;
        });
      }).join('\n');
    }
    var j = sep === 'bar' ? ' | ' : '\t';
    var lines = [tb.cols.map(function (c) { return c.label; }).join(j)];
    var body = used.map(function (r) { return tb.cols.map(function (c) { return cellText(tb, c, r); }).join(j); });
    var tot = null;
    if (tb.total) {
      var sum = tableSum(tb, rows);
      tot = tb.cols.map(function (c, i) {
        if (i === 0) return tb.total.label;
        if (tb.sum && c.key === tb.sum.col) return sum == null ? BLANK : comma(sum);
        return '';
      }).join(j);
    }
    if (tot && tb.total.at === 'top') lines.push(tot);
    lines = lines.concat(body);
    if (tot && tb.total.at !== 'top') lines.push(tot);
    return lines.join('\n');
  }
  function fieldText(f, raw) {
    var v = String(raw == null ? '' : raw);
    if (f.type === 'date') return fmtDate(v.trim());
    if (f.type === 'number') return hasNum(v) ? comma(toNum(v)) : v.trim();
    if (f.type === 'lines') {
      return v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
        .map(function (s) { return (f.prefix || '') + s; }).join('\n');
    }
    if (f.type === 'attach') {
      var items = v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!items.length) return '';
      if (items.length === 1) return '붙임  ' + items[0] + '  끝.';
      return items.map(function (s, i) { return (i ? '      ' : '붙임  ') + (i + 1) + '. ' + s; }).join('\n') + '  끝.';
    }
    return v.trim();
  }
  function build(t, st) {
    var vals = {};
    (t.fields || []).forEach(function (f) { vals[f.key] = fieldText(f, st.f[f.key]); });
    (t.tables || []).forEach(function (tb) {
      var rows = st.t[tb.key] || [];
      vals['표:' + tb.key] = tableText(tb, rows, st.sep);
      if (tb.sum) {
        var s = tableSum(tb, rows);
        vals[tb.sum.key] = s == null ? '' : comma(s);
        vals[tb.sum.key + '글'] = s == null ? '' : korean(s);
      }
    });
    var out = [];
    (t.body || []).forEach(function (line) {
      var skip = false;
      line.replace(/\{\{([^}?]+)\?\}\}/g, function (_, k) { if (!vals[k]) skip = true; return ''; });
      if (skip) return;
      out.push(line.replace(/\{\{([^}?]+)\??\}\}/g, function (_, k) { return vals[k] ? vals[k] : BLANK; }));
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ── 화면: 목록 ── */
  function listView(el, api, W, data) {
    var h = '<section class="card">' + W.backBtn + '<p class="kicker">실무</p><h1>문서 만들기</h1>' +
      '<p class="muted">' + W.esc(data['안내'] || '') + '</p></section>';
    (data.templates || []).forEach(function (t, i) {
      h += '<button class="list-btn w-menu" type="button" style="animation-delay:' + (i * 50) + 'ms" data-id="' + W.esc(t.id) + '">' +
        '<b>' + W.esc(t.title) + '</b><span class="muted">' + W.esc(t['설명'] || '') + '</span></button>';
    });
    el.innerHTML = h;
    W.bindBack(el, api);
    el.querySelectorAll('[data-id]').forEach(function (b) {
      b.onclick = function () { api.go('#/docgen/' + encodeURIComponent(b.getAttribute('data-id'))); };
    });
  }

  /* ── 화면: 칸 채우기 ── */
  function fieldHtml(W, f, v) {
    var id = 'dg-f-' + f.key;
    var lab = '<label class="w-field" for="' + W.esc(id) + '">' + W.esc(f.label) + '</label>';
    var ph = f.placeholder ? ' placeholder="' + W.esc(f.placeholder) + '"' : '';
    var attr = ' id="' + W.esc(id) + '" data-f="' + W.esc(f.key) + '"';
    v = v == null ? '' : v;
    if (f.type === 'textarea' || f.type === 'lines' || f.type === 'attach') {
      return lab + '<textarea' + attr + ph + ' rows="3">' + W.esc(v) + '</textarea>';
    }
    if (f.type === 'select') {
      return lab + '<select' + attr + '>' + (f.options || []).map(function (o) {
        return '<option value="' + W.esc(o) + '"' + (o === v ? ' selected' : '') + '>' + W.esc(o || '— 고르기 —') + '</option>';
      }).join('') + '</select>';
    }
    if (f.type === 'date') return lab + '<input type="date"' + attr + ' value="' + W.esc(v) + '">';
    if (f.type === 'number') return lab + '<input type="text" inputmode="numeric"' + attr + ph + ' value="' + W.esc(v) + '">';
    return lab + '<input type="text"' + attr + ph + ' value="' + W.esc(v) + '">';
  }
  function rowsHtml(W, tb, rows) {
    var h = '';
    rows.forEach(function (r, i) {
      h += '<div style="background:var(--soft);border-radius:14px;padding:10px 12px;margin:8px 0">' +
        '<div class="row" style="justify-content:space-between"><b>' + (i + 1) + '번째 줄</b>' +
        (rows.length > (tb.min || 1) ? '<button type="button" class="linkish" data-del="' + W.esc(tb.key) + '" data-r="' + i + '">빼기</button>' : '') + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0 10px">';
      tb.cols.forEach(function (c) {
        h += '<div style="min-width:0"><span class="w-field" style="margin-top:8px">' + W.esc(c.label) + '</span>';
        if (c.type === 'calc') {
          h += '<div class="w-num" data-calc="' + W.esc(tb.key) + '" data-r="' + i + '" style="min-height:48px;display:flex;align-items:center;font-weight:700">' + W.esc(cellText(tb, c, r)) + '</div>';
        } else {
          h += '<input type="text"' + (c.type === 'number' ? ' inputmode="numeric"' : '') +
            ' data-t="' + W.esc(tb.key) + '" data-r="' + i + '" data-c="' + W.esc(c.key) + '"' +
            (c.placeholder ? ' placeholder="' + W.esc(c.placeholder) + '"' : '') +
            ' value="' + W.esc(r[c.key] == null ? '' : r[c.key]) + '" aria-label="' + W.esc(c.label) + '">';
        }
        h += '</div>';
      });
      h += '</div></div>';
    });
    return h;
  }
  function formHtml(W, t, st) {
    var h = '<section class="card"><p class="kicker">칸 채우기</p>';
    (t.fields || []).forEach(function (f) { h += fieldHtml(W, f, st.f[f.key]); });
    h += '</section>';
    (t.tables || []).forEach(function (tb) {
      h += '<section class="card"><p class="kicker">표</p><h2>' + W.esc(tb.label) + '</h2>' +
        '<div data-rows="' + W.esc(tb.key) + '">' + rowsHtml(W, tb, st.t[tb.key]) + '</div>' +
        '<button type="button" class="btn-ghost small" data-add="' + W.esc(tb.key) + '">+ 줄 더하기</button>' +
        (tb.sum && tb.calc ? '<p style="margin:12px 0 0">합계 <b class="w-num" data-total="' + W.esc(tb.key) + '">0</b>원</p>' : '') +
        '</section>';
    });
    var hasGrid = (t.tables || []).some(function (tb) { return !tb.line; });
    h += '<section class="card"><p class="kicker">초안</p>' +
      '<div class="row" style="justify-content:space-between"><h2 style="margin:0">미리 보기</h2><span class="chip" id="dg-miss"></span></div>' +
      (hasGrid ? '<p class="w-field">표 나누기</p>' + W.seg('sep', [{ v: 'tab', t: '탭 (한글 표로)' }, { v: 'bar', t: '| 줄' }], st.sep) +
        '<p class="muted" style="font-size:.85rem;margin:6px 0 0">탭: 한글에 붙여넣고 [표 → 문자열을 표로] 누르면 표가 돼요. 엑셀에도 칸대로 들어가요.</p>' : '') +
      '<pre class="w-out" id="dg-out" style="overflow-wrap:anywhere;tab-size:4"></pre>' +
      '<div class="row"><button type="button" class="btn" id="dg-copy">복사</button>' +
      '<button type="button" class="btn-ghost" id="dg-clear">비우기</button></div></section>';
    h += '<section class="card"><p class="kicker">주의</p><ul>' + (t['주의'] || []).map(function (s) { return '<li>' + W.esc(s) + '</li>'; }).join('') + '</ul>' +
      '<p class="kicker" style="margin-top:12px">근거 (어느 문서 틀인가)</p><ul>' + (t['근거'] || []).map(function (s) { return '<li class="muted">' + W.esc(s) + '</li>'; }).join('') + '</ul></section>';
    return h;
  }

  function formView(el, api, W, data, t) {
    var st = stateFor(t);
    el.innerHTML = '<section class="card"><button class="linkish" id="dg-back" type="button">← 문서 목록</button>' +
      '<p class="kicker">문서 만들기</p><h1>' + W.esc(t.title) + '</h1><p class="muted">' + W.esc(t['설명'] || '') + '</p>' +
      '<label class="w-field" for="dg-pick">다른 문서로 바꾸기</label><select id="dg-pick">' +
      data.templates.map(function (x) { return '<option value="' + W.esc(x.id) + '"' + (x.id === t.id ? ' selected' : '') + '>' + W.esc(x.title) + '</option>'; }).join('') +
      '</select></section><div id="dg-body"></div>';
    el.querySelector('#dg-back').onclick = function () { api.go('#/docgen'); };
    var bodyEl = el.querySelector('#dg-body');
    var timer = null, saveTimer = null, lastTotals = {};

    function preview() {
      var out = el.querySelector('#dg-out');
      if (!out) return;
      var text = build(t, st);
      out.textContent = text;
      var miss = (text.match(/【 】/g) || []).length;
      var chip = el.querySelector('#dg-miss');
      chip.textContent = miss ? '빈칸 ' + miss + '곳' : '다 채움';
      chip.classList.toggle('on', !miss);
      (t.tables || []).forEach(function (tb) {
        el.querySelectorAll('[data-calc="' + tb.key + '"]').forEach(function (n) {
          var c = tb.cols.filter(function (x) { return x.type === 'calc'; })[0];
          n.textContent = cellText(tb, c, st.t[tb.key][+n.getAttribute('data-r')] || {});
        });
        var tn = el.querySelector('[data-total="' + tb.key + '"]');
        if (tn) {
          var s = tableSum(tb, st.t[tb.key]) || 0;
          if (lastTotals[tb.key] !== s) { lastTotals[tb.key] = s; W.countUp(tn, s, 500); }
        }
      });
      return text;
    }
    function changed() {
      clearTimeout(timer);
      timer = setTimeout(preview, 250);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { save(t.id, st); }, 400);
    }
    function drawRows(key) {
      var tb = t.tables.filter(function (x) { return x.key === key; })[0];
      var box = bodyEl.querySelector('[data-rows="' + key + '"]');
      box.innerHTML = rowsHtml(W, tb, st.t[key]);
      bindRows(box);
    }
    function bindRows(root) {
      root.querySelectorAll('[data-t]').forEach(function (inp) {
        inp.oninput = function () {
          var row = st.t[inp.getAttribute('data-t')][+inp.getAttribute('data-r')];
          if (row) row[inp.getAttribute('data-c')] = inp.value;
          changed();
        };
      });
      root.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-del');
          st.t[k].splice(+b.getAttribute('data-r'), 1);
          drawRows(k);
          changed();
        };
      });
    }
    function bind() {
      bodyEl.querySelectorAll('[data-f]').forEach(function (inp) {
        var ev = inp.tagName === 'SELECT' || inp.type === 'date' ? 'onchange' : 'oninput';
        inp[ev] = function () { st.f[inp.getAttribute('data-f')] = inp.value; changed(); };
      });
      bindRows(bodyEl);
      bodyEl.querySelectorAll('[data-add]').forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-add');
          st.t[k].push({});
          drawRows(k);
          changed();
          var last = bodyEl.querySelectorAll('[data-rows="' + k + '"] [data-t]');
          var nth = st.t[k].length - 1;
          for (var i = 0; i < last.length; i++) if (+last[i].getAttribute('data-r') === nth) { last[i].focus(); break; }
        };
      });
      W.bindSeg(bodyEl, function (name, v) { if (name === 'sep') { st.sep = v; save(t.id, st); preview(); } });
      bodyEl.querySelector('#dg-copy').onclick = function () {
        clearTimeout(timer);
        W.copy(preview());
      };
      bodyEl.querySelector('#dg-clear').onclick = function () {
        if (!window.confirm('이 문서 칸을 모두 처음으로 비울까요?')) return;
        drop(t.id);
        st = freshState(t);
        lastTotals = {};
        W.swap(bodyEl, formHtml(W, t, st), function () { bind(); preview(); });
      };
    }
    el.querySelector('#dg-pick').onchange = function () {
      var id = this.value;
      api.go('#/docgen/' + encodeURIComponent(id));
    };
    W.swap(bodyEl, formHtml(W, t, st), function () { bind(); preview(); });
  }

  function render(el, api) {
    var W = window.WorkUI;
    if (!W) {
      el.innerHTML = '<section class="card"><h1>문서 만들기</h1><p class="muted">실무 화면 파일을 아직 못 읽었어요. 새로고침해 주세요.</p></section>';
      return;
    }
    var hash = location.hash;
    var id = api.route().parts[1] || '';
    el.innerHTML = '<section class="card">' + W.backBtn + '<h1>문서 만들기</h1><p class="muted">틀을 불러오는 중…</p></section>';
    W.bindBack(el, api);
    W.json(FILE).then(function (data) {
      if (location.hash !== hash) return; /* 그새 다른 화면으로 갔으면 그리지 않음 */
      if (!data || !Array.isArray(data.templates)) throw new Error('틀 파일 모양이 달라요');
      var t = id && data.templates.filter(function (x) { return x.id === id; })[0];
      if (t) formView(el, api, W, data, t);
      else listView(el, api, W, data);
    }).catch(function (e) {
      if (location.hash !== hash) return;
      el.innerHTML = '<section class="card">' + W.backBtn + '<h1>문서 만들기</h1>' +
        '<p class="muted">문서 틀을 불러오지 못했어요. 인터넷 연결을 보고 다시 눌러 주세요.</p>' +
        '<p class="muted" style="font-size:.85rem">(' + W.esc(e && e.message || e) + ')</p>' +
        '<button type="button" class="btn" id="dg-retry">다시 불러오기</button></section>';
      W.bindBack(el, api);
      el.querySelector('#dg-retry').onclick = function () { render(el, api); };
    });
  }

  ShellModules.docgen = { id: 'docgen', render: render };
  /* 테스트용 */
  ShellModules.docgen._build = build;
  ShellModules.docgen._korean = korean;
})();
