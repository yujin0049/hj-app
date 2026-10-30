"""원인행위 종류별 붙임 목록(data/cause_attach_types.json)과 화면 연결."""
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATERIAL = ['계획 공문', '견적서', '비교견적서(500만원 이상)', '납품서 또는 거래명세서', '계약서(승낙사항)',
            '물품명세서, 물품사진', '신용카드매출전표 또는 전자세금계산서(사업자등록증,통장사본)',
            '국세/지방세완납증명서(500만원 이상)', '(홍보물, 기념품 경우)기념품불출대장 및 수령인 서명대장']


def load():
    with open(os.path.join(ROOT, 'data', 'cause_attach_types.json'), encoding='utf-8') as fh:
        return json.load(fh)


class T(unittest.TestCase):
    def test_material_follows_appendix_order(self):
        d = load()
        mat = [t for t in d['types'] if t['id'] == 'material'][0]
        self.assertEqual([x['name'] for x in mat['items']], MATERIAL)
        self.assertEqual([x['no'] for x in mat['items']], [str(i) for i in range(1, 10)])
        tax = mat['items'][7]
        self.assertIn('4대보험 납부확인으로 대체 가능', tax['note'])
        self.assertIn('지방세', tax['later'])
        self.assertNotIn('청구서', ' '.join(x['name'] for x in mat['items']))
        self.assertIn('청구서', mat['ref'])
        self.assertNotIn('appendix', mat)

    def test_every_type_has_numbered_items(self):
        d = load()
        self.assertEqual(len(d['types']), 17)  # 부록 16종류, 업무추진비만 회의비·식대 두 갈래
        ids = [t['id'] for t in d['types']]
        self.assertEqual(len(ids), len(set(ids)))
        for t in d['types']:
            self.assertTrue(t['items'], t['id'])
            for x in t['items']:
                self.assertTrue(re.fullmatch(r'\d+', x['no']), (t['id'], x))
                self.assertTrue(x['name'].strip())

    def test_unknown_cells_say_later(self):
        d = load()
        self.assertEqual(d['later'], '나중에 업데이트')
        self.assertEqual(d['sourcePage'], '나중에 업데이트')

    def test_no_contact_info(self):
        with open(os.path.join(ROOT, 'data', 'cause_attach_types.json'), encoding='utf-8') as fh:
            text = fh.read()
        self.assertNotRegex(text, r'\d{2,3}-\d{3,4}-\d{4}')
        self.assertNotRegex(text, r'[\w.]+@[\w.]+')
        self.assertNotRegex(text, r'\d{6}-\d{7}')

    def test_screen_reads_the_json(self):
        with open(os.path.join(ROOT, 'js', 'modules', 'ot-attach.js'), encoding='utf-8') as fh:
            ui = fh.read()
        self.assertIn('data/cause_attach_types.json', ui)
        self.assertIn('id="ca-type"', ui)
        self.assertNotIn('<details', ui)


if __name__ == '__main__':
    unittest.main()
