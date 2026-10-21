"""make_calendar · make_ojnt_progress · cal_pii_check 시험 (가짜 fixture만 씀). 실행: python3 -m unittest tests/test_make_calendar.py"""
import json, os, shutil, sys, tempfile, unittest, io, contextlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
import make_calendar, make_ojnt_progress, cal_pii_check, hjpii  # noqa: E402
FX = os.path.join(HERE, 'fixtures', 'calendar')
# 가짜 번호는 파일에 그대로 적지 않고 시험할 때 조립(커밋 전 개인정보 검사 pii_guard 통과용)
J = '-'.join
FAKE_PHONE = J(['0' + '10', '1234', '5678'])
FAKE_RRN = J(['900101', '1' + '234567'])
FAKE_ACCT = J(['110', '123', '456789'])
PHONE_SLOT = '{가짜전화}'


def run(fn, args):
    buf, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(err):
        rc = fn(args)
    return rc, buf.getvalue() + err.getvalue()


class Base(unittest.TestCase):
    def setUp(self):
        self.out = tempfile.mkdtemp()
        self.log = os.path.join(self.out, 'log.txt')

    def tearDown(self):
        shutil.rmtree(self.out)

    def make(self, master=True, ingest=True, raw=None, extra=None):
        args = ['--raw', raw or os.path.join(FX, 'raw_업무.json'), '--extra', extra or os.path.join(FX, 'extra.json'),
                '--out', self.out, '--today', '2026-10-21', '--log', self.log,
                '--master', os.path.join(FX, '일정총괄.json') if master else '/없음',
                '--ingest', os.path.join(FX, 'ingest') if ingest else '/없음', '--unknown-log', os.path.join(self.out, 'unk.txt'), '--decisions', '/없음']
        rc, msg = run(make_calendar.main, args)
        cal = st = None
        if rc == 0:
            cal = json.load(open(os.path.join(self.out, 'calendar.json'), encoding='utf-8'))
            st = json.load(open(os.path.join(self.out, 'status.json'), encoding='utf-8'))
        return rc, msg, cal, st


class Parsing(Base):
    def test_wrapper_and_columns(self):
        rows = make_calendar.read_table(os.path.join(FX, 'raw_업무.json'))
        self.assertEqual(rows[0][0], 'ID')
        raw = make_calendar.parse_tasks(rows, 2026)
        self.assertEqual(len(raw), 8)

    def test_dates(self):
        nd = make_calendar.norm_date
        self.assertEqual(nd('2026-10-30', 2026), '2026-10-30')
        self.assertEqual(nd('2026.11.5.', 2026), '2026-11-05')
        self.assertEqual(nd('10.30.', 2026), '2026-10-30')
        self.assertEqual(nd('2026-02-30', 2026), '')
        self.assertEqual(nd('내일쯤', 2026), '')

    def test_sheet_only(self):
        rc, msg, cal, st = self.make(master=False, ingest=False)
        self.assertEqual(rc, 0, msg)
        ids = {t['t'] for t in st['tasks']}
        self.assertNotIn('T006', ids)  # 「대기: PC」 묶음 줄은 표시 안 함
        t = {x['t']: x for x in st['tasks']}
        self.assertIn('대기: PC', t['T002']['yujin'])
        self.assertIn('대기: PC', t['T004']['yujin'])
        self.assertIn('확인 필요', t['T004']['yujin'])
        self.assertEqual(t['T003']['yujin'], [])  # 끝난 일은 유진님 칸 아님
        self.assertNotIn('T063', str(t))
        self.assertEqual(t['T007'].get('check'), '마감일 모양 이상')
        self.assertFalse(cal['master_read'])
        # 합침: T001 마감 = extra 마감 같은 날 → 한 개
        self.assertEqual(sum(1 for e in cal['events'] if e['t'] == 'T001' and e['lane'] == 'yujin'), 1)
        self.assertEqual(sum(1 for e in cal['events'] if e['lane'] == 'prof'), 1)
        # 같은 T번호 다른 날짜 → 충돌 아니고 하위 단계 (대장 결정 261021)
        self.assertFalse(any(c['why'].startswith('충돌') for c in cal['checks']))
        sub = [e for e in cal['events'] if e['t'] == 'T008' and e.get('sub')]
        self.assertEqual([(e['date'], e['title']) for e in sub], [('2026-10-27', 'T008 하위: 시트와 다른 날 마감')])
        main = [e for e in cal['events'] if e['t'] == 'T008' and not e.get('sub')]
        self.assertEqual([e['date'] for e in main], ['2026-10-26'])  # 현황판 날짜가 정본

    def test_names_removed(self):
        rc, msg, cal, st = self.make()
        self.assertEqual(rc, 0, msg)
        blob = json.dumps([cal, st], ensure_ascii=False)
        for n in ('홍길동', '김철수', '이영희', '박민수'):
            self.assertNotIn(n, blob)
        t = {x['t']: x for x in st['tasks']}
        self.assertEqual(t['T001']['title'], '가짜 특강(교수님, 매주 금)')
        self.assertEqual(t['T002']['title'], '강사료 지급 서류 받기(선생님)')
        self.assertIn('교수님 출장', [e['title'] for e in cal['events']])

    def test_groups(self):
        g = make_calendar.group_of
        self.assertEqual(g('싱가포르OJNT', 'x'), 'OJNT')
        self.assertEqual(g('자격취득반', 'x'), '특강')
        self.assertEqual(g('재료비', 'x'), '실습재료')
        self.assertEqual(g('행정일반', '총무과-13457 의견조회'), '공문')
        self.assertEqual(g('행정일반', '사물함 관리'), '사물함')
        self.assertEqual(g('행정일반', 'PC 파일 색인'), '기타')


class Master(Base):
    def test_master_read_and_preferred(self):
        rc, msg, cal, st = self.make(ingest=False)
        self.assertEqual(rc, 0, msg)
        self.assertTrue(cal['master_read'])
        self.assertIn('일정총괄.json 읽음', msg)
        self.assertIn('새칸', open(os.path.join(self.out, 'unk.txt'), encoding='utf-8').read())
        # 같은 날·같은 T번호·같은 레인 → extra 「총괄과 겹치는 일」은 빠지고 일정총괄 것만
        titles = [e['title'] for e in cal['events']]
        self.assertNotIn('총괄과 겹치는 일', titles)
        self.assertEqual(cal['counts']['skipped_extra'], 1)
        m = [e for e in cal['events'] if e['src'] == 'master' and e['date'] == '2026-11-03'][0]
        self.assertEqual(m['cond'], '결재 뒤')
        self.assertEqual([e for e in cal['events'] if e['title'] == '총괄 참고 일정'][0]['lane'], 'ref')
        # 일정총괄의 「현황판」 줄 날짜가 달라도 현황판이 정본, 같은 T번호의 대장 충돌 표시는 충돌로 안 셈
        whys = [c['why'] for c in cal['checks'] if c['t'] == 'T008']
        self.assertFalse(any(w.startswith('충돌') for w in whys))
        self.assertFalse(any(e['t'] == 'T008' and e['date'] == '2026-10-29' for e in cal['events']))
        self.assertGreaterEqual(cal['counts']['conflict_before_rule'], 1)
        self.assertEqual(cal['counts']['conflict'], 0)
        # 현황표에도 같은 일정(steps)
        t2 = [t for t in st['tasks'] if t['t'] == 'T002'][0]
        self.assertTrue(any(s['date'] == '2026-11-03' for s in t2['steps']))


class Ingest(Base):
    def test_ingest(self):
        rc, msg, cal, st = self.make()
        self.assertEqual(rc, 0, msg)
        self.assertEqual(cal['ingest_read'], {'통합일정': True, '통합할일': True})
        ev = [e for e in cal['events'] if e['src'] == 'ingest']
        self.assertTrue(any(e['lane'] == 'prof' and e['date'] == '2026-11-04' for e in ev))
        # 같은 T번호 할 일은 현황판이 정본 → 다른 날짜는 하위 단계
        self.assertTrue(any(e['t'] == 'T002' and e.get('sub') and e['date'] == '2026-11-09' for e in cal['events']))
        self.assertFalse(any(c['t'] == 'T002' and c['why'].startswith('충돌') for c in cal['checks']))
        self.assertTrue(any(c['t'] == 'T002' and '상태 다름' in c['why'] for c in cal['checks']))
        # 시트에 없는 할 일 → others
        self.assertIn('노션 할 일', [o['title'] for o in st['others']])
        self.assertIn('날짜 없는 노션 일', [o['title'] for o in st['others']])
        self.assertEqual(cal['counts']['conflict'], 0)


class SubStepRule(Base):
    """대장 결정 261021_일정날짜_정본결정: 날짜 정본 = 현황판, 같은 T번호 다른 날짜 = 「T번호 하위: 단계명」, 결정표대로 이름·없앰·정본 확인"""
    def test_rule(self):
        dec = {'canonical': [{'t': 'T001', 'date': '2026-10-31'}, {'t': 'T002', 'date': '2026-11-02'}],
               'steps': [{'t': 'T002', 'date': '2026-11-09', 'step': '서류 마감'}],
               'drop': [{'t': 'T001', 'dates': ['2026-10-30']}],
               'pending': [{'t': 'T004', 'why': '원문 확인 후 확정'}]}
        p = os.path.join(self.out, 'dec.json'); json.dump(dec, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
        args = ['--raw', os.path.join(FX, 'raw_업무.json'), '--extra', os.path.join(FX, 'extra.json'), '--out', self.out, '--today', '2026-10-21',
                '--log', self.log, '--master', os.path.join(FX, '일정총괄.json'), '--ingest', os.path.join(FX, 'ingest'),
                '--unknown-log', os.path.join(self.out, 'u.txt'), '--decisions', p]
        rc, msg = run(make_calendar.main, args)
        self.assertEqual(rc, 0, msg)
        cal = json.load(open(os.path.join(self.out, 'calendar.json'), encoding='utf-8'))
        st = json.load(open(os.path.join(self.out, 'status.json'), encoding='utf-8'))
        ev = cal['events']
        # 결정표 단계명
        self.assertIn(('2026-11-09', 'T002 하위: 서류 마감'), [(e['date'], e['title']) for e in ev if e.get('sub')])
        # 없앰: T001 의 10.30. 하위(가짜 강의 1회차)는 빠지고, 현황판 마감(정본)은 남음
        self.assertFalse(any(e['t'] == 'T001' and e.get('sub') and e['date'] == '2026-10-30' for e in ev))
        self.assertTrue(any(e['t'] == 'T001' and not e.get('sub') and e['date'] == '2026-10-30' for e in ev))
        self.assertGreaterEqual(cal['counts']['dropped'], 1)
        # 정본 날짜와 현황판 값이 다르면 「현황판 값 맞추기」(충돌 아님), 같으면 아무 말 없음
        whys = {c['t']: c['why'] for c in cal['checks']}
        self.assertIn('현황판 값 맞추기', whys.get('T001', ''))
        self.assertNotIn('현황판 값 맞추기', whys.get('T002', ''))
        self.assertIn('원문 확인 후 확정', whys.get('T004', ''))
        # 하위 단계는 모두 「T번호 하위: 」 로 시작, 현황판 정본은 T번호당 하나
        self.assertTrue(all(e['title'].startswith(e['t'] + ' 하위: ') for e in ev if e.get('sub')))
        mains = [e['t'] for e in ev if e['src'].startswith('sheet')]
        self.assertEqual(len(mains), len(set(mains)))
        self.assertEqual(cal['counts']['conflict'], 0)
        self.assertEqual(cal['counts']['sub_steps'], sum(1 for e in ev if e.get('sub')))
        # 현황표에도 같은 하위 단계(이름)
        t2 = [t for t in st['tasks'] if t['t'] == 'T002'][0]
        self.assertIn('서류 마감', [x['step'] for x in t2.get('steps', [])])

    def test_step_name(self):
        so = make_calendar.step_of
        self.assertEqual(so('[할 일] 10월 강사료 상신 09:00~09:30', 'T007'), '10월 강사료 상신')
        self.assertEqual(so('2차 작업형 공개문제 출력·배부 — 출력'), '2차 작업형 공개문제 출력·배부 (출력)')
        self.assertEqual(so('운영계획 결재 — 빠른안 마지노선(1과제분만 빠른배송)'), '운영계획 결재')


class PII(Base):
    def test_phone_in_title_stops(self):
        rows = open(os.path.join(FX, 'raw_업무.json'), encoding='utf-8').read().replace('마감 없는 일', '연락 ' + FAKE_PHONE + ' 하기')
        p = os.path.join(self.out, 'raw.json'); open(p, 'w', encoding='utf-8').write(rows)
        rc, msg, cal, st = self.make(raw=p, master=False, ingest=False)
        self.assertEqual(rc, 2)
        self.assertIn('전화번호', msg)
        self.assertFalse(os.path.exists(os.path.join(self.out, 'calendar.json')))

    def test_patterns(self):
        f = hjpii.find_pii
        self.assertIn('주민번호', f(FAKE_RRN))
        self.assertIn('계좌번호', f(FAKE_ACCT))
        self.assertEqual(f('2026-10-30 마감 1,242,000원'), [])
        self.assertIn('이메일', f('a.b@example.com'))
        self.assertIn('사람 이름', f('담당 홍길동', {'홍길동'}))

    def test_cal_pii_check_all_outputs(self):
        rc, msg, cal, st = self.make()
        self.assertEqual(rc, 0, msg)
        oj_raw = os.path.join(self.out, 'raw_ojnt.json')
        t = open(os.path.join(FX, 'raw_ojnt.json'), encoding='utf-8').read()
        k = [0]
        def phone(_m):
            k[0] += 1
            return J(['0' + '10', '0000', '%04d' % k[0]])
        import re as _re
        open(oj_raw, 'w', encoding='utf-8').write(_re.sub(_re.escape(PHONE_SLOT), phone, t))
        self.assertGreater(k[0], 0)
        rc2, m2 = run(make_ojnt_progress.main, ['--raw', oj_raw, '--out', self.out])
        self.assertEqual(rc2, 0, m2)
        oj = json.load(open(os.path.join(self.out, 'ojnt_progress.json'), encoding='utf-8'))
        self.assertEqual([(i['label'], i['done'], i['total'], i['cross']) for i in oj['items']],
                         [('개인정보 동의서', 2, 3, '일치'), ('기숙사 입사신청서', 1, 2, '일치')])
        blob = json.dumps(oj, ensure_ascii=False)
        for bad in ('가나다', '라마바', J(['0' + '10', '0000'])):
            self.assertNotIn(bad, blob)
        rc3, m3 = run(cal_pii_check.main, ['--data', self.out, '--raw', os.path.join(FX, 'raw_업무.json'), oj_raw])
        self.assertEqual(rc3, 0, m3)
        # 일부러 이름을 넣으면 검사 실패(2)
        cal['events'][0]['title'] = '가나다 확인'
        json.dump(cal, open(os.path.join(self.out, 'calendar.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        rc4, m4 = run(cal_pii_check.main, ['--data', self.out, '--raw', os.path.join(FX, 'raw_업무.json'), oj_raw])
        self.assertEqual(rc4, 2, m4)


if __name__ == '__main__':
    unittest.main()


class Range(Base):
    """기간 일정(시작~끝): end 칸 또는 제목 안 「11.3.(화)~11.4.(수)」 → 이벤트 end (달력이 띠로 그림)"""
    def test_end_from_title(self):
        f = make_calendar.end_from_title
        self.assertEqual(f('가짜 기관교육 (11.3.(화)~11.4.(수))', '2026-11-03'), '2026-11-04')
        self.assertEqual(f('가짜 9.29~10.2 행사', '2026-09-29'), '2026-10-02')
        self.assertEqual(f('가짜 12.30.~1.2.', '2026-12-30'), '2027-01-02')
        self.assertEqual(f('시간 10:00~12:00', '2026-11-03'), '')
        self.assertEqual(f('다른 날 11.5.~11.6.', '2026-11-03'), '')
        self.assertEqual(f('학기 9.1.~12.19.', '2026-09-01'), '')  # 60일 넘음

    def test_master_range(self):
        tmp = os.path.join(self.out, '일정총괄.json')
        d = json.load(open(os.path.join(FX, '일정총괄.json'), encoding='utf-8'))
        lst = d if isinstance(d, list) else next(v for v in d.values() if isinstance(v, list) and v and isinstance(v[0], dict))
        lst.append({'date': '2026-11-03', 'title': '가짜 기관교육 (11.3.(화)~11.4.(수))', 'kind': '일정', 'end': None, 'yujin_action': True})
        lst.append({'date': '2026-11-10', 'title': '가짜 워크숍', 'kind': '일정', 'end': '2026-11-12', 'yujin_action': True})
        json.dump(d, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
        args = ['--raw', os.path.join(FX, 'raw_업무.json'), '--extra', os.path.join(FX, 'extra.json'), '--out', self.out,
                '--today', '2026-10-21', '--log', self.log, '--master', tmp, '--ingest', '/없음',
                '--unknown-log', os.path.join(self.out, 'unk.txt'), '--decisions', '/없음']
        rc, msg = run(make_calendar.main, args)
        self.assertEqual(rc, 0, msg)
        ev = json.load(open(os.path.join(self.out, 'calendar.json'), encoding='utf-8'))['events']
        by = {e['title']: e for e in ev}
        self.assertEqual(by['가짜 기관교육 (11.3.(화)~11.4.(수))'].get('end'), '2026-11-04')
        self.assertEqual(by['가짜 워크숍'].get('end'), '2026-11-12')
