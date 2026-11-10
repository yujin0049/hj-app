"""내일 할 일(#/todo) 시험: python3 -m unittest tests.test_todo"""
import json, os, re, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import hjpii
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class Todo(unittest.TestCase):
    def setUp(self):
        self.d = json.loads(read('data', 'todo.json'))

    def test_shape(self):
        # 261110: 목록을 갈아끼움(v02). 제목을 박아 두지 않고 모양만 본다(봇이 json 만 갈아끼워도 시험이 안 깨지게)
        self.assertRegex(self.d['version'], r'^v\d{2}$')
        self.assertRegex(self.d['date'], r'^\d{4}-\d{2}-\d{2}$')
        self.assertTrue(self.d['title'])
        self.assertGreaterEqual(len(self.d['items']), 1)
        ids = [it['id'] for it in self.d['items']]
        self.assertEqual(len(ids), len(set(ids)))
        for it in self.d['items']:
            self.assertIn('id', it)
            self.assertTrue(it['title'])
            self.assertIn('done', it)
            self.assertIsInstance(it['done'], bool)
            self.assertEqual(it.get('who'), 'yujin')

    def test_no_pc_path(self):
        # 261029: 공개 JSON 엔 PC 경로(D:\…) 대신 폴더 이름만(tools/vaultpath.py)
        for it in self.d['items']:
            self.assertNotIn(':\\', it.get('path') or '')
            self.assertNotIn(':\\', it.get('note') or '')

    def test_no_onnara_and_no_mobile(self):
        blob = read('data', 'todo.json') + read('js', 'modules', 'todo.js')
        forbidden = '온' + '나라'  # 신규 파일에 시스템명 금지(코러스만)
        self.assertNotIn(forbidden, blob)
        self.assertIsNone(re.search(r'010[-\s]?\d{3,4}[-\s]?\d{4}', blob))
        for path, text in hjpii.walk_strings(self.d):
            hits = [h for h in hjpii.find_pii(text) if h not in ('이름 의심',)]
            self.assertEqual(hits, [], path)

    def test_hyubogang_not_reflected_before_approval(self):
        # 휴보강은 결재 뒤에만 달력 반영(유진님 261105). 결재 전 건은 할 일에만 있고 달력 자료엔 없다
        self.assertTrue(any('휴보강' in it['title'] and not it['done'] for it in self.d['items']))
        cal = json.loads(read('data', 'calendar.json'))
        for e in cal['events']:
            if e.get('date') == '2026-11-18':
                self.assertNotIn('보강', e.get('title') or '')
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
