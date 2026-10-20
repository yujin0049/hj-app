/* 검색과 예산 계산. 문장 설명은 하지 않고, 숫자만 계산해요. */
(function (root) {
  'use strict';
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function blocksText(blocks) {
    var lines = [];
    (blocks || []).forEach(function (b) {
      if (b.type === 'h' || b.type === 'p') lines.push(String(b.text || '').replace(/\*\*/g, ''));
      else if (b.type === 'ul') lines.push((b.items || []).join(' ').replace(/\*\*/g, ''));
      else if (b.type === 'table') {
        lines.push((b.head || []).join(' ').replace(/\*\*/g, ''));
        (b.rows || []).forEach(function (r) { lines.push(r.join(' ').replace(/\*\*/g, '')); });
      }
    });
    return lines.join('\n');
  }
  function cut(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > 120 ? s.slice(0, 120) + '…' : s;
  }
  function searchGuide(guide, q) {
    var n = norm(q);
    if (!n || !guide) return [];
    var out = [];
    (guide.sections || []).forEach(function (sec) {
      var blob = norm(sec.title + '\n' + blocksText(sec.blocks));
      if (blob.indexOf(n) < 0) return;
      out.push({ zone: '학생 안내', title: sec.title, text: cut(blocksText(sec.blocks)), href: '#/students/' + sec.id });
    });
    return out;
  }
  function push(out, zone, title, text, href, q) {
    var blob = norm(title + ' ' + text);
    if (blob.indexOf(norm(q)) < 0) return;
    out.push({ zone: zone, title: title, text: cut(text), href: href });
  }
  function searchAdmin(view, q) {
    if (!view || !norm(q)) return [];
    var out = [];
    var ent = view.entities || {};
    (ent.work_items || []).forEach(function (w) {
      push(out, '업무', w.title, (w.stage || '') + ' ' + (w.memo || '') + ' ' + (w.missing || ''), '#/board/' + w.id, q);
    });
    (ent.monthly_todos || []).forEach(function (t) {
      push(out, '이번 달', t.title, (t.when || '') + ' ' + (t.note || ''), '#/more/month', q);
    });
    (ent.rules || []).forEach(function (r) {
      push(out, '규칙', r.id + ' ' + (r.text || ''), r.basis || '', '#/more/rule/' + r.id, q);
    });
    (ent.budget_lines || []).forEach(function (b) {
      push(out, '예산', (b.project || '') + ' ' + (b.item || ''), b.memo || '', '#/more/budget', q);
    });
    (ent.study_days || []).forEach(function (d) {
      push(out, '공부', d.day + '일차 ' + (d.title || ''), d.goal || '', '#/study/day/' + d.day, q);
    });
    (ent.questions || []).forEach(function (item) {
      push(out, '문제', item.id + ' ' + (item.질문 || ''), item.해설 || '', '#/practice/quiz', q);
    });
    (ent.learning_items || []).forEach(function (item) {
      push(out, '익힐 업무', item.id + ' ' + (item.name || ''), item.idea || '', '#/practice/learn', q);
    });
    var man = ent.manual && ent.manual.blocks;
    if (man && norm(blocksText(man)).indexOf(norm(q)) >= 0) {
      out.push({ zone: '인수인계', title: '업무 매뉴얼', text: cut(blocksText(man)), href: '#/more/manual' });
    }
    var plan = ent.planning && ent.planning.blocks;
    if (plan && norm(blocksText(plan)).indexOf(norm(q)) >= 0) {
      out.push({ zone: '기획', title: '사업 기획', text: cut(blocksText(plan)), href: '#/more/plan' });
    }
    (ent.news || []).forEach(function (n) {
      push(out, '소식', n.title, (n.date || '') + ' ' + (n.summary || '') + ' ' + (n.category || ''), '#/news/' + n.id, q);
    });
    (ent.computers || []).forEach(function (c) {
      push(out, '컴퓨터', (c.location || '') + ' ' + (c.model || ''), (c.user_type || '') + ' ' + (c.user || '') + ' ' + (c.os_version || '') + ' ' + (c.maker || ''), '#/computers/' + c.id, q);
    });
    var dormRows = (ent.dorm && ent.dorm.rows) || [];
    dormRows.forEach(function (r) {
      if (!r || r['구분'] === '빈방') return;
      push(out, '기숙사', (r['이름'] || '') + ' ' + (r['건물'] || '') + ' ' + (r['호실'] || ''), (r['구분'] || '') + ' ' + (r['상태'] || '') + ' ' + (r['비고'] || ''), '#/dorm', q);
    });
    return out.slice(0, 40);
  }
  function searchAll(guide, view, q) {
    return searchGuide(guide, q).concat(view ? searchAdmin(view, q) : []).slice(0, 40);
  }
  function budgetRate(line) {
    if (!line || line.needsConfirm) return null;
    var a = Number(line.allocated);
    if (!(a > 0) || line.spent == null || line.spent === '' || Number.isNaN(Number(line.spent))) return null;
    return Math.round(Number(line.spent) / a * 1000) / 10;
  }
  var api = { norm: norm, blocksText: blocksText, searchGuide: searchGuide, searchAdmin: searchAdmin, searchAll: searchAll, budgetRate: budgetRate };
  root.APSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
