"""전문가검토 top5(홈·읽은시각·메뉴하나·글자): python3 -m unittest tests.test_expert_top5 tests.test_min_font"""
import os, re, unittest

R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()


class HomeToday(unittest.TestCase):
    def test_home_is_one_today_card(self):
        h = read('js', 'modules', 'home.js')
        self.assertIn('id="home-today"', h)
        self.assertIn('오늘 할 일', h)
        self.assertIn('id="fresh-line"', h)
        self.assertIn('data-go="#/todo"', h)
        self.assertIn('id="home-stale"', h)
        # 바로가기·봇 운영 칸·3D 카드는 홈에서 뺌
        self.assertNotIn('id="home-board"', h)
        self.assertNotIn('id="home-bots"', h)
        self.assertNotIn('id="home-notice"', h)
        self.assertNotIn("class=\"tiles\"", h)
        self.assertNotIn('id="hb-ai"', h)
        self.assertNotIn('3d/index.html', h)

    def test_home_uses_cores(self):
        self.assertIn('HJHomeCore', read('js', 'modules', 'home.js'))
        self.assertIn('HJFresh', read('js', 'modules', 'home.js'))
        i = read('index.html')
        self.assertIn('js/home-core.js?v=1', i)
        self.assertIn('js/freshness.js?v=3', i)
        self.assertIn('js/calendar-core.js?v=1', i)


class FreshLine(unittest.TestCase):
    def test_status_todo_budget_have_fixed_line(self):
        for rel in ('js/modules/status.js', 'js/modules/todo.js', 'js/modules/more.js', 'js/modules/home.js'):
            t = read(*rel.split('/'))
            self.assertIn('fresh-line', t, rel)
            self.assertIn('HJFresh', t, rel)

    def test_missing_built_at_is_nodata_phrase(self):
        f = read('js', 'freshness.js')
        self.assertIn("var NODATA = '데이터 없음';", f)
        self.assertIn('built_at', f)
        self.assertIn('source_at', f)
        self.assertIn('오늘 사용 가능', f)
        self.assertIn('일 전 자료', f)
        self.assertIn('원자료', f)
        self.assertIn('마지막 수정', f)
        app = read('js', 'app.js')
        self.assertIn('source_at: p.source_at', app)


class OneMenu(unittest.TestCase):
    def test_tabs_side_more_shortcuts_from_registry(self):
        nav = read('js', 'intranet-nav.js')
        more = read('js', 'modules', 'more.js')
        app = read('js', 'app.js')
        work = read('js', 'modules', 'work.js')
        reg = read('js', 'registry.js')
        self.assertIn('HJNav.sideGroups', nav)
        self.assertIn('HJNav.moreGroups', more)
        self.assertIn('HJNav.tabOf', app)
        self.assertIn('HJNav.workTools', work)
        self.assertIn('homeShortcut', reg)
        self.assertIn("'지출·원인행위 건현황'", reg)
        self.assertNotIn("'현황표'", reg)  # 이름 중복 제거(업무현황표·건현황만)

    def test_cache_v98(self):
        sw = read('sw.js')
        i = read('index.html')
        self.assertIn("var CACHE = 'hj-v100';", sw)
        self.assertIn('css/app.css?v=40', i)
        self.assertIn('./css/app.css?v=40', sw)
        self.assertIn("var CACHE = 'hj-v100';", sw)


class NoExampleData(unittest.TestCase):
    def test_home_uses_nodata_phrase(self):
        h = read('js', 'modules', 'home.js')
        self.assertIn("var NODATA = '데이터 없음';", h)
        self.assertNotRegex(h, r'홍길동|김철수|이영희')
