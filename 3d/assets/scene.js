// v02 건물 장면: building.json 의 geo 칸(tools/build_v02.py)으로 축척 모델을 만듦.
// 좌표: 평면 (x, y) m → three (x, z=-y), 높이 = three y. (v01 과 같은 축 — 이름표 p 와 맞음)
// 성능: 층마다 재질별로 한 지오메트리로 합침(벽·창틀·유리·계단), 기둥은 InstancedMesh.

class Batch {
  constructor() { this.p = []; this.n = []; }
  quad(a, b, c, d) { // 반시계(바깥에서 볼 때) 네 점
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const q of [a, b, c, a, c, d]) { this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); }
  }
  tri(a, b, c) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    for (const q of [a, b, c]) { this.p.push(q[0], q[1], q[2]); this.n.push(nx / l, ny / l, nz / l); }
  }
  // 바닥 네 점(평면 x,y; 반시계) + 높이 z0..z1 → 상자. cap 에 윗면을 따로 넣을 수 있음
  prism(pts, z0, z1, cap = this, bottom = true) {
    const B = pts.map(([x, y]) => [x, z0, -y]), T = pts.map(([x, y]) => [x, z1, -y]); const n = pts.length;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.quad(B[i], B[j], T[j], T[i]); }
    if (n === 4) { cap.quad(T[0], T[1], T[2], T[3]); if (bottom) this.quad(B[3], B[2], B[1], B[0]); }
    else { for (let i = 1; i < n - 1; i++) { cap.tri(T[0], T[i], T[i + 1]); if (bottom) this.tri(B[0], B[i + 1], B[i]); } }
  }
  // 평면 선분 a→b, 두께 t 의 판(u0..u1 구간, 높이 z0..z1)
  slab(a, b, t, u0, u1, z0, z1, cap) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6 || u1 - u0 < 1e-4 || z1 - z0 < 1e-4) return;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy * t / 2, ny = ux * t / 2;
    const p0 = [a[0] + ux * u0, a[1] + uy * u0], p1 = [a[0] + ux * u1, a[1] + uy * u1];
    this.prism([[p0[0] - nx, p0[1] - ny], [p1[0] - nx, p1[1] - ny], [p1[0] + nx, p1[1] + ny], [p0[0] + nx, p0[1] + ny]], z0, z1, cap);
  }
  geo(THREE) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.computeBoundingSphere(); return g;
  }
  get empty() { return !this.p.length; }
}

// 벽 하나 → 구멍(창·문) 피해서 조각. cut 이 있으면 그 높이에서 자름
function wallPieces(w, out, cap, cut = Infinity) {
  const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const z1w = Math.min(w.z1, cut); if (z1w <= w.z0 + 1e-3) return;
  const holes = (w.holes || []).map((h) => [Math.max(0, h[0]), Math.min(L, h[1]), h[2], h[3]]).filter((h) => h[1] > h[0]).sort((p, q) => p[0] - q[0]);
  let u = 0;
  const put = (u0, u1, z0, z1) => { z1 = Math.min(z1, z1w); if (z1 > z0 + 1e-3) out.slab(w.a, w.b, w.t, u0, u1, z0, z1, cap); };
  for (const h of holes) {
    if (h[0] > u) put(u, h[0], w.z0, w.z1);
    if (h[2] > w.z0) put(Math.max(h[0], u), h[1], w.z0, h[2]);
    if (h[3] < w.z1) put(Math.max(h[0], u), h[1], h[3], w.z1);
    u = Math.max(u, h[1]);
  }
  if (u < L) put(u, L, w.z0, w.z1);
}

// 창: 유리 + 창틀(테두리·중간살). 종류별 살 나누기는 37쪽 창호일람표(AW1 1,500+1,500 / 하부 600), 입면 그림
const MULL = { AW1: { v: 2, h: [0.6] }, AW2: { v: 1, h: [0.6] }, AW3: { v: 1, h: [0.6] }, W1F: { v: 2, h: [] }, HW: { v: 2, h: [] }, entrance: { v: 3, h: [2.1] }, win: { v: 1, h: [] } };
function windowParts(o, glass, frame, cut = Infinity) {
  const z1 = Math.min(o.z1, cut); if (z1 <= o.z0 + 0.02) return;
  const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]), f = 0.055, d = Math.min(o.t, 0.09);
  const m = o.k === 'HB' ? { v: o.n || Math.max(1, Math.round(L / 1.0)), h: [] } : MULL[o.k] || { v: 1, h: [] };
  glass.slab(o.a, o.b, 0.016, f, L - f, o.z0 + f, z1 - (z1 < o.z1 ? 0 : f));
  frame.slab(o.a, o.b, d, 0, L, o.z0, o.z0 + f);
  if (z1 >= o.z1) frame.slab(o.a, o.b, d, 0, L, o.z1 - f, o.z1);
  frame.slab(o.a, o.b, d, 0, f, o.z0, z1); frame.slab(o.a, o.b, d, L - f, L, o.z0, z1);
  for (let i = 1; i < m.v; i++) { const u = (L * i) / m.v; frame.slab(o.a, o.b, d * 0.8, u - f / 2, u + f / 2, o.z0, z1); }
  for (const hz of m.h) { const z = o.z0 + hz; if (z < z1) frame.slab(o.a, o.b, d * 0.8, 0, L, z - f / 2, z + f / 2); }
}
function doorParts(o, glass, frame, leaf, cut = Infinity) {
  if (o.k === 'entrance') return windowParts(o, glass, frame, cut);
  const z1 = Math.min(o.z1, cut); if (z1 <= o.z0 + 0.02) return;
  const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]), f = 0.06;
  leaf.slab(o.a, o.b, 0.05, f, L - f, o.z0, z1);
  frame.slab(o.a, o.b, Math.min(o.t, 0.12), 0, f, o.z0, z1); frame.slab(o.a, o.b, Math.min(o.t, 0.12), L - f, L, o.z0, z1);
  if (z1 >= o.z1) frame.slab(o.a, o.b, Math.min(o.t, 0.12), 0, L, o.z1 - f, o.z1);
  const leaves = o.k === 'hangar_door' ? 4 : L > 1.3 ? 2 : 1; // 격납고 대형문: 입면 4짝(27쪽), 그 밖은 양개/외개
  for (let i = 1; i < leaves; i++) { const u = (L * i) / leaves; frame.slab(o.a, o.b, 0.08, u - 0.03, u + 0.03, o.z0, z1); }
  if (o.k === 'hangar_door') for (let z = o.z0 + 1.2; z < z1 - 0.3; z += 1.2) frame.slab(o.a, o.b, 0.07, f, L - f, z - 0.02, z + 0.02);
}

// 계단: 평면 디딤 수(+1 = 단 수), 단 높이 = 층고 / 단 수
function stairParts(st, b) {
  const [f1, f2] = st.flights; const r = st.rise_plan || st.rise; const z = f1.z0;
  const step = (fl, i, zTop, dirSign) => {
    const d = (fl.y1 - fl.y0) / fl.treads; // 남→북 증가
    const yA = dirSign > 0 ? fl.y0 + d * i : fl.y1 - d * (i + 1), yB = yA + d;
    b.prism([[fl.x0, yA], [fl.x1, yA], [fl.x1, yB], [fl.x0, yB]], Math.max(zTop - 0.32, z - 0.001), zTop);
  };
  // 1런: 남쪽 끝(y0)에서 북쪽으로 올라감
  for (let i = 0; i < f1.treads; i++) step(f1, i, z + (i + 1) * r, 1);
  const zl = z + (f1.treads + 1) * r; const L = st.landing.r;
  b.prism([[L[0], L[1]], [L[2], L[1]], [L[2], L[3]], [L[0], L[3]]], zl - 0.2, zl);
  // 2런: 북쪽 참에서 남쪽으로 올라감
  for (let i = 0; i < f2.treads; i++) step(f2, i, zl + (i + 1) * r, -1);
}

// 빈 배열이면 add 를 부르지 않음 (add() 를 인자 없이 부르면 three 가 콘솔 오류를 냄 — 창·문 없는 층)
function addAll(group, arr) { const a = arr.filter(Boolean); if (a.length) group.add(...a); return group; }

export function buildScene(THREE, data) {
  const G = data.geo;
  const tex = (() => { // 바닥 타일 느낌의 아주 옅은 줄눈 (캔버스)
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#e9edf1'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(0.33, 0.33); t.anisotropy = 4; return t;
  })();
  const M = {
    wall: new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.92 }),
    wallInt: new THREE.MeshStandardMaterial({ color: 0xfbfbfc, roughness: 0.95 }),
    core: new THREE.MeshStandardMaterial({ color: 0xe4e6e9, roughness: 0.9 }),
    cap: new THREE.MeshStandardMaterial({ color: 0x8d99a8, roughness: 1 }),
    slab: new THREE.MeshStandardMaterial({ color: 0xe8ebef, roughness: 0.96, map: tex }),
    slabOn: new THREE.MeshStandardMaterial({ color: 0xe3edfb, roughness: 0.96, map: tex }),
    roof: new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.95 }),
    roofTop: new THREE.MeshStandardMaterial({ color: 0x7f9a86, roughness: 0.95 }),   // 옥상 녹색 도막방수 (사진, 24쪽 T=3mm 노출형 도막방수)
    ph: new THREE.MeshStandardMaterial({ color: 0x6b737c, roughness: 0.8 }),         // 옥탑 짙은 회색 판넬 (사진 261021_3층계단_옥상.jpg)
    unit: new THREE.MeshStandardMaterial({ color: 0xe9ebed, roughness: 0.6, metalness: 0.1 }),
    tank: new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.55 }),
    pump: new THREE.MeshStandardMaterial({ color: 0x3d4652, roughness: 0.6, metalness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x8fb4da, roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.4, depthWrite: false, envMapIntensity: 1.4 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x5c6672, roughness: 0.5, metalness: 0.35 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x8592a1, roughness: 0.55, metalness: 0.2 }),
    hangarDoor: new THREE.MeshStandardMaterial({ color: 0x9aa7b5, roughness: 0.45, metalness: 0.4 }),
    ext: new THREE.MeshStandardMaterial({ color: 0xd3262c, roughness: 0.35 }),         // 소화기 빨강 (사진 261021_소화기_2개.jpg)
    vent: new THREE.MeshStandardMaterial({ color: 0x2f56b0, roughness: 0.45, metalness: 0.3 }), // 파란 벤틸레이터·골강판 (사진 261021_용접실습동_지붕_벤틸레이터.jpg)
    stair: new THREE.MeshStandardMaterial({ color: 0xd3d7dc, roughness: 0.9 }),
    col: new THREE.MeshStandardMaterial({ color: 0x8e9aa7, roughness: 0.5, metalness: 0.45 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc6d0dc, roughness: 0.42, metalness: 0.45, side: THREE.DoubleSide }),
    canopy: new THREE.MeshStandardMaterial({ color: 0xcfd5dc, roughness: 0.7 }),
    edge: new THREE.LineBasicMaterial({ color: 0x7d8a99, transparent: true, opacity: 0.35 }),
  };
  // 높은 벽(격납고)은 고른 층 높이에서 잘라 보이게 — 클리핑 평면
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);
  const MC = {}; for (const k of ['wall', 'glass', 'frame', 'leaf', 'hangarDoor', 'col', 'wallInt']) { MC[k] = M[k].clone(); MC[k].clippingPlanes = [clip]; MC[k].clipShadows = true; }
  MC.glass.side = THREE.DoubleSide;
  const edgeClip = M.edge.clone(); edgeClip.clippingPlanes = [clip];

  const mesh = (b, mat, shadow = true, edges = false) => {
    if (b.empty) return null; const g = b.geo(THREE); const m = new THREE.Mesh(g, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), mat.clippingPlanes ? edgeClip : M.edge));
    return m;
  };
  const extrude = (outer, holes, zTop, t, mat) => {
    const sh = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes || []) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, zTop - t, 0);
    // UV: 평면 m 그대로 (줄눈 3m)
    const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[2 * i] = p.getX(i); uv[2 * i + 1] = p.getZ(i); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), M.edge)); return m;
  };

  // 설비 작은 표시: { id, text, note, floor, pos, view } — note 는 누르면 보이는 설명, view 는 누를 때 카메라 방향(없으면 지금 방향)
  const eqLabels = [];
  const eqLabel = (e, floor, pos) => { if (e.label) eqLabels.push({ id: e.id || '', text: e.label, note: e.note || '', floor, pos, view: e.view || null }); };
  const cylAt = (r0, r1, h, seg, mat, x, z, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, z + h / 2, -y); m.castShadow = true; return m; };
  // 소화기 n개 (평면 y 방향으로 gap 간격): 몸통 원기둥 + 검은 머리, stand 에 든 번호는 빨간 받침대 위
  function extinguishers(e) {
    const g = new THREE.Group();
    for (let i = 0; i < e.n; i++) {
      const y = e.c[1] + (i - (e.n - 1) / 2) * e.gap; const onStand = (e.stand || []).includes(i); const z = e.z0 + (onStand ? 0.12 : 0);
      if (onStand) { const b = new Batch(); b.prism([[e.c[0] - 0.13, y - 0.13], [e.c[0] + 0.13, y - 0.13], [e.c[0] + 0.13, y + 0.13], [e.c[0] - 0.13, y + 0.13]], e.z0, z); g.add(mesh(b, M.ext)); }
      g.add(cylAt(e.r, e.r, e.h - 0.08, 12, M.ext, e.c[0], z, y), cylAt(e.r * 0.45, e.r * 0.45, 0.08, 8, M.pump, e.c[0], z + e.h - 0.08, y));
    }
    return g;
  }
  // 회전형 벤틸레이터 n개 (평면 y 방향 한 줄): 네모 후레싱(4각뿔대) + 목 + 원통 몸통 + 원뿔 갓, patch 가 있으면 골강판 지붕 조각
  function ventilators(e) {
    const g = new THREE.Group(), r = e.r;
    if (e.patch) { const [w, d] = e.patch; const b = new Batch(); b.prism([[e.c[0] - w / 2, e.c[1] - d / 2], [e.c[0] + w / 2, e.c[1] - d / 2], [e.c[0] + w / 2, e.c[1] + d / 2], [e.c[0] - w / 2, e.c[1] + d / 2]], e.z0 - 0.12, e.z0); g.add(mesh(b, M.vent, true, true)); }
    for (let i = 0; i < e.n; i++) {
      const y = e.c[1] + (i - (e.n - 1) / 2) * e.gap, x = e.c[0];
      const fl = cylAt(r * 0.95, r * 1.9, 0.2, 4, M.vent, x, e.z0, y); fl.rotation.y = Math.PI / 4;
      g.add(fl, cylAt(r * 0.75, r * 0.75, 0.15, 16, M.vent, x, e.z0 + 0.2, y), cylAt(r, r, 0.35, 16, M.vent, x, e.z0 + 0.35, y), cylAt(0.01, r * 1.04, e.h - 0.7, 16, M.vent, x, e.z0 + 0.7, y));
    }
    return g;
  }

  const floors = {}; const order = Object.keys(G.floors);
  const CUT = 1.55; // 단면 보기: 바닥 위 1.55m 에서 자름 (창 아래쪽이 보임)
  for (const fid of order) {
    const F = G.floors[fid];
    const full = new THREE.Group(), cut = new THREE.Group(), tall = new THREE.Group(), base = new THREE.Group();
    const cutZ = F.z + CUT;
    const bw = { ext: new Batch(), int: new Batch(), core: new Batch() }, cw = { ext: new Batch(), int: new Batch(), core: new Batch(), cap: new Batch() };
    const tw = new Batch();
    for (const w of F.walls) {
      const kind = w.k === 'int' ? 'int' : w.k === 'core' ? 'core' : 'ext';
      if (w.k === 'hangar' || w.tall) { wallPieces(w, tw, tw); continue; }
      wallPieces(w, bw[kind], bw[kind]); wallPieces(w, cw[kind], cw.cap, cutZ);
    }
    for (const l of F.lintels || []) { const w = { ...l, holes: [] }; wallPieces(w, bw.int, bw.int); }
    addAll(full, [mesh(bw.ext, M.wall, true, true), mesh(bw.int, M.wallInt, true, true), mesh(bw.core, M.core, true, true)]);
    addAll(cut, [mesh(cw.ext, M.wall, true, true), mesh(cw.int, M.wallInt, true, true), mesh(cw.core, M.core, true, true), mesh(cw.cap, M.cap, false)]);
    if (!tw.empty) tall.add(mesh(tw, MC.wall, true, true));
    // 창·문
    const gl = { f: [new Batch(), new Batch(), new Batch(), new Batch()], c: [new Batch(), new Batch(), new Batch(), new Batch()], t: [new Batch(), new Batch(), new Batch(), new Batch()] };
    const isTall = (o) => o.z1 > F.top + 0.01 || o.k === 'HW' || o.k === 'HB' || o.k === 'hangar_door' || (fid === '1F' && o.a[1] > -2.2 && o.b[1] > -2.2);
    for (const o of F.windows) { const T = isTall(o); windowParts(o, T ? gl.t[0] : gl.f[0], T ? gl.t[1] : gl.f[1]); if (!T) windowParts(o, gl.c[0], gl.c[1], cutZ); }
    for (const o of F.doors) {
      const T = isTall(o); const lf = o.k === 'hangar_door' ? 3 : 2;
      doorParts(o, T ? gl.t[0] : gl.f[0], T ? gl.t[1] : gl.f[1], T ? gl.t[lf] : gl.f[lf]);
      if (!T) doorParts(o, gl.c[0], gl.c[1], gl.c[lf], cutZ);
    }
    addAll(full, [mesh(gl.f[0], M.glass, false), mesh(gl.f[1], M.frame), mesh(gl.f[2], M.leaf)]);
    addAll(cut, [mesh(gl.c[0], M.glass, false), mesh(gl.c[1], M.frame), mesh(gl.c[2], M.leaf)]);
    addAll(tall, [mesh(gl.t[0], MC.glass, false), mesh(gl.t[1], MC.frame), mesh(gl.t[2], MC.leaf), mesh(gl.t[3], MC.hangarDoor)]);
    // 바닥 슬래브, 계단, 기둥 (공통)
    const slab = extrude(F.slab.outer, F.slab.holes, F.slab.z, F.slab.t, M.slab); base.add(slab);
    const sb = new Batch(); for (const st of F.stairs || []) stairParts(st, sb); const sm = mesh(sb, M.stair, true, true); if (sm) base.add(sm);
    if (F.columns && F.columns.length) {
      const h = F.top - F.z - 0.02; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MC.col, F.columns.length); const o = new THREE.Object3D();
      F.columns.forEach((c, i) => { o.position.set(c[0], (fid === '1F' ? 0 : F.z) + (fid === '1F' && c[1] > -2.2 ? G.levels.eave : h) / 2, -c[1]); o.scale.set(c[2], fid === '1F' && c[1] > -2.2 ? G.levels.eave : h, c[3]); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
      im.castShadow = true; im.receiveShadow = true; base.add(im);
    }
    for (const e of F.equipment || []) if (e.k === 'ext') { base.add(extinguishers(e)); eqLabel(e, fid, [e.c[0], e.z0 + e.h + 0.6, -e.c[1]]); }
    const g = new THREE.Group(); g.add(base, full, cut, tall); cut.visible = false;
    floors[fid] = { g, full, cut, tall, slab, f: { id: fid, z: F.z, top: F.top } };
  }
  // 지붕
  const R = G.roof; const roofG = new THREE.Group(); let phRoof = null;
  roofG.add(extrude(R.slab.outer, R.slab.holes, R.slab.z, R.slab.t, M.roofTop));
  { const b = new Batch(); for (const w of R.parapet) wallPieces(w, b, b); addAll(roofG, [mesh(b, M.wall, true, true)]); }
  { // 옥탑
    const P = R.penthouse; const b = new Batch(), gb = new Batch(), fb = new Batch(), lb = new Batch(), cb = new Batch();
    for (const w of P.walls) wallPieces(w, w.k === 'core' ? cb : b, w.k === 'core' ? cb : b);
    for (const o of P.windows) windowParts(o, gb, fb);
    for (const o of P.doors) doorParts(o, gb, fb, lb);
    addAll(roofG, [mesh(b, M.ph, true, true), mesh(cb, M.core), mesh(gb, M.glass, false), mesh(fb, M.frame), mesh(lb, M.leaf)]);
    const [x0, y0, x1, y1] = P.rect; const t = 0.3, i = t;
    phRoof = extrude([[x0 + i, y0 + i], [x1 - i, y0 + i], [x1 - i, y1 - i], [x0 + i, y1 - i]], [], P.z1, 0.2, M.roof); roofG.add(phRoof);
    if (P.label_p) eqLabel(P, 'RF', [P.label_p[0], P.z1 + 0.6, -P.label_p[1]]); // 계단탑(옥상 출입) — 3층 계단 쪽 문 위
  }
  // 옥상 설비 (사진·옥상 평면): 실외기·물탱크·펌프·압력탱크 — 큼직한 것만 상자·원기둥으로. 물탱크·펌프·압력탱크는 계단탑 동쪽(사진 10.21. 기준 대략). vent = 도면 밖 건물(용접실습동) 벤틸레이터, 따로 둔 모형
  {
    const box = new Batch(), unit = new Batch(), steel = new Batch(), tankB = new Batch(), pad = new Batch(), fans = [], cyls = [];
    const rect = (c, w, d) => [[c[0] - w / 2, c[1] - d / 2], [c[0] + w / 2, c[1] - d / 2], [c[0] + w / 2, c[1] + d / 2], [c[0] - w / 2, c[1] + d / 2]];
    for (const e of R.equipment || []) {
      if (e.k === 'ac') {
        steel.prism(rect(e.c, e.w + 0.1, e.d + 0.1), e.z0 - e.base, e.z0);          // 받침대
        unit.prism(rect(e.c, e.w, e.d), e.z0, e.z0 + e.h);
        for (let k = 0; k < (e.fans || 0); k++) fans.push([e.c[0] - e.w / 4 + (k * e.w) / 2, e.c[1], e.z0 + e.h, Math.min(e.w / 4, e.d / 2) - 0.03]);
      } else if (e.k === 'tank') {
        pad.prism(rect(e.c, e.w + 0.2, e.d + 0.2), e.z0 - e.pad, e.z0);
        tankB.prism(rect(e.c, e.w, e.d), e.z0, e.z0 + e.h);
      } else if (e.k === 'pump') box.prism(rect(e.c, e.w, e.d), e.z0, e.z0 + e.h);
      else if (e.k === 'vent') roofG.add(ventilators(e));
      else if (e.shape === 'cyl') cyls.push(e);
      const lp = e.label_p || e.c; // 2대 묶음(가압펌프·압력탱크)은 label_p = 가운데
      eqLabel(e, 'RF', [lp[0], e.z0 + (e.h || (e.r ? e.r * 2 : 0.5)) + 0.6, -lp[1]]);
    }
    addAll(roofG, [mesh(steel, M.frame), mesh(unit, M.unit, true, true), mesh(tankB, M.tank, true, true), mesh(pad, M.core), mesh(box, M.pump, true, true)]);
    for (const [x, y, z, r] of fans) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 20), M.frame); m.position.set(x, z + 0.04, -y); m.castShadow = true; roofG.add(m); }
    for (const e of cyls) { const m = new THREE.Mesh(new THREE.CylinderGeometry(e.r, e.r, e.l, 20), M.unit); m.rotation.z = Math.PI / 2; m.position.set(e.c[0], e.z0 + e.r, -e.c[1]); m.castShadow = true; roofG.add(m); }
  }
  { // 캐노피
    const b = new Batch(); for (const c of R.canopies || []) b.prism([[c.r[0], c.r[1]], [c.r[2], c.r[1]], [c.r[2], c.r[3]], [c.r[0], c.r[3]]], c.z0, c.z1); const m = mesh(b, M.canopy, true, true); if (m) floors['1F'].g.add(m);
  }
  // 격납고 박공지붕 + 박공벽(삼각형) — 28쪽 단면: 처마 +12,150, 용마루 +14,550
  const hangarRoof = (() => {
    const H = R.hangar; const [x0, y0, x1, y1] = H.rect; const e = H.eave, r = H.ridge, ym = H.ridge_y ?? (y0 + y1) / 2, o = H.overhang, t = H.t;
    const b = new Batch(), gw = new Batch();
    const sN = (r - e) / (y1 - ym), sS = (r - e) / (ym - y0); // 기울기
    const panel = (ya, yb, za, zb) => { // ya→yb 로 za→zb 높이, 두께 t (위로)
      const pts = [[x0 - o, ya, za], [x1 + o, ya, za], [x1 + o, yb, zb], [x0 - o, yb, zb]];
      const B = pts.map(([x, y, z]) => [x, z, -y]), T = pts.map(([x, y, z]) => [x, z + t, -y]);
      b.quad(T[0], T[1], T[2], T[3]); b.quad(B[3], B[2], B[1], B[0]);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; b.quad(B[i], B[j], T[j], T[i]); }
    };
    // 남쪽은 실습동 파라펫에 붙으므로 처마를 내밀지 않음
    panel(y0, ym, e, r); panel(ym, y1 + o, r, e - o * sN);
    for (const x of [x0, x1]) { // 박공 삼각형 벽(판넬 0.1)
      const d = 0.05;
      for (const s of [-d, d]) { const X = x + s; gw.tri([X, e, -y0], [X, e, -y1], [X, r, -ym]); gw.tri([X, e, -y1], [X, e, -y0], [X, r, -ym]); }
    }
    const g = new THREE.Group(); addAll(g, [mesh(b, M.metal, true, true), mesh(gw, M.wall, true, false)]);
    // 지붕 골 (세로 줄) — 금속 지붕 느낌
    const lines = []; for (let x = x0; x <= x1 + 1e-6; x += 1.0) { lines.push(x, e + t + 0.01, -y0, x, r + t + 0.01, -ym, x, r + t + 0.01, -ym, x, e - o * sN + t + 0.01, -(y1 + o)); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x9fb0c3, transparent: true, opacity: 0.45 })));
    return g;
  })();
  roofG.add(hangarRoof);

  function show(id) {
    // id: ALL·RF = 전체, 1F·2F·3F = 그 층 단면(위층 숨김), 높은 벽은 그 층 천장 높이에서 자름
    const lvl = id === 'ALL' || id === 'RF' ? order.length : order.indexOf(id) + 1;
    order.forEach((fid, i) => {
      const F = floors[fid]; F.g.visible = i < lvl;
      const cutMode = fid === id; F.full.visible = !cutMode; F.cut.visible = cutMode;
      F.slab.material = fid === id ? M.slabOn : M.slab;
    });
    roofG.visible = id === 'ALL' || id === 'RF';
    clip.constant = id === 'ALL' || id === 'RF' ? 1e4 : (floors[id] ? floors[id].f.z + CUT : 1e4);
  }
  return { floors, roofG, show, M, eqLabels, levels: G.levels, labelZ: (fid) => (fid === 'RF' ? G.roof.slab.z : G.floors[fid].z), CUT };
}
