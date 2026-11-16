"""신입 업무 가이드 연결 시험: python3 -m unittest tests.test_office_guide"""
import os, re, unittest
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class OfficeGuide(unittest.TestCase):
    def test_registry_and_nav(self):
        reg = read('js', 'registry.js')
        self.assertIn("id: 'office-guide'", reg)
        self.assertIn("name: '신입 업무 가이드'", reg)
        self.assertIn("href: '#/office-guide'", reg)
        self.assertIn('HJNav.sideGroups', read('js', 'intranet-nav.js'))
        self.assertIn('HJNav.tabOf', read('js', 'app.js'))
        self.assertIn("tabOf: 'more'", reg)

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
        self.assertIn("var CACHE = 'hj-v98';", sw)
        self.assertIn('js/registry.js?v=38', i)
        self.assertIn('js/app.js?v=56', i)
        self.assertIn('js/intranet-nav.js?v=5', i)
        self.assertIn('./js/app.js?v=56', sw)
        self.assertIn('./js/intranet-nav.js?v=5', sw)

    def test_print_ink_and_breaks(self):
        m = read('js', 'modules', 'office-guide.js')
        self.assertIn('#hj-stamp', m)
        self.assertIn('.og,.og *{color:#111 !important', m)
        self.assertIn('.og-page{border:1px solid #ccc;break-inside:auto;page-break-inside:auto}', m)
        self.assertNotIn('.og-page{border:1px solid #ccc;box-shadow:none;break-inside:avoid', m)
        c = read('js', 'office-guide-core.js')
        self.assertIn("{ t: 'checks', from: 0, to: 5 }", c)
        self.assertIn("{ t: 'checks', from: 5, to: 10 }", c)
        self.assertIn('function checklistSlice', c)
        self.assertIn('js/office-guide-core.js?v=2', m)
        self.assertIn('.og-keep{break-inside:avoid;page-break-inside:avoid}', m)
        self.assertIn('.og-lab{color:#000 !important;break-after:avoid', m)
        self.assertIn('class="og-keep">\' + lab + checksHtml', m)

if __name__ == '__main__':

    unittest.main()
