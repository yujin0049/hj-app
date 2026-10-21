"""파일 찾기 화면 시험: 공개 저장소에 F: 경로·file:// 링크·사람 이름 폴더가 없는지, 메뉴·등록이 이어졌는지."""
import os, re, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['js/filefind-core.js', 'js/modules/filefind.js']


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


class T(unittest.TestCase):
    def test_no_paths_or_file_links(self):
        for p in FILES:
            s = read(p)
            self.assertNotRegex(s, r'file:///', p)
            self.assertNotRegex(s, r'\b[CF]:\\\\', p)          # C:\ F:\ 경로 없음 (D:\ 안내 한 줄만 허용)
            self.assertNotIn('Users\\\\', s, p)

    def test_no_names_file(self):
        nf = os.environ.get('HJ_NAMES_FILE')
        if not nf or not os.path.exists(nf):
            self.skipTest('HJ_NAMES_FILE 없음')
        names = [l.strip() for l in open(nf, encoding='utf-8') if l.strip()]
        for p in FILES:
            s = read(p)
            for n in names:
                self.assertNotIn(n, s, p)

    def test_wired(self):
        self.assertIn("'filefind'", read('js/registry.js'))
        self.assertIn("menuBtn('filefind'", read('js/modules/more.js'))
        self.assertIn("id === 'filefind'", read('js/modules/more.js'))
        self.assertIn('js/filefind-core.js', read('index.html'))
        self.assertIn('ShellModules.filefind', read('js/modules/filefind.js'))


if __name__ == '__main__':
    unittest.main()
