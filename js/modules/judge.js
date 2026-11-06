/* 실무 › 판정 — 규칙은 public/judge.json (코드 안 고치고 JSON만 고침).
   입력이 바뀌면 결과 상자 하나가 흐려졌다가 새 판정으로 바뀜 (WorkUI.swap). */
(function () {
  var FILE = 'public/judge.json';

  function W() { return window.WorkUI; }
  function esc(s) { return W().esc(s); }
  function won(n) { return Math.round(n).toLocaleString('ko-KR'); }
  function digits(s) { return String(s == null ? '' : s).replace(/[^0-9]/g, ''); }

  /* 조건 하나 맞나: 값 / 배열(그중 하나) / {gte,gt,lte,lt} / {from,to} / {empty:true} */
  function test(val, cond) {
    if (Array.isArray(cond)) return cond.indexOf(val) >= 0;
    if (cond && typeof cond === 'object') {
      var empty = val === '' || val == null;
      if (cond.empty) return empty;
      if (empty) return false;
      if (cond.from != null || cond.to != null) {
        if (cond.from != null && String(val) < cond.from) return false;
        if (cond.to != null && String(val) > cond.to) return false;
        return true;
      }
      var n = Number(val);
      if (cond.gte != null && !(n >= cond.gte)) return false;
      if (cond.gt != null && !(n > cond.gt)) return false;
      if (cond.lte != null && !(n <= cond.lte)) return false;
      if (cond.lt != null && !(n < cond.lt)) return false;
      return true;
    }
    return val === cond;
  }
  function match(when, v) {
    return Object.keys(when || {}).every(function (k) { return test(v[k], when[k]); });
  }

  /* 규칙 돌리기: 처음 맞는 것 = 결론, adds 는 맞는 것 모두 덧붙임 */
  function decide(kind, v) {
    var main = (kind.rules || []).filter(function (r) { return match(r.when, v); })[0];
    if (!main) return null;
    var out = {
      tone: main.tone || '', verdict: main.verdict || '',
      reasons: (main.reasons || []).slice(), basis: (main.basis || []).slice(),
      next: (main.next || []).slice(), check: main.check ? [main.check] : []
    };
    var stop = main.when && main.when.amount && main.when.amount.empty;
    stop = stop || (main.when && main.when.date && main.when.date.empty);
    if (!stop) {
      (kind.adds || []).forEach(function (a) {
        if (!match(a.when, v)) return;
        (a.reasons || []).forEach(function (x) { out.reasons.push(x); });
        (a.basis || []).forEach(function (x) { if (out.basis.indexOf(x) < 0) out.basis.push(x); });
        (a.next || []).forEach(function (x) { if (out.next.indexOf(x) < 0) out.next.push(x); });
        if (a.check) out.check.push(a.check);
      });
    }
    return out;
  }

  /* 화면 값 모으기 (money 는 부가세 포함이면 ÷1.1 → 추정가격) */
  function values(root, kind) {
    var v = {};
    (kind.inputs || []).forEach(function (inp) {
      if (inp.type === 'seg') v[inp.id] = W().segValue(root, inp.id);
      else if (inp.type === 'money') {
        var raw = digits((root.querySelector('[data-in="' + inp.id + '"]') || {}).value);
        v[inp.id + 'Raw'] = raw === '' ? '' : Number(raw);
        v[inp.id] = v[inp.id + 'Raw'];
      } else {
        v[inp.id] = (root.querySelector('[data-in="' + inp.id + '"]') || {}).value || '';
      }
    });
    (kind.inputs || []).forEach(function (inp) {
      if (inp.type === 'money' && inp.vatFrom && v[inp.id] !== '' && v[inp.vatFrom] === 'inc') {
        v[inp.id] = Math.round(v[inp.id] / 1.1);
      }
    });
    return v;
  }

  function formHtml(kind, state) {
    var h = '<p class="muted" style="margin:0 0 4px">' + esc(kind.lead || '') + '</p>';
    (kind.inputs || []).forEach(function (inp) {
      var cur = state[inp.id];
      h += '<label class="w-field">' + esc(inp.label) + '</label>';
      if (inp.type === 'seg') {
        h += W().seg(inp.id, inp.opts || [], cur != null ? cur : inp.def);
      } else if (inp.type === 'money') {
        h += '<input type="text" inputmode="numeric" autocomplete="off" class="w-num" placeholder="예: 22,000,000" data-in="' + esc(inp.id) + '" value="' + esc(cur ? won(cur) : '') + '">';
        if (inp.quick && inp.quick.length) {
          h += '<div class="chips" style="margin-top:8px">';
          inp.quick.forEach(function (q) {
            h += '<button type="button" class="chip" style="background:var(--soft)" data-quick="' + esc(inp.id) + '" data-n="' + q + '">' + esc(short(q)) + '</button>';
          });
          h += '</div>';
        }
      } else if (inp.type === 'date') {
        var dv = cur != null ? cur : (inp.def === 'today' ? today() : (inp.def || ''));
        state[inp.id] = dv;
        h += '<input type="date" data-in="' + esc(inp.id) + '" value="' + esc(dv) + '">';
      }
    });
    return h;
  }
  function today() {
    var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function short(n) {
    if (n >= 100000000 && n % 100000000 === 0) return (n / 100000000) + '억';
    if (n % 10000000 === 0) return (n / 10000000) + '천만';
    return won(n / 10000) + '만';
  }

  function resultHtml(kind, r, v) {
    if (!r) return '<p class="kicker" style="color:#fff">판정</p><h2>맞는 규칙이 없어요</h2><p>judge.json 규칙을 확인해 주세요.</p>';
    var h = '<p class="kicker" style="color:rgba(255,255,255,.75)">' + esc(kind.title) + '</p>';
    h += '<h2 style="font-size:1.45rem;line-height:1.3;margin:2px 0 8px;display:flex;gap:8px;align-items:flex-start">' +
      (r.tone === 'ok' ? '<i class="w-check" style="background:#fff;color:var(--w-accent);flex:none;margin-top:3px">✓</i>' : '') +
      '<span>' + esc(r.verdict) + '</span></h2>';
    var amt = null;
    (kind.inputs || []).forEach(function (inp) { if (inp.type === 'money' && v[inp.id] !== '') amt = inp; });
    if (amt && kind.showAmount) {
      h += '<p style="margin:0 0 10px">' + esc(kind.showAmount) + ' <b class="w-num" data-count="' + v[amt.id] + '" style="font-size:1.25rem">0</b>원';
      if (amt.vatFrom && v[amt.vatFrom] === 'inc') h += '<br><span style="opacity:.75;font-size:.85rem">입력 ' + won(v[amt.id + 'Raw']) + '원 ÷ 1.1 (부가세 뺌)</span>';
      h += '</p>';
    }
    h += list('이유', r.reasons, 'ul');
    h += list('다음 할 일', r.next, 'ol');
    h += list('근거', r.basis.map(function (b) { return '「' + b + '」'; }), 'ul', true);
    if (r.check.length) {
      h += '<div style="background:rgba(255,255,255,.14);border-radius:12px;padding:10px 12px;margin-top:10px"><b>확인 필요</b>' +
        '<ul style="margin:6px 0 0;padding-left:18px">' + r.check.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    }
    return h;
  }
  function list(title, items, tag, small) {
    if (!items || !items.length) return '';
    return '<p style="margin:12px 0 2px"><b>' + esc(title) + '</b></p><' + tag + ' style="margin:0;padding-left:20px;' + (small ? 'font-size:.86rem;opacity:.9' : '') + '">' +
      items.map(function (x) { return '<li style="margin:3px 0">' + esc(x) + '</li>'; }).join('') + '</' + tag + '>';
  }
  function resultText(kind, r) {
    if (!r) return '';
    var t = ['[' + kind.title + '] ' + r.verdict];
    if (r.reasons.length) t.push('', '이유', r.reasons.map(function (x) { return '- ' + x; }).join('\n'));
    if (r.next.length) t.push('', '다음 할 일', r.next.map(function (x) { return '- ' + x; }).join('\n'));
    if (r.basis.length) t.push('', '근거', r.basis.map(function (x) { return '- 「' + x + '」'; }).join('\n'));
    if (r.check.length) t.push('', '확인 필요', r.check.map(function (x) { return '- ' + x; }).join('\n'));
    return t.join('\n');
  }

  function page(el, api, data) {
    var kinds = data.kinds || [];
    var want = api.route().parts[1];
    var kind = kinds.filter(function (k) { return k.id === want; })[0] || kinds[0];
    var memo = {};
    var last = null, lastKey = '', timer = null;

    el.innerHTML = W().backBtn +
      '<section class="card"><p class="kicker">실무 · 판정</p><h1>판정</h1>' +
      '<p class="muted" style="margin-bottom:10px">고르면 바로 결론이 나와요. 규정이 바뀌면 근거 문서를 다시 보세요.</p>' +
      W().seg('kind', kinds.map(function (k) { return { v: k.id, t: k.tab || k.title }; }), kind.id) +
      '</section>' +
      '<section class="card"><h2 id="j-title" style="margin-top:0">' + esc(kind.title) + '</h2><div id="j-form" class="w-swap"></div></section>' +
      '<div id="j-res" class="w-result w-swap" aria-live="polite"></div>' +
      '<div class="row" style="margin:4px 0 24px"><button type="button" class="btn-ghost small" id="j-copy">결과 복사</button>' +
      '<span class="muted" style="font-size:.85rem">기준일 ' + esc(data.version || '') + '</span></div>';
    W().bindBack(el, api);

    var form = el.querySelector('#j-form');
    var res = el.querySelector('#j-res');

    function stateOf(k) { return memo[k.id] || (memo[k.id] = {}); }

    function update(now) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var v = values(form, kind);
        var r = decide(kind, v);
        last = r;
        var key = JSON.stringify([kind.id, r, v]);
        if (key === lastKey) return;
        lastKey = key;
        res.className = 'w-result w-swap' + (r && r.tone ? ' ' + r.tone : '');
        W().swap(res, resultHtml(kind, r, v), function () {
          res.querySelectorAll('[data-count]').forEach(function (n) {
            W().countUp(n, Number(n.getAttribute('data-count')) || 0, 600);
          });
        });
      }, now ? 0 : 280);
    }

    function drawForm(first) {
      var st = stateOf(kind);
      function fill() {
        form.innerHTML = formHtml(kind, st);
        W().bindSeg(form, function (name, val) { st[name] = val; update(true); });
        form.querySelectorAll('input[data-in]').forEach(function (inp) {
          var id = inp.getAttribute('data-in');
          var isMoney = inp.getAttribute('inputmode') === 'numeric';
          inp.addEventListener('input', function () {
            if (isMoney) {
              var d = digits(inp.value).slice(0, 13);
              inp.value = d ? won(Number(d)) : '';
              st[id] = d ? Number(d) : '';
            } else st[id] = inp.value;
            update(false);
          });
          inp.addEventListener('change', function () { update(true); });
        });
        form.querySelectorAll('[data-quick]').forEach(function (b) {
          b.onclick = function () {
            var id = b.getAttribute('data-quick'), n = Number(b.getAttribute('data-n'));
            var inp = form.querySelector('[data-in="' + id + '"]');
            if (inp) inp.value = won(n);
            st[id] = n;
            update(true);
          };
        });
        update(true);
      }
      el.querySelector('#j-title').textContent = kind.title;
      if (first) fill(); else W().swap(form, '', fill);
    }

    W().bindSeg(el.querySelector('section.card'), function (name, val) {
      if (name !== 'kind') return;
      kind = kinds.filter(function (k) { return k.id === val; })[0] || kinds[0];
      lastKey = '';
      try { history.replaceState(null, '', '#/judge/' + kind.id); } catch (e) { /* 그대로 */ }
      drawForm(false);
    });
    el.querySelector('#j-copy').onclick = function () {
      if (last) W().copy(resultText(kind, last));
    };
    drawForm(true);
  }

  function render(el, api) {
    if (!window.WorkUI) {
      el.innerHTML = '<section class="card"><h1>판정</h1><p class="muted">화면 도구를 못 불러왔어요. 새로고침해 주세요.</p></section>';
      return;
    }
    el.innerHTML = W().backBtn + '<section class="card"><p class="kicker">실무 · 판정</p><h1>판정</h1><p class="muted">규칙 불러오는 중…</p></section>';
    W().bindBack(el, api);
    W().json(FILE).then(function (data) {
      if (!data || !Array.isArray(data.kinds) || !data.kinds.length) throw new Error('규칙이 비었어요');
      page(el, api, data);
    }).catch(function (e) {
      el.innerHTML = W().backBtn + '<section class="card"><p class="kicker">실무 · 판정</p><h1>규칙을 못 불러왔어요</h1>' +
        '<p class="muted">인터넷 연결을 확인하고 새로고침해 주세요.</p><p class="muted" style="font-size:.85rem">(' + esc(e && e.message || e) + ')</p>' +
        '<button type="button" class="btn small" id="j-retry">다시 해 보기</button></section>';
      W().bindBack(el, api);
      el.querySelector('#j-retry').onclick = function () { delete W()._cache[FILE]; render(el, api); };
    });
  }

  window.ShellModules = window.ShellModules || {};
  window.ShellModules.judge = { id: 'judge', render: render };
})();
