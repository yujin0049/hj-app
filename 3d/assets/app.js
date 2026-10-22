import { defaultConfig, mergeConfig, labelText } from './config.js';
import { buildScene } from './scene.js';
const $ = (s) => document.querySelector(s);
const PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
let started = false;
// 편집 페이지에서 저장한 설정 (없으면 원본)
// 연습장(GitHub Pages) 복사본: 서버 없음. 이름표는 assets/labels.json
// (유진님 3D 사이트 저장값 2026-10-20 17:39의 호실번호·위치 그대로, 사람 이름만 뺀 공개판). v01(이전 버전)도 같은 파일을 씀.
const EMBED = new URLSearchParams(location.search).get('embed') === '1';
document.documentElement.classList.add('inapp'); if (EMBED) document.documentElement.classList.add('embed');
const overP = fetch('assets/labels.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
function applyTexts(c) {
  if (typeof c.title === 'string' && c.title) {
    document.title = c.title; $('.title b').textContent = c.title;
    const h = $('#landing h1'); const i = c.title.indexOf(' ');
    h.textContent = ''; if (i > 0 && c.title.length > 9) h.append(c.title.slice(0, i), document.createElement('br'), c.title.slice(i + 1)); else h.textContent = c.title;
  }
  if (typeof c.subtitle === 'string') $('.eyebrow').textContent = c.subtitle;
  if (typeof c.note === 'string') $('.note').textContent = c.note;
}
overP.then((o) => o && applyTexts(o));
if (PREVIEW) document.documentElement.classList.add('preview');

function enter(push = true) {
  $('#landing').hidden = true; $('#viewer').hidden = false;
  
  if (!started) { started = true; boot(); }
}
function leave() { $('#viewer').hidden = true; $('#landing').hidden = false; }
$('#enter').addEventListener('click', () => enter());
$('#back').addEventListener('click', () => { if (history.state && history.state.v) history.back(); else { history.replaceState(null, '', location.pathname + location.search); leave(); } });
addEventListener('popstate', () => enter(false)); // 연습장 안: 첫 화면으로 돌아가지 않음
enter(false); // 연습장 안에서는 첫 화면 없이 바로 3D

async function boot() {
  const [THREE, { OrbitControls }, data] = await Promise.all([
    import('three'), import('./vendor/OrbitControls.js'), fetch('assets/building.json').then((r) => r.json()),
  ]);
  const DEF = defaultConfig(data);
  let cfg = mergeConfig(DEF, await overP);
  const floorName = (id) => (cfg.floors.find((f) => f.id === id) || {}).name || id;
  const canvas = $('#c');
  const small = Math.min(innerWidth, innerHeight) < 600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 6; controls.maxDistance = 260;
  controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.9;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  if (EMBED) { // 홈 카드: 화면 넘김을 막지 않게 손 회전은 끄고 천천히 자동 회전, 누르면 전체 화면
    controls.enabled = false; canvas.style.touchAction = 'pan-y'; controls.autoRotate = true; controls.autoRotateSpeed = 0.6;
    canvas.addEventListener('click', () => { try { parent.location.hash = '#/3d'; } catch (e) { /* 다른 출처면 무시 */ } });
  }

  // 환경광: 하늘(위 흰색) → 지평선 → 땅(회청색) 그라데이션 구를 PMREM 으로 (유리 반사·부드러운 채광)
  {
    const env = new THREE.Scene(); const g = new THREE.SphereGeometry(50, 32, 16); const c = [];
    const top = new THREE.Color(0xffffff), mid = new THREE.Color(0xe7edf4), bot = new THREE.Color(0x9aa6b4);
    for (let i = 0; i < g.attributes.position.count; i++) { const y = g.attributes.position.getY(i) / 50; const col = y > 0 ? mid.clone().lerp(top, Math.min(1, y * 1.6)) : mid.clone().lerp(bot, Math.min(1, -y * 2)); c.push(col.r, col.g, col.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    env.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); sunBall.position.set(-20, 38, 22); sunBall.material.color.multiplyScalar(6); env.add(sunBall);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.02).texture; scene.environmentIntensity = 0.55; pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c2cf, 0.55));
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.4);
  sun.position.set(-34, 70, 46); sun.castShadow = true;
  const sm = small ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm); sun.shadow.radius = 5; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 10, far: 200 });
  scene.add(sun);

  // 땅: 그림자만 받는 면 + 둥근 옅은 바닥
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.001; ground.receiveShadow = true; scene.add(ground);
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gx = gc.getContext('2d');
  const grd = gx.createRadialGradient(128, 128, 10, 128, 128, 128); grd.addColorStop(0, 'rgba(225,230,236,1)'); grd.addColorStop(0.55, 'rgba(232,236,241,0.9)'); grd.addColorStop(1, 'rgba(242,244,246,0)');
  gx.fillStyle = grd; gx.fillRect(0, 0, 256, 256); const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = -0.03; pad.renderOrder = -1; scene.add(pad);

  const B = buildScene(THREE, data);
  for (const F of Object.values(B.floors)) scene.add(F.g);
  scene.add(B.roofG);
  const bbox = new THREE.Box3().setFromObject(B.roofG); // 건물 전체 범위(지붕·옥탑 포함)
  for (const F of Object.values(B.floors)) bbox.expandByObject(F.g);

  // 이름표
  const labelsEl = $('#labels'); let labels = [];
  const zOf = (fid) => B.labelZ(fid);
  function addLabel(l, floor) {
    const text = labelText(l); if (!text) return null; // 이름·호실 없는 방은 표시 안 함
    const el = document.createElement('div'); el.className = 'lbl' + (l.kind === 'entry' ? ' entry' : '') + (l.color ? ' c-' + l.color : ''); el.textContent = text;
    labelsEl.appendChild(el);
    // 단면 보기에서 잘린 벽(1.55m) 위에 뜨게
    const item = { el, pos: new THREE.Vector3(l.p[0], zOf(floor) + (floor === 'RF' ? 1.2 : B.CUT + 0.35), -l.p[1]), floor, name: text, kind: l.kind, id: l.id, w: 0 };
    el.addEventListener('click', () => focusRoom(item)); labels.push(item); return item;
  }
  function buildLabels() {
    labelsEl.innerHTML = ''; labels = [];
    for (const [fid, arr] of Object.entries(cfg.labels)) for (const l of arr) addLabel(l, fid);
    // 설비 작은 표시 (building.json geo 칸 — 편집 이름표와 별개, 그 층·지붕 보기에서만). note 가 있으면 누르면 이름표처럼 다가가고 설명이 붙음
    for (const e of B.eqLabels) {
      const el = document.createElement('div'); el.className = 'lbl eq' + (e.note ? ' tap' : ''); el.textContent = e.text; labelsEl.appendChild(el);
      const item = { el, pos: new THREE.Vector3(...e.pos), floor: e.floor || 'RF', name: e.text, kind: 'eq', eq: true, id: e.id, w: 0, view: e.view };
      if (e.note) { el.dataset.note = e.note; el.title = e.note; el.addEventListener('click', () => focusRoom(item)); }
      labels.push(item);
    }
  }
  buildLabels();
  function buildSeg() {
    const seg = $('#seg'); seg.querySelectorAll('button').forEach((b) => b.remove());
    const th = seg.querySelector('.seg-thumb');
    for (const f of cfg.floors) { const b = document.createElement('button'); b.dataset.f = f.id; b.textContent = f.tab; b.addEventListener('click', () => setFloor(f.id)); seg.insertBefore(b, th); }
    seg.style.gridTemplateColumns = `repeat(${cfg.floors.length},1fr)`;
  }

  // 카메라
  const anim = { t: 1, from: null, to: null };
  function fitDistance(radius) {
    const v = THREE.MathUtils.degToRad(camera.fov) / 2; const h = Math.atan(Math.tan(v) * camera.aspect);
    return radius / Math.sin(Math.min(v, h));
  }
  function viewFor(id) {
    const cm = cfg.cams[id]; if (cm) return { pos: new THREE.Vector3(...cm.pos), target: new THREE.Vector3(...cm.target) };
    const all = id === 'ALL' || id === 'RF';
    const c = bbox.getCenter(new THREE.Vector3()); const size = bbox.getSize(new THREE.Vector3());
    const portrait = innerWidth < innerHeight;
    // 전체: 건물 전체가 들어오게(지붕 포함 범위의 반지름), 층: 실습동 쪽이 크게
    const r = all ? Math.hypot(size.x, size.z) * 0.5 * (portrait ? 1.0 : 1.02) : Math.hypot(size.x, size.z) * 0.5 * (portrait ? 0.86 : 0.74);
    const y = all ? size.y * 0.3 : B.floors[id].f.z + 1;
    const d = fitDistance(r); const az = THREE.MathUtils.degToRad(portrait ? 62 : 32), pol = THREE.MathUtils.degToRad(all ? 60 : 46);
    const target = new THREE.Vector3(c.x, y, all ? c.z : c.z + 4);
    const pos = target.clone().add(new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)).multiplyScalar(d));
    return { target, pos };
  }
  function flyTo(v, dur = 0.9) { anim.from = { pos: camera.position.clone(), target: controls.target.clone() }; anim.to = v; anim.t = 0; anim.dur = dur; }
  function focusRoom(item) {
    labels.forEach((l) => { l.el.classList.toggle('hl', l === item); if (l.eq) l.w = l.h = 0; }); // 설명이 붙고 빠지면 폭·높이가 바뀜
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c._item === item));
    // 설비에 view 가 있으면 그 방향에서 (옥상 물탱크·펌프: 반투명 옥탑 안을 내려다보는 남동쪽 위)
    const dir = item.view ? new THREE.Vector3(...item.view).normalize() : camera.position.clone().sub(controls.target).normalize();
    flyTo({ target: item.pos.clone().setY(item.pos.y - 1), pos: item.pos.clone().add(dir.multiplyScalar(26)) }, 0.8);
  }

  let current = 'ALL';
  function setFloor(id, fly = true) {
    current = id; $('#floorName').textContent = floorName(id);
    B.show(id);
    labels.forEach((l) => { l.on = l.floor === id; l.el.classList.remove('hl'); });
    const btns = [...document.querySelectorAll('#seg button')]; const k = btns.findIndex((b) => b.dataset.f === id);
    btns.forEach((b, i) => b.classList.toggle('on', i === k));
    $('.seg-thumb').style.transform = `translateX(${k * 100}%)`;
    const rooms = $('#rooms'); rooms.innerHTML = '';
    labels.filter((l) => l.on && !l.eq).forEach((l) => {
      const c = document.createElement('button'); c.className = 'chip' + (l.kind === 'entry' ? ' entry' : '');
      c.textContent = l.name; c._item = l; c.addEventListener('click', () => focusRoom(l)); rooms.appendChild(c);
    });
    rooms.hidden = !rooms.children.length;
    if (fly) flyTo(viewFor(id));
  }
  buildSeg();
  $('#reset').addEventListener('click', () => flyTo(viewFor(current)));

  // 크기 0(편집 페이지 폰 화면에서 미리보기 iframe 이 숨겨진 상태)이면 aspect 가 NaN 이 되어 카메라·클리핑 값이 NaN 이 되고
  // three 가 uniform 을 펴다가 'toArray is not a function' 을 냄 → 0 크기는 건너뛰고, 보이게 되면 시점을 다시 잡음
  const okVec = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  let hasSize = false;
  function resize() {
    const w = innerWidth, h = innerHeight;
    if (!(w > 0 && h > 0)) { hasSize = false; return; }
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    labels.forEach((l) => { l.w = l.h = 0; }); // max-width 90vw → 화면 폭이 바뀌면 이름표 줄바꿈·크기도 바뀜
    if (!hasSize && started2 && (!okVec(camera.position) || !okVec(controls.target))) { const v = viewFor(current); camera.position.copy(v.pos); controls.target.copy(v.target); controls.update(); anim.t = 1; }
    hasSize = true;
  }
  let started2 = false;
  addEventListener('resize', resize); resize();

  const qp = new URLSearchParams(location.search).get('f');
  const init = cfg.floors.some((f) => f.id === qp) ? qp : 'ALL';
  setFloor(init, false); const v0 = viewFor(init); camera.position.copy(v0.pos); controls.target.copy(v0.target); controls.update(); started2 = true;

  // 이름표 배치: 크기 고정, 겹치면 위·아래로 비켜 보고 그래도 겹치면 숨김, 멀리 있는 것은 흐리게
  // 설비 표시(eq)는 겹쳐도 숨기지 않음 — 더 멀리(EQ_OFFS)까지 비켜 보고, 빈 자리가 없으면 가장 덜 겹치는 자리에 둠
  // 가로는 화면 안(양쪽 EDGE px 여유)으로 끌어들여(clamp) 폰 가장자리에서 잘리지 않게
  const tmp = new THREE.Vector3(); const ease = (t) => 1 - Math.pow(1 - t, 3);
  const OFFS = [0, -30, 30, -58, 58];
  const EQ_OFFS = [...OFFS, -86, 86, -114, 114];
  const EDGE = 6;
  const clampX = (x, bw, w) => (bw + EDGE * 2 >= w ? w / 2 : Math.min(Math.max(x, bw / 2 + EDGE), w - bw / 2 - EDGE));
  function updateLabels() {
    const w = innerWidth, h = innerHeight; const placed = [];
    const vis = labels.filter((l) => l.on).map((l) => { tmp.copy(l.pos).project(camera); return { l, x: (tmp.x + 1) / 2 * w, y: (1 - tmp.y) / 2 * h, z: tmp.z, d: camera.position.distanceTo(l.pos) }; })
      .sort((a, b) => (b.l.el.classList.contains('hl') - a.l.el.classList.contains('hl')) || (!!a.l.eq - !!b.l.eq) || a.d - b.d); // 설비 표시는 맨 나중(빈 자리를 이름표에 먼저 줌)
    for (const l of labels) if (!l.on) l.el.classList.add('hide');
    if (!vis.length) return;
    const dmin = vis.reduce((m, v) => Math.min(m, v.d), 1e9), dmax = vis.reduce((m, v) => Math.max(m, v.d), 0);
    const hits = (r) => placed.reduce((n, p) => n + (r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0), 0);
    for (const v of vis) {
      const bw = (v.l.w ||= v.l.el.offsetWidth || 60), bh = (v.l.h ||= v.l.el.offsetHeight || 26);
      const off = v.z > 1 || v.y < 70 || v.y > h - 150 || v.x < -20 || v.x > w + 20; // 화면 밖은 설비도 숨김
      const x = clampX(v.x, bw, w);
      let ok = null, best = null;
      if (!off) for (const dy of v.l.eq ? EQ_OFFS : OFFS) {
        const r = { x0: x - bw / 2 - 3, x1: x + bw / 2 + 3, y0: v.y + dy - bh / 2 - 2, y1: v.y + dy + bh / 2 + 2 };
        if (r.y0 < 60 || r.y1 > h - 140) continue;
        const n = hits(r);
        if (!n) { ok = { r, dy }; break; }
        if (!best || n < best.n) best = { r, dy, n };
      }
      if (!ok && v.l.eq && !off) ok = best || { r: null, dy: 0 }; // 설비는 겹쳐도 표시
      if (!ok) { v.l.el.classList.add('hide'); continue; }
      if (ok.r) placed.push(ok.r);
      v.l.el.classList.remove('hide');
      const k = dmax - dmin > 1 ? (v.d - dmin) / (dmax - dmin) : 0; // 0 앞 → 1 뒤
      v.l.el.style.opacity = v.l.el.classList.contains('hl') ? 1 : (1 - 0.45 * k).toFixed(2);
      v.l.el.classList.toggle('moved', ok.dy !== 0);
      v.l.el.style.transform = `translate(${x.toFixed(1)}px,${(v.y + ok.dy).toFixed(1)}px) translate(-50%,-50%)`;
    }
  }
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!hasSize) return; // 숨겨진 iframe(크기 0) 에서는 그리지 않음
    if (anim.t < 1) {
      anim.t = Math.min(1, anim.t + dt / anim.dur); const k = ease(anim.t);
      camera.position.lerpVectors(anim.from.pos, anim.to.pos, k); controls.target.lerpVectors(anim.from.target, anim.to.target, k);
    }
    controls.update(); renderer.render(scene, camera); updateLabels();
  });
  canvas.addEventListener('pointerdown', () => { anim.t = 1; $('#hint').classList.add('off'); }, { passive: true });
  setTimeout(() => $('#hint').classList.add('off'), 4500);
  requestAnimationFrame(() => $('#loading').classList.add('done'));
  // 편집 페이지 미리보기(같은 출처 iframe)와 주고받기
  if (PREVIEW) addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== parent || !e.data) return;
    const m = e.data;
    if (m.t === 'cfg') { cfg = mergeConfig(DEF, m.cfg); applyTexts(cfg); buildLabels(); buildSeg(); setFloor(m.floor || current, !!m.fly); }
    if (m.t === 'floor') setFloor(m.id);
    if (m.t === 'getcam' && okVec(camera.position) && okVec(controls.target)) parent.postMessage({ t: 'cam', id: current, pos: camera.position.toArray().map((v) => +v.toFixed(3)), target: controls.target.toArray().map((v) => +v.toFixed(3)) }, location.origin);
    if (m.t === 'resetcam') flyTo(viewFor(current));
  });
  if (PREVIEW) parent.postMessage({ t: 'ready' }, location.origin);
  window.__dbg = { camera, controls, scene, renderer, B, get cfg() { return cfg; }, setFloor, info: () => renderer.info.render }; window.__ready = true;
}
