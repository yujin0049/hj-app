#!/usr/bin/env python3
"""사람 바뀜(data/people_changes.json) — 기준판 people_roles 와 지금 people_roles 비교. 같은 두 파일 → 같은 결과(시각 안 씀).

T3 (261111 춘식이 kv): 협조 화면 「바뀐 사람」 칩 + 사람 카드 「언제 기준」 자료.
  python3 tools/make_people_changes.py --before BEFORE.json --after data/people_roles.json --out data/people_changes.json
  --before-ref REF : BEFORE 대신 git REF:data/people_roles.json 을 읽음(기본 기준판 = 업무분장 반영 전 main fd6a908)
- 이름·id 는 이 파일에 안 씀(새 파일이라 개인정보 기준선에 새 낱말이 생기지 않게). 사람은 after.people 의 순번 at 으로만 가리킴.
- diff_keys: new, gone, dept, rank, duties, deputy, counts_delta, period_last
종료 코드: 0 성공 · 1 --check 에서 다름 · 3 입력 없음
"""
import argparse, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEFORE_REF = 'fd6a908'
DIFF_KEYS = ['new', 'gone', 'dept', 'rank', 'duties', 'deputy', 'counts_delta', 'period_last']
CK = ('기안', '접수', '결재', '원문기안', '협조제목')


def rank_of(p):
    return p.get('status_note') or p.get('rank') or p.get('rank_inferred')


def diff(before, after):
    bp = before.get('people') or []
    ap = after.get('people') or []
    bidx = {p['id']: i for i, p in enumerate(bp)}
    seen, out = set(), []
    for i, p in enumerate(ap):
        j = bidx.get(p['id'], bidx.get(p.get('was_id')))
        ch = {'at': i}
        if j is None:
            ch['new'] = True
        else:
            seen.add(j)
            q = bp[j]
            if q.get('dept') != p.get('dept'):
                ch['dept'] = {'from': q.get('dept'), 'to': p.get('dept')}
            if rank_of(q) != rank_of(p):
                ch['rank'] = {'from': rank_of(q), 'to': rank_of(p)}
            cd = {k: (p.get('counts') or {}).get(k, 0) - (q.get('counts') or {}).get(k, 0) for k in CK}
            cd = {k: v for k, v in cd.items() if v}
            if cd:
                ch['counts_delta'] = cd
            pl, ql = (p.get('period') or {}).get('last'), (q.get('period') or {}).get('last')
            if pl != ql:
                ch['period_last'] = {'from': ql, 'to': pl}
        if (p.get('duties') or []) != ((bp[j].get('duties') or []) if j is not None else []):
            ch['duties'] = len(p.get('duties') or [])
        if p.get('deputy') != (bp[j].get('deputy') if j is not None else None):
            ch['deputy'] = bool(p.get('deputy'))
        if len(ch) > 1:
            if p.get('as_of'):
                ch['as_of'] = p['as_of']
            out.append(ch)
    gone = [{'before_at': j, 'gone': True} for j in range(len(bp)) if j not in seen and bp[j]['id'] not in {p.get('was_id') for p in ap}]
    am, bm = after.get('meta') or {}, before.get('meta') or {}
    return {
        'meta': {'id': 'people_changes_' + str(am.get('id', '')), 'generated': am.get('generated'),
                 'before': bm.get('id'), 'after': am.get('id'), 'as_of': am.get('as_of'),
                 'diff_keys': DIFF_KEYS, 'n_changed': len(out), 'n_gone': len(gone),
                 'notice': 'at = people_roles.json people 순번(이 파일엔 이름 없음). 발령일·전화 없음. 자료 없으면 「데이터 없음」.'},
        'changes': out, 'gone': gone}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--before')
    ap.add_argument('--before-ref', default=BEFORE_REF)
    ap.add_argument('--after', default=os.path.join(ROOT, 'data', 'people_roles.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'people_changes.json'))
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args(argv)
    if a.before:
        if not os.path.exists(a.before):
            print('기준판 없음 → 멈춤')
            return 3
        before = json.load(open(a.before, encoding='utf-8'))
    else:
        r = subprocess.run(['git', '-C', ROOT, 'show', '%s:data/people_roles.json' % a.before_ref], capture_output=True, text=True)
        if r.returncode:
            print('기준판(git %s) 없음 → 멈춤' % a.before_ref)
            return 3
        before = json.loads(r.stdout)
    after = json.load(open(a.after, encoding='utf-8'))
    text = json.dumps(diff(before, after), ensure_ascii=False, indent=1) + '\n'
    old = open(a.out, encoding='utf-8').read() if os.path.exists(a.out) else None
    print('바뀐 사람 %d명 · %s' % (json.loads(text)['meta']['n_changed'], '같음' if old == text else ('다름' if a.check else '씀')))
    if old != text and not a.check:
        with open(a.out, 'w', encoding='utf-8') as f:
            f.write(text)
    return 1 if (a.check and old != text) else 0


if __name__ == '__main__':
    sys.exit(main())
