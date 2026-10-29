"""옵시디언 링크 시험 (추가 지시 1, 10.21. → 261029 바뀜): 볼트 하나 「옵시디언」.
261029부터 공개 sources.json 엔 볼트 경로·obsidian://open 주소가 없고 노트 제목만 있음(tools/vaultpath.py).
앱은 제목으로 검색 링크를 만듦: obsidian://search?vault=%EC%98%B5%EC%8B%9C%EB%94%94%EC%96%B8&query=<노트 제목>
obsidian_url()(경로 → open 링크) 자체는 볼트 안에서 쓰는 도구라 그대로 시험함.
실행: python -m unittest tests/test_obsidian_link.py -v"""
import http.server, json, os, shutil, subprocess, sys, tempfile, threading, unittest, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import link_sources as L

VAULT_Q = 'vault=%EC%98%B5%EC%8B%9C%EB%94%94%EC%96%B8'
with open(os.path.join(ROOT, 'data', 'config.json'), encoding='utf-8') as f:
    CFG = json.load(f)
with open(os.path.join(ROOT, 'data', 'sources.json'), encoding='utf-8') as f:
    SRC = json.load(f)


def parts(url):
    u = urllib.parse.urlsplit(url)
    q = urllib.parse.parse_qs(u.query)
    return u.scheme, u.netloc, q['vault'][0], q['file'][0]


class T(unittest.TestCase):
    def test_vault_name(self):
        self.assertEqual(CFG['obsidianVault'], '옵시디언')
        self.assertEqual(CFG['obsidianVaultRootInBox'], '')
        self.assertEqual(L.obsidian_config(), ('옵시디언', ''))

    def test_every_linked_card(self):
        linked = {k: r for k, r in SRC['cards'].items() if r.get('status') == '연결'}
        self.assertTrue(linked)
        for k, r in SRC['cards'].items():
            if not r.get('path'):
                self.assertNotIn('obsidian', r, k)
                continue
            self.assertEqual(r.get('obsidian', ''), '', k)          # 공개 파일엔 open 주소 없음
            self.assertNotIn('/', r['path'], k)                      # 경로 대신 노트 제목
            self.assertFalse(r['path'].endswith('.md'), k)
            self.assertNotIn('봇공유', r['path'], k)

    def test_prefix_added_once(self):
        a = L.obsidian_url('봇공유/20 규정·지침/x.md', '옵시디언', '봇공유')
        b = L.obsidian_url('20 규정·지침/x.md', '옵시디언', '봇공유')
        self.assertEqual(a, b)
        self.assertEqual(parts(a)[3], '봇공유/20 규정·지침/x')
        self.assertEqual(L.obsidian_url('봇공유/a.md', '', '봇공유'), '')

    def test_update_links_only_touches_links(self):
        tmp = tempfile.mkdtemp()
        try:
            p = os.path.join(tmp, 'sources.json')
            src = json.loads(json.dumps(SRC))
            for r in src['cards'].values():
                r.pop('obsidian', None)
            with open(p, 'w', encoding='utf-8') as f:
                json.dump(src, f, ensure_ascii=False)
            self.assertEqual(L.main(['--update-links', '--out', p]), 0)
            with open(p, encoding='utf-8') as f:
                self.assertEqual(json.load(f), SRC)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


CHROME = next((c for c in [os.environ.get('HJ_CHROME') or '', r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                           r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                           shutil.which('google-chrome') or '', shutil.which('chromium') or ''] if c and os.path.isfile(c)), None)


@unittest.skipUnless(CHROME, '크롬 없음')
class T화면(unittest.TestCase):
    """진짜 앱 공부 > 위임전결 규정 카드의 「옵시디언에서 열기」 주소"""
    def test_card_button(self):
        class H(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *a, **k):
                super().__init__(*a, directory=ROOT, **k)

            def log_message(self, *a):
                pass
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        prof = tempfile.mkdtemp()
        try:
            url = 'http://127.0.0.1:%d/#/study/rule/g8' % srv.server_address[1]
            out = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + prof,
                                  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--virtual-time-budget=6000',
                                  '--dump-dom', url], capture_output=True, timeout=90).stdout.decode('utf-8', 'replace')
        finally:
            srv.shutdown()
            shutil.rmtree(prof, ignore_errors=True)
        want = ('obsidian://search?' + VAULT_Q + '&query=' + urllib.parse.quote(SRC['cards']['regulations:g8']['path'], safe="-_.!~*'()")).replace('&', '&amp;')
        self.assertIn('href="%s">옵시디언에서 열기' % want, out)


if __name__ == '__main__':
    unittest.main()
