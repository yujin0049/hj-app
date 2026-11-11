#!/usr/bin/env python3
"""계획 달력·현황표 갱신 한 번에: 원자료(커넥터로 읽어 박스에 둔 덤프) → data/*.json → 개인정보 검사 → 미리보기 워커 파일.
사용: refresh_all.py [--raw-dir /workspace/hj_audit/calendar] [--worker hj-pv-calendar] [--no-worker]
- 시트 읽기는 부르는 쪽(봇)이 커넥터로 해서 raw_업무.json · raw_ojnt.json 으로 저장해 둔다(이 스크립트는 인터넷 안 씀).
- data/meta.json 에 「마지막 갱신」(KST)과 성공 여부를 남긴다. 실패하면 예전 data 는 그대로 두고 meta 에 실패만 적어 화면에 경고 띠가 뜬다.
- 개인정보 검사(cal_pii_check) 실패 = 종료 코드 2, 워커 파일 안 만듦(배포하면 안 됨).
- 배포는 이 스크립트가 하지 않는다: 만든 /workspace/hj_audit/preview/<워커>.js 를 Cloudflare 커넥터 execute 로 보낸다."""
import argparse, datetime as dt, json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import make_calendar, make_ojnt_progress, cal_pii_check

KST = dt.timezone(dt.timedelta(hours=9))
BUILD = '/workspace/hj_audit/preview/build_preview.py'
SKIP = {'.git', 'dl', 'node_modules', 'tests', 'tools', 'docs'}
# 미리보기 워커에서 뺄 파일: main 에 있는 dorm.json 은 연수생 이름 칸이 있어 새 주소로 더 퍼뜨리지 않음(기숙사 화면은 미리보기에서 안 열림)
SKIP_TOP = {'dorm.json'}
# 261029 대장 kv T=hjapp_차트+중요문서: #/docs 중요문서 추출(볼트 스크립트, 메타데이터만) + #/charts 차트 자료
# meta.json steps 키는 공개 JSON 이라 개인정보 검사를 받음: 성씨로 시작하는 3글자 낱말(예: 마지막) 쓰지 말 것
LASTWORK_KEY = '최근 작업 시각'
DOCS_SCRIPT = '/home/box/obsidian_vault/봇공유/99 봇/스크립트/hj_docs_extract.py'
# 261111 춘식이 kv 「협조·사람현황 앱정본」 T4: T2(make_people_roles) → T3(make_people_changes). 기준선 밖 이름·연락처 꼴이면 rc 2 로 멈춤
PEOPLE_CFG = '/home/box/hj-ops/people_roles_inputs.json'
PEOPLE_KEY = '사람현황'


def stamp(t):
    return t.astimezone(KST).strftime('%Y-%m-%d %H:%M')


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw-dir', default='/workspace/hj_audit/calendar')
    ap.add_argument('--worker', default='hj-pv-calendar')
    ap.add_argument('--no-worker', action='store_true')
    ap.add_argument('--people-config', default=PEOPLE_CFG, help='사람현황 입력 json(박스 전용). 없으면 사람 단계 건너뜀(예전 파일 유지)')
    a = ap.parse_args(argv)
    raw_w = os.path.join(a.raw_dir, 'raw_업무.json')
    raw_o = os.path.join(a.raw_dir, 'raw_ojnt.json')
    data = os.path.join(ROOT, 'data')
    now = dt.datetime.now(KST)
    meta_p = os.path.join(data, 'meta.json')
    old = json.load(open(meta_p, encoding='utf-8')) if os.path.exists(meta_p) else {}
    steps, ok = {}, True
    for key, raw, fn in (('현황판', raw_w, lambda: make_calendar.main(['--raw', raw_w, '--today', now.date().isoformat()])),
                         ('OJNT', raw_o, lambda: make_ojnt_progress.main(['--raw', raw_o, '--year', str(now.year)]))):
        if not os.path.exists(raw):
            steps[key] = {'ok': False, 'why': '원자료 없음'}
            ok = False
            continue
        age_h = (now.timestamp() - os.path.getmtime(raw)) / 3600
        try:
            rc = fn()
        except Exception as e:  # 표 모양이 바뀐 경우 등
            rc, why = 1, type(e).__name__
        else:
            why = {0: '', 2: '개인정보 모양 보여 멈춤'}.get(rc, '변환 실패')
        steps[key] = {'ok': rc == 0, 'read_at': stamp(dt.datetime.fromtimestamp(os.path.getmtime(raw), KST)),
                      'old_raw': age_h > 2, 'why': why}
        if rc == 2:
            return finish(meta_p, old, now, steps, False, 2)
        ok = ok and rc == 0
    # 중요문서(#/docs): 원자료 없으면(1) 예전 파일 그대로 두고 표시만, 가림 실패(2)면 멈춤
    if os.path.exists(DOCS_SCRIPT):
        drc = subprocess.run([sys.executable, DOCS_SCRIPT, '--out', os.path.join(data, 'docs_important.json')]).returncode
        steps['중요문서'] = {'ok': drc == 0, 'why': {0: '', 1: '문서대장 원자료 없음(예전 목록 유지)', 2: '이름 가림 실패'}.get(drc, '추출 실패')}
        if drc == 2:
            return finish(meta_p, old, now, steps, False, 2)
    else:
        steps['중요문서'] = {'ok': False, 'why': '추출 스크립트 없음(예전 목록 유지)'}
    try:
        import make_charts
        steps['차트'] = {'ok': make_charts.main() == 0, 'why': ''}
    except Exception as e:
        steps['차트'] = {'ok': False, 'why': type(e).__name__}
    # 261030 대장: 협업 보드 「오래 멈춤」은 실제 마지막 작업 시각으로(일 번호·시각만 씀). 원자료 없으면 예전 파일 유지
    # 261102: meta.json 단계 키는 「최근 작업 시각」. 「마지막」(성씨 마+3글자)을 hjpii 가 이름으로 봐서 rc2 3연속 → 검사는 그대로, 키 낱말을 바꿈
    try:
        import lastwork
        lrc = lastwork.main(['--out', os.path.join(data, 'lastwork.json')])
        steps[LASTWORK_KEY] = {'ok': lrc == 0, 'why': '' if lrc == 0 else '원자료 없음(예전 파일 유지)'}
    except Exception as e:
        steps[LASTWORK_KEY] = {'ok': False, 'why': type(e).__name__}
    prc = people_step(a.people_config, data, steps)
    if prc == 2:
        return finish(meta_p, old, now, steps, False, 2)
    rc = cal_pii_check.main(['--data', data, '--raw', raw_w, raw_o, make_calendar.MASTER_DEFAULT, make_calendar.INGEST_DIR + '/통합일정.json'])
    if rc:
        steps['개인정보 검사'] = {'ok': False, 'why': '실패'}
        return finish(meta_p, old, now, steps, False, 2)
    steps['개인정보 검사'] = {'ok': True}
    # 261023 클로드 검토: 기준선(data/pii_baseline.json) 대비 새 의심·실명이 있으면 종료코드 1 → 커밋·배포 중단
    pb = subprocess.run([sys.executable, os.path.join(ROOT, 'pii_baseline.py')], cwd=ROOT)
    if pb.returncode:
        steps['새 의심 검사'] = {'ok': False, 'why': '새 의심 또는 실명(pii_baseline.py rc=%d)' % pb.returncode}
        finish(meta_p, old, now, steps, False, 1)
        return 1
    steps['새 의심 검사'] = {'ok': True}
    # 261029: 공개 JSON 의 볼트·박스·PC 경로 → 노트 이름만(tools/vaultpath.py). 다른 봇이 쓴 파일도 여기서 한 번 더 걸러짐. 남으면 배포 중단
    import vaultpath
    if vaultpath.main([]):
        steps['볼트 경로 검사'] = {'ok': False, 'why': '공개 JSON 에 경로가 남음(tools/vaultpath.py --check)'}
        finish(meta_p, old, now, steps, False, 1)
        return 1
    steps['볼트 경로 검사'] = {'ok': True}
    finish(meta_p, old, now, steps, ok, 0)
    if a.no_worker:
        return 0 if ok else 1
    tmp = tempfile.mkdtemp(prefix='hjpv-')
    site = os.path.join(tmp, 'site')
    shutil.copytree(ROOT, site, ignore=lambda d, fs: [f for f in fs if f in SKIP or (os.path.samefile(d, ROOT) and f in SKIP_TOP)])
    subprocess.run([sys.executable, BUILD, site, a.worker], check=True)
    shutil.rmtree(tmp)
    worker = '/workspace/hj_audit/preview/%s.js' % a.worker
    # 이 브랜치가 main 과 다르게 만든 파일 + data/ 는 걸리면 실패, main 그대로인 파일은 경고만(따로 보고)
    ch = subprocess.run(['git', '-C', ROOT, 'diff', '--name-only', 'main', '--', '.'], capture_output=True, text=True).stdout.split()
    ch += subprocess.run(['git', '-C', ROOT, 'ls-files', '--others', '--exclude-standard'], capture_output=True, text=True).stdout.split()
    enforce = sorted({'/' + c for c in ch} | {'/data/' + f for f in os.listdir(data)})
    rc = cal_pii_check.main(['--data', data, '--raw', raw_w, raw_o, make_calendar.MASTER_DEFAULT, make_calendar.INGEST_DIR + '/통합일정.json', '--worker', worker, '--enforce'] + enforce)
    if rc:
        os.replace(worker, worker + '.막힘')
        print('워커 파일 개인정보 검사 실패 → %s.막힘 (배포 금지)' % worker)
        return 2
    print('배포할 파일:', worker)
    return 0 if ok else 1


def people_step(cfg, data, steps):
    """T2 → T3. 0 성공 · 2 기준선 밖 이름/개인정보 꼴(멈춤) · 그 밖(입력 없음 3 등)은 예전 파일 유지하고 표시만"""
    if not cfg or not os.path.exists(cfg):
        steps[PEOPLE_KEY] = {'ok': False, 'why': '입력 설정 없음(예전 파일 유지)'}
        return 3
    t2 = subprocess.run([sys.executable, os.path.join(HERE, 'make_people_roles.py'), '--config', cfg,
                         '--out-people', os.path.join(data, 'people_roles.json'), '--out-coop', os.path.join(data, 'coop.json')]).returncode
    if t2:
        steps[PEOPLE_KEY] = {'ok': False, 'why': {2: '기준선 밖 이름 또는 개인정보 꼴(멈춤)', 3: '원자료 없음·보류 입력(예전 파일 유지)'}.get(t2, '생성 실패')}
        return 2 if t2 == 2 else t2
    t3 = subprocess.run([sys.executable, os.path.join(HERE, 'make_people_changes.py'),
                         '--after', os.path.join(data, 'people_roles.json'), '--out', os.path.join(data, 'people_changes.json')]).returncode
    steps[PEOPLE_KEY] = {'ok': t3 == 0, 'why': '' if t3 == 0 else '바뀜 비교 실패(기준판 없음)'}
    return t3


def finish(meta_p, old, now, steps, ok, rc):
    meta = {'version': 1, 'tz': 'Asia/Seoul', 'stale_hours': 24,
            'last_try': stamp(now), 'last_try_ok': ok, 'steps': steps,
            'refreshed_at': stamp(now) if ok else old.get('refreshed_at', ''),
            'refreshed_iso': now.isoformat(timespec='minutes') if ok else old.get('refreshed_iso', '')}
    with open(meta_p, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('meta.json: 마지막 갱신 %s (KST) · 이번 시도 %s' % (meta['refreshed_at'] or '없음', '성공' if ok else '실패'))
    return rc


if __name__ == '__main__':
    sys.exit(main())
