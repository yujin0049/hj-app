/* 볼트 마크다운 → 화면 (js/modules/vault.js). 글자는 모두 textContent 로만 넣어요(innerHTML 안 씀).
   되는 꼴: 제목·목록·표·인용·코드·굵게·기울임·취소선·http(s) 링크·[[위키링크]](팩 안 문서만 이동). */
(function (root) {
  'use strict';
  function node(doc, tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  /* 한 줄 안의 꼴. resolve(이름) → 문서 id 또는 null */
  function inline(doc, parent, s, resolve) {
    var rx = /`([^`]+)`|\*\*(.+?)\*\*|~~(.+?)~~|(!?)\[\[([^\]|#]*)(#[^\]|]*)?(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g;
    var last = 0, m;
    while ((m = rx.exec(s))) {
      var at = m.index + (m[11] != null ? m[10].length : 0);   /* 기울임 앞 글자는 그대로 */
      if (at > last) parent.appendChild(doc.createTextNode(s.slice(last, at)));
      if (m[1] != null) parent.appendChild(node(doc, 'code', '', m[1]));
      else if (m[2] != null) inline(doc, parent.appendChild(node(doc, 'b')), m[2], resolve);
      else if (m[3] != null) inline(doc, parent.appendChild(node(doc, 's')), m[3], resolve);
      else if (m[5] != null) {
        var label = m[7] || (m[5] + (m[6] || '')) || m[6] || '';
        var id = m[5] && resolve ? resolve(m[5]) : null;
        if (id && /^[0-9a-f]{12}$/.test(id)) {
          var a = node(doc, 'a', 'wiki', label);
          a.setAttribute('href', '#/vault/doc/' + id);
          a.setAttribute('data-doc', id);
          parent.appendChild(a);
        } else parent.appendChild(node(doc, 'span', 'wiki-missing', label));
      } else if (m[8] != null) {
        if (/^https?:\/\//i.test(m[9])) {
          var l = node(doc, 'a', '', m[8]);
          l.setAttribute('href', m[9]);
          l.setAttribute('target', '_blank');
          l.setAttribute('rel', 'noopener noreferrer');
          parent.appendChild(l);
        } else parent.appendChild(doc.createTextNode(m[8]));   /* javascript: 같은 링크는 글자만 */
      } else if (m[11] != null) inline(doc, parent.appendChild(node(doc, 'i')), m[11], resolve);
      last = rx.lastIndex;
      if (m[0] === '') rx.lastIndex++;
    }
    if (last < s.length) parent.appendChild(doc.createTextNode(s.slice(last)));
    return parent;
  }
  function cells(r) {   /* \| 는 칸 나눔이 아님 */
    return r.trim().replace(/^\|/, '').replace(/\|$/, '').replace(/\\\|/g, '\u0001').split('|').map(function (c) { return c.trim().replace(/\u0001/g, '|'); });
  }
  var LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  /* text → DocumentFragment. opts: { resolve, skipTitle(첫 # 제목이 문서 제목과 같으면 뺌) } */
  function render(text, opts, doc) {
    doc = doc || root.document;
    opts = opts || {};
    var R = opts.resolve;
    var frag = doc.createDocumentFragment();
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var para = [], i = 0, firstHead = true;
    function flush() {
      if (!para.length) return;
      var p = node(doc, 'p');
      para.forEach(function (ln, k) { if (k) p.appendChild(node(doc, 'br')); inline(doc, p, ln, R); });
      frag.appendChild(p);
      para = [];
    }
    while (i < lines.length) {
      var ln = lines[i], m;
      if (/^\s*(```|~~~)/.test(ln)) {
        flush();
        var buf = [];
        i++;
        while (i < lines.length && !/^\s*(```|~~~)/.test(lines[i])) buf.push(lines[i++]);
        i++;
        frag.appendChild(node(doc, 'pre')).appendChild(node(doc, 'code', '', buf.join('\n')));
        continue;
      }
      if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(ln))) {
        flush();
        i++;
        if (firstHead && m[1].length === 1 && opts.skipTitle && m[2].trim() === opts.skipTitle) { firstHead = false; continue; }
        firstHead = false;
        frag.appendChild(inline(doc, node(doc, 'h' + Math.min(m[1].length + 1, 6)), m[2], R));
        continue;
      }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)) { flush(); frag.appendChild(node(doc, 'hr')); i++; continue; }
      if (/^\s*\|/.test(ln) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        var wrap = node(doc, 'div', 'scroll'), table = node(doc, 'table', 'plain'), tr = node(doc, 'tr');
        cells(ln).forEach(function (c) { tr.appendChild(inline(doc, node(doc, 'th'), c, R)); });
        table.appendChild(tr);
        i += 2;
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          var row = node(doc, 'tr');
          cells(lines[i++]).forEach(function (c) { row.appendChild(inline(doc, node(doc, 'td'), c, R)); });
          table.appendChild(row);
        }
        wrap.appendChild(table);
        frag.appendChild(wrap);
        continue;
      }
      if (/^\s*>/.test(ln)) {
        flush();
        var q = [], bq = node(doc, 'blockquote');
        while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
        if (q.length && /^\[!\w+\]/.test(q[0])) {
          var t = q[0].replace(/^\[!(\w+)\][+-]?\s*/, '');
          if (t) q[0] = t; else q.shift();
        }
        q.forEach(function (x, k) { if (k) bq.appendChild(node(doc, 'br')); inline(doc, bq, x, R); });
        frag.appendChild(bq);
        continue;
      }
      if ((m = LIST.exec(ln))) {
        flush();
        var list = node(doc, /^\d/.test(m[2]) ? 'ol' : 'ul');
        while (i < lines.length) {
          var mm = LIST.exec(lines[i]);
          if (mm) {
            var lv = Math.min(3, Math.floor(mm[1].replace(/\t/g, '    ').length / 2));
            var body = mm[3].replace(/^\[ \]\s*/, '☐ ').replace(/^\[[xX]\]\s*/, '☑ ');
            list.appendChild(inline(doc, node(doc, 'li', lv ? 'lv' + lv : ''), body, R));
            i++;
          } else if (/^\s{2,}\S/.test(lines[i]) && list.lastChild) {
            list.lastChild.appendChild(node(doc, 'br'));
            inline(doc, list.lastChild, lines[i++].trim(), R);
          } else break;
        }
        frag.appendChild(list);
        continue;
      }
      if (!ln.trim()) { flush(); i++; continue; }
      para.push(ln);
      i++;
    }
    flush();
    return frag;
  }
  function plainPre(text, doc) {
    doc = doc || root.document;
    var f = doc.createDocumentFragment();
    f.appendChild(node(doc, 'pre', 'json')).appendChild(node(doc, 'code', '', String(text || '')));
    return f;
  }
  root.VaultMd = { render: render, inline: inline, plainPre: plainPre };
})(typeof window !== 'undefined' ? window : globalThis);
