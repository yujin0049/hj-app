"""261030 협조 검색 graphify 후보 연결(data/coop_graphify.json) 모양·안전 검사."""
import json, os, re, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


class CoopGraphify(unittest.TestCase):
    def setUp(self):
        self.d = json.loads(read('data/coop_graphify.json'))

    def test_shape(self):
        self.assertEqual(self.d['cols'], ['who', 'dept', 'n', 'home', 'words'])
        self.assertTrue(self.d['rows'])
        for r in self.d['rows']:
            self.assertEqual(len(r), 5)
            self.assertGreaterEqual(r[2], 2)  # 근거 문서 2건 이상
            self.assertNotEqual(r[1], r[3])  # 자기 부서 연결 아님

    def test_no_contact_or_id(self):
        s = read('data/coop_graphify.json')
        self.assertIsNone(re.search(r'\d{2,3}-\d{3,4}-\d{4}', s))
        self.assertIsNone(re.search(r'[\w.+-]+@[\w-]+\.\w+', s))
        self.assertIsNone(re.search(r'\d{6}-?[1-4]\d{6}', s))

    def test_only_names_already_public(self):
        pub = read('data/coop.json') + read('data/people_roles.json') + read('data/dept_spider.json')
        for r in self.d['rows']:
            self.assertIn(r[0], pub)

    def test_lazy_loaded(self):
        js = read('js/modules/coop.js')
        self.assertIn('data/coop_graphify.json', js)
        self.assertNotIn('coop_graphify', read('sw.js'))
        self.assertNotIn('coop_graphify', read('index.html'))
        self.assertLess(len(read('data/coop_graphify.json').encode('utf-8')), 80000)


if __name__ == '__main__':
    unittest.main()
