/**
 * Phone tap-target / input-font audit for hj-app.
 * Loads each hash route at 390x844 and 1280x800.
 *
 * Counts, among visible controls (button, link, tab, chip, input/select/textarea, summary):
 *   - boxes smaller than 40 CSS px in either dimension
 *   - text inputs / selects / textareas whose computed font-size is under 16px
 *
 * Usage:
 *   node tools/mobile_audit.mjs [--base http://127.0.0.1:8765] [--shots /tmp/shots] [--label before]
 *
 * Requires the `playwright` package and a local Chrome (`channel: 'chrome'`).
 * No personal data is printed: samples are tag, class, size, and font-size only.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const BASE = flag('--base', 'http://127.0.0.1:8765/index.html');
const SHOTS = flag('--shots', '');
const LABEL = flag('--label', 'audit');

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1280', width: 1280, height: 800 },
];
const NAMED = ['home', 'coop', 'docs', 'charts', 'todo'];

const PROBE = `(() => {
  const TAP = 'button, a[href], summary, [role="button"], [role="tab"], [role="link"], [role="menuitem"], input:not([type="hidden"]), select, textarea';
  const TEXT = 'textarea, select, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="image"]):not([type="range"]):not([type="color"])';
  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    if (cs.pointerEvents === 'none') return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    // Laid out somewhere (including below the fold). Skip nodes inside a closed ancestor.
    let n = el;
    while (n && n !== document.body) {
      if (n.hidden) return false;
      n = n.parentElement;
    }
    return true;
  }
  function cls(el) {
    return String(el.className || '').toString().split(/\\s+/).filter(Boolean).slice(0, 3).join('.');
  }
  const taps = [];
  document.querySelectorAll(TAP).forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width * 10) / 10;
    const h = Math.round(r.height * 10) / 10;
    taps.push({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || '', cls: cls(el), w, h, small: w < 40 || h < 40 });
  });
  const inputs = [];
  document.querySelectorAll(TEXT).forEach((el) => {
    if (!visible(el)) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    inputs.push({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || '', cls: cls(el), fs: Math.round(fs * 10) / 10, small: fs < 16 });
  });
  const viewBtns = [...document.querySelectorAll('#view button')].filter(visible).length;
  const tabBtns = [...document.querySelectorAll('#tabs button')].filter(visible).length;
  const allBtns = document.querySelectorAll('button').length;
  const side = !!document.querySelector('aside, .sidebar, .hk-side, nav.side, [class*="sidenav"], [class*="side-nav"]');
  const sideVisible = [...document.querySelectorAll('aside, .hk-side, .sidebar')].some(visible);
  return {
    smallTargets: taps.filter((t) => t.small).length,
    smallInputs: inputs.filter((t) => t.small).length,
    targets: taps.length,
    textInputs: inputs.length,
    viewButtons: viewBtns,
    tabButtons: tabBtns,
    allButtons: allBtns,
    side, sideVisible,
    samples: taps.filter((t) => t.small).slice(0, 12),
    inputSamples: inputs.filter((t) => t.small).slice(0, 8),
  };
})()`;

async function routesOf(page) {
  await page.goto(BASE + '#/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.MODULE_LIST && document.querySelector('#tabs button'), { timeout: 20000 });
  // Module scripts append one by one; wait until the shell has painted home.
  await page.waitForFunction(() => {
    const v = document.getElementById('view');
    return v && v.innerHTML.length > 80 && !v.querySelector('.card.sk');
  }, { timeout: 20000 }).catch(() => {});
  const discovered = await page.evaluate(() => {
    const list = (window.MODULE_LIST || []).concat(window.MODULE_EXTRA || []);
    return [...new Set(list)];
  });
  const prefer = ['home', 'coop', 'docs', 'charts', 'todo'];
  const rest = discovered.filter((id) => !prefer.includes(id)).sort();
  return prefer.filter((id) => discovered.includes(id)).concat(rest);
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => {
    const v = document.getElementById('view');
    if (!v) return false;
    if (v.querySelector('.card.sk,[aria-busy="true"]')) return false;
    return v.innerHTML.length > 40;
  }, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function main() {
  if (SHOTS) await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const routes = await routesOf(page);
  const report = { label: LABEL, base: BASE, routes, viewports: {} };

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const screens = {};
    let smallTargets = 0;
    let smallInputs = 0;
    for (const id of routes) {
      await page.goto(BASE + '#/' + id, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await settle(page);
      const data = await page.evaluate(PROBE);
      screens[id] = data;
      smallTargets += data.smallTargets;
      smallInputs += data.smallInputs;
      if (SHOTS && NAMED.includes(id)) {
        const file = path.join(SHOTS, LABEL + '_' + id + '_' + vp.name + '.png');
        await page.screenshot({ path: file, fullPage: false });
      }
    }
    report.viewports[vp.name] = { smallTargets, smallInputs, screens };
  }

  await browser.close();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
