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
        self.assertIn('HJNav.sideGroups', nav)
        reg = read('js', 'registry.js')
        for g in ["'업무'", "'출석'", "'문서'", "'일정'", "'봇보고/현황판'"]:
            self.assertIn(g, reg)
        mods = set(re.findall(r"id: '([\w-]+)'", reg))
        hrefs = set(re.findall(r"href: '#/([\w-]+)'", reg))
        self.assertTrue(hrefs)
        self.assertTrue(hrefs <= mods, '메뉴가 없는 화면을 가리킴')
        self.assertIn("'https://hj-attend.yujin06344.workers.dev/'", reg)

    def test_home_board(self):
        # 홈은 오늘 할 일 한 장. 현황판 계산은 homeboard-core 에 그대로 두고, 화면은 #/bots 등에서 연다.
        h = read('js', 'modules', 'home.js')
        self.assertIn('id="home-today"', h)
        self.assertIn("var NODATA = '데이터 없음';", h)
        core = read('js', 'homeboard-core.js')
        self.assertTrue(core)

    def test_scripts_and_cache(self):
        i = read('index.html')
        self.assertLess(i.index('js/botstatus-core.js'), i.index('js/homeboard-core.js'))
        self.assertIn('js/intranet-nav.js', i)
        sw = read('sw.js')
        self.assertIn("var CACHE = 'hj-v98';", sw)
        self.assertIn('./css/app.css?v=39', sw)
        self.assertIn('css/app.css?v=39', i)
        # 새 모듈도 미리받기 목록에(오프라인에서 메뉴·현황판 유지), index 와 같은 버전
        for m in re.findall(r'src="(js/(?:homeboard-core|aiflow-core|intranet-nav)\.js\?v=\d+)"', i):
            self.assertIn("'./" + m + "'", sw)
        self.assertEqual(len(re.findall(r'js/(?:homeboard-core|aiflow-core|intranet-nav)\.js', i)), 3)
        self.assertLess(i.index('js/homeboard-core.js'), i.index('js/aiflow-core.js'))

    def test_late_subline_from_data(self):
        # 홈에서 현황판 카드를 뺐으므로, 지난 마감 숫자는 자료로만 센다(home-core).
        c = read('js', 'home-core.js')
        self.assertIn('overdueCount', c)
        self.assertNotIn('27', c)

    def test_ai_transition_stage1(self):
        """AI 전환 1단계: 현황판 안에서만, 유보 잠금 5개, 자료 없으면 「데이터 없음」"""
        a = read('js', 'aiflow-core.js')
        self.assertIn("var LOCKS = ['로그인', '결제', '영구삭제', '외부발송', '상신'];", a)
        self.assertIn("var LEVELS = ['초안만', '요약보고', '이상치만알림'];", a)
        h = read('js', 'modules', 'home.js')
        self.assertNotIn('id="hb-ai"', h)  # 봇 운영 칸은 홈에서 뺌
        self.assertIn('데이터 없음', read('js', 'aiflow-core.js'))
        nav = read('js', 'intranet-nav.js')
        self.assertIn('id="in-lock"', nav)
        self.assertNotIn("['#/ai", nav)  # 새 화면 없음

if __name__ == '__main__':
    unittest.main()
