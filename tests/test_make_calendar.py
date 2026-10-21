"""make_calendar · make_ojnt_progress · pii_check 시험 (가짜 fixture만 씀). 실행: python3 -m unittest tests/test_make_calendar.py"""
import json, os, shutil, sys, tempfile, unittest, io, contextlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
import make_calendar, make_ojnt_progress, pii_check, hjpii  # noqa: E402
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
                '--ingest', os.path.join(FX, 'ingest') if ingest else '/없음', '--unknown-log', os.path.join(self.out, 'unk.txt')]
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
        # 날짜 다름 → 충돌
        self.assertTrue(any(c['t'] == 'T008' and c['why'].startswith('충돌') for c in cal['checks']))

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
        # 현황판 줄 날짜가 시트와 다름 → 충돌, 대장 conflicts 도 들어옴
        whys = [c['why'] for c in cal['checks'] if c['t'] == 'T008']
        self.assertTrue(any('일정총괄 2026-10-29' in w for w in whys))
        self.assertTrue(any('출처끼리 날짜 다름' in w for w in whys))
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
        # 같은 T번호 할 일은 현황판이 정본 → 날짜 다르면 충돌만
        self.assertTrue(any(c['t'] == 'T002' and '충돌' in c['why'] and '2026-11-09' in c['why'] for c in cal['checks']))
        self.assertTrue(any(c['t'] == 'T002' and '상태 다름' in c['why'] for c in cal['checks']))
        # 시트에 없는 할 일 → others
        self.assertIn('노션 할 일', [o['title'] for o in st['others']])
        self.assertIn('날짜 없는 노션 일', [o['title'] for o in st['others']])
        self.assertTrue(cal['counts']['conflict'] >= 2)


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

    def test_pii_check_all_outputs(self):
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
        rc3, m3 = run(pii_check.main, ['--data', self.out, '--raw', os.path.join(FX, 'raw_업무.json'), oj_raw])
        self.assertEqual(rc3, 0, m3)
        # 일부러 이름을 넣으면 검사 실패(2)
        cal['events'][0]['title'] = '가나다 확인'
        json.dump(cal, open(os.path.join(self.out, 'calendar.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        rc4, m4 = run(pii_check.main, ['--data', self.out, '--raw', os.path.join(FX, 'raw_업무.json'), oj_raw])
        self.assertEqual(rc4, 2, m4)


if __name__ == '__main__':
    unittest.main()
