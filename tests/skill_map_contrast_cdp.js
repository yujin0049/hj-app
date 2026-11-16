#!/usr/bin/env node
/* Headless Chrome computed-style contrast for #/skill-map (inside #sm). */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.SM_CHROME || '/usr/bin/google-chrome';
const MIN = 4.5;

function mime(f) {
  if (f.endsWith('.js')) return 'application/javascript';
  if (f.endsWith('.css')) return 'text/css';
  if (f.endsWith('.json')) return 'application/json';
  if (f.endsWith('.html')) return 'text/html';
  if (f.endsWith('.svg')) return 'image/svg+xml';
  if (f.endsWith('.woff2')) return 'font/woff2';
  if (f.endsWith('.webmanifest')) return 'application/manifest+json';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(u.pathname);
      if (rel === '/') rel = '/index.html';
      const fp = path.normalize(path.join(ROOT, rel));
      if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(fp, (err, buf) => {
        if (err) { res.writeHead(404); res.end('no'); return; }
        res.writeHead(200, { 'Content-Type': mime(fp), 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
    srv.on('error', reject);
  });
}

function waitPort(port, ms) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 500 }, (r) => {
        let b = '';
        r.on('data', (c) => { b += c; });
        r.on('end', () => resolve(b));
      });
      req.on('error', () => {
        if (Date.now() - t0 > ms) reject(new Error('cdp timeout'));
        else setTimeout(tryOnce, 100);
      });
    };
    tryOnce();
  });
}

async function cdpSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pend = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pend.has(msg.id)) {
      const { res, rej } = pend.get(msg.id);
      pend.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const n = ++id;
    pend.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return { ws, send };
}

const MEASURE = `(() => {
  function parse(s) {
    if (!s) return null;
    const m = String(s).match(/rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)(?:\\s*,\\s*([\\d.]+))?/i);
    if (!m) return null;
    const a = m[4] == null ? 1 : Number(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  function blend(fg, bg) {
    const a = fg[3] == null ? 1 : fg[3];
    if (a >= 0.999) return [fg[0], fg[1], fg[2]];
    return [0,1,2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a)));
  }
  function lin(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function lum(rgb) {
    return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  }
  function ratio(fg, bg) {
    const L1 = lum(fg), L2 = lum(bg);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function hex(rgb) {
    return '#' + rgb.slice(0,3).map((n) => Math.round(n).toString(16).padStart(2,'0')).join('');
  }
  function opaqueBg(el) {
    let e = el;
    const stack = [];
    while (e && e !== document.documentElement) {
      const st = getComputedStyle(e);
      const bg = parse(st.backgroundColor);
      if (bg && bg[3] > 0.01) stack.push(bg);
      if (bg && bg[3] >= 0.99) break;
      e = e.parentElement;
    }
    let acc = [242, 244, 246];
    for (let i = stack.length - 1; i >= 0; i--) acc = blend(stack[i], acc);
    return acc;
  }
  const root = document.querySelector('#sm');
  if (!root) return { error: 'no #sm', rows: [] };
  const nodes = Array.from(root.querySelectorAll('textarea, input, select, button, p, h1, h2, h3, label, small, span, div, li, section, header'));
  const rows = [];
  function add(el, color, bg, label, extra) {
    if (!color || color[3] < 0.08) return;
    const bg3 = bg;
    const op = parseFloat(getComputedStyle(el).opacity || '1');
    let fg = blend(color, bg3);
    if (op < 0.999) fg = blend([fg[0], fg[1], fg[2], op], bg3);
    const r = ratio(fg, bg3);
    rows.push(Object.assign({
      label, ratio: Math.round(r * 100) / 100,
      fg: hex(fg), bg: hex(bg3), pass: r >= 4.5
    }, extra || {}));
  }
  nodes.forEach((el, i) => {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return;
    const bg = opaqueBg(el);
    const color = parse(st.color);
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && String(el.className).trim()) ? '.' + String(el.className).trim().replace(/\\s+/g, '.') : '';
    const text = (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') ? (el.value || el.placeholder || '') : (el.childNodes && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()) ? el.textContent.trim().slice(0, 40) : '');
    if (tag === 'textarea' || tag === 'input' || tag === 'select' || (text && (tag === 'button' || tag === 'p' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'label' || tag === 'small' || tag === 'span' || tag === 'div'))) {
      if (tag === 'textarea' || tag === 'input' || tag === 'select' || text) {
        add(el, color, bg, tag + id + cls, { text: text.slice(0, 40) });
      }
    }
    if (tag === 'textarea' || tag === 'input') {
      let ph = null;
      try { ph = getComputedStyle(el, '::placeholder').color; } catch (e) { ph = null; }
      if (ph) add(el, parse(ph), bg, tag + id + '::placeholder', { text: el.placeholder || '' });
    }
  });
  return { rows, textarea: (() => {
    const el = document.querySelector('#sm-text');
    if (!el) return null;
    const st = getComputedStyle(el);
    const bg = opaqueBg(el);
    const fg = parse(st.color);
    const fg3 = blend(fg, bg);
    return { ratio: Math.round(ratio(fg3, bg) * 100) / 100, fg: hex(fg3), bg: hex(bg), value: el.value };
  })() };
})()`;

(async () => {
  const srv = await startServer();
  const port = srv.address().port;
  const cdpPort = 19222 + Math.floor(Math.random() * 1000);
  const profile = '/tmp/sm-contrast-profile-' + process.pid;
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + cdpPort,
    '--remote-allow-origins=*',
    '--user-data-dir=' + profile,
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  chrome.stderr.on('data', (d) => { err += d; });
  try {
    await waitPort(cdpPort, 15000);
    const tabs = await new Promise((res, rej) => {
      http.get({ host: '127.0.0.1', port: cdpPort, path: '/json/list' }, (r) => {
        let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => {
          try { res(JSON.parse(b)); } catch (e) { rej(e); }
        });
      }).on('error', rej);
    });
    const page = (tabs || []).find((t) => t.webSocketDebuggerUrl && t.type === 'page') || tabs[0];
    if (!page || !page.webSocketDebuggerUrl) throw new Error('no page target ' + JSON.stringify(tabs));
    const { ws, send } = await cdpSession(page.webSocketDebuggerUrl);
    await send('Page.enable');
    await send('Runtime.enable');
    const url = 'http://127.0.0.1:' + port + '/index.html#/skill-map';
    await send('Page.navigate', { url });
    const t0 = Date.now();
    let ready = false;
    while (Date.now() - t0 < 20000) {
      const ev = await send('Runtime.evaluate', { expression: "!!document.querySelector('#sm-text') && document.querySelectorAll('.sm-node').length>=16", returnByValue: true });
      if (ev && ev.result && ev.result.value) { ready = true; break; }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!ready) throw new Error('skill-map did not render');
    await send('Runtime.evaluate', { expression: "document.querySelector('#sm-text').value='글로컬 회의 집행률 점검'; document.querySelector('#sm-text').dispatchEvent(new Event('input')); true", returnByValue: true });
    const ev = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true, awaitPromise: false });
    if (ev.exceptionDetails) throw new Error('evaluate: ' + JSON.stringify(ev.exceptionDetails));
    const data = ev.result.value;
    ws.close();
    const fails = (data.rows || []).filter((r) => !r.pass);
    const out = {
      ok: fails.length === 0 && data.textarea && data.textarea.ratio >= MIN,
      min: MIN,
      textarea: data.textarea,
      fail_count: fails.length,
      fails,
      sample: (data.rows || []).slice(0, 8),
      total: (data.rows || []).length
    };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    chrome.kill('SIGKILL');
    srv.close();
    process.exit(out.ok ? 0 : 2);
  } catch (e) {
    chrome.kill('SIGKILL');
    srv.close();
    console.error(e.stack || e.message, err.slice(-500));
    process.exit(1);
  }
})();
