(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>';
  var STATUSES = ['할 일', '진행 중', '확인 필요', '완료'];

  function list(api) { return api.pack().entities.work_items || []; }
  function save(api, items) { return api.setWorkItems(items); }

  function formHtml(api, w) {
    var cats = (api.pack().catalogs && api.pack().catalogs.stages) || [];
    var stageOpts = cats.map(function (s) {
      return '<option' + (w.stage === s ? ' selected' : '') + '>' + api.esc(s) + '</option>';
    }).join('');
    var statusOpts = STATUSES.map(function (s) {
      return '<option' + (w.status === s ? ' selected' : '') + '>' + api.esc(s) + '</option>';
    }).join('');
    return '<label class="field"><span>건명</span><input id="f-title" type="text" value="' + api.esc(w.title || '') + '"></label>' +
      '<label class="field"><span>예산</span><input id="f-budget" type="text" value="' + api.esc(w.budget || '') + '"></label>' +
      '<label class="field"><span>금액 (비우면 확인 필요)</span><input id="f-amount" type="text" inputmode="numeric" value="' + api.esc(w.amount == null ? '' : w.amount) + '"></label>' +
      '<label class="field"><span>상태</span><select id="f-status">' + statusOpts + '</select></label>' +
      '<label class="field"><span>현재 단계</span><select id="f-stage"><option value="">선택</option>' + stageOpts + '</select></label>' +
      '<label class="field"><span>마감</span><input id="f-due" type="date" value="' + api.esc(w.due || '') + '"></label>' +
      '<label class="field"><span>결재선</span><input id="f-line" type="text" value="' + api.esc(w.line || '') + '"></label>' +
      '<label class="field"><span>빠진 서류</span><textarea id="f-missing">' + api.esc(w.missing || '') + '</textarea></label>' +
      '<label class="field"><span>메모</span><textarea id="f-memo">' + api.esc(w.memo || '') + '</textarea></label>';
  }
  function read(api, base) {
    var amt = api.num(document.getElementById('f-amount').value);
    return {
      id: base.id,
      title: document.getElementById('f-title').value.trim(),
      budget: document.getElementById('f-budget').value.trim(),
      amount: Number.isNaN(amt) ? null : amt,
      status: document.getElementById('f-status').value,
      stage: document.getElementById('f-stage').value,
      due: document.getElementById('f-due').value,
      line: document.getElementById('f-line').value.trim(),
      missing: document.getElementById('f-missing').value.trim(),
      memo: document.getElementById('f-memo').value.trim()
    };
  }

  function render(el, api) {
    var route = api.route();
    var id = route.parts[1];
    if (id === 'new') return editor(el, api, null);
    if (id) return detail(el, api, id);
    var items = list(api);
    var h = '<section class="card"><h1>업무현황표</h1><p class="muted">건명, 예산, 금액, 단계, 마감, 결재선, 빠진 서류, 메모를 이 기기에만 저장해요.</p>' +
      '<button class="btn block" id="add" type="button">일 추가</button></section>';
    if (!items.length) h += '<section class="card"><p>아직 올린 일이 없어요.</p></section>';
    items.forEach(function (w) {
      var amt = w.amount == null || w.amount === '' ? '금액 확인 필요' : api.won(w.amount);
      h += '<button class="list-btn" type="button" data-id="' + api.esc(w.id) + '"><span class="badge' + (w.status === '완료' ? ' ok' : (w.status === '확인 필요' ? ' warn' : '')) + '">' + api.esc(w.status || '할 일') + '</span> ' +
        '<b>' + api.esc(w.title) + '</b><div class="item-meta">' + api.esc(w.budget || '예산 확인 필요') + ' · ' + api.esc(amt) + '<br>' +
        api.esc(w.stage || '단계 없음') + (w.due ? ' · ' + api.esc(w.due) : '') + '</div></button>';
    });
    el.innerHTML = h;
    el.querySelector('#add').onclick = function () { api.go('#/board/new'); };
    el.querySelectorAll('[data-id]').forEach(function (b) {
      b.onclick = function () { api.go('#/board/' + b.getAttribute('data-id')); };
    });
  }

  function detail(el, api, id) {
    var w = list(api).filter(function (x) { return x.id === id; })[0];
    if (!w) { el.innerHTML = '<section class="card"><p>없는 일이에요.</p></section>'; return; }
    var amt = w.amount == null || w.amount === '' ? '확인 필요' : api.won(w.amount);
    el.innerHTML = '<button class="linkish" id="back" type="button">← 목록</button>' +
      '<section class="card"><span class="badge">' + api.esc(w.status || '') + '</span><h1>' + api.esc(w.title) + '</h1>' +
      '<p><b>예산</b><br>' + api.esc(w.budget || '확인 필요') + '</p>' +
      '<p><b>금액</b><br>' + api.esc(amt) + '</p>' +
      '<p><b>현재 단계</b><br>' + api.esc(w.stage || '확인 필요') + '</p>' +
      '<p><b>마감</b><br>' + api.esc(w.due || '확인 필요') + '</p>' +
      '<p><b>결재선</b><br>' + api.esc(w.line || '확인 필요') + '</p>' +
      '<p><b>빠진 서류</b><br>' + api.esc(w.missing || '없음') + '</p>' +
      '<p><b>메모</b><br>' + api.esc(w.memo || '') + '</p>' +
      '<div class="row"><button class="btn" id="edit" type="button">고치기</button><button class="btn-ghost" id="del" type="button">지우기</button></div></section>';
    el.querySelector('#back').onclick = function () { api.go('#/board'); };
    el.querySelector('#edit').onclick = function () { api.go('#/board/' + id + '/edit'); };
    el.querySelector('#del').onclick = function () {
      if (!confirm('이 일을 지울까요?')) return;
      save(api, list(api).filter(function (x) { return x.id !== id; })).then(function () { api.go('#/board'); api.refresh(); });
    };
    if (api.route().parts[2] === 'edit') editor(el, api, w);
  }

  function editor(el, api, existing) {
    var w = existing || { id: 'w' + Date.now(), title: '', budget: '', amount: null, status: '할 일', stage: '', due: '', line: '', missing: '', memo: '' };
    el.innerHTML = '<button class="linkish" id="back" type="button">← 뒤로</button><section class="card"><h1>' + (existing ? '일 고치기' : '일 추가') + '</h1>' +
      formHtml(api, w) + '<button class="btn block" id="save" type="button">저장</button></section>';
    el.querySelector('#back').onclick = function () { api.go(existing ? '#/board/' + existing.id : '#/board'); };
    el.querySelector('#save').onclick = function () {
      var next = read(api, w);
      if (!next.title) { api.toast('건명을 적어 주세요.'); return; }
      var items = list(api).slice();
      var i = items.findIndex(function (x) { return x.id === next.id; });
      if (i >= 0) items[i] = next; else items.unshift(next);
      save(api, items).then(function () { api.toast('저장했어요.'); api.go('#/board/' + next.id); api.refresh(); });
    };
  }

  var _render = render;
  ShellModules.board = {
    id: 'board', tab: '업무', icon: icon,
    render: function (el, api) {
      var parts = api.route().parts;
      if (parts[2] === 'edit' && parts[1] && parts[1] !== 'new') {
        var w = list(api).filter(function (x) { return x.id === parts[1]; })[0];
        if (!w) { el.innerHTML = '<section class="card"><p>없는 일이에요.</p></section>'; return; }
        return editor(el, api, w);
      }
      return _render(el, api);
    }
  };
})();
