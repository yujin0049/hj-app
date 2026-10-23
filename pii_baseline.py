#!/usr/bin/env python3
"""hj-app 개인정보 검사: 기준선 대비 '새로 생긴 의심'만 실패로 처리. (원본: 클로드 검토 261023, 춘식이 손봄)
  python3 pii_baseline.py --save --exclude-names 이름목록.txt   # 기준선 저장 (유진님 확인 후 1회)
  python3 pii_baseline.py                                       # 새 의심이 있으면 목록 + 종료코드 1
- 기준선 파일 data/pii_baseline.json 에는 해시(16자)와 개수만 넣는다(원문 없음).
- --exclude-names: 실명(저장소 밖 목록, 한 줄에 하나)이 들어간 의심 줄은 기준선에 안 넣는다 → 지울 때까지 계속 실패.
- 261023 20:33 유진님 「그대로 둬」: 지금 있는 실명 43건은 기준선에 넣음(--exclude-names 없이 저장). 새로 생긴 의심·실명만 실패.
- 출력에도 원문은 안 찍는다(파일·위치·종류만).
"""
import argparse, datetime, glob, hashlib, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hjpii  # noqa: E402

BASE = os.path.join(ROOT, 'data', 'pii_baseline.json')
SKIP = {'data/pii_baseline.json'}
_HEX2AP = str.maketrans('0123456789abcdef', 'abcdefghijklmnop')


def files():
    return sorted(glob.glob('data/*.json')) + ['dorm.json', 'public-pack.json', 'public/guide.json']


def key(f, path, s):
    # 숫자 없이 a~p 글자로(검사기가 해시 속 숫자를 전화번호로 오인하지 않게)
    return hashlib.sha256(f'{f}\0{path}\0{s}'.encode()).hexdigest()[:16].translate(_HEX2AP)


def scan(names=()):
    out = {}
    for f in files():
        if f in SKIP or not os.path.exists(f):
            continue
        with open(f, encoding='utf-8') as fh:
            d = json.load(fh)
        for path, s in hjpii.walk_strings(d):
            r = hjpii.find_pii(s)
            if r:
                out[key(f, path, s)] = {'file': f, 'path': path, 'why': r,
                                        'names': [n for n in names if n in s]}
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--save', action='store_true')
    ap.add_argument('--exclude-names', default=os.environ.get('HJ_PII_NAMES', ''),
                    help='--save 때 실명 들어간 의심은 기준선에서 뺌(목록은 저장소·볼트 밖에)')
    ap.add_argument('--note', default='', help='--save 때 기준선 파일에 남길 이유')
    a = ap.parse_args(argv)
    os.chdir(ROOT)
    names = []
    if a.exclude_names:
        with open(a.exclude_names, encoding='utf-8') as fh:
            names = [x.strip() for x in fh if x.strip()]
    now = scan(names)
    if a.save:
        keep = sorted(k for k, v in now.items() if not v['names'])
        with open(BASE, 'w', encoding='utf-8') as fh:
            json.dump({'count': len(keep), 'excluded_real_name': len(now) - len(keep), 'note': a.note,
                       'saved_at': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y-%m-%d %H:%M KST'),
                       'keys': keep},
                      fh, ensure_ascii=False, indent=0)
            fh.write('\n')
        print(f'기준선 저장: {len(keep)}건 (실명 들어가 뺀 것 {len(now) - len(keep)}건, 전체 의심 {len(now)})')
        return 0
    if not os.path.exists(BASE):
        print('기준선 없음: --save 먼저 (유진님 확인 필요)')
        return 2
    with open(BASE, encoding='utf-8') as fh:
        base = set(json.load(fh)['keys'])
    new = {k: v for k, v in now.items() if k not in base}
    print(f'전체 의심 {len(now)} · 기준선 {len(base)} · 새 의심(또는 실명) {len(new)}')
    for v in list(new.values())[:50]:
        print(f"- {v['file']} {v['path']} {v['why']}")
    if len(new) > 50:
        print(f'… 외 {len(new) - 50}건')
    return 1 if new else 0


if __name__ == '__main__':
    sys.exit(main())
