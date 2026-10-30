"""#/coop 결과 「더 보기」·정렬 시험: python3 -m unittest tests.test_coop_more_sort
근거: 봇공유/조사/261029_hj-app_목록기능검토_v01 「#/coop: 앞 12건만 보여 줘서 나머지 결과를 볼 수 없음. 더보기 버튼과 정렬 추가 제안」.
- 결과는 10건씩 보이고 「n건 더 보기 (남은 m건)」 버튼으로 더 열어요. 다 열면 「처음 10건만 보기」.
- 정렬: 기본 순서 · 일 이름 가나다 · 부서 가나다 · 상태별. 같은 값이면 원래 순서, 빈칸은 맨 뒤.
- 정렬·개수는 메모리에만(localStorage 안 씀). 캐시 hj-v80."""
import json
import os
import shutil
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COOP = os.path.join(ROOT, 'js', 'modules', 'coop.js')


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8') as fh:
        return fh.read()


def node(script, payload=None):
    js = ("globalThis.ShellModules={};require(%s);const L=ShellModules.coop._list;"
          "const P=JSON.parse(require('fs').readFileSync(0,'utf8')||'null');" % json.dumps(COOP)) + script
    r = subprocess.run(['node', '-e', js], input=json.dumps(payload, ensure_ascii=False), capture_output=True, text=True, timeout=60)
    if r.returncode:
        raise AssertionError(r.stderr)
    return json.loads(r.stdout)


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class Paging(unittest.TestCase):
    def test_page_size_and_rest(self):
        out = node("process.stdout.write(JSON.stringify([L.PAGE,L.pageOf(39,10),L.pageOf(39,20),L.pageOf(39,40),L.pageOf(7,10),L.pageOf(0,10)]))")
        self.assertEqual(out[0], 10)
        self.assertEqual(out[1], {'shown': 10, 'rest': 29, 'next': 10})
        self.assertEqual(out[2], {'shown': 20, 'rest': 19, 'next': 10})
        self.assertEqual(out[3], {'shown': 39, 'rest': 0, 'next': 0})
        self.assertEqual(out[4], {'shown': 7, 'rest': 0, 'next': 0})
        self.assertEqual(out[5], {'shown': 0, 'rest': 0, 'next': 0})

    def test_last_page_partial(self):
        out = node("process.stdout.write(JSON.stringify(L.pageOf(23,20)))")
        self.assertEqual(out, {'shown': 20, 'rest': 3, 'next': 3})


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class Sorting(unittest.TestCase):
    ROWS = [{'work': '다', 'dept': 'B', 'status': ''}, {'work': '가', 'dept': '', 'status': '끝'},
            {'work': '나', 'dept': 'A', 'status': '진행'}, {'work': '가', 'dept': 'A', 'status': '끝'}]

    def order(self, by):
        return node("const x=P.map((r,i)=>({r,i}));process.stdout.write(JSON.stringify(L.sortRows(x,%s).map(a=>a.i)))" % json.dumps(by), self.ROWS)

    def test_default_keeps_data_order(self):
        self.assertEqual(self.order('rel'), [0, 1, 2, 3])

    def test_work_ko_stable(self):
        self.assertEqual(self.order('work'), [1, 3, 2, 0])

    def test_dept_blank_last(self):
        self.assertEqual(self.order('dept'), [2, 3, 0, 1])

    def test_status_blank_last(self):
        self.assertEqual(self.order('status'), [1, 3, 2, 0])

    def test_does_not_mutate(self):
        out = node("const x=P.map((r,i)=>({r,i}));L.sortRows(x,'work');process.stdout.write(JSON.stringify(x.map(a=>a.i)))", self.ROWS)
        self.assertEqual(out, [0, 1, 2, 3])

    def test_real_data_all_rows_reachable(self):
        d = json.loads(read('data', 'coop.json'))
        out = node("const x=P.map((r,i)=>({r,i}));process.stdout.write(JSON.stringify(%s.map(s=>L.sortRows(x,s[0]).map(a=>a.i).sort((a,b)=>a-b))))" % 'L.SORTS', d['rows'])
        for got in out:
            self.assertEqual(got, list(range(len(d['rows']))))


class Wiring(unittest.TestCase):
    def setUp(self):
        self.js = read('js', 'modules', 'coop.js')

    def test_ui_bits(self):
        for k in ('id="cp-sort"', 'aria-label="결과 정렬"', 'id="cp-morebtn"', '건 더 보기', '처음 \' + PAGE + \'건만 보기', 'aria-controls="cp-results"', 'min-height:44px'):
            self.assertIn(k, self.js)

    def test_resets_on_new_query(self):
        self.assertIn("if (key !== listKey) { listKey = key; limit = PAGE; }", self.js)

    def test_memory_only(self):
        self.assertNotIn('localStorage', self.js)
        self.assertNotIn('sessionStorage', self.js)

    def test_cache(self):
        self.assertIn("var CACHE = 'hj-v80';", read('sw.js'))


if __name__ == '__main__':
    unittest.main()
