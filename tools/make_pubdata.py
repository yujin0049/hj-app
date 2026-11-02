#!/usr/bin/env python3
"""공공데이터 5셋(#/pubdata) 자료 만들기 (261102 춘식이2, 유진님 16:27 「그리고 이거 붙여봐.」 대장·춘식이 전달).
원자료 = 공공데이터포털 파일데이터 CSV(로그인·키 없이 받음)를 볼트 데이터 폴더에 UTF-8 로 둔 것. 이 스크립트는 인터넷 안 씀.
- 숫자는 CSV 그대로. 교육원 수료생 응시·취득 수치는 볼트에서 못 찾아 None(화면 「자료 필요」). 지어내지 않음.
- 개인 행 없음(집계·교육명만). 공개 JSON 에 볼트·박스 경로 안 씀.
사용: python3 tools/make_pubdata.py [--src <CSV 폴더>] [--out data/pubdata.json]"""
import argparse, csv, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = '/home/box/obsidian_vault/봇공유/조사/데이터'

SETS = [
    {'id': '15174838', 'title': '항공정비사·관제사·영어구술 시험별 응시현황', 'org': '한국교통안전공단 항공자격처',
     'file': '한국교통안전공단_항공영어구술능력증명_항공교통관제사_항공정비사 시험별 응시현황_20251231',
     'updated': '2026-10-27', 'cycle': '수시(1회성)', 'note': '응시자 수만 있음(합격자·합격률 없음, 기관 설명).'},
    {'id': '3043749', 'title': '항공종사자 자격증명 년도별 취득자 현황', 'org': '한국교통안전공단 항공자격처',
     'file': '한국교통안전공단_항공종사자 자격증명 년도별 취득자 현황_20251231',
     'updated': '2026-07-28', 'cycle': '연간(다음 2027-07-31)', 'note': '「~2000」 행은 2000년 이전 누계라 그래프에서 뺌.'},
    {'id': '15119468', 'title': 'ARTS 항공종사자 자격시험 실기원서접수현황', 'org': '한국교통안전공단 항공자격처',
     'file': '한국교통안전공단_항공자격시험(ARTS) 항공종사자 자격시험 정보 공개(실기원서접수현황)_20221231',
     'updated': '2025-06-04', 'cycle': '수시(1회성)', 'note': '2022년 기준 한 해치. 연도 칸 없음. 「자가용조종사·비행기」 줄이 둘(원본 그대로).'},
    {'id': '15092578', 'title': '국토교통부 정비조직인증 현황', 'org': '국토교통부',
     'file': '', 'updated': '', 'cycle': '', 'link': 'http://atis.koca.go.kr/ATIS/approvedMaintOrg/forwardPage.do?pageUrl=ApprovedMaintOrg01',
     'note': '포털에 파일이 없고 국토부 항공정보 사이트로 연결(LINK)만 있어요. 표는 그 사이트에서 보세요.'},
    {'id': '15069398', 'title': '산림청 산림항공본부 정비사 교육', 'org': '산림청 산림항공본부 항공지원과',
     'file': '산림청 산림항공본부_정비사 교육_20251231',
     'updated': '2026-07-24', 'cycle': '연간(다음 2027-07-31)', 'note': '교육 이름·기관·종료일만 있음(교육 내용·인원 없음, 기관 설명).'},
]


def read(src, i):
    p = os.path.join(src, '261102_공공데이터_%s.csv' % i)
    if not os.path.exists(p):
        return None, None
    with open(p, encoding='utf-8-sig', newline='') as f:
        rows = [r for r in csv.reader(f) if r]
    return rows[0], rows[1:]


def num(v):
    try:
        return int(str(v).replace(',', ''))
    except ValueError:
        return v


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SRC)
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'pubdata.json'))
    a = ap.parse_args(argv)
    out = {'built': '2026-11-02', 'sets': [], 'compare': None}
    by = {}
    for s in SETS:
        d = dict(s, page='https://www.data.go.kr/data/%s/fileData.do' % s['id'])
        if s.get('link'):
            d.update(kind='link', columns=[], rows=[])
        else:
            cols, rows = read(a.src, s['id'])
            if cols is None:
                d.update(kind='missing', columns=[], rows=[])
            else:
                d.update(kind='file', columns=cols, rows=[[num(v) for v in r] for r in rows])
        d['count'] = len(d['rows'])
        out['sets'].append(d)
        by[s['id']] = d
    # 대조표: 전국(공공데이터) 항공정비사 응시·취득 vs 교육원 수료생(자료 없음 → None)
    a1, a2 = by['15174838'], by['3043749']
    if a1['kind'] == 'file' and a2['kind'] == 'file':
        exam = {}
        for r in a1['rows']:
            if r[1] == '항공정비사':
                exam.setdefault(r[0], {})[r[2]] = r[5]
        ci = a2['columns'].index('항공정비사')
        got = {r[0]: r[ci] for r in a2['rows'] if isinstance(r[0], int)}
        years = sorted(set(exam) | {y for y in got if y >= 2021})
        out['compare'] = {
            'years': years,
            'rows': [{'y': y, 'written': exam.get(y, {}).get('학과'), 'practical': exam.get(y, {}).get('실기'),
                      'licensed': got.get(y), 'our_exam': None, 'our_licensed': None} for y in years],
            'our_note': '교육원 수료생 응시·취득 수치: 볼트에서 못 찾음(11.02. 확인) → 자료 필요',
        }
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('pubdata:', ', '.join('%s=%s(%d)' % (s['id'], s['kind'], s['count']) for s in out['sets']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
