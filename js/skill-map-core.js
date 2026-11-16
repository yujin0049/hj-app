/* 역량맵 계산. 브라우저와 node 시험이 같이 씀. 외부 API 없음. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HJSkillMap = factory();
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var EMPTY = '데이터 없음';
  var PENDING = '문제 준비 중(데이터 없음)';
  var STORE_KEY = 'hj-skill-map-v1';
  var MIN_Q = 5;
  var WEAK = 0.6;

  function norm(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function knownIds(meta) {
    var out = [];
    var list = (meta && meta.competencies) || [];
    var i;
    for (i = 0; i < list.length; i++) if (list[i] && list[i].id) out.push(list[i].id);
    return out;
  }

  function compById(meta, id) {
    var list = (meta && meta.competencies) || [];
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function questionsOf(bank, id) {
    var list = (bank && bank.questions) || bank || [];
    var out = [], i, q;
    for (i = 0; i < list.length; i++) {
      q = list[i];
      if (q && q.competency === id && q.src && String(q.src).trim()) out.push(q);
    }
    return out;
  }

  function readyCount(bank, id) {
    return questionsOf(bank, id).length;
  }

  function isReady(bank, id) {
    return readyCount(bank, id) >= MIN_Q;
  }

  /* 붙여 넣은 글에서 사전 낱말이 보이면 해당 역량을 찾는다. 긴 낱말부터. */
  function match(text, keywords) {
    var raw = norm(text);
    var dict = (keywords && keywords.keywords) || keywords || {};
    var hits = [];
    var id, words, found, i, w, at;
    if (!raw) return hits;
    Object.keys(dict).forEach(function (key) {
      words = dict[key] || [];
      found = [];
      for (i = 0; i < words.length; i++) {
        w = norm(words[i]);
        if (!w) continue;
        at = raw.indexOf(w);
        if (at >= 0 && found.indexOf(w) < 0) found.push(w);
      }
      if (found.length) hits.push({ id: key, terms: found });
    });
    return hits;
  }

  function highlightIds(text, keywords) {
    return match(text, keywords).map(function (h) { return h.id; });
  }

  function shuffle(list, rnd) {
    var a = list.slice(), i, j, t;
    rnd = rnd || Math.random;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(rnd() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 보기 순서를 섞고, 정답 인덱스를 새 위치에 맞춘다. 문항 본문·근거는 그대로. */
  function shuffleChoices(q, rnd) {
    if (!q || !q.choices || !q.choices.length) return q;
    var pairs = q.choices.map(function (c, i) { return { c: c, ok: i === q.answer }; });
    pairs = shuffle(pairs, rnd);
    var next = {};
    Object.keys(q).forEach(function (k) { next[k] = q[k]; });
    next.choices = pairs.map(function (p) { return p.c; });
    next.answer = 0;
    var i;
    for (i = 0; i < pairs.length; i++) if (pairs[i].ok) { next.answer = i; break; }
    return next;
  }

  function isCpId(id) {
    return /^CP\d{2}$/.test(String(id || ''));
  }

  function skillIdsForCps(cpMap, cps) {
    var want = {}, out = [], seen = {};
    (cps || []).forEach(function (c) { want[c] = 1; });
    ((cpMap && cpMap.map) || []).forEach(function (row) {
      if (!row || !want[row.cp]) return;
      var ids = row.skillIds && row.skillIds.length ? row.skillIds : (row.primary ? [row.primary] : []);
      ids.forEach(function (id) {
        if (id && !seen[id]) { seen[id] = 1; out.push(id); }
      });
    });
    return out;
  }

  function cpsForSkill(cpMap, skillId) {
    var out = [];
    ((cpMap && cpMap.map) || []).forEach(function (row) {
      var ids = (row && row.skillIds) || [];
      if (row && ids.indexOf(skillId) >= 0) out.push(row);
    });
    return out;
  }

  function cpRow(cpMap, cp) {
    var rows = (cpMap && cpMap.map) || [], i;
    for (i = 0; i < rows.length; i++) if (rows[i] && rows[i].cp === cp) return rows[i];
    return null;
  }

  /* 칸 id와 CP01 꼴을 섞어 넘겨도 16칸 id로 푼다. */
  function expandToSkillIds(cpMap, ids) {
    var cps = [], skills = [], seen = {}, out = [];
    (ids || []).forEach(function (id) {
      if (isCpId(id)) cps.push(id);
      else if (id && !seen[id]) { seen[id] = 1; out.push(id); }
    });
    skillIdsForCps(cpMap, cps).forEach(function (id) {
      if (id && !seen[id]) { seen[id] = 1; out.push(id); }
    });
    return out;
  }

  function mergeCpKeywords(keywords, cpMap) {
    var dict = (keywords && keywords.keywords) || keywords || {};
    var out = {}, k;
    Object.keys(dict).forEach(function (key) { out[key] = (dict[key] || []).slice(); });
    ((cpMap && cpMap.map) || []).forEach(function (row) {
      var id = row && row.primary;
      if (!id) return;
      var extra = (row.terms || []).concat(row.name ? [row.name] : []);
      var cur = out[id] || [];
      extra.forEach(function (w) {
        w = norm(w);
        if (w && cur.indexOf(w) < 0) cur.push(w);
      });
      out[id] = cur;
    });
    return { keywords: out };
  }

  function filterDaysByLadder(days, cps) {
    if (!(cps || []).length) return (days || []).slice();
    return (days || []).filter(function (d) { return d && cps.indexOf(d.competency_id) >= 0; });
  }

  function pickWeekForLadder(weeks, ladderCps, fallbackId) {
    var ids = Object.keys(weeks || {}).sort();
    var fb = fallbackId || ids[0] || '';
    if (!(ladderCps || []).length) return fb;
    var best = fb, bestN = -1;
    ids.forEach(function (wid) {
      var n = 0;
      ((weeks[wid] && weeks[wid].cps) || []).forEach(function (c) {
        if (ladderCps.indexOf(c) >= 0) n += 1;
      });
      if (n > bestN) { bestN = n; best = wid; }
    });
    return bestN > 0 ? best : fb;
  }

  /* 강조된 역량(문제 5개 이상인 칸만)에서 n문항. 가능하면 칸을 고르게. src 없는 문제는 넣지 않음.
     highlighted 에 CP01 꼴이 있으면 cpMap으로 16칸 id로 푼다. */
  function drawQuiz(bank, highlighted, n, rnd, cpMap) {
    n = n == null ? 3 : n;
    var ids = expandToSkillIds(cpMap, highlighted).filter(function (id) { return isReady(bank, id); });
    var pools = {}, i, id, qs, pick, out = [], used = {};
    if (!ids.length) return [];
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      pools[id] = shuffle(questionsOf(bank, id), rnd);
    }
    ids = shuffle(ids, rnd);
    /* 1순회: 칸마다 1개 */
    for (i = 0; i < ids.length && out.length < n; i++) {
      qs = pools[ids[i]];
      if (!qs || !qs.length) continue;
      pick = qs.shift();
      if (pick && pick.id && !used[pick.id]) {
        used[pick.id] = 1;
        out.push(shuffleChoices(pick, rnd));
      }
    }
    /* 부족하면 남은 문제에서 채움 */
    var rest = [];
    for (i = 0; i < ids.length; i++) rest = rest.concat(pools[ids[i]] || []);
    rest = shuffle(rest, rnd);
    for (i = 0; i < rest.length && out.length < n; i++) {
      if (rest[i] && rest[i].id && !used[rest[i].id]) {
        used[rest[i].id] = 1;
        out.push(shuffleChoices(rest[i], rnd));
      }
    }
    return out;
  }

  function cleanScores(raw, ids) {
    var scores = {}, src = (raw && raw.scores) || raw || {}, k, v, ok, n;
    var allow = ids ? (function () { var m = {}; ids.forEach(function (x) { m[x] = 1; }); return m; }()) : null;
    Object.keys(src).forEach(function (key) {
      if (allow && !allow[key]) return;
      v = src[key] || {};
      ok = Number(v.ok);
      n = Number(v.n);
      if (!isFinite(ok) || !isFinite(n) || n < 0 || ok < 0) return;
      scores[key] = { ok: Math.floor(ok), n: Math.floor(n) };
    });
    return { scores: scores };
  }

  function readScores(store, ids) {
    if (!store || typeof store.getItem !== 'function') return { scores: {} };
    try {
      var raw = store.getItem(STORE_KEY);
      if (!raw) return { scores: {} };
      return cleanScores(JSON.parse(raw), ids);
    } catch (e) {
      return { scores: {} };
    }
  }

  /* results: [{competency, correct:boolean}] — id·점수만 저장 */
  function applyResults(state, results) {
    var next = { scores: Object.assign({}, (state && state.scores) || {}) };
    (results || []).forEach(function (r) {
      var id = r && r.competency;
      if (!id) return;
      var cur = next.scores[id] || { ok: 0, n: 0 };
      next.scores[id] = { ok: cur.ok + (r.correct ? 1 : 0), n: cur.n + 1 };
    });
    return next;
  }

  function writeScores(store, state) {
    if (!store || typeof store.setItem !== 'function') return;
    var slim = cleanScores(state);
    store.setItem(STORE_KEY, JSON.stringify(slim));
    return slim;
  }

  function rate(scores, id) {
    var s = scores && scores[id];
    if (!s || !s.n) return null;
    return s.ok / s.n;
  }

  function isWeak(scores, id) {
    var r = rate(scores, id);
    return r != null && r < WEAK;
  }

  function srcOk(q) {
    var s = q && q.src && String(q.src).trim();
    if (!s) return false;
    if (/obsidian:\/\//i.test(s)) return false;
    if (/\/home\/box\//i.test(s)) return false;
    if (/봇공유\//.test(s)) return false;
    if (/vault/i.test(s) && /path|obsidian/i.test(s)) return false;
    return true;
  }

  function validateBank(bank) {
    var list = (bank && bank.questions) || [];
    var bad = [], i, q;
    for (i = 0; i < list.length; i++) {
      q = list[i];
      if (!q || !q.id || !q.competency || !q.q || !q.choices || !q.choices.length) {
        bad.push({ id: q && q.id, reason: 'shape' });
        continue;
      }
      if (!srcOk(q)) bad.push({ id: q.id, reason: 'src' });
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.choices.length) {
        bad.push({ id: q.id, reason: 'answer' });
      }
    }
    return bad;
  }

  return {
    EMPTY: EMPTY,
    PENDING: PENDING,
    STORE_KEY: STORE_KEY,
    MIN_Q: MIN_Q,
    WEAK: WEAK,
    norm: norm,
    knownIds: knownIds,
    compById: compById,
    questionsOf: questionsOf,
    readyCount: readyCount,
    isReady: isReady,
    match: match,
    highlightIds: highlightIds,
    shuffleChoices: shuffleChoices,
    isCpId: isCpId,
    skillIdsForCps: skillIdsForCps,
    cpsForSkill: cpsForSkill,
    cpRow: cpRow,
    expandToSkillIds: expandToSkillIds,
    mergeCpKeywords: mergeCpKeywords,
    filterDaysByLadder: filterDaysByLadder,
    pickWeekForLadder: pickWeekForLadder,
    drawQuiz: drawQuiz,
    cleanScores: cleanScores,
    readScores: readScores,
    applyResults: applyResults,
    writeScores: writeScores,
    rate: rate,
    isWeak: isWeak,
    srcOk: srcOk,
    validateBank: validateBank
  };
}));
