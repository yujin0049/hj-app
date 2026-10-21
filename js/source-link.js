/* 카드 「원문」 → 옵시디언 볼트 연결 (공지 261021-9). 자료: data/sources.json(tools/link_sources.py), data/config.json */
(function (root) {
  var cache = null;
  function getJson(f) {
    return fetch(new URL(f, document.baseURI).href, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(f); return r.json();
    });
  }
  function load() {
    if (!cache) {
      cache = Promise.all([
        getJson('data/sources.json').catch(function () { return null; }),
        getJson('data/config.json').catch(function () { return {}; })
      ]).then(function (r) { return { src: r[0], cfg: r[1] || {} }; });
    }
    return cache;
  }
  function obsidianUrl(cfg, path) {
    if (!cfg.obsidianVault || !path) return '';
    var p = path, pre = (cfg.obsidianVaultRootInBox || '') + '/';
    if (pre.length > 1 && p.indexOf(pre) === 0) p = p.slice(pre.length);
    p = p.replace(/\.md$/, '');
    return 'obsidian://open?vault=' + encodeURIComponent(cfg.obsidianVault) + '&file=' + encodeURIComponent(p);
  }
  function html(esc, rec, cfg, fallback) {
    if (!rec || rec.status === '못 찾음') {
      return '<p><b>원문</b> <span class="badge no">못 찾음</span><br><span class="muted">' + esc(fallback || '') +
        (rec && rec.candidates && rec.candidates.length ? ' · 비슷한 파일(점수 낮음): <span style="word-break:break-all">' + esc(rec.candidates[0].path) + '</span>' : '') + '</span></p>';
    }
    var linked = rec.status === '연결';
    var h = '<div class="src-box" data-src-status="' + esc(rec.status) + '"><p><b>원문</b> <span class="badge' + (linked ? ' ok' : '') + '">' +
      esc(linked ? '볼트 연결' : rec.status) + '</span></p>' +
      '<p class="muted src-path" style="word-break:break-all">' + esc(rec.path) + (rec.heading ? ' › ' + esc(rec.heading) : '') + '</p>';
    var ex = rec.excerpt || {};
    if (ex.text) {
      h += '<p class="kicker">' + (ex.articles_found && ex.articles_found.length ? '꼭 알 조문 발췌 (' + esc(ex.articles_found.join(', ')) + ')' : '앞부분 발췌') + '</p>' +
        '<div class="pre src-excerpt">' + esc(ex.text) + '</div>';
      if (ex.articles_missing && ex.articles_missing.length) h += '<p class="muted">발췌 못 한 조문: ' + esc(ex.articles_missing.join(', ')) + '</p>';
    }
    var url = obsidianUrl(cfg, rec.path);
    if (url) h += '<a class="btn-ghost block" href="' + esc(url) + '">옵시디언에서 열기</a>';
    h += '<p class="muted">점수 ' + Math.round((rec.score || 0) * 100) + ' · 수정 ' + esc(rec.modified || '') + ' · 자동 연결이라 확인 필요할 수 있어요.</p></div>';
    return h;
  }
  /* el 안의 [data-source-slot] 를 채운다 */
  function fill(el, key, fallback, esc) {
    var slot = el.querySelector('[data-source-slot]');
    if (!slot) return Promise.resolve();
    return load().then(function (d) {
      var rec = d.src && d.src.cards ? d.src.cards[key] : null;
      slot.innerHTML = html(esc, rec, d.cfg, fallback);
    });
  }
  root.SourceLink = { load: load, fill: fill, obsidianUrl: obsidianUrl, html: html };
})(typeof window !== 'undefined' ? window : globalThis);
