"""내일 할 일(#/todo) 시험: python3 -m unittest tests.test_todo"""
import json, os, re, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import hjpii
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

SEED_TITLES = [
    '코러스 문서대장 뽑기',
    '휴보강(미완시)',
    'T081 국토부 1431·1285·627·772 본문 PC',
    'T018 강의실·실습실·명단 확인',
    'T054 회신·출석부 이미지 OK',
    'T017 강사 서류 받아 글로컬센터 제출',
    'T018 2차 작업형 공개문제 출력(10.30 배부)',
    'T018 입고·검수(납품서·검수조서)',
    'T020 실습재료 납품·검수 → 지출결의',
    'T065 OJNT 실거주 확인서 도장·제출',
    'T017 [자격취득반] 운영계획 결재·개강 전 서류·성범죄 경력조회 확인',
    'T020 재료폴더 서류 정리',
    'T020 검수자료 D 드라이브 저장',
    'OJNT 입사자현황 16명 — 사본 탭이 정본',
    'OJNT 입사신청 공문 + 16부',
    '세종정부청사 출장 11.2.~11.3.',
    '전문교육기관 지정 변경신청 10.30.',
    '훈련운영기준·교육규정 수정·변경신청 11.6.',
    'KAA 사전가입(11.2. 출장 전)',
    'T018 산업기사 특강 10.30.~11.27.',
    '부서보고',
]

class Todo(unittest.TestCase):
    def setUp(self):
        self.d = json.loads(read('data', 'todo.json'))

    def test_shape(self):
        self.assertEqual(self.d['version'], 'v01')
        self.assertEqual(self.d['date'], '2026-10-29')
        self.assertEqual(self.d['title'], '내일 할 일')
        self.assertEqual(len(self.d['items']), 21)
        for it in self.d['items']:
            self.assertIn('id', it)
            self.assertIn('title', it)
            self.assertIn('done', it)
            self.assertIsInstance(it['done'], bool)

    def test_seed_titles(self):
        titles = [it['title'] for it in self.d['items']]
        self.assertEqual(titles, SEED_TITLES)
        p = self.d['items'][0].get('path') or ''
        self.assertTrue(p.startswith('D:'))
        self.assertIn('문서등록대장_코러스뽑기_대기', p)
        self.assertIn('11_업무기타', p)
        self.assertIn('코러스', self.d['items'][0]['title'])
        self.assertIn('코러스', self.d['items'][2].get('note') or '')

    def test_no_onnara_and_no_mobile(self):
        blob = read('data', 'todo.json') + read('js', 'modules', 'todo.js')
        forbidden = '온' + '나라'  # 신규 파일에 시스템명 금지(코러스만)
        self.assertNotIn(forbidden, blob)
        self.assertIsNone(re.search(r'010[-\s]?\d{3,4}[-\s]?\d{4}', blob))
        for path, text in hjpii.walk_strings(self.d):
            hits = [h for h in hjpii.find_pii(text) if h not in ('이름 의심',)]
            self.assertEqual(hits, [], path)

    def test_carryover_and_t065(self):
        by = {it['id']: it for it in self.d['items']}
        done = {it['id'] for it in self.d['items'] if it['done']}
        self.assertEqual(done, {'t10', 't12', 't13', 't14', 't15'})
        self.assertIsNone(by['t15'].get('status'))
        self.assertIn('코러스', by['t16'].get('note') or '')
        self.assertIn('❍ 4줄', by['t21'].get('note') or '')
        self.assertIn('용호기공 6종', by['t9'].get('note') or '')
        self.assertIn('클릭만', by['t5'].get('note') or '')
        self.assertEqual(by['t5'].get('who'), 'yujin')
        self.assertIn('T065', by['t10']['title'])
        self.assertIn('10.30', by['t10'].get('note') or '')
        self.assertIn('봇큐=', self.d.get('note') or '')
        self.assertNotIn('온'+'나라', json.dumps(self.d, ensure_ascii=False))

    def test_wired(self):
        self.assertIn("'todo'", read('js', 'registry.js'))
        self.assertIn('data-go="#/todo"', read('js', 'modules', 'home.js'))
        self.assertIn("menuBtn('todo'", read('js', 'modules', 'more.js'))
        self.assertIn("id === 'todo'", read('js', 'app.js'))
        self.assertIn('tomorrow', read('js', 'app.js'))
        self.assertIn('ShellModules.todo', read('js', 'modules', 'todo.js'))
        self.assertRegex(read('sw.js'), r"CACHE = 'hj-v\d+'")
        self.assertIn('data/todo.json', read('js', 'modules', 'todo.js'))
        self.assertNotIn('instagram', read('js', 'modules', 'todo.js').lower())
        self.assertNotIn('cp-hero', read('js', 'modules', 'todo.js'))

if __name__ == '__main__':
    unittest.main()
