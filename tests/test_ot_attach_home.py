"""홈 버튼·경로·메뉴가 원인행위 붙임으로 이어지는지."""
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding='utf-8') as fh:
        return fh.read()


class T(unittest.TestCase):
    def test_home_button_and_route(self):
        home = read('js', 'modules', 'home.js')
        self.assertIn('원인행위 붙임 만들기', home)
        self.assertIn('data-go="#/ot-attach"', home)
        self.assertIn('id="home-otattach"', home)
        self.assertIn("'ot-attach'", read('js', 'registry.js'))
        self.assertIn("id === 'ot-attach'", read('js', 'app.js'))
        self.assertIn("menuBtn('ot-attach'", read('js', 'modules', 'more.js'))
        self.assertIn('js/otattach-core.js', read('index.html'))
        self.assertIn("ShellModules['ot-attach']", read('js', 'modules', 'ot-attach.js'))
        self.assertGreaterEqual(int(read('sw.js').split("hj-v")[1].split("'")[0]), 44)

    def test_no_secret_or_invented_drive_path(self):
        for rel in ('js/otattach-core.js', 'js/modules/ot-attach.js', 'tools/ot_attach_pack.py'):
            text = read(*rel.split('/'))
            self.assertNotIn('api_key', text.lower(), rel)
            self.assertNotIn('sk-', text, rel)
            self.assertNotRegex(text, r'\b[A-Z]:\\\\', rel)

    def test_official_output_guards_exist(self):
        core = read('js', 'otattach-core.js')
        self.assertIn('만든봇', core)
        self.assertIn('checklistOnly', core)
        self.assertIn('stripJpegMeta', core)
        ui = read('js', 'modules', 'ot-attach.js')
        self.assertIn('원인행위_붙임_원클릭.bat', ui)
        self.assertIn('없는 서류는 빈 종이로 만들지 않아요', ui)


if __name__ == '__main__':
    unittest.main()
