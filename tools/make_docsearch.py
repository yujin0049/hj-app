#!/usr/bin/env python3
"""문서대장 찾기(#/docsearch) 자료 만들기 → data/docsearch.json
- 검색 본체는 data/docreg.json(항공정비과 대장 공개 행 1,533건, ~10.21.)을 화면이 그대로 읽어요. 여기서는 그 뒤에 더할 것만 만들어요.
  ① extra: 항공정비과 대장 v02(1,940건) 중 10.22.~10.30. 「공개」 행만. 칸 = 번호·제목·날짜·종류·상대(기안자·결재자 칸 안 씀).
     제목에 사람 이름 모양(성씨 3글자·가린 이름 *·○)이 있으면 그 행은 뺌(뺀 개수만 남김).
  ② registers: 전 부서 대장 조사 MD(261102 v01)의 「대장 목록」 표 그대로(부서·기간·건수). 파일 경로 칸은 안 옮김.
  ③ nodept: 거미줄(data/dept_spider.json)에서 대장 파일이 없는(doc_n=0) 부서와 다른 대장에 나온 수(보낸·받은).
  ④ 같은 뜻 낱말 묶음은 js/docsearch-core.js 안에 있어요(공개 JSON 기준선 검사에 보통 낱말이 새로 걸리지 않게).
  공개 JSON 글자는 hjpii 이름 의심(성씨 3글자)에 걸리면 안 됨 → 걸리는 부서 역할 글은 빼고, 걸리는 행은 뺌.
사용: python3 tools/make_docsearch.py --xlsx <항공정비과 대장 v02.xlsx> --md <전부서공문 조사 MD> [--out data/docsearch.json]
종료 코드: 0 성공, 1 원자료 없음, 2 개인정보 모양이 남음(파일 안 씀)."""
import argparse, datetime as dt, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hjpii  # noqa: E402

KIND = {'수신': '수신', '발신': '발신', '일반': '내부결재', '보고': '보고'}
BASE_YEAR = 2026
GAP_FLAG_DAYS = 14   # 기준일까지 2주 넘게 빈 대장 = 부족


def md_registers(md):
    lines = md.split('\n')
    head = re.search(r'문서대장\s*(\d+)개 파일\((\d+)개 부서', md)
    base = re.search(r'기간\s*2026\.(\d+)\.~(\d+)\.(\d+)\.', md)
    i = next(k for k, l in enumerate(lines) if l.startswith('## 대장 목록'))
    rows = []
    for l in lines[i + 1:]:
        if l.startswith('## '):
            break
        if not l.startswith('| ') or l.startswith('| 부서') or l.startswith('|---'):
            continue
        c = [x.strip() for x in l.strip().strip('|').split('|')]
        dept, period, n = re.sub(r'\*', '', c[0]), c[2], c[3]
        m = re.match(r'(?:(\d{4})\.)?(\d+)\.(\d+)\.~(\d+)\.(\d+)\.', period)
        if m:
            sy = int(m.group(1) or BASE_YEAR)
            rows.append({'dept': dept, 'start': '%04d-%02d-%02d' % (sy, int(m.group(2)), int(m.group(3))),
                         'end': '%04d-%02d-%02d' % (BASE_YEAR, int(m.group(4)), int(m.group(5))), 'n': int(n.replace(',', ''))})
        else:
            rows.append({'dept': dept, 'start': None, 'end': None, 'n': None})
    base_d = dt.date(BASE_YEAR, int(base.group(2)), int(base.group(3)))
    for r in rows:
        if not r['end']:
            r.update(status='대장 없음', gap_from=None, gap_days=None)
            continue
        e = dt.date.fromisoformat(r['end'])
        gap = (base_d - e).days
        r['gap_days'] = gap
        r['gap_from'] = (e + dt.timedelta(days=1)).isoformat() if gap > 0 else None
        r['status'] = '부족' if gap > GAP_FLAG_DAYS else ('기준일까지 있음' if gap <= 0 else '거의 있음')
    return {'files': int(head.group(1)), 'depts': int(head.group(2)), 'base': base_d.isoformat(),
            'gap_flag_days': GAP_FLAG_DAYS, 'rows': rows,
            'note': '전 부서 대장 조사(2026.11.2. v01) 「대장 목록」 표 그대로. 부족 = 대장이 없거나 기준일(10.30.)까지 2주 넘게 빈 곳.'}


def md_cats(md):
    out = {}
    for l in md.split('\n'):
        if re.match(r'\| \d\d\.\d\d \|', l):
            c = [x.strip() for x in l.strip().strip('|').split('|')]
            out[c[2]] = c[6]
    return out


def clean(t):
    return '' if hjpii.find_pii(t) else t


def bad_title(t):
    return bool(re.search(r'[가-힣][*○●][가-힣*○●]', t)) or bool(hjpii.find_pii(t))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--xlsx', required=True)
    ap.add_argument('--md', required=True)
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'docsearch.json'))
    a = ap.parse_args(argv)
    if not (os.path.exists(a.xlsx) and os.path.exists(a.md)):
        print('원자료 없음'); return 1
    import openpyxl
    md = open(a.md, encoding='utf-8').read()
    docreg = json.load(open(os.path.join(ROOT, 'data', 'docreg.json'), encoding='utf-8'))
    have = {d['no'] for d in docreg['docs']}
    last = max(d['d'] for d in docreg['docs'])
    cats = md_cats(md)
    ws = openpyxl.load_workbook(a.xlsx, read_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(rows) if r and r[2] == '문서번호')
    h = rows[hi]
    extra, dropped, closed = [], 0, 0
    for r in rows[hi + 1:]:
        if not r or not r[2]:
            continue
        x = dict(zip(h, r))
        d = str(x['등록일자']).replace('.', '-')
        if x['문서번호'] in have or d <= last:
            continue
        if x['공개여부'] != '공개':
            closed += 1; continue
        t = re.sub(r'\s+', ' ', str(x['제목'] or '')).strip()
        to = re.sub(r'\s+', ' ', str(x['수신(발신)자'] or '')).strip()
        if bad_title(t) or bad_title(to):
            dropped += 1; continue
        short = '항공정비과-' + str(x['문서번호']).rsplit('-', 1)[1]
        extra.append([x['문서번호'], t, d, KIND.get(x['문서종류'], x['문서종류']), to, cats.get(short, '')])
    extra.sort(key=lambda e: (e[2], int(e[0].rsplit('-', 1)[1])), reverse=True)
    spider = json.load(open(os.path.join(ROOT, 'data', 'dept_spider.json'), encoding='utf-8'))
    nodept = [{'dept': b['dept'], 'campus': b.get('campus'), 'send_out': b.get('send_out', 0), 'recv_in': b.get('recv_in', 0),
               'role': clean(b.get('role_summary', ''))} for b in spider['dept_role_board'] if not b.get('doc_n')]
    out = {
        'version': dt.date.today().isoformat(),
        'about': '문서대장 찾기 자료. 검색 본체 = data/docreg.json(공개 행). 여기 = 10.22.~10.30. 공개 행 더하기와 부서별 대장 현황.',
        'extra': {'source': '항공정비과 문서등록대장 v02(1,940건) 중 10.22.~10.30. 공개 행', 'from': min((e[2] for e in extra), default=None),
                  'to': max((e[2] for e in extra), default=None), 'n': len(extra), 'closed_skipped': closed, 'name_skipped': dropped,
                  'cols': ['no', 't', 'd', 'kind', 'to', 'cat'], 'rows': extra},
        'registers': md_registers(md),
        'nodept': {'note': '거미줄(문서대장 3.~10. 38,232건)에 나오지만 대장 파일이 없는 부서. 보낸·받은 = 다른 부서 대장에 나온 수.', 'rows': nodept},
    }
    hits = [(p, k) for p, s in hjpii.walk_strings(out) for k in hjpii.find_pii(s)]
    if hits:
        print('개인정보 모양 남음:', len(hits), sorted({p.split('[')[0] + ':' + k for p, k in hits})[:20]); return 2
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print('docsearch.json: 더한 행 %d(비공개 %d·이름 모양 %d 뺌), 대장 %d부서, 대장 없는 부서 %d' % (len(extra), closed, dropped, len(out['registers']['rows']), len(nodept)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
