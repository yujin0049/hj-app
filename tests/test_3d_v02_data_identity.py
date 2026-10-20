"""3D v02 연결 시험 (feat/3d-v02, 10.21.): 3D는 3D 사이트를 틀(iframe)로 띄울 뿐, 자료 파일은 main(1d0b71c)과 바이트 그대로.
- 자료 파일 sha256 == tests/fixtures/3d_v02_main_hashes.json (경로→해시만)
- data/config.json: threeD 키만 새로 붙고 나머지는 값·키 순서 그대로
- js/modules/3d.js: 비밀번호·PIN·토큰 없음, 주소는 config(threeD.src)에서
실행: python -m unittest tests/test_3d_v02_data_identity.py -v"""
import hashlib, json, os, re, subprocess, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BASE = '1d0b71c'
with open(os.path.join(HERE, 'fixtures', '3d_v02_main_hashes.json'), encoding='utf-8') as f:
    FIX = json.load(f)
with open(os.path.join(ROOT, 'js', 'modules', '3d.js'), encoding='utf-8') as f:
    JS = f.read()


def git(*a):
    return subprocess.run(['git', *a], cwd=ROOT, check=True, capture_output=True).stdout


def has_git():
    try:
        git('cat-file', '-e', BASE + '^{commit}')
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


@unittest.skipUnless(has_git(), 'git 또는 main 커밋 없음')
class DataIdentity(unittest.TestCase):
    def test_fixture_base(self):
        self.assertEqual(FIX['base'], BASE)
        self.assertGreater(len(FIX['sha256']), 50)
        for p in ('dorm.json', 'public-pack.json', 'data/lockers.json', 'data/reg_docs.json', 'js/modules/filefind.js'):
            self.assertIn(p, FIX['sha256'])
        self.assertNotIn('data/config.json', FIX['sha256'])

    def test_fixture_matches_main(self):
        # 해시 목록 자체가 main 과 맞는지 (git ls-files 기준, 바꿀 수 있는 파일만 빠짐)
        for p, h in FIX['sha256'].items():
            self.assertEqual(hashlib.sha256(git('cat-file', 'blob', BASE + ':' + p)).hexdigest(), h, p)

    def test_data_files_same_as_main(self):
        tracked = set(git('ls-files', '-z').decode('utf-8').split('\0'))
        for p, h in FIX['sha256'].items():
            self.assertIn(p, tracked, '지워짐: ' + p)
            self.assertEqual(hashlib.sha256(git('cat-file', 'blob', 'HEAD:' + p)).hexdigest(), h, p)
        # 커밋 안 한 작업 폴더 변경도 없음 (줄바꿈 설정과 무관하게 git 이 비교)
        changed = git('diff', 'HEAD', '--name-only', '-z', '--', *FIX['sha256']).decode('utf-8').strip('\0')
        self.assertEqual(changed, '')

    def test_config_only_adds_threeD(self):
        old = json.loads(git('cat-file', 'blob', BASE + ':data/config.json').decode('utf-8'))
        with open(os.path.join(ROOT, 'data', 'config.json'), encoding='utf-8') as f:
            new = json.load(f)
        self.assertEqual(new['threeD'], {'src': 'https://silseupdong-3d.yujin06344.workers.dev/'})
        rest = {k: v for k, v in new.items() if k != 'threeD'}
        self.assertEqual(rest, old)
        self.assertEqual(list(rest), list(old))   # 키 순서
        self.assertNotIn('threeD', old)


class Module3D(unittest.TestCase):
    def test_no_secrets(self):
        low = JS.lower()
        for w in ('password', 'passwd', 'pin', 'token', 'secret', 'apikey', 'api_key', 'authorization', 'cookie'):
            self.assertIsNone(re.search(r'\b' + w + r'\b', low), w)
        for w in ('비밀번호', '암호', '입장 번호', '입장번호', '토큰'):
            self.assertNotIn(w, JS)
        nums = re.findall(r'(?<![\w.])\d{4,8}(?![\w.])', JS)   # 번호처럼 보이는 숫자 덩어리
        self.assertEqual(nums, ['9000'])                     # 안내 숨김 시간(ms)만

    def test_src_from_config(self):
        self.assertRegex(JS, r"fetch\('data/config\.json'")
        self.assertRegex(JS, r'cfg\s*&&\s*cfg\.threeD\s*&&\s*cfg\.threeD\.src')
        # 순서: AP3D_SRC → config → 기본 주소
        i_test, i_cfg = JS.index('window.AP3D_SRC && okSrc'), JS.index("fetch('data/config.json'")
        self.assertLess(i_test, i_cfg)
        self.assertRegex(JS, r'return okSrc\(s\) \? s : SRC;')
        # https + *.workers.dev 만
        self.assertRegex(JS, r"u\.protocol === 'https:' && /\\\.workers\\\.dev\$/\.test\(u\.hostname\)")
        # 주소 글자는 기본값 한 곳에만
        self.assertEqual(len(re.findall(r'https://', JS)), 1)

    def test_hint_and_menu(self):
        self.assertIn('교육원 전경 3D (v02 모델은 3D 사이트 배포 뒤 보여요)', JS)
        with open(os.path.join(ROOT, 'js', 'registry.js'), encoding='utf-8') as f:
            reg = f.read()
        for m in ('lockers', 'calendar', 'status', 'filefind', '3d'):
            self.assertIn("'" + m + "'", reg)
        with open(os.path.join(ROOT, 'js', 'modules', 'more.js'), encoding='utf-8') as f:
            more = f.read()
        self.assertNotIn('silseupdong-3d', more)
        self.assertIn("menuBtn('3d'", more)
        self.assertNotIn('입장 번호', more)


if __name__ == '__main__':
    unittest.main()
