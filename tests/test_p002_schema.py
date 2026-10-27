"""P002 Phase B: CP01~CP10 + T020 zero-tol + weekly/anki hooks."""
import json, os, re, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load(name):
    with open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return json.load(f)

PACK = load('public-pack.json')
MAP = load('data/competency_map_v02.json')
ZT = load('data/t020_zero_tolerance.json')
ANKI = load('data/wrong_anki_seed.json')
APP = open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
STUDY = open(os.path.join(ROOT, 'js', 'modules', 'study.js'), encoding='utf-8').read()
PRAC = open(os.path.join(ROOT, 'js', 'modules', 'practice.js'), encoding='utf-8').read()
SW = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()


class TP002Schema(unittest.TestCase):
    def test_cp_ids(self):
        ids = [c['id'] for c in MAP['competencies']]
        self.assertEqual(ids, ['CP%02d' % i for i in range(1, 11)])
        self.assertEqual(MAP['decisions']['관련'], '편람꼴')
        self.assertEqual(MAP['decisions']['변경'], '(변경)+2669')
        self.assertEqual(MAP['weekly_hours_default'], 3)

    def test_l_and_days(self):
        self.assertEqual(MAP['by_학습id']['L03'], 'CP02')
        self.assertEqual(MAP['by_학습id']['L47'], 'CP03')
        self.assertEqual(MAP['by_학습id']['L08'], 'CP05')
        self.assertEqual(MAP['by_study_day']['5'], 'CP02')
        self.assertIn('t020', MAP['by_task'])

    def test_t020_ready(self):
        self.assertEqual(ZT['tasks'][0]['id'], 't020')
        self.assertFalse(ZT['tasks'][0]['hold'])
        self.assertEqual(ZT['tasks'][0]['zero_tol'], ['G1_quote4', 'G2_fund', 'G3_ref'])
        self.assertGreaterEqual(len(ZT['questions']), 9)
        for q in ZT['questions']:
            self.assertFalse(q['hold'], q['id'])
            self.assertIn(q['zero_tolerance'], ('견적4칸', '관련근거', '재원분리'))
        # P0 uses existing L ids
        works = {q['업무id'] for q in ZT['questions']}
        self.assertTrue(works <= {'L03', 'L47', 'L08'})

    def test_anki_seed(self):
        self.assertGreaterEqual(len(ANKI['cards']), 12)
        self.assertIn('ANKI-13', {c['id'] for c in ANKI['cards']})
        self.assertIn('ANKI-14', {c['id'] for c in ANKI['cards']})
        self.assertIn('ANKI-15', {c['id'] for c in ANKI['cards']})
        self.assertIn('ANKI-16', {c['id'] for c in ANKI['cards']})
        self.assertEqual(ANKI['intervals_days'], [1, 3, 7, 14, 30])

    def test_no_pii(self):
        bodies = [json.dumps(q, ensure_ascii=False) for q in ZT['questions']]
        bodies += [json.dumps(t, ensure_ascii=False) for t in ZT['tasks']]
        bodies += [json.dumps(c, ensure_ascii=False) for c in ANKI['cards']]
        blob = '\n'.join(bodies)
        self.assertNotIn('한성진', blob)
        self.assertNotIn('20261BD', blob)
        self.assertIsNone(re.search(r'\d{2,4}-\d{3,4}-\d{4}', blob))

    def test_ids_unique(self):
        pack_q = {q['id'] for q in PACK['entities']['questions']}
        for q in ZT['questions']:
            self.assertNotIn(q['id'], pack_q, q['id'])
        pack_t = {t['id'] for t in PACK['entities']['tasks']}
        self.assertNotIn('t020', pack_t)

    def test_app_hooks(self):
        self.assertIn("getJson('data/competency_map_v02.json')", APP)
        self.assertIn("getJson('data/t020_zero_tolerance.json')", APP)
        self.assertIn("getJson('data/wrong_anki_seed.json')", APP)
        self.assertIn('weekEngine', APP)
        self.assertIn('ap3-week-force', APP)
        self.assertIn('wrongDeck', APP)
        self.assertIn('ap3-wrong-meta', APP)
        self.assertIn('이번 주 카드', STUDY)
        self.assertIn('go-force', STUDY)
        self.assertIn('wrong/anki', PRAC)
        self.assertIn('hj-v48', SW)
        self.assertIn('app.js?v=31', SW)


if __name__ == '__main__':
    unittest.main()
