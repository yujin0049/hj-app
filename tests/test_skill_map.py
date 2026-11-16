"""역량맵 화면 연결 시험: python3 -m unittest tests.test_skill_map"""
import json, os, re, unittest

R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class SkillMap(unittest.TestCase):
    def test_route_and_cache(self):
        reg = read('js', 'registry.js')
        self.assertIn("'skill-map'", reg)
        self.assertTrue(reg.strip().endswith("'skill-map'];") or "'skill-map'" in reg)
        nav = read('js', 'intranet-nav.js')
        self.assertIn("['#/skill-map', '역량맵']", nav)
        more = read('js', 'modules', 'more.js')
        self.assertIn("menuBtn('skill-map', '역량맵'", more)
        self.assertIn("id === 'skill-map'", more)
        app = read('js', 'app.js')
        self.assertIn("id === 'skill-map'", app)
        self.assertIn("var CACHE = 'hj-v96';", read('sw.js'))
        self.assertTrue(os.path.exists(os.path.join(R, 'js', 'modules', 'skill-map.js')))
        self.assertTrue(os.path.exists(os.path.join(R, 'js', 'skill-map-core.js')))

    def test_bank_src_and_empty_label(self):
        bank = json.loads(read('data', 'skill_map', 'questions.json'))
        self.assertTrue(bank['questions'])
        for q in bank['questions']:
            self.assertTrue(q.get('src') and str(q['src']).strip(), q.get('id'))
            self.assertNotIn('obsidian://', q['src'])
            self.assertNotIn('/home/box/', q['src'])
            self.assertNotIn('봇공유/', q['src'])
        js = read('js', 'modules', 'skill-map.js')
        self.assertIn('데이터 없음', js)
        self.assertIn('문제 준비 중(데이터 없음)', js)
        self.assertIn('#4CC3FF', js)
        self.assertIn('Hahmlet', js)

    def test_llms_hook_last_extra(self):
        # test_llms.py 가 마지막 MODULE_EXTRA 항목 뒤에 비밀 칸을 끼움
        self.assertIn("root.MODULE_EXTRA = [", read('js', 'registry.js'))
        self.assertRegex(read('js', 'registry.js'), r"'skill-map'\]")

if __name__ == '__main__':
    unittest.main()
