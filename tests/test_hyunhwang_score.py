"""현황판 건별 수치화 시험: python3 -m unittest tests.test_hyunhwang_score
- data/hyunhwang_score.json 모양·개인정보(전화·계좌·이메일 모양 없음, F: 전체 경로·file 링크 없음)
- 볼트 스크립트(99 봇/스크립트/hyunhwang_score.py)가 있으면 작은 표로 단계 추정·진행률 계산 확인(없으면 건너뜀)"""
import importlib.util, json, os, re, sys, unittest
sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hjpii  # noqa: E402
SCRIPT = '/home/box/vault/봇공유/99 봇/스크립트/hyunhwang_score.py'


class PublicTakedown(unittest.TestCase):
    # 261023 유진님 「적용」: 현황판 수치화도 공개 사이트에서 내림 → 저장소에 다시 올리지 않는다
    def test_not_shipped(self):
        self.assertFalse(os.path.exists(os.path.join(ROOT, 'data', 'hyunhwang_score.json')))


HS_FILE = os.environ.get('HJ_HYUNHWANG_SCORE') or os.path.join(ROOT, 'data', 'hyunhwang_score.json')


@unittest.skipUnless(os.path.exists(HS_FILE), 'hyunhwang_score.json 공개 저장소에서 내림(261023) · HJ_HYUNHWANG_SCORE 로 검사')
class DataFile(unittest.TestCase):
    def setUp(self):
        with open(HS_FILE, encoding='utf-8') as fh:
            self.d = json.load(fh)

    def test_shape(self):
        for k in ('summary', 'tasks', 'types', 'rule', 'built_iso'):
            self.assertIn(k, self.d)
        allowed = {'t', 'title', 'type', 'status', 'cancelled', 'steps', 'done', 'total', 'pct', 'o', 'o_diff', 'next', 'owner', 'due', 'd_left', 'folder', 'basis', 'yujin'}
        for t in self.d['tasks']:
            self.assertLessEqual(set(t), allowed)
            self.assertIn(t['owner'], ('유진님', '봇', '-'))
            if not t['cancelled']:
                self.assertEqual(t['pct'], int(round(100.0 * t['done'] / t['total'] + 1e-9)))

    def test_no_pii(self):
        for path, s in hjpii.walk_strings(self.d):
            hits = [h for h in hjpii.find_pii(s) if h != '이름 의심']
            self.assertEqual(hits, [], path)
            self.assertNotRegex(s, r'file:|^[A-Z]:\\\\', path)
        blob = json.dumps(self.d, ensure_ascii=False)
        for k in ('담당·상대', '근거', '다음 행동', 'folder_full'):
            self.assertNotIn('"' + k + '"', blob)


@unittest.skipUnless(os.path.exists(SCRIPT), '볼트 스크립트 없음')
class Script(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('hyunhwang_score', SCRIPT)
        cls.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.m)
        cls.cfg = json.load(open(cls.m.STEPS, encoding='utf-8'))

    def test_types(self):
        p = self.m.pick_type
        self.assertEqual(p(self.cfg, '재료비', '원인행위 전(10.21.)', 'DNA+ 재료'), '지출')
        self.assertEqual(p(self.cfg, '강사료', '해당없음', '10월 강사료'), '강사료')
        self.assertEqual(p(self.cfg, '견학', '해당없음', '공군 견학'), '행사')
        self.assertEqual(p(self.cfg, '행정일반', '해당없음', '결과보고 제출'), '공문·보고')
        self.assertEqual(p(self.cfg, '행정일반', '해당없음', '봉투 준비'), '기타')

    def test_score(self):
        s = self.m.score_one
        r = s(self.cfg, '지출', '진행 중', '품의 완료 → 원인행위 전(11.20. 입금 대기)', '', None)
        self.assertEqual((r['done'], r['total']), (4, 6))  # 마지막 화살표 뒤 「원인행위 전」 → 그 앞 4단계 끝
        r = s(self.cfg, '지출', '할 일', '지출결의', '귀국 뒤 정산', None)  # E칸 = 지금 와 있는 단계 → 앞 단계는 할 일이어도 끝, 그 단계는 아직
        self.assertEqual((r['done'], r['pct']), (5, 83))
        self.assertFalse(r['steps'][5]['done'])
        r = s(self.cfg, '지출', '완료', '지출결의', '', None)
        self.assertEqual(r['pct'], 100)
        self.assertEqual(len(self.cfg['types']['기타']['steps']), 4)
        self.assertIn('검수·세금계산서가 먼저', self.cfg['types']['지출']['_메모'])
        r = s(self.cfg, '지출', '진행 중', '해당없음', '검수 완료, 세금계산서 받음', None)
        self.assertEqual(r['done'], 4)
        self.assertTrue(all(x['done'] for x in r['steps'][:4]))
        r = s(self.cfg, '기타', '완료', '', '', None)
        self.assertEqual(r['pct'], 100)
        r = s(self.cfg, '행사', '취소(결재 회수 완료)', '', '', None)
        self.assertTrue(r['cancelled'])
        self.assertIsNone(r['pct'])
        r = s(self.cfg, '공문·보고', '확인 필요', '해당없음', '', None)
        self.assertEqual(r['done'], 1)

    def test_clip(self):
        c = self.m.clip
        self.assertEqual(c('다른 봇은 담당 1봇에게 ‘추가 요청’으로 / 입사신청서 받아 제출'), '입사신청서 받아 제출')
        self.assertTrue(len(c('가' * 200)) <= 70)


if __name__ == '__main__':
    unittest.main()
