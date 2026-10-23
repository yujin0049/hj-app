"""pii_baseline.py 시험(가짜 저장소). 실행: python3 -m unittest tests.test_pii_baseline
- 같은 파일·같은 이름이면 문장이 바뀌어도 통과, 새 이름이면 1 + 질문목록 한 줄(같은 줄은 다시 안 씀)
- 기준선 파일에 원문 없음"""
import json, os, shutil, sys, tempfile, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import pii_baseline as P  # noqa: E402

N1 = '김' + '가나'   # 저장소에 이름 모양을 남기지 않으려고 실행 때 만든다
N2 = '박' + '다라'


class T(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.d, 'data'))
        self.base = os.path.join(self.d, 'data', 'pii_baseline.json')
        self.q = os.path.join(self.d, '질문목록.md')
        with open(self.q, 'w', encoding='utf-8') as f:
            f.write('# 질문목록\n')
        self.put(N1 + ' 담당 회의 10.23.')
        self.assertEqual(self.run_pb(['--save', '--note', '시험']), 0)

    def tearDown(self):
        shutil.rmtree(self.d)

    def put(self, *texts):
        with open(os.path.join(self.d, 'data', 'x.json'), 'w', encoding='utf-8') as f:
            json.dump({'tasks': [{'title': t} for t in texts]}, f, ensure_ascii=False)

    def run_pb(self, extra=()):
        return P.main(['--qlist', self.q] + list(extra), root=self.d, base=self.base)

    def qlines(self):
        with open(self.q, encoding='utf-8') as f:
            return [l for l in f if l.startswith('- [ ]')]

    def test_baseline_has_no_raw(self):
        with open(self.base, encoding='utf-8') as f:
            s = f.read()
        self.assertNotIn(N1, s)
        self.assertEqual(json.loads(s)['version'], 2)

    def test_changed_sentence_same_name_passes(self):
        self.put('바뀐 문장: ' + N1 + ' 확인 끝, 다음 주 다시', N1 + ' 한 번 더')
        self.assertEqual(self.run_pb(), 0)
        self.assertEqual(self.qlines(), [])

    def test_new_name_fails_and_asks_once(self):
        self.put(N1 + ' 담당', N2 + ' 새로 옴', N2 + ' 또 나옴')
        self.assertEqual(self.run_pb(), 1)
        q = self.qlines()
        self.assertEqual(len(q), 1)
        self.assertIn('pii 새 의심: data/x.json 이름 의심 ' + N2[0] + '*' + N2[-1] + ' → 기준선 추가 여부 (춘식이)', q[0])
        self.assertNotIn(N2, q[0])
        self.assertEqual(self.run_pb(), 1)          # 두 번 돌아도
        self.assertEqual(len(self.qlines()), 1)     # 같은 줄은 다시 안 씀
        with open(self.base, encoding='utf-8') as f:  # 자동 저장 안 함
            self.assertEqual(json.load(f)['count'], 1)

    def test_mask(self):
        self.assertEqual(P.mask('이름 의심', N1), N1[0] + '*' + N1[-1])
        self.assertEqual(P.mask('전화번호', '0' + '10-1234-56' + '78'), '01*******78')


if __name__ == '__main__':
    unittest.main()
