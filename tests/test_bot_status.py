"""봇 작업 현황(#/bots) 시험: python3 -m unittest tests.test_bot_status
- data/bot_status.json 모양·개인정보(사람 칸 없음, 전화·계좌·이메일 모양 없음)
- 변환 스크립트(볼트 99 봇/스크립트/bot_status_build.py)가 있으면 작은 표로 분류·이름 지우기 확인(없으면 건너뜀)
- 홈에서 바로 들어가는 줄, 모듈 등록, 캐시 버전"""
import importlib.util, json, os, re, sys, unittest
sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hjpii  # noqa: E402
SCRIPT = '/home/box/vault/봇공유/99 봇/스크립트/bot_status_build.py'


def read(*p):
    return open(os.path.join(ROOT, *p), encoding='utf-8').read()


class DataFile(unittest.TestCase):
    def setUp(self):
        self.d = json.loads(read('data', 'bot_status.json'))

    def test_shape(self):
        self.assertEqual(self.d['version'], 1)
        self.assertIn('현황판', self.d['source'])
        for k in ('read_at', 'built_at', 'built_iso', 'columns', 'counts', 'tasks'):
            self.assertIn(k, self.d)
        allowed = {'t', 'title', 'bot', 'state', 'raw', 'progress', 'verified', 'due', 'updated', 'yujin', 'risk'}
        for t in self.d['tasks']:
            self.assertLessEqual(set(t), allowed)
            self.assertIn(t['state'], ('진행', '대기(유진님 몫)', '막힘', '끝'))

    def test_no_pii_shapes(self):
        for path, s in hjpii.walk_strings(self.d):
            hits = [h for h in hjpii.find_pii(s) if h != '이름 의심']
            self.assertEqual(hits, [], path)
        blob = json.dumps(self.d, ensure_ascii=False)
        for k in ('담당·상대', '근거', '다음 행동'):
            self.assertNotIn('"' + k + '"', blob)


@unittest.skipUnless(os.path.exists(SCRIPT), '볼트 변환 스크립트 없음')
class Build(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('bot_status_build', SCRIPT)
        self.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.m)
        self.hjpii, self.mc = self.m.tools(ROOT)

    def rows(self, extra_head=(), extra=None):
        head = ['ID', '업무명', '분류', '상태', '지출단계', '담당·상대', '마감일', '출처', '근거', '다음 행동', '최종수정', '수정한 봇', '담당 1봇'] + list(extra_head)
        data = [
            ['T101', '홍길동 교수님 특강 운영계획 결재', '특강', '확인 필요', '품의', '나 → 홍길동 교수님', '2026-10-23', '', '', '운영계획 결재 올리기', '2026-10-21 17:18', '인수인계봇', '인수인계봇'],
            ['T102', '3D 다듬기', '기타', '진행 중', '해당없음', '춘식이', '', '', '', '작업', '2026-10-21 20:00', '춘식이', '춘식이'],
            ['T103', '정기검사 대비', '행정일반', '대기', '해당없음', '국토부 → 유진님', '2026-12-02', '', '정기검사 매년', '요청 오면 대응', '2026-10-21 17:18', '인수인계봇', '규정봇'],
            ['T104', '예전 일', '기타', '취소(결재 회수 완료)', '해당없음', '나', '2026-10-01', '', '', '', '2026-10-20 10:00', '인수인계봇', ''],
            ['T105', '단가 미결', '기타', '보류', '해당없음', '나', '', '', '', '나중에', '2026-10-21 09:00', '인수인계봇', ''],
            ['T106', '대기: KORUS', '묶음', '대기', '해당없음', '인수인계봇(묶음)', '', '', '', 'T107', '2026-10-21 09:00', '인수인계봇', '인수인계봇'],
            ['T107', '실습재료 지출결의', '지출', '할 일', '지출결의', '나 → 재무과', '2026-10-30', '', '', '검수 뒤 결의', '2026-10-21 09:00', '인수인계봇', '지출단계 리마인더'],
        ]
        if extra:
            data = [r + extra.get(r[0], ['']) * len(extra_head) for r in data]
        return [head] + data

    def test_classify_and_scrub(self):
        obj, names, removed = self.m.build(self.rows(), '2026-10-21', self.hjpii, self.mc)
        by = {t['t']: t for t in obj['tasks']}
        self.assertNotIn('T106', by)  # 묶음 줄은 꼬리표로만
        self.assertEqual(by['T101']['state'], '대기(유진님 몫)')
        self.assertIn('결재', by['T101']['yujin'])
        self.assertNotIn('홍길동', by['T101']['title'])
        self.assertEqual(by['T102']['state'], '진행')
        self.assertEqual(by['T103']['state'], '막힘')
        self.assertIn('감사·검사', by['T103']['risk'])
        self.assertEqual(by['T104']['state'], '끝')
        self.assertEqual(by['T105']['state'], '막힘')
        self.assertEqual(by['T107']['state'], '대기(유진님 몫)')
        self.assertIn('KORUS 입력', by['T107']['yujin'])
        self.assertIsNone(by['T102']['progress'])
        self.assertFalse(obj['columns']['progress'])
        self.assertEqual(self.m.check(obj, names, self.hjpii), [])

    def test_progress_verified_columns(self):
        rows = self.rows(('진행률', '검증'), {'T102': ['60%'], 'T101': ['0.4']})
        rows[1+1][-1] = '클로드 10.21.'
        obj, _, _ = self.m.build(rows, '2026-10-21', self.hjpii, self.mc)
        by = {t['t']: t for t in obj['tasks']}
        self.assertTrue(obj['columns']['progress'] and obj['columns']['verified'])
        self.assertEqual(by['T102']['progress'], 60)
        self.assertEqual(by['T101']['progress'], 40)
        self.assertEqual(by['T102']['verified'], '클로드 10.21.')


class Wiring(unittest.TestCase):
    def test_home_entry_and_module(self):
        self.assertIn('data-go="#/bots"', read('js', 'modules', 'home.js'))
        self.assertIn("'bots'", read('js', 'registry.js'))
        self.assertIn('ShellModules.bots', read('js', 'modules', 'bots.js'))
        self.assertIn('js/botstatus-core.js', read('index.html'))
        self.assertGreaterEqual(int(re.search(r"'hj-v(\d+)'", read('sw.js')).group(1)), 19)
        self.assertNotIn('?v=18', read('index.html'))


if __name__ == '__main__':
    unittest.main()
