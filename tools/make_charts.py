#!/usr/bin/env python3
"""#/charts 차트 4종 자료(data/charts.json) 만들기. 예시 데이터 금지: 원자료가 없으면 해당 차트 empty=true(화면 「데이터 없음」).
- 08 캘린더 히트맵: data/calendar.json 날짜별 건수(유진님 할 일·교수님 일정 = 업무량, 참고는 따로)
- 04 계단형: data/budget_events.json glocal_balance (글로컬 교육원 몫 배정 확인분 - 집행)
- 05 스파크라인 표: git 기록의 data/todo.json(남은 일·끝낸 일) + data/docreg.json 월별 상대부서 건수 + data/docs_important.json 월별 외부기관
- 03 강사료 월별: data/budget_events.json monthly_lecture_fee (주머니마다 작은 막대 차트 따로, 합치지 않음)
대장 kv T=hjapp_차트+중요문서(261029 19:05)."""
import collections, datetime as dt, json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
KST = dt.timezone(dt.timedelta(hours=9))


def load(name):
    p = os.path.join(DATA, name)
    if not os.path.exists(p):
        return None
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def heatmap(cal, start='2026-09-01', end='2027-02-28'):
    if not cal or not cal.get('events'):
        return {'empty': True, 'src': 'data/calendar.json 없음'}
    work, ref = collections.Counter(), collections.Counter()
    for e in cal['events']:
        d = e.get('date') or ''
        if not (start <= d <= end):
            continue
        (ref if e.get('lane') == 'ref' else work)[d] += 1
    days = sorted(set(work) | set(ref))
    return {'empty': not days, 'start': start, 'end': end,
            'days': {d: [work.get(d, 0), ref.get(d, 0)] for d in days},
            'max': max(work.values()) if work else 0,
            'src': 'data/calendar.json (현황판 「업무」 탭 + 일정총괄, %d건)' % len(cal['events'])}


def git_todo_series():
    try:
        out = subprocess.run(['git', '-C', ROOT, 'log', '--reverse', '--format=%h %cI', '--', 'data/todo.json'],
                             capture_output=True, text=True, timeout=30).stdout.split('\n')
    except Exception:
        return []
    pts = []
    for line in out:
        if not line.strip():
            continue
        sha, iso = line.split()
        try:
            j = json.loads(subprocess.run(['git', '-C', ROOT, 'show', sha + ':data/todo.json'], capture_output=True, text=True, timeout=30).stdout)
        except Exception:
            continue
        items = j.get('items') or []
        done = sum(1 for i in items if i.get('done'))
        pts.append({'t': iso[:16].replace('T', ' '), 'open': len(items) - done, 'done': done})
    return pts


def sparks(docreg, docs):
    rows = []
    pts = git_todo_series()
    if pts:
        rows.append({'name': '내일 할 일 · 남은 일', 'unit': '건', 'x': [p['t'][5:] for p in pts], 'y': [p['open'] for p in pts], 'src': 'git 기록 data/todo.json %d판' % len(pts)})
        rows.append({'name': '내일 할 일 · 끝낸 일', 'unit': '건', 'x': [p['t'][5:] for p in pts], 'y': [p['done'] for p in pts], 'src': 'git 기록 data/todo.json %d판' % len(pts)})
    months = ['2026-%02d' % m for m in range(3, 11)]
    if docreg and docreg.get('docs'):
        thru = max((d.get('d') or '')[:10] for d in docreg['docs'])  # 자료 마지막 날(이 날 뒤 달은 덜 참)
        c = collections.defaultdict(collections.Counter)
        tot = collections.Counter()
        for d in docreg['docs']:
            to = (d.get('to') or '').split('/')[-1]
            if not to or to == '내부결재':
                continue
            c[to][d.get('d', '')[:7]] += 1
            tot[to] += 1
        for name, _ in tot.most_common(6):
            rows.append({'name': name, 'unit': '건/월', 'x': [m[5:] + '월' for m in months], 'y': [c[name].get(m, 0) for m in months],
                         'through': thru, 'src': 'data/docreg.json 공개행(항공정비과 문서대장 ~%d.%d.)' % (int(thru[5:7]), int(thru[8:10]))})
    if docs and docs.get('rows'):
        cm = collections.Counter(r['d'][:7] for r in docs['rows'])
        # 문서를 뽑은 대장들 중 가장 이른 마지막 날까지만 모두 찼다고 봄
        tos = [x.get('to') for x in (docs.get('sources') or []) if x.get('picked') and x.get('to')]
        row = {'name': '외부기관 중요문서', 'unit': '건/월', 'x': [m[5:] + '월' for m in months], 'y': [cm.get(m, 0) for m in months], 'src': 'data/docs_important.json'}
        if tos:
            row['through'] = min(tos)[:10]
        rows.append(row)
    return {'empty': not rows, 'rows': rows}


def step(be):
    g = (be or {}).get('glocal_balance')
    if not g or not g.get('lines'):
        return {'empty': True, 'src': 'data/budget_events.json glocal_balance 없음'}
    start = sum(l.get('amt') or 0 for l in g['lines'])
    if start <= 0 or not g.get('start_date'):
        return {'empty': True, 'src': 'data/budget_events.json glocal_balance 배정 확인분 0원'}
    pts, bal = [{'d': g['start_date'], 'bal': start, 'what': '배정 확인분'}], start
    for s in sorted(g.get('spend', []), key=lambda x: x['d']):
        bal -= s['amt']
        pts.append({'d': s['d'], 'bal': bal, 'amt': s['amt'], 'what': s['what']})
    note = ' · '.join(x for x in (g.get('start_note'), g.get('excluded_note'), g.get('spend_note')) if x)
    return {'empty': False, 'label': g['label'], 'start': start, 'points': pts, 'today': dt.datetime.now(KST).date().isoformat(),
            'note': note, 'src': '; '.join(l['src'] for l in g['lines'])}


def stacked(be):
    """주머니별 작은 차트(small multiples). 주머니끼리 더하지 않음. kind: 집행=진한 칸, 그 밖(예정·추정)=옅은 빗금."""
    m = (be or {}).get('monthly_lecture_fee')
    pockets = (be or {}).get('pockets') or ['어학연수', '글로컬', '대학회계']
    if not m or not m.get('rows') or not m.get('months'):
        return {'empty': True, 'src': 'data/budget_events.json monthly_lecture_fee 없음'}
    series = []
    for p in pockets:
        vals = {r['m']: r for r in m['rows'] if r['pocket'] == p and (r.get('amt') or 0) > 0}
        series.append({'pocket': p, 'empty': not vals, 'y': [vals[x]['amt'] if x in vals else 0 for x in m['months']],
                       'kind': [vals[x]['kind'] if x in vals else '' for x in m['months']]})
    return {'empty': all(s['empty'] for s in series), 'label': m['label'], 'months': m['months'], 'series': series,
            'src': 'data/budget_events.json (지출결의·budget_lines 추정)'}


def main():
    cal, docreg, docs, be = load('calendar.json'), load('docreg.json'), load('docs_important.json'), load('budget_events.json')
    out = {'version': 1, 'note': '예시 데이터 없음. 원자료 없으면 empty=true → 「데이터 없음」.',
           'heatmap': heatmap(cal), 'step': step(be), 'sparks': sparks(docreg, docs), 'stacked': stacked(be)}
    with open(os.path.join(DATA, 'charts.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
        f.write('\n')
    print('charts.json:', {k: ('데이터 없음' if out[k].get('empty') else 'ok') for k in ('heatmap', 'step', 'sparks', 'stacked')})
    return 0


if __name__ == '__main__':
    sys.exit(main())
