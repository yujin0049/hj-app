"""워커 「사람 이름」 어절 기준선(안 C, 261102 춘식이 결정) 동작 시험. 가짜 이름만, 그것도 시험할 때 조립.
- 부분일치는 그대로: 기준선 어절 안의 이름이 「새 어절」로 나오면 다시 걸림
- 기준선 어절은 그 파일에서만 통과, 같은 어절이 다른 파일에 있으면 걸림
- 기준선 파일은 한 번(실행당)만 읽음, pii_baseline --save 는 워커 기준선을 지우지 않음
실행: python3 -m unittest tests/test_worker_pii_word.py"""
import base64, contextlib, io, json, os, shutil, sys, tempfile, unittest
from unittest import mock
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
sys.path.insert(0, os.path.join(HERE, '..'))
import cal_pii_check as C  # noqa: E402
import pii_baseline  # noqa: E402

NAME = '박' + '서온'                 # 지어낸 이름
WORD = NAME + '체'                    # 기준선에 넣을 어절(이름이 든 낱말)
NEW = NAME + '님께'                   # 같은 이름, 새 어절
FAKE_MAIL = 'a' + '@' + 'b.co'        # 가짜 메일도 조립(커밋 전 검사 통과용)


def worker(files):
    """build_preview 워커 모양(const F = "...";\\nconst H) 흉내."""
    enc = {rel: ['application/json', base64.b64encode(txt.encode()).decode()] for rel, txt in files.items()}
    return 'const F = ' + json.dumps(json.dumps(enc))[1:-1] + ';\\nconst H = 1;\n'


class WorkerWordBaseline(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.base = os.path.join(self.d, 'pii_baseline.json')
        with open(self.base, 'w', encoding='utf-8') as fh:
            json.dump({'version': 2, 'keys': {}}, fh)
        self.p = mock.patch.object(C, 'names_from_raws', lambda paths: {NAME})
        self.p.start()

    def tearDown(self):
        self.p.stop()
        shutil.rmtree(self.d)

    def run_check(self, files, *extra):
        w = os.path.join(self.d, 'w.js')
        with open(w, 'w', encoding='utf-8') as fh:
            fh.write(worker(files))
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = C.main(['--data', self.d, '--files', '--raw', '--worker', w, '--baseline', self.base] + list(extra))
        return rc, buf.getvalue()

    def save(self, files, rel):
        rc, out = self.run_check(files, '--save-words', rel, '--note', '시험')
        self.assertEqual(rc, 0, out)
        self.assertNotIn(NAME, out)            # 낱말은 화면에 안 찍음
        return out

    def test_no_baseline_substring_still_caught(self):
        rc, out = self.run_check({'/data/a.json': '{"x": "%s 목록"}' % WORD})
        self.assertEqual(rc, 2)
        self.assertIn('워커 /data/a.json: 사람 이름', out)
        self.assertNotIn(NAME, out)

    def test_baselined_eojeol_passes_only_in_its_file(self):
        f = {'/data/a.json': '{"x": "%s 목록"}' % WORD}
        self.save(f, '/data/a.json')
        self.assertEqual(self.run_check(f)[0], 0)
        rc, out = self.run_check({'/data/a.json': f['/data/a.json'], '/data/b.json': '{"y": "%s"}' % WORD})
        self.assertEqual(rc, 2)
        self.assertIn('/data/b.json: 사람 이름', out)
        self.assertNotIn('/data/a.json: 사람 이름', out)

    def test_name_in_new_eojeol_same_file_caught(self):
        f = {'/data/a.json': '{"x": "%s 목록"}' % WORD}
        self.save(f, '/data/a.json')
        for bad in ('{"x": "%s 목록", "z": "%s"}' % (WORD, NEW),
                    '{"x": "%s 목록 %s"}' % (WORD, NAME),
                    '{"x": "교수%s"}' % WORD):
            rc, out = self.run_check({'/data/a.json': bad})
            self.assertEqual(rc, 2, bad)

    def test_other_pii_kinds_not_baselined(self):
        f = {'/data/a.json': '{"x": "%s"}' % WORD}
        self.save(f, '/data/a.json')
        rc, out = self.run_check({'/data/a.json': '{"x": "%s", "m": "%s"}' % (WORD, FAKE_MAIL)})
        self.assertEqual(rc, 2)
        self.assertNotIn('사람 이름', out)

    def test_save_needs_note_and_known_file(self):
        f = {'/data/a.json': WORD}
        self.assertEqual(self.run_check(f, '--save-words', '/data/a.json')[0], 2)
        self.assertEqual(self.run_check(f, '--save-words', '/data/none.json', '--note', 'x')[0], 2)
        self.assertNotIn('worker_keys', json.load(open(self.base, encoding='utf-8')))

    def test_baseline_file_read_once(self):
        f = {'/data/a.json': WORD, '/data/b.json': WORD, '/data/c.json': WORD}
        with mock.patch.object(C, 'load_word_keys', wraps=C.load_word_keys) as m:
            self.run_check(f)
        self.assertEqual(m.call_count, 1)

    def test_baseline_holds_hashes_only(self):
        self.save({'/data/a.json': WORD}, '/data/a.json')
        raw = open(self.base, encoding='utf-8').read()
        self.assertNotIn(NAME, raw)
        self.assertEqual(json.load(open(self.base, encoding='utf-8'))['worker_keys'], {C.word_key('/data/a.json', WORD): 1})

    def test_save_words_rerun_overwrites_not_accumulates(self):
        f = {'/data/a.json': '{"x": "%s 목록", "y": "%s"}' % (WORD, WORD)}
        self.save(f, '/data/a.json')
        first = json.load(open(self.base, encoding='utf-8'))
        out = self.save(f, '/data/a.json')
        again = json.load(open(self.base, encoding='utf-8'))
        self.assertEqual(again['worker_keys'], first['worker_keys'])
        self.assertEqual(again['worker_keys'], {C.word_key('/data/a.json', WORD): 2})
        self.assertEqual(len(again['worker_notes']), 1)
        self.assertIn('새 열쇠 0개', out)

    def test_save_words_without_worker_warns_rc1(self):
        before = open(self.base, encoding='utf-8').read()
        buf, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(err):
            rc = C.main(['--data', self.d, '--files', '--raw', '--baseline', self.base, '--save-words', '/data/a.json', '--note', '시험'])
        self.assertEqual(rc, 1)
        self.assertIn('--worker', err.getvalue())
        self.assertEqual(open(self.base, encoding='utf-8').read(), before)

    def test_pii_baseline_save_keeps_worker_keys(self):
        self.save({'/data/a.json': WORD}, '/data/a.json')
        root = os.path.join(self.d, 'site'); os.makedirs(os.path.join(root, 'data'))
        with contextlib.redirect_stdout(io.StringIO()):
            pii_baseline.main(['--save', '--note', '시험', '--qlist', ''], root=root, base=self.base)
        self.assertIn(C.word_key('/data/a.json', WORD), json.load(open(self.base, encoding='utf-8'))['worker_keys'])


class RealBaseline(unittest.TestCase):
    def test_repo_baseline_has_only_hashes(self):
        b = json.load(open(os.path.join(HERE, '..', 'data', 'pii_baseline.json'), encoding='utf-8'))
        for k in b.get('worker_keys', {}):
            self.assertRegex(k, r'^[a-p]{16}$')


if __name__ == '__main__':
    unittest.main()
