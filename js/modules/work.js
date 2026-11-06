/* 실무 탭: 판정 · 문서 만들기 · 자료함.
   화면 움직임 = 「상자 하나가 모양을 바꿈」 (봇공유 01 받은함/261106_모션그래픽_참고 기준) */
(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>';

  function escText(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 공용 도구 — 판정(judge)·문서 만들기(docgen)·자료함(library)이 같이 씀 */
  var WorkUI = {
    esc: escText,

    /* 화면 아래 가운데 섬: 진행(돌기) → 완료(주황 체크) → 사라짐 */
    island: function (text, done) {
      var el = document.getElementById('w-island');
      if (!el) {
        el = document.createElement('div');
        el.id = 'w-island';
        el.className = 'w-island';
        el.setAttribute('role', 'status');
        el.innerHTML = '<span class="w-isl-c"></span>';
        document.body.appendChild(el);
      }
      var c = el.firstChild;
      clearTimeout(el._t);
      el.classList.add('show', 'morphing');
      setTimeout(function () {
        el.classList.toggle('done', !!done);
        c.innerHTML = (done ? '<i class="w-check">✓</i>' : '<i class="w-spin"></i>') + '<b>' + escText(text) + '</b>';
        el.classList.remove('morphing');
      }, 150);
      if (done) el._t = setTimeout(function () { el.classList.remove('show', 'done'); }, 1600);
    },

    /* 숫자 굴리기 */
    countUp: function (node, to, ms, fmt) {
      fmt = fmt || function (v) { return Math.round(v).toLocaleString('ko-KR'); };
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = fmt(to); return; }
      var t0 = performance.now();
      (function f(t) {
        var p = Math.min(1, (t - t0) / (ms || 600)), e = 1 - Math.pow(1 - p, 3);
        node.textContent = fmt(to * e);
        if (p < 1) requestAnimationFrame(f);
      })(t0);
    },

    /* 세그먼트(검은 선택칸이 미끄러짐). opts = ['가','나'] 또는 [{v:'a', t:'가'}] */
    seg: function (name, opts, val) {
      var h = '<div class="w-seg" data-seg="' + escText(name) + '"><i class="w-thumb"></i>';
      opts.forEach(function (o) {
        var v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o;
        h += '<button type="button" data-v="' + escText(v) + '"' + (v === val ? ' class="on"' : '') + '>' + escText(t) + '</button>';
      });
      return h + '</div>';
    },
    bindSeg: function (root, onChange) {
      root.querySelectorAll('.w-seg').forEach(function (s) {
        function place() {
          var on = s.querySelector('button.on');
          var th = s.querySelector('.w-thumb');
          if (!on) { th.style.opacity = '0'; return; }
          th.style.opacity = '1';
          th.style.width = on.offsetWidth + 'px';
          th.style.transform = 'translateX(' + (on.offsetLeft - 3) + 'px)';
        }
        s.querySelectorAll('button').forEach(function (b) {
          b.onclick = function () {
            s.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
            b.classList.add('on');
            place();
            if (onChange) onChange(s.getAttribute('data-seg'), b.getAttribute('data-v'));
          };
        });
        requestAnimationFrame(place);
      });
    },
    segValue: function (root, name) {
      var b = root.querySelector('.w-seg[data-seg="' + name + '"] button.on');
      return b ? b.getAttribute('data-v') : '';
    },

    /* 내용 바꿀 때: 흐려졌다가 → 새 내용 선명하게 */
    swap: function (node, html, after) {
      node.classList.add('w-swap', 'w-morphing');
      setTimeout(function () {
        node.innerHTML = html;
        if (after) after();
        requestAnimationFrame(function () { node.classList.remove('w-morphing'); });
      }, 150);
    },

    copy: function (text) {
      function ok() { WorkUI.island('복사했어요', true); }
      function fail() { WorkUI.island('복사 못 함 — 길게 눌러 선택하세요', true); }
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(ok, fail);
      fail();
    },

    backBtn: '<button class="linkish" id="w-back" type="button">← 실무</button>',
    bindBack: function (el, api) {
      var b = el.querySelector('#w-back');
      if (b) b.onclick = function () { api.go('#/work'); };
    },

    /* public/ 아래 JSON 읽기 (한 번 읽으면 기억) */
    _cache: {},
    json: function (file) {
      if (WorkUI._cache[file]) return Promise.resolve(WorkUI._cache[file]);
      return fetch(new URL(file, document.baseURI).href, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(file);
        return r.json();
      }).then(function (j) { WorkUI._cache[file] = j; return j; });
    }
  };
  window.WorkUI = WorkUI;

  function render(el, api) {
    var items = [
      ['#/judge', '판정', '휴보강 해야 하나 · 계약 방법 · 사전승인 필요한가'],
      ['#/docgen', '문서 만들기', '칸 채우면 기안·계획서 초안 → 복사'],
      ['#/library', '자료함', '규정 · 업무 순서 · 양식 · 어디 있나']
    ];
    var h = '<section class="card w-hero"><p class="kicker">교육원 실무</p><h1>실무</h1>' +
      '<p class="muted">규칙대로 판정하고, 문서 초안을 만들고, 흩어진 자료를 한곳에서 찾아요. 입력한 내용은 이 기기 밖으로 나가지 않아요.</p></section>';
    items.forEach(function (it, i) {
      h += '<button class="list-btn w-menu" type="button" style="animation-delay:' + (i * 60) + 'ms" data-go="' + it[0] + '"><b>' + it[1] + '</b><span class="muted">' + it[2] + '</span></button>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { api.go(b.getAttribute('data-go')); };
    });
  }
  ShellModules.work = { id: 'work', tab: '실무', icon: icon, render: render };
})();
