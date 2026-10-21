"""tools/link_sources.py 시험 (가짜 볼트). 실행: python3 -m unittest tests/test_link_sources.py -v"""
import json, os, shutil, subprocess, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import link_sources as L

FIX = os.path.join(HERE, 'fixtures')
FAKE_PHONE = '0' + '10-12' + '34-56' + '78'   # 저장소에 번호 모양을 남기지 않으려고 실행 때 만든다
TMP = tempfile.mkdtemp()
VAULT = os.path.join(TMP, 'vault')
shutil.copytree(os.path.join(FIX, 'vault'), VAULT)
with open(os.path.join(VAULT, '봇공유', '20 규정·지침', '위임전결규정.md'), 'a', encoding='utf-8') as f:
    f.write('담당 연락처 ' + FAKE_PHONE + ' (연습용 가짜 번호)\n')


def run(extra=()):
    out = tempfile.mktemp(suffix='.json')
    rc = L.main(['--vault', VAULT, '--pack', os.path.join(FIX, 'pack.json'),
                 '--out', out, '--today', '2026-10-21 10:00'] + list(extra))
    data = json.load(open(out, encoding='utf-8')) if os.path.exists(out) else None
    return rc, data, out


class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rc, cls.d, cls.out = run()
        cls.c = cls.d['cards']

    def test_pii_gate_passes(self):
        self.assertEqual(self.rc, 0)

    def test_title_alias_link(self):
        r = self.c['regulations:a1']
        self.assertEqual(r['status'], '연결')
        self.assertTrue(r['path'].endswith('20 규정·지침/위임전결규정.md'))
        self.assertEqual(r['excerpt']['articles_found'], ['제5조'])
        self.assertIn('전결권자', r['excerpt']['text'])

    def test_pii_line_dropped_from_excerpt(self):
        txt = json.dumps(self.d, ensure_ascii=False)
        self.assertNotIn(FAKE_PHONE, txt)
        self.assertGreaterEqual(self.c['regulations:a1']['excerpt']['dropped_pii_lines'], 1)

    def test_rcode_and_fulltext_excerpt_skips_toc(self):
        r = self.c['regulations:a2']
        self.assertEqual(r['status'], '연결')
        self.assertTrue(r['matched_by'].startswith('r코드'))
        self.assertEqual(r['excerpt']['from'], 'box_fulltext')
        self.assertTrue(r['excerpt']['text'].startswith('제3조(집행 기준)'))

    def test_review_note_is_candidate_only(self):
        r = self.c['regulations:a3']
        self.assertEqual(r['status'], '후보 있음(확인 필요)')
        self.assertIn('검토', r['path'])

    def test_form_with_name_never_listed(self):
        txt = json.dumps(self.d, ensure_ascii=False)
        self.assertNotIn('홍길동', txt)
        self.assertEqual(self.c['regulations:a4']['status'], '못 찾음')

    def test_bot_notes_skipped(self):
        self.assertEqual(self.c['regulations:a5']['status'], '못 찾음')
        self.assertNotIn('99 봇', json.dumps(self.d, ensure_ascii=False))

    def test_nothing_found(self):
        r = self.c['regulations:a6']
        self.assertEqual(r['status'], '못 찾음')
        self.assertEqual(r['candidates'], [])

    def test_rerun_same_result(self):
        rc, d2, _ = run()
        self.assertEqual(rc, 0)
        self.assertEqual(d2, self.d)

    def test_summary_counts(self):
        self.assertEqual(self.d['summary'], {'연결': 2, '후보 있음(확인 필요)': 1, '못 찾음': 3})

    def test_scores_basic(self):
        self.assertEqual(L.contain('위임전결규정', '국립창원대학교위임전결규정'), 1.0)
        self.assertLess(L.kind_penalty('경남항공교육원운영규정', '항공기술교육원교육규정'), 0.5)

    def test_js_obsidian_url(self):
        js = os.path.join(ROOT, 'js', 'source-link.js')
        code = ("require(%r); var S=globalThis.SourceLink;"
                "console.log(JSON.stringify([S.obsidianUrl({}, '봇공유/a.md'),"
                "S.obsidianUrl({obsidianVault:'봇공유',obsidianVaultRootInBox:'봇공유'}, '봇공유/20 규정·지침/위임전결규정.md')]))") % js
        r = subprocess.run(['node', '-e', code], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        a, b = json.loads(r.stdout)
        self.assertEqual(a, '')
        self.assertEqual(b, 'obsidian://open?vault=%EB%B4%87%EA%B3%B5%EC%9C%A0&file=20%20%EA%B7%9C%EC%A0%95%C2%B7%EC%A7%80%EC%B9%A8%2F%EC%9C%84%EC%9E%84%EC%A0%84%EA%B2%B0%EA%B7%9C%EC%A0%95')


if __name__ == '__main__':
    unittest.main()
