"""원큐 협조리스트(#/coop) 시험: python3 -m unittest tests.test_coop"""
import json, os, re, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import hjpii
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class Coop(unittest.TestCase):
    def setUp(self):
        self.d = json.loads(read('data', 'coop.json'))

    def test_shape(self):
        self.assertEqual(self.d['version'], 'v01')
        self.assertEqual(len(self.d['top5']), 5)
        self.assertGreaterEqual(len(self.d['rows']), 20)
        self.assertEqual(len(self.d['rules']), 5)
        self.assertEqual(len(self.d['people']), 12)
        self.assertTrue(any('경로' in p['item'] for p in self.d['leave_paths']))
        for r in self.d['rows']:
            for k in ('work', 'status', 'dept', 'phone', 'who', 'line', 'note'):
                self.assertIn(k, r)

    def test_no_mobile_or_server_save(self):
        s = read('data', 'coop.json') + read('js', 'modules', 'coop.js')
        self.assertIsNone(re.search(r'010[-\s]?\d{3,4}[-\s]?\d{4}', s))
        js = read('js', 'modules', 'coop.js')
        self.assertNotIn('localStorage.setItem', js)
        self.assertNotIn('localStorage.getItem', js)
        self.assertNotIn('navigator.sendBeacon', js)
        self.assertNotIn('mailto:', js)
        self.assertNotIn('fetch(', js.replace("fetch(new URL('data/coop.json'", 'LOADJSON('))
        # 휴대전화·주민·이메일만 거름(성명·내선은 업무용 허용)
        for path, text in hjpii.walk_strings(self.d):
            hits = [h for h in hjpii.find_pii(text) if h not in ('이름 의심',)]
            self.assertEqual(hits, [], path)

    def test_wired(self):
        self.assertIn("'coop'", read('js', 'registry.js'))
        self.assertIn('data-go="#/coop"', read('js', 'modules', 'home.js'))
        self.assertIn("menuBtn('coop'", read('js', 'modules', 'more.js'))
        self.assertIn("id === 'coop'", read('js', 'app.js'))
        self.assertIn('ShellModules.coop', read('js', 'modules', 'coop.js'))
        self.assertIn('hj-v46', read('sw.js'))

    def test_regression_others(self):
        home = read('js', 'modules', 'home.js')
        self.assertIn('data-go="#/haksa"', home)
        self.assertIn('data-go="#/who"', home)
        self.assertIn("'haksa'", read('js', 'registry.js'))
        self.assertIn("'who'", read('js', 'registry.js'))
