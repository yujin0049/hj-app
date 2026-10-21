"""문서등록대장 학습(#/docreg) 시험: python3 -m unittest tests.test_docreg
- data/docreg.json 모양·개인정보(기안자·결재자 칸 없음, 전화·계좌·이메일·주민 모양 없음)
- 홈 맨 위·더보기에서 들어가는 줄, 모듈 등록, 계산 파일 불러오기, 캐시 v21"""
import json, os, re, sys, unittest
sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hjpii  # noqa: E402


def read(*p):
    return open(os.path.join(ROOT, *p), encoding='utf-8').read()


class DataFile(unittest.TestCase):
    def setUp(self):
        self.d = json.loads(read('data', 'docreg.json'))

    def test_shape(self):
        for k in ('version', 'source', 'total', 'public_rows', 'cats', 'kinds', 'recurring', 'counterparts', 'docs', 'questions'):
            self.assertIn(k, self.d)
        self.assertEqual(self.d['total'], 1856)
        doc_keys = {'no', 't', 'kind', 'cat', 'sub', 'to', 'd', 'rec'}
        for x in self.d['docs']:
            self.assertLessEqual(set(x), doc_keys)
            self.assertIn(x['kind'], ('내부결재', '대내 발신', '대외 발신', '대내 접수', '대외 접수'))
        for q in self.d['questions']:
            self.assertLessEqual(set(q), {'id', 'type', 'cat', 'q', 'choices', 'answer', 'ref', 'why'})
        self.assertLessEqual(len(self.d['docs']), self.d['public_rows'])

    def test_no_person_columns_or_pii(self):
        blob = json.dumps(self.d, ensure_ascii=False)
        for k in ('기안', '결재(담당)자', '원기안자', 'drafter', 'approver'):
            self.assertNotIn('"' + k, blob)
        for path, s in hjpii.walk_strings(self.d):
            hits = [h for h in hjpii.find_pii(s) if h != '이름 의심']
            self.assertEqual(hits, [], path)


class Wiring(unittest.TestCase):
    def test_entry_and_module(self):
        self.assertIn("'docreg'", read('js', 'registry.js'))
        self.assertIn('data-go="#/docreg"', read('js', 'modules', 'home.js'))
        self.assertIn("menuBtn('docreg'", read('js', 'modules', 'more.js'))
        idx = read('index.html')
        self.assertIn('js/docreg-core.js?v=21', idx)
        self.assertLess(idx.index('docreg-core.js'), idx.index('js/app.js'))
        self.assertIn('ShellModules.docreg', read('js', 'modules', 'docreg.js'))

    def test_cache_v21(self):
        self.assertGreaterEqual(int(re.search(r"'hj-v(\d+)'", read('sw.js')).group(1)), 21)
        self.assertNotIn('?v=20', read('index.html'))
