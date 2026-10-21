"""tools/build_vault_pack.py 시험. 가짜 볼트(tests/fixtures/vault_docs)만 씀. 실행: python -m unittest tests/test_vault_pack.py -v"""
import json, os, re, shutil, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build_vault_pack as B

with open(os.path.join(ROOT, 'tools', 'vault_folders.json'), encoding='utf-8') as f:
    CFG = json.load(f)
# 주민번호 모양은 저장소에 남기지 않으려고 실행 때 만든다(숫자는 가짜)
RRN_DASH = '9' + '00101' + '-1' + '234567'
RRN_PART = '9' + '00101-1' + '*' * 6
RRN_NODASH = '9' + '00101' + '2' + '345678'
NOT_RRN = '9' + '91399' + '1234567'          # 13월 99일 → 날짜가 아니라 그대로
P01 = '봇공유/10 업무/13 글로컬 지출/프로세스/P01_가짜프로세스.md'
REPORT = '봇공유/00 홈/보고서/261021_가짜보고서.md'


def make_vault():
    tmp = tempfile.mkdtemp()
    shutil.copytree(os.path.join(HERE, 'fixtures', 'vault_docs'), os.path.join(tmp, 'v'))
    v = os.path.join(tmp, 'v')
    with open(os.path.join(v, '봇공유', '00 홈', '보고서', '261021_가짜보고서.md'), 'a', encoding='utf-8') as f:
        f.write('\n가짜 번호 %s, %s, %s 는 가려야 함. %s 는 그대로\n' % (RRN_DASH, RRN_PART, RRN_NODASH, NOT_RRN))
    return v


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


class Pack(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vault = make_vault()
        cls.out = tempfile.mkdtemp()
        cls.ix = B.build(CFG, cls.vault, cls.out, '2026-10-21 10:30')
        cls.by = {d['path']: d for d in cls.ix['docs']}

    def doc(self, path):
        return json.loads(read(os.path.join(self.out, 'docs', self.by[path]['id'] + '.json')))

    def test_mask_function(self):
        t, n = B.mask_rrn('a %s b %s c %s d %s' % (RRN_DASH, RRN_PART, RRN_NODASH, NOT_RRN))
        self.assertEqual(n, 3)
        self.assertEqual(t.count(B.RRN_MASK), 3)
        self.assertIn(NOT_RRN, t)
        self.assertIsNone(re.search(r'\d{6}-\d', t))
        self.assertEqual(B.mask_rrn('전화 없음 2026-10-21 금액 15,180,000원')[1], 0)

    def test_rrn_always_masked_everywhere(self):
        allt = read(os.path.join(self.out, 'search.json')) + read(os.path.join(self.out, 'index.json'))
        for fn in os.listdir(os.path.join(self.out, 'docs')):
            allt += read(os.path.join(self.out, 'docs', fn))
        for s in (RRN_DASH, RRN_PART, RRN_NODASH, RRN_DASH[:6] + '-1'):
            self.assertNotIn(s, allt)
        self.assertIn(B.RRN_MASK, self.doc(REPORT)['text'])
        self.assertEqual(self.by[REPORT]['masked_rrn'], 3)
        self.assertEqual(self.ix['masked_rrn'], 3)

    def test_folders_from_config(self):
        self.assertEqual(self.ix['folders'], [f['label'] for f in CFG['folders']])
        self.assertEqual(self.ix['per_folder'], {'규칙 총정리': 1, '일정총괄': 2, '보고서': 1, '글로컬 지출 프로세스': 1,
                                                 '산업기사특강 원문대조': 1, '규정·지침': 2})
        self.assertIn('봇공유/20 규정·지침/하위/가짜_지침.md', self.by)      # 하위 폴더도
        self.assertNotIn('봇공유/30 인수인계/범위밖.md', self.by)               # 범위 밖
        self.assertNotIn('봇공유/10 업무/산업기사특강/범위밖_가짜공지.md', self.by)

    def test_config_has_required_folders(self):
        pats = [p for f in CFG['folders'] for p in f['include']]
        for want in ('00 홈/규칙_총정리.md', '00 홈/일정총괄.md', '00 홈/일정총괄.json', '00 홈/보고서/**/*.md',
                     '10 업무/13 글로컬 지출/프로세스/**/*.md', '10 업무/산업기사특강/261021_특강_원문대조_v01.md',
                     '20 규정·지침/**/*.md'):
            self.assertIn(want, pats)

    def test_glob(self):
        self.assertTrue(B.match_glob('a/b.md', 'a/**/*.md'))
        self.assertTrue(B.match_glob('a/x/y/b.md', 'a/**/*.md'))
        self.assertFalse(B.match_glob('a/x/b.md', 'a/*.md'))
        self.assertFalse(B.match_glob('ab/b.md', 'a/**/*.md'))

    def test_index_and_kv_keys_match_api(self):
        kv = json.loads(read(os.path.join(self.out, 'kv_keys.json')))
        self.assertEqual(kv['vault:index'], 'index.json')
        self.assertEqual(kv['vault:search'], 'search.json')
        for d in self.ix['docs']:
            self.assertRegex(d['id'], r'^[0-9a-f]{12}$')
            self.assertEqual(kv['vault:doc:' + d['id']], 'docs/%s.json' % d['id'])
            self.assertEqual(d['id'], B.doc_id(d['path']))
            for k in ('title', 'folder', 'path', 'modified'):
                self.assertIn(k, d)
        search = json.loads(read(os.path.join(self.out, 'search.json')))
        self.assertEqual(set(search), {d['id'] for d in self.ix['docs']})
        self.assertTrue(all(v == v.lower() for v in search.values()))
        self.assertEqual(self.ix['generated'], '2026-10-21 10:30')

    def test_doc_is_raw_text_not_html(self):
        d = self.doc(P01)
        self.assertNotIn('html', d)
        self.assertIn('<script>alert(1)</script>', d['text'])     # 글자 그대로. 화면이 textContent 로 그림
        self.assertNotIn('tags:', d['text'])                       # frontmatter 는 뺌
        self.assertEqual(d['kind'], 'md')

    def test_frontmatter_title_aliases(self):
        d = self.by['봇공유/00 홈/규칙_총정리.md']
        self.assertEqual(d['title'], '규칙 총정리 (연습용 가짜)')
        self.assertEqual(d['aliases'], ['가짜 규칙'])
        self.assertEqual(self.by[P01]['title'], 'P01 가짜 프로세스')     # 첫 # 제목
        self.assertEqual(self.by[P01]['stem'], 'P01_가짜프로세스')

    def test_json_doc(self):
        d = self.doc('봇공유/00 홈/일정총괄.json')
        self.assertEqual(d['kind'], 'json')
        self.assertEqual(json.loads(d['text'])['items'][0]['title'], '연습용 가짜 일정')

    def test_rerun_same_ids_and_stale_removed(self):
        out = tempfile.mkdtemp()
        stale = os.path.join(out, 'docs')
        os.makedirs(stale)
        with open(os.path.join(stale, 'abcdefabcdef.json'), 'w') as f:
            f.write('{}')
        with open(os.path.join(stale, 'keep-me.txt'), 'w') as f:
            f.write('x')
        ix2 = B.build(CFG, self.vault, out, '2026-10-21 10:30')
        self.assertEqual([d['id'] for d in ix2['docs']], [d['id'] for d in self.ix['docs']])
        self.assertFalse(os.path.exists(os.path.join(stale, 'abcdefabcdef.json')))
        self.assertTrue(os.path.exists(os.path.join(stale, 'keep-me.txt')))

    def test_refuses_out_inside_repo(self):
        for bad in (os.path.join(ROOT, 'data', 'vault_pack'), ROOT, os.path.join(ROOT, 'x', '..', 'vault_pack')):
            self.assertEqual(B.main(['--vault', self.vault, '--out', bad]), 2, bad)
        self.assertFalse(os.path.exists(os.path.join(ROOT, 'data', 'vault_pack')))
        self.assertFalse(os.path.exists(os.path.join(ROOT, 'vault_pack')))
        self.assertTrue(B.is_inside(os.path.join(ROOT.upper(), 'a'), ROOT) or os.name != 'nt')   # 윈도우 대소문자

    def test_out_required(self):
        with self.assertRaises(SystemExit) as cm:
            B.main(['--vault', self.vault])
        self.assertEqual(cm.exception.code, 2)

    def test_main_prints_counts(self):
        out = tempfile.mkdtemp()
        self.assertEqual(B.main(['--vault', self.vault, '--out', out, '--today', 'x']), 0)
        self.assertTrue(os.path.isfile(os.path.join(out, 'index.json')))


if __name__ == '__main__':
    unittest.main()
