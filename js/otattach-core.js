/* 10월 시간외근무수당 원인행위 붙임 — 화면 없는 계산.
   서류 칸 확인, 지급내역표에서 봇 표기 빼기, 공식 PDF에 그 표기가 없는지 검사.
   빠진 칸은 목록만 내고 빈 종이를 만들지 않아요. node 시험: tests/otattach_core.test.js */
(function (root) {
  'use strict';
  var OUT_NAME = '2026-10_시간외근무수당_원인행위붙임.pdf';
  var TITLE = '10월 시간외근무수당';
  var A4W = 595.28;
  var A4H = 841.89;
  /* 공식 PDF에 들어가면 안 되는 낱말. 화면 설명용이고, 결과 파일 바이트에 남기면 실패로 봐요. */
  var PHRASES = ['만든봇', '봇공유', '원본경로', '박스경로', '자동생성', '봇메모', '봇교훈', '봇 메모', '99 봇/', '99 봇\\', 'obsidian://'];
  var SLOTS = [
    { id: 'pay', label: '지급내역표', kind: 'clean', keys: ['지급내역표', '지급내역', '지급조서'] },
    { id: 'idcard', label: '신분증', kind: 'fit', keys: ['신분증', '주민등록증', 'idcard'] },
    { id: 'employ', label: '재직증명서', kind: 'fit', keys: ['재직증명서', '재직증명', 'employment'] },
    { id: 'bank', label: '통장사본', kind: 'fit', keys: ['통장사본', '통장', 'bankbook'] }
  ];
  var IMAGE_EXT = { jpg: 1, jpeg: 1, png: 1, webp: 1, gif: 1, bmp: 1 };
  var TEXT_EXT = { txt: 1, csv: 1, md: 1, html: 1, htm: 1 };
  var PDF_EXT = { pdf: 1 };

  function baseName(name) {
    var parts = String(name || '').split(/[/\\]/);
    return parts[parts.length - 1] || '';
  }
  function extOf(name) {
    var b = baseName(name);
    var i = b.lastIndexOf('.');
    return i >= 0 ? b.slice(i + 1).toLowerCase() : '';
  }
  function ignored(name) {
    var b = baseName(name).toLowerCase();
    if (!b || b.charAt(0) === '.') return true;
    if (b === 'desktop.ini' || b === 'thumbs.db') return true;
    if (b === OUT_NAME.toLowerCase()) return true;
    if (b === 'ot_attach_pack.py' || b === '원인행위_붙임_원클릭.bat') return true;
    return false;
  }
  function pureU8(b) {
    if (!b) return new Uint8Array(0);
    var u;
    if (b instanceof Uint8Array) u = b;
    else if (ArrayBuffer.isView(b)) u = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    else if (b instanceof ArrayBuffer) u = new Uint8Array(b);
    else return new Uint8Array(0);
    var out = new Uint8Array(u.byteLength);
    out.set(u);
    return out;
  }
  function utf8Bytes(s) {
    return new TextEncoder().encode(s);
  }
  function indexOfBytes(hay, needle, from) {
    if (!needle || !needle.length || hay.length < needle.length) return -1;
    var start = from || 0;
    var last = hay.length - needle.length;
    for (var i = start; i <= last; i++) {
      var ok = true;
      for (var j = 0; j < needle.length; j++) {
        if (hay[i + j] !== needle[j]) { ok = false; break; }
      }
      if (ok) return i;
    }
    return -1;
  }
  function hasForbiddenText(s) {
    var t = String(s || '');
    for (var i = 0; i < PHRASES.length; i++) if (t.indexOf(PHRASES[i]) >= 0) return true;
    return false;
  }
  function bytesHaveForbidden(bytes) {
    var u = pureU8(bytes);
    for (var i = 0; i < PHRASES.length; i++) {
      var p = PHRASES[i];
      if (indexOfBytes(u, utf8Bytes(p)) >= 0) return true;
      if (indexOfBytes(u, utf16Bytes(p, true)) >= 0) return true;
      if (indexOfBytes(u, utf16Bytes(p, false)) >= 0) return true;
    }
    return false;
  }
  function utf16Bytes(s, le) {
    var out = new Uint8Array(s.length * 2);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (le) { out[i * 2] = c & 255; out[i * 2 + 1] = c >> 8; }
      else { out[i * 2] = c >> 8; out[i * 2 + 1] = c & 255; }
    }
    return out;
  }
  function isMetaLine(line) {
    var t = String(line || '').trim();
    if (!t) return false;
    if (hasForbiddenText(t)) return true;
    if (/^(만든봇|자동생성|원본경로|박스경로|전환본|전환일|개인정보)\s*[:：]/.test(t)) return true;
    if (/봇\s*메모/.test(t)) return true;
    if (/^(source|tags|vault)\s*:/i.test(t)) return true;
    return false;
  }
  function htmlToText(s) {
    return String(s || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|h\d|li|table|thead|tbody)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
  function stripFrontMatter(text) {
    if (text.slice(0, 3) !== '---') return { text: text, dropped: 0 };
    var end = text.indexOf('\n---', 3);
    if (end < 0) return { text: text, dropped: 0 };
    var block = text.slice(0, end);
    if (!hasForbiddenText(block) && !/^(만든봇|자동생성|원본경로|박스경로|전환본|전환일)\s*[:：]/m.test(block)) {
      return { text: text, dropped: 0 };
    }
    var rest = text.slice(end + 4).replace(/^\r?\n/, '');
    return { text: rest, dropped: block.split(/\n/).length };
  }
  function cleanPayText(raw) {
    var text = String(raw || '').replace(/^\uFEFF/, '');
    var dropped = 0;
    text = text.replace(/<!--[\s\S]*?-->/g, function (m) {
      dropped += m.split('\n').length;
      return '';
    });
    if (/<\/?[a-z][^>]*>/i.test(text)) text = htmlToText(text);
    var fm = stripFrontMatter(text);
    text = fm.text;
    dropped += fm.dropped;
    var lines = text.split(/\r?\n/);
    var out = [];
    lines.forEach(function (line) {
      if (isMetaLine(line)) { dropped += 1; return; }
      out.push(line.replace(/[ \t]+$/g, ''));
    });
    while (out.length && !String(out[0]).trim()) out.shift();
    while (out.length && !String(out[out.length - 1]).trim()) out.pop();
    var joined = out.join('\n').trim();
    if (hasForbiddenText(joined)) return { text: '', dropped: dropped + out.length, blocked: true };
    return { text: joined, dropped: dropped, blocked: false };
  }
  function matchSlot(name) {
    var norm = String(name || '').toLowerCase().replace(/\\/g, '/');
    var base = norm.split('/').pop();
    var best = null;
    var bestScore = -1;
    SLOTS.forEach(function (slot, order) {
      slot.keys.forEach(function (k) {
        var key = k.toLowerCase();
        var inBase = base.indexOf(key) >= 0;
        var inPath = norm.indexOf(key) >= 0;
        if (!inBase && !inPath) return;
        var score = key.length * 10 + (inBase ? 5 : 0) - order * 0.01;
        if (score > bestScore) { best = slot; bestScore = score; }
      });
    });
    return best;
  }
  function decodeUtf8(bytes) {
    try { return new TextDecoder('utf-8', { fatal: false }).decode(pureU8(bytes)); }
    catch (e) { return ''; }
  }
  function isWs(c) { return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d; }
  function dictBefore(u8, streamAt) {
    var end = streamAt;
    while (end > 0 && isWs(u8[end - 1])) end--;
    if (end < 2 || u8[end - 1] !== 0x3e || u8[end - 2] !== 0x3e) return '';
    var from = Math.max(0, end - 4000);
    var start = -1;
    for (var i = end - 2; i > from; i--) {
      if (u8[i] === 0x3c && u8[i + 1] === 0x3c) { start = i; break; }
    }
    if (start < 0) return '';
    var s = '';
    for (var j = start; j < end; j++) s += String.fromCharCode(u8[j]);
    return s;
  }
  function filtersOf(dict) {
    var m = /\/Filter\s*(\[[^\]]+\]|\/[A-Za-z]+)/.exec(dict || '');
    if (!m) return [];
    var names = m[1].match(/\/([A-Za-z]+)/g) || [];
    return names.map(function (n) { return n.slice(1); });
  }
  function lengthOf(dict) {
    var m = /\/Length\s+(\d+)/.exec(dict || '');
    if (!m) return null;
    var rest = dict.slice(m.index + m[0].length, m.index + m[0].length + 8);
    if (/^\s+\d+\s+R/.test(rest)) return null;
    return parseInt(m[1], 10);
  }
  function listStreams(u8) {
    var streamKey = utf8Bytes('stream');
    var endKey = utf8Bytes('endstream');
    var streams = [];
    var pos = 0;
    while (pos < u8.length) {
      var at = indexOfBytes(u8, streamKey, pos);
      if (at < 0) break;
      if (at >= 3 && u8[at - 3] === 0x65 && u8[at - 2] === 0x6e && u8[at - 1] === 0x64) {
        pos = at + streamKey.length;
        continue;
      }
      var dict = dictBefore(u8, at);
      var dataStart = at + streamKey.length;
      if (u8[dataStart] === 0x0d && u8[dataStart + 1] === 0x0a) dataStart += 2;
      else if (u8[dataStart] === 0x0a || u8[dataStart] === 0x0d) dataStart += 1;
      var len = lengthOf(dict);
      var data;
      if (len != null) {
        if (len < 0 || dataStart + len > u8.length) return { error: true, streams: streams };
        data = u8.subarray(dataStart, dataStart + len);
        pos = dataStart + len;
      } else {
        var end = indexOfBytes(u8, endKey, dataStart);
        if (end < 0) return { error: true, streams: streams };
        var dataEnd = end;
        if (dataEnd > dataStart && u8[dataEnd - 1] === 0x0a) dataEnd--;
        if (dataEnd > dataStart && u8[dataEnd - 1] === 0x0d) dataEnd--;
        data = u8.subarray(dataStart, dataEnd);
        pos = end + endKey.length;
      }
      streams.push({ filters: filtersOf(dict), data: data });
    }
    return { error: false, streams: streams };
  }
  async function scanPdf(bytes, inflate) {
    var u8 = pureU8(bytes);
    if (u8.length < 8) return { forbidden: false, unverified: true };
    if (bytesHaveForbidden(u8)) return { forbidden: true, unverified: false };
    var parsed = listStreams(u8);
    if (parsed.error) return { forbidden: false, unverified: true };
    for (var i = 0; i < parsed.streams.length; i++) {
      var st = parsed.streams[i];
      var unknown = st.filters.some(function (f) { return f !== 'FlateDecode' && f !== 'DCTDecode'; });
      if (unknown) return { forbidden: false, unverified: true };
      if (st.filters.indexOf('FlateDecode') < 0) continue;
      if (typeof inflate !== 'function') return { forbidden: false, unverified: true };
      var out = null;
      try { out = await inflate(st.data); } catch (e) { out = null; }
      if (out == null) return { forbidden: false, unverified: true };
      if (bytesHaveForbidden(out)) return { forbidden: true, unverified: false };
    }
    return { forbidden: false, unverified: false };
  }
  function reject(note) { return { state: 'rejected', note: note, role: '', text: '', dropped: 0 }; }
  async function judge(slot, file, inflate) {
    var ext = extOf(file.name);
    var bytes = file.bytes ? pureU8(file.bytes) : new Uint8Array(0);
    if (slot.kind === 'fit') {
      if (!bytes.length) return reject('빈 파일은 넣지 않았어요');
      if (IMAGE_EXT[ext]) return { state: 'ready', note: 'A4 한 장에 맞춰요', role: 'fit-image', text: '', dropped: 0 };
      if (PDF_EXT[ext]) {
        var scan = await scanPdf(bytes, inflate);
        if (scan.forbidden) return reject('봇 표기나 볼트 경로가 있어 넣지 않았어요');
        if (scan.unverified) return reject('안을 확인하지 못해 넣지 않았어요');
        return { state: 'ready', note: 'A4 한 장에 맞춰요', role: 'fit-pdf', text: '', dropped: 0 };
      }
      return reject('사진이나 PDF만 A4 한 장으로 맞춰요');
    }
    if (TEXT_EXT[ext]) {
      var text = file.text != null ? String(file.text) : decodeUtf8(bytes);
      var cleaned = cleanPayText(text);
      if (!cleaned.text) return reject(cleaned.blocked || cleaned.dropped ? '봇 표기를 빼면 남는 내용이 없어요' : '표 내용이 없어요');
      var note = cleaned.dropped ? ('봇 표기 ' + cleaned.dropped + '줄을 뺐어요') : '표만 남겼어요';
      return { state: 'ready', note: note, role: 'pay-text', text: cleaned.text, dropped: cleaned.dropped };
    }
    if (!bytes.length) return reject('빈 파일은 넣지 않았어요');
    if (IMAGE_EXT[ext]) return { state: 'ready', note: '표 그림만 넣어요', role: 'pay-image', text: '', dropped: 0 };
    if (PDF_EXT[ext]) {
      var scan2 = await scanPdf(bytes, inflate);
      if (scan2.forbidden) return reject('봇 표기나 볼트 경로가 있어 넣지 않았어요');
      if (scan2.unverified) return reject('안을 확인하지 못해 넣지 않았어요');
      return { state: 'ready', note: '표 PDF를 넣어요', role: 'pay-pdf', text: '', dropped: 0 };
    }
    return reject('PDF, 사진, txt, csv 만 붙여요');
  }
  async function plan(files, inflate) {
    var list = [];
    (files || []).forEach(function (f, i) {
      var name = String((f && f.name) || '');
      if (!name || ignored(name)) return;
      list.push({ index: i, name: name, bytes: f.bytes || null, text: f.text != null ? f.text : null });
    });
    var groups = {};
    SLOTS.forEach(function (s) { groups[s.id] = []; });
    var extras = [];
    list.forEach(function (f) {
      var slot = matchSlot(f.name);
      if (!slot) extras.push(baseName(f.name));
      else groups[slot.id].push(f);
    });
    var slots = [];
    for (var s = 0; s < SLOTS.length; s++) {
      var slot = SLOTS[s];
      var cands = groups[slot.id].slice().sort(function (a, b) {
        return baseName(a.name).localeCompare(baseName(b.name), 'ko');
      });
      if (!cands.length) {
        slots.push({ id: slot.id, label: slot.label, state: 'missing', note: '이 칸이 없어요', file: '', index: -1, role: '', text: '', dropped: 0, fitOne: slot.kind === 'fit' });
        continue;
      }
      var evals = [];
      for (var c = 0; c < cands.length; c++) {
        var judged = await judge(slot, cands[c], inflate);
        evals.push({
          index: cands[c].index,
          file: baseName(cands[c].name),
          state: judged.state,
          note: judged.note,
          role: judged.role,
          text: judged.text || '',
          dropped: judged.dropped || 0
        });
      }
      var ready = evals.filter(function (e) { return e.state === 'ready'; });
      var chosen = ready[0] || evals[0];
      var skipped = evals.filter(function (e) { return e !== chosen; }).map(function (e) { return e.file; });
      var note = chosen.note || '';
      if (skipped.length) note = (note ? note + ' ' : '') + '같은 칸의 다른 파일은 넣지 않았어요: ' + skipped.join(', ');
      slots.push({
        id: slot.id,
        label: slot.label,
        state: chosen.state,
        note: note,
        file: chosen.file,
        index: chosen.index,
        role: chosen.state === 'ready' ? chosen.role : '',
        text: chosen.state === 'ready' ? chosen.text : '',
        dropped: chosen.dropped || 0,
        fitOne: slot.kind === 'fit'
      });
    }
    var ok = slots.every(function (slot) { return slot.state === 'ready'; });
    return { ok: ok, checklistOnly: !ok, outName: OUT_NAME, title: TITLE, slots: slots, extras: extras };
  }
  function concatBytes(parts) {
    var n = 0;
    for (var i = 0; i < parts.length; i++) n += parts[i].length;
    var out = new Uint8Array(n);
    var o = 0;
    for (var j = 0; j < parts.length; j++) { out.set(parts[j], o); o += parts[j].length; }
    return out;
  }
  /* JPEG 주석·EXIF(APP1~APP15)을 빼요. 그림 알갱이는 그대로라 봇 표기만 떨어집니다. */
  function stripJpegMeta(bytes) {
    var u = pureU8(bytes);
    if (u.length < 4 || u[0] !== 0xFF || u[1] !== 0xD8) return u;
    var parts = [u.subarray(0, 2)];
    var i = 2;
    while (i + 1 < u.length) {
      if (u[i] !== 0xFF) break;
      var marker = u[i + 1];
      if (marker === 0xFF) { i++; continue; }
      if (marker === 0xD9) { parts.push(u.subarray(i, i + 2)); break; }
      if (marker === 0xDA) { parts.push(u.subarray(i)); break; }
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
        parts.push(u.subarray(i, i + 2));
        i += 2;
        continue;
      }
      if (i + 3 >= u.length) break;
      var len = (u[i + 2] << 8) | u[i + 3];
      if (len < 2 || i + 2 + len > u.length) break;
      var skip = marker === 0xFE || (marker >= 0xE1 && marker <= 0xEF);
      if (!skip) parts.push(u.subarray(i, i + 2 + len));
      i += 2 + len;
    }
    return concatBytes(parts);
  }
  function drawImageFit(doc, img) {
    var page = doc.addPage([A4W, A4H]);
    var s = Math.min(A4W / img.width, A4H / img.height);
    var w = img.width * s;
    var h = img.height * s;
    page.drawImage(img, { x: (A4W - w) / 2, y: (A4H - h) / 2, width: w, height: h });
  }
  function drawPageFit(doc, ep) {
    var page = doc.addPage([A4W, A4H]);
    var s = Math.min(A4W / ep.width, A4H / ep.height);
    var w = ep.width * s;
    var h = ep.height * s;
    page.drawPage(ep, { x: (A4W - w) / 2, y: (A4H - h) / 2, xScale: s, yScale: s });
  }
  async function assemble(items, PDFDocument, inflate) {
    try {
      if (!PDFDocument || !items || !items.length) return { ok: false, note: '붙일 서류가 없어요' };
      var doc = await PDFDocument.create();
      doc.setTitle(' ');
      doc.setAuthor(' ');
      doc.setSubject(' ');
      doc.setKeywords([]);
      doc.setProducer(' ');
      doc.setCreator(' ');
      var notes = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        if (item.jpeg) {
          var jpg = stripJpegMeta(item.jpeg);
          if (bytesHaveForbidden(jpg)) return { ok: false, note: '붙임에 봇 표기가 남아 만들지 않았어요' };
          drawImageFit(doc, await doc.embedJpg(jpg));
        } else if (item.pdf) {
          var scan = await scanPdf(item.pdf, inflate);
          if (scan.forbidden) return { ok: false, note: '봇 표기나 볼트 경로가 있어 넣지 않았어요' };
          if (scan.unverified) return { ok: false, note: '안을 확인하지 못해 넣지 않았어요' };
          var src = await PDFDocument.load(pureU8(item.pdf), { ignoreEncryption: true });
          var pages = src.getPages();
          if (!pages.length) return { ok: false, note: '빈 PDF는 넣지 않았어요' };
          var n = item.fitOne ? 1 : pages.length;
          if (item.fitOne && pages.length > 1) notes.push((item.label || '작은 서류') + '은 여러 장 중 첫 장만 A4 한 장에 맞췄어요');
          var embedded = await doc.embedPages(pages.slice(0, n));
          for (var p = 0; p < embedded.length; p++) drawPageFit(doc, embedded[p]);
        } else return { ok: false, note: '붙일 내용이 없어요' };
      }
      var bytes = pureU8(await doc.save({ useObjectStreams: false }));
      if (bytesHaveForbidden(bytes)) return { ok: false, note: '붙임에 봇 표기가 남아 만들지 않았어요' };
      if (indexOfBytes(bytes, utf8Bytes('pdf-lib')) >= 0) return { ok: false, note: '붙임에 도구 표기가 남아 만들지 않았어요' };
      return { ok: true, bytes: bytes, notes: notes };
    } catch (e) {
      return { ok: false, note: '파일을 열지 못해 붙임을 만들지 않았어요' };
    }
  }

  var api = {
    OUT_NAME: OUT_NAME,
    TITLE: TITLE,
    PHRASES: PHRASES,
    SLOTS: SLOTS,
    A4W: A4W,
    A4H: A4H,
    baseName: baseName,
    extOf: extOf,
    ignored: ignored,
    matchSlot: matchSlot,
    cleanPayText: cleanPayText,
    isMetaLine: isMetaLine,
    hasForbiddenText: hasForbiddenText,
    bytesHaveForbidden: bytesHaveForbidden,
    stripJpegMeta: stripJpegMeta,
    scanPdf: scanPdf,
    plan: plan,
    assemble: assemble,
    pureU8: pureU8
  };
  root.HJOtAttach = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
