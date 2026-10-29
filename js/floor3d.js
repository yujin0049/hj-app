/* 층별 3D 도면 (#/floor3d) — 더보기 맨 아래 버튼으로만 들어옴. 이 파일과 three.js 는 이 화면을 처음 열 때만 불러옴(홈에는 안 실림).
   모양: 3d/assets/building.json(준공도면 2020.04의 벽·바닥·방 윤곽) 그대로. 방 이름: 3d/assets/labels.json(앱의 #/3d 와 같은 이름표), 비어 있으면 도면 이름(building.json rooms.dwg).
   없는 방은 만들지 않음. three.js 는 3d/assets/vendor/three.module.min.js(MIT, three-LICENSE.txt) 를 그대로 씀. */
(function () {
  var FLOORS = ['1F', '2F', '3F'];
  var CUT = 1.3;       /* 벽을 이 높이에서 잘라 위에서 방이 보이게(단면 모형) */
  var SPREAD = 10;    /* 층 사이를 벌려 아래층도 보이게(실제 층고 3.5m 대신 보기용 간격) */
  var CSS = [
    '.f3-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px}',
    '.f3-head h1{margin:0;font-size:1.35rem;letter-spacing:-.02em;flex:1 1 auto}',
    '.f3-tg{display:flex;gap:6px}',
    '.f3-tg button,.f3-reset{min-height:40px;min-width:48px;padding:0 12px;border-radius:999px;border:1px solid var(--line,#E5E8EB);background:var(--card,#fff);color:var(--ink-2,#4E5968);font-weight:800;font-size:.86rem;cursor:pointer}',
    '.f3-tg button[aria-pressed="true"]{background:var(--accent,#1B64DA);border-color:var(--accent,#1B64DA);color:#fff}',
    '.f3-stage{position:relative;height:min(68vh,620px);min-height:360px;border-radius:18px;overflow:hidden;background:linear-gradient(#F7F8FA,#EEF1F4);box-shadow:var(--shadow-card,0 1px 2px rgba(0,0,0,.06))}',
    '.f3-stage canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}',
    '.f3-stage canvas:active{cursor:grabbing}',
    '.f3-lbls{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
    '.f3-lbl{position:absolute;left:0;top:0;transform:translate(-50%,-50%);white-space:nowrap;font-size:11px;font-weight:700;color:#191F28;background:rgba(255,255,255,.88);border-radius:6px;padding:2px 6px;box-shadow:0 1px 3px rgba(0,0,0,.12)}',
    '.f3-lbl.fl{background:#191F28;color:#fff;font-weight:800}',
    '.f3-lbl.dwg{font-weight:600;color:#6B7684;background:rgba(255,255,255,.7)}',
    '.f3-lbl[hidden]{display:none}',
    '.f3-hint{position:absolute;left:12px;bottom:10px;font-size:.76rem;color:#6B7684;background:rgba(255,255,255,.8);border-radius:8px;padding:3px 8px;pointer-events:none}',
    '.f3-note{font-size:.78rem;color:var(--muted,#6B7684);margin:8px 0 0;line-height:1.5}',
    '.f3-err{padding:16px}'
  ].join('\n');

  function mount(el, api) {
    if (!document.getElementById('f3-css')) { var st = document.createElement('style'); st.id = 'f3-css'; st.textContent = CSS; document.head.appendChild(st); }
    el.classList.add('wide');
    el.innerHTML = '<div class="f3-head"><h1>층별 3D 도면</h1>' +
      '<div class="f3-tg" role="group" aria-label="층 켜고 끄기">' + FLOORS.map(function (f) { return '<button type="button" data-f3="' + f + '" aria-pressed="true">' + f + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="f3-reset" id="f3-reset" aria-label="처음 시점으로">처음 시점</button></div>' +
      '<div class="f3-stage" id="f3-stage"><canvas id="f3-c" aria-label="교육원 1·2·3층 3D 도면. 끌어서 돌리고 두 손가락이나 휠로 확대"></canvas><div class="f3-lbls" id="f3-lbls"></div>' +
      '<div class="f3-hint">끌어서 돌리기 · 두 손가락/휠 확대</div></div>' +
      '<p class="f3-note">항공정비실습동 준공도면(2020.04) 기준 단순 모형이에요. 벽은 1.3m 높이에서 자르고, 층 사이는 보기 쉽게 벌렸어요. 굵은 이름표는 앱 이름표, 흐린 이름표는 도면에 적힌 이름이에요.</p>';
    var base = document.baseURI;
    var url = function (p) { return new URL(p, base).href; };
    var dead = false, cleanup = [];
    function leave() {
      if (dead) return; dead = true;
      window.removeEventListener('hashchange', onHash);
      cleanup.forEach(function (f) { try { f(); } catch (e) { /* 이미 정리됨 */ } });
      cleanup = [];
    }
    function onHash() { if (!/^#\/floor3d/.test(location.hash)) leave(); }
    window.addEventListener('hashchange', onHash);

    Promise.all([
      import(url('3d/assets/vendor/three.module.min.js')),
      fetch(url('3d/assets/building.json')).then(function (r) { if (!r.ok) throw new Error('building.json'); return r.json(); }),
      fetch(url('3d/assets/labels.json')).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      if (dead) return;
      build(res[0], res[1], res[2]);
    }).catch(function (e) {
      if (dead) return;
      el.querySelector('#f3-stage').innerHTML = '<p class="f3-err muted">3D를 불러오지 못했어요. ' + api.esc(e && e.message || e) + '</p>';
    });

    function build(THREE, data, lab) {
      var stage = el.querySelector('#f3-stage'), canvas = el.querySelector('#f3-c'), lblBox = el.querySelector('#f3-lbls');
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
      catch (e) { stage.innerHTML = '<p class="f3-err muted">이 기기에서는 3D(WebGL)를 쓸 수 없어요.</p>'; return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(34, 1, 0.5, 600);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d1db, 1.6));
      var sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-30, 60, 40); scene.add(sun);

      var disposables = [];
      function keep(x) { disposables.push(x); return x; }
      var M = {
        slab: keep(new THREE.MeshLambertMaterial({ color: 0xf4f5f7 })),
        slabSide: keep(new THREE.MeshLambertMaterial({ color: 0xd9dee5 })),
        ext: keep(new THREE.MeshLambertMaterial({ color: 0xfbfbfa })),
        int: keep(new THREE.MeshLambertMaterial({ color: 0xeef0f2 })),
        cutTop: keep(new THREE.MeshBasicMaterial({ color: 0x8b95a1 }))
      };
      /* 방 바닥 색: 도면 이름의 종류로만 고름(새 방을 만들지 않음) */
      function roomColor(name) {
        if (/화장실/.test(name)) return 0xdbeafe;
        if (/복도|홀|계단/.test(name)) return 0xeceff3;
        if (/연구실|원장실|행정/.test(name)) return 0xe3f1e5;
        if (/창고|탈의/.test(name)) return 0xf3ead9;
        if (/휴게/.test(name)) return 0xfdeacc;
        return 0xfbe7dc;
      }
      var unitBox = keep(new THREE.BoxGeometry(1, 1, 1));
      var groups = {}, labels = [];
      var ids = {}; (data.rooms || []).forEach(function (r) { ids[r.id] = r; });
      FLOORS.forEach(function (fid, fi) {
        var F = (data.floors || []).filter(function (f) { return f.id === fid; })[0];
        if (!F) return;
        var g = new THREE.Group(), y0 = fi * SPREAD; groups[fid] = g; scene.add(g);
        (F.slabs || []).forEach(function (s) {
          var w = Math.abs(s[2] - s[0]), d = Math.abs(s[3] - s[1]);
          var m = new THREE.Mesh(unitBox, [M.slabSide, M.slabSide, M.slab, M.slabSide, M.slabSide, M.slabSide]);
          m.scale.set(w, 0.25, d); m.position.set((s[0] + s[2]) / 2, y0 - 0.125, -(s[1] + s[3]) / 2); g.add(m);
        });
        /* 벽: 같은 상자 하나를 늘려 한 번에 그림(InstancedMesh) — 휴대폰에서 가볍게 */
        var ws = (F.walls || []).filter(function (w) { return (w.kind === 'ext' || w.kind === 'int') && !((w.z0 || 0) >= CUT); });
        ['ext', 'int'].forEach(function (k) {
          var list = ws.filter(function (w) { return w.kind === k; }); if (!list.length) return;
          var im = new THREE.InstancedMesh(unitBox, M[k], list.length), cap = new THREE.InstancedMesh(unitBox, M.cutTop, list.length);
          var o = new THREE.Object3D();
          list.forEach(function (w, i) {
            var dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len = Math.sqrt(dx * dx + dy * dy), h = Math.min(w.h || CUT, CUT) - (w.z0 || 0);
            if (h <= 0.05) h = 0.05;
            o.position.set((w.a[0] + w.b[0]) / 2, y0 + (w.z0 || 0) + h / 2, -(w.a[1] + w.b[1]) / 2);
            o.rotation.set(0, Math.atan2(dy, dx), 0); o.scale.set(len + (w.t || 0.2), h, w.t || 0.2); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
            o.position.y = y0 + (w.z0 || 0) + h + 0.01; o.scale.y = 0.02; o.updateMatrix(); cap.setMatrixAt(i, o.matrix);
          });
          g.add(im); g.add(cap);
        });
        /* 방 바닥: building.json rooms 에 윤곽(poly)이 있는 방만 색칠 */
        (data.rooms || []).filter(function (r) { return r.floor === fid && r.poly && r.poly.length > 2; }).forEach(function (r) {
          var sh = new THREE.Shape(); r.poly.forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); });
          var geo = keep(new THREE.ShapeGeometry(sh)), mat = keep(new THREE.MeshLambertMaterial({ color: roomColor(r.dwg || ''), side: THREE.DoubleSide }));
          var m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y0 + 0.02; g.add(m);
        });
        /* 이름표: labels.json 의 그 층 이름(없으면 도면 이름). 위치는 데이터의 p 그대로 */
        var L = (lab && lab.labels && lab.labels[fid]) || [];
        var seen = {};
        L.forEach(function (l) {
          var text = [l.no, l.name].map(function (s) { return (s || '').trim(); }).filter(Boolean).join(' '), dwg = false;
          if (!text && ids[l.id] && ids[l.id].dwg) { text = ids[l.id].dwg; dwg = true; }
          if (!text || !l.p) return; seen[l.id] = 1;
          addLabel(text, dwg, l.p, fid, y0);
        });
        /* 층 표시: 그 층 바닥 서쪽 끝(데이터의 slabs 첫 칸) */
        if (F.slabs && F.slabs[0]) { var s0 = F.slabs[0]; addLabel(fid, false, [Math.min(s0[0], s0[2]) - 1.5, (s0[1] + s0[3]) / 2], fid, y0 - CUT - 0.3, 'fl'); }
        if (!L.length) (data.rooms || []).filter(function (r) { return r.floor === fid && r.dwg && r.p; }).forEach(function (r) { addLabel(r.dwg, true, r.p, fid, y0); });
      });
      function addLabel(text, dwg, p, fid, y0, cls) {
        var d = document.createElement('div'); d.className = 'f3-lbl' + (dwg ? ' dwg' : '') + (cls ? ' ' + cls : ''); d.textContent = text; lblBox.appendChild(d);
        labels.push({ el: d, f: fid, pr: cls ? 0 : dwg ? 2 : 1, v: new THREE.Vector3(p[0], y0 + CUT + 0.5, -p[1]) });
      }
      labels.sort(function (a, b) { return a.pr - b.pr; }); /* 겹치면 층 표시 > 앱 이름표 > 도면 이름 순으로 남김 */

      var box = new THREE.Box3(); FLOORS.forEach(function (f) { if (groups[f]) box.expandByObject(groups[f]); });
      var center = box.getCenter(new THREE.Vector3()), radius = box.getSize(new THREE.Vector3()).length() / 2;
      var HOME = { th: -0.62, ph: 1.08, r: radius * 2.25 };
      var cam = { th: HOME.th, ph: HOME.ph, r: HOME.r };
      var tmp = new THREE.Vector3();
      function place() {
        cam.ph = Math.max(0.18, Math.min(1.45, cam.ph)); cam.r = Math.max(radius * 0.7, Math.min(radius * 4, cam.r));
        camera.position.set(center.x + cam.r * Math.sin(cam.ph) * Math.sin(cam.th), center.y + cam.r * Math.cos(cam.ph), center.z + cam.r * Math.sin(cam.ph) * Math.cos(cam.th));
        camera.lookAt(center);
      }
      function size() {
        var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
        renderer.setSize(w, h, false); camera.aspect = w / h;
        camera.fov = w < 520 ? 44 : 34; camera.updateProjectionMatrix();
        /* 처음 거리: 가로·세로 중 좁은 쪽에 건물이 다 들어오게 */
        var vf = camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * camera.aspect);
        HOME.r = radius * (hf < vf ? 1.0 : 0.78) / Math.sin(Math.min(vf, hf)); /* 넓은 화면은 높이(층 쌓인 높이 포함 공)가 넉넉해서 좀 더 가까이 */
        if (!touched) cam.r = HOME.r;
        ask();
      }
      var queued = false;
      function ask() { if (!queued && !dead) { queued = true; requestAnimationFrame(frame); } }
      function frame() {
        queued = false; if (dead) return;
        place(); renderer.render(scene, camera);
        var w = stage.clientWidth, h = stage.clientHeight, taken = [];
        labels.forEach(function (l) {
          var on = groups[l.f] && groups[l.f].visible;
          if (on) { tmp.copy(l.v).project(camera); on = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05; }
          if (on) {
            var x = (tmp.x + 1) / 2 * w, y = (1 - tmp.y) / 2 * h;
            if (!l.w) { l.el.hidden = false; l.w = l.el.offsetWidth || 60; l.h = l.el.offsetHeight || 18; }
            var r = [x - l.w / 2 - 2, y - l.h / 2 - 1, x + l.w / 2 + 2, y + l.h / 2 + 1];
            /* 이름표끼리 겹치면 뒤 순서는 숨김(글자 겹침 방지) */
            on = !taken.some(function (t) { return r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]; });
            if (on) { taken.push(r); l.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)'; }
          }
          l.el.hidden = !on;
        });
        if (spin && !document.hidden) { cam.th += 0.0016; ask(); }
      }
      /* 움직임 줄이기 설정이면 저절로 돌지 않음. 손대면 멈춤 */
      var spin = !reduce;
      var touched = false;
      function stopSpin() { spin = false; touched = true; }

      /* 손가락·마우스: 한 손가락/끌기 = 돌리기, 두 손가락 = 확대/축소, 휠 = 확대/축소 */
      var pts = {}, pinch = 0;
      function count() { return Object.keys(pts).length; }
      function dist() { var k = Object.keys(pts); if (k.length < 2) return 0; var a = pts[k[0]], b = pts[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
      function down(e) { stopSpin(); canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; pinch = dist(); }
      function move(e) {
        var p = pts[e.pointerId]; if (!p) return;
        if (count() === 1) { cam.th -= (e.clientX - p.x) * 0.008; cam.ph -= (e.clientY - p.y) * 0.006; }
        p.x = e.clientX; p.y = e.clientY;
        if (count() >= 2) { var d = dist(); if (pinch && d) cam.r *= pinch / d; pinch = d; }
        ask();
      }
      function up(e) { delete pts[e.pointerId]; pinch = dist(); }
      function wheel(e) { e.preventDefault(); stopSpin(); cam.r *= Math.exp(e.deltaY * 0.0012); ask(); }
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('wheel', wheel, { passive: false });

      el.querySelectorAll('[data-f3]').forEach(function (b) {
        b.onclick = function () {
          var f = b.getAttribute('data-f3'), on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', String(on)); if (groups[f]) groups[f].visible = on; ask();
        };
      });
      el.querySelector('#f3-reset').onclick = function () { cam.th = HOME.th; cam.ph = HOME.ph; cam.r = HOME.r; ask(); };
      var ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(stage); else window.addEventListener('resize', size);
      function vis() { if (!document.hidden) ask(); }
      document.addEventListener('visibilitychange', vis);
      size(); ask();
      window.__f3 = { cam: cam, groups: groups, ask: ask, spin: function () { return spin; } }; /* 시험용(Playwright) */

      cleanup.push(function () {
        if (ro) ro.disconnect(); else window.removeEventListener('resize', size);
        document.removeEventListener('visibilitychange', vis);
        scene.traverse(function (o) { if (o.isInstancedMesh && o.dispose) o.dispose(); });
        disposables.forEach(function (d) { d.dispose(); });
        renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
        window.__f3 = null;
      });
    }
  }
  window.HJFloor3D = { mount: mount };
})();
