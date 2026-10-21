"""초과강사료 결재권자 시험 (규정봇 검토 10.21.). 실행: python -m unittest tests/test_g16_approver.py -v
- g16(10월 초과강사료 의뢰) 내용: 계획=부총장, 지급 의뢰=경남항공교육원장, 집행=센터장. 「평생교육원장」 없음
- g12(9월 계획) 「부총장(대결)」, 강사료 과목 「인건비-기타인건비」는 그대로
앱 자료에서 g16 내용이 있는 곳 = 배울 업무 L12(강사료 지급계획 기안). 자료의 regulations:g16 은 다른 카드(개인정보 보호법)라 안 건드림."""
import copy, json, os, sys, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import link_sources as L

with open(os.path.join(ROOT, 'public-pack.json'), encoding='utf-8') as f:
    RAW = json.load(f)
with open(os.path.join(ROOT, 'data', 'card_overrides.json'), encoding='utf-8') as f:
    OV = json.load(f)
PACK = L.apply_override_obj(copy.deepcopy(RAW), OV)


def one(pack, col, cid):
    return [c for c in pack['entities'][col] if str(c.get('id')) == cid][0]


class T(unittest.TestCase):
    def test_g16_three_approvers(self):
        v = one(PACK, 'learning_items', 'L12')['verify']
        for w in ('계획=부총장', '지급 의뢰=경남항공교육원장', '집행=센터장', 'g16'):
            self.assertIn(w, v)

    def test_no_pyeonggyo_anywhere(self):
        self.assertIn('평생교육원장', json.dumps(RAW, ensure_ascii=False))   # 원래 자료에는 있었음
        self.assertNotIn('평생교육원장', json.dumps(PACK, ensure_ascii=False))
        self.assertNotIn('평생교육원장', json.dumps(OV, ensure_ascii=False))

    def test_g12_unchanged(self):
        v = one(PACK, 'learning_items', 'L12')['verify']
        self.assertIn('g12) 결재 부총장(대결)', v)
        self.assertEqual(one(PACK, 'regulations', 'g12'), one(RAW, 'regulations', 'g12'))
        self.assertEqual(one(PACK, 'regulations', 'g16'), one(RAW, 'regulations', 'g16'))
        q = {x['id']: x['정답'] for x in PACK['entities']['questions']}
        self.assertEqual(q['L12-01'], '부총장')   # 계획 문서 = 부총장

    def test_subject_unchanged(self):
        self.assertIn('강사료 과목은 인건비-기타인건비 그대로', one(PACK, 'learning_items', 'L12')['verify'])
        self.assertEqual(PACK['entities']['budget_lines'], RAW['entities']['budget_lines'])
        self.assertNotIn('일반수용비', one(PACK, 'learning_items', 'L12')['verify'])


if __name__ == '__main__':
    unittest.main()
