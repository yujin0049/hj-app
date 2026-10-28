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
        self.assertEqual(self.d['version'], 'v07')
        self.assertEqual(len(self.d['top5']), 5)
        self.assertGreaterEqual(len(self.d['rows']), 20)
        self.assertGreaterEqual(len(self.d['rules']), 5)
        self.assertGreaterEqual(len(self.d['people']), 12)
        self.assertGreaterEqual(len(self.d.get('edu_now') or []), 5)
        self.assertTrue(any('김정임' in (x.get('body') or '') or '7363' in (x.get('body') or '') for x in self.d['edu_now']))
        self.assertTrue(any('이동렬' in (x.get('body') or '') or '7334' in (x.get('body') or '') for x in self.d['edu_now']))
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
        self.assertRegex(read('sw.js'), r"CACHE = 'hj-v\d+'")


    def test_google_ui_and_keywords(self):
        self.assertGreaterEqual(len(self.d.get('keywords') or []), 5)
        self.assertTrue(any(k.get('label') == '강사료' for k in self.d['keywords']))
        self.assertGreaterEqual(len(self.d.get('shortcuts') or []), 3)
        for r in self.d['rows']:
            self.assertIn('tags', r)
            self.assertIn('money', r)
        js = read('js', 'modules', 'coop.js')
        self.assertIn('협조 검색', js)
        self.assertIn('cp-hero', js)
        self.assertIn('min-height:calc(100vh', js)
        self.assertIn('돈처리', js)
        self.assertIn('결재', js)
        self.assertIn('한줄', js)
        self.assertIn('cp-shortcuts', js)
        self.assertIn('해시태그 입력 강제', js)
        self.assertNotIn('instagram', js.lower())
        self.assertIn('who_names', js)  # notice only

    def test_chains_spider(self):
        chains = self.d.get('chains') or []
        self.assertGreaterEqual(len(chains), 1)
        pay = next((c for c in chains if c.get('id') == 'pay'), None)
        self.assertIsNotNone(pay)
        self.assertTrue(any(k == '강사료' for k in pay.get('keywords') or []))
        names = [n.get('name') for n in pay.get('nodes') or []]
        self.assertEqual(names[:3], ['이동렬', '정복희', '김정임'])
        js = read('js', 'modules', 'coop.js')
        self.assertIn('matchChains', js)
        self.assertIn('cp-chain', js)
        self.assertIn('거미줄', js)
        self.assertIn('data-chain-q', js)
        self.assertNotIn('force-directed', js.lower())
        self.assertNotIn('d3.force', js.lower())

    def test_regression_others(self):
        home = read('js', 'modules', 'home.js')
        self.assertIn('data-go="#/haksa"', home)
        self.assertIn('data-go="#/who"', home)
        self.assertIn("'haksa'", read('js', 'registry.js'))
        self.assertIn("'who'", read('js', 'registry.js'))
