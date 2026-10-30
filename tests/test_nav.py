"""홈·더보기 바로가기 시험: python3 -m unittest tests.test_nav"""
import os, re, unittest
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class Nav(unittest.TestCase):
    """261029 「적용해」: 그래프(#/charts)·중요문서(#/docs) 홈과 더보기에서 바로"""
    def test_home(self):
        h = read('js', 'modules', 'home.js')
        self.assertIn('data-go="#/charts"', h)
        self.assertIn('<b>그래프</b>', h)
        self.assertIn('data-go="#/docs"', h)
        self.assertLess(h.index('id="home-coop"'), h.index('id="home-charts"'))
        self.assertLess(h.index('id="home-charts"'), h.index('id="home-todo"'))

    def test_more(self):
        m = read('js', 'modules', 'more.js')
        self.assertIn("menuBtn('charts', '그래프'", m)
        self.assertIn("menuBtn('docs', '중요문서'", m)
        self.assertIn("id === 'charts' || id === 'docs') api.go('#/' + id)", m)

    def test_docs_stay_network_only(self):
        self.assertIn("var NO_STORE = ['/data/docs_important.json', '/js/modules/docs.js'];", read('sw.js'))
        self.assertIn("var CACHE = 'hj-v74';", read('sw.js'))
