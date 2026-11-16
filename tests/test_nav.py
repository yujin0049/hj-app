"""홈·더보기 바로가기 시험: python3 -m unittest tests.test_nav"""
import os, re, unittest
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class Nav(unittest.TestCase):
    """261029 「적용해」: 그래프(#/charts)·중요문서(#/docs) 홈과 더보기에서 바로"""
    def test_home(self):
        # 홈은 오늘 할 일 한 장. 그래프·중요문서는 메뉴 레지스트리(더보기·바로가기)에서 연다.
        r = read('js', 'registry.js')
        self.assertIn("id: 'charts'", r)
        self.assertIn("name: '그래프'", r)
        self.assertIn("id: 'docs'", r)
        self.assertIn("name: '중요문서'", r)
        self.assertIn('homeShortcut: true', r)
        h = read('js', 'modules', 'home.js')
        self.assertIn('id="home-today"', h)
        self.assertIn('data-go="#/todo"', h)

    def test_more(self):
        m = read('js', 'modules', 'more.js')
        r = read('js', 'registry.js')
        self.assertIn('HJNav.moreGroups', m)
        self.assertIn('menuBtn(it.id, it.name', m)
        self.assertIn("id: 'charts'", r)
        self.assertIn("id: 'docs'", r)
        self.assertIn("id: 'office-guide'", r)
        self.assertIn("name: '신입 업무 가이드'", r)
        self.assertIn('HJNav.byId', m)

    def test_docs_stay_network_only(self):
        self.assertIn("var NO_STORE = ['/data/docs_important.json', '/js/modules/docs.js'];", read('sw.js'))
        self.assertIn("var CACHE = 'hj-v99';", read('sw.js'))
