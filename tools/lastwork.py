#!/usr/bin/env python3
"""협업 보드 「오래 멈춤」용: 일 번호(T###)마다 실제로 마지막 작업한 시각만 뽑아 data/lastwork.json 에 써요.
사용: lastwork.py [--out data/lastwork.json] [--vault <볼트>] [--log <작업기록 log.tsv>] [--now 'YYYY-MM-DD HH:MM']
- 읽는 곳(박스 안에서만 읽고, 내용은 하나도 안 옮김): ① 유진님 명령목록(지금·보관) 날짜 줄에 나온 T번호
  ② 작업기록 log.tsv 첫 칸 시각 + 그 줄의 T번호 ③ 볼트 파일 이름의 날짜(YYMMDD[_HHMM]) + T번호 ④ 이 저장소 커밋 제목의 T번호.
- 쓰는 것: {"T001": "2026-10-29 08:05", "T008": "2026-10-26", …} 일 번호와 시각(시각 모르면 날짜)뿐. 글·경로·봇 이름·파일 이름은 안 써요.
- 앞날 시각(지금보다 뒤)·모양이 다른 값은 버려요. 원자료가 하나도 없으면 예전 파일을 그대로 두고 종료 코드 1.
출처: 대장 10.30. 20:4x 「오래 멈춤이 78개나 뜨는 건 현황판 갱신 시각 때문 → 실제 마지막 작업 시각으로」."""
import argparse, datetime as dt, json, os, re, subprocess, sys

KST = dt.timezone(dt.timedelta(hours=9))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VAULT = '/home/box/obsidian_vault'
LOG = '/home/box/hj-ops/log.tsv'
CMD_FILES = ('봇공유/00 홈/유진님_명령목록.md', '봇공유/00 홈/명령목록_보관_2610.md')
SKIP_DIRS = ('_archive', '_충돌보관', '90 보관', '90_개인정보', '.trash', '.obsidian', '_백업', '.git')
TNO = re.compile(r'(?<![A-Za-z0-9])(T\d{3,4})(?!\d)')
STAMP = re.compile(r'(20\d\d)-(\d\d)-(\d\d)[ T](\d\d):(\d\d)')
FNAME_DATE = re.compile(r'(?<!\d)(2[5-9])(\d\d)(\d\d)(?:[_-](\d\d)(\d\d))?(?!\d)')
OUT_KEY = re.compile(r'^T\d{3,4}$')
OUT_VAL = re.compile(r'^20\d\d-\d\d-\d\d(?: \d\d:\d\d)?$')


def _ok(y, mo, d, h=0, mi=0):
    try:
        return dt.datetime(int(y), int(mo), int(d), int(h), int(mi))
    except ValueError:
        return None


def collect(vault=VAULT, log=LOG, repo=ROOT, now=None):
    """→ ({T번호: 'YYYY-MM-DD HH:MM'}, 읽은 원자료 수). 지금보다 뒤 시각은 버림."""
    now = now or dt.datetime.now(KST).replace(tzinfo=None)
    last, srcs = {}, 0

    def put(nos, t, day_only=False):
        if t is None or t > now:
            return
        s = t.strftime('%Y-%m-%d' if day_only else '%Y-%m-%d %H:%M')  # 시각 없는 파일 이름은 날짜만(00:00 으로 지어내지 않음)
        for n in set(nos):
            if s > last.get(n, ''):
                last[n] = s
    for rel in CMD_FILES:  # ① 명령목록: 줄마다 첫 시각
        p = os.path.join(vault, rel)
        if not os.path.isfile(p):
            continue
        srcs += 1
        for ln in open(p, encoding='utf-8', errors='replace'):
            m = STAMP.search(ln)
            if m:
                put(TNO.findall(ln), _ok(*m.groups()))
    if os.path.isfile(log):  # ② 작업기록: 첫 칸이 시각
        srcs += 1
        for ln in open(log, encoding='utf-8', errors='replace'):
            m = STAMP.match(ln)
            if m:
                put(TNO.findall(ln), _ok(*m.groups()))
    if os.path.isdir(vault):  # ③ 볼트 파일 이름(날짜+T번호). 충돌 사본·보관함은 안 봄
        srcs += 1
        for dp, dn, fn in os.walk(vault):
            dn[:] = [d for d in dn if not any(s in d for s in SKIP_DIRS)]
            for f in fn:
                if '충돌' in f:
                    continue
                nos, m = TNO.findall(f), FNAME_DATE.search(f)
                if nos and m:
                    y, mo, d, h, mi = m.groups()
                    put(nos, _ok(2000 + int(y), mo, d, h or 0, mi or 0), day_only=not h)
    try:  # ④ 이 저장소 커밋 제목(이미 공개된 글)
        g = subprocess.run(['git', '-C', repo, 'log', '--format=%ad\t%s', '--date=format-local:%Y-%m-%d %H:%M'],
                           capture_output=True, text=True, env=dict(os.environ, TZ='Asia/Seoul'), timeout=60)
        if g.returncode == 0:
            srcs += 1
            for ln in g.stdout.splitlines():
                ts, _, sub = ln.partition('\t')
                m = STAMP.match(ts)
                if m:
                    put(TNO.findall(sub), _ok(*m.groups()))
    except (OSError, subprocess.SubprocessError):
        pass
    return {k: v for k, v in sorted(last.items()) if OUT_KEY.match(k) and OUT_VAL.match(v)}, srcs


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'lastwork.json'))
    ap.add_argument('--vault', default=VAULT)
    ap.add_argument('--log', default=LOG)
    ap.add_argument('--now', default='')
    a = ap.parse_args(argv)
    now = dt.datetime.strptime(a.now, '%Y-%m-%d %H:%M') if a.now else None
    tasks, srcs = collect(a.vault, a.log, ROOT, now)
    if srcs <= 1:  # 커밋 제목만 읽힘 = 볼트·작업기록이 없는 곳(예: 다른 PC) → 예전 파일 유지
        print('lastwork: 원자료(볼트·작업기록) 없음 → 예전 파일 그대로')
        return 1
    built = (now or dt.datetime.now(KST)).strftime('%Y-%m-%d %H:%M')
    obj = {'version': 1, 'built_at': built, 'source': '명령목록·작업기록·볼트 파일 날짜·커밋 제목에서 뽑은 일 번호별 시각만', 'tasks': tasks}
    tmp = a.out + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(tmp, a.out)
    print('lastwork: 일 번호 %d개 · 원자료 %d곳 → %s' % (len(tasks), srcs, a.out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
