#!/usr/bin/env python3
"""볼트 문서 → 앱 「볼트 문서」 팩 (잠긴 연습장 전용).

tools/vault_folders.json 의 범위만 볼트에서 읽어(읽기만), 저장소 **밖** --out 폴더에 쓴다.
  index.json        → KV vault:index   문서 목록(id·경로·폴더·제목·별명·제목줄·수정일·가림 수) + 마지막 갱신
  search.json       → KV vault:search  검색용 {id: 소문자 글자}
  docs/<id>.json    → KV vault:doc:<id> 문서 하나(가린 뒤의 마크다운 글자. 화면이 안전하게 그림)
  kv_keys.json      KV 키 → 파일 이름 표
id = 볼트 뿌리 기준 경로(예 봇공유/20 규정·지침/x.md)의 sha1 앞 12자. 경로가 같으면 id 도 같다.
주민번호(######-#######, 하이픈 없이 13자리, 뒤를 *로 가린 꼴)는 항상 「[주민번호 가림]」으로 바꾼다. 숫자는 남기지 않는다.
볼트 글은 GitHub 저장소·Pages 에 넣지 않는다(--out 이 저장소 안이면 멈춤, tests/test_vault_guard.py).

사용: python tools/build_vault_pack.py --out DIR [--vault 볼트뿌리] [--config tools/vault_folders.json] [--today 'YYYY-MM-DD HH:MM']
  --vault 를 안 주면 환경변수 HJ_VAULT, 그것도 없으면 설정의 default_vault.
"""
import argparse, datetime, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
MAX_CHARS = 1500000

RRN_MASK = '[주민번호 가림]'
_D6 = r'\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])'
RRN_RX = [
    re.compile(r'(?<![\d-])\d{6}\s?[-–—]\s?[1-8]\d{6}(?!\d)'),                 # 900101-1234567
    re.compile(r'(?<![\d-])\d{6}\s?[-–—]\s?[1-8]?(?:\\?[*xX●○#]){4,7}(?![\d*])'),  # 900101-1******
    re.compile(r'(?<![\d-])' + _D6 + r'[1-8]\d{6}(?!\d)'),                        # 9001011234567
]


def mask_rrn(text):
    n = 0
    for rx in RRN_RX:
        text, k = rx.subn(RRN_MASK, text)
        n += k
    return text, n


def doc_id(path):
    return hashlib.sha1(path.encode('utf-8')).hexdigest()[:12]


def frontmatter(text):
    m = re.match(r'^---\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|$)', text, re.S)
    if not m:
        return {}, text
    fm, key = {}, None
    for line in m.group(1).splitlines():
        mm = re.match(r'^([^\s:#][^:]*):\s*(.*)$', line)
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
    return fm, text[m.end():]


def match_glob(rel, pat):
    """** = 여러 폴더(0개 포함), * = 한 폴더 안."""
    rx = re.escape(pat).replace(r'\*\*/', '(?:.*/)?').replace(r'\*\*', '.*').replace(r'\*', '[^/]*').replace(r'\?', '[^/]')
    return re.fullmatch(rx, rel) is not None


def collect(cfg, vault):
    """[(폴더 이름, base 기준 상대 경로)] — 설정 순서대로 처음 맞는 폴더에 넣음."""
    root = os.path.join(vault, cfg.get('base', ''))
    files = []
    for dp, dns, fns in os.walk(root):
        dns[:] = sorted(d for d in dns if not d.startswith('.'))
        for fn in sorted(fns):
            if fn.startswith('.'):
                continue
            rel = os.path.relpath(os.path.join(dp, fn), root).replace(os.sep, '/')
            for f in cfg['folders']:
                if any(match_glob(rel, p) for p in f['include']):
                    files.append((f['label'], rel))
                    break
    return files


def plain(md):
    t = re.sub(r'\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]', lambda m: m.group(2) or m.group(1), md)
    t = re.sub(r'[#>*`|]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def is_inside(path, base):
    p, b = os.path.normcase(os.path.realpath(path)), os.path.normcase(os.path.realpath(base))
    try:
        return os.path.commonpath([p, b]) == b
    except ValueError:      # 다른 드라이브
        return False


def build(cfg, vault, out, today):
    base = cfg.get('base', '')
    prefix = (base + '/') if base else ''
    files = collect(cfg, vault)
    docs_dir = os.path.join(out, 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    index, search, per_folder, masked_total = [], {}, {}, 0
    for label in [f['label'] for f in cfg['folders']]:
        per_folder[label] = 0
    for label, rel in files:
        p = os.path.join(vault, base, rel)
        with open(p, encoding='utf-8', errors='replace') as f:
            text = f.read(MAX_CHARS)
        path = prefix + rel
        did = doc_id(path)
        stem = os.path.splitext(os.path.basename(rel))[0]
        if rel.lower().endswith('.json'):
            kind, fm, body = 'json', {}, text
            try:
                body = json.dumps(json.loads(text), ensure_ascii=False, indent=1)
            except ValueError:
                pass
            heads = []
        else:
            kind = 'md'
            fm, body = frontmatter(text)
            heads = [h.strip() for h in re.findall(r'^#{1,3}\s+(.+)$', body, re.M)][:60]
        h1 = re.search(r'^#\s+(.+)$', body, re.M) if kind == 'md' else None
        title = fm.get('title') if isinstance(fm.get('title'), str) and fm.get('title') else (h1.group(1).strip() if h1 else stem)
        aliases = fm.get('aliases') or fm.get('alias') or []
        if isinstance(aliases, str):
            aliases = [aliases]
        # 주민번호 가림: 글·제목·별명·제목줄·경로 모두
        body, n = mask_rrn(body)
        title, n1 = mask_rrn(title)
        stem, n2 = mask_rrn(stem)
        path_shown, n3 = mask_rrn(path)
        aliases = [mask_rrn(a)[0] for a in aliases]
        heads = [mask_rrn(h)[0] for h in heads]
        nmask = n + n1 + n3
        masked_total += nmask
        meta = {'id': did, 'path': path_shown, 'folder': label, 'title': title, 'stem': stem, 'aliases': aliases,
                'headings': heads, 'kind': kind,
                'modified': datetime.datetime.fromtimestamp(os.path.getmtime(p)).strftime('%Y-%m-%d %H:%M'),
                'size': os.path.getsize(p), 'masked_rrn': nmask}
        index.append(meta)
        per_folder[label] += 1
        with open(os.path.join(docs_dir, did + '.json'), 'w', encoding='utf-8') as f:
            json.dump(dict(meta, text=body, generated=today), f, ensure_ascii=False)
        search[did] = plain(title + ' ' + ' '.join(aliases) + ' ' + body).lower()
    keep = {m['id'] + '.json' for m in index}
    for fn in os.listdir(docs_dir):     # 볼트에서 빠진 문서(팩 생성물만, 12자 id 이름)는 지움
        if re.fullmatch(r'[0-9a-f]{12}\.json', fn) and fn not in keep:
            os.remove(os.path.join(docs_dir, fn))
    idx = {'generated': today, 'vault_root': base, 'folders': [f['label'] for f in cfg['folders']],
           'count': len(index), 'per_folder': per_folder, 'masked_rrn': masked_total, 'docs': index}
    with open(os.path.join(out, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(idx, f, ensure_ascii=False, indent=1)
    with open(os.path.join(out, 'search.json'), 'w', encoding='utf-8') as f:
        json.dump(search, f, ensure_ascii=False)
    kv = {'vault:index': 'index.json', 'vault:search': 'search.json'}
    kv.update({'vault:doc:' + m['id']: 'docs/' + m['id'] + '.json' for m in index})
    with open(os.path.join(out, 'kv_keys.json'), 'w', encoding='utf-8') as f:
        json.dump(kv, f, ensure_ascii=False, indent=1)
    return idx


def main(argv=None):
    ap = argparse.ArgumentParser(description='볼트 문서 팩 만들기(저장소 밖 --out 에만 씀)')
    ap.add_argument('--out', required=True, help='저장소 밖 폴더')
    ap.add_argument('--vault', help='볼트 뿌리(그 아래에 설정의 base 폴더). 없으면 HJ_VAULT → 설정 default_vault')
    ap.add_argument('--config', default=os.path.join(HERE, 'vault_folders.json'))
    ap.add_argument('--today', default=datetime.datetime.now().strftime('%Y-%m-%d %H:%M'))
    a = ap.parse_args(argv)
    with open(a.config, encoding='utf-8') as f:
        cfg = json.load(f)
    vault = a.vault or os.environ.get('HJ_VAULT') or cfg.get('default_vault')
    out = os.path.abspath(a.out)
    if is_inside(out, REPO):
        print('팩을 저장소 안(%s)에 쓰면 안 돼요 → 멈춤' % out, file=sys.stderr)
        return 2
    if not vault or not os.path.isdir(os.path.join(vault, cfg.get('base', ''))):
        print('볼트 폴더가 없어요: %s' % vault, file=sys.stderr)
        return 2
    idx = build(cfg, vault, out, a.today)
    print('볼트 문서 %d개 → %s (주민번호 가림 %d곳, 마지막 갱신 %s)' % (idx['count'], out, idx['masked_rrn'], idx['generated']))
    for k, v in idx['per_folder'].items():
        print('  %s: %d' % (k, v))
    return 0


if __name__ == '__main__':
    sys.exit(main())
