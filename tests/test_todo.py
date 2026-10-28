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
    'OJNT 기숙사 입사·장단기 12명 생활관 제출',
    '휴보강(미완시)',
    'T081 국토부 1431·1285·627·772 본문 PC',
    'T018 강의실·실습실·명단 확인',
    'T054 회신·출석부 이미지 OK',
]

class Todo(unittest.TestCase):
    def setUp(self):
        self.d = json.loads(read('data', 'todo.json'))

    def test_shape(self):
        self.assertEqual(self.d['version'], 'v01')
        self.assertEqual(self.d['date'], '2026-10-28')
        self.assertEqual(self.d['title'], '내일 할 일')
        self.assertEqual(len(self.d['items']), 6)
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
        self.assertIn('코러스', self.d['items'][3].get('note') or '')

    def test_no_onnara_and_no_mobile(self):
        blob = read('data', 'todo.json') + read('js', 'modules', 'todo.js')
        forbidden = '온' + '나라'  # 신규 파일에 시스템명 금지(코러스만)
        self.assertNotIn(forbidden, blob)
        self.assertIsNone(re.search(r'010[-\s]?\d{3,4}[-\s]?\d{4}', blob))
        for path, text in hjpii.walk_strings(self.d):
            hits = [h for h in hjpii.find_pii(text) if h not in ('이름 의심',)]
            self.assertEqual(hits, [], path)

    def test_t2_done_and_t6_click(self):
        by = {it['id']: it for it in self.d['items']}
        self.assertTrue(by['t2']['done'])
        self.assertIn('클릭만', by['t6'].get('note') or '')
        self.assertEqual(by['t6'].get('who'), 'yujin')
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
