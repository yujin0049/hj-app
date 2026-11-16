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
        self.assertIn("var CACHE = 'hj-v98';", read('sw.js'))
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

    def test_cp10_connected(self):
        cmap = json.loads(read('data', 'skill_map', 'cp_map.json'))
        self.assertEqual([r['cp'] for r in cmap['map']], ['CP%02d' % i for i in range(1, 11)])
        self.assertTrue(os.path.exists(os.path.join(R, 'data', 'competency_map_v02.json')))
        study = read('js', 'modules', 'study.js')
        self.assertIn("api.go('#/skill-map')", study)
        self.assertIn('#/skill-map/quiz/', study)
        self.assertIn('이번 주 카드 열기', study)
        self.assertNotIn('이번 주 study_days', study)
        prac = read('js', 'modules', 'practice.js')
        self.assertIn('#/skill-map/quiz/', prac)
        app = read('js', 'app.js')
        self.assertIn('lad.cps.indexOf(sd.competency_id)', app)
        self.assertIn("getJson('data/competency_map_v02.json')", app)
        ui = read('js', 'modules', 'skill-map.js')
        self.assertIn('background-color:#05121A !important', ui)
        self.assertIn('color:#EAF6FF !important', ui)
        self.assertIn('기존 역량 10', ui)
        bank = json.loads(read('data', 'skill_map', 'questions.json'))
        by = {q['id']: q for q in bank['questions']}
        self.assertIn('재정경제부장관', by['purchase-03']['explain'])
        self.assertNotIn('기획재정부', by['purchase-03']['explain'])
        self.assertIn('1-7. 계산증명', by['cause-06']['src'])
        self.assertIn('출석한 위원과 교직원의 성명', by['meeting-01']['choices'][0])
        self.assertTrue(by['meeting-01']['choices'][0].endswith('성명 및 표결수 등'))
        self.assertEqual(
            by['meeting-01']['explain'],
            '제9조제1항은 회의록에 일시·안건·의사·출석한 위원과 교직원의 성명·표결수 등을 적도록 한다.',
        )
        self.assertFalse(any('만)만' in c or '생략)만으로' in c for c in by['meeting-01']['choices']))
        self.assertIn('사업연도 보조금 예산', by['glocal-04']['choices'][0])
        self.assertIn('4동·복지동', by['dorm-01']['explain'])

if __name__ == '__main__':
    unittest.main()
