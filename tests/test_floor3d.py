"""층별 3D 도면(#/floor3d) 시험: python3 -m unittest tests.test_floor3d"""
import os, re, unittest
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class Floor3D(unittest.TestCase):
    def test_more_button_last(self):
        m = read('js', 'modules', 'more.js')
        btns = re.findall(r"menuBtn\('([^']+)'", m)
        self.assertEqual(btns[-1], 'floor3d')
        self.assertEqual(btns.count('floor3d'), 1)
        self.assertIn("else if (id === 'floor3d') api.go('#/floor3d');", m)
        self.assertIn('ShellModules.floor3d', m)

    def test_lazy_not_on_home(self):
        self.assertNotIn('floor3d', read('index.html'))
        self.assertNotIn('three', read('index.html'))
        self.assertNotIn('floor3d', read('js', 'registry.js'))
        self.assertIn("js/floor3d.js?v=", read('js', 'modules', 'more.js'))

    def test_viewer_rules(self):
        f = read('js', 'floor3d.js')
        self.assertIn("import(url('3d/assets/vendor/three.module.min.js'))", f)
        self.assertIn("3d/assets/building.json", f)
        self.assertIn('prefers-reduced-motion: reduce', f)
        self.assertIn('var spin = !reduce;', f)
        self.assertRegex(f, r'setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 1\.75\)\)')
        self.assertIn('renderer.dispose()', f)
        self.assertIn("visibilitychange", f)
        self.assertIn("aria-pressed", f)
        lic = read('3d', 'assets', 'vendor', 'three-LICENSE.txt')
        self.assertIn('MIT License', lic)

if __name__ == '__main__':
    unittest.main()
