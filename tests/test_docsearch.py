"""문서대장 찾기(#/docsearch) 시험: python3 -m unittest tests.test_docsearch
- 연결: 모듈 목록·홈 입구·계산 파일은 처음 열 때만(index.html 에 없음)·캐시 hj-v86(#59가 올림)
- 자료: data/docsearch.json 개인정보 모양 없음·사람 칸(기안자·결재자) 없음·볼트 경로 없음·「키 없이 도는 검색」 표시
- 유료 AI·키 없음: 화면·계산 파일에 외부 AI 주소·키 칸이 없음"""
import json, os, re, sys, unittest
R = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, os.path.join(R, 'tools'))
import hjpii  # noqa: E402


def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()


class Wiring(unittest.TestCase):
    def test_module_and_entry(self):
        self.assertIn("'docsearch'", read('js', 'registry.js'))
        self.assertIn('data-go="#/docsearch"', read('js', 'modules', 'home.js'))
        self.assertIn('data-go="#/docsearch"', read('js', 'modules', 'docreg.js'))
        self.assertIn("id === 'docsearch' ? 'home'", read('js', 'app.js'))

    def test_lazy_core(self):
        m = read('js', 'modules', 'docsearch.js')
        self.assertIn('js/docsearch-core.js?v=', m)
        self.assertNotIn('docsearch', read('index.html'))
        self.assertEqual(sorted(set(re.findall(r"get\('([^']+)'\)", m))), ['data/docreg.json', 'data/docsearch.json'])

    def test_keyfree_label_and_no_paid_ai(self):
        m = read('js', 'modules', 'docsearch.js') + read('js', 'docsearch-core.js')
        self.assertIn('키 없이 도는 검색', m)
        for bad in ('openai', 'anthropic', 'generativelanguage', 'api_key', 'apikey', 'Authorization', 'x-api-key'):
            self.assertNotIn(bad.lower(), m.lower())

    def test_gaps_limits_notice(self):
        # 부족 부서 화면 맨 위 한 줄: 대장 범위(10.30.까지) · 협조부서 칸 없음 · 교육원 자체 대장 없음
        m = read('js', 'modules', 'docsearch.js')
        i = m.index('id="ds-limit"')
        self.assertLess(i, m.index('id="ds-stats"'))
        line = m[i:m.index('</p>', i)]
        for w in ('까지만', '협조부서 칸 없음', '교육원 자체 대장 없음', '최소치'):
            self.assertIn(w, line)


class Data(unittest.TestCase):
    def setUp(self):
        self.d = json.loads(read('data', 'docsearch.json'))

    def test_shape_matches_md(self):
        reg = self.d['registers']
        self.assertEqual((reg['files'], reg['depts'], len(reg['rows']), reg['base']), (16, 13, 13, '2026-10-30'))
        lack = [(r['dept'], r['status']) for r in reg['rows'] if r['status'] in ('부족', '대장 없음')]
        self.assertEqual(lack, [('글로컬대학사업센터', '부족'), ('경남항공교육원 자체 대장', '대장 없음')])
        self.assertEqual(sum(r['n'] or 0 for r in reg['rows']), 1940 + 8812 + 5281 + 5509 + 4287 + 1882 + 1769 + 1742 + 1739 + 1871 + 1622 + 1427)

    def test_extra_rows_public_no_people(self):
        ex = self.d['extra']
        self.assertEqual(ex['cols'], ['no', 't', 'd', 'kind', 'to', 'cat'])
        self.assertTrue(all(len(r) == 6 for r in ex['rows']))
        self.assertTrue(all('2026-10-22' <= r[2] <= '2026-10-30' for r in ex['rows']))
        docreg = {x['no'] for x in json.loads(read('data', 'docreg.json'))['docs']}
        self.assertFalse(docreg & {r[0] for r in ex['rows']})

    def test_no_pii_or_paths(self):
        s = read('data', 'docsearch.json')
        for p, v in hjpii.walk_strings(self.d):
            self.assertEqual(hjpii.find_pii(v), [], p)
        self.assertNotIn('기안', s)
        self.assertNotIn('결재(담당)', s)
        self.assertNotRegex(s, r'obsidian|/home/box|받은함|\.xlsx|\.xls')


if __name__ == '__main__':
    unittest.main()
