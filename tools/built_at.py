"""JSON 정본의 최상위 built_at·source_at.

- built_at: 이 변환을 돌린 시각(ISO, +09:00).
- source_at: 원자료 시각. 원자료 JSON의 시각 칸이 있으면 그 값, 없으면 파일 mtime을
  변환 시점에 기록. 생성 스크립트가 없는 파일은 git log -1 %cI(내용이 바뀐 마지막 커밋,
  built_at·source_at 만 바꾼 커밋은 건너뜀)를 +09:00 으로 바꾼다.
손으로 시각을 지어 넣지 말 것.
"""
import datetime as dt
import json
import os
import subprocess
import sys

KST = dt.timezone(dt.timedelta(hours=9))
ISO = '%Y-%m-%dT%H:%M:%S+09:00'
STAMP_KEYS = ('built_at', 'source_at')
# 원자료 JSON 최상위에서만 본다. 시트 칸 이름(최종수정 등)은 쓰지 않음.
RAW_TIME_KEYS = (
    'source_at', 'fetched_at', 'read_at', 'dumped_at', 'saved_at', 'exported_at',
    'exportedAt', 'fetchedAt', 'readAt', 'dumpedAt', 'timestamp', 'as_of', 'asOf',
    'updated_at', 'modified_at', 'mtime',
)


def now(t=None):
    if t is None:
        t = dt.datetime.now(KST)
    elif t.tzinfo is None:
        t = t.replace(tzinfo=KST)
    else:
        t = t.astimezone(KST)
    return t.strftime(ISO)


def from_iso(s):
    """git %cI 등 ISO 시각을 +09:00 초 단위로. 못 읽으면 None(지어내지 않음)."""
    if s is None:
        return None
    text = str(s).strip()
    if not text:
        return None
    if text.endswith('Z') or text.endswith('z'):
        text = text[:-1] + '+00:00'
    try:
        t = dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    return now(t)


def from_mtime(path):
    if not path or not os.path.isfile(path):
        return None
    t = dt.datetime.fromtimestamp(os.path.getmtime(path), KST)
    return now(t)


def _raw_obj(path):
    with open(path, encoding='utf-8') as f:
        t = f.read()
    i = t.find('{')
    if i < 0:
        return None
    try:
        obj, _ = json.JSONDecoder().raw_decode(t[i:])
    except ValueError:
        return None
    return obj if isinstance(obj, dict) else None


def from_raw(path):
    """원자료 파일의 시각 칸, 없으면 이 호출 시점의 mtime."""
    if not path or not os.path.isfile(path):
        return None
    obj = _raw_obj(path)
    if obj:
        for k in RAW_TIME_KEYS:
            if k in obj and obj[k] not in (None, ''):
                got = from_iso(obj[k])
                if got:
                    return got
    return from_mtime(path)


def _fingerprint(obj):
    if isinstance(obj, dict):
        body = {k: v for k, v in obj.items() if k not in STAMP_KEYS}
        return json.dumps(body, ensure_ascii=False, sort_keys=True, default=str)
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, default=str)


def from_git(path, repo=None):
    """내용이 바뀐 마지막 커밋의 %cI 를 +09:00 으로. 기록이 없으면 None."""
    path = os.path.abspath(path)
    if not os.path.isfile(path):
        return None
    if repo is None:
        try:
            repo = subprocess.check_output(
                ['git', '-C', os.path.dirname(path), 'rev-parse', '--show-toplevel'],
                text=True, stderr=subprocess.DEVNULL).strip()
        except subprocess.CalledProcessError:
            return None
    rel = os.path.relpath(path, repo)
    try:
        log = subprocess.check_output(
            ['git', '-C', repo, 'log', '--format=%H %cI', '--', rel],
            text=True, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None
    rows = []
    for line in log.splitlines():
        line = line.strip()
        if not line:
            continue
        sha, iso = line.split(' ', 1)
        try:
            body = subprocess.check_output(
                ['git', '-C', repo, 'show', '%s:%s' % (sha, rel)],
                text=True, stderr=subprocess.DEVNULL)
            try:
                obj = json.loads(body)
            except ValueError:
                obj = {'__raw__': body}
        except subprocess.CalledProcessError:
            continue
        rows.append((iso, _fingerprint(obj)))
    for i, (iso, fp) in enumerate(rows):
        if i + 1 < len(rows) and fp == rows[i + 1][1]:
            continue
        return from_iso(iso)
    return None


def stamp(obj, built=None, source=None):
    if not isinstance(obj, dict):
        return obj
    if built:
        obj['built_at'] = built if _looks_iso(built) else now(built) if not isinstance(built, str) else built
    if source:
        obj['source_at'] = source
    return obj


def _looks_iso(s):
    return isinstance(s, str) and len(s) >= 19 and '+09:00' in s


def _dump(path, obj):
    raw = open(path, encoding='utf-8').read()
    if raw.startswith('{\n  '):
        text = json.dumps(obj, ensure_ascii=False, indent=2) + '\n'
    elif raw.startswith('{') and '\n  "' not in raw[:200]:
        text = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
        if raw.endswith('\n'):
            text += '\n'
    else:
        text = json.dumps(obj, ensure_ascii=False, indent=1) + '\n'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def stamp_git_file(path, repo=None):
    """생성 스크립트가 없는 JSON에 source_at 만 넣는다. 시각은 git 커밋에서만."""
    src = from_git(path, repo)
    if not src:
        return None
    with open(path, encoding='utf-8') as f:
        obj = json.loads(f.read())
    if not isinstance(obj, dict):
        return None
    obj['source_at'] = src
    _dump(path, obj)
    return src


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] != '--git-source':
        print('사용: built_at.py --git-source <json> [<json> ...]', file=sys.stderr)
        return 2
    rc = 0
    for p in argv[1:]:
        got = stamp_git_file(p)
        if got:
            print('%s source_at=%s' % (p, got))
        else:
            print('%s: git 시각을 못 읽어 건너뜀(지어 넣지 않음)' % p, file=sys.stderr)
            rc = 1
    return rc


if __name__ == '__main__':
    sys.exit(main())
