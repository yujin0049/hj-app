"""신입 업무 가이드 연결 시험: python3 -m unittest tests.test_office_guide"""
import os, re, unittest
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class OfficeGuide(unittest.TestCase):
    def test_registry_and_nav(self):
        reg = read('js', 'registry.js')
        self.assertIn("'office-guide'", reg)
        nav = read('js', 'intranet-nav.js')
        self.assertIn("['#/office-guide', '신입 업무 가이드']", nav)
        self.assertIn("id === 'banner' || id === 'office-guide' ? 'more'", read('js', 'app.js'))

    def test_module_brand_and_empty(self):
        m = read('js', 'modules', 'office-guide.js')
        c = read('js', 'office-guide-core.js')
        self.assertIn('#4CC3FF', m)
        self.assertIn('Hahmlet', m)
        self.assertIn("var NODATA = '데이터 없음';", c)
        self.assertIn("ShellModules['office-guide']", m)
        self.assertIn('root.print()', m)
        self.assertIn('clipboard.writeText', m)
        self.assertIn('data-og-check', m)
        self.assertNotIn('김OO', c)
        self.assertNotIn('010-', c)

    def test_cache_and_script_versions(self):
        sw = read('sw.js')
        i = read('index.html')
        self.assertIn("var CACHE = 'hj-v96';", sw)
        self.assertIn('js/registry.js?v=37', i)
        self.assertIn('js/app.js?v=54', i)
        self.assertIn('js/intranet-nav.js?v=4', i)
        self.assertIn('./js/app.js?v=54', sw)
        self.assertIn('./js/intranet-nav.js?v=4', sw)

if __name__ == '__main__':
    unittest.main()
