"""사람현황 앱정본(261111 T1~T4) 시험: python3 -m unittest tests.test_people_roles
- 공개 people_roles 에 발령일·연락처 칸 없음, 주소록 밖은 가림 또는 결정된 실명(이름만), people_changes 는 이름 없이 순번만
- coop 팀장 교체는 두 번 넣어도 같음(멱등), 바뀜 비교도 같은 입력 → 같은 출력"""
import copy, json, os, re, sys, unittest
R = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, os.path.join(R, 'tools'))
import make_people_roles as M  # noqa: E402
import make_people_changes as C  # noqa: E402


def rd(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return json.load(f)


class PeopleRoles(unittest.TestCase):
    def setUp(self):
        self.pr = rd('data', 'people_roles.json')
        self.pc = rd('data', 'people_changes.json')
        self.coop = rd('data', 'coop.json')

    def test_no_private_fields(self):
        for p in self.pr['people']:
            for k in M.PRIVATE_KEYS:
                self.assertNotIn(k, p)
        s = json.dumps(self.pr, ensure_ascii=False)
        self.assertIsNone(M.PHONE_RX.search(s))
        self.assertIsNone(M.RRN_RX.search(s))
        self.assertNotIn('생년월일', s)

    def test_patch_people_have_as_of_and_masked_outside_directory(self):
        pat = [p for p in self.pr['people'] if p.get('as_of')]
        self.assertTrue(pat)
        for p in pat:
            if not p['in_directory']:   # 가림 또는 유진님 결정 실명(이름만, id=person:이름)
                self.assertTrue('*' in p['label'] or p['id'] == 'person:' + p['label'])
            if p.get('deputy'):
                self.assertEqual(set(p['deputy']), {'id', 'label'})

    def test_changes_point_by_index_without_names(self):
        n = len(self.pr['people'])
        self.assertEqual(self.pc['meta']['diff_keys'], C.DIFF_KEYS)
        self.assertEqual(self.pc['meta']['n_changed'], len(self.pc['changes']))
        for c in self.pc['changes']:
            self.assertTrue(0 <= c['at'] < n)
            self.assertGreater(len(c), 1)
        labels = {p['label'] for p in self.pr['people']}
        s = json.dumps(self.pc, ensure_ascii=False)
        self.assertFalse([x for x in labels if len(x) >= 2 and x in s])

    def test_changes_idempotent(self):
        before = {'meta': {'id': 'b'}, 'people': copy.deepcopy(self.pr['people'])}
        self.assertEqual(C.diff(before, self.pr)['changes'], [])
        self.assertEqual(C.diff(before, self.pr), C.diff(before, self.pr))

    def test_coop_lead_swap_idempotent(self):
        nodes = [n for ch in self.coop['chains'] for n in ch['nodes']]
        lead = [n for n in nodes if n.get('optional') and n.get('ext') == '']
        self.assertTrue(lead)   # 새 팀장 내선: 번호부 대조 전이면 빈칸
        again, n = M.apply_coop(self.coop, '없는이름', lead[0]['name'])
        self.assertEqual(again, self.coop)
        self.assertEqual(n, {'replaced': 0, 'chain': 0})
        self.assertEqual(self.coop['version'], 'v10')


if __name__ == '__main__':
    unittest.main()
