(function () {
  var CATS = (window.APNews && APNews.CATS) || ['행사', '과정', '일정변경', '공지', '사진일지', '기타'];
  var STATUSES = ['확인됨', '확인 필요', '취소'];

  function list(api) {
    return (api.pack().entities.news || []);
  }
  function monthsOf(items) {
    var map = {};
    items.forEach(function (n) { if (n.date) map[n.date.slice(0, 7)] = 1; });
    return Object.keys(map).sort().reverse();
  }
  function blank() {
    var d = new Date();
    var date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return { id: '', date: date, title: '', summary: '', source_bot: '', source_link: '', source: '', category: '기타', status: '확인 필요' };
  }

  function render(el, api) {
    var parts = api.route().parts;
    if (parts[1] === 'new') return editor(el, api, blank());
    if (parts[1] === 'paste') return paste(el, api);
    if (parts[1]) {
      var found = list(api).filter(function (n) { return n.id === parts[1]; })[0];
      if (!found) { el.innerHTML = '<section class="card"><p>없는 소식이에요.</p></section>'; return; }
      return editor(el, api, found);
    }
    board(el, api);
  }

  function board(el, api) {
    var all = list(api);
    var cat = '';
    var month = '';
    try {
      var q = new URLSearchParams(location.hash.split('?')[1] || '');
      cat = q.get('cat') || '';
      month = q.get('m') || '';
    } catch (e) { cat = ''; month = ''; }
    var rows = APNews.filterNews(all, { category: cat, month: month });
    var h = '<button class="linkish" id="back" type="button">← 더보기</button><section class="card"><p class="kicker">알림 없음</p><h1>교육원 소식</h1>' +
      '<p class="muted">최근 것이 위로 와요. 알림은 보내지 않아요.</p>' +
      '<div class="row"><button class="btn" id="add" type="button">소식 추가</button><button class="btn-ghost" id="paste" type="button">목록 붙여넣기</button></div></section>';
    h += '<section class="card"><p class="kicker">분류</p><div class="chips">';
    h += '<button class="chip' + (cat ? '' : ' on') + '" type="button" data-cat="">전체</button>';
    CATS.forEach(function (c) {
      h += '<button class="chip' + (cat === c ? ' on' : '') + '" type="button" data-cat="' + api.esc(c) + '">' + api.esc(c) + '</button>';
    });
    h += '</div><label class="field"><span>월</span><select id="month"><option value="">전체</option>';
    monthsOf(all).forEach(function (m) {
      h += '<option value="' + api.esc(m) + '"' + (month === m ? ' selected' : '') + '>' + api.esc(m) + '</option>';
    });
    h += '</select></label></section>';
    if (!rows.length) h += '<section class="card"><p>이 조건의 소식이 없어요.</p></section>';
    rows.forEach(function (n) {
      h += '<button class="list-btn" type="button" data-id="' + api.esc(n.id) + '">' +
        '<span class="badge">' + api.esc(n.category || '기타') + '</span> ' +
        (n.status === '확인 필요' ? '<span class="badge warn">확인 필요</span> ' : '') +
        (n.status === '취소' ? '<span class="badge no">취소</span> ' : '') +
        '<b' + (n.status === '취소' ? ' class="strike"' : '') + '>' + api.esc(n.title) + '</b><div class="item-meta">' + api.esc(n.date) + ' · ' + api.esc(n.summary || '') + '</div></button>';
    });
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelector('#add').onclick = function () { api.go('#/news/new'); };
    el.querySelector('#paste').onclick = function () { api.go('#/news/paste'); };
    el.querySelectorAll('[data-cat]').forEach(function (b) {
      b.onclick = function () {
        var next = b.getAttribute('data-cat') || '';
        api.go('#/news' + (next || month ? '?' + (next ? 'cat=' + encodeURIComponent(next) : '') + (month ? (next ? '&' : '') + 'm=' + encodeURIComponent(month) : '') : ''));
      };
    });
    el.querySelector('#month').onchange = function (e) {
      var m = e.target.value;
      api.go('#/news' + (cat || m ? '?' + (cat ? 'cat=' + encodeURIComponent(cat) : '') + (m ? (cat ? '&' : '') + 'm=' + encodeURIComponent(m) : '') : ''));
    };
    el.querySelectorAll('[data-id]').forEach(function (b) {
      b.onclick = function () { api.go('#/news/' + b.getAttribute('data-id')); };
    });
  }

  function field(id, label, value, kind) {
    var v = value == null ? '' : value;
    if (kind === 'area') return '<label class="field"><span>' + label + '</span><textarea id="' + id + '">' + v + '</textarea></label>';
    return '<label class="field"><span>' + label + '</span><input id="' + id + '" type="' + (kind || 'text') + '" value="' + v + '"></label>';
  }

  function editor(el, api, n) {
    var catOpts = CATS.map(function (c) { return '<option' + (n.category === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    var stOpts = STATUSES.map(function (s) { return '<option' + (n.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    el.innerHTML = '<button class="linkish" id="back" type="button">← 소식</button><section class="card"><h1>' + (n.id ? '소식 고치기' : '소식 추가') + '</h1>' +
      field('f-date', '날짜', api.esc(n.date), 'date') +
      field('f-title', '제목', api.esc(n.title)) +
      field('f-sum', '요약', api.esc(n.summary), 'area') +
      field('f-bot', '출처 봇', api.esc(n.source_bot)) +
      field('f-link', '링크', api.esc(n.source_link)) +
      field('f-src', '출처 메모', api.esc(n.source)) +
      '<label class="field"><span>분류</span><select id="f-cat">' + catOpts + '</select></label>' +
      '<label class="field"><span>상태</span><select id="f-status">' + stOpts + '</select></label>' +
      '<div class="row"><button class="btn" id="save" type="button">저장</button>' +
      (n.id ? '<button class="btn-ghost" id="del" type="button">지우기</button>' : '') +
      '</div></section>';
    el.querySelector('#back').onclick = function () { api.go('#/news'); };
    el.querySelector('#save').onclick = function () {
      var item = {
        id: n.id || APNews.idFor(document.getElementById('f-date').value, document.getElementById('f-title').value.trim() || '새 소식'),
        date: document.getElementById('f-date').value,
        title: document.getElementById('f-title').value.trim(),
        summary: document.getElementById('f-sum').value.trim(),
        source_bot: document.getElementById('f-bot').value.trim(),
        source_link: document.getElementById('f-link').value.trim(),
        source: document.getElementById('f-src').value.trim(),
        category: document.getElementById('f-cat').value,
        status: document.getElementById('f-status').value
      };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !item.title) { api.toast('날짜와 제목을 적어 주세요.'); return; }
      api.saveNews(item).then(function () { api.toast('소식을 저장했어요.'); api.go('#/news'); });
    };
    var del = el.querySelector('#del');
    if (del) del.onclick = function () {
      api.deleteNews(n.id).then(function () { api.toast('지웠어요.'); api.go('#/news'); });
    };
  }

  function paste(el, api) {
    el.innerHTML = '<button class="linkish" id="back" type="button">← 소식</button><section class="card"><h1>목록 붙여넣기</h1>' +
      '<p class="muted">한 줄에 하나. 날짜 | 제목 | 요약 | 출처. 출처 끝에 (행사)나 (공지, 확인 필요)를 붙이면 분류와 상태가 돼요.</p>' +
      '<label class="field"><span>목록</span><textarea id="blob" placeholder="2026-10-23 | 제목 | 요약 | 출처 (행사)"></textarea></label>' +
      '<button class="btn block" id="go" type="button">넣기</button><p id="msg" class="muted"></p></section>';
    el.querySelector('#back').onclick = function () { api.go('#/news'); };
    el.querySelector('#go').onclick = function () {
      var parsed = APNews.parsePaste(document.getElementById('blob').value);
      if (!parsed.items.length) { el.querySelector('#msg').textContent = '읽을 줄이 없어요. 날짜는 2026-10-23처럼 적어요.'; return; }
      api.importNews(parsed.items).then(function (r) {
        api.toast(r.added + '건을 넣었어요.');
        api.go('#/news');
      });
    };
  }

  ShellModules.news = { id: 'news', tab: '', icon: '', render: render };
})();
