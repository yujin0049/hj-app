/* 잠긴 볼트 문서 API 읽기 (같은 주소 api/vault/*, Access 쿠키). 볼트 글은 저장소에 없고 기기에도 저장하지 않아요.
   실패 종류(e.kind): locked(401·403) · missing(404) · down(503·그 밖·인터넷·JSON 아님) */
(function (root) {
  'use strict';
  var idxP = null;
  function fail(kind, status) {
    var e = new Error('vault ' + kind + (status ? ' ' + status : ''));
    e.kind = kind;
    e.status = status || 0;
    return e;
  }
  function kindOf(status) {
    if (status === 401 || status === 403) return 'locked';
    if (status === 404) return 'missing';
    return 'down';
  }
  function get(path) {
    return fetch(new URL(path, document.baseURI).href, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw fail(kindOf(r.status), r.status);
      if ((r.headers.get('content-type') || '').indexOf('json') < 0) throw fail('missing', r.status);   /* 공개 연습장은 이 주소가 없음 */
      return r.json().catch(function () { throw fail('down', r.status); });
    }, function () { throw fail('down', 0); });
  }
  function index(force) {
    if (!idxP || force) idxP = get('api/vault/index').catch(function (e) { idxP = null; throw e; });
    return idxP;
  }
  function doc(id) {
    if (!/^[0-9a-f]{12}$/.test(String(id))) return Promise.reject(fail('missing', 400));
    return get('api/vault/doc?id=' + id);
  }
  function search(q) { return get('api/vault/search?q=' + encodeURIComponent(String(q).slice(0, 50))); }
  function norm(p) { return String(p || '').replace(/\\/g, '/').replace(/^\/+/, ''); }
  /* 볼트 경로(sources.json 의 path, 예 봇공유/20 규정·지침/x.md) → 문서 id. 못 찾거나 잠겨 있으면 null */
  function idForPath(path, ix) {
    var p = norm(path);
    function find(x) {
      var base = x.vault_root ? x.vault_root + '/' : '';
      var d = (x.docs || []).filter(function (d) {
        return d.path === p || (base && d.path === base + p) || (base && base + d.path === p);
      })[0];
      return d ? d.id : null;
    }
    if (!p) return Promise.resolve(null);
    if (ix) return Promise.resolve(find(ix));
    return index().then(find, function () { return null; });
  }
  /* [[위키링크]] 이름 → id (파일 이름·제목·별명·경로) */
  function resolver(ix) {
    var names = {};
    (ix && ix.docs || []).forEach(function (d) {
      var path = String(d.path || ''), noExt = path.replace(/\.(md|json)$/i, '');
      [d.stem, d.title, noExt, path, noExt.replace(/^[^/]+\//, '')].concat(d.aliases || []).forEach(function (k) {
        k = String(k || '').trim().toLowerCase();
        if (k && !names[k]) names[k] = d.id;
      });
    });
    return function (t) {
      t = String(t || '').trim().toLowerCase().replace(/\.md$/, '');
      return names[t] || names[t.split('/').pop()] || null;
    };
  }
  root.VaultApi = { index: index, doc: doc, search: search, idForPath: idForPath, resolver: resolver, kindOf: kindOf };
})(typeof window !== 'undefined' ? window : globalThis);
