"""인트라넷 메뉴·홈 현황판 시험: python3 -m unittest tests.test_intranet_home"""
import os, re, unittest
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class IntranetHome(unittest.TestCase):
    """261111 유진님 「ㅇㅋ 해」「중요한건 인트라넷이라는거지」: 메뉴 한 곳 + 홈 현황판"""
    def test_menu_groups_and_existing_routes(self):
        nav = read('js', 'intranet-nav.js')
        for g in ["group: '업무'", "group: '출석'", "group: '문서'", "group: '일정'", "group: '봇보고/현황판'"]:
            self.assertIn(g, nav)
        reg = read('js', 'registry.js')
        mods = set(re.findall(r"'([\w-]+)'", reg))
        routes = set(re.findall(r"\['#/([\w-]+)'", nav))
        self.assertTrue(routes)
        self.assertEqual(routes - mods, set(), '메뉴가 없는 화면을 가리킴')
        self.assertIn("'https://hj-attend.yujin06344.workers.dev/'", nav)

    def test_home_board(self):
        h = read('js', 'modules', 'home.js')
        self.assertIn('id="home-board"', h)
        self.assertLess(h.index('h += boardCard();'), h.index('h += otEntry();\n    // 봇 작업 현황'))
        self.assertIn("var NODATA = '데이터 없음';", h)
        for col in ['날짜', '제목', '담당', '마감일']:
            self.assertIn('<th scope="col">' + col + '</th>', h)

    def test_scripts_and_cache(self):
        i = read('index.html')
        self.assertLess(i.index('js/botstatus-core.js'), i.index('js/homeboard-core.js'))
        self.assertIn('js/intranet-nav.js', i)
        sw = read('sw.js')
        self.assertIn("var CACHE = 'hj-v92';", sw)
        self.assertIn('./css/app.css?v=38', sw)
        self.assertIn('css/app.css?v=38', i)
        # 새 모듈도 미리받기 목록에(오프라인에서 메뉴·현황판 유지), index 와 같은 버전
        for m in re.findall(r'src="(js/(?:homeboard-core|aiflow-core|intranet-nav)\.js\?v=\d+)"', i):
            self.assertIn("'./" + m + "'", sw)
        self.assertEqual(len(re.findall(r'js/(?:homeboard-core|aiflow-core|intranet-nav)\.js', i)), 3)
        self.assertLess(i.index('js/homeboard-core.js'), i.index('js/aiflow-core.js'))

    def test_late_subline_from_data(self):
        h = read('js', 'modules', 'home.js')
        self.assertIn('id="hb-late">지남 \' + c[\'지남\']', h)  # 숫자는 자료로 셈(박아 넣지 않음)

    def test_ai_transition_stage1(self):
        """AI 전환 1단계: 현황판 안에서만, 유보 잠금 5개, 자료 없으면 「데이터 없음」"""
        a = read('js', 'aiflow-core.js')
        self.assertIn("var LOCKS = ['로그인', '결제', '영구삭제', '외부발송', '상신'];", a)
        self.assertIn("var LEVELS = ['초안만', '요약보고', '이상치만알림'];", a)
        h = read('js', 'modules', 'home.js')
        self.assertIn('id="hb-ai"', h)
        self.assertIn('h += aiPaint(esc, today);', h)
        self.assertIn('추천이지 결정이 아님', h)
        nav = read('js', 'intranet-nav.js')
        self.assertIn('id="in-lock"', nav)
        self.assertNotIn("['#/ai", nav)  # 새 화면 없음

if __name__ == '__main__':
    unittest.main()
