#!/usr/bin/env python3
"""모든 출력 개인정보 검사. 걸리면 종료 코드 2 (값은 안 보여 주고 파일·위치·종류만).
사용: cal_pii_check.py [--data data] [--worker 미리보기워커.js] [--raw 덤프 ...]
- data/*.json : 전화·주민번호·이메일·계좌 + 원자료에서 뽑은 사람 이름 + 이름 의심(성씨 3글자 낱말)
- 워커 파일(사이트 전체가 들어감): 전화·주민번호·이메일·계좌 + 원자료 사람 이름 (화면 글자는 낱말이 많아 이름 의심은 안 봄)
- 이 저장소(hj-app)는 공개 GitHub 라서 늘 엄격(github) 규칙이다. --target 은 github/drive 만 받는다(공지 261021-9, 규칙_총정리 5).
  볼트·잠긴 앱용 느슨한 규칙(주민번호만 차단)은 공용 스크립트 봇공유/99 봇/스크립트/pii_check.py --target vault|app 을 쓴다."""
import argparse, base64, glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hjpii
from make_calendar import read_table

# 사이트에 원래 있는 공개 대표번호·협조 성명 등은 여기 「파일:종류」로 허용
# 261027 유진님「허용목록에 협조 성명 넣기」: coop.json 협조용 성명(실명상세/who_names 원본은 계속 금지)
SITE_ALLOW = {
    '/data/coop.json:사람 이름',
    # 261029 질문목록L210-294 답: 교직원 이름=거미줄 결재라인용 → 기준선·워커 허용(실명상세/who_names·학생 원본 금지 유지)
    '/data/dept_spider.json:사람 이름',
    # 261029 유진님 「실명 그대로 올려」: 사람별 하는 일(협조 검색) 교직원 이름만. 주소록에 없으면 가림(김*수)
    '/data/people_roles.json:사람 이름',
}


def names_from_raws(paths):
    names = set()
    for p in paths:
        if not os.path.exists(p):
            continue
        if '/ingest' in p or p.endswith(('통합일정.json', '통합할일.json')):
            import make_calendar
            ev, td, _ = make_calendar.load_ingest(os.path.dirname(p))
            names |= hjpii.derive_names([x.get('title', '') for x in (ev or []) + (td or [])])
            continue
        if p.endswith('일정총괄.json'):
            import make_calendar
            items, _, notes, who = make_calendar.load_master(p, 2026)
            names |= hjpii.derive_names([x.get('title', '') for x in items or []] + [c['why'] for c in notes] + who)
            names |= {w for x in who for w in hjpii.suspicious(x)}
            continue
        rows = read_table(p)
        texts = [c for r in rows for c in r]
        names |= hjpii.derive_names(texts)
        hi = next((i for i, r in enumerate(rows) if r and r[0].strip() == '번호'), -1)
        if hi >= 0 and '이름' in rows[hi]:
            ni = rows[hi].index('이름')
            names |= {r[ni].strip() for r in rows[hi + 1:] if len(r) > ni and len(r[ni].strip()) >= 2 and r[0].strip().isdigit()}
        if rows and '담당·상대' in rows[0]:
            wi = rows[0].index('담당·상대')
            names |= {w for r in rows[1:] if len(r) > wi for w in hjpii.suspicious(r[wi])}
    return names


def strong(s, names):
    hits = []
    for kind, rx in hjpii.PATTERNS:
        if rx.search(s):
            hits.append(kind)
    for m in hjpii.ACCOUNT.finditer(s):
        if not hjpii.DATE_LIKE.match(m.group(0)) and sum(c.isdigit() for c in m.group(0)) >= 10 and set(m.group(0)) - set('0-'):
            hits.append('계좌번호'); break
    if any(n in s for n in names):
        hits.append('사람 이름')
    return hits


def main(argv=None):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=os.path.join(root, 'data'))
    ap.add_argument('--files', nargs='*', default=['calendar.json', 'calendar_extra.json', 'status.json', 'ojnt_progress.json', 'meta.json'])
    ap.add_argument('--worker', default='')
    ap.add_argument('--enforce', nargs='*', default=None,
                    help='워커 안에서 실패로 칠 파일(/경로). 안 주면 전부. 나머지(main 에 이미 있는 그대로의 파일)는 경고만')
    ap.add_argument('--target', default='github', choices=['github', 'drive', 'vault', 'app'],
                    help='공개 저장소라 github(엄격)만 의미 있음. vault/app 을 주면 거절(종료 코드 3)')
    ap.add_argument('--raw', nargs='*', default=['/workspace/hj_audit/calendar/raw_업무.json', '/workspace/hj_audit/calendar/raw_ojnt.json', '/home/box/vault/봇공유/00 홈/일정총괄.json', '/workspace/hj_audit/ingest/통합일정.json'])
    a = ap.parse_args(argv)
    if a.target in ('vault', 'app'):
        print('hj-app 은 공개 GitHub 라 vault/app 규칙을 쓸 수 없어요. --target github 로 돌려요.', file=sys.stderr)
        return 3
    names = names_from_raws(a.raw)
    bad, warn, n = [], [], 0
    for fn in a.files:
        p = os.path.join(a.data, fn)
        if not os.path.exists(p):
            continue
        n += 1
        for path, s in hjpii.walk_strings(json.load(open(p, encoding='utf-8'))):
            for k in hjpii.find_pii(s, names):
                bad.append('%s %s: %s' % (fn, path, k))
    if a.worker:
        t = open(a.worker, encoding='utf-8').read()
        m = re.search(r'const F = (\{.*?\});\\nconst H', t, re.S)
        files = json.loads(json.loads('"' + m.group(1) + '"')) if m else {}
        for rel, (typ, b64) in files.items():
            if not re.search(r'text|json|javascript|svg|xml', typ):
                continue
            n += 1
            s = base64.b64decode(b64).decode('utf-8', 'replace')
            for k in strong(s, names):
                if '%s:%s' % (rel, k) in SITE_ALLOW:
                    continue
                if a.enforce is None or rel in a.enforce:
                    bad.append('워커 %s: %s' % (rel, k))
                else:
                    warn.append('워커 %s: %s (main 에 이미 있는 파일 — 이 브랜치가 바꾼 것 아님)' % (rel, k))
    for w in warn:
        print('경고 ' + w)
    if bad:
        print('개인정보 검사 실패 (%d건):' % len(bad))
        for b in bad[:40]:
            print('  ' + b)
        return 2
    print('개인정보 검사 통과: 파일 %d개, 원자료 이름 후보 %d개로 대조' % (n, len(names)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
