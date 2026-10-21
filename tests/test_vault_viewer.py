"""「볼트 문서」 화면 시험: 진짜 앱을 헤드리스 크롬으로 열고 가짜 잠긴 API(tests/vault_mock.py)에 붙여 봄.
크롬이 없으면 건너뜀(HJ_CHROME 로 경로 지정 가능). 바깥 인터넷 주소는 막고 127.0.0.1 만 씀.
실행: python -m unittest tests/test_vault_viewer.py -v"""
import json, os, re, shutil, subprocess, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vault_mock as M

CANDIDATES = [os.environ.get('HJ_CHROME') or '',
              r'C:\Program Files\Google\Chrome\Application\chrome.exe',
              r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
              shutil.which('google-chrome') or '', shutil.which('chromium') or '', shutil.which('chromium-browser') or '']
CHROME = next((c for c in CANDIDATES if c and os.path.isfile(c)), None)
PACK = None


def dump(srv, hash_):
    prof = tempfile.mkdtemp(prefix='hj_chrome_')
    try:
        url = 'http://127.0.0.1:%d/%s' % (srv.server_address[1], hash_)
        r = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
                            '--user-data-dir=' + prof, '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
                            '--virtual-time-budget=6000', '--dump-dom', url],
                           capture_output=True, timeout=90)
        return r.stdout.decode('utf-8', 'replace')
    finally:
        shutil.rmtree(prof, ignore_errors=True)


def ids():
    with open(os.path.join(PACK, 'index.json'), encoding='utf-8') as f:
        return {d['path']: d['id'] for d in json.load(f)['docs']}


@unittest.skipUnless(CHROME, '크롬 없음')
class Viewer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global PACK
        PACK = M.build_fixture_pack()
        cls.srv = M.start('ok', PACK)

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def mode(self, m):
        self.srv.mode = m

    def test_list_tree_and_last_update(self):
        self.mode('ok')
        d = dump(self.srv, '#/vault')
        self.assertIn('마지막 갱신 2026-10-21 10:30 · 문서 8개', d)
        self.assertIn('data-count="8"', d)
        for folder in ('00 홈', '보고서', '13 글로컬 지출', '프로세스', '20 규정·지침', '하위'):
            self.assertIn('<b>%s</b>' % folder, d)
        self.assertIn('규칙 총정리 (연습용 가짜)', d)

    def test_search_local_and_body(self):
        self.mode('ok')
        d = dump(self.srv, '#/vault?q=' + '위임전결')
        self.assertRegex(d, r'data-count="[12]"')
        m = re.search(r'data-hits="(\d+)"', d)
        self.assertTrue(m, '본문 검색 결과 없음')
        self.assertGreaterEqual(int(m.group(1)), 2)

    def test_doc_rendered_safely(self):
        self.mode('ok')
        i = ids()
        d = dump(self.srv, '#/vault/doc/' + i['봇공유/10 업무/13 글로컬 지출/프로세스/P01_가짜프로세스.md'])
        body = d[d.index('class="vault-body"'):d.index('</main>')]
        self.assertNotIn('<script', body)
        self.assertNotIn('<img', body)
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;', body)
        self.assertIn('href="https://example.com"', body)
        self.assertNotIn('javascript:', body)
        self.assertIn(' · 나쁜 링크 · ', body)
        self.assertIn('href="#/vault/doc/%s"' % i['봇공유/20 규정·지침/국립창원대_위임전결규정.md'], body)
        self.assertIn('class="wiki-missing"', body)
        self.assertIn('<i>기울임</i>', body)
        self.assertIn('<table class="plain">', body)
        self.assertIn('<h1>P01 가짜 프로세스</h1>', d)
        self.assertIn('마지막 갱신 2026-10-21 10:30', d)

    def test_json_and_unknown_doc(self):
        self.mode('ok')
        i = ids()
        d = dump(self.srv, '#/vault/doc/' + i['봇공유/00 홈/일정총괄.json'])
        self.assertIn('class="json"', d)
        d = dump(self.srv, '#/vault/doc/abcdefabcdef')
        self.assertIn('data-vault-state="gone"', d)

    def test_states(self):
        for mode, kind in (('locked', 'locked'), ('missing', 'missing'), ('down', 'down'), ('drop', 'down'), ('empty', 'empty')):
            self.mode(mode)
            d = dump(self.srv, '#/vault')
            self.assertIn('data-vault-state="%s"' % kind, d, mode)
            if kind != 'empty':
                self.assertIn('잠긴 연습장에서만 보여요', d, mode)
        self.mode('locked')
        self.assertIn('data-vault-state="locked"', dump(self.srv, '#/vault/doc/abcdefabcdef'))

    def test_study_card_opens_in_app_doc(self):
        self.mode('ok')
        rid = ids()['봇공유/20 규정·지침/국립창원대_위임전결규정.md']
        d = dump(self.srv, '#/study/rule/g8')
        self.assertIn('data-open-vault-doc="" href="#/vault/doc/%s"' % rid, d)
        self.assertIn('class="reg-note"', d)
        self.mode('locked')
        d = dump(self.srv, '#/study/rule/g8')
        self.assertNotIn('data-open-vault-doc', d)
        self.assertIn('data-src-status="연결"', d)        # 잠겨 있으면 예전 그대로

    def test_more_menu_has_vault(self):
        self.mode('ok')
        self.assertIn('data-page="vault"', dump(self.srv, '#/more'))


if __name__ == '__main__':
    unittest.main()
