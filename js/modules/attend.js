/* 출석부·서명부 만들기. 엑셀 명단 → A4 출석부/서명부(인쇄·PDF·엑셀).
   명단은 이 화면의 메모리에만 있어요. 어디에도 올리지 않고, localStorage에도 넣지 않고, 화면을 떠나면 지워요. */
(function () {
  'use strict';
  var KEY = 'ap3-attend-form';            // 제목·장소 같은 입력값만 저장(명단은 저장 안 함)
  var HOST = '국립창원대학교 경남항공교육원';
  var STEPS = ['올리기', '열 확인', '서식', '미리보기', '저장'];
  var S = blank();
  var loaded = {};
  var leaveHooked = false;

  function blank() { return { file: null, wb: null, sheet: '', hdr: null, override: {}, roster: null, picked: null, formId: 'attend', sort: 'input', saved: false }; }
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = new URL(src, document.baseURI).href;
      s.onload = function () { res(); };
      s.onerror = function () { delete loaded[src]; rej(new Error(src)); };
      document.body.appendChild(s);
    });
    return loaded[src];
  }
  function forms() { return window.APAttendForms || []; }
  function form() { return forms().filter(function (f) { return f.id === S.formId; })[0] || forms()[0]; }
  function readForm() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } }
  function saveForm(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 저장 공간 없음 */ } }
  function yymmdd(d) { return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function safeName(s) { return String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60); }
  function splitDates(s) { return String(s || '').split(/[,\n、]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  /* 다른 화면으로 가면 명단을 메모리에서도 지워요. */
  function hookLeave() {
    if (leaveHooked) return;
    leaveHooked = true;
    window.addEventListener('hashchange', function () {
      if (!/^#\/attend/.test(location.hash)) {
        var keepForm = S.formId, keepSort = S.sort;
        S = blank(); S.formId = keepForm; S.sort = keepSort;
        var box = document.getElementById('att-print');
        if (box) box.innerHTML = '';
      }
    });
  }

  function render(el, api) {
    hookLeave();
    var esc = api.esc;
    var v = Object.assign({ title: '', when: '', dates: '', sessions: '', place: '', host: HOST, confirm: false }, readForm());
    if (!v.host) v.host = HOST;
    el.classList.add('wide');
    el.innerHTML = '<button class="linkish" id="at-back" type="button">← 더보기</button>' +
      '<section class="hero at-hero"><h1 class="hero-title">출석부·서명부 만들기</h1><p class="muted">엑셀 명단을 넣으면 A4 출석부·서명부를 바로 만들어요.</p>' +
      '<ol class="at-steps" id="at-steps">' + STEPS.map(function (s, i) { return '<li data-step="' + (i + 1) + '"><i>' + (i + 1) + '</i><span>' + s + '</span></li>'; }).join('') + '</ol></section>' +
      '<div class="at-grid"><div class="at-side">' +
      card(1, '명단 올리기', '<p class="at-lock">🔒 파일은 이 기기 밖으로 나가지 않아요. 명단은 저장하지 않고, 화면을 떠나면 지워요.</p>' +
        '<label class="at-drop" id="at-drop"><input id="at-file" type="file" accept=".xlsx,.xls,.csv,.xlsm" hidden>' +
        '<b>엑셀 명단 넣기</b><span class="muted">눌러서 고르거나 여기로 끌어 놓기 · xlsx, xls, csv</span></label><div id="at-info"></div>') +
      card(2, '열 확인', '<div id="at-cols"><p class="muted">명단을 넣으면 위 10줄에서 제목 줄을 찾아 칸을 맞춰 봐요.</p></div>') +
      card(3, '서식·내용', '<div id="at-forms" class="at-forms"></div>' +
        '<div class="row at-sort"><span class="flabel">정렬</span><button class="chip" data-sort="input" type="button">입력 순서</button><button class="chip" data-sort="name" type="button">이름순</button></div>' +
        '<label class="field"><span>제목 (교육·행사명)</span><input type="text" id="at-title" value="' + esc(v.title) + '" placeholder="예: 항공정비 실무교육"></label>' +
        '<label class="field"><span>일시</span><input type="text" id="at-when" value="' + esc(v.when) + '" placeholder="예: 2026. 10. 23.(금) 10:00~"></label>' +
        '<div id="at-sessbox"><label class="field"><span>날짜·회차 (쉼표로 여러 개)</span><input type="text" id="at-dates" value="' + esc(v.dates) + '" placeholder="예: 10.21, 10.22, 10.23"></label>' +
        '<label class="field"><span>날짜를 비우면 칸 수</span><input type="number" id="at-sess" min="1" max="40" value="' + esc(v.sessions) + '" placeholder="서식 기본값"></label></div>' +
        '<label class="field"><span>장소</span><input type="text" id="at-place" value="' + esc(v.place) + '"></label>' +
        '<label class="field"><span>주관</span><input type="text" id="at-host" value="' + esc(v.host) + '"></label>' +
        '<label class="opt"><input type="checkbox" id="at-confirm"' + (v.confirm ? ' checked' : '') + '> 확인자 서명란 넣기</label>') +
      '</div><div class="at-main">' +
      card(4, '미리보기·검산', '<div id="at-check"><p class="muted">명단을 넣으면 인원을 맞춰 봐요.</p></div><div class="at-pv" id="at-pv"></div>') +
      card(5, '저장', '<div class="row at-btns"><button class="btn" id="at-print-btn" type="button" disabled>인쇄 / PDF 저장</button><button class="btn-ghost" id="at-xlsx-btn" type="button" disabled>엑셀로 저장</button></div>' +
        '<p class="muted at-tip">PDF는 인쇄 창에서 ‘PDF로 저장’을 고르세요. 엑셀은 받은 양식 그대로(테두리·인쇄 설정) 채워요.</p><p class="muted" id="at-fname"></p>') +
      '</div></div>';

    el.querySelector('#at-back').onclick = function () { api.go('#/more'); };
    var fileIn = el.querySelector('#at-file');
    var drop = el.querySelector('#at-drop');
    fileIn.onchange = function () { if (fileIn.files[0]) openFile(fileIn.files[0], el, api); fileIn.value = ''; };
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('on'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('on'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('on');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) openFile(f, el, api);
    });
    el.querySelector('#at-forms').innerHTML = forms().map(function (f) {
      return '<button class="at-form" type="button" data-form="' + esc(f.id) + '"><span class="badge ' + (f.kind === '출석부' ? '' : 'ok') + '">' + esc(f.kind) + '</span> <b>' + esc(f.name) + '</b></button>';
    }).join('');
    el.querySelectorAll('[data-form]').forEach(function (b) {
      b.onclick = function () { S.formId = b.getAttribute('data-form'); paint(el, api); };
    });
    el.querySelectorAll('[data-sort]').forEach(function (b) {
      b.onclick = function () { S.sort = b.getAttribute('data-sort'); paint(el, api); };
    });
    ['at-title', 'at-when', 'at-dates', 'at-sess', 'at-place', 'at-host', 'at-confirm'].forEach(function (id) {
      var n = el.querySelector('#' + id);
      n.addEventListener('input', function () { saveForm(values(el)); paint(el, api); });
      n.addEventListener('change', function () { saveForm(values(el)); paint(el, api); });
    });
    el.querySelector('#at-print-btn').onclick = function () { doPrint(el); S.saved = true; steps(el); };
    el.querySelector('#at-xlsx-btn').onclick = function () { doXlsx(el, api); };
    if (S.wb) readSheet(el, api); else paint(el, api);
  }
  function card(n, title, body) {
    return '<section class="card at-card" id="at-step' + n + '"><h2><span class="at-n">' + n + '</span>' + title + '</h2>' + body + '</section>';
  }

  function values(el) {
    function g(id) { var n = el.querySelector('#' + id); return n ? n.value : ''; }
    return { title: g('at-title'), when: g('at-when'), dates: g('at-dates'), sessions: g('at-sess'), place: g('at-place'), host: g('at-host'), confirm: !!(el.querySelector('#at-confirm') || {}).checked };
  }

  function openFile(file, el, api) {
    var info = el.querySelector('#at-info');
    info.innerHTML = '<p class="muted">읽는 중이에요…</p>';
    if (file.size > 20 * 1024 * 1024) { info.innerHTML = '<div class="nobox">파일이 너무 커요(20MB 넘음).</div>'; return; }
    loadScript('js/vendor/xlsx.full.min.js').then(function () {
      return file.arrayBuffer();
    }).then(function (buf) {
      var wb;
      if (/\.csv$/i.test(file.name)) {
        var bytes = new Uint8Array(buf), txt;
        try { txt = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch (e) { txt = new TextDecoder('euc-kr').decode(bytes); }   // 한글 엑셀 csv(CP949)
        wb = XLSX.read(txt.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
      } else {
        wb = XLSX.read(buf, { type: 'array', cellDates: true });
      }
      S.file = file.name; S.wb = wb; S.hdr = null; S.override = {}; S.picked = null; S.saved = false;
      S.sheet = bestSheet(wb);
      readSheet(el, api);
    }).catch(function (e) {
      info.innerHTML = '<div class="nobox">파일을 읽지 못했어요. 암호가 걸린 파일이면 풀고 다시 넣어 주세요. (' + api.esc(e.message || e) + ')</div>';
    });
  }

  function sheetAoa(ws) {
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true, dateNF: 'yyyy.mm.dd' });
  }
  function bestSheet(wb) {
    var best = wb.SheetNames[0], score = -1;
    wb.SheetNames.forEach(function (n) {
      var ws = wb.Sheets[n];
      if (!ws || !ws['!ref']) return;
      var r = APAttend.readRoster(sheetAoa(ws), ws['!merges'], null);
      var s = (r.headerRow >= 0 ? 1000 : 0) + r.rows.filter(function (x) { return x.name; }).length;
      if (s > score) { score = s; best = n; }
    });
    return best;
  }

  function readSheet(el, api) {
    var ws = S.wb.Sheets[S.sheet];
    S.roster = APAttend.readRoster(ws && ws['!ref'] ? sheetAoa(ws) : [], ws ? ws['!merges'] : [], S.hdr, S.override);
    if (!S.picked) {
      var order = ['kind', 'dept', 'grade', 'cls', 'sid', 'name'];
      S.picked = S.roster.cols.filter(function (c) { return order.indexOf(c.field) >= 0; })
        .sort(function (a, b) { return order.indexOf(a.field) - order.indexOf(b.field); })
        .map(function (c) { return c.idx; });
      if (!S.picked.length) S.picked = S.roster.cols.filter(function (c) { return !c.sensitive; }).slice(0, 3).map(function (c) { return c.idx; });
    }
    paintInfo(el, api);
    paint(el, api);
  }

  function paintInfo(el, api) {
    var esc = api.esc, r = S.roster;
    var sens = r.cols.filter(function (c) { return c.sensitive; });
    var h = '<div class="at-file"><span class="badge ok">읽음</span> <b>' + esc(S.file) + '</b>';
    if (S.wb.SheetNames.length > 1) {
      h += '<label class="field"><span>시트</span><select id="at-sheet">' + S.wb.SheetNames.map(function (n) {
        return '<option' + (n === S.sheet ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('') + '</select></label>';
    }
    if (sens.length) h += '<p class="muted">🙈 개인정보 칸 ' + sens.length + '개(' + esc(sens.map(function (c) { return c.label; }).join(', ')) + ')는 읽지 않고 화면·엑셀에도 넣지 않아요.</p>';
    h += '</div>';
    el.querySelector('#at-info').innerHTML = h;
    var sel = el.querySelector('#at-sheet');
    if (sel) sel.onchange = function () { S.sheet = sel.value; S.hdr = null; S.override = {}; S.picked = null; readSheet(el, api); };
  }

  /* 2단계: 제목 줄 + 칸 맞추기(드롭다운) + 위 5줄 미리보기 + 출력할 칸 고르기 */
  function paintCols(el, api) {
    var esc = api.esc, r = S.roster, f = form();
    var usesPicked = f.cols.some(function (c) { return c.kind === 'picked'; });
    var cols = r.cols.filter(function (c) { return !c.sensitive; });
    var opts = [['', '안 씀/기타']].concat(APAttend.FIELDS.map(function (x) { return [x.id, x.label]; }));
    var h = '<div class="row at-hdrrow"><label class="field at-hdr"><span>제목 줄</span><input type="number" id="at-hdr" min="1" max="50" value="' + (r.headerRow >= 0 ? r.headerRow + 1 : '') + '"></label>' +
      '<p class="muted">' + (r.headerRow >= 0 ? (r.headerRow + 1) + '번째 줄을 제목 줄로 찾았어요. 틀리면 숫자를 고치세요.' : '⚠️ 제목 줄(성명·이름 같은 칸)을 못 찾았어요. 몇 번째 줄인지 넣어 주세요.') + '</p></div>';
    h += '<div class="scroll"><table class="plain at-map"><thead><tr>' + cols.map(function (c) {
      return '<th><div class="at-lab">' + esc(c.label) + '</div><select data-map="' + c.idx + '" aria-label="' + esc(c.label) + ' 칸 뜻">' + opts.map(function (o) {
        return '<option value="' + o[0] + '"' + ((c.field || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>' + (usesPicked ? '<label class="at-pick"><input type="checkbox" data-col="' + c.idx + '"' + (S.picked.indexOf(c.idx) >= 0 ? ' checked' : '') + '> 출력</label>' : '') + '</th>';
    }).join('') + '</tr></thead><tbody>';
    for (var i = 0; i < 5; i++) {
      if (!cols.some(function (c) { return c.sample && c.sample[i]; })) break;
      h += '<tr>' + cols.map(function (c) { return '<td>' + esc((c.sample || [])[i] || '') + '</td>'; }).join('') + '</tr>';
    }
    h += '</tbody></table></div>';
    h += usesPicked ? '<p class="muted">‘출력’에 체크한 칸이 ' + esc(f.kind) + '에 들어가요.</p>' : '<p class="muted">이 서식은 칸이 정해져 있어요: ' + esc(f.cols.map(function (c) { return c.label || (c.kind === 'sessions' ? '날짜 칸' : ''); }).filter(Boolean).join(' · ')) + '</p>' + missingNote(f, esc);
    var box = el.querySelector('#at-cols');
    box.innerHTML = h;
    var hdr = box.querySelector('#at-hdr');
    hdr.onchange = function () {
      var n = parseInt(hdr.value, 10);
      S.hdr = n > 0 ? n - 1 : null; S.override = {}; S.picked = null;
      readSheet(el, api);
    };
    box.querySelectorAll('[data-map]').forEach(function (sel) {
      sel.onchange = function () {
        var idx = Number(sel.getAttribute('data-map'));
        S.override[idx] = sel.value;
        if (sel.value === 'name' && S.picked.indexOf(idx) < 0) S.picked.push(idx);
        readSheet(el, api);
      };
    });
    box.querySelectorAll('[data-col]').forEach(function (cb) {
      cb.onchange = function () {
        var idx = Number(cb.getAttribute('data-col'));
        S.picked = S.picked.filter(function (x) { return x !== idx; });
        if (cb.checked) {
          S.picked.push(idx);
          var order = S.roster.cols.map(function (c) { return c.idx; });
          S.picked.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
        }
        paint(el, api);
      };
    });
  }

  function current(el) {
    var v = values(el), f = form();
    var roster = S.roster || { cols: [], rows: [] };
    var t = APAttend.buildTable(f, roster, { picked: S.picked || [], dates: splitDates(v.dates), sessions: parseInt(v.sessions, 10) || 0, sort: S.sort });
    return { v: v, f: f, t: t };
  }

  function steps(el) {
    var done = [!!S.roster, !!(S.roster && S.roster.nameCol >= 0), !!(S.roster && values(el).title), !!(S.roster && S.roster.rows.length), S.saved];
    var now = done.indexOf(false);
    el.querySelectorAll('#at-steps li').forEach(function (li, i) {
      li.classList.toggle('done', done[i]);
      li.classList.toggle('now', i === now);
    });
  }

  function paint(el, api) {
    var esc = api.esc, f = form();
    el.querySelectorAll('[data-form]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-form') === f.id); });
    el.querySelectorAll('[data-sort]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sort') === S.sort); });
    el.querySelector('#at-sessbox').classList.toggle('hidden', !f.sessions);
    var ready = !!(S.roster && S.roster.rows.length);
    el.querySelector('#at-print-btn').disabled = !ready;
    el.querySelector('#at-xlsx-btn').disabled = !ready;
    steps(el);
    if (!S.roster) { el.querySelector('#at-pv').innerHTML = ''; return; }
    paintCols(el, api);
    var cur = current(el);
    var pv = el.querySelector('#at-pv');
    pv.innerHTML = '<div class="at-pvwrap"><div class="at-sheet ' + cur.t.orient + '">' + sheetHtml(cur, esc) + '</div></div>';
    var pages = pageCount(pv, cur.t.orient);   // 줄이기(zoom) 전에 실제 크기로 재요
    fitPreview(pv);
    paintCheck(el, api, cur, pages);
    el.querySelector('#at-fname').textContent = '파일 이름: ' + fileStem(cur) + '.xlsx / .pdf';
  }

  function missingNote(f, esc) {
    var miss = f.cols.filter(function (c) { return c.field && !S.roster.cols.some(function (x) { return x.field === c.field; }); }).map(function (c) { return c.label; });
    return miss.length ? '<p class="muted">명단에 없는 칸은 비워 둬요: ' + esc(miss.join(', ')) + '</p>' : '';
  }

  function paintCheck(el, api, cur, pages) {
    var esc = api.esc, rows = cur.t.rows, n = S.roster.rows.length, lines = cur.t.body.length;
    var ck = APAttend.checks(rows);
    var h = '<div class="at-badges">';
    h += n === lines && n > 0 ? '<span class="at-b ok">명단 ' + n + '명 = 출력 ' + lines + '줄 ✅</span>' : '<span class="at-b no">명단 ' + n + '명 ≠ 출력 ' + lines + '줄 ❌</span>';
    h += ck.blank.length ? '<span class="at-b warn">이름 빈칸 ' + ck.blank.length + ' ⚠️</span>' : '<span class="at-b ok">이름 빈칸 없음</span>';
    h += ck.dup.length ? '<span class="at-b warn">겹치는 이름 ' + ck.dup.length + ' ⚠️</span>' : '<span class="at-b ok">겹치는 이름 없음</span>';
    h += '<span class="at-b">A4 ' + (cur.t.orient === 'landscape' ? '가로' : '세로') + ' · 약 ' + pages + '쪽</span></div>';
    if (S.roster.nameCol < 0) h += '<div class="warnbox">성명·이름 칸을 못 찾았어요. 2단계에서 칸 뜻을 ‘성명’으로 골라 주세요.</div>';
    if (ck.blank.length) h += '<div class="warnbox">이름 빈칸: ' + ck.blank.map(function (i) { return (i + 1) + '번(원본 ' + rows[i]._row + '행)'; }).join(', ') + '</div>';
    if (ck.dup.length) h += '<div class="warnbox">겹치는 이름: ' + ck.dup.map(function (p) { return esc(rows[p[1]].name) + ' (' + (p[0] + 1) + '번·' + (p[1] + 1) + '번)'; }).join(', ') + '</div>';
    var sk = S.roster.skipped, skipped = [];
    if (sk.blank) skipped.push('빈 줄 ' + sk.blank);
    if (sk.header) skipped.push('반복된 제목 줄 ' + sk.header);
    if (sk.total) skipped.push('합계 줄 ' + sk.total);
    if (skipped.length) h += '<p class="muted">건너뜀: ' + skipped.join(', ') + '</p>';
    el.querySelector('#at-check').innerHTML = h;
  }

  /* 쪽수 어림: 미리보기 높이를 A4 한 쪽 높이(여백 뺀 값)로 나눠요. */
  function pageCount(pv, orient) {
    var sheet = pv.querySelector('.at-sheet');
    var table = sheet && sheet.querySelector('table');
    var rows = table ? table.querySelectorAll('tbody tr') : [];
    if (!rows.length) return 1;
    var R = sheet.getBoundingClientRect();
    var mm = R.width / (orient === 'landscape' ? 297 : 210);
    var pageH = ((orient === 'landscape' ? 210 : 297) - 26) * mm;
    var headH = table.querySelector('thead').getBoundingClientRect().height;
    var used = table.getBoundingClientRect().top - R.top - 12 * mm + headH;
    var pages = 1;
    rows.forEach(function (tr) {
      var rh = tr.getBoundingClientRect().height;
      if (used + rh > pageH) { pages += 1; used = headH; }
      used += rh;
    });
    return pages;
  }

  function infoLines(v) {
    var out = [];
    if (v.when) out.push(['일시', v.when]);
    if (v.place) out.push(['장소', v.place]);
    if (v.host) out.push(['주관', v.host]);
    return out;
  }
  function titleOf(cur) { return (cur.v.title ? cur.v.title + ' ' : '') + cur.f.kind; }

  function sheetHtml(cur, esc) {
    var t = cur.t, v = cur.v;
    var cls = 'at-table' + (t.head.length > 16 ? ' dense' : '') + (cur.f.kind === '서명부' ? ' tall' : '');
    var h = '<div class="at-doc"><h1 class="at-h">' + esc(titleOf(cur)) + '</h1><div class="at-meta">' +
      infoLines(v).map(function (p) { return '<div>○ ' + esc(p[0]) + ' : ' + esc(p[1]) + '</div>'; }).join('') + '</div>';
    h += '<table class="' + cls + '"><colgroup>' + t.spec.map(function (s) { return '<col class="c-' + colKind(s) + '">'; }).join('') + '</colgroup><thead><tr>' +
      t.spec.map(function (s) { return '<th class="c-' + colKind(s) + '">' + esc(s.label).replace(/\n/g, '<br>') + '</th>'; }).join('') + '</tr></thead><tbody>';
    t.body.forEach(function (row, i) {
      var r = t.rows[i];
      h += '<tr' + (!r.name ? ' class="flag"' : '') + '>' + row.map(function (c, j) { return '<td class="c-' + colKind(t.spec[j]) + '">' + esc(c) + '</td>'; }).join('') + '</tr>';
    });
    h += '</tbody>';
    if (t.footer === 'countO') {
      var first = t.spec.findIndex(function (s) { return s.session; });
      h += '<tfoot><tr><td colspan="' + Math.max(1, first) + '">출석 인원</td>' + t.spec.slice(Math.max(1, first)).map(function () { return '<td></td>'; }).join('') + '</tr></tfoot>';
    }
    h += '</table>';
    if (v.confirm) h += '<div class="at-confirm">확인자 : ____________________ (서명)</div>';
    h += '<div class="at-total">총 ' + t.body.length + '명</div></div>';
    return h;
  }
  function colKind(s) {
    if (s.src === 'no') return 'no';
    if (s.session) return 'sess';
    if (s.src === 'countO') return 'cnt';
    if (/서명/.test(s.label)) return 'sign';
    if (s.field === 'name' || /성명|이름/.test(s.label)) return 'name';
    return 'txt';
  }

  function fitPreview(pv) {
    var sheet = pv.querySelector('.at-sheet');
    if (!sheet) return;
    sheet.style.zoom = '';
    var z = Math.min(1, (pv.clientWidth - 2) / sheet.offsetWidth);
    sheet.style.zoom = String(z > 0 ? z : 1);
  }

  function doPrint(el) {
    var cur = current(el);
    var box = document.getElementById('att-print');
    if (!box) { box = document.createElement('div'); box.id = 'att-print'; document.body.appendChild(box); }
    box.innerHTML = '<div class="at-sheet print ' + cur.t.orient + '">' + sheetHtml(cur, escHtml) + '</div>';
    var st = document.getElementById('att-page');
    if (!st) { st = document.createElement('style'); st.id = 'att-page'; document.head.appendChild(st); }
    st.textContent = '@page { size: A4 ' + cur.t.orient + '; margin: 12mm 10mm 14mm; @bottom-center { content: counter(page) " / " counter(pages); font-size: 9pt; color: #555; } }';
    document.body.classList.add('att-printing');
    var done = function () {
      document.body.classList.remove('att-printing');
      st.textContent = '';
      box.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    var oldTitle = document.title;
    document.title = fileStem(cur);   // PDF 저장 때 파일 이름
    window.print();
    document.title = oldTitle;   // 인쇄 전용 규칙은 @media print 안에만 있어서 남아 있어도 화면엔 영향 없어요.
  }
  function fileStem(cur) { return yymmdd(new Date()) + '_' + safeName(titleOf(cur)) + '_v01'; }

  function doXlsx(el, api) {
    var btn = el.querySelector('#at-xlsx-btn');
    btn.disabled = true;
    var cur = current(el);
    loadScript('js/vendor/exceljs.min.js').then(function () {
      return cur.f.tpl ? fillTemplate(cur) : buildXlsx(cur);
    }).then(function (buf) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = fileStem(cur) + '.xlsx';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      S.saved = true; steps(el);
      api.toast('엑셀 파일을 받았어요.');
    }).catch(function (e) { api.toast('엑셀을 만들지 못했어요. ' + (e.message || e)); })
      .then(function () { btn.disabled = false; });
  }

  function colNum(letter) { var n = 0; for (var i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64); return n; }
  function fillText(tplStr, cur) {
    var v = cur.v;
    return tplStr.replace(/\{(\w+)\}/g, function (m, k) {
      if (k === 'title') return titleOf(cur);
      if (k === 'title0') return v.title || '';
      if (k === 'kind') return cur.f.kind;
      return v[k] || '';
    });
  }

  /* 받은 빈 양식(forms/*.xlsx)을 그대로 열어 명단만 채워요. 줄이 모자라면 끝 줄 모양을 복사해 늘려요. */
  function fillTemplate(cur) {
    var tp = cur.f.tpl, t = cur.t, v = cur.v;
    return fetch(new URL(tp.file, document.baseURI).href, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('양식 파일 ' + tp.file);
      return res.arrayBuffer();
    }).then(function (buf) {
      var wb = new ExcelJS.Workbook();
      return wb.xlsx.load(buf).then(function () { return wb; });
    }).then(function (wb) {
      var ws = wb.worksheets[0];
      var n = t.rows.length, cap = tp.last - tp.first + 1, extra = Math.max(0, n - cap);
      var maxCol = ws.columnCount;
      for (var r0 = tp.first; r0 <= tp.last; r0++) for (var c0 = 1; c0 <= maxCol; c0++) {
        var cell = ws.getCell(r0, c0);
        if (!cell.isMerged || cell.master === cell) cell.value = null;
      }
      if (extra) {
        var merges = (ws.model.merges || []).slice();
        var rowPat = [], below = [];
        merges.forEach(function (m) {
          var p = m.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
          if (!p) return;
          var r1 = +p[2], r2 = +p[4];
          if (r1 === tp.last && r2 === tp.last) rowPat.push([p[1], p[3]]);
          if (r1 > tp.last) { below.push([p[1], r1, p[3], r2]); ws.unMergeCells(m); }
        });
        ws.duplicateRow(tp.last, extra, true);
        below.forEach(function (b) { ws.mergeCells(b[0] + (b[1] + extra) + ':' + b[2] + (b[3] + extra)); });
        for (var k = 1; k <= extra; k++) rowPat.forEach(function (p) { ws.mergeCells(p[0] + (tp.last + k) + ':' + p[1] + (tp.last + k)); });
        var pa = ws.pageSetup.printArea;
        if (pa) ws.pageSetup.printArea = pa.replace(/(\$?[A-Z]+\$?)(\d+)$/, function (m, col, row) { return col + (Number(row) + extra); });
      }
      var fieldOf = {};
      t.spec.forEach(function (s, j) { fieldOf[s.src === 'no' ? 'no' : (s.field || '')] = j; });
      t.rows.forEach(function (rec, i) {
        var r = tp.first + i;
        Object.keys(tp.map).forEach(function (col) {
          var src = tp.map[col], cell = ws.getCell(col + r);
          if (src === 'no') cell.value = i + 1;
          else if (src.charAt(0) === '=') cell.value = { formula: src.slice(1).replace(/\{r\}/g, r) };
          else cell.value = rec[src] || '';
        });
      });
      if (tp.sum) {
        var sr = tp.sum.row + extra, a = tp.first, b = tp.first + Math.max(n, cap) - 1;
        for (var c = colNum(tp.sum.from); c <= colNum(tp.sum.to); c++) {
          var L = APAttend.colName(c - 1);
          ws.getCell(L + sr).value = { formula: tp.sum.f.replace(/\{c\}/g, L).replace('{a}', a).replace('{b}', b) };
        }
      }
      Object.keys(tp.set || {}).forEach(function (addr) {
        var keys = tp.set[addr].match(/\{(\w+)\}/g) || [];
        var any = keys.some(function (k) { k = k.slice(1, -1); return k === 'title' || k === 'title0' ? !!v.title : !!v[k]; });
        if (any) ws.getCell(addr).value = fillText(tp.set[addr], cur);
      });
      ws.pageSetup.paperSize = 9;
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;
      ws.pageSetup.fitToHeight = 0;
      ws.pageSetup.orientation = cur.f.orient === 'landscape' ? 'landscape' : 'portrait';
      if (tp.titles) ws.pageSetup.printTitlesRow = tp.titles;
      ws.headerFooter = ws.headerFooter || {};
      if (!ws.headerFooter.oddFooter) ws.headerFooter.oddFooter = '&C&P / &N';
      if (tp.sess) {
        var dates = splitDates(v.dates);
        for (var d = 0; d < tp.sess.count; d++) ws.getCell(APAttend.colName(colNum(tp.sess.from) - 1 + d) + (tp.first - 1)).value = tp.sess.label(d, dates[d] || '');
      }
      return wb.xlsx.writeBuffer();
    });
  }

  /* 기본 서식: 양식 파일 없이 새로 만들어요. */
  function buildXlsx(cur) {
    var t = cur.t, v = cur.v, n = t.head.length;
    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet(cur.f.kind, {
      pageSetup: { paperSize: 9, orientation: t.orient, fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 } },
      headerFooter: { oddFooter: '&C&P / &N' }
    });
    var thin = { style: 'thin', color: { argb: 'FF000000' } };
    var border = { top: thin, left: thin, bottom: thin, right: thin };
    var r = 1;
    ws.mergeCells(r, 1, r, n);
    ws.getCell(r, 1).value = titleOf(cur);
    ws.getCell(r, 1).font = { size: 16, bold: true };
    ws.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 30;
    infoLines(v).forEach(function (p) {
      r += 1;
      ws.mergeCells(r, 1, r, n);
      ws.getCell(r, 1).value = '○ ' + p[0] + ' : ' + p[1];
    });
    var hr = r + 2;
    r = hr;
    t.head.forEach(function (lab, j) {
      var c = ws.getCell(r, j + 1);
      c.value = lab;
      c.font = { bold: true };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F6' } };
      c.border = border;
    });
    ws.getRow(r).height = t.head.some(function (x) { return /\n/.test(x); }) ? 32 : 22;
    t.body.forEach(function (row) {
      r += 1;
      row.forEach(function (val, j) {
        var c = ws.getCell(r, j + 1);
        c.value = t.spec[j].src === 'no' ? Number(val) : val;
        c.border = border;
        c.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      });
      ws.getRow(r).height = cur.f.kind === '서명부' ? 28 : 20;
    });
    if (v.confirm) {
      r += 2;
      ws.mergeCells(r, 1, r, n);
      ws.getCell(r, 1).value = '확인자 : ____________________ (서명)';
      ws.getCell(r, 1).alignment = { horizontal: 'right' };
    }
    t.spec.forEach(function (s, j) {
      ws.getColumn(j + 1).width = s.w || ({ no: 5, sess: t.sessions > 12 ? 4.5 : 7, cnt: 7, sign: 16, name: 10, txt: 12 })[colKind(s)];
    });
    ws.pageSetup.printTitlesRow = hr + ':' + hr;
    ws.views = [{ state: 'frozen', ySplit: hr }];
    return wb.xlsx.writeBuffer();
  }

  window.addEventListener('resize', function () { var pv = document.getElementById('at-pv'); if (pv) fitPreview(pv); });
  window.ShellModules.attend = { id: 'attend', tab: '', icon: '', render: render };
})();
