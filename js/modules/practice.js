(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"/></svg>';
  var filters = { bucket: '', type: '', level: '', work: '' };

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function qs(api) { return api.filterQuestions(api.pack().entities.questions || [], {}); }
  function initDraft(task) {
    var d = {};
    (task.fields || []).forEach(function (f) {
      if (f.type === 'docs') d[f.key] = [];
      else if (f.type === 'multi') d[f.key] = (f.def || []).slice();
      else if (f.type === 'order') d[f.key] = (f.def || (f.items || []).map(function (i) { return i.id; })).slice();
      else d[f.key] = f.def != null ? f.def : '';
    });
    return d;
  }
  function draftFor(api, task) {
    var bag = api.records().drafts || (api.records().drafts = {});
    if (!bag[task.id]) bag[task.id] = initDraft(task);
    return bag[task.id];
  }
  var timer;
  function queue(api, id) {
    clearTimeout(timer);
    timer = setTimeout(function () { api.saveDraft(id, api.records().drafts[id]); }, 350);
  }

  function render(el, api) {
    var p = api.route().parts;
    if (p[1] === 'task' && p[2]) return taskView(el, api, p[2]);
    if (p[1] === 'tasks') return taskList(el, api);
    if (p[1] === 'learn') return learnView(el, api);
    if (p[1] === 'quiz') return quizView(el, api);
    if (p[1] === 'wrong') return wrongView(el, api);
    var tasks = api.pack().entities.tasks || [];
    var items = api.pack().entities.learning_items || [];
    var questions = qs(api);
    var tried = tasks.filter(function (t) { return api.records().tasks[t.id]; }).length;
    el.innerHTML = '<section class="card"><h1>연습장</h1><p class="muted">실무 과제, 익힐 업무, 문제 풀기. 단계 순서를 틀리면 그 과제는 0점이고, 다른 규칙은 부분 점수예요.</p>' +
      '<div class="statgrid"><div><b>' + tried + '/' + tasks.length + '</b><span class="muted">풀어 본 과제</span></div><div><b>' + questions.length + '</b><span class="muted">문제</span></div></div></section>' +
      '<button class="list-btn" id="go-tasks" type="button"><b>실무 과제</b><div class="item-meta">양식에 직접 입력하고 규칙마다 채점</div></button>' +
      '<button class="list-btn" id="go-learn" type="button"><b>익힐 업무 ' + items.length + '</b><div class="item-meta">우선순위와 익힘 표시</div></button>' +
      '<button class="list-btn" id="go-quiz" type="button"><b>문제 풀기</b><div class="item-meta">업무·규정, 유형, 난이도</div></button>' +
      '<button class="list-btn" id="go-wrong" type="button"><b>틀린 문제 모아보기</b></button>';
    el.querySelector('#go-tasks').onclick = function () { api.go('#/practice/tasks'); };
    el.querySelector('#go-learn').onclick = function () { api.go('#/practice/learn'); };
    el.querySelector('#go-quiz').onclick = function () { api.go('#/practice/quiz'); };
    el.querySelector('#go-wrong').onclick = function () { api.go('#/practice/wrong'); };
  }

  function taskList(el, api) {
    var h = '<button class="linkish" id="back" type="button">← 연습장</button>';
    (api.pack().entities.tasks || []).forEach(function (t) {
      var rec = api.records().tasks[t.id];
      var badge = !rec ? '<span class="badge">안 해 봄</span>' : (rec.best === 100 ? '<span class="badge ok">100점</span>' : '<span class="badge warn">최고 ' + rec.best + '점</span>');
      h += '<button class="list-btn" type="button" data-id="' + api.esc(t.id) + '">' + badge + ' <b>' + api.esc(t.title) + '</b><div class="item-meta">' + api.esc(t.domain || '') + (t.level ? ' · ' + api.esc(t.level) : '') + '</div></button>';
    });
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/practice'); };
    el.querySelectorAll('[data-id]').forEach(function (b) { b.onclick = function () { api.go('#/practice/task/' + b.getAttribute('data-id')); }; });
  }

  function opts(list, sel, ph) {
    var h = ph ? '<option value="">' + ph + '</option>' : '';
    (list || []).forEach(function (o) { h += '<option' + (o === sel ? ' selected' : '') + '>' + o.replace(/[&<>]/g, '') + '</option>'; });
    return h;
  }

  function fieldHtml(api, task, f, d) {
    var h = '<div class="field" data-field="' + api.esc(f.key) + '"><div class="flabel">' + api.esc(f.label || '') + '</div>';
    if (f.type === 'select') h += '<select data-key="' + api.esc(f.key) + '">' + opts(f.options, d[f.key], '선택') + '</select>';
    else if (f.type === 'radio') (f.options || []).forEach(function (o) {
      h += '<label class="opt"><input type="radio" name="' + api.esc(task.id + f.key) + '" data-radio="' + api.esc(f.key) + '" value="' + api.esc(o) + '"' + (d[f.key] === o ? ' checked' : '') + '><span>' + api.esc(o) + '</span></label>';
    });
    else if (f.type === 'multi') (f.options || []).forEach(function (o) {
      var on = (d[f.key] || []).indexOf(o.v) >= 0;
      h += '<label class="opt"><input type="checkbox" data-multi="' + api.esc(f.key) + '" value="' + api.esc(o.v) + '"' + (on ? ' checked' : '') + '><span>' + api.esc(o.t) + '</span></label>';
    });
    else if (f.type === 'number' || f.type === 'text') h += '<input data-key="' + api.esc(f.key) + '" type="text" inputmode="' + (f.type === 'number' ? 'numeric' : 'text') + '" value="' + api.esc(d[f.key]) + '">';
    else if (f.type === 'textarea') h += '<textarea data-key="' + api.esc(f.key) + '" rows="12">' + api.esc(d[f.key]) + '</textarea>';
    else if (f.type === 'order') {
      h += '<ol class="order">';
      (d[f.key] || []).forEach(function (iid, i) {
        var it = (f.items || []).filter(function (x) { return x.id === iid; })[0] || { text: iid };
        h += '<li><span class="grow">' + api.esc(it.text) + '</span><button class="btn-ghost small" type="button" data-up="' + i + '" data-okey="' + api.esc(f.key) + '">위</button><button class="btn-ghost small" type="button" data-down="' + i + '" data-okey="' + api.esc(f.key) + '">아래</button></li>';
      });
      h += '</ol>';
    } else if (f.type === 'docs') {
      var docs = d[f.key] || [];
      if (!docs.length) h += '<p class="muted">아직 올린 문서가 없어요. 아래에서 한 단계씩 넣어요.</p>';
      docs.forEach(function (doc, i) {
        h += '<div class="doc-card"><b>' + (i + 1) + '. ' + api.esc(doc.type) + '</b><div class="item-meta">' + api.esc(doc.dept) + ' · ' + api.esc(doc.category) + ' · ' + api.esc(api.won(doc.amount)) +
          '</div><button class="btn-ghost small" type="button" data-del="' + i + '" data-dkey="' + api.esc(f.key) + '">빼기</button></div>';
      });
      h += '<label class="field"><span>문서</span><select id="d-type">' + opts(f.docTypes, '', '선택') + '</select></label>' +
        '<label class="field"><span>처리</span><select id="d-dept">' + opts(f.depts, '', '선택') + '</select></label>' +
        '<label class="field"><span>예산과목</span><select id="d-cat">' + opts(f.categories, '', '선택') + '</select></label>' +
        '<label class="field"><span>금액</span><input id="d-amt" type="text" inputmode="numeric"></label>' +
        '<button class="btn block" id="d-add" type="button" data-dkey="' + api.esc(f.key) + '">이 단계 넣기</button>';
    }
    return h + '</div>';
  }

  function bindFields(el, api, task) {
    var d = draftFor(api, task);
    el.querySelectorAll('[data-key]').forEach(function (node) {
      node.oninput = function () { d[node.getAttribute('data-key')] = node.value; queue(api, task.id); };
    });
    el.querySelectorAll('[data-radio]').forEach(function (node) {
      node.onchange = function () { d[node.getAttribute('data-radio')] = node.value; queue(api, task.id); };
    });
    el.querySelectorAll('[data-multi]').forEach(function (node) {
      node.onchange = function () {
        var key = node.getAttribute('data-multi');
        d[key] = Array.prototype.map.call(el.querySelectorAll('[data-multi="' + key + '"]:checked'), function (c) { return c.value; });
        queue(api, task.id);
      };
    });
    el.querySelectorAll('[data-up],[data-down]').forEach(function (b) {
      b.onclick = function () {
        var key = b.getAttribute('data-okey');
        var arr = d[key];
        var i = Number(b.getAttribute('data-up') != null ? b.getAttribute('data-up') : b.getAttribute('data-down'));
        var j = b.hasAttribute('data-up') ? i - 1 : i + 1;
        if (j < 0 || j >= arr.length) return;
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        taskView(el, api, task.id);
      };
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { d[b.getAttribute('data-dkey')].splice(Number(b.getAttribute('data-del')), 1); taskView(el, api, task.id); };
    });
    var add = el.querySelector('#d-add');
    if (add) add.onclick = function () {
      var type = el.querySelector('#d-type').value;
      var dept = el.querySelector('#d-dept').value;
      var cat = el.querySelector('#d-cat').value;
      var amt = api.num(el.querySelector('#d-amt').value);
      if (!type || !dept || !cat || !(amt > 0)) { api.toast('문서, 처리, 과목, 금액을 채워 주세요.'); return; }
      d[add.getAttribute('data-dkey')].push({ type: type, dept: dept, category: cat, amount: amt });
      queue(api, task.id);
      taskView(el, api, task.id);
    };
  }

  function answerOf(task, d) {
    var a = JSON.parse(JSON.stringify(d));
    if (a.docs == null && d.docs) a.docs = d.docs;
    return a;
  }

  function taskView(el, api, id) {
    var task = (api.pack().entities.tasks || []).filter(function (t) { return t.id === id; })[0];
    if (!task) { el.innerHTML = '<section class="card"><p>없는 과제예요.</p></section>'; return; }
    var d = draftFor(api, task);
    var h = '<button class="linkish" id="back" type="button">← 과제 목록</button><section class="card"><span class="badge">' + api.esc(task.domain || '') + '</span><h1>' + api.esc(task.title) + '</h1>' +
      '<p>' + api.esc(task.situation || '') + '</p></section><section class="card" id="ws"><h2>작업</h2>';
    (task.fields || []).forEach(function (f) { h += fieldHtml(api, task, f, d); });
    h += '<button class="btn block" id="submit" type="button">제출하고 채점받기</button><button class="btn-ghost block" id="reset" type="button">비우기</button></section><section id="result"></section>';
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/practice/tasks'); };
    bindFields(el, api, task);
    el.querySelector('#submit').onclick = function () { submit(el, api, task); };
    el.querySelector('#reset').onclick = function () {
      api.records().drafts[task.id] = initDraft(task);
      taskView(el, api, id);
    };
  }

  function submit(el, api, task) {
    var d = draftFor(api, task);
    if (d.docs) { /* grader reads answer.docs */ }
    var ans = answerOf(task, d);
    if (ans.docs == null) {
      (task.fields || []).forEach(function (f) { if (f.type === 'docs') ans.docs = d[f.key]; });
    }
    var g = api.gradeTask(task, ans);
    api.saveTask(task.id, g.points);
    var rules = api.pack().entities.rules || [];
    function ruleText(id) {
      var r = rules.filter(function (x) { return x.id === id; })[0];
      return r ? r.text : '';
    }
    var rows = g.results.slice().sort(function (a, b) {
      var av = a.score && a.pass === false ? 0 : (a.score ? 1 : 2);
      var bv = b.score && b.pass === false ? 0 : (b.score ? 1 : 2);
      return av - bv;
    });
    var h = '<section class="card"><p class="kicker">채점</p><h1>' + g.points + '점</h1>';
    if (g.orderFail) h += '<div class="nobox">단계 순서가 틀려 이 과제는 0점이에요. 아래에는 규칙마다 맞았는지를 그대로 보여 줘요.</div>';
    h += '<ul style="list-style:none;padding:0">';
    rows.forEach(function (r) {
      var mark = !r.score ? '참고' : (r.pass ? '맞음' : '틀림');
      var cls = !r.score ? 'ref' : (r.pass ? 'ok' : 'no');
      h += '<li class="q-card" data-jump="' + api.esc(r.field || '') + '"><span class="badge ' + cls + '">' + mark + '</span> <b>' + api.esc(r.rule) + '</b> ' + api.esc(r.label) +
        '<div>' + api.esc(r.explain) + '</div><div class="item-meta">' + api.esc(ruleText(r.rule)) + '</div></li>';
    });
    h += '</ul><button class="btn-ghost block" id="sample" type="button">모범 답 채우기</button></section>';
    var box = el.querySelector('#result');
    box.innerHTML = h;
    box.querySelector('#sample').onclick = function () {
      api.records().drafts[task.id] = JSON.parse(JSON.stringify(task.sample || initDraft(task)));
      taskView(el, api, task.id);
    };
    box.scrollIntoView();
  }

  function learnView(el, api) {
    var rank = (api.route().parts[2] || 'all');
    var items = api.pack().entities.learning_items || [];
    var h = '<button class="linkish" id="back" type="button">← 연습장</button><section class="card"><h1>익힐 업무</h1><div class="chips" id="ranks">' +
      ['all', 'A', 'B', 'C'].map(function (r) { return '<button class="chip' + (rank === r ? ' on' : '') + '" type="button" data-rank="' + r + '">' + (r === 'all' ? '전체' : r) + '</button>'; }).join('') +
      '</div></section>';
    items.filter(function (it) { return rank === 'all' || it.rank === rank; }).forEach(function (it) {
      var on = !!api.records().learning[it.id];
      h += '<article class="card"><span class="badge">' + api.esc(it.rank || '') + '</span> <b>' + api.esc(it.id) + '</b> ' + (on ? '<span class="badge ok">익힘</span>' : '') +
        '<h2>' + api.esc(it.name) + '</h2><p class="muted">' + api.esc(it.when || '') + '</p><p>' + api.esc(it.idea || '') + '</p>' +
        '<div class="row"><button class="btn small" type="button" data-learn="' + api.esc(it.id) + '">' + (on ? '익힘 취소' : '익힘') + '</button>' +
        (it.taskId ? '<button class="btn-ghost small" type="button" data-task="' + api.esc(it.taskId) + '">과제</button>' : '') +
        '<button class="btn-ghost small" type="button" data-q="' + api.esc(it.id) + '">문제</button></div></article>';
    });
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/practice'); };
    el.querySelectorAll('[data-rank]').forEach(function (b) { b.onclick = function () { api.go('#/practice/learn/' + b.getAttribute('data-rank')); }; });
    el.querySelectorAll('[data-learn]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-learn');
        api.markLearning(id, !api.records().learning[id]).then(function () { api.refresh(); });
      };
    });
    el.querySelectorAll('[data-task]').forEach(function (b) { b.onclick = function () { api.go('#/practice/task/' + b.getAttribute('data-task')); }; });
    el.querySelectorAll('[data-q]').forEach(function (b) {
      b.onclick = function () { filters.work = b.getAttribute('data-q'); filters.bucket = '업무'; api.go('#/practice/quiz'); };
    });
  }

  function workChoices(list) {
    var map = {};
    list.forEach(function (q) { if (q.업무id) map[q.업무id] = q.업무명 || q.업무id; });
    return Object.keys(map).sort().map(function (id) { return { id: id, name: map[id] }; });
  }

  function quizView(el, api) {
    var all = qs(api);
    var shown = api.filterQuestions(all, { bucket: filters.bucket, type: filters.type, level: filters.level, work: filters.work });
    var works = workChoices(all.filter(function (q) { return !filters.bucket || q.bucket === filters.bucket; }));
    function chip(group, val, label) {
      return '<button class="chip' + (filters[group] === val ? ' on' : '') + '" type="button" data-g="' + group + '" data-v="' + api.esc(val) + '">' + api.esc(label) + '</button>';
    }
    var h = '<button class="linkish" id="back" type="button">← 연습장</button><section class="card"><h1>문제 풀기</h1>' +
      '<p class="kicker">업무 / 규정</p><div class="chips">' + chip('bucket', '', '전체') + chip('bucket', '업무', '업무') + chip('bucket', '규정', '규정') + '</div>' +
      '<p class="kicker">유형</p><div class="chips">' + chip('type', '', '전체') + ['빈칸', 'OX', '사례', '순서', '틀린곳'].map(function (t) { return chip('type', t, t); }).join('') + '</div>' +
      '<p class="kicker">난이도</p><div class="chips">' + chip('level', '', '전체') + ['쉬움', '보통', '어려움'].map(function (t) { return chip('level', t, t); }).join('') + '</div>' +
      '<label class="field"><span>업무·규정 고르기</span><select id="work"><option value="">전체</option>' +
      works.map(function (w) { return '<option value="' + api.esc(w.id) + '"' + (filters.work === w.id ? ' selected' : '') + '>' + api.esc(w.id + ' ' + w.name) + '</option>'; }).join('') +
      '</select></label><p class="muted">' + shown.length + '문제 · 보류 문항은 빠져 있어요.</p></section>';
    var idx = filters.cursor || 0;
    if (idx >= shown.length) idx = 0;
    if (!shown.length) h += '<section class="card"><p>이 조건에 맞는 문제가 없어요.</p></section>';
    else h += questionCard(api, shown[idx], shown.length);
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/practice'); };
    el.querySelectorAll('[data-g]').forEach(function (b) {
      b.onclick = function () {
        filters[b.getAttribute('data-g')] = b.getAttribute('data-v');
        if (b.getAttribute('data-g') === 'bucket') filters.work = '';
        filters.cursor = 0;
        api.refresh();
      };
    });
    var sel = el.querySelector('#work');
    if (sel) sel.onchange = function () { filters.work = sel.value; filters.cursor = 0; api.refresh(); };
    bindQuestion(el, api, shown[idx]);
  }

  function questionCard(api, q, total) {
    if (!q) return '';
    var h = '<section class="card" id="qbox"><span class="badge">' + api.esc(q.bucket) + '</span> <span class="badge">' + api.esc(q.유형) + '</span> <span class="badge">' + api.esc(q.난이도) + '</span>' +
      '<h2>' + api.esc(q.id) + '</h2><p>' + api.esc(q.질문) + '</p>';
    if (q.유형 === '순서' && q.보기) {
      h += '<ol class="order" id="qorder">';
      q.보기.forEach(function (item, i) {
        h += '<li data-i="' + i + '"><span class="grow">' + api.esc(item) + '</span><button class="btn-ghost small" type="button" data-qup="' + i + '">위</button><button class="btn-ghost small" type="button" data-qdown="' + i + '">아래</button></li>';
      });
      h += '</ol>';
    } else if (q.보기 && q.보기.length) {
      q.보기.forEach(function (o) {
        h += '<label class="opt"><input type="radio" name="ans" value="' + api.esc(o) + '"><span>' + api.esc(o) + '</span></label>';
      });
    } else h += '<textarea id="qtext" placeholder="생각한 답을 적어도 되고, 바로 답을 봐도 돼요."></textarea>';
    h += '<button class="btn block" id="qgo" type="button">채점</button><div id="qresult"></div>';
    h += '<button class="btn-ghost block" id="qnext" type="button">다른 문제</button><p class="muted">이 조건에서 ' + total + '문제 중 하나를 보여 줘요.</p></section>';
    return h;
  }

  function currentOrder(el) {
    return Array.prototype.map.call(el.querySelectorAll('#qorder li'), function (li) { return li.querySelector('.grow').textContent; });
  }
  function bindQuestion(el, api, q) {
    if (!q) return;
    el.querySelectorAll('[data-qup],[data-qdown]').forEach(function (b) {
      b.onclick = function () {
        var list = el.querySelector('#qorder');
        var items = Array.prototype.slice.call(list.children);
        var i = Number(b.getAttribute('data-qup') != null ? b.getAttribute('data-qup') : b.getAttribute('data-qdown'));
        var j = b.hasAttribute('data-qup') ? i - 1 : i + 1;
        if (j < 0 || j >= items.length) return;
        if (j > i) list.insertBefore(items[j], items[i]);
        else list.insertBefore(items[i], items[j]);
        Array.prototype.forEach.call(list.children, function (li, idx) {
          var up = li.querySelector('[data-qup]');
          var down = li.querySelector('[data-qdown]');
          if (up) up.setAttribute('data-qup', idx);
          if (down) down.setAttribute('data-qdown', idx);
        });
      };
    });
    var go = el.querySelector('#qgo');
    if (go) go.onclick = function () { gradeQuestion(el, api, q); };
    var next = el.querySelector('#qnext');
    if (next) next.onclick = function () {
      var list = api.filterQuestions(qs(api), { bucket: filters.bucket, type: filters.type, level: filters.level, work: filters.work });
      filters.cursor = ((filters.cursor || 0) + 1) % Math.max(list.length, 1);
      api.refresh();
    };
  }
  function gradeQuestion(el, api, q) {
    var got = '';
    if (q.유형 === '순서' && q.보기) got = currentOrder(el).join(' → ');
    else if (q.보기 && q.보기.length) {
      var c = el.querySelector('input[name="ans"]:checked');
      got = c ? c.value : '';
    } else got = (el.querySelector('#qtext') || {}).value || '';
    var ok = norm(got) !== '' && norm(got) === norm(q.정답);
    var open = !(q.보기 && q.보기.length);
    var box = el.querySelector('#qresult');
    if (open && norm(got) === '') {
      box.innerHTML = '<div class="warnbox"><b>정답</b><br>' + api.esc(q.정답) + '<br><b>해설</b><br>' + api.esc(q.해설 || '') + '<br><span class="muted">근거 ' + api.esc(q.근거 || '') + '</span></div>' +
        '<div class="row"><button class="btn small" id="mark-ok" type="button">맞았어요</button><button class="btn-ghost small" id="mark-no" type="button">틀렸어요</button></div>';
      box.querySelector('#mark-ok').onclick = function () { api.saveQuestion(q.id, true).then(function () { api.toast('맞음으로 기록했어요.'); }); };
      box.querySelector('#mark-no').onclick = function () { api.saveQuestion(q.id, false).then(function () { api.toast('틀린 문제에 넣었어요.'); }); };
      return;
    }
    api.saveQuestion(q.id, ok);
    box.innerHTML = '<div class="' + (ok ? 'okbox' : 'nobox') + '"><b>' + (ok ? '맞아요' : '틀려요') + '</b><br>정답: ' + api.esc(q.정답) +
      '<br>' + api.esc(q.해설 || '') + '<br><span class="muted">근거 ' + api.esc(q.근거 || '') + '</span></div>';
  }

  function wrongView(el, api) {
    var all = qs(api);
    var ids = Object.keys(api.records().questions || {}).filter(function (id) { return api.records().questions[id] && api.records().questions[id].ok === false; });
    var h = '<button class="linkish" id="back" type="button">← 연습장</button><section class="card"><h1>틀린 문제</h1>';
    if (!ids.length) h += '<p>아직 틀린 문제가 없어요.</p>';
    ids.forEach(function (id) {
      var q = all.filter(function (x) { return x.id === id; })[0];
      if (!q) return;
      h += '<article class="q-card"><b>' + api.esc(q.id) + '</b> ' + api.esc(q.질문) +
        '<div class="okbox" style="margin-top:8px">정답: ' + api.esc(q.정답) + '<br>' + api.esc(q.해설 || '') + '<br><span class="muted">' + api.esc(q.근거 || '') + '</span></div></article>';
    });
    h += '</section>';
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/practice'); };
  }

  ShellModules.practice = { id: 'practice', tab: '연습장', icon: icon, render: render };
})();
