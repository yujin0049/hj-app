"""문서등록대장 달력(#/docreg/cal) 시험: python3 -m unittest tests.test_docreg_cal
- 더보기 맨 아래 버튼 하나, 홈·index.html 은 그대로(자료·화면 파일은 처음 열 때만), 캐시 hj-v83
- data/docreg_calendar.json 이 있으면: 모양(월별·날짜별·목록), 합계가 맞는지, 전화·계좌·이메일·주민 모양 없음"""
import json, os, re, unittest
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class Wiring(unittest.TestCase):
    def test_more_button_last(self):
        m = read('js', 'modules', 'more.js')
        self.assertEqual(m.count("menuBtn('docreg-cal'"), 1)
        i = m.index("menuBtn('docreg-cal'")
        self.assertGreater(i, m.index("menuBtn('settings'"))
        self.assertEqual(m.count('menuBtn(', i + 1), 1)  # 뒤에 다른 버튼(정의 제외) 없음
        self.assertIn("id === 'docreg-cal') api.go('#/docreg/cal')", m)

    def test_lazy(self):
        d = read('js', 'modules', 'docreg.js')
        self.assertIn("js/docreg-cal.js?v=", d)
        self.assertLess(d.index("=== 'cal') return calPage"), d.index('if (!root.HJDocreg)'))
        self.assertNotIn('docreg-cal', read('index.html'))
        self.assertNotIn('docreg_calendar', read('js', 'modules', 'home.js'))
        c = read('js', 'docreg-cal.js')
        self.assertEqual(re.findall(r"fetch\(new URL\('([^']+)'", c), ['data/docreg_calendar.json'])
        self.assertNotIn('data/docreg.json', c)

    def test_cache(self):
        self.assertIn("var CACHE = 'hj-v83';", read('sw.js'))

P = os.path.join(R, 'data', 'docreg_calendar.json')

@unittest.skipUnless(os.path.exists(P), 'data/docreg_calendar.json 아직 없음')
class Data(unittest.TestCase):
    def setUp(self):
        self.raw = read('data', 'docreg_calendar.json')
        self.d = json.loads(self.raw)

    def test_no_pii_shapes(self):
        for pat in (r'01[016789]-?\d{3,4}-?\d{4}', r'\d{6}-?[1-4]\d{6}', r'[\w.+-]+@[\w-]+\.[\w.]+', r'\d{3,6}-\d{2,6}-\d{4,8}'):
            self.assertEqual(re.findall(pat, self.raw), [], pat)
        self.assertEqual(re.findall(r'"(?:기안자|결재자|주민|전화|계좌|이메일)[^"]*"\s*:', self.raw), [])

    def test_total_label_from_file(self):
        c = read('js', 'docreg-cal.js')
        self.assertIn("문서대장 원본 기준 ' + c.total.toLocaleString('ko-KR') + '건", c)
        self.assertNotIn('1,727', c)
        self.assertNotIn('1727', c)

    def test_total_matches_lists(self):
        tot = self.d.get('total', (self.d.get('meta') or {}).get('total'))
        dl = self.d.get('docs_by_day') or {}
        self.assertEqual(tot, sum(len(v) for v in dl.values()))
        self.assertEqual(tot, sum(m.get('count', m.get('n', 0)) for m in self.d['months']))
