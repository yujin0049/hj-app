#!/usr/bin/env python3
"""모든 출력 개인정보 검사. 걸리면 종료 코드 2 (값은 안 보여 주고 파일·위치·종류만).
사용: cal_pii_check.py [--data data] [--worker 미리보기워커.js] [--raw 덤프 ...]
- data/*.json : 전화·주민번호·이메일·계좌 + 원자료에서 뽑은 사람 이름 + 이름 의심(성씨 3글자 낱말)
- 워커 파일(사이트 전체가 들어감): 전화·주민번호·이메일·계좌 + 원자료 사람 이름 (화면 글자는 낱말이 많아 이름 의심은 안 봄)
- 이 저장소(hj-app)는 공개 GitHub 라서 늘 엄격(github) 규칙이다. --target 은 github/drive 만 받는다(공지 261021-9, 규칙_총정리 5).
  볼트·잠긴 앱용 느슨한 규칙(주민번호만 차단)은 공용 스크립트 봇공유/99 봇/스크립트/pii_check.py --target vault|app 을 쓴다."""
import argparse, base64, glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # pii_baseline.key (저장소 맨 위)
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


# 261102 춘식이 결정(안 C): 워커 「사람 이름」은 부분일치 그대로 찾되, 이름이 든 「어절 전체」가 그 파일 기준선에 있으면 그 자리만 통과.
# 어절 = 띄어쓰기로 나눈 덩어리. JSON·HTML 안이라 따옴표·쉼표·<>·\n 같은 이스케이프도 띄어쓰기로 본다.
# 기준선 = data/pii_baseline.json 의 worker_keys: pii_baseline.key(워커 경로, WORD_KIND, 어절) 해시 → 개수 (원문 없음).
# 파일 × 어절이라, 같은 어절이라도 다른 파일이면 다시 걸리고, 기준선 어절 안의 이름이 새 어절로 나오면 다시 걸린다. SITE_ALLOW(파일 통째)와 다름.
WORD_KIND = '사람 이름 어절'
EOJ_SEP = re.compile(r'(?:\s|\\[nrt]|["\'`,<>])+')


def hit_eojeols(s, names):
    """s 에서 이름(부분일치)이 든 어절 목록(나온 만큼)."""
    if not any(n in s for n in names):
        return []
    out = []
    for w in EOJ_SEP.split(s):
        if w and any(n in w for n in names):
            out.append(w)
    return out


def word_key(rel, w):
    import pii_baseline   # 열쇠 만드는 법은 이름 의심 기준선과 같은 것(한 곳)
    return pii_baseline.key(rel, WORD_KIND, w)


def load_word_keys(base):
    """기준선 파일을 한 번만 읽어 worker_keys 집합. 없거나 깨졌으면 빈 집합(= 기준선 없이 엄격)."""
    try:
        with open(base, encoding='utf-8') as fh:
            return set(json.load(fh).get('worker_keys') or {})
    except (OSError, ValueError):
        return set()


def strong(s, names, rel=None, word_keys=None):
    hits = []
    for kind, rx in hjpii.PATTERNS:
        if rx.search(s):
            hits.append(kind)
    for m in hjpii.ACCOUNT.finditer(s):
        if not hjpii.DATE_LIKE.match(m.group(0)) and sum(c.isdigit() for c in m.group(0)) >= 10 and set(m.group(0)) - set('0-'):
            hits.append('계좌번호'); break
    if any(n in s for n in names):
        if rel and word_keys:
            if any(word_key(rel, w) not in word_keys for w in hit_eojeols(s, names)):
                hits.append('사람 이름')
        else:
            hits.append('사람 이름')
    return hits


def save_words(base, files, names, only, note):
    """--save-words: 고른 워커 파일(only)에서 지금 걸린 어절만 worker_keys 에 더함. 낱말은 안 찍고 개수만."""
    with open(base, encoding='utf-8') as fh:
        b = json.load(fh)
    wk = dict(b.get('worker_keys') or {})
    now = {}   # 이번에 센 개수. 다시 돌려도 더하지 않고 덮어씀(멱등)
    for rel in only:
        if rel not in files:
            print('워커에 없는 파일: %s' % rel)
            return 2
        s = base64.b64decode(files[rel][1]).decode('utf-8', 'replace')
        for w in hit_eojeols(s, names):
            k = word_key(rel, w)
            now[k] = now.get(k, 0) + 1
    added = sum(1 for k in now if k not in wk)
    wk.update(now)
    b['worker_keys'] = {k: wk[k] for k in sorted(wk)}
    b['worker_key'] = '(워커 경로, %s, 어절) sha256 16자 → a~p' % WORD_KIND
    notes = b.get('worker_notes') or []
    tail = ' %s: %s' % (','.join(only), note)
    if not any(x.endswith(tail) for x in notes):   # 같은 파일·같은 이유로 다시 돌리면 메모도 안 늘림
        notes = notes + [datetime_kst() + tail]
    b['worker_notes'] = notes
    with open(base, 'w', encoding='utf-8') as fh:
        json.dump(b, fh, ensure_ascii=False, indent=0)
        fh.write('\n')
    print('워커 어절 기준선 저장: 새 열쇠 %d개 (전체 %d개)' % (added, len(wk)))
    return 0


def datetime_kst():
    import datetime
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y-%m-%d %H:%M KST')


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
    ap.add_argument('--baseline', default=os.path.join(root, 'data', 'pii_baseline.json'), help='워커 어절 기준선(worker_keys)이 든 파일')
    ap.add_argument('--save-words', nargs='*', default=None, metavar='/data/파일.json',
                    help='(결정 있을 때만, 손으로) --worker 안의 이 파일들에서 지금 걸린 어절을 기준선에 더함')
    ap.add_argument('--note', default='', help='--save-words 이유')
    a = ap.parse_args(argv)
    if a.save_words is not None and not a.worker:
        print('경고: --save-words 는 --worker 워커 파일이 있어야 해요. 저장 안 함', file=sys.stderr)
        return 1
    if a.target in ('vault', 'app'):
        print('hj-app 은 공개 GitHub 라 vault/app 규칙을 쓸 수 없어요. --target github 로 돌려요.', file=sys.stderr)
        return 3
    names = names_from_raws(a.raw)
    bad, warn, n = [], [], 0
    # 데이터 파일도 워커와 같이 기준선 어절(worker_keys)을 본다.
    # 이름 부분문자열이 허용된 일반 낱말(예: 영어작문) 안에만 있으면 통과. 검사식(n in s)은 그대로.
    word_keys = load_word_keys(a.baseline)
    for fn in a.files:
        p = os.path.join(a.data, fn)
        if not os.path.exists(p):
            continue
        n += 1
        rel = '/data/%s' % fn
        for path, s in hjpii.walk_strings(json.load(open(p, encoding='utf-8'))):
            for k in hjpii.find_pii(s, names):
                if k == '사람 이름' and word_keys:
                    ejs = hit_eojeols(s, names)
                    if ejs and all(word_key(rel, w) in word_keys for w in ejs):
                        continue
                bad.append('%s %s: %s' % (fn, path, k))
    if a.worker:
        t = open(a.worker, encoding='utf-8').read()
        m = re.search(r'const F = (\{.*?\});\\nconst H', t, re.S)
        files = json.loads(json.loads('"' + m.group(1) + '"')) if m else {}
        if a.save_words:
            if not a.note:
                print('--save-words 는 --note 이유가 있어야 해요')
                return 2
            return save_words(a.baseline, files, names, a.save_words, a.note)
        word_keys = load_word_keys(a.baseline)   # 한 번만 읽음
        for rel, (typ, b64) in files.items():
            if not re.search(r'text|json|javascript|svg|xml', typ):
                continue
            n += 1
            s = base64.b64decode(b64).decode('utf-8', 'replace')
            for k in strong(s, names, rel, word_keys):
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
