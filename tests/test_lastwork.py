"""tools/lastwork.py 시험: python3 -m unittest tests.test_lastwork
- 공개 파일 data/lastwork.json 에는 일 번호(T###)와 시각만. 글·경로·봇 이름·파일 이름은 안 나가요.
- 앞날 시각·충돌 사본·보관함은 버려요. 원자료가 없으면 예전 파일 그대로(종료 1)."""
import json
import os
import re
import sys
import tempfile
import unittest
import datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import lastwork  # noqa: E402

NOW = dt.datetime(2026, 10, 30, 21, 0)


def w(p, text):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(text)


class Collect(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        v = os.path.join(self.d, 'vault')
        w(os.path.join(v, '봇공유', '00 홈', '유진님_명령목록.md'),
          '- 2026-10-29 08:05 아침브리핑 T065실거주·T020검수 F:/비밀/경로 | 담당=대장\n'
          '- 2026-10-31 09:00 앞날 T066\n- 날짜 없는 줄 T067\n')
        w(os.path.join(v, '봇공유', '00 홈', '명령목록_보관_2610.md'), '- 2026-10-20 10:00 T065 옛 지시\n')
        w(os.path.join(v, '10 업무', '261028_T097_시간표_v01.md'), '본문비밀')
        w(os.path.join(v, '10 업무', 'D_261029_0930C_T007_묶음.md'), '')
        w(os.path.join(v, '10 업무', '261030_T098_x (PC 충돌 사본).md'), '')
        w(os.path.join(v, '_archive', '261030_T099_옛것.md'), '')
        self.log = os.path.join(self.d, 'log.tsv')
        w(self.log, '시간\t봇\t작업\n2026-10-30 13:49\t춘식이\tT020 검수 사진 메모비밀\n')
        self.v = v

    def test_only_numbers_and_times(self):
        got, srcs = lastwork.collect(self.v, self.log, self.d, NOW)
        self.assertEqual(got, {'T065': '2026-10-29 08:05', 'T020': '2026-10-30 13:49', 'T097': '2026-10-28', 'T007': '2026-10-29 09:30'})
        self.assertGreaterEqual(srcs, 3)

    def test_main_writes_safe_file(self):
        out = os.path.join(self.d, 'lastwork.json')
        rc = lastwork.main(['--out', out, '--vault', self.v, '--log', self.log, '--now', '2026-10-30 21:00'])
        self.assertEqual(rc, 0)
        text = open(out, encoding='utf-8').read()
        for bad in ('F:/', '/home/box', '비밀', '대장', '춘식이', '시간표', '.md'):
            self.assertNotIn(bad, text)
        obj = json.loads(text)
        for k, v in obj['tasks'].items():
            self.assertRegex(k, r'^T\d{3,4}$')
            self.assertRegex(v, r'^20\d\d-\d\d-\d\d( \d\d:\d\d)?$')

    def test_no_sources_keeps_old(self):
        out = os.path.join(self.d, 'old.json')
        w(out, '{"old": 1}')
        rc = lastwork.main(['--out', out, '--vault', os.path.join(self.d, '없음'), '--log', os.path.join(self.d, '없음.tsv')])
        self.assertEqual(rc, 1)
        self.assertEqual(open(out, encoding='utf-8').read(), '{"old": 1}')


class Shipped(unittest.TestCase):
    def test_shipped_file_shape(self):
        p = os.path.join(ROOT, 'data', 'lastwork.json')
        obj = json.load(open(p, encoding='utf-8'))
        self.assertEqual(set(obj), {'version', 'built_at', 'source', 'tasks'})
        for k, v in obj['tasks'].items():
            self.assertRegex(k, r'^T\d{3,4}$')
            self.assertRegex(v, r'^20\d\d-\d\d-\d\d( \d\d:\d\d)?$')
        self.assertNotRegex(open(p, encoding='utf-8').read(), r'[A-Z]:[\\/]|/home/|/workspace/')


if __name__ == '__main__':
    unittest.main()
