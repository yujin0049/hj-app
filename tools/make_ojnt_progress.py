#!/usr/bin/env python3
"""OJNT 입사서류 시트 덤프 → data/ojnt_progress.json (서류별 「낸 수/대상 수」와 비율만. 이름·전화·호실 없음)
사용: make_ojnt_progress.py [--raw /workspace/hj_audit/calendar/raw_ojnt.json] [--out data]
- 정본 숫자 = 시트 「입사서류체크」 A2 요약 줄(시트 수식). 줄 세기로 한 번 더 맞춰 보고 다르면 「확인 필요」.
- 원자료는 저장소 밖(권한 600)에만 둔다. 출력에 개인정보 모양이 보이면 파일 안 쓰고 종료 코드 2."""
import argparse, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hjpii
from make_calendar import read_table, norm_date

SUBMIT = {'제출', '제출 완료', '완료', 'O', 'TRUE', '○'}
NA = {'해당 없음', '해당없음', '-'}


def parse(rows, year):
    summary = rows[1][0] if len(rows) > 1 and rows[1] else ''
    deadline = rows[2][0] if len(rows) > 2 and rows[2] else ''
    items = []
    for m in re.finditer(r'([가-힣][가-힣 ]*?)\s*(\d+)\s*/\s*(\d+)(?:\s*\(([^)]*)\))?', summary.split(':', 1)[-1]):
        label, done, total, note = m.group(1).strip(' ·'), int(m.group(2)), int(m.group(3)), (m.group(4) or '').strip()
        items.append({'label': label, 'done': done, 'total': total, 'rate': round(done * 100 / total) if total else 0,
                      'note': note if re.fullmatch(r'[가-힣 ]+\d*', note or '') else ''})
    # 줄 세기로 맞춰 보기
    hi = next((i for i, r in enumerate(rows) if r and r[0].strip() == '번호'), -1)
    counted = {}
    if hi >= 0:
        head = rows[hi]
        body = [r for r in rows[hi + 1:] if r and r[0].strip().isdigit()]
        for it in items:
            key = it['label'].replace(' ', '')
            cand = [i for i, h in enumerate(head) if key in h.replace(' ', '') and '만듦' not in h]
            cand = [i for i in cand if '제출' in head[i]] or cand
            if not cand:
                continue
            ci = cand[0]
            vals = [(r[ci].strip() if ci < len(r) else '') for r in body]
            counted[it['label']] = (sum(v in SUBMIT for v in vals), sum(v not in NA for v in vals))
    checks = []
    for it in items:
        c = counted.get(it['label'])
        if c is None:
            it['cross'] = '줄 세기 못 함'
        elif c == (it['done'], it['total']):
            it['cross'] = '일치'
        else:
            it['cross'] = '다름: 줄 세기 %d/%d' % c
            checks.append('%s 요약 %d/%d · 줄 세기 %d/%d' % (it['label'], it['done'], it['total'], c[0], c[1]))
    deadlines = []
    for m in re.finditer(r'([가-힣][가-힣 ]*?)\s*(\d{1,2}\.\s?\d{1,2})\.?(?:\([^)]*\))?', deadline.split(':', 1)[-1]):
        d = norm_date(m.group(2).replace(' ', ''), year)
        if d:
            deadlines.append({'label': m.group(1).strip(' ·'), 'date': d})
    return {'version': 1, 'source': 'OJNT 기숙사 입사서류 시트 「입사서류체크」 A2 요약 줄(시트 수식) · 줄 세기로 맞춰 봄',
            'items': items, 'deadlines': deadlines, 'checks': checks}


def main(argv=None):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default='/workspace/hj_audit/calendar/raw_ojnt.json')
    ap.add_argument('--out', default=os.path.join(root, 'data'))
    ap.add_argument('--year', type=int, default=2026)
    a = ap.parse_args(argv)
    rows = read_table(a.raw)
    out = parse(rows, a.year)
    # 원자료의 이름 칸 값을 이름 목록으로 써서 출력 검사(목록은 저장 안 함)
    hi = next((i for i, r in enumerate(rows) if r and r[0].strip() == '번호'), -1)
    names = set()
    if hi >= 0 and '이름' in rows[hi]:
        ni = rows[hi].index('이름')
        names = {r[ni].strip() for r in rows[hi + 1:] if len(r) > ni and len(r[ni].strip()) >= 2 and r[0].strip().isdigit()}
    bad = ['%s: %s' % (p, k) for p, s in hjpii.walk_strings(out) for k in hjpii.find_pii(s, names)]
    if not out['items']:
        print('요약 줄(A2)을 못 읽음', file=sys.stderr)
        return 1
    if bad:
        print('개인정보 모양이 보여 멈춤:', *bad[:20], sep='\n  ', file=sys.stderr)
        return 2
    with open(os.path.join(a.out, 'ojnt_progress.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('ojnt_progress.json: ' + ' · '.join('%s %d/%d(%s)' % (i['label'], i['done'], i['total'], i['cross']) for i in out['items']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
