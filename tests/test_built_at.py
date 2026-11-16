"""tools/built_at.py: python3 -m unittest tests.test_built_at"""
import datetime as dt
import json
import os
import subprocess
import tempfile
import unittest

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import built_at  # noqa: E402

KST = dt.timezone(dt.timedelta(hours=9))


class FromRaw(unittest.TestCase):
    def test_uses_timestamp_field_when_present(self):
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, 'raw.json')
            with open(p, 'w', encoding='utf-8') as f:
                json.dump({'spreadsheetId': 'x', 'fetched_at': '2026-11-16T08:15:00+09:00', 'ranges': []}, f)
            # mtime is today, field must win
            self.assertEqual(built_at.from_raw(p), '2026-11-16T08:15:00+09:00')

    def test_falls_back_to_mtime(self):
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, 'raw.json')
            with open(p, 'w', encoding='utf-8') as f:
                json.dump({'spreadsheetId': 'x', 'truncated': False, 'ranges': []}, f)
            want = dt.datetime(2026, 11, 11, 19, 14, 19, tzinfo=KST)
            os.utime(p, (want.timestamp(), want.timestamp()))
            self.assertEqual(built_at.from_raw(p), '2026-11-11T19:14:19+09:00')
            self.assertEqual(built_at.from_mtime(p), '2026-11-11T19:14:19+09:00')


class FromGit(unittest.TestCase):
    def test_uses_content_commit_time_not_stamp_only(self):
        with tempfile.TemporaryDirectory() as td:
            subprocess.check_call(['git', 'init', '-q'], cwd=td)
            subprocess.check_call(['git', 'config', 'user.name', 'test'], cwd=td)
            subprocess.check_call(['git', 'config', 'user.email', 't@example.com'], cwd=td)
            p = os.path.join(td, 'todo.json')
            with open(p, 'w', encoding='utf-8') as f:
                json.dump({'version': 'v01', 'items': [1]}, f)
            env = os.environ.copy()
            env['GIT_AUTHOR_DATE'] = '2026-11-10T15:31:53+09:00'
            env['GIT_COMMITTER_DATE'] = '2026-11-10T15:31:53+09:00'
            subprocess.check_call(['git', 'add', 'todo.json'], cwd=td)
            subprocess.check_call(['git', 'commit', '-q', '-m', 'content'], cwd=td, env=env)
            self.assertEqual(built_at.from_git(p, td), '2026-11-10T15:31:53+09:00')
            # stamp-only commit must not change source_at
            obj = json.loads(open(p, encoding='utf-8').read())
            obj['source_at'] = '2026-11-10T15:31:53+09:00'
            with open(p, 'w', encoding='utf-8') as f:
                json.dump(obj, f)
            env2 = env.copy()
            env2['GIT_AUTHOR_DATE'] = '2026-11-16T10:00:00+09:00'
            env2['GIT_COMMITTER_DATE'] = '2026-11-16T10:00:00+09:00'
            subprocess.check_call(['git', 'add', 'todo.json'], cwd=td)
            subprocess.check_call(['git', 'commit', '-q', '-m', 'stamp only'], cwd=td, env=env2)
            self.assertEqual(built_at.from_git(p, td), '2026-11-10T15:31:53+09:00')


class Iso(unittest.TestCase):
    def test_converts_utc_to_kst(self):
        self.assertEqual(built_at.from_iso('2026-11-10T06:31:53Z'), '2026-11-10T15:31:53+09:00')
        self.assertEqual(built_at.from_iso('2026-11-10T15:31:53+09:00'), '2026-11-10T15:31:53+09:00')
        self.assertIsNone(built_at.from_iso(''))
        self.assertIsNone(built_at.from_iso('not-a-date'))


if __name__ == '__main__':
    unittest.main()
