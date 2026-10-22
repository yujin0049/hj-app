"""전임자 업무 방식 문제(HS-01~08) 시험. 근거: 볼트 10 업무 업무방식 노트 「연습장 문제 후보」(인수인계봇 T101, 10.22.).
메일 첫머리·끝맺음 문제는 업무 PC Claude Code 결과(①)가 나온 뒤 추가될 수 있음. 모르는 것은 넣지 않음.
공개 저장소: 실명(전임자 포함)·전화·메일을 문제에 넣지 않음(「전임 선생님」으로 씀)."""
import json, os, re, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT, 'public-pack.json'), encoding='utf-8') as f:
    PACK = json.load(f)
with open(os.path.join(ROOT, 'data', 'extra_questions.json'), encoding='utf-8') as f:
    EXTRA = json.load(f)
HS = [q for q in EXTRA['questions'] if q['id'].startswith('HS-')]
APP = open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()


class THSQuiz(unittest.TestCase):
    def test_count_and_ids(self):
        self.assertEqual([q['id'] for q in HS], ['HS-%02d' % i for i in range(1, 9)])

    def test_answer_and_source(self):
        for q in HS:
            self.assertTrue(q['근거'].strip(), q['id'])
            if q['유형'] == '순서':
                self.assertEqual(sorted(q['정답'].split(' → ')), sorted(q['보기']), q['id'])
                self.assertNotEqual(' → '.join(q['보기']), q['정답'], q['id'] + ' 보기가 이미 정답 순서')
            else:
                self.assertIn(q['정답'], q['보기'], q['id'])

    def test_no_personal_info(self):
        text = json.dumps(HS, ensure_ascii=False)
        self.assertNotIn('한성진', text)
        self.assertIsNone(re.search(r'\d{2,4}-\d{3,4}-\d{4}|@|\d{6}-\d{7}', text))

    def test_ids_unique(self):
        ids = [q['id'] for q in PACK['entities']['questions']] + [q['id'] for q in EXTRA['questions']]
        self.assertEqual(len(ids), len(set(ids)))

    def test_same_shape_as_pack(self):
        keys = set(PACK['entities']['questions'][0])
        for q in HS:
            self.assertEqual(set(q), keys, q['id'])

    def test_app_loads_extra(self):
        self.assertIn("getJson('data/extra_questions.json')", APP)
        self.assertIn('addExtraQuestions(pack, r[4])', APP)


if __name__ == '__main__':
    unittest.main()
