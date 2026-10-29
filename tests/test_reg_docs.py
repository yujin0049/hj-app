"""T057 (261021) 위임전결 규정 카드 원문 바로 보기 시험. 실행: python -m unittest tests/test_reg_docs.py -v
- data/reg_docs.json 이 가리키는 공개 사본(docs/regs/)이 있고, 볼트 원본 노트 경로가 맞는지
- 공개 사본에 실명이 없고 실무 기준은 「담당 선생님 구두 안내」 + 3,000만원 경계와 다르다는 메모
- 크롬에서 카드의 「보기」 두 개를 누르면 원문이 앱 안에서 열리는지(tests/harness/reg_docs.html)"""
import http.server, json, os, re, shutil, subprocess, tempfile, threading, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
with open(os.path.join(ROOT, 'data', 'reg_docs.json'), encoding='utf-8') as f:
    RD = json.load(f)
DOCS = RD['cards']['regulations:g8']


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


class T자료(unittest.TestCase):
    def test_two_docs_point_to_vault_notes(self):
        self.assertEqual([d['vault'] for d in DOCS],
                         ['국립창원대_위임전결규정', '위임전결규정_꼭알조문'])   # 261029: 볼트 경로 대신 노트 제목만
        for d in DOCS:
            self.assertRegex(d['file'], r'^docs/regs/[^/]+\.md$')
            self.assertTrue(os.path.isfile(os.path.join(ROOT, d['file'])), d['file'])

    def test_regulation_text(self):
        t = read(DOCS[0]['file'])
        for a in ('제1조(목적)', '제3조(결재권의 위임)', '제5조(전결권의 상향 및 하향처리 금지)', '제9조(협의사항)', '[별표 1]'):
            self.assertIn(a, t)
        self.assertNotIn('DESKTOP-', t)   # 업무 PC 이름 같은 내부 정보 없음

    def test_practical_standard_wording(self):
        t = read(DOCS[1]['file'])
        self.assertIn('담당 선생님 구두 안내', t)
        self.assertIn('3,000만원', t)
        self.assertNotRegex(t, r'(?<![가-힣])(?!담당)[가-힣]{2,3} 선생님 구두')   # 「담당 선생님」 말고 이름 + 선생님 꼴 없음
        self.assertIn('3,000만원과 다름', t)

    def test_no_real_name_in_public_files(self):
        for p in [d['file'] for d in DOCS] + ['data/reg_docs.json', 'js/reg-docs.js']:
            self.assertNotRegex(read(p), r'(?<![가-힣])[가-힣]{3}\s?(선생님|주무관)(?![가-힣])'.replace('[가-힣]{3}', '(?!담당)[가-힣]{3}'), p)

    def test_study_card_calls_regdocs(self):
        s = read('js/modules/study.js')
        self.assertIn('data-regdocs-slot', s)
        self.assertIn("RegDocs.fill(el, 'regulations:' + r.id", s)
        self.assertIn('js/reg-docs.js', read('index.html'))


CHROME = next((c for c in [os.environ.get('HJ_CHROME') or '', shutil.which('google-chrome') or '', shutil.which('chromium') or '',
                           r'C:\Program Files\Google\Chrome\Application\chrome.exe'] if c and os.path.isfile(c)), None)


def serve():
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=ROOT, **k)

        def log_message(self, *a):
            pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def chrome(url, extra):
    prof = tempfile.mkdtemp()
    try:
        return subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--no-sandbox', '--user-data-dir=' + prof,
                               '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--virtual-time-budget=8000'] + extra + [url],
                              capture_output=True, timeout=90).stdout.decode('utf-8', 'replace')
    finally:
        shutil.rmtree(prof, ignore_errors=True)


@unittest.skipUnless(CHROME, '크롬 없음')
class T화면(unittest.TestCase):
    def test_buttons_open_source_in_app(self):
        srv = serve()
        try:
            out = chrome('http://127.0.0.1:%d/tests/harness/reg_docs.html' % srv.server_address[1], ['--dump-dom'])
        finally:
            srv.shutdown()
        m = re.search(r'<pre id="result">(.*?)</pre>', out, re.S)
        self.assertTrue(m, out[-500:])
        lines = m.group(1).strip().split('\n')
        self.assertEqual(lines[0], '버튼 2')
        self.assertTrue(lines[1].startswith('열림|') and '국립창원대학교 위임전결 규정' in lines[1], lines[1])
        self.assertGreater(int(lines[1].split('|')[1]), 50000)
        self.assertTrue(lines[2].startswith('열림|') and '꼭 알 조문' in lines[2], lines[2])

    def test_real_app_card_has_buttons(self):
        srv = serve()
        try:
            out = chrome('http://127.0.0.1:%d/#/study/rule/g8' % srv.server_address[1], ['--dump-dom'])
        finally:
            srv.shutdown()
        self.assertIn('위임전결 규정 원문 보기</button>', out)
        self.assertIn('꼭 알 조문 (규정봇 정리) 보기</button>', out)
        self.assertIn('data-regdoc-body="0"', out)


if __name__ == '__main__':
    unittest.main()
