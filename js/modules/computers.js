(function () {
  function list(api) { return api.pack().entities.computers || []; }
  function qget(api) {
    var p = new URLSearchParams(api.route().query || '');
    return { version: p.get('ver') || '', location: p.get('loc') || '', replace: p.get('rep') === '1', unconfirmed: p.get('miss') === '1' };
  }
  function href(f) {
    var q = [];
    if (f.version) q.push('ver=' + encodeURIComponent(f.version));
    if (f.location) q.push('loc=' + encodeURIComponent(f.location));
    if (f.replace) q.push('rep=1');
    if (f.unconfirmed) q.push('miss=1');
    return '#/computers' + (q.length ? '?' + q.join('&') : '');
  }
  function uniq(rows, key) {
    var map = {};
    rows.forEach(function (r) { if (r[key]) map[r[key]] = 1; });
    return Object.keys(map).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
  }

  function render(el, api) {
    var parts = api.route().parts;
    if (parts[1] === 'paste') return paste(el, api);
    if (parts[1]) {
      var found = list(api).filter(function (r) { return r.id === parts[1]; })[0];
      if (!found) { el.innerHTML = '<section class="card"><p>없는 컴퓨터예요.</p></section>'; return; }
      return editor(el, api, found);
    }
    board(el, api);
  }

  function board(el, api) {
    var all = list(api);
    var f = qget(api);
    var sum = APComputers.summarize(all);
    var rows = APComputers.filterComputers(all, {
      version: f.unconfirmed ? '미확인' : f.version,
      location: f.location,
      replace: f.replace
    });
    var versions = uniq(all.map(function (r) { return { os_version: r.os_version || '미확인' }; }), 'os_version');
    var h = '<button class="linkish" id="back" type="button">← 더보기</button>';
    h += '<section class="card"><p class="kicker">프로그램이 센 대수</p><h1>컴퓨터 현황</h1>';
    if (!all.length) {
      h += '<p>엑셀봇 자료를 가져오면 여기에 보여요.</p><p class="muted">알려진 현황: 실제 37대, 교체대상 5대, 윈도우 버전 확인 중.</p>';
    } else {
      h += '<div class="statgrid"><div><b>' + sum.total + '</b><span>대수</span></div><div><b>' + sum.unconfirmed + '</b><span>버전 미확인</span></div><div><b>' + sum.replace + '</b><span>교체대상</span></div><div><b>' + sum.excluded + '</b><span>대수 제외</span></div></div>';
      var names = Object.keys(sum.versions);
      if (!names.length) h += '<p class="muted">윈도우 버전이 적힌 대수가 없어요.</p>';
      names.sort().forEach(function (name) {
        h += '<p class="item-meta">' + api.esc(name) + ' · ' + sum.versions[name] + '대</p>';
      });
      if (sum.excluded) h += '<p class="muted">대수 제외 ' + sum.excluded + '대는 합계 ' + sum.total + '대에 넣지 않았어요. 목록에는 보여요.</p>';
    }
    h += '<div class="row"><button class="btn" id="paste" type="button">CSV 가져오기</button><button class="btn-ghost" id="out" type="button">CSV 내보내기</button></div><p class="muted">IP 칸은 없어요. 같은 번호·위치·모델은 한 대로만 세요.</p></section>';

    if (all.length) {
      h += '<section class="card"><div class="chips">';
      h += '<button class="chip' + (!f.replace && !f.unconfirmed && !f.version ? ' on' : '') + '" type="button" data-chip="all">전체</button>';
      h += '<button class="chip' + (f.replace ? ' on' : '') + '" type="button" data-chip="rep">교체대상</button>';
      h += '<button class="chip' + (f.unconfirmed ? ' on' : '') + '" type="button" data-chip="miss">버전 미확인</button>';
      h += '</div><label class="field"><span>윈도우 버전</span><select id="ver"><option value="">전체</option>';
      versions.forEach(function (v) {
        h += '<option value="' + api.esc(v) + '"' + (f.version === v ? ' selected' : '') + '>' + api.esc(v) + '</option>';
      });
      h += '</select></label><label class="field"><span>위치</span><select id="loc"><option value="">전체</option>';
      uniq(all, 'location').forEach(function (v) {
        h += '<option value="' + api.esc(v) + '"' + (f.location === v ? ' selected' : '') + '>' + api.esc(v) + '</option>';
      });
      h += '</select></label><p class="muted">' + rows.length + '대 표시</p></section>';
      if (!rows.length) h += '<section class="card"><p>이 조건의 컴퓨터가 없어요.</p></section>';
      rows.forEach(function (r) {
        var who = [r.user_type, r.user].filter(Boolean).join(' ');
        h += '<button class="list-btn" type="button" data-id="' + api.esc(r.id) + '">';
        if (r.replace_target) h += '<span class="badge warn">교체대상</span> ';
        if (!r.counted) h += '<span class="badge">대수 제외</span> ';
        if (!r.os_version) h += '<span class="badge warn">확인 필요</span> ';
        h += '<b>' + api.esc(r.location || '위치 없음') + '</b><div class="item-meta">' +
          api.esc((r.id.indexOf('x-') === 0 ? '' : r.id + '번') + (r.model ? ' · ' + r.model : ' · 모델 없음') + (who ? ' · ' + who : '') + ' · ' + (r.os_version || '버전 미확인')) +
          '</div></button>';
      });
    }
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelector('#paste').onclick = function () { api.go('#/computers/paste'); };
    el.querySelector('#out').onclick = function () {
      var csv = APComputers.toCsv(all);
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '컴퓨터현황.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      api.toast('CSV를 저장했어요.');
    };
    el.querySelectorAll('[data-chip]').forEach(function (b) {
      b.onclick = function () {
        var chip = b.getAttribute('data-chip');
        if (chip === 'all') api.go(href({ version: '', location: f.location, replace: false, unconfirmed: false }));
        if (chip === 'rep') api.go(href({ version: f.version, location: f.location, replace: !f.replace, unconfirmed: f.unconfirmed }));
        if (chip === 'miss') api.go(href({ version: '', location: f.location, replace: f.replace, unconfirmed: !f.unconfirmed }));
      };
    });
    var ver = el.querySelector('#ver');
    var loc = el.querySelector('#loc');
    if (ver) ver.onchange = function () {
      api.go(href({ version: ver.value, location: f.location, replace: f.replace, unconfirmed: false }));
    };
    if (loc) loc.onchange = function () {
      api.go(href({ version: f.unconfirmed ? '' : f.version, location: loc.value, replace: f.replace, unconfirmed: f.unconfirmed }));
    };
    el.querySelectorAll('[data-id]').forEach(function (b) {
      b.onclick = function () { api.go('#/computers/' + encodeURIComponent(b.getAttribute('data-id'))); };
    });
  }

  function field(id, label, value) {
    return '<label class="field"><span>' + label + '</span><input id="' + id + '" type="text" value="' + value + '"></label>';
  }
  function editor(el, api, row) {
    var r = APComputers.sanitize(row);
    el.innerHTML = '<button class="linkish" id="back" type="button">← 컴퓨터 현황</button><section class="card"><h1>' + api.esc(r.location || '컴퓨터') + '</h1>' +
      field('f-os', '윈도우 버전', api.esc(r.os_version)) +
      '<label class="opt"><input id="f-rep" type="checkbox"' + (r.replace_target ? ' checked' : '') + '> 교체대상</label>' +
      '<label class="opt"><input id="f-count" type="checkbox"' + (r.counted ? ' checked' : '') + '> 대수에 포함</label>' +
      field('f-when', '교체시기', api.esc(r.replace_when)) +
      field('f-loc', '위치', api.esc(r.location)) +
      field('f-aff', '소속', api.esc(r.affiliation)) +
      field('f-type', '사용자구분', api.esc(r.user_type)) +
      field('f-user', '사용자', api.esc(r.user)) +
      field('f-maker', '제조사', api.esc(r.maker)) +
      field('f-model', '모델', api.esc(r.model)) +
      field('f-made', '제조일', api.esc(r.made_on)) +
      field('f-year', '구입연도', api.esc(r.purchase_year)) +
      field('f-net', '망구분', api.esc(r.network)) +
      field('f-note', '비고', api.esc(r.note)) +
      '<p class="muted">IP는 적지 않아요. 버전을 비우면 확인 필요가 돼요.</p>' +
      '<button class="btn block" id="save" type="button">저장</button></section>';
    el.querySelector('#back').onclick = function () { api.go('#/computers'); };
    el.querySelector('#save').onclick = function () {
      var next = APComputers.sanitize(Object.assign({}, r, {
        os_version: document.getElementById('f-os').value,
        replace_target: document.getElementById('f-rep').checked,
        counted: document.getElementById('f-count').checked,
        replace_when: document.getElementById('f-when').value,
        location: document.getElementById('f-loc').value,
        affiliation: document.getElementById('f-aff').value,
        user_type: document.getElementById('f-type').value,
        user: document.getElementById('f-user').value,
        maker: document.getElementById('f-maker').value,
        model: document.getElementById('f-model').value,
        made_on: document.getElementById('f-made').value,
        purchase_year: document.getElementById('f-year').value,
        network: document.getElementById('f-net').value,
        note: document.getElementById('f-note').value,
        status: ''
      }));
      next.id = r.id;
      api.saveComputer(next).then(function () { api.toast('컴퓨터를 저장했어요.'); api.go('#/computers'); });
    };
  }

  function paste(el, api) {
    el.innerHTML = '<button class="linkish" id="back" type="button">← 컴퓨터 현황</button><section class="card"><h1>CSV 가져오기</h1>' +
      '<p class="muted">첫 줄은 머리글. 번호, 소속, 사용자구분, 사용자, 위치, 제조사, 모델, 제조일, 구입연도, 망구분, 윈도우버전, 교체시기, 교체대상, 대수포함. 같은 번호·위치·모델은 다시 세지 않아요. IP 열은 버려요.</p>' +
      '<label class="field"><span>CSV</span><textarea id="blob" placeholder="번호,위치,모델,윈도우버전,교체대상,대수포함"></textarea></label>' +
      '<button class="btn block" id="go" type="button">넣기</button><p id="msg" class="muted"></p></section>';
    el.querySelector('#back').onclick = function () { api.go('#/computers'); };
    el.querySelector('#go').onclick = function () {
      var rows = APComputers.rowsFromCsv(document.getElementById('blob').value);
      if (!rows.length) { el.querySelector('#msg').textContent = '읽을 줄이 없어요. 첫 줄에 머리글이 있어야 해요.'; return; }
      api.importComputers(rows).then(function (r) {
        api.toast(r.added + '대 추가, ' + r.updated + '대 고침, 중복 ' + r.skipped + '대');
        api.go('#/computers');
      });
    };
  }

  ShellModules.computers = { id: 'computers', tab: '', icon: '', render: render };
})();
