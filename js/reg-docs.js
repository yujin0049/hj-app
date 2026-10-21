/* T057 (261021): 규정 카드 「원문 바로 보기」. data/reg_docs.json 의 공개 사본(docs/regs/)을 앱 안에서 펼쳐 보여 주고,
   볼트 원본 노트는 「옵시디언에서 열기」로 연결. 옵시디언이 없는 휴대폰에서도 원문을 읽을 수 있게. */
(function (root) {
  var cache = null;
  function abs(f) { return new URL(f, document.baseURI).href; }
  function load() {
    if (!cache) {
      cache = fetch(abs('data/reg_docs.json'), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('reg_docs'); return r.json(); })
        .catch(function () { return { cards: {} }; });
    }
    return cache;
  }
  function safeFile(f) { return /^docs\/regs\/[^\/]+\.md$/.test(f || '') && f.indexOf('..') < 0; }
  function html(esc, docs, cfg) {
    var h = '<div class="regdocs"><p class="kicker">원문 바로 보기</p>';
    docs.forEach(function (d, i) {
      if (!safeFile(d.file)) return;
      h += '<div class="regdoc" data-regdoc="' + i + '">' +
        '<button class="btn block" type="button" data-regdoc-open="' + i + '">' + esc(d.title) + ' 보기</button>' +
        '<div class="pre src-excerpt hidden" data-regdoc-body="' + i + '" style="max-height:60vh;overflow:auto"></div>';
      var url = root.SourceLink && d.vault ? root.SourceLink.obsidianUrl(cfg || {}, d.vault) : '';
      if (url) h += '<a class="btn-ghost block" data-regdoc-obsidian="' + i + '" href="' + esc(url) + '">옵시디언에서 열기</a>';
      h += '<p class="muted" style="word-break:break-all">볼트 노트: ' + esc(d.vault || '') + '</p></div>';
    });
    return h + '</div>';
  }
  function fill(el, key, esc) {
    var slot = el.querySelector('[data-regdocs-slot]');
    if (!slot) return Promise.resolve();
    var cfgP = root.SourceLink ? root.SourceLink.load().then(function (d) { return d.cfg || {}; }) : Promise.resolve({});
    return Promise.all([load(), cfgP]).then(function (r) {
      var docs = (r[0].cards || {})[key] || [];
      if (!docs.length) { slot.innerHTML = ''; return; }
      slot.innerHTML = html(esc, docs, r[1]);
      Array.prototype.forEach.call(slot.querySelectorAll('[data-regdoc-open]'), function (b) {
        b.onclick = function () {
          var i = b.getAttribute('data-regdoc-open'), d = docs[i], box = slot.querySelector('[data-regdoc-body="' + i + '"]');
          if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
          box.classList.remove('hidden');
          if (box.getAttribute('data-loaded')) return;
          box.textContent = '불러오는 중…';
          return fetch(abs(d.file), { cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error(res.status);
            return res.text();
          }).then(function (t) {
            box.textContent = t; box.setAttribute('data-loaded', '1');
          }).catch(function () { box.textContent = '원문을 못 불러왔어요. 인터넷을 확인하거나 옵시디언에서 열어 주세요.'; });
        };
      });
    });
  }
  root.RegDocs = { load: load, fill: fill, html: html, safeFile: safeFile };
})(typeof window !== 'undefined' ? window : globalThis);
