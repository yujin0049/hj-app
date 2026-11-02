/* 문서대장 찾기 (#/docsearch) — 유진님 11.02. 「문서대장 부족한 부서랑, 키워드로 검색이나 ai 검색가능한 사이트를 앱 내에 만들어줘.(법령 ai검색처럼)」
   화면: #/docsearch(키워드 검색, ?q=&dept=&no=&from=&to=) · #/docsearch/ask(질문 검색, ?q=) · #/docsearch/gaps(부족 부서)
   자료: data/docreg.json(항공정비과 대장 공개 행) + data/docsearch.json(10.22.~10.30. 공개 행·부서별 대장 현황). 기안자·결재자 칸 없음.
   질문 검색은 「키 없이 도는 검색」: AI 모델·유료 키 없이 이 브라우저 안에서 낱말·같은 뜻 낱말 점수로 골라요(js/docsearch-core.js).
   디자인: 브랜드 C Datum Line(검정 바탕 · #4CC3FF 설계도 하늘색 선 · 한글 Hahmlet). 이 화면 안에서만 씀. */
(function (root) {
  'use strict';
  var icon = '';
  var data = null, loading = null, rowsCache = null;
  var PAGE = 20;
  var shown = PAGE, lastKey = '';

  function style() {
    if (!document.getElementById('ds-font')) {
      var l = document.createElement('link');
      l.id = 'ds-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@400;600;700&display=swap';
      document.head.appendChild(l);
    }
    if (document.getElementById('ds-style')) return;
    var s = document.createElement('style');
    s.id = 'ds-style';
    s.textContent = [
      '.ds{--sky:#4CC3FF;--sky-2:#9BDDFF;--sky-dim:rgba(76,195,255,.34);--sky-faint:rgba(76,195,255,.10);--ink:#EAF6FF;--mute:#8FA9BA;',
      'background:#000;color:var(--ink);border-radius:18px;padding:18px 16px 22px;margin:0 0 16px;position:relative;overflow:hidden;',
      'background-image:linear-gradient(var(--sky-faint) 1px,transparent 1px),linear-gradient(90deg,var(--sky-faint) 1px,transparent 1px);background-size:24px 24px;',
      'font-family:Hahmlet,Pretendard,"Apple SD Gothic Neo",serif;border:1px solid var(--sky-dim)}',
      '.ds *{box-sizing:border-box}',
      '.ds-kicker{font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;color:var(--sky);margin:0 0 6px;text-transform:uppercase}',
      '.ds h1{font-family:Hahmlet,serif;font-weight:700;font-size:26px;line-height:1.25;margin:0 0 6px;color:#fff}',
      '.ds h2{font-family:Hahmlet,serif;font-weight:600;font-size:18px;margin:18px 0 8px;color:#fff;border-left:3px solid var(--sky);padding-left:8px}',
      '.ds p{margin:4px 0;line-height:1.55}',
      '.ds .ds-meta{color:var(--mute);font-size:13px}',
      '.ds-rule{height:1px;background:linear-gradient(90deg,var(--sky),transparent);margin:12px 0}',
      '.ds-seg{display:flex;gap:6px;margin:12px 0 4px;flex-wrap:wrap}',
      '.ds-seg button{flex:1 1 0;min-width:0;min-height:44px;border:1px solid var(--sky-dim);background:transparent;color:var(--ink);border-radius:10px;font:600 14px Hahmlet,serif;cursor:pointer}',
      '.ds-seg button.on{background:var(--sky);color:#000;border-color:var(--sky)}',
      '.ds form{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 4px}',
      '.ds form .full{grid-column:1/-1}',
      '.ds label{display:block;font-size:12px;color:var(--mute);margin:0 0 3px}',
      '.ds input,.ds select,.ds textarea{width:100%;min-height:44px;background:#05121A!important;background-color:#05121A!important;color:#fff;border:1px solid var(--sky-dim);border-radius:10px;padding:10px 12px;font:15px Hahmlet,Pretendard,serif}',
      '.ds textarea{min-height:72px;resize:vertical}',
      '.ds input::placeholder,.ds textarea::placeholder{color:#7FA9BF}',
      '.ds input[type=date]{color-scheme:dark}',
      '.ds input:focus,.ds select:focus,.ds textarea:focus{outline:2px solid var(--sky);outline-offset:1px}',
      '.ds .ds-btns{display:flex;gap:8px}',
      '.ds .ds-go{flex:2;min-height:46px;background:var(--sky);color:#000;border:0;border-radius:10px;font:700 15px Hahmlet,serif;cursor:pointer}',
      '.ds .ds-ghost{flex:1;min-height:46px;background:transparent;color:var(--sky);border:1px solid var(--sky-dim);border-radius:10px;font:600 14px Hahmlet,serif;cursor:pointer}',
      '.ds-badge{display:inline-block;font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.04em;padding:5px 8px;border:1px solid var(--sky);color:var(--sky);border-radius:999px;margin:2px 4px 2px 0;white-space:nowrap}',
      '.ds-badge.solid{background:var(--sky);color:#000}',
      '.ds-keyfree{display:flex;gap:8px;align-items:flex-start;border:1px dashed var(--sky);border-radius:12px;padding:10px 12px;margin:10px 0;font-size:13px;color:var(--sky-2)}',
      '.ds-count{font:600 13px ui-monospace,Menlo,monospace;color:var(--sky);margin:12px 0 6px}',
      '.ds-list{list-style:none;margin:0;padding:0}',
      '.ds-item{border-top:1px solid var(--sky-dim);padding:10px 2px}',
      '.ds-item:last-child{border-bottom:1px solid var(--sky-dim)}',
      '.ds-no{font:600 12px ui-monospace,Menlo,monospace;color:var(--sky)}',
      '.ds-t{font-size:15px;color:#fff;margin:3px 0;word-break:keep-all;overflow-wrap:anywhere}',
      '.ds-sub{font-size:12px;color:var(--mute);overflow-wrap:anywhere}',
      '.ds mark{background:rgba(76,195,255,.28);color:#fff;border-radius:3px;padding:0 1px}',
      '.ds-bar{height:3px;background:var(--sky-faint);border-radius:2px;margin-top:6px}',
      '.ds-bar i{display:block;height:3px;background:var(--sky);border-radius:2px}',
      '.ds-more{width:100%;min-height:44px;margin-top:10px;background:transparent;border:1px solid var(--sky-dim);color:var(--sky);border-radius:10px;font:600 14px Hahmlet,serif;cursor:pointer}',
      '.ds-ans{border:1px solid var(--sky);border-radius:14px;padding:12px;margin:12px 0;background:rgba(0,20,30,.85)}',
      '.ds-ans b{color:#fff}',
      '.ds-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}',
      '.ds-chips button{min-height:36px;border:1px solid var(--sky-dim);background:#02090D;color:var(--ink);border-radius:999px;padding:6px 12px;font:13px Hahmlet,serif;cursor:pointer}',
      '.ds-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}',
      '.ds-stat{border:1px solid var(--sky-dim);border-radius:12px;padding:10px;text-align:center;background:rgba(0,0,0,.6)}',
      '.ds-stat b{display:block;font:700 26px/1.1 Hahmlet,serif;color:var(--sky)}',
      '.ds-stat span{font-size:12px;color:var(--mute)}',
      '.ds-limit{font-size:13px;line-height:1.5;color:#FFD48A;border-left:3px solid #FFB547;padding:6px 10px;margin:8px 0;background:rgba(40,25,0,.55);border-radius:0 8px 8px 0}',
      '.ds-warn{border:1px solid #FFB547;color:#FFD48A;border-radius:12px;padding:10px 12px;margin:10px 0;font-size:14px;background:rgba(40,25,0,.6)}',
      '.ds-swipe{display:none;font-size:12px;color:#7FA9BF;margin:4px 0}',
      '@media(max-width:600px){.ds-swipe{display:block}}',
      '.ds-tw{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--sky-dim);border-radius:12px;background:rgba(0,0,0,.7)}',
      '.ds table{width:100%;border-collapse:collapse;font-size:13px;min-width:520px}',
      '.ds th,.ds td{padding:8px 10px;border-bottom:1px solid var(--sky-faint);text-align:left;white-space:nowrap}',
      '.ds th{color:var(--sky);font:600 12px ui-monospace,Menlo,monospace;letter-spacing:.04em;background:#02101A;position:sticky;top:0}',
      '.ds td.num{text-align:right;font-family:ui-monospace,Menlo,monospace}',
      '.ds tr.lack td{color:#FFD48A}',
      '.ds tr.lack td:first-child{box-shadow:inset 3px 0 0 #FFB547}',
      '.ds-foot{font-size:12px;color:var(--mute);margin-top:14px;line-height:1.6}',
      '.ds a{color:var(--sky)}',
      '@media (max-width:520px){.ds{padding:16px 12px 20px;border-radius:14px}.ds h1{font-size:22px}.ds form{grid-template-columns:1fr}.ds-stat b{font-size:22px}}'
    ].join('');
    document.head.appendChild(s);
  }

  function load() {
    if (data) return Promise.resolve(data);
    if (loading) return loading;
    function get(f) { return fetch(new URL(f, document.baseURI).href, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(f); return r.json(); }); }
    function core() {
      if (root.HJDocSearch) return Promise.resolve();
      return new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = new URL('js/docsearch-core.js?v=1', document.baseURI).href;
        s.onload = function () { res(); }; s.onerror = function () { rej(new Error('js/docsearch-core.js')); };
        document.body.appendChild(s);
      });
    }
    loading = Promise.all([core(), get('data/docreg.json'), get('data/docsearch.json')]).then(function (a) {
      data = { docreg: a[1], ds: a[2] };
      rowsCache = root.HJDocSearch.buildRows(a[1], a[2].extra);
      return data;
    }).catch(function (e) { loading = null; throw e; });
    return loading;
  }

  function qparse(q) {
    var o = {};
    String(q || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1);
      try { o[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { o[k] = v; }
    });
    return o;
  }
  function qstr(o) {
    var p = [];
    Object.keys(o).forEach(function (k) { if (o[k]) p.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); });
    return p.length ? '?' + p.join('&') : '';
  }
  function hl(esc, text, words) {
    var t = esc(text);
    (words || []).filter(function (w) { return w && w.length >= 1; }).sort(function (a, b) { return b.length - a.length; }).forEach(function (w) {
      var ew = esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try { t = t.replace(new RegExp('(' + ew + ')(?![^<]*>)', 'gi'), '<mark>$1</mark>'); } catch (e) { /* 그대로 */ }
    });
    return t;
  }
  function fmtN(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  function head(api, tab) {
    var D = root.HJDocSearch, ds = data.ds, n = rowsCache.length;
    var first = rowsCache.length ? rowsCache[rowsCache.length - 1].d : '', last = rowsCache.length ? rowsCache[0].d : '';
    return '<p class="ds-kicker">DATUM · 문서대장 찾기</p><h1>문서대장 찾기</h1>' +
      '<p class="ds-meta">항공정비과 문서등록대장 공개 문서 <b id="ds-total">' + fmtN(n) + '</b>건 · ' + D.md(first) + '~' + D.md(last) +
      ' · 기안자·결재자 이름 없음 · <span class="ds-badge">키 없이 도는 검색</span></p>' +
      '<div class="ds-seg" role="tablist">' +
      '<button type="button" role="tab" data-tab="" class="' + (tab === '' ? 'on' : '') + '" aria-selected="' + (tab === '') + '">키워드 검색</button>' +
      '<button type="button" role="tab" data-tab="ask" class="' + (tab === 'ask' ? 'on' : '') + '" aria-selected="' + (tab === 'ask') + '">AI 질문</button>' +
      '<button type="button" role="tab" data-tab="gaps" class="' + (tab === 'gaps' ? 'on' : '') + '" aria-selected="' + (tab === 'gaps') + '">부족 부서</button></div><div class="ds-rule"></div>';
  }
  function itemHtml(esc, r, words, extra) {
    return '<li class="ds-item"><div class="ds-no">' + esc(r.short) + ' · ' + esc(root.HJDocSearch.md(r.d)) + ' · ' + esc(r.kind) + '</div>' +
      '<div class="ds-t">' + hl(esc, r.t, words) + '</div><div class="ds-sub">' + esc(r.dept || r.to) + (r.cat ? ' · ' + esc(r.cat) : '') + '</div>' + (extra || '') + '</li>';
  }

  function keywordPage(el, api, q) {
    var D = root.HJDocSearch, esc = api.esc;
    var f = { q: q.q || '', dept: q.dept || '', no: q.no || '', from: q.from || '', to: q.to || '' };
    var key = JSON.stringify(f); if (key !== lastKey) { shown = PAGE; lastKey = key; }
    var any = f.q || f.dept || f.no || f.from || f.to;
    var res = any ? D.filter(rowsCache, f) : [];
    var opts = D.deptOptions(rowsCache, 40);
    var h = '<section class="ds" id="ds">' + head(api, '') +
      '<form id="ds-kw" autocomplete="off">' +
      '<div class="full"><label for="ds-q">제목 낱말 (띄어 쓰면 모두 들어간 것만)</label><input id="ds-q" type="search" enterkeyhint="search" placeholder="예: 출장 결과" value="' + esc(f.q) + '"></div>' +
      '<div><label for="ds-dept">상대 부서</label><select id="ds-dept"><option value="">전체</option>' +
      opts.map(function (o) { return '<option value="' + esc(o.dept) + '"' + (o.dept === f.dept ? ' selected' : '') + '>' + esc(o.dept) + ' (' + o.n + ')</option>'; }).join('') + '</select></div>' +
      '<div><label for="ds-no">문서번호</label><input id="ds-no" inputmode="numeric" placeholder="예: 1418" value="' + esc(f.no) + '"></div>' +
      '<div><label for="ds-from">기간 시작</label><input id="ds-from" type="date" min="2026-03-01" max="2026-12-31" value="' + esc(f.from) + '"></div>' +
      '<div><label for="ds-to">기간 끝</label><input id="ds-to" type="date" min="2026-03-01" max="2026-12-31" value="' + esc(f.to) + '"></div>' +
      '<div class="full ds-btns"><button class="ds-go" type="submit" id="ds-go">찾기</button><button class="ds-ghost" type="button" id="ds-reset">지우기</button></div></form>';
    if (!any) {
      h += '<p class="ds-meta">낱말·부서·번호·기간 중 하나만 넣어도 찾아요. 빠른 예:</p><div class="ds-chips">' +
        ['강사료', '출장 결과', '수요조사', '전문교육기관', '현수막'].map(function (w) { return '<button type="button" data-kw="' + esc(w) + '">' + esc(w) + '</button>'; }).join('') + '</div>';
    } else {
      h += '<p class="ds-count" id="ds-count">찾은 문서 ' + fmtN(res.length) + '건</p>';
      if (!res.length) h += '<p class="ds-meta">맞는 문서가 없어요. 낱말을 줄이거나 「AI 질문」으로 물어보세요.</p>';
      var words = f.q.split(/\s+/).filter(Boolean);
      h += '<ul class="ds-list" id="ds-res">' + res.slice(0, shown).map(function (r) { return itemHtml(esc, r, words); }).join('') + '</ul>';
      if (res.length > shown) h += '<button class="ds-more" type="button" id="ds-more">' + Math.min(PAGE, res.length - shown) + '건 더 보기 (' + shown + '/' + res.length + ')</button>';
    }
    h += foot() + '</section>';
    el.innerHTML = h;
    wireTabs(el, api);
    var form = el.querySelector('#ds-kw');
    form.onsubmit = function (e) {
      e.preventDefault();
      api.go('#/docsearch' + qstr({ q: el.querySelector('#ds-q').value.trim(), dept: el.querySelector('#ds-dept').value, no: el.querySelector('#ds-no').value.trim(),
        from: el.querySelector('#ds-from').value, to: el.querySelector('#ds-to').value }));
    };
    el.querySelector('#ds-reset').onclick = function () { api.go('#/docsearch'); };
    el.querySelectorAll('[data-kw]').forEach(function (b) { b.onclick = function () { api.go('#/docsearch' + qstr({ q: b.getAttribute('data-kw') })); }; });
    var more = el.querySelector('#ds-more');
    if (more) more.onclick = function () { var y = window.scrollY; shown += PAGE; keywordPage(el, api, q); window.scrollTo(0, y); };
  }

  var EXAMPLES = ['연구실 안전교육 관련 공문 언제 왔어?', '교육원 전문교육기관 심사 결과는?', '10월에 받은 출장 관련 문서', '강사료 지급 원인행위 알려줘'];
  function askPage(el, api, q) {
    var D = root.HJDocSearch, esc = api.esc, question = q.q || '';
    var a = question ? D.ask(rowsCache, question, { limit: 12 }) : null;
    var h = '<section class="ds" id="ds">' + head(api, 'ask') +
      '<div class="ds-keyfree" id="ds-keyfree"><span class="ds-badge solid">키 없이 도는 검색</span><span>AI 모델·유료 키를 쓰지 않아요. 이 브라우저 안에서 질문을 낱말로 자르고, 같은 뜻 낱말(강사료↔시수·수당, 계약↔입찰·감리 …)로 넓혀 제목·분류·상대 부서에 맞은 만큼 점수를 매겨요. 「10월」「받은·보낸」도 읽어요.</span></div>' +
      '<form id="ds-ask" autocomplete="off"><div class="full"><label for="ds-aq">질문</label><textarea id="ds-aq" enterkeyhint="search" placeholder="예: 교육원 전문교육기관 심사 결과는?">' + esc(question) + '</textarea></div>' +
      '<div class="full ds-btns"><button class="ds-go" type="submit" id="ds-ask-go">물어보기</button><button class="ds-ghost" type="button" id="ds-ask-clear">지우기</button></div></form>' +
      '<div class="ds-chips">' + EXAMPLES.map(function (w) { return '<button type="button" data-ex="' + esc(w) + '">' + esc(w) + '</button>'; }).join('') + '</div>';
    if (a) {
      var words = a.expanded.map(function (e) { return e.w; });
      if (!a.hits.length) {
        h += '<div class="ds-ans" id="ds-ans"><p><b>가까운 문서를 못 찾았어요.</b></p><p class="ds-meta">읽은 낱말: ' + (a.terms.length ? a.terms.map(esc).join(', ') : '없음') + '. 다른 말로 물어보거나 키워드 검색을 써 보세요. 10.31. 이후 공문은 아직 대장에 없어요.</p></div>';
      } else {
        var s = a.summary;
        h += '<div class="ds-ans" id="ds-ans">' +
          '<p><b>가까운 문서 ' + fmtN(s.n) + '건</b> · ' + D.md(s.from) + '~' + D.md(s.to) + '</p>' +
          '<p class="ds-meta">많은 분류: ' + s.cats.map(function (c) { return esc(c[0]) + ' ' + c[1]; }).join(' · ') +
          (s.depts.length ? '<br>주요 상대 부서: ' + s.depts.map(function (c) { return esc(c[0]) + ' ' + c[1]; }).join(' · ') : '') + '</p>' +
          '<p style="margin-top:8px">근거 문서번호</p><div id="ds-evidence">' + s.evidence.map(function (n) { return '<span class="ds-badge">' + esc(n) + '</span>'; }).join('') + '</div>' +
          '<p class="ds-meta" style="margin-top:8px">읽은 낱말: ' + a.terms.map(esc).join(', ') +
          (a.intent.months.length ? ' · ' + a.intent.months.join('·') + '월' : '') + (a.intent.kind ? ' · ' + a.intent.kind : '') +
          ' · 넓힌 낱말 ' + Math.max(0, a.expanded.length - a.terms.length) + '개</p></div>';
        var top = a.hits[0].score;
        h += '<p class="ds-count">점수 높은 순 ' + a.hits.length + '건</p><ul class="ds-list" id="ds-ask-res">' + a.hits.map(function (x) {
          var pct = Math.max(6, Math.round(x.score / top * 100));
          return itemHtml(esc, x.r, words, '<div class="ds-sub">맞은 낱말: ' + x.matched.map(esc).join(', ') + '</div><div class="ds-bar" aria-label="점수 ' + pct + '"><i style="width:' + pct + '%"></i></div>');
        }).join('') + '</ul>';
      }
    }
    h += foot() + '</section>';
    el.innerHTML = h;
    wireTabs(el, api);
    var ta = el.querySelector('#ds-aq');
    el.querySelector('#ds-ask').onsubmit = function (e) { e.preventDefault(); api.go('#/docsearch/ask' + qstr({ q: ta.value.trim() })); };
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); el.querySelector('#ds-ask').requestSubmit ? el.querySelector('#ds-ask').requestSubmit() : el.querySelector('#ds-ask').onsubmit(e); } };
    el.querySelector('#ds-ask-clear').onclick = function () { api.go('#/docsearch/ask'); };
    el.querySelectorAll('[data-ex]').forEach(function (b) { b.onclick = function () { api.go('#/docsearch/ask' + qstr({ q: b.getAttribute('data-ex') })); }; });
  }

  function gapsPage(el, api) {
    var D = root.HJDocSearch, esc = api.esc, reg = data.ds.registers, nd = data.ds.nodept;
    var lack = D.gaps(reg);
    var h = '<section class="ds" id="ds">' + head(api, 'gaps') +
      '<p class="ds-limit" id="ds-limit" role="note">⚠ 한계: 대장 범위는 ' + esc(D.md(reg.base)) + '까지만(그 뒤 없음) · 협조부서 칸 없음(협조 건수는 덜 셈) · 교육원 자체 대장 없음(교육원 건수는 최소치)</p>' +
      '<div class="ds-stats" id="ds-stats"><div class="ds-stat"><b id="ds-files">' + reg.files + '</b><span>대장 파일</span></div>' +
      '<div class="ds-stat"><b id="ds-depts">' + reg.depts + '</b><span>부서</span></div>' +
      '<div class="ds-stat"><b id="ds-base">~' + esc(D.md(reg.base)) + '</b><span>기준일</span></div></div>' +
      '<div class="ds-warn" id="ds-lack"><b>부족 ' + lack.length + '곳</b> — ' + lack.map(function (r) {
        return esc(r.dept) + (r.status === '대장 없음' ? '(대장 없음)' : '(' + esc(D.md(r.gap_from)) + '~ 없음)');
      }).join(', ') + '. 10.31. 이후 공문은 모든 부서가 새 대장 필요(로그인=유진님).</div>' +
      '<h2>부서별 대장</h2><p class="ds-swipe">표는 옆으로 밀어 보세요 →</p><div class="ds-tw"><table id="ds-reg"><thead><tr><th>부서</th><th>기간</th><th>건수</th><th>빈 기간(~' + esc(D.md(reg.base)) + ')</th><th>상태</th></tr></thead><tbody>' +
      reg.rows.map(function (r) {
        var isLack = r.status === '부족' || r.status === '대장 없음';
        var gap = r.status === '대장 없음' ? '전부' : (r.gap_days > 0 ? esc(D.md(r.gap_from)) + '~ (' + r.gap_days + '일)' : '-');
        return '<tr class="' + (isLack ? 'lack' : '') + '"><td>' + esc(r.dept) + '</td><td>' + (r.start ? esc(r.start.slice(0, 4) !== '2026' ? r.start.slice(0, 4) + '.' + D.md(r.start) : D.md(r.start)) + '~' + esc(D.md(r.end)) : '-') + '</td>' +
          '<td class="num">' + (r.n == null ? '-' : fmtN(r.n)) + '</td><td>' + gap + '</td><td>' + esc(r.status) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="ds-meta">' + esc(reg.note) + '</p>' +
      '<h2>대장 파일이 아예 없는 부서 (참고)</h2><p class="ds-meta">' + esc(nd.note) + '</p>' +
      '<p class="ds-swipe">표는 옆으로 밀어 보세요 →</p><div class="ds-tw"><table id="ds-nodept"><thead><tr><th>부서</th><th>캠퍼스</th><th>보낸</th><th>받은</th><th>하는 일</th></tr></thead><tbody>' +
      nd.rows.map(function (r) {
        return '<tr><td>' + esc(r.dept) + '</td><td>' + esc(r.campus || '') + '</td><td class="num">' + fmtN(r.send_out) + '</td><td class="num">' + fmtN(r.recv_in) + '</td><td style="white-space:normal;min-width:180px">' + esc(r.role || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + foot() + '</section>';
    el.innerHTML = h;
    wireTabs(el, api);
  }

  function foot() {
    var ex = data.ds.extra;
    return '<p class="ds-foot">자료: 항공정비과 문서등록대장 공개 문서(3.4.~10.21. ' + fmtN(data.docreg.public_rows) + '건 + 10.22.~10.30. ' + fmtN(ex.n) + '건). 비공개·부분공개 문서와 제목에 사람 이름 모양이 있는 문서는 넣지 않았어요. ' +
      '다른 부서 대장 12개는 「부족 부서」 표에 기간·건수만 있어요. 질문 검색은 키 없이 도는 검색이라 뜻을 깊이 알아듣지는 못해요 — 근거 문서번호를 꼭 열어 확인해 주세요.</p>';
  }
  function wireTabs(el, api) {
    el.querySelectorAll('.ds-seg [data-tab]').forEach(function (b) {
      b.onclick = function () { var t = b.getAttribute('data-tab'); api.go('#/docsearch' + (t ? '/' + t : '')); };
    });
  }

  function render(el, api) {
    style();
    var route = api.route(), tab = route.parts[1] || '', q = qparse(route.query);
    function draw() {
      if (tab === 'ask') return askPage(el, api, q);
      if (tab === 'gaps') return gapsPage(el, api);
      return keywordPage(el, api, q);
    }
    if (data) return draw();
    el.innerHTML = '<section class="ds" aria-busy="true"><p class="ds-kicker">DATUM · 문서대장 찾기</p><p class="ds-meta">불러오는 중…</p></section>';
    load().then(function () {
      if (api.route().name !== 'docsearch') return;
      draw();
    }).catch(function (e) {
      el.innerHTML = '<section class="ds"><p class="ds-kicker">DATUM · 문서대장 찾기</p><p>⚠ 자료를 불러오지 못했어요(' + api.esc(e.message || e) + '). 새로고침해 주세요.</p></section>';
    });
  }
  ShellModules.docsearch = { id: 'docsearch', tab: '', icon: icon, render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
