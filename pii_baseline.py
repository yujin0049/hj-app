#!/usr/bin/env python3
"""hj-app 개인정보 검사: 기준선에 없는 「새 낱말」만 실패로 처리. (원본: 클로드 검토 261023, 춘식이 손봄)
  python3 pii_baseline.py            # 새 낱말이 있으면 목록 + 질문목록에 한 줄씩 + 종료코드 1
  python3 pii_baseline.py --save --note 이유   # 기준선 저장 (유진님 결정 있을 때만, 손으로)
- 기준선 열쇠 = (파일, 종류, 걸린 낱말) 의 해시. 문장 전체가 아니라서, 같은 파일에서 같은 이름·번호면 문장이 바뀌어도 통과.
  예: (data/bot_status.json, 이름 의심, 김OO). 열쇠별 개수는 참고용(늘어도 실패 아님).
- data/pii_baseline.json 에는 a~p 글자 해시와 개수만(원문 없음). 화면·질문목록에는 가린 값(김*준, 01****78)만.
- 실패(1)일 때 질문목록(기본 볼트 00 홈/질문목록.md, --qlist·HJ_PII_QLIST 로 바꿈)에 새 열쇠마다 한 줄(같은 줄 있으면 안 씀).
  자동 --save 는 절대 안 함.
"""
import argparse, collections, datetime, glob, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hjpii  # noqa: E402

BASE = os.path.join(ROOT, 'data', 'pii_baseline.json')
SKIP = {'data/pii_baseline.json'}
QLIST = os.environ.get('HJ_PII_QLIST') or '/home/box/vault/봇공유/00 홈/질문목록.md'
KST = datetime.timezone(datetime.timedelta(hours=9))
_HEX2AP = str.maketrans('0123456789abcdef', 'abcdefghijklmnop')   # 숫자 없는 해시(검사기가 전화번호로 오인 안 하게)


def files():
    return sorted(glob.glob('data/*.json')) + ['dorm.json', 'public-pack.json', 'public/guide.json']


def key(f, kind, tok):
    return hashlib.sha256(f'{f}\0{kind}\0{tok}'.encode()).hexdigest()[:16].translate(_HEX2AP)


def tokens(s):
    """글자 하나에서 (종류, 걸린 낱말) 목록. hjpii.find_pii 와 같은 기준."""
    s = str(s)
    out = []
    for kind, rx in hjpii.PATTERNS:
        out += [(kind, m.group(0)) for m in rx.finditer(s)]
    for m in hjpii.ACCOUNT.finditer(s):
        v = m.group(0)
        if not hjpii.DATE_LIKE.match(v) and sum(c.isdigit() for c in v) >= 10 and set(v) - set('0-'):
            out.append(('계좌번호', v))
    out += [('이름 의심', w) for w in hjpii.suspicious(s)]
    return out


def mask(kind, tok):
    if kind == '이름 의심':
        return tok[0] + '*' * (len(tok) - 2) + tok[-1] if len(tok) > 2 else tok[0] + '*'
    if kind == '이메일':
        return tok[0] + '***@***'
    d = re.sub(r'\D', '', tok)
    return d[:2] + '*' * max(len(d) - 4, 1) + d[-2:]


def scan(root=None):
    """{열쇠: {'file','kind','masked','n'}}"""
    root = root or ROOT
    out = {}
    cwd = os.getcwd()
    os.chdir(root)
    try:
        for f in files():
            if f in SKIP or not os.path.exists(f):
                continue
            with open(f, encoding='utf-8') as fh:
                d = json.load(fh)
            for _path, s in hjpii.walk_strings(d):
                for kind, tok in tokens(s):
                    k = key(f, kind, tok)
                    if k not in out:
                        out[k] = {'file': f, 'kind': kind, 'masked': mask(kind, tok), 'n': 0}
                    out[k]['n'] += 1
    finally:
        os.chdir(cwd)
    return out


def ask(new, qlist, now=None):
    """질문목록에 새 열쇠마다 한 줄(이미 같은 내용 있으면 건너뜀). 쓴 줄 수."""
    if not qlist or not os.path.exists(qlist):
        print(f'질문목록 없음 → 안 씀: {qlist}')
        return 0
    with open(qlist, encoding='utf-8') as fh:
        have = fh.read()
    stamp = (now or datetime.datetime.now(KST)).strftime('%Y-%m-%d %H:%M')
    lines, seen = [], set()
    for v in sorted(new.values(), key=lambda v: (v['file'], v['kind'], v['masked'])):
        body = f"pii 새 의심: {v['file']} {v['kind']} {v['masked']} → 기준선 추가 여부 (춘식이)"
        if body in have or body in seen:
            continue
        seen.add(body)
        lines.append(f'- [ ] {stamp} {body}')
    if lines:
        with open(qlist, 'a', encoding='utf-8') as fh:
            if have and not have.endswith('\n'):
                fh.write('\n')
            fh.write('\n'.join(lines) + '\n')
    return len(lines)


def main(argv=None, root=None, base=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--save', action='store_true')
    ap.add_argument('--note', default='', help='--save 때 기준선 파일에 남길 이유')
    ap.add_argument('--qlist', default=QLIST, help='실패 때 한 줄씩 덧붙일 질문목록(빈 값이면 안 씀)')
    a = ap.parse_args(argv)
    base = base or BASE
    now = scan(root)
    if a.save:
        with open(base, 'w', encoding='utf-8') as fh:
            json.dump({'version': 2, 'key': '(파일, 종류, 걸린 낱말) sha256 16자 → a~p', 'count': len(now),
                       'note': a.note,
                       'saved_at': datetime.datetime.now(KST).strftime('%Y-%m-%d %H:%M KST'),
                       'keys': {k: now[k]['n'] for k in sorted(now)}}, fh, ensure_ascii=False, indent=0)
            fh.write('\n')
        print(f'기준선 저장: 열쇠 {len(now)}개 (걸린 곳 {sum(v["n"] for v in now.values())}군데)')
        return 0
    if not os.path.exists(base):
        print('기준선 없음: --save 먼저 (유진님 확인 필요)')
        return 2
    with open(base, encoding='utf-8') as fh:
        b = json.load(fh)
    keys = b['keys']
    if isinstance(keys, list) or b.get('version') != 2:
        print('기준선이 옛 형식(문장 해시): --save 다시 (유진님 확인 필요)')
        return 2
    new = {k: v for k, v in now.items() if k not in keys}
    grew = sum(1 for k, v in now.items() if k in keys and v['n'] > keys[k])
    print(f'열쇠 {len(now)} · 기준선 {len(keys)} · 새 낱말 {len(new)} · 개수만 는 열쇠 {grew}(참고)')
    for v in sorted(new.values(), key=lambda v: (v['file'], v['kind']))[:50]:
        print(f"- {v['file']} {v['kind']} {v['masked']}")
    if new:
        print(f'질문목록에 {ask(new, a.qlist)}줄 덧붙임')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
