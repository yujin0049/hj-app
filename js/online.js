/* 온라인 묶음 버전 비교. 사람 이름과 비밀문구는 여기 두지 않아요. */
(function (root) {
  'use strict';

  function newer(pack, online, header) {
    if (!header || !header.packVersion) return false;
    var seen = (online && online.packVersion) || (pack && pack.packVersion) || '';
    if (String(header.packVersion) > String(seen)) return true;
    if (online && online.sealedAt && header.sealedAt && String(header.packVersion) === String(seen) && String(header.sealedAt) > String(online.sealedAt)) return true;
    return false;
  }

  function hasEdits(ed) {
    if (!ed) return false;
    if (ed.dorm) return true;
    if (ed.computersList) return true;
    if (ed.work_items) return true;
    var bags = ['rules', 'monthly', 'budget', 'news'];
    for (var i = 0; i < bags.length; i++) {
      if (ed[bags[i]] && Object.keys(ed[bags[i]]).length) return true;
    }
    if ((ed.monthlyAdded || []).length || (ed.monthlyDeleted || []).length) return true;
    if ((ed.newsAdded || []).length || (ed.newsDeleted || []).length) return true;
    return false;
  }

  function idMap(list) {
    var m = {};
    (list || []).forEach(function (row) { if (row && row.id != null) m[String(row.id)] = row; });
    return m;
  }
  function changedIds(oldList, newList, ids) {
    var a = idMap(oldList);
    var b = idMap(newList);
    return ids.filter(function (id) {
      return JSON.stringify(a[id] || null) !== JSON.stringify(b[id] || null);
    });
  }

  function mergeKeepEdits(oldPack, newPack, edits) {
    var ed = JSON.parse(JSON.stringify(edits || {}));
    var conflicts = [];
    var oldE = (oldPack && oldPack.entities) || {};
    var newE = (newPack && newPack.entities) || {};
    function note(label) { if (conflicts.indexOf(label) < 0) conflicts.push(label); }
    if (changedIds(oldE.rules, newE.rules, Object.keys(ed.rules || {})).length) note('규칙');
    if (changedIds(oldE.budget_lines, newE.budget_lines, Object.keys(ed.budget || {})).length) note('예산');
    if (changedIds(oldE.monthly_todos, newE.monthly_todos, Object.keys(ed.monthly || {})).length) note('할 일');
    if ((ed.monthlyDeleted || []).some(function (id) {
      return JSON.stringify(idMap(oldE.monthly_todos)[id] || null) !== JSON.stringify(idMap(newE.monthly_todos)[id] || null);
    })) note('할 일');
    if (changedIds(oldE.news, newE.news, Object.keys(ed.news || {})).length) note('소식');
    if (ed.computersList && JSON.stringify(oldE.computers || []) !== JSON.stringify(newE.computers || [])) note('컴퓨터');
    if (ed.work_items && JSON.stringify(oldE.work_items || []) !== JSON.stringify(newE.work_items || [])) note('업무');
    if (ed.dorm && JSON.stringify(oldE.dorm || null) !== JSON.stringify(newE.dorm || null)) note('기숙사');
    (ed.conflicts || []).forEach(note);
    ed.conflicts = conflicts;
    return { edits: ed, conflicts: conflicts };
  }

  root.APOnline = { newer: newer, hasEdits: hasEdits, mergeKeepEdits: mergeKeepEdits };
})(typeof globalThis !== 'undefined' ? globalThis : this);
