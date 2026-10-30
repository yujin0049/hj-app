/* 10월 시간외근무수당 원인행위 붙임 (#/ot-attach).
   폴더를 고르면 칸을 확인하고, 빠진 칸이 없을 때만 한 권 PDF를 만들어요.
   브라우저는 F: 에 바로 쓰지 못해서, 저장 창·다운로드와 업무 PC용 bat 을 같이 둡니다.
   공식 PDF에는 봇 표기·볼트 경로를 넣지 않아요. 없는 서류는 빈 종이로 채우지 않아요. */
(function (root) {
  'use strict';
  var C = root.HJOtAttach;
  var CSS = '.ot-steps{margin:8px 0 12px;padding-left:1.2em}.ot-steps li{margin:4px 0}' +
    '.ot-slot{display:flex;gap:8px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)}' +
    '.ot-slot b{display:block}.ot-path{font-weight:700;word-break:break-all}' +
    '.ot-actions{display:flex;flex-direction:column;gap:8px;margin-top:12px}' +
    '.ca-list{list-style:none;margin:8px 0 0;padding:0}.ca-row{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)}' +
    '.ca-no{flex:0 0 28px;height:28px;border-radius:14px;background:var(--navy);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px}' +
    '.ca-row b{display:block;word-break:keep-all}.ca-ref{margin-top:10px}';
  /* 원인행위 종류별 붙임 (유진님 10.30. 17:47 「원인행위 종류별마다 다양해서 글로컬문서에서 찾아봐」).
     자료: data/cause_attach_types.json (글로컬 구비서류 양식 부록 표 그대로). 모르는 칸은 「나중에 업데이트」. */
  var cause = { data: null, failed: false, pick: 'material' };
  var lastBytes = null;
  var view = null;

  function style() {
    if (document.getElementById('ot-style')) return;
    var s = document.createElement('style');
    s.id = 'ot-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function inflate(u8) {
    try {
      if (typeof DecompressionStream !== 'function') return Promise.resolve(null);
      var ds = new DecompressionStream('deflate');
      var stream = new Blob([u8]).stream().pipeThrough(ds);
      return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); }, function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function loadPdfLib() {
    if (root.PDFLib && root.PDFLib.PDFDocument) return Promise.resolve(root.PDFLib.PDFDocument);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = new URL('js/vendor/pdf-lib.min.js?v=26', document.baseURI).href;
      s.onload = function () {
        if (root.PDFLib && root.PDFLib.PDFDocument) res(root.PDFLib.PDFDocument);
        else rej(new Error('pdf'));
      };
      s.onerror = function () { rej(new Error('pdf')); };
      document.body.appendChild(s);
    });
  }
  function mimeOf(name) {
    var ext = C.extOf(name);
    return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' }[ext] || 'application/octet-stream';
  }
  function canvasJpeg(canvas) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (blob) {
        if (!blob) { rej(new Error('jpeg')); return; }
        blob.arrayBuffer().then(function (buf) { res(new Uint8Array(buf)); }, rej);
      }, 'image/jpeg', 0.92);
    });
  }
  function fontsReady() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })]);
  }
  async function rasterImage(bytes, name) {
    var bmp = await createImageBitmap(new Blob([bytes], { type: mimeOf(name) }));
    var canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var s = Math.min(canvas.width / bmp.width, canvas.height / bmp.height);
    var w = bmp.width * s;
    var h = bmp.height * s;
    ctx.drawImage(bmp, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    if (bmp.close) bmp.close();
    return canvasJpeg(canvas);
  }
  async function rasterText(text) {
    if (C.hasForbiddenText(text)) throw new Error('forbidden-text');
    await fontsReady();
    var canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    var ctx = canvas.getContext('2d');
    ctx.font = '28px Pretendard, "Malgun Gothic", sans-serif';
    var maxW = canvas.width - 144;
    var lineH = 40;
    var lines = [];
    String(text).split('\n').forEach(function (row) {
      if (!row) { lines.push(''); return; }
      var cur = '';
      for (var i = 0; i < row.length; i++) {
        var ch = row.charAt(i);
        if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
        else cur += ch;
      }
      if (cur) lines.push(cur);
    });
    var per = Math.floor((canvas.height - 144) / lineH);
    if (per < 1) per = 1;
    var pages = [];
    for (var start = 0; start < lines.length; start += per) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111111';
      ctx.font = '28px Pretendard, "Malgun Gothic", sans-serif';
      var slice = lines.slice(start, start + per);
      for (var n = 0; n < slice.length; n++) ctx.fillText(slice[n], 72, 80 + n * lineH);
      pages.push(await canvasJpeg(canvas));
    }
    if (!pages.length) throw new Error('empty-text');
    return pages;
  }
  function decodeText(bytes) {
    var utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (utf8.indexOf('\uFFFD') < 0) return utf8;
    try {
      var kr = new TextDecoder('euc-kr').decode(bytes);
      if (kr.indexOf('\uFFFD') < 0) return kr;
    } catch (e) { /* 이 브라우저는 euc-kr 이 없을 수 있어요 */ }
    return utf8;
  }
  async function readInputs(fileList) {
    var out = [];
    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      var name = file.webkitRelativePath || file.name;
      var bytes = new Uint8Array(await file.arrayBuffer());
      var rec = { name: name, bytes: bytes };
      if ({ txt: 1, csv: 1, md: 1, html: 1, htm: 1 }[C.extOf(name)]) rec.text = decodeText(bytes);
      out.push(rec);
    }
    return out;
  }
  function downloadPdf(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  async function savePdf(name, bytes) {
    var blob = new Blob([bytes], { type: 'application/pdf' });
    if (root.showSaveFilePicker) {
      try {
        var handle = await root.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
        });
        var writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { how: '저장 창에서 고른 폴더', name: name };
      } catch (e) { /* 저장 창을 닫았거나 열 수 없으면 다운로드로 받아요 */ }
    }
    downloadPdf(name, blob);
    return { how: '브라우저 다운로드 폴더', name: name };
  }
  function badge(state) {
    if (state === 'ready') return '<span class="badge ok">있음</span>';
    if (state === 'missing') return '<span class="badge no">없음</span>';
    return '<span class="badge warn">빼 둠</span>';
  }
  function checklistHtml(esc, slots, extras) {
    var h = '';
    (slots || []).forEach(function (slot) {
      h += '<div class="ot-slot">' + badge(slot.state) + '<div><b>' + esc(slot.label) + '</b>';
      if (slot.file) h += '<div class="item-meta">' + esc(slot.file) + '</div>';
      if (slot.note) h += '<div class="item-meta">' + esc(slot.note) + '</div>';
      h += '</div></div>';
    });
    if (extras && extras.length) {
      h += '<p class="muted">칸에 없어서 넣지 않은 파일: ' + esc(extras.join(', ')) + '</p>';
    }
    return h;
  }
  function emptySlots() {
    return C.SLOTS.map(function (s) {
      return { id: s.id, label: s.label, state: 'missing', note: '폴더를 고르면 확인해요', file: '' };
    });
  }
  function loadCause() {
    if (cause.data || cause.failed) return Promise.resolve(cause.data);
    return fetch(new URL('data/cause_attach_types.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (d) { cause.data = d; return d; }, function () { cause.failed = true; return null; });
  }
  function causeRows(esc, items, later) {
    var h = '<ol class="ca-list">';
    (items || []).forEach(function (x) {
      h += '<li class="ca-row"><span class="ca-no">' + esc(x.no) + '</span><div><b>' + esc(x.name) + '</b>';
      if (x.form) h += '<div class="item-meta">관련 서식: ' + esc(x.form) + '</div>';
      if (x.note) h += '<div class="item-meta">' + esc(x.note) + '</div>';
      if (x.later) h += '<div class="item-meta"><span class="badge warn">' + esc(later) + '</span> ' + esc(x.later) + '</div>';
      h += '</div></li>';
    });
    return h + '</ol>';
  }
  function causeHtml(esc) {
    var h = '<section class="card" id="ca-card"><p class="kicker">원인행위 종류별 붙임</p><h2>종류를 고르면 붙임 서류가 순서대로 나와요</h2>';
    var d = cause.data;
    if (!d) return h + '<p class="muted">' + (cause.failed ? '목록을 불러오지 못했어요.' : '목록을 불러오는 중이에요…') + '</p></section>';
    var t = d.types.filter(function (x) { return x.id === cause.pick; })[0] || d.types[0];
    h += '<label class="field"><span>원인행위 종류</span><select id="ca-type">';
    d.types.forEach(function (x) {
      h += '<option value="' + esc(x.id) + '"' + (x.id === t.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
    });
    h += '</select></label>';
    h += '<p class="muted">' + esc(t.name) + ' · ' + t.items.length + '가지' + (t.listed ? ' · 원문에 번호가 없어 적힌 차례대로 번호를 붙였어요' : '') + '</p>';
    if (t.forms) h += '<p class="muted">관련 서식: ' + esc(t.forms) + '</p>';
    h += causeRows(esc, t.items, d.later);
    if (t.ref) h += '<p class="muted ca-ref"><b>참고</b> ' + esc(t.ref) + '</p>';
    h += '<p class="muted">' + esc(d.footer) + '</p>';
    h += '<p class="muted">출처: ' + esc(d.source) + ' · 쪽: <span class="badge warn">' + esc(d.sourcePage) + '</span></p>';
    (d.notes || []).forEach(function (n) { h += '<p class="muted">' + esc(n) + '</p>'; });
    return h + '</section>';
  }
  function paint(el, api) {
    var esc = api.esc;
    var slots = (view && view.plan && view.plan.slots) || emptySlots();
    var extras = (view && view.plan && view.plan.extras) || [];
    var phase = view ? view.phase : 'idle';
    var h = '<button class="linkish" id="ot-back" type="button">← 홈</button>';
    h += causeHtml(esc);
    h += '<section class="card"><p class="kicker">' + esc(C.TITLE) + '</p><h1>원인행위 붙임 만들기</h1>';
    h += '<ol class="ot-steps"><li>서류 칸이 다 있는지 확인해요.</li>';
    h += '<li>신분증·재직증명서·통장사본은 각각 A4 한 장에 맞춰요.</li>';
    h += '<li>지급내역표에서 봇 표기와 볼트 경로를 빼요.</li>';
    h += '<li>빠진 칸이 없을 때만 한 권의 PDF로 합쳐요.</li></ol>';
    h += '<div class="ot-actions">';
    h += '<button class="btn block" id="ot-pick" type="button"' + (phase === 'work' ? ' disabled' : '') + '>원인행위 붙임 만들기</button>';
    h += '<button class="btn-ghost block" id="ot-files" type="button"' + (phase === 'work' ? ' disabled' : '') + '>파일만 고르기</button>';
    h += '</div>';
    h += '<input id="ot-dir" type="file" webkitdirectory directory multiple hidden>';
    h += '<input id="ot-file" type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.txt,.csv,.md,.html,.htm,application/pdf,image/*">';
    h += '<p class="muted">폴더를 고르면 바로 확인해요. 없는 서류는 빈 종이로 만들지 않아요.</p></section>';
    h += '<section class="card" aria-live="polite"><h2>서류 확인</h2>';
    if (phase === 'work') h += '<p>서류를 확인하고 있어요…</p>';
    if (view && view.message) h += '<div class="' + (view.bad ? 'warnbox' : 'muted') + '">' + esc(view.message) + '</div>';
    h += checklistHtml(esc, slots, extras);
    if (view && view.where) {
      h += '<p><b>결과 파일</b></p><p class="ot-path">' + esc(view.where.name) + '</p>';
      h += '<p class="muted">저장 위치: ' + esc(view.where.how) + '. 이 화면은 F: 드라이브에 바로 쓰지 않아요.</p>';
    }
    if (view && view.notes && view.notes.length) h += '<p class="muted">' + esc(view.notes.join(' ')) + '</p>';
    if (lastBytes && phase !== 'work') h += '<button class="btn-ghost block" id="ot-again" type="button">PDF 다시 받기</button>';
    h += '</section>';
    h += '<section class="card"><h2>업무 PC에서 같은 일</h2>';
    h += '<p>브라우저 안에서는 고른 폴더만 읽어요. F: 에 파일을 직접 만들지 않아요.</p>';
    h += '<p>업무 PC에서는 서류가 있는 폴더에 아래 두 파일을 넣고, bat 을 두 번 누르세요. 그 폴더에 PDF가 생기고, 화면에는 결과 경로가 나와요. 빠진 칸이 있으면 목록만 나와요.</p>';
    h += '<div class="ot-actions">';
    h += '<a class="btn block" href="tools/원인행위_붙임_원클릭.bat" download="원인행위_붙임_원클릭.bat">원인행위_붙임_원클릭.bat 받기</a>';
    h += '<a class="btn-ghost block" href="tools/ot_attach_pack.py" download="ot_attach_pack.py">같은 폴더에 둘 스크립트 받기</a>';
    h += '</div>';
    h += '<p class="muted">사진과 글자 표는 bat 이 합쳐요. PDF 원본은 이 화면에서 폴더를 고르는 쪽이 확실해요.</p></section>';
    el.innerHTML = h;
    el.querySelector('#ot-back').onclick = function () { api.go('#/home'); };
    el.querySelector('#ot-pick').onclick = function () { el.querySelector('#ot-dir').click(); };
    el.querySelector('#ot-files').onclick = function () { el.querySelector('#ot-file').click(); };
    el.querySelector('#ot-dir').onchange = function (e) { onPick(el, api, e.target.files); };
    el.querySelector('#ot-file').onchange = function (e) { onPick(el, api, e.target.files); };
    var sel = el.querySelector('#ca-type');
    if (sel) sel.onchange = function () { cause.pick = sel.value; paint(el, api); };
    var again = el.querySelector('#ot-again');
    if (again) again.onclick = function () { saveAgain(el, api); };
  }
  function saveAgain(el, api) {
    if (!lastBytes || !view || !view.plan) return;
    savePdf(view.plan.outName, lastBytes).then(function (saved) {
      view.where = { how: saved.how, name: saved.name };
      view.message = '붙임을 만들었어요.';
      view.bad = false;
      paint(el, api);
    });
  }
  function onPick(el, api, fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    view = { phase: 'work', plan: view && view.plan, message: '', bad: false, where: null, notes: [] };
    paint(el, api);
    readInputs(files).then(function (inputs) {
      return C.plan(inputs, inflate).then(function (plan) { return { inputs: inputs, plan: plan }; });
    }).then(function (ctx) {
      view.plan = ctx.plan;
      view.notes = [];
      if (!ctx.plan.ok) {
        lastBytes = null;
        view.phase = 'checklist';
        view.bad = true;
        view.message = '빠진 칸이 있어 PDF를 만들지 않았어요. 없는 서류는 빈 종이로 채우지 않아요.';
        view.where = null;
        paint(el, api);
        return null;
      }
      return buildItems(ctx).then(function (items) {
        return loadPdfLib().then(function (PDFDocument) {
          return C.assemble(items, PDFDocument, inflate);
        });
      }).then(function (built) {
        if (!built || !built.ok) {
          lastBytes = null;
          view.phase = 'checklist';
          view.bad = true;
          view.message = (built && built.note) || '붙임을 만들지 않았어요.';
          view.where = null;
          paint(el, api);
          return;
        }
        lastBytes = built.bytes;
        view.notes = built.notes || [];
        return savePdf(ctx.plan.outName, built.bytes).then(function (saved) {
          view.phase = 'done';
          view.bad = false;
          view.where = { how: saved.how, name: saved.name };
          view.message = '붙임을 만들었어요.';
          paint(el, api);
        });
      });
    }).catch(function () {
      lastBytes = null;
      view.phase = 'checklist';
      view.bad = true;
      view.message = '파일을 열지 못해 붙임을 만들지 않았어요.';
      view.where = null;
      paint(el, api);
    });
  }
  async function buildItems(ctx) {
    var items = [];
    for (var i = 0; i < ctx.plan.slots.length; i++) {
      var slot = ctx.plan.slots[i];
      var src = ctx.inputs[slot.index];
      if (!src) throw new Error('missing');
      if (slot.role === 'pay-text') {
        var pages = await rasterText(slot.text);
        pages.forEach(function (jpeg) { items.push({ jpeg: jpeg }); });
      } else if (slot.role === 'pay-image' || slot.role === 'fit-image') {
        if (C.extOf(src.name) === 'jpg' || C.extOf(src.name) === 'jpeg') items.push({ jpeg: src.bytes });
        else items.push({ jpeg: await rasterImage(src.bytes, src.name) });
      } else if (slot.role === 'pay-pdf' || slot.role === 'fit-pdf') {
        items.push({ pdf: src.bytes, fitOne: slot.role === 'fit-pdf', label: slot.label });
      } else throw new Error('role');
    }
    return items;
  }
  function render(el, api) {
    style();
    var tb = document.querySelector('.tabs [data-tab="home"]');
    if (tb) tb.classList.add('on');
    if (!C) {
      el.innerHTML = '<section class="card"><h2>화면을 열지 못했어요</h2></section>';
      return;
    }
    if (!view) view = { phase: 'idle', plan: null, message: '', bad: false, where: null, notes: [] };
    paint(el, api);
    if (!cause.data && !cause.failed) loadCause().then(function () { if (el.isConnected) paint(el, api); });
  }
  if (root.ShellModules) root.ShellModules['ot-attach'] = { id: 'ot-attach', tab: '', render: render };
})(typeof window !== 'undefined' ? window : globalThis);
