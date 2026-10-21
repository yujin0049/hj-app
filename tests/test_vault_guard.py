"""지킴 시험: 볼트 글·볼트 팩 파일이 git 저장소에 들어가면 실패 (볼트에 개인정보 → 공개 GitHub·Pages 금지).
- 늘: 팩 출력 파일(vault_pack/, docs/<12자 id>.json, kv_keys.json, cf_upload_vault.js)이 git 에 없음, .gitignore 가 막음, 가짜 볼트는 가짜 표시
- HJ_VAULT(볼트 뿌리)가 있으면: 진짜 볼트로 팩을 저장소 밖 임시 폴더에 만들고, 문서의 25자 이상 줄이 git 파일에 하나도 없는지 봄
실행: python -m unittest tests/test_vault_guard.py -v"""
import json, os, re, shutil, subprocess, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build_vault_pack as B

with open(os.path.join(ROOT, 'tools', 'vault_folders.json'), encoding='utf-8') as f:
    CFG = json.load(f)
FIXTURE = 'tests/fixtures/vault_docs/'
TEXT_EXT = re.compile(r'\.(md|txt|json|js|html|css|py|csv|webmanifest|yml|yaml)$', re.I)


def tracked():
    r = subprocess.run(['git', '-c', 'core.quotepath=off', 'ls-files', '-z'], cwd=ROOT, capture_output=True)
    return [p for p in r.stdout.decode('utf-8').split('\0') if p]


def tracked_text():
    out = {}
    for p in tracked():
        if not TEXT_EXT.search(p):
            continue
        try:
            with open(os.path.join(ROOT, p), encoding='utf-8') as f:
                out[p] = f.read()
        except (OSError, UnicodeDecodeError):
            pass
    return out


def squash(s):
    return re.sub(r'\s+', ' ', s).strip()


def doc_lines(text):
    """화면에 보이는 문장 줄(25자 이상). 표 구분줄·코드 울타리는 뺌."""
    for ln in text.splitlines():
        s = squash(re.sub(r'^[\s>#*+\-|]+', '', ln))
        if len(s) >= 25 and not re.fullmatch(r'[|\-: ]+', s):
            yield s


class Guard(unittest.TestCase):
    def test_no_pack_files_tracked(self):
        bad = [p for p in tracked() if re.search(r'(^|/)vault_pack(/|$)|cf_upload_vault\.js$|(^|/)kv_keys\.json$|(^|/)docs/[0-9a-f]{12}\.json$', p)]
        self.assertEqual(bad, [], '볼트 팩 파일이 저장소에 있음')
        for p, t in tracked_text().items():
            if p.endswith('.json') and '"masked_rrn"' in t:
                self.fail('볼트 팩 index/문서가 저장소에 있음: ' + p)

    def test_gitignore_blocks_pack(self):
        for p in ('vault_pack/index.json', 'x/vault_pack/docs/abcdefabcdef.json', 'cf_upload_vault.js'):
            r = subprocess.run(['git', 'check-ignore', '-q', p], cwd=ROOT)
            self.assertEqual(r.returncode, 0, '.gitignore 가 %s 를 막지 않음' % p)

    def test_fixtures_are_synthetic(self):
        files = [p for p in tracked() if p.startswith(FIXTURE)]
        self.assertTrue(files)
        rrn = re.compile(r'\d{6}\s?-\s?\d{7}|(?<!\d)\d{13}(?!\d)')
        phone = re.compile(r'01[016789]-?\d{3,4}-?\d{4}')
        for p in files:
            with open(os.path.join(ROOT, p), encoding='utf-8') as f:
                t = f.read()
            self.assertTrue('가짜' in t or '연습용' in t, p + ' 에 가짜 표시가 없음')
            self.assertIsNone(rrn.search(t), p)
            self.assertIsNone(phone.search(t), p)

    def test_viewer_code_has_no_vault_text(self):
        # 화면 코드는 API 로만 받음: 볼트 팩·문서 글을 품지 않음
        for p in ('js/vault-api.js', 'js/vault-md.js', 'js/modules/vault.js'):
            with open(os.path.join(ROOT, p), encoding='utf-8') as f:
                t = f.read()
            self.assertNotIn('"docs"', t)
            self.assertNotIn('masked_rrn":', t)
            self.assertNotIn('innerHTML = d.text', t)

    def test_no_vault_text_in_tracked_files(self):
        vault = os.environ.get('HJ_VAULT')
        if not vault or not os.path.isdir(os.path.join(vault, CFG.get('base', ''))):
            self.skipTest('HJ_VAULT 없음(진짜 볼트 대조는 볼트 있는 PC에서)')
        out = tempfile.mkdtemp(prefix='hj_vault_guard_')
        try:
            ix = B.build(CFG, vault, out, 'guard')
            corpus = squash('\n'.join(t for p, t in tracked_text().items() if not p.startswith(FIXTURE)))
            leaks = []
            for d in ix['docs']:
                with open(os.path.join(out, 'docs', d['id'] + '.json'), encoding='utf-8') as f:
                    text = json.load(f)['text']
                for s in doc_lines(text):
                    if s in corpus:
                        leaks.append('%s (%d자 줄)' % (d['path'], len(s)))
                        break
            self.assertEqual(leaks, [], '볼트 글이 저장소 파일에 있음')
        finally:
            shutil.rmtree(out, ignore_errors=True)


if __name__ == '__main__':
    unittest.main()
