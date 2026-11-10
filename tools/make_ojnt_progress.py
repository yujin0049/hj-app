#!/usr/bin/env python3
"""OJNT 입사서류 시트 덤프 → data/ojnt_progress.json (서류별 「낸 수/대상 수」와 비율만. 이름·전화·호실 없음)
사용: make_ojnt_progress.py [--raw /workspace/hj_audit/calendar/raw_ojnt.json] [--out data]
- 정본 숫자 = 시트 「입사서류체크」 A2 요약 줄(시트 수식). 줄 세기로 한 번 더 맞춰 보고 다르면 「확인 필요」.
- A2 가 옛 N/N 형식이 아니면(항목 0) 표 칸을 세어 채운다. 출력에 이름·원문 요약 줄은 넣지 않는다.
- 원자료는 저장소 밖(권한 600)에만 둔다. 출력에 개인정보 모양이 보이면 파일 안 쓰고 종료 코드 2."""
import argparse, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hjpii
from make_calendar import read_table, norm_date

SUBMIT = {'제출', '제출 완료', '완료', 'O', 'TRUE', '○'}
NA = {'해당 없음', '해당없음', '-'}
# 서류 칸이 아닌 헤더(이름·연락처 등은 세지 않음)
SKIP_HEAD = ('번호', '이름', '구분', '성별', '상태', '휴대폰', '전화', '연락처', '호실', '비고', '확인 필요', '확인필요')


def _items_from_summary(summary):
    """옛 A2 「라벨 N/N」 형식. 새 형식(N명·이름 나열 등)은 빈 목록."""
    items = []
    for m in re.finditer(r'([가-힣][가-힣 ]*?)\s*(\d+)\s*/\s*(\d+)(?:\s*\(([^)]*)\))?', summary.split(':', 1)[-1]):
        label, done, total, note = m.group(1).strip(' ·'), int(m.group(2)), int(m.group(3)), (m.group(4) or '').strip()
        items.append({'label': label, 'done': done, 'total': total, 'rate': round(done * 100 / total) if total else 0,
                      'note': note if re.fullmatch(r'[가-힣 ]+\d*', note or '') else ''})
    return items


def _table(rows):
    hi = next((i for i, r in enumerate(rows) if r and r[0].strip() == '번호'), -1)
    if hi < 0:
        return -1, [], []
    head = rows[hi]
    body = [r for r in rows[hi + 1:] if r and r[0].strip().isdigit()]
    return hi, head, body


def _count_col(body, ci):
    vals = [(r[ci].strip() if ci < len(r) else '') for r in body]
    return sum(v in SUBMIT for v in vals), sum(v not in NA for v in vals)


def _clean_label(h):
    return re.sub(r'\s*\([^)]*\)\s*$', '', h).strip()


def _skip_head(h):
    key = h.replace(' ', '')
    return any(s.replace(' ', '') in key for s in SKIP_HEAD)


def items_from_table(rows):
    """표 헤더의 서류 칸만 줄 세기. 이름·연락 칸은 건너뜀."""
    hi, head, body = _table(rows)
    if hi < 0 or not body:
        return []
    items = []
    for i, h in enumerate(head):
        if not h or _skip_head(h):
            continue
        done, total = _count_col(body, i)
        label = _clean_label(h)
        if not label:
            continue
        items.append({'label': label, 'done': done, 'total': total,
                      'rate': round(done * 100 / total) if total else 0, 'note': '', 'cross': '줄 세기만'})
    return items


def _cross_check(items, rows):
    hi, head, body = _table(rows)
    counted = {}
    if hi >= 0:
        for it in items:
            key = it['label'].replace(' ', '')
            cand = [i for i, h in enumerate(head) if key in h.replace(' ', '') and '만듦' not in h]
            cand = [i for i in cand if '제출' in head[i]] or cand
            if not cand:
                continue
            counted[it['label']] = _count_col(body, cand[0])
    checks = []
    for it in items:
        if it.get('cross') == '줄 세기만':
            continue
        c = counted.get(it['label'])
        if c is None:
            it['cross'] = '줄 세기 못 함'
        elif c == (it['done'], it['total']):
            it['cross'] = '일치'
        else:
            it['cross'] = '다름: 줄 세기 %d/%d' % c
            checks.append('%s 요약 %d/%d · 줄 세기 %d/%d' % (it['label'], it['done'], it['total'], c[0], c[1]))
    return checks


def _deadlines(deadline, year):
    out = []
    for m in re.finditer(r'([가-힣][가-힣 ]*?)\s*(\d{1,2}\.\s?\d{1,2})\.?(?:\([^)]*\))?', deadline.split(':', 1)[-1]):
        d = norm_date(m.group(2).replace(' ', ''), year)
        if d:
            out.append({'label': m.group(1).strip(' ·'), 'date': d})
    return out


def parse(rows, year):
    summary = rows[1][0] if len(rows) > 1 and rows[1] else ''
    deadline = rows[2][0] if len(rows) > 2 and rows[2] else ''
    items = _items_from_summary(summary)
    if items:
        checks = _cross_check(items, rows)
        src = 'OJNT 기숙사 입사서류 시트 「입사서류체크」 A2 요약 줄(시트 수식) · 줄 세기로 맞춰 봄'
    else:
        items = items_from_table(rows)
        checks = []
        src = 'OJNT 기숙사 입사서류 시트 「입사서류체크」 표 줄 세기(A2 요약 줄을 N/N 으로 못 읽음)'
    return {'version': 1, 'source': src, 'items': items, 'deadlines': _deadlines(deadline, year), 'checks': checks}


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
