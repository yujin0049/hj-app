"""학과·사람별 업무(#/who) 시험: python3 -m unittest tests.test_who"""
import json, os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import hjpii
R = os.path.join(os.path.dirname(__file__), '..')
def read(*p): return open(os.path.join(R, *p), encoding='utf-8').read()

class Who(unittest.TestCase):
    def setUp(self): self.d = json.loads(read('data', 'who.json'))
    def test_shape(self):
        self.assertEqual([x['name'] for x in self.d['depts']], ['행정지원과', '항공정비과', '항공호텔관광과'])
        self.assertGreaterEqual(len(self.d['questions']), 40)
        for q in self.d['questions']:
            self.assertEqual(len(q['choices']), 4, q['id'])
            self.assertTrue(0 <= q['answer'] < 4 and len(q['why']) >= 8, q['id'])
        self.assertEqual(self.d['questions'][0]['cat'], 'flow')  # 유진님 업무와 겹치는 것부터
    def test_guess_never_answer(self):
        guess = {p['label'] for p in self.d['people'] if p['guess']}
        for q in self.d['questions']:
            self.assertNotIn(q['choices'][q['answer']], guess, q['id'])
        self.assertEqual(self.d['guess_n'], len(guess))
    def test_no_pii(self):
        for path, s in hjpii.walk_strings(self.d):
            self.assertEqual([h for h in hjpii.find_pii(s) if h != '이름 의심'], [], path)
    def test_wired(self):
        self.assertIn("'who'", read('js', 'registry.js'))
        self.assertIn('data-go="#/who"', read('js', 'modules', 'home.js'))
        self.assertIn("menuBtn('who'", read('js', 'modules', 'more.js'))
