"""달력(#/calendar)·현황표(#/status) 목록 UX 시험: python3 -m unittest tests.test_list_more_calendar_board
근거: 봇공유/조사/261029_hj-app_목록기능검토_v01 제안 2 「calendar/status: 앞 3~6건만 표시되고 검색이 없음 → 화면 안 검색과 더보기」.
- 달력: 찾기 칸(#f-q) + 「찾은 일정」 목록(10개 + 더 보기), 달력 칸 「+N 더 보기」 버튼(그날 목록으로), 휴대폰 점 6개 넘으면 「+N」,
  다가오는 일정 칸마다 8개 + 「더 보기」/「접기」.
- 현황표: 찾기 칸(#sf-q), 표 20개씩 「더 보기」, 다 열면 「처음 20개만 보기」.
- 찾기는 HJCal.matchQ(띄어 쓴 낱말 모두, 띄어쓰기·대소문자 무시). 저장 안 함. 캐시 hj-v80."""
import json
import os
import shutil
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = os.path.join(ROOT, 'js', 'calendar-core.js')


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8') as fh:
        return fh.read()


def node(script, payload):
    js = ("const C=require(%s);const P=JSON.parse(require('fs').readFileSync(0,'utf8'));" % json.dumps(CORE)) + script
    r = subprocess.run(['node', '-e', js], input=json.dumps(payload, ensure_ascii=False), capture_output=True, text=True, timeout=60)
    if r.returncode:
        raise AssertionError(r.stderr)
    return json.loads(r.stdout)


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class MatchQ(unittest.TestCase):
    def test_rules(self):
        x = {'t': 'T007', 'title': '특강 강사료 지급', 'bot': '행정봇', 'group': '특강', 'status': '할 일', 'yujin': ['결재·상신']}
        qs = ['', '강사료', '강사료지급', '강사 료', 't007', '특강 행정봇', '상신', '특강 교수님', '없는말']
        out = node("process.stdout.write(JSON.stringify(P.q.map(q=>C.matchQ(P.x,q))))", {'x': x, 'q': qs})
        self.assertEqual(out, [True, True, True, True, True, True, True, False, False])

    def test_pass_uses_q_with_other_filters(self):
        xs = [{'title': '가 일', 'bot': 'A', 'status': '할 일'}, {'title': '가 끝', 'bot': 'A', 'status': '완료'}, {'title': '나 일', 'bot': 'B', 'status': '할 일'}]
        out = node("process.stdout.write(JSON.stringify([P.filter(x=>C.pass(x,{q:'가'})).length,P.filter(x=>C.pass(x,{q:'가',showDone:true})).length,P.filter(x=>C.pass(x,{q:'일',bot:'B'})).length,P.filter(x=>C.pass(x,{})).length]))", xs)
        self.assertEqual(out, [1, 2, 1, 2])

    def test_real_data_every_task_findable_by_t(self):
        tasks = json.loads(read('data', 'status.json'))['tasks']
        out = node("process.stdout.write(JSON.stringify(P.every(t=>!t.t||C.matchQ(t,t.t))))", tasks)
        self.assertTrue(out)


class Calendar(unittest.TestCase):
    def setUp(self):
        self.js = read('js', 'modules', 'calendar.js')

    def test_search_and_hits(self):
        for k in ('id="f-q"', 'aria-label="일정 찾기"', 'id="cl-hits"', '찾은 일정', 'HIT_PAGE = 10', 'isComposing', 'compositionend'):
            self.assertIn(k, self.js)

    def test_cell_more_is_button_to_day_list(self):
        self.assertIn('<button type="button" class="cl-more" data-more="', self.js)
        self.assertIn(' 더 보기</button>', self.js)
        self.assertIn("querySelectorAll('[data-more]')", self.js)
        self.assertIn('id="cl-dayhead"', self.js)
        self.assertNotIn('<div class="cl-more">', self.js)

    def test_mobile_dots_show_rest(self):
        self.assertIn("list.length > 6 ? '<b class=\"cl-dn\">+'", self.js)

    def test_upcoming_columns_paged(self):
        self.assertIn('COL_PAGE = 8', self.js)
        self.assertIn('cut(id, l, COL_PAGE)', self.js)
        self.assertIn('data-colmore', self.js)
        self.assertIn('aria-expanded', self.js)

    def test_memory_only(self):
        for f in ('calendar.js', 'status.js'):
            js = read('js', 'modules', f)
            self.assertNotIn('localStorage', js)
            self.assertNotIn('sessionStorage', js)


class Status(unittest.TestCase):
    def setUp(self):
        self.js = read('js', 'modules', 'status.js')

    def test_search_box_feeds_view_q(self):
        self.assertIn('id="sf-q"', self.js)
        self.assertIn('aria-label="현황표 찾기"', self.js)
        self.assertIn('view.q = q.value', self.js)
        self.assertIn('C.pass(t, view)', self.js)

    def test_paging(self):
        for k in ('var PAGE = 20', 'id="st-morebtn"', 'id="st-lessbtn"', '개 더 보기', "shown.slice(0, cnt)", 'lim = PAGE; paint'):
            self.assertIn(k, self.js)

    def test_pin_table_not_filtered(self):
        self.assertIn("table(C, pin, today, 'st-pin-tbl')", self.js)

    def test_cache(self):
        self.assertIn("var CACHE = 'hj-v80';", read('sw.js'))


if __name__ == '__main__':
    unittest.main()
