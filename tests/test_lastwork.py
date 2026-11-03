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



class SelfFeed(unittest.TestCase):
    """261103 T092: 30분 루틴이 만든 데이터 커밋(「data: lastwork T092 갱신·meta …」)의 커밋 시각을 작업 시각으로 읽던 버그."""
    def setUp(self):
        import subprocess
        self.r = tempfile.mkdtemp()
        self.sp = subprocess
        self.git('init', '-q')

    def git(self, *a, when=None):
        env = dict(os.environ, GIT_AUTHOR_NAME='t', GIT_AUTHOR_EMAIL='t@t', GIT_COMMITTER_NAME='t', GIT_COMMITTER_EMAIL='t@t', TZ='Asia/Seoul')
        if when:
            env.update(GIT_AUTHOR_DATE=when + ' +0900', GIT_COMMITTER_DATE=when + ' +0900')
        self.sp.run(['git', '-C', self.r] + list(a), check=True, env=env, capture_output=True)

    def commit(self, when, subject, files):
        for rel, text in files.items():
            w(os.path.join(self.r, rel), text)
        self.git('add', '-A')
        self.git('commit', '-q', '-m', subject, when=when)

    def lw(self, tasks):
        return json.dumps({'version': 1, 'tasks': tasks})

    def got(self):
        return lastwork.collect(os.path.join(self.r, 'no-vault'), os.path.join(self.r, 'no.log'), self.r, NOW)[0]

    def test_routine_commit_time_ignored_real_work_kept(self):
        self.commit('2026-10-30 14:30', 'feat: T200 화면 고침', {'tools/x.py': '1'})
        self.commit('2026-10-30 15:11', 'data: lastwork T200 갱신·meta 261030 1511',
                    {'data/lastwork.json': self.lw({'T200': '2026-10-30 14:30'}), 'data/meta.json': '{"a": 1}'})
        self.commit('2026-10-30 15:40', 'data: meta 261030 1540', {'data/meta.json': '{"a": 2}'})
        self.assertEqual(self.got().get('T200'), '2026-10-30 14:30')

    def test_data_only_commit_not_evidence(self):
        self.commit('2026-10-30 10:00', 'feat: 시작', {'tools/x.py': '1'})
        self.commit('2026-10-30 15:20', 'chore(data): 현황판 다시 읽음 T201 완료', {'data/status.json': '{}'})
        self.assertNotIn('T201', self.got())

    def test_value_written_by_routine_kept(self):
        # 루틴이 lastwork.json 에 실제로 바꿔 쓴 값(정상 근거)은 유지하되, 커밋 시각(16:00)이 아니라 쓴 값(12:00)
        self.commit('2026-10-30 10:00', 'feat: 시작', {'tools/x.py': '1', 'data/lastwork.json': self.lw({})})
        self.commit('2026-10-30 16:00', 'data: lastwork T202 갱신', {'data/lastwork.json': self.lw({'T202': '2026-10-30 12:00'})})
        self.assertEqual(self.got().get('T202'), '2026-10-30 12:00')

    def test_real_fix_commit_with_refresh_scope_counts(self):
        self.commit('2026-10-30 13:00', 'fix(refresh): T203 단계 이름 고침', {'tools/refresh_all.py': '1', 'data/meta.json': '{}'})
        self.assertEqual(self.got().get('T203'), '2026-10-30 13:00')

    def test_own_tool_commit_ignored_even_with_t_in_subject(self):
        # 261103: lastwork 고치는 squash 커밋 제목에 T092 가 들어가 17:58 로 끌려간 일. 이 도구 자신만 바꾼 커밋은 근거 아님
        self.commit('2026-10-30 14:30', 'feat: T300 화면 고침', {'js/a.js': '1'})
        self.commit('2026-10-30 17:58', 'fix(lastwork): 루틴 커밋 무시 (T300) (#62)',
                    {'tools/lastwork.py': '1', 'tests/test_lastwork.py': '1'})
        self.commit('2026-10-30 18:10', 'Merge pull request #63 T300', {'tools/lastwork.py': '2', 'data/meta.json': '{}'})
        self.assertEqual(self.got().get('T300'), '2026-10-30 14:30')

    def test_own_tool_plus_other_code_counts(self):
        self.commit('2026-10-30 12:00', 'feat: T301 보드와 lastwork 같이 고침', {'tools/lastwork.py': '1', 'js/board.js': '1'})
        self.assertEqual(self.got().get('T301'), '2026-10-30 12:00')

    def test_routine_rule(self):
        R = lastwork.routine_commit
        self.assertTrue(R('data: meta 261103 1737', ['data/meta.json']))
        self.assertTrue(R('lastwork T092', ['tools/x.py']))
        self.assertTrue(R('meta: 30분 갱신', []))
        self.assertTrue(R('chore: 수치 T1', ['data/a.json', 'data/b.json']))
        self.assertFalse(R('fix(refresh): 키 이름', ['tools/refresh_all.py']))
        self.assertFalse(R('feat: T5', ['data/a.json', 'js/a.js']))
        self.assertFalse(R('Merge branch x', []))
        self.assertTrue(R('fix(lastwork): x (#62)', ['tools/lastwork.py', 'tests/test_lastwork.py']))
        self.assertFalse(R('fix(lastwork): x', ['tools/lastwork.py', 'tools/hjpii.py']))

if __name__ == '__main__':
    unittest.main()
