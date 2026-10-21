import { defaultConfig, mergeConfig, labelText } from '../../assets/config.js';
const $ = (s) => document.querySelector(s);
const PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
let started = false;
// 편집 페이지에서 저장한 설정 (없으면 원본)
// 연습장(GitHub Pages) 안 이전 버전(v01) 복사본: 서버 없음. 이름표는 새 버전과 같은 ../assets/labels.json (유진님 저장값 호실번호·위치, 사람 이름 뺀 공개판)
const EMBED = new URLSearchParams(location.search).get('embed') === '1';
document.documentElement.classList.add('inapp'); if (EMBED) document.documentElement.classList.add('embed');
const overP = fetch('../assets/labels.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
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
    import('three'), import('../../assets/vendor/OrbitControls.js'), fetch('assets/building.json').then((r) => r.json()),
  ]);
  const DEF = defaultConfig(data);
  let cfg = mergeConfig(DEF, await overP);
  const floorName = (id) => (cfg.floors.find((f) => f.id === id) || {}).name || id;
  const canvas = $('#c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI * 0.48; controls.minDistance = 8; controls.maxDistance = 260;
  controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.9;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  if (EMBED) { // 홈 카드: 화면 넘김을 막지 않게 손 회전은 끄고 천천히 자동 회전, 누르면 전체 화면
    controls.enabled = false; canvas.style.touchAction = 'pan-y'; controls.autoRotate = true; controls.autoRotateSpeed = 0.6;
    canvas.addEventListener('click', () => { try { parent.location.hash = '#/3d'; } catch (e) { /* 다른 출처면 무시 */ } });
  }

  // light
  scene.add(new THREE.HemisphereLight(0xffffff, 0xaebccc, 0.95));
  const sun = new THREE.DirectionalLight(0xfffaf2, 2.9);
  sun.position.set(-30, 90, 40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 6; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 200 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdbe8ff, 0.35); fill.position.set(50, 30, -40); scene.add(fill);

  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gx = gc.getContext('2d');
  const grd = gx.createRadialGradient(128, 128, 10, 128, 128, 128); grd.addColorStop(0, 'rgba(226,231,237,1)'); grd.addColorStop(0.55, 'rgba(232,236,241,0.9)'); grd.addColorStop(1, 'rgba(242,244,246,0)');
  gx.fillStyle = grd; gx.fillRect(0, 0, 256, 256); const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = -0.03; pad.renderOrder = -1; scene.add(pad);

  const M = {
    wall: new THREE.MeshStandardMaterial({ color: 0xf4f6f9, roughness: 0.85 }),
    wallFade: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, transparent: true, opacity: 0.28, depthWrite: false }),
    wallInt: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    door: new THREE.MeshStandardMaterial({ color: 0x8a9bb0, roughness: 0.6 }),
    slab: new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    slabOn: new THREE.MeshStandardMaterial({ color: 0xcfe2fc, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xf6f7f9, roughness: 0.9 }),
    hangarRoof: new THREE.MeshStandardMaterial({ color: 0xc4d6ee, roughness: 0.7, side: THREE.DoubleSide }),
    pent: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    edge: new THREE.LineBasicMaterial({ color: 0x8f9cab, transparent: true, opacity: 0.55 }),
    edgeFade: new THREE.LineBasicMaterial({ color: 0xb7c2cf, transparent: true, opacity: 0.18 }),
  };
  const P = (x, y) => new THREE.Vector3(x, 0, -y);
  function box(cx, cy, z, w, d, h, mat, rot = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, mat); m.position.set(cx, z + h / 2, -cy); m.rotation.y = rot;
    m.castShadow = true; m.receiveShadow = true;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), M.edge); m.add(e); m.userData.edge = e;
    return m;
  }
  // 벽: ext(외벽, 모서리는 생성 단계에서 두께만큼 이미 겹침) / int(내부) / door(닫힌 문짝) / open(출입구, 표시 안 함)
  function wallMesh(w, z) {
    if (!(w.h > 0) || w.kind === 'open') return null;
    const [ax, ay] = w.a, [bx, by] = w.b; const len = Math.hypot(bx - ax, by - ay);
    const ext = w.kind === 'int' ? w.t * 0.5 : 0;
    const mat = w.kind === 'door' ? M.door : w.kind === 'int' ? M.wallInt : M.wall;
    const m = box((ax + bx) / 2, (ay + by) / 2, z + (w.z0 || 0), len + ext, w.t, w.h, mat, Math.atan2(by - ay, bx - ax));
    m.userData.base = z + (w.z0 || 0); m.userData.h = w.h; return m;
  }

  const floors = {};
  for (const f of data.floors) {
    const g = new THREE.Group(); const slabs = []; const tall = [];
    for (const s of f.slabs) { const m = box((s[0] + s[2]) / 2, (s[1] + s[3]) / 2, f.z - 0.15, s[2] - s[0], s[3] - s[1], 0.15, M.slab); m.castShadow = false; slabs.push(m); g.add(m); }
    for (const w of f.walls) { const m = wallMesh(w, f.z); if (!m) continue; if (w.tall) tall.push(m); g.add(m); }
    scene.add(g); floors[f.id] = { g, slabs, tall, f };
  }
  // roof
  const R = data.roof; const roofG = new THREE.Group();
  { for (const [x0, y0, x1, y1] of R.slabs) { const m = box((x0 + x1) / 2, (y0 + y1) / 2, R.z - 0.2, x1 - x0, y1 - y0, 0.2, M.slab); m.castShadow = false; roofG.add(m); }
    for (const w of R.parapetWalls) { const m = wallMesh(w, R.z); if (m) { m.material = M.roof; roofG.add(m); } }
    const [p0, q0, p1, q1] = R.penthouse; roofG.add(box((p0 + p1) / 2, (q0 + q1) / 2, R.z, p1 - p0, q1 - q0, R.penthouseH, M.pent)); }
  const hangarRoof = (() => {
    const [x0, y0, x1, y1] = R.hangar.rect; const e = R.hangar.eave, r = R.hangar.ridge, ym = (y0 + y1) / 2, o = 0.4;
    // 남쪽은 실습동 벽에 붙으므로 처마를 내밀지 않음
    const v = [x0 - o, e, -y0, x1 + o, e, -y0, x1 + o, r, -ym, x0 - o, r, -ym, x0 - o, e, -(y1 + o), x1 + o, e, -(y1 + o)];
    const idx = [0, 1, 2, 0, 2, 3, 4, 3, 2, 4, 2, 5];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.hangarRoof); m.castShadow = true; m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), M.edge));
    // gable ends
    const tri = (x) => { const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([x, e, -y0, x, r, -ym, x, e, -y1], 3)); tg.computeVertexNormals(); const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: .85 })); tm.castShadow = true; return tm; };
    const grp = new THREE.Group(); grp.add(m, tri(x0), tri(x1)); return grp;
  })();
  roofG.add(hangarRoof); scene.add(roofG);

  // labels
  const labelsEl = $('#labels'); let labels = [];
  const zOf = (id) => (id === 'RF' ? R.z : data.floors.find((f) => f.id === id).z);
  function addLabel(l, floor) {
    const text = labelText(l); if (!text) return null; // 이름·호실 없는 방은 표시 안 함
    const el = document.createElement('div'); el.className = 'lbl' + (l.kind === 'entry' ? ' entry' : '') + (l.color ? ' c-' + l.color : ''); el.textContent = text;
    labelsEl.appendChild(el); const item = { el, pos: new THREE.Vector3(l.p[0], zOf(floor) + 1.3, -l.p[1]), floor, name: text, kind: l.kind, id: l.id };
    el.addEventListener('click', () => focusRoom(item)); labels.push(item); return item;
  }
  function buildLabels() {
    labelsEl.innerHTML = ''; labels = [];
    for (const [fid, arr] of Object.entries(cfg.labels)) for (const l of arr) addLabel(l, fid);
  }
  buildLabels();
  function buildSeg() {
    const seg = $('#seg'); seg.querySelectorAll('button').forEach((b) => b.remove());
    const th = seg.querySelector('.seg-thumb');
    for (const f of cfg.floors) { const b = document.createElement('button'); b.dataset.f = f.id; b.textContent = f.tab; b.addEventListener('click', () => setFloor(f.id)); seg.insertBefore(b, th); }
    seg.style.gridTemplateColumns = `repeat(${cfg.floors.length},1fr)`;
  }

  // camera helpers
  const anim = { t: 1, from: null, to: null };
  function fitDistance(radius) {
    const v = THREE.MathUtils.degToRad(camera.fov) / 2; const h = Math.atan(Math.tan(v) * camera.aspect);
    return radius / Math.sin(Math.min(v, h));
  }
  function viewFor(id) {
    const cm = cfg.cams[id]; if (cm) return { pos: new THREE.Vector3(...cm.pos), target: new THREE.Vector3(...cm.target) };
    const y = id === 'ALL' || id === 'RF' ? 5 : floors[id].f.z + 1;
    const portrait = innerWidth < innerHeight;
    const r = portrait ? 31 : 31;
    const d = fitDistance(r); const az = THREE.MathUtils.degToRad(portrait ? 68 : 35), pol = THREE.MathUtils.degToRad(id === 'ALL' || id === 'RF' ? 56 : 44);
    const target = new THREE.Vector3(0, y, 0);
    const pos = target.clone().add(new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)).multiplyScalar(d));
    return { target, pos };
  }
  function flyTo(v, dur = 0.9) { anim.from = { pos: camera.position.clone(), target: controls.target.clone() }; anim.to = v; anim.t = 0; anim.dur = dur; }
  function focusRoom(item) {
    labels.forEach((l) => l.el.classList.toggle('hl', l === item));
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c._item === item));
    const dir = camera.position.clone().sub(controls.target).normalize();
    flyTo({ target: item.pos.clone().setY(item.pos.y - 1), pos: item.pos.clone().add(dir.multiplyScalar(30)) }, 0.8);
  }

  let current = 'ALL';
  const CUT = { '1F': floors['2F'].f.z, '2F': floors['3F'].f.z, '3F': R.z + 0.7 };
  function setFloor(id, fly = true) {
    current = id; $('#floorName').textContent = floorName(id);
    const order = ['1F', '2F', '3F'];
    const lvl = id === 'ALL' || id === 'RF' ? 3 : order.indexOf(id) + 1;
    order.forEach((fid, i) => {
      const F = floors[fid]; F.g.visible = i < lvl;
      F.slabs.forEach((s) => (s.material = fid === id ? M.slabOn : M.slab));
      // 층을 고르면 그 층 천장 높이에서 잘라 보여 줌(격납고 높은 벽이 위로 떠 보이지 않게)
      const cut = id === 'ALL' || id === 'RF' ? Infinity : CUT[id];
      F.tall.forEach((m) => { const u = m.userData; const h = Math.max(0.01, Math.min(u.h, cut - u.base)); m.scale.y = h / u.h; m.position.y = u.base + h / 2; m.visible = cut > u.base; });
    });
    roofG.visible = id === 'RF' || id === 'ALL';
    labels.forEach((l) => { l.on = l.floor === id; l.el.classList.remove('hl'); });
    const btns = [...document.querySelectorAll('#seg button')]; const k = btns.findIndex((b) => b.dataset.f === id);
    btns.forEach((b, i) => b.classList.toggle('on', i === k));
    $('.seg-thumb').style.transform = `translateX(${k * 100}%)`;
    const rooms = $('#rooms'); rooms.innerHTML = '';
    const seen = new Map();
    labels.filter((l) => l.on).forEach((l) => {
      const c = document.createElement('button'); c.className = 'chip' + (l.kind === 'entry' ? ' entry' : '');
      const n = (seen.get(l.name) || 0) + 1; seen.set(l.name, n);
      c.textContent = l.name; c._item = l; c.addEventListener('click', () => focusRoom(l)); rooms.appendChild(c);
    });
    rooms.hidden = !rooms.children.length;
    if (fly) flyTo(viewFor(id));
  }
  buildSeg();
  $('#reset').addEventListener('click', () => flyTo(viewFor(current)));

  function resize() {
    const w = innerWidth, h = innerHeight; if (!(w > 0 && h > 0)) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  const qp = new URLSearchParams(location.search).get('f');
  const init = cfg.floors.some((f) => f.id === qp) ? qp : 'ALL';
  setFloor(init, false); const v0 = viewFor(init); camera.position.copy(v0.pos); controls.target.copy(v0.target); controls.update();

  const tmp = new THREE.Vector3(); const ease = (t) => 1 - Math.pow(1 - t, 3);
  function updateLabels() {
    const w = innerWidth, h = innerHeight; const placed = [];
    const vis = labels.filter((l) => l.on).map((l) => { tmp.copy(l.pos).project(camera); return { l, x: (tmp.x + 1) / 2 * w, y: (1 - tmp.y) / 2 * h, z: tmp.z }; })
      .sort((a, b) => (b.l.el.classList.contains('hl') - a.l.el.classList.contains('hl')) || a.z - b.z);
    for (const l of labels) if (!l.on) l.el.classList.add('hide');
    for (const v of vis) {
      const bw = v.l.el.offsetWidth || 60, bh = 26;
      const r = { x0: v.x - bw / 2 - 2, x1: v.x + bw / 2 + 2, y0: v.y - bh / 2, y1: v.y + bh / 2 };
      const off = v.z > 1 || v.y < 70 || v.y > h - 150 || v.x < -20 || v.x > w + 20;
      const hit = placed.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0);
      if (off || hit) { v.l.el.classList.add('hide'); continue; }
      placed.push(r); v.l.el.classList.remove('hide');
      v.l.el.style.transform = `translate(${v.x.toFixed(1)}px,${v.y.toFixed(1)}px) translate(-50%,-50%)`;
    }
  }
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
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
    if (m.t === 'getcam') parent.postMessage({ t: 'cam', id: current, pos: camera.position.toArray().map((v) => +v.toFixed(3)), target: controls.target.toArray().map((v) => +v.toFixed(3)) }, location.origin);
    if (m.t === 'resetcam') flyTo(viewFor(current));
  });
  if (PREVIEW) parent.postMessage({ t: 'ready' }, location.origin);
  window.__dbg = { camera, controls, get cfg() { return cfg; } }; window.__ready = true;
}
