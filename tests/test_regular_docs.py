"""정례 문서 달력(#/regular-docs) 시험. 실행: python -m unittest tests/test_regular_docs.py -v
- data/regular_docs.json 모양, 볼트 xlsx 에서 다시 만들면 똑같은지(xlsx 없으면 건너뜀)
- 공개 사이트라 사람 이름 꼴이 없는지, 홈·더보기·목록에 연결됐는지
- 크롬으로 실제 앱을 열어 격자·분류 고르기·달 목록이 그려지는지"""
import importlib.util, json, os, re, tempfile, unittest
from tests.test_reg_docs import CHROME, chrome, serve

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
JS = os.path.join(ROOT, 'data', 'regular_docs.json')
with open(JS, encoding='utf-8') as f:
    RD = json.load(f)
spec = importlib.util.spec_from_file_location('mrd', os.path.join(ROOT, 'tools', 'make_regular_docs.py'))
MRD = importlib.util.module_from_spec(spec)
spec.loader.exec_module(MRD)


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


class T자료(unittest.TestCase):
    def test_shape(self):
        self.assertEqual(RD['months'], [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2])
        self.assertEqual(len(RD['docs']), 56)
        self.assertEqual(len(RD['cats']), 10)
        for d in RD['docs']:
            self.assertEqual(set(d), {'cat', 'name', 'cycle', 'n', 'marks'})
            self.assertIn(d['cat'], RD['cats'])
            self.assertTrue(set(d['marks'].values()) <= {'●', '○'})
            self.assertEqual(sum(1 for v in d['marks'].values() if v == '●'), d['n'], d['name'])   # 횟수 = ● 칸 수
        # 월별 목록 시트 234줄(머리 빼고) = ● 194 + ○ 40
        allm = [v for d in RD['docs'] for v in d['marks'].values()]
        self.assertEqual((allm.count('●'), allm.count('○')), (194, 40))

    def test_no_person_names(self):
        t = read('data/regular_docs.json')
        self.assertNotRegex(t, MRD.NAME_RE)
        self.assertNotRegex(t, r'01[016789]-?\d{3,4}-?\d{4}')
        self.assertIn('○○○ 의원실', t)   # 원본에서 이미 가린 것 그대로

    @unittest.skipUnless(os.path.isfile(MRD.SRC), '볼트 원본 xlsx 없음')
    def test_rebuild_same(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, 'r.json')
            MRD.main(['x', MRD.SRC, out])
            with open(out, encoding='utf-8') as f:
                self.assertEqual(json.load(f), RD)

    def test_wired(self):
        self.assertIn("'regular-docs'", read('js/registry.js'))
        self.assertIn('js/regular-docs-core.js', read('index.html'))
        self.assertIn('data-go="#/regular-docs"', read('js/modules/home.js'))
        self.assertIn("menuBtn('regular-docs'", read('js/modules/more.js'))
        self.assertIn("ShellModules['regular-docs']", read('js/modules/regular-docs.js'))


@unittest.skipUnless(CHROME, '크롬 없음')
class T화면(unittest.TestCase):
    def open(self, h):
        srv = serve()
        try:
            return chrome('http://127.0.0.1:%d/%s' % (srv.server_address[1], h), ['--dump-dom'])
        finally:
            srv.shutdown()

    def test_grid(self):
        out = self.open('#/regular-docs')
        self.assertIn('id="rd-grid"', out)
        self.assertEqual(len(re.findall(r'<th class="doc" scope="row">', out)), 56)
        self.assertEqual(len(re.findall(r'data-month="\d+"', out)), 12)
        if __import__('datetime').date.today().month in (3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1):
            self.assertIn('id="rd-upcoming"', out)   # 2월엔 다가오는 달이 없음
        self.assertRegex(out, r'<th class="now" data-mh="\d+">')

    def test_filter_and_month(self):
        out = self.open('#/regular-docs?cat=' + '%EC%B6%9C%EC%9E%A5')   # 출장
        self.assertEqual(len(re.findall(r'<th class="doc" scope="row">', out)), 2)
        out = self.open('#/regular-docs/month/11')
        self.assertIn('11월 정례 문서', out)
        self.assertEqual(len(re.findall(r'class="rd-tag exp"', out)), 10)

    def test_home_entry(self):
        self.assertIn('id="home-regdocs"', self.open('#/home'))


if __name__ == '__main__':
    unittest.main()
