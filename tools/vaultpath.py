#!/usr/bin/env python3
"""공개 JSON에서 볼트(옵시디언)·박스·PC 경로를 빼고 짧은 이름만 남김 (261029, 춘식이2).
- 경로 → 마지막 이름(.md 뺌). 예: 「10 업무/학교_부서별_하는일_정리_v01.md」 → 「학교_부서별_하는일_정리_v01」
- PC 경로(F:\\…\\폴더\\) → 「폴더」, 「F:\\ 자료」 → 「F드라이브 자료」, obsidian:// 주소 → 빈칸(앱이 이름으로 옵시디언 검색 주소를 만듦)
- 저장소 안 공개 사본(docs/…)·웹 주소(http…)는 그대로.
사용: python3 tools/vaultpath.py [--check] [파일 …]   (파일 없으면 공개 JSON 전부)
  --check: 고치지 않고 찾기만, 있으면 종료 코드 1.
다른 생성 스크립트는 scrub_obj(obj) 를 json.dump 직전에 부르면 됨."""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_FILES = {'data/pii_baseline.json'}

# 찾기(검사) 기준
_DIR = r'(?:\d\d [^/\n"\\]{1,24}?|[^\s/·,;:()「」<>|`"\\+=]+)'
FIND = [re.compile(p) for p in (
    r'(?<!docs/regs/)(?<![\w/])[^\s/·,;:()「」<>|`"\\+=]*\.md\b',   # 노트 파일 이름(.md)
    r'(?<![\w.])\d\d [가-힣A-Za-z][가-힣A-Za-z0-9·_ ]{0,20}/',                  # 「10 업무/」「99 봇/」 같은 볼트 폴더
    r'봇공유|봇교훈/|봇결정기록/|조사/|/home/box|/workspace/|obsidian://|(?<![A-Za-z])[A-Z]:\\',
)]


def find(s):
    s = str(s)
    hits = []
    for rx in FIND:
        for m in rx.finditer(s):
            ctx = s[max(0, m.start() - 12):m.start()]
            if 'http' in ctx or s[max(0, m.start() - 10):m.end()].startswith('docs/'):
                continue
            hits.append(m.group(0))
    return hits


def _name(path):
    p = path.replace('\\', '/').rstrip('/')
    base = p.rsplit('/', 1)[-1].strip() or p
    return re.sub(r'\.md$', '', base)


WIN = re.compile(r'(?<![A-Za-z])[A-Z]:\\{1,2}(?:[^\\\n"]+\\{1,2})+[^\\\n"]*')   # PC 경로(폴더 하나 이상)
DRIVE = re.compile(r'(?<![A-Za-z])([A-Z]):\\{1,2}')                              # 「F:\ 자료」 같은 드라이브 말
TOK = re.compile(r'(?:(?:볼트|박스)\s+)?(?:/home/box|/workspace)?/?(?:' + _DIR + r'/)+[^\s/·,;:()「」<>|`"\\+=]*')
MDNAME = re.compile(r'(?<![\w/])([^\s/·,;:()「」<>|`"\\+=]+)\.md\b')


def plain(s):
    """문장 안 경로를 짧은 이름으로. 웹 주소·docs/ 사본은 그대로."""
    if not isinstance(s, str) or not find(s):
        return s
    if s.startswith('obsidian://'):
        return ''
    s = WIN.sub(lambda m: '「' + _name(m.group(0)) + '」', s)
    s = DRIVE.sub(lambda m: m.group(1) + '드라이브 ', s)

    def tok(m):
        t = m.group(0)
        pre = s[max(0, m.start() - 8):m.start()]
        if '://' in pre or t.startswith(('http', 'docs/')) or '://' in t:
            return t
        if not (find(t) or t.lower().endswith('.md')):
            return t
        return _name(t)
    s = TOK.sub(tok, s)
    s = MDNAME.sub(lambda m: m.group(1), s)
    s = s.replace('봇공유 밖', '공유 폴더 밖').replace('봇공유/', '').replace('봇공유', '공유 폴더')
    return s


def scrub_obj(o):
    """JSON 값 전체를 돌며 경로 글자를 고친 새 값. 생성 스크립트가 json.dump 직전에 부름."""
    return _expected(o)


def walk(o, path=''):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == 'file' and isinstance(v, str) and v.startswith('docs/'):
                continue
            yield from walk(v, path + '.' + k)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v, path + '[]')
    elif isinstance(o, str):
        yield path, o


def rewrite_text(raw, o):
    """파일 모양(들여쓰기·줄바꿈)은 그대로 두고 문자열 값만 바꿔 끼움. 안 맞으면 scrub_obj 로 다시 씀."""
    pairs = {}
    for k, s in _kv(o):
        n = '' if (k == 'obsidian' and s.startswith('obsidian://')) else (s if (k == 'file' and s.startswith('docs/')) else _one(k, s))
        if n != s:
            pairs[s] = n
    out = raw
    for old in sorted(pairs, key=len, reverse=True):
        for ea in (False, True):
            enc = json.dumps(old, ensure_ascii=ea)
            if enc in out:
                out = out.replace(enc, json.dumps(pairs[old], ensure_ascii=ea))
                break
    try:
        if json.loads(out) == _expected(o):
            return out
    except ValueError:
        pass
    return json.dumps(_expected(o), ensure_ascii=False, indent=1) + '\n'


def _expected(o, key=''):
    if isinstance(o, dict):
        return {k: _expected(v, k) for k, v in o.items()}
    if isinstance(o, list):
        return [_expected(v, key) for v in o]
    if isinstance(o, str):
        if key == 'obsidian' and o.startswith('obsidian://'):
            return ''
        if key == 'file' and o.startswith('docs/'):
            return o
        return _one(key, o)
    return o


def _one(key, s):
    """경로만 담는 칸(path·vault·doc·근거 등)은 통째로 이름 하나로."""
    if key in PATH_KEYS and find(s) and '\n' not in s and len(s) < 300 and not re.search(r'\s[·+]\s|, ', s):
        return _name(re.sub(r'^(?:볼트|박스)\s+', '', s))
    return plain(s)


PATH_KEYS = {'path', 'vault', 'doc', 'file', 'source_note'}


def _kv(o, key=''):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from _kv(v, k)
    elif isinstance(o, list):
        for v in o:
            yield from _kv(v, key)
    elif isinstance(o, str):
        yield key, o


def public_files(root=ROOT):
    fs = sorted(glob.glob(os.path.join(root, 'data', '*.json'))) + [os.path.join(root, f) for f in ('public-pack.json', 'dorm.json', 'public/guide.json')]
    return [f for f in fs if os.path.isfile(f) and os.path.relpath(f, root) not in SKIP_FILES]


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    check = '--check' in argv
    files = [a for a in argv if not a.startswith('--')] or public_files()
    bad = 0
    for f in files:
        with open(f, encoding='utf-8') as fh:
            raw = fh.read()
        o = json.loads(raw)
        hits = [(p, h) for p, s in walk(o) for h in find(s)]
        if check:
            for p, h in hits[:5]:
                print('경로 남음: %s %s %s' % (os.path.relpath(f, ROOT), p, h[:60]))
            bad += len(hits)
            continue
        if hits:
            new_raw = rewrite_text(raw, o)
            new = json.loads(new_raw)
            with open(f + '.tmp', 'w', encoding='utf-8', newline='') as fh:
                fh.write(new_raw)
            os.replace(f + '.tmp', f)
            left = [(p, h) for p, s in walk(new) for h in find(s)]
            print('%s: 경로 %d → %d' % (os.path.relpath(f, ROOT), len(hits), len(left)))
            bad += len(left)
    print('볼트 경로 검사: 남은 %d' % bad)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
