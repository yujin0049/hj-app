"""표 규칙(261031 그리드솔루션 피드백): 칸 정렬·툴바 한 줄·한 행 한 줄. 모양만, 자료 그대로."""
import os, re, subprocess, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def read(*p): return open(os.path.join(ROOT, *p), encoding='utf-8').read()

class T(unittest.TestCase):
    def test_loaded(self):
        self.assertIn('js/grid-rules.js', read('index.html'))
        self.assertIn("var CACHE = 'hj-v82';", read('sw.js'))

    def test_css_rules(self):
        c = read('css', 'app.css')
        for s in ['td.g-num { text-align: right', 'td.g-long { text-align: left', 'td.g-short { text-align: center',
                  'text-overflow: ellipsis', '.hj-toolbar', '.hj-adv']:
            self.assertIn(s, c)

    def test_status_toolbar(self):
        s = read('js', 'modules', 'status.js')
        self.assertIn('data-grid-for="st-tbl"', s)
        self.assertIn('data-grid-find', s); self.assertIn('data-grid-sort', s); self.assertIn('data-grid-count id="st-count"', s)
        i = s.index('<details class="hj-adv" id="st-adv">')
        self.assertLess(i, s.index('id="sf-bot"'))  # 상세검색은 접기 안
        self.assertNotIn('<div class="cl-flt"><select', s)  # 위쪽 필터 상자 없음
        self.assertNotIn('display:grid;grid-template-columns:auto 1fr auto', s)  # 폰에서 두 줄 카드 안 함

    def test_kind_node(self):
        js = r"""
const src = require('fs').readFileSync('js/grid-rules.js', 'utf8');
global.window = {}; global.document = {readyState: 'complete', getElementById: () => null, body: {querySelectorAll: () => []}};
new Function('window', 'globalThis', src)(global.window, global.window);
const k = global.window.HJGrid.kind;
const out = [k(['12', '1,200', '3건']), k(['계획 문서를 만들어 결재 올리기', '지출 결의 뒤 돈 보내기 확인']), k(['부총장', '센터장'])];
console.log(out.join(','));"""
        r = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.stdout.strip(), 'g-num,g-long,g-short', r.stderr)

if __name__ == '__main__':
    unittest.main()
