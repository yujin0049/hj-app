#!/usr/bin/env python3
"""앱 카드의 「원문」을 옵시디언 볼트 파일과 자동으로 잇는다 (공지 261021-9, 유진님 10.21. 10:04).

볼트(기본 /home/box/vault)를 훑어 파일 이름·frontmatter(title/aliases)·제목줄(#)을 모으고,
public-pack.json 카드(기본: regulations)의 이름·원문 칸·r코드와 점수를 매겨 맞춘다.
결과: data/sources.json  (카드 id → 볼트 상대 경로, 맞은 제목줄, 꼭 알 조문 발췌, 점수, 수정일)
  점수 >= LINK  → 「연결」
  점수 >= CAND  → 「후보 있음(확인 필요)」
  그 밖        → 「못 찾음」
다시 돌리면 갱신. 원본(볼트)은 읽기만 한다.

개인정보: hj-app은 공개 GitHub라서 발췌는 공용 pii_check.scan_text(엄격 규칙)로 줄마다 검사해
걸린 줄은 빼고, 끝에 pii_check.py --target github 를 돌려 종료코드 2면 sources.json을 쓰지 않는다.

사용: python3 tools/link_sources.py [--vault /home/box/vault] [--pack public-pack.json]
        [--out data/sources.json] [--no-pii-gate] [--today 2026-10-21]
"""
import argparse, datetime, hashlib, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PII_DIR = '/home/box/vault/봇공유/99 봇/스크립트'
LINK, CAND = 0.80, 0.45
COLLECTIONS = ('regulations',)
# 봇 메모·운영 노트는 원문이 아니다 → 건너뜀
SKIP_PARTS = {'.git', '.obsidian', '.trash', '__pycache__', 'node_modules', '99 봇', '봇교훈', '비효율일지'}
SKIP_FILES = {'공지.md', 'README.md', '_폴더안내.md', '_manifest.md', '삭제 후보 목록.md'}
TEXT_EXT = {'.md', '.txt'}
# 원문이 아니라 원문을 다룬 글(검토·분석 등) → 점수를 후보 이하로 묶음
NOT_ORIGINAL = re.compile(r'(검토|분석|요약|정리|교훈|목록|체크|비교|대비표|변경내용|질문)')
ORIGINAL_DIR = '20 규정·지침'
# 규정 카드 후보는 규정류 문서만(신청서·명단·출석부 등 서식은 이름이 파일명에 있을 수 있어 제외)
REG_DOC = re.compile(r'(규정|지침|법|기준|규칙|편람|매뉴얼|훈령|예규|규약|시행령|시행규칙|학칙|FAQ)', re.I)
FORM_DOC = re.compile(r'(신청서|날인부|명단|출석부|지급내역|개인별|서명부|확인서|가계도|사주|이력서)')
TYPE_WORDS = ['시행규칙', '시행령', '운영규정', '교육규정', '운영지침', '훈련운영기준', '규정', '지침', '기준', '법', '편람', '규칙']
STOP = ['국립창원대학교', '창원대학교', '창원대', '학교', '경남도립남해대학', '및', '의', '에', '관한', '2026', '2025', '학년도']


def norm(s):
    s = re.sub(r'\.(md|txt|hwp|hwpx|pdf|docx|xlsx)$', '', s or '', flags=re.I)
    s = re.sub(r'^r\d{3}_', '', s)
    s = re.sub(r'(?<!\d)\d{6}_', '', s)
    s = re.sub(r'_(v\d+|규정|문서|붙임)(?=_|$)', '', s)
    s = re.sub(r'[\s_·\-\.\(\)\[\]「」『』,/+~]', '', s)
    for w in STOP:
        s = s.replace(w, '')
    return s


def core_name(name):
    """카드 이름에서 괄호·번호를 뺀 뼈대. 예: 강사료 지급 규정(제49호) → 강사료지급규정"""
    s = re.sub(r'\([^)]*\)', '', name)
    s = s.split('+')[0]
    return norm(s)


def bigrams(s):
    return {s[i:i + 2] for i in range(len(s) - 1)} if len(s) > 1 else {s}


def contain(a, b):
    """a의 바이그램이 b에 얼마나 들어 있나 (0~1)."""
    if not a or not b:
        return 0.0
    if a in b:
        return 1.0
    A = bigrams(a)
    return len(A & bigrams(b)) / len(A)


def read_text(p, limit=400000):
    try:
        with open(p, encoding='utf-8', errors='replace') as f:
            return f.read(limit)
    except OSError:
        return ''


def frontmatter(text):
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    if not m:
        return {}, text
    fm, body = {}, text[m.end():]
    key = None
    for line in m.group(1).splitlines():
        mm = re.match(r'^([^\s:][^:]*):\s*(.*)$', line)
        if mm:
            key, v = mm.group(1).strip(), mm.group(2).strip()
            if v.startswith('[') and v.endswith(']'):
                fm[key] = [x.strip().strip('"\'') for x in v[1:-1].split(',') if x.strip()]
            else:
                fm[key] = v.strip('"\'')
        elif key and re.match(r'^\s*-\s+', line):
            if not isinstance(fm.get(key), list):
                fm[key] = [] if not fm.get(key) else [fm[key]]
            fm[key].append(re.sub(r'^\s*-\s+', '', line).strip().strip('"\''))
    return fm, body


def scan_vault(vault):
    docs = []
    for root, dirs, files in os.walk(vault):
        rel_root = os.path.relpath(root, vault)
        parts = set(rel_root.split(os.sep))
        dirs[:] = sorted(d for d in dirs if d not in SKIP_PARTS)
        if parts & SKIP_PARTS:
            continue
        for fn in sorted(files):
            ext = os.path.splitext(fn)[1].lower()
            if ext not in TEXT_EXT or fn in SKIP_FILES:
                continue
            p = os.path.join(root, fn)
            text = read_text(p)
            fm, body = frontmatter(text)
            heads = [(int(len(m.group(1))), m.group(2).strip()) for m in re.finditer(r'^(#{1,4})\s+(.+)$', body, re.M)][:80]
            aliases = fm.get('aliases') or fm.get('alias') or []
            if isinstance(aliases, str):
                aliases = [aliases]
            rel = os.path.relpath(p, vault)
            titles = []
            m2 = re.search(r'^##\s*요약\s*\n(?:.*\n)?\s*2\.\s*(.+)$', body, re.M)
            if m2 and '없음' not in m2.group(1):
                titles.append(m2.group(1).strip())
            ft = fm.get('전환본')
            if isinstance(ft, str) and ft.startswith('/') and os.path.isfile(ft):
                for ln in [x for x in clean_lines(read_text(ft, 6000))][:4]:
                    if 4 <= len(ln) <= 60:
                        titles.append(ln)
            docs.append({
                'doc_titles': titles,
                'path': p, 'rel': rel, 'stem': os.path.splitext(fn)[0],
                'title': fm.get('title', ''), 'aliases': aliases, 'heads': heads, 'fm': fm,
                'rcode': (re.match(r'^(r\d{3})_', fn) or [None, None])[1],
                'mtime': os.path.getmtime(p), 'body': body,
            })
    return docs


def kind_penalty(cn, c):
    k = 1.0
    tw = next((w for w in TYPE_WORDS if cn.endswith(w)), '')
    if tw and tw not in c:
        k *= 0.6   # 운영규정 ↔ 교육규정처럼 문서 종류가 다르면 깎음
    pre = cn[:-len(tw)] if tw else cn
    if len(pre) >= 3 and contain(pre, c) < 0.7:
        k *= 0.6   # 경남항공교육원 ↔ 항공기술교육원처럼 기관·대상이 다르면 깎음
    return k


TOC = re.compile(r'(\.{4,}|…{2,}|·{4,}|\s\d{1,3}$)')
META = re.compile(r'^(전환일|원본경로|박스경로|전환본|종류|날짜|관련업무|T번호|개인정보|만든봇|자동생성)\b|\.(hwp|hwpx|pdf|xlsx|docx)$')


def score_doc(card, doc):
    """(점수, 맞은 곳, 맞은 제목줄)"""
    name = card.get('name') or card.get('title') or ''
    cn = core_name(name)
    src = card.get('source') or ''
    best, where, head = 0.0, '', ''
    # 1) 카드 원문 칸의 r코드(예: r036) = 바로 그 파일
    codes = re.findall(r'r\d{3}', src)
    if doc['rcode'] and doc['rcode'] in codes:
        best, where = 0.97 - 0.02 * codes.index(doc['rcode']), 'r코드(' + doc['rcode'] + ')'
        if re.search(r'인용만\([^)]*' + doc['rcode'], src):   # 「인용만(r035 안에서)」 = 그 문서 안에 인용된 것, 원문 아님
            best, where = 0.6, 'r코드(인용 위치 ' + doc['rcode'] + ')'
    # 2) 원문 칸에 적힌 파일 이름(예: cwnu_regs/aviation_content.txt)
    for f in re.findall(r'[\w\-]+/([\w\-]+)\.(?:txt|md|hwp|pdf)', src):
        if f and f in doc['stem']:
            best, where = max(best, 0.95), '원문 칸 파일 이름'
    # 3) 이름 ↔ 파일 이름·title·aliases
    for label, cand in ([('파일 이름', doc['stem']), ('title', doc['title'])] + [('alias', a) for a in doc['aliases']]
                        + [('문서 첫 줄', t) for t in doc.get('doc_titles', [])]):
        c = norm(cand)
        if not c:
            continue
        s = contain(cn, c) * (0.6 + 0.4 * min(1.0, len(cn) / max(len(c), 1)) ** 0.5)
        if contain(cn, c) == 1.0:
            s = max(s, 0.9)
        s *= kind_penalty(cn, c)
        if s > best:
            best, where = s, label
    # 4) 이름 ↔ 제목줄 (조금 낮게)
    for lv, h in doc['heads']:
        c = norm(h)
        s = contain(cn, c) * 0.85 * kind_penalty(cn, c) if c else 0
        if s > best:
            best, where, head = s, '제목줄', h
    if not head and doc['heads']:
        head = doc['heads'][0][1]
    if (not head or re.search(r'\.(hwp|hwpx|pdf|docx|xlsx|csv)$', head, re.I)) and doc.get('doc_titles'):
        head = doc['doc_titles'][0]   # 요약 노트 제목이 파일 이름뿐이면 문서 첫 줄을 씀
    if not where.startswith('r코드') and not REG_DOC.search(doc['stem'] + ' ' + doc['title'] + ' ' + ' '.join(doc.get('doc_titles', [])[:1]) + ' ' + ' '.join(h for _, h in doc['heads'][:1])):
        best = min(best, CAND * 0.7)
    if best and NOT_ORIGINAL.search(doc['stem'] + ' ' + doc['title']) and where != 'r코드(' + str(doc['rcode']) + ')':
        best = min(best, LINK - 0.01) * 0.9   # 검토·분석 글은 후보까지만
    if best and doc['rel'].startswith(os.path.join('봇공유', ORIGINAL_DIR)):
        best = min(1.0, best + 0.05)
    return round(best, 3), where, head


def full_text_for(doc):
    """볼트 요약 노트가 가리키는 전환본(전문)이 박스에 있으면 그걸, 없으면 노트 본문."""
    for k in ('전환본', '원문_전환본', 'fulltext'):
        p = doc['fm'].get(k)
        if isinstance(p, str) and p.startswith('/') and os.path.isfile(p):
            return read_text(p), p
    return doc['body'], doc['path']


def pii_hits(line):
    sys.path.insert(0, PII_DIR)
    try:
        import pii_check
    except Exception:
        return ['검사기 없음']
    return pii_check.scan_text(line, [], False)


def clean_lines(text):
    out = []
    for ln in text.splitlines():
        ln = re.sub(r'<[^>]+>', ' ', ln)
        ln = re.sub(r'[|*`#>]+', ' ', ln)
        ln = re.sub(r'\s+', ' ', ln).strip()
        if ln and not re.match(r'^-{3,}$', ln):
            out.append(ln)
    return out


def excerpt_for(card, doc, max_total=900):
    text, frm = full_text_for(doc)
    lines = clean_lines(text)
    arts = []
    for a in re.findall(r'제\s?(\d+)\s?조(?:의\s?(\d+))?', card.get('articles') or ''):
        k = '제%s조%s' % (a[0], ('의' + a[1]) if a[1] else '')
        if k not in arts:
            arts.append(k)
    parts, found, dropped = [], [], 0

    def add(ln):
        parts.append(ln)
        return True

    body = []
    for ln in lines:
        if TOC.search(ln) or META.search(ln):
            continue
        if pii_hits(ln):
            dropped += 1   # 개인정보 패턴이 있는 줄은 발췌에서 뺌(공개 저장소)
            continue
        body.append(ln)
    for k in arts[:4]:
        kk = k.replace('조', r'\s?조')
        strict = re.compile(r'^(?:[○◦·\-]\s*)?' + kk + r'\s?[(（]')
        loose = re.compile(r'^(?:[○◦·\-]\s*)?' + kk + r'(?!\d|의\d|제)')
        hit = None
        for rx in (strict, loose):
            hit = next((i for i, ln in enumerate(body) if rx.search(ln)), None)
            if hit is not None:
                break
        chunk = ' '.join(body[hit:hit + 4]) if hit is not None else ''
        nxt = re.search(r'\s제\s?\d+\s?조(의\s?\d+)?\s?[(（]', chunk[5:])
        if nxt:
            chunk = chunk[:5 + nxt.start()]   # 다음 조문 앞에서 자름
        if hit is not None and add(chunk[:280].strip()):
            found.append(k)
        if sum(len(p) for p in parts) > max_total:
            break
    if not parts:
        for ln in body:
            if len(ln) >= 25:
                add(ln[:200])
            if sum(len(p) for p in parts) > 400:
                break
    return {
        'text': '\n'.join(parts)[:max_total],
        'articles_found': found,
        'articles_missing': [k for k in arts if k not in found],
        'from': 'vault' if frm == doc['path'] else 'box_fulltext',
        'dropped_pii_lines': dropped,
    }


def build(pack, vault, today):
    docs = scan_vault(vault)
    out = {'generated': today, 'vault_root': os.path.basename(os.path.normpath(vault)),
           'thresholds': {'link': LINK, 'candidate': CAND}, 'docs_scanned': len(docs), 'cards': {}}
    ent = pack.get('entities', {})
    for col in COLLECTIONS:
        for card in ent.get(col, []):
            scored = []
            for d in docs:
                if FORM_DOC.search(d['rel']) or pii_hits(d['rel']):
                    continue   # 서식·개인정보가 경로에 있을 수 있는 파일은 후보로도 안 씀(공개 저장소)
                s, where, head = score_doc(card, d)
                if s >= CAND * 0.8:
                    scored.append((s, where, head, d))
            scored.sort(key=lambda x: (-x[0], x[3]['rel']))
            key = '%s:%s' % (col, card.get('id'))
            rec = {'card': card.get('name') or card.get('title'), 'section': '공부 > 알아야 할 규정' if col == 'regulations' else col,
                   'status': '못 찾음', 'score': scored[0][0] if scored else 0.0}
            if scored and scored[0][0] >= CAND:
                s, where, head, d = scored[0]
                rec.update({
                    'status': '연결' if s >= LINK else '후보 있음(확인 필요)',
                    'path': d['rel'].replace(os.sep, '/'), 'matched_by': where, 'heading': head,
                    'modified': datetime.datetime.fromtimestamp(d['mtime']).strftime('%Y-%m-%d %H:%M'),
                    'excerpt': excerpt_for(card, d),
                })
            rec['candidates'] = [{'path': x[3]['rel'].replace(os.sep, '/'), 'score': x[0], 'matched_by': x[1]}
                                 for x in scored[:3]]
            out['cards'][key] = rec
    c = [r['status'] for r in out['cards'].values()]
    out['summary'] = {k: c.count(k) for k in ('연결', '후보 있음(확인 필요)', '못 찾음')}
    return out


def apply_overrides(pack, path):
    """app.js 와 같은 규칙: data/card_overrides.json 의 칸으로 카드를 덮어씀."""
    if not os.path.isfile(path):
        return pack
    ov = json.load(open(path, encoding='utf-8'))
    for key, fields in ov.items():
        if key.startswith('_') or ':' not in key:
            continue
        col, cid = key.split(':', 1)
        for c in pack.get('entities', {}).get(col, []):
            if str(c.get('id')) == cid:
                c.update(fields)
    return pack


def pii_gate(path):
    script = os.path.join(PII_DIR, 'pii_check.py')
    if not os.path.isfile(script):
        print('개인정보 검사 스크립트 없음 → 쓰지 않음', file=sys.stderr)
        return 2
    r = subprocess.run([sys.executable, script, path, '--target', 'github'], capture_output=True, text=True)
    print(r.stdout.strip())
    return r.returncode


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--vault', default='/home/box/vault')
    ap.add_argument('--pack', default=os.path.join(REPO, 'public-pack.json'))
    ap.add_argument('--out', default=os.path.join(REPO, 'data', 'sources.json'))
    ap.add_argument('--today', default=datetime.datetime.now().strftime('%Y-%m-%d %H:%M'))
    ap.add_argument('--no-pii-gate', action='store_true', help='시험용: 엄격 검사 건너뜀')
    a = ap.parse_args(argv)
    with open(a.pack, encoding='utf-8') as f:
        pack = json.load(f)
    apply_overrides(pack, os.path.join(os.path.dirname(os.path.abspath(a.pack)), 'data', 'card_overrides.json'))
    out = build(pack, a.vault, a.today)
    data = json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + '\n'
    fd, tmp = tempfile.mkstemp(suffix='.json')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(data)
    if not a.no_pii_gate:
        rc = pii_gate(tmp)
        if rc != 0:
            os.unlink(tmp)
            print('개인정보 검사 실패(종료코드 %d) → %s 안 씀' % (rc, a.out), file=sys.stderr)
            return 2
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    os.replace(tmp, a.out)
    s = out['summary']
    print('카드 %d개: 연결 %d · 후보 %d · 못 찾음 %d (볼트 파일 %d개) → %s' % (
        len(out['cards']), s['연결'], s['후보 있음(확인 필요)'], s['못 찾음'], out['docs_scanned'], a.out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
