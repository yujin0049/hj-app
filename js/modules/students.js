(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  var META = {
    schedule: { emoji: '🗓️', sub: '교시·강의실·연수 일정', tone: 'blue' },
    papers: { emoji: '📄', sub: '출결·성적·신청 양식', tone: 'green' },
    dorm: { emoji: '🏠', sub: '입소·생활 규칙·관비', tone: 'orange' },
    faq: { emoji: '❓', sub: '자주 묻는 질문', tone: 'purple' },
    news: { emoji: '📢', sub: '꼭 볼 공지', tone: 'teal' },
    lms: { emoji: '💻', sub: '과제·퀴즈·토론·설문', tone: 'blue' }
  };

  function plain(s) { return String(s || '').replace(/\*\*/g, ''); }

  function linkify(api, text) {
    var t = api.esc(plain(text));
    return t.replace(/(https?:\/\/[^\s<]+|lms\.namhae\.ac\.kr)/g, function (m) {
      var href = m.indexOf('http') === 0 ? m : 'https://' + m;
      return '<a href="' + href + '" target="_blank" rel="noopener">' + m + '</a>';
    });
  }

  function blockBody(api, b) {
    if (b.type === 'p') {
      var pt = plain(b.text);
      if (pt === '---' || !pt.trim()) return '';
      return '<p class="stu-p">' + linkify(api, b.text) + '</p>';
    }
    if (b.type === 'ul') {
      return '<ul class="stu-ul">' + (b.items || []).map(function (it) {
        return '<li>' + linkify(api, it) + '</li>';
      }).join('') + '</ul>';
    }
    if (b.type === 'table') {
      var h = '<div class="scroll stu-table"><table class="plain"><tr>' +
        (b.head || []).map(function (c) { return '<th>' + api.esc(plain(c)) + '</th>'; }).join('') + '</tr>';
      (b.rows || []).forEach(function (r) {
        h += '<tr>' + r.map(function (c) { return '<td>' + api.esc(plain(c)) + '</td>'; }).join('') + '</tr>';
      });
      return h + '</table></div>';
    }
    return '';
  }

  function stepsHtml(api, items) {
    return '<ol class="stu-steps">' + (items || []).map(function (it, i) {
      return '<li class="stu-step">' +
        '<span class="stu-step-n" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="stu-step-tx">' + linkify(api, it) + '</span></li>';
    }).join('') + '</ol>';
  }

  /** Split blocks into intro + sections keyed by each heading. */
  function groupBlocks(blocks) {
    var intro = [];
    var sections = [];
    var cur = null;
    (blocks || []).forEach(function (b) {
      if (b.type === 'h') {
        cur = { title: plain(b.text), blocks: [] };
        sections.push(cur);
        return;
      }
      if (cur) cur.blocks.push(b);
      else intro.push(b);
    });
    return { intro: intro, sections: sections };
  }

  function sectionBody(api, blocks, asSteps) {
    var html = '';
    (blocks || []).forEach(function (b) {
      if (b.type === 'ul' && asSteps && (b.items || []).length) {
        html += stepsHtml(api, b.items);
      } else {
        html += blockBody(api, b);
      }
    });
    return html;
  }

  function useSteps(secId, title, blocks) {
    if (secId === 'lms') return true;
    var hasUl = (blocks || []).some(function (b) { return b.type === 'ul' && (b.items || []).length >= 2; });
    if (!hasUl) return false;
    // Procedure-ish titles in papers/dorm
    return /방법|신청|제출|응시|입소|규칙|참여|응답/.test(title || '');
  }

  function useAccordion(secId, sections) {
    if (secId === 'faq') return true;
    if (secId === 'papers' && sections.length >= 4) return true;
    if (secId === 'schedule' && sections.length >= 5) return true;
    if (secId === 'dorm' && sections.length >= 3) return true;
    return false;
  }

  function renderList(el, api, guide) {
    var h = '<section class="card stu-hero">' +
      '<p class="kicker">공개</p><h1>학생 안내</h1>' +
      '<p class="stu-lead">' + api.esc(guide.notice || '알림은 보내지 않아요.') + '</p></section>';
    h += '<div class="stu-tiles" role="list">';
    (guide.sections || []).forEach(function (s) {
      var m = META[s.id] || { emoji: '📌', sub: '안내 보기', tone: 'blue' };
      h += '<button class="stu-tile" type="button" role="listitem" data-id="' + api.esc(s.id) + '">' +
        '<span class="tile-ic ' + m.tone + '" aria-hidden="true">' + m.emoji + '</span>' +
        '<span class="stu-tile-tx"><b>' + api.esc(s.title) + '</b>' +
        '<span class="tile-sub">' + api.esc(m.sub) + '</span></span>' +
        '<span class="stu-tile-go" aria-hidden="true">›</span></button>';
    });
    h += '</div>';
    if (!(guide.sections || []).length) h += '<section class="card"><p>안내 글을 불러오지 못했어요.</p></section>';
    el.innerHTML = h;
    el.querySelectorAll('[data-id]').forEach(function (b) {
      b.onclick = function () { api.go('#/students/' + b.getAttribute('data-id')); };
    });
  }

  function bindDetail(el, api) {
    el.querySelector('#stu-back').onclick = function () { api.go('#/students'); };

    el.querySelectorAll('.stu-acc-btn').forEach(function (btn) {
      btn.onclick = function () {
        var panel = btn.parentElement;
        var open = panel.classList.toggle('on');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
    });

    el.querySelectorAll('.stu-chip').forEach(function (chip) {
      chip.onclick = function () {
        var tid = chip.getAttribute('data-target');
        var target = el.querySelector('[data-sec="' + tid + '"]');
        if (!target) return;
        el.querySelectorAll('.stu-chip').forEach(function (c) { c.classList.toggle('on', c === chip); });
        if (target.classList.contains('stu-acc')) {
          target.classList.add('on');
          var b = target.querySelector('.stu-acc-btn');
          if (b) b.setAttribute('aria-expanded', 'true');
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
  }

  function renderDetail(el, api, sec) {
    var meta = META[sec.id] || { emoji: '📌', tone: 'blue' };
    var grouped = groupBlocks(sec.blocks);
    var accordion = useAccordion(sec.id, grouped.sections);
    var openFirst = sec.id === 'lms' || sec.id === 'news' || !accordion;

    var h = '<div class="stu-sticky">' +
      '<button class="stu-back" id="stu-back" type="button">← 학생 안내</button></div>';

    h += '<section class="card stu-hero">' +
      '<p class="kicker">알림 없음</p>' +
      '<div class="stu-hero-row">' +
      '<span class="tile-ic ' + meta.tone + '" aria-hidden="true">' + meta.emoji + '</span>' +
      '<h1>' + api.esc(sec.title) + '</h1></div>';
    if (grouped.intro.length) {
      h += '<div class="stu-intro">' + sectionBody(api, grouped.intro, false) + '</div>';
    }
    h += '</section>';

    if (grouped.sections.length >= 3) {
      h += '<div class="stu-chips chips" role="tablist" aria-label="바로가기">';
      grouped.sections.forEach(function (s, i) {
        var short = s.title.replace(/^\d+[-–.]?\d*\.?\s*/, '').slice(0, 14);
        h += '<button class="chip stu-chip' + (i === 0 ? ' on' : '') + '" type="button" data-target="s' + i + '">' +
          api.esc(short) + '</button>';
      });
      h += '</div>';
    }

    if (sec.id === 'lms' && grouped.sections.length) {
      h += '<div class="stu-progress card" aria-label="구성">' +
        '<p class="stu-progress-label">이 글에서 다루는 것</p><div class="stu-progress-row">';
      grouped.sections.forEach(function (s, i) {
        h += '<span class="stu-progress-dot"><i>' + (i + 1) + '</i>' + api.esc(s.title) + '</span>';
      });
      h += '</div></div>';
    }

    grouped.sections.forEach(function (s, i) {
      var asSteps = useSteps(sec.id, s.title, s.blocks);
      var body = sectionBody(api, s.blocks, asSteps);
      var sid = 's' + i;
      if (accordion) {
        var open = openFirst && i === 0;
        h += '<section class="stu-acc' + (open ? ' on' : '') + '" data-sec="' + sid + '">' +
          '<button class="stu-acc-btn" type="button" aria-expanded="' + (open ? 'true' : 'false') + '">' +
          '<span class="stu-acc-n" aria-hidden="true">' + (i + 1) + '</span>' +
          '<span class="stu-acc-tx"><b>' + api.esc(s.title) + '</b></span>' +
          '<span class="stu-acc-chev" aria-hidden="true"></span></button>' +
          '<div class="stu-acc-body">' + body + '</div></section>';
      } else {
        h += '<section class="card stu-sec" data-sec="' + sid + '">' +
          '<h2 class="stu-sec-h"><span class="stu-acc-n" aria-hidden="true">' + (i + 1) + '</span>' +
          api.esc(s.title) + '</h2>' + body + '</section>';
      }
    });

    el.innerHTML = h;
    bindDetail(el, api);
  }

  function render(el, api) {
    var guide = api.guide();
    var id = api.route().parts[1];
    var sec = (guide.sections || []).filter(function (s) { return s.id === id; })[0];
    if (sec) {
      renderDetail(el, api, sec);
      return;
    }
    renderList(el, api, guide);
  }

  ShellModules.students = { id: 'students', tab: '학생', icon: icon, render: render };
})();
