(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>';

  function inline(api, s) {
    return api.esc(s || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }
  function blocksHtml(api, blocks) {
    return (blocks || []).map(function (b) {
      if (b.type === 'h') return '<h2>' + api.esc(b.text) + '</h2>';
      if (b.type === 'p') return '<p>' + inline(api, b.text) + '</p>';
      if (b.type === 'ul') return '<ul>' + (b.items || []).map(function (it) { return '<li>' + inline(api, it) + '</li>'; }).join('') + '</ul>';
      if (b.type === 'table') {
        var h = '<div class="scroll"><table class="plain"><tr>' + (b.head || []).map(function (c) { return '<th>' + inline(api, c) + '</th>'; }).join('') + '</tr>';
        (b.rows || []).forEach(function (r) { h += '<tr>' + r.map(function (c) { return '<td>' + inline(api, c) + '</td>'; }).join('') + '</tr>'; });
        return h + '</table></div>';
      }
      return '';
    }).join('');
  }
  function blocksText(blocks) {
    var lines = [];
    (blocks || []).forEach(function (b) {
      if (b.type === 'h') lines.push('', b.text);
      else if (b.type === 'p') lines.push(String(b.text || '').replace(/\*\*/g, ''));
      else if (b.type === 'ul') (b.items || []).forEach(function (it) { lines.push('- ' + String(it).replace(/\*\*/g, '')); });
      else if (b.type === 'table') {
        lines.push((b.head || []).join(' | '));
        (b.rows || []).forEach(function (r) { lines.push(r.join(' | ')); });
      }
    });
    return lines.join('\n');
  }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function shareOrCopy(title, text) {
    if (navigator.share) {
      return navigator.share({ title: title, text: text }).then(function () { return 'share'; }, function () { return 'cancel'; });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return 'copy'; }, function () { return 'fail'; });
    }
    return Promise.resolve('fail');
  }

  function render(el, api) {
    var page = api.route().parts[1] || '';
    if (page === 'manual') return manual(el, api);
    if (page === 'budget') return budget(el, api);
    if (page === 'records') return records(el, api);
    if (page === 'rules') return rules(el, api);
    if (page === 'rule' && api.route().parts[2]) return ruleEdit(el, api, api.route().parts[2]);
    if (page === 'month') return month(el, api);
    if (page === 'plan') return plan(el, api);
    if (page === 'settings') return settings(el, api);
    if (page === 'roadmap') return roadmap(el, api);
    el.innerHTML = '<section class="card"><h1>더보기</h1><p class="muted">매뉴얼, 예산, 기록, 규칙, 설정을 이 기기 안에서만 고쳐요.</p>' + (api.pack().packVersion ? '<p class="muted" id="pack-ver" style="font-size:.8rem;margin:4px 0 0">공부·규칙 자료판 ' + api.esc(api.pack().packVersion) + ' (public-pack.json)</p>' : '') + '</section>' +
      menuGroup('일상·현장') +
      menuBtn('news', '교육원 소식', '행사, 일정, 공지') +
      menuBtn('dorm', '기숙사 현황판', '도면, 겨울방학 이동, 기숙사비') +
      menuBtn('schedule', '남은 일정', '날짜, 담당, 완료, 시트 저장') +
      menuBtn('lockers', '사물함', '5101호·2층 휴게실 색깔 판, 열쇠 수, 배정 추천') +
      menuBtn('computers', '컴퓨터 현황', '대수, 윈도우 버전, 교체대상') +
      menuBtn('filefind', '파일 찾기', '낱말로 옵시디언·PC 파일 찾기, 내려받은 파일 정리') +
      menuBtn('banner', '현수막 만들기', '기본 시안, 예전 현수막, 4m·5m') +
      menuGroup('계획·현황') +
      menuBtn('calendar', '계획 달력', '월·주 보기, 유진님 할 일·교수님 일정, D-day') +
      menuBtn('regular-docs', '정례 문서 달력', '달 격자 · 분류 고르기 · 다가오는 달 예상') +
      menuBtn('status', '현황표', '유진님 할 일 먼저, 상태·마감·담당 봇, OJNT 진행률') +
      menuBtn('bots', '봇 작업 현황', '지금 도는 일 한 줄씩 · 유진님 몫 · 마감 임박 · 감사 위험') +
      menuGroup('공부·규정') +
      menuBtn('practice', '연습장', '과제, 익힐 업무, 문제') +
      menuBtn('study-must', '주무관 필독', '교육원·항공기술 규정 요지 10가지') +
      menuBtn('changelog', '변경이력 카드', '표지 캐러셀 · 버전 요지 · 학습 패널') +
      menuBtn('docreg', '문서등록대장 학습', '분류별 문제 · 정례 문서 달력 · 틀린 문제 다시') +
      menuBtn('who', '학과·사람별 업무', '학과 카드 · 사람별 카드 · 누가 하나 문제') +
      menuBtn('coop', '협조리스트 (원큐)', '오늘 Top5 · 휴보강 경로 · 내선·주업무') +
      menuBtn('todo', '내일 할 일', '10.28 시드 · 한 장 리스트') +
      menuGroup('시설') +
      menuBtn('3d', '교육원 전경 3D', '앱 안에서 보기 · v02 모델') +
      menuGroup('자료·설정') +
      menuBtn('manual', '업무 매뉴얼', '인수인계서로 내보내기') +
      menuBtn('budget', '예산 집행률', '빈칸은 확인 필요') +
      menuBtn('plan', '사업 기획', '내년 준비 점검') +
      menuBtn('roadmap', '로봇 로드맵', '내 로봇·3D 공부 단계') +
      menuBtn('records', '내 기록', '점수와 자주 틀린 규칙') +
      menuBtn('rules', '규칙 목록', '문장과 근거를 고칠 수 있어요') +
      menuBtn('month', '매달 할 일', '알림 문구 수정') +
      menuBtn('settings', '설정', '백업, 초기화');
    el.querySelectorAll('[data-page]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-page');
        if (id === 'practice') api.go('#/practice');
        else if (id === 'study-must') api.go('#/study/must');
        else if (id === 'changelog') api.go('#/study/changelog');
        else if (id === 'news' || id === 'computers' || id === 'dorm' || id === 'schedule' || id === 'banner' || id === 'lockers' || id === 'calendar' || id === 'status' || id === 'filefind' || id === '3d' || id === 'bots' || id === 'docreg' || id === 'who' || id === 'regular-docs' || id === 'coop' || id === 'todo') api.go('#/' + id);
        else api.go('#/more/' + id);
      };
    });
  }
  function menuGroup(title) {
    return '<p class="menu-group">' + title + '</p>';
  }
  function menuBtn(id, title, sub) {
    return '<button class="list-btn" type="button" data-page="' + id + '"><b>' + title + '</b><div class="item-meta">' + sub + '</div></button>';
  }

  function manual(el, api) {
    var man = api.pack().entities.manual || { title: '업무 매뉴얼', blocks: [] };
    var title = (api.pack().appTitle || '인수인계') + ' 인수인계서';
    el.innerHTML = '<button class="linkish" id="back" type="button">← 더보기</button><section class="card"><h1>' + api.esc(man.title || '업무 매뉴얼') + '</h1>' +
      blocksHtml(api, man.blocks) +
      '<button class="btn block" id="out" type="button">인수인계서 공유·저장</button>' +
      '<p class="muted">아이폰에서는 공유 창이 열려요. 파일 앱이나 메모에 저장하세요. 암호는 넣지 않았어요.</p>' +
      '<textarea id="handover" class="hidden"></textarea></section>';
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelector('#out').onclick = function () {
      var text = title + '\n만든 날: ' + new Date().toLocaleDateString('ko-KR') + '\n' + blocksText(man.blocks) + '\n\n비밀번호·계좌번호 전체는 넣지 않았어요.\n';
      var ta = el.querySelector('#handover');
      ta.classList.remove('hidden');
      ta.value = text;
      shareOrCopy(title, text).then(function (how) {
        if (how === 'share') api.toast('공유 창을 열었어요.');
        else if (how === 'copy') api.toast('글을 복사했어요.');
        else api.toast('아래 글을 길게 눌러 복사하세요.');
        download('인수인계서.txt', text);
      });
    };
  }

  function moneyInput(id, val) {
    return '<input id="' + id + '" type="text" inputmode="numeric" value="' + (val == null || val === '' ? '' : val) + '">';
  }
  function budget(el, api) {
    var rows = api.pack().entities.budget_lines || [];
    var h = '<button class="linkish" id="back" type="button">← 더보기</button><section class="card"><h1>예산 집행률</h1><p class="muted">배정액이나 집행액이 비어 있으면 확인 필요예요. 집행률은 배정액이 있을 때만 계산해요. 숫자는 이 기기에 저장돼요.</p></section>';
    rows.forEach(function (b) {
      var alloc = b.allocated;
      var spent = b.spent;
      var pct = (typeof APSearch !== 'undefined') ? APSearch.budgetRate(b) : null;
      var rate = pct == null ? '확인 필요' : pct + '%';
      var remain = (alloc != null && spent != null && spent !== '' && !Number.isNaN(Number(alloc)) && !Number.isNaN(Number(spent))) ? api.won(Number(alloc) - Number(spent)) : '확인 필요';
      h += '<article class="card" data-id="' + api.esc(b.id) + '"><span class="badge">' + api.esc(b.group || '') + '</span>' +
        (b.needsConfirm ? ' <span class="badge warn">확인 필요</span>' : '') +
        '<h2>' + api.esc(b.project) + '</h2><p class="muted">' + api.esc(b.item || '') + '</p>' +
        (b.plan != null ? '<p>계획액 ' + api.won(b.plan) + '</p>' : '') +
        '<label class="field"><span>배정액</span>' + moneyInput('a-' + b.id, alloc) + '</label>' +
        '<label class="field"><span>집행액</span>' + moneyInput('s-' + b.id, spent) + '</label>' +
        '<p>잔액 <b>' + api.esc(remain) + '</b> · 집행률 <b>' + api.esc(rate) + '</b></p>' +
        (b.memo ? '<p class="muted">' + api.esc(b.memo) + '</p>' : '') +
        '<button class="btn small" type="button" data-save="' + api.esc(b.id) + '">이 줄 저장</button></article>';
    });
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelectorAll('[data-save]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-save');
        var a = api.num(document.getElementById('a-' + id).value);
        var s = api.num(document.getElementById('s-' + id).value);
        api.patchBudget(id, { allocated: Number.isNaN(a) ? null : a, spent: Number.isNaN(s) ? null : s, needsConfirm: Number.isNaN(a) }).then(function () {
          api.toast('저장했어요.');
          api.refresh();
        });
      };
    });
  }

  function records(el, api) {
    var pack = api.pack();
    var rec = api.records();
    var tasks = pack.entities.tasks || [];
    var wrongRules = {};
    tasks.forEach(function (t) {
      var r = rec.tasks[t.id];
      if (r && r.best < 100) (t.rules || []).forEach(function (id) { wrongRules[id] = (wrongRules[id] || 0) + 1; });
    });
    var h = '<button class="linkish" id="back" type="button">← 더보기</button><section class="card"><h1>내 기록</h1>';
    var any = false;
    tasks.forEach(function (t) {
      var r = rec.tasks[t.id];
      if (!r) return;
      any = true;
      h += '<p><b>' + api.esc(t.title) + '</b><br><span class="muted">최고 ' + r.best + '점 · ' + r.attempts + '번</span></p>';
    });
    if (!any) h += '<p>아직 과제 점수가 없어요.</p>';
    var wrongQ = Object.keys(rec.questions || {}).filter(function (id) { return rec.questions[id] && rec.questions[id].ok === false; });
    h += '<p>틀린 문제 ' + wrongQ.length + '개</p><button class="btn-ghost" id="wrong" type="button">틀린 문제 보기</button>';
    var top = Object.keys(wrongRules).sort(function (a, b) { return wrongRules[b] - wrongRules[a]; }).slice(0, 5);
    if (top.length) {
      h += '<h2>아직 100점이 아닌 과제의 규칙</h2><ul>';
      top.forEach(function (id) {
        var rule = (pack.entities.rules || []).filter(function (r) { return r.id === id; })[0];
        h += '<li><b>' + api.esc(id) + '</b> ' + api.esc(rule ? rule.text : '') + '</li>';
      });
      h += '</ul>';
    }
    var studyN = Object.keys((rec.study && rec.study.done) || {}).length;
    var learnN = Object.keys(rec.learning || {}).length;
    h += '<p class="muted">공부 ' + studyN + '일 · 익힘 ' + learnN + '개</p></section>';
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelector('#wrong').onclick = function () { api.go('#/practice/wrong'); };
  }

  function rules(el, api) {
    var h = '<button class="linkish" id="back" type="button">← 더보기</button><section class="card"><h1>규칙</h1><p class="muted">참고로 표시된 규칙은 채점하지 않아요.</p></section>';
    (api.pack().entities.rules || []).forEach(function (r) {
      var cls = r.status === 'reference' ? 'ref' : (r.status === 'confirmed' ? 'ok' : 'warn');
      var label = r.status === 'reference' ? '참고' : (r.status === 'confirmed' ? '확정' : '확인 필요');
      h += '<button class="list-btn" type="button" data-id="' + api.esc(r.id) + '"><span class="badge ' + cls + '">' + api.esc(r.id) + ' ' + label + '</span><b> ' + api.esc(r.text) + '</b><div class="item-meta">' + api.esc(r.basis || '') + '</div></button>';
    });
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelectorAll('[data-id]').forEach(function (b) { b.onclick = function () { api.go('#/more/rule/' + b.getAttribute('data-id')); }; });
  }
  function ruleEdit(el, api, id) {
    var r = (api.pack().entities.rules || []).filter(function (x) { return x.id === id; })[0];
    if (!r) { el.innerHTML = '<section class="card"><p>없는 규칙이에요.</p></section>'; return; }
    el.innerHTML = '<button class="linkish" id="back" type="button">← 규칙</button><section class="card"><h1>' + api.esc(r.id) + '</h1>' +
      '<label class="field"><span>문장</span><textarea id="text">' + api.esc(r.text || '') + '</textarea></label>' +
      '<label class="field"><span>근거</span><textarea id="basis">' + api.esc(r.basis || '') + '</textarea></label>' +
      '<label class="field"><span>상태</span><select id="status">' +
      ['confirmed', 'reference', 'needs-confirm'].map(function (s) { return '<option' + (r.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></label><p class="muted">confirmed 확정 · reference 참고(채점 제외) · needs-confirm 확인 필요</p>' +
      '<button class="btn block" id="save" type="button">저장</button></section>';
    el.querySelector('#back').onclick = function () { api.go('#/more/rules'); };
    el.querySelector('#save').onclick = function () {
      api.patchRule(id, { text: document.getElementById('text').value.trim(), basis: document.getElementById('basis').value.trim(), status: document.getElementById('status').value })
        .then(function () { api.toast('규칙을 저장했어요.'); api.go('#/more/rules'); });
    };
  }

  function month(el, api) {
    var todos = api.pack().entities.monthly_todos || [];
    var h = '<button class="linkish" id="back" type="button">← 더보기</button><section class="card"><h1>매달 할 일</h1>' +
      '<button class="btn block" id="add" type="button">할 일 추가</button></section>';
    todos.forEach(function (t) {
      h += '<article class="card"><label class="field"><span>할 일</span><input data-t="' + api.esc(t.id) + '" data-f="title" type="text" value="' + api.esc(t.title || '') + '"></label>' +
        '<label class="field"><span>메모</span><textarea data-t="' + api.esc(t.id) + '" data-f="note">' + api.esc(t.note || '') + '</textarea></label>' +
        '<div class="row"><button class="btn small" type="button" data-save="' + api.esc(t.id) + '">저장</button><button class="btn-ghost small" type="button" data-del="' + api.esc(t.id) + '">지우기</button></div></article>';
    });
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelector('#add').onclick = function () {
      var id = 'm' + Date.now();
      api.addTodo({ id: id, title: '새 할 일', note: '', schedule: { type: 'monthly', day: 1 }, when: '매달 1일' }).then(function () { api.refresh(); });
    };
    el.querySelectorAll('[data-save]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-save');
        var title = el.querySelector('[data-t="' + id + '"][data-f="title"]').value;
        var note = el.querySelector('[data-t="' + id + '"][data-f="note"]').value;
        api.patchTodo(id, { title: title, note: note }).then(function () { api.toast('저장했어요.'); });
      };
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () {
        api.deleteTodo(b.getAttribute('data-del')).then(function () { api.refresh(); });
      };
    });
  }

  function plan(el, api) {
    var p = api.pack().entities.planning || { title: '사업 기획', blocks: [] };
    el.innerHTML = '<button class="linkish" id="back" type="button">← 더보기</button><section class="card"><h1>' + api.esc(p.title || '사업 기획') + '</h1>' + blocksHtml(api, p.blocks) + '</section>';
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
  }

  function settings(el, api) {
    var rec = api.records();
    el.innerHTML = '<button class="linkish" id="back" type="button">← 더보기</button>' +
      '<section class="card"><h1>설정</h1>' +
      '<p class="muted">고친 내용과 공부 기록은 이 기기(브라우저)에 저장돼요. 다른 기기로 옮길 때는 백업 파일을 써요.</p>' +
      '<p class="muted">마지막 백업: ' + api.esc(rec.lastBackupAt ? rec.lastBackupAt.slice(0, 10) : '없음') + '</p></section>' +
      '<section class="card"><h2>백업</h2>' +
      '<button class="btn block" id="exp-all" type="button">백업 파일 내려받기</button>' +
      '<label class="btn-ghost block" for="in-file" style="margin-top:8px">백업 파일 불러오기</label><input id="in-file" class="hidden" type="file" accept="application/json,.json"></section>' +
      '<section class="card"><h2>초기화</h2><button class="btn-ghost block" id="wipe" type="button">이 기기 저장 지우기</button>' +
      '<p class="muted">홈 화면에 추가하면 앱처럼 열려요. 삼성 인터넷·크롬 메뉴 → 홈 화면에 추가.</p></section>';
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    el.querySelector('#exp-all').onclick = function () {
      var body = api.exportBackup();
      var d = new Date();
      var stamp = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      download(stamp + '_연습장백업_v01.json', JSON.stringify(body), 'application/json');
      api.toast('백업을 내려받았어요.');
    };
    el.querySelector('#in-file').onchange = function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var obj = null;
        try { obj = JSON.parse(String(reader.result || '')); } catch (err) { obj = null; }
        api.importBackup(obj).then(function (ok) {
          api.toast(ok ? '백업을 불러왔어요.' : '연습장 백업 파일이 아니에요.');
          if (ok) api.go('#/home');
        });
      };
      reader.readAsText(file);
    };
    el.querySelector('#wipe').onclick = function () {
      if (confirm('이 기기에서 고친 내용과 점수를 모두 지울까요?')) api.resetAll();
    };
  }

  function roadmap(el, api) {
    el.innerHTML = '<button class="linkish" id="back" type="button">← 더보기</button>' +
      '<section class="card"><h1>로봇 로드맵 🚀</h1>' +
      '<p class="muted">두근거릴 때 꺼내봐요. 불(만들기)+쇠(기계). 급하지 않게 한 단계씩.</p>' +
      '<h2>사다리 (쉬운 것부터)</h2>' +
      '<div class="scroll"><table class="plain"><tr><th>단계</th><th>할 것</th><th>도구(무료)</th></tr>' +
      '<tr><td>0</td><td>전동팬 뜸/못뜸 계산기</td><td>Python</td></tr>' +
      '<tr><td>1</td><td>3D에 물리 붙이기</td><td>three.js(훈련기 3D)</td></tr>' +
      '<tr><td>2</td><td>본격 시뮬(디지털 트윈)</td><td>Gazebo·Webots</td></tr>' +
      '<tr><td>3</td><td>실물 드론+로그</td><td>교육원 기체</td></tr>' +
      '<tr><td>4</td><td>제어는 기성 펌웨어</td><td>ArduPilot·PX4</td></tr>' +
      '<tr><td>5</td><td>CAD</td><td>Fusion 360(학생무료)</td></tr>' +
      '<tr><td>6</td><td>에이전트 제어</td><td>ROS2+시뮬</td></tr>' +
      '<tr><td>7</td><td>방제 드론→밭로봇</td><td>지역연계</td></tr>' +
      '</table></div></section>' +
      '<section class="card"><h2>심화: 시뮬에서 강화학습(RL)</h2>' +
      '<p>장애물 코스 → 3D(Omniverse) → 물리(Newton) → 정책 훈련(Isaac Lab) → 검증(Isaac Sim) → 실물(Microduck).</p>' +
      '<p class="muted">⚠ Isaac·Omniverse는 NVIDIA RTX GPU 필수 = Mac 불가(Windows/Linux+엔비디아). 쉬운 시작: Gymnasium+PyBullet.</p></section>' +
      '<section class="card"><h2>지금 첫걸음</h2><p><b>0단계 전동팬 계산기</b> — 재밌고 물리·배터리 감이 잡혀요. 클로드가 같이 만들어 줘요.</p></section>' +
      '<section class="card"><h2>주의</h2><ul>' +
      '<li>모르는 1인 OS·에이전트를 업무 PC(개인정보!)에 깔지 말기. 여분·VM에서만.</li>' +
      '<li>개인 프로젝트는 업무와 분리.</li></ul></section>';
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
  }

  ShellModules.more = { id: 'more', tab: '더보기', icon: icon, render: render };
})();
