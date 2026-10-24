"""P002 Phase A: competency_map_v02 + t020_zero_tolerance sidecars + app loaders/hooks."""
import json, os, re, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load(name):
    with open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return json.load(f)

PACK = load('public-pack.json')
MAP = load('data/competency_map_v02.json')
ZT = load('data/t020_zero_tolerance.json')
APP = open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
STUDY = open(os.path.join(ROOT, 'js', 'modules', 'study.js'), encoding='utf-8').read()
PRAC = open(os.path.join(ROOT, 'js', 'modules', 'practice.js'), encoding='utf-8').read()
SW = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()


class TP002Schema(unittest.TestCase):
    def test_map_has_competencies_and_fields(self):
        self.assertGreaterEqual(len(MAP['competencies']), 8)
        self.assertIn('questions', MAP['fields'])
        self.assertIn('competency_id', MAP['fields']['questions'])
        self.assertIn('L03', MAP['by_학습id'])
        self.assertEqual(MAP['by_학습id']['L03'], 'C_QUOTE_CAUSE')
        self.assertIn('W1', MAP['weeks'])

    def test_study_days_mapped(self):
        for d in range(1, 25):
            self.assertIn(str(d), MAP['by_study_day'], d)

    def test_t020_stubs_hold(self):
        self.assertGreaterEqual(len(ZT['questions']), 4)
        self.assertGreaterEqual(len(ZT['tasks']), 2)
        for q in ZT['questions']:
            self.assertTrue(q['hold'], q['id'])
            self.assertIn(q['zero_tolerance'], ('견적4칸', '관련근거'))
        zt_kw = json.dumps(ZT, ensure_ascii=False)
        self.assertIn('견적4칸', zt_kw)
        self.assertIn('관련근거', zt_kw)

    def test_no_pii(self):
        bodies = []
        for q in ZT['questions']:
            bodies.append(json.dumps(q, ensure_ascii=False))
        for t in ZT['tasks']:
            bodies.append(json.dumps({k: t[k] for k in t if k not in ('_설명',)}, ensure_ascii=False))
        blob = '\n'.join(bodies)
        self.assertNotIn('한성진', blob)
        self.assertIsNone(re.search(r'\d{2,4}-\d{3,4}-\d{4}|@[\w.-]+\.\w+', blob))

    def test_ids_unique_vs_pack(self):
        pack_ids = {q['id'] for q in PACK['entities']['questions']}
        for q in ZT['questions']:
            self.assertNotIn(q['id'], pack_ids, q['id'])
        task_ids = {t['id'] for t in PACK['entities']['tasks']}
        for t in ZT['tasks']:
            self.assertNotIn(t['id'], task_ids, t['id'])

    def test_app_loads_sidecars(self):
        self.assertIn("getJson('data/competency_map_v02.json')", APP)
        self.assertIn("getJson('data/t020_zero_tolerance.json')", APP)
        self.assertIn('applyCompetencyMap', APP)
        self.assertIn('mergeT020', APP)
        self.assertIn('weekEngine', APP)
        self.assertIn('wrongDeck', APP)
        self.assertIn('ap3-wrong-queue', APP)

    def test_ui_hooks(self):
        self.assertIn('weekView', STUDY)
        self.assertIn('#/study/week', STUDY)
        self.assertIn('wrong/review', PRAC)
        self.assertIn('hj-v41', SW)
        self.assertIn('app.js?v=25', SW)


if __name__ == '__main__':
    unittest.main()
