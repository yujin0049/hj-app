"""일정 owner 가림: python3 -m unittest tests.test_mask_pack"""
import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import mask_pack  # noqa: E402


class MaskOwner(unittest.TestCase):
    def test_keeps_empty_and_self_and_role_only(self):
        self.assertEqual(mask_pack.mask_owner(''), '')
        self.assertEqual(mask_pack.mask_owner('  '), '')
        self.assertEqual(mask_pack.mask_owner('본인'), '본인')
        self.assertEqual(mask_pack.mask_owner('담당자'), '담당자')
        self.assertEqual(mask_pack.mask_owner('교수님'), '교수님')
        self.assertEqual(mask_pack.mask_owner('팀장'), '팀장')

    def test_strips_to_title_or_role(self):
        # 영어·기호 접두어만 써서 검사기가 한글 이름으로 보지 않게 한다
        self.assertEqual(mask_pack.mask_owner('SheetOwner 교수님'), '교수님')
        self.assertEqual(mask_pack.mask_owner('SheetOwner교수님'), '교수님')
        self.assertEqual(mask_pack.mask_owner('OwnerX 팀장'), '팀장')
        self.assertEqual(mask_pack.mask_owner('OwnerY 주무관(글로컬)'), '주무관')
        self.assertEqual(mask_pack.mask_owner('from-sheet'), '담당자')
        self.assertEqual(mask_pack.mask_owner('A 교수'), '교수님')

    def test_pack_schedule_items(self):
        pack = {'entities': {'schedule': {'items': [
            {'id': 's-a', 'owner': 'SheetOwner 교수님', 'title': '받기'},
            {'id': 's-b', 'owner': 'from-sheet', 'title': '검수'},
            {'id': 's-c', 'owner': '본인', 'title': '이수'},
        ]}}}
        mask_pack.mask_pack(pack)
        owners = {it['id']: it['owner'] for it in pack['entities']['schedule']['items']}
        self.assertEqual(owners, {'s-a': '교수님', 's-b': '담당자', 's-c': '본인'})


if __name__ == '__main__':
    unittest.main()
