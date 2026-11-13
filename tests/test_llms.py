"""AI·크롤러용 정적 파일(llms.txt · ai/*.md · ai/index.json · robots.txt) 시험: python3 -m unittest tests.test_llms
- 화면 목록은 소스(js/registry.js·js/modules)에서 만들어짐, 저장소 파일 = 생성기 결과
- llms.txt·대표 md 가 자바스크립트 없이 본문을 가짐(작은 http 서버로 실제 200 확인)
- robots: 이름 붙은 AI 수집기는 llms·ai/ 만 허용, Googlebot·그 밖은 전체 막힘
- 개인정보·내부 경로 없음, 채팅·잠긴 화면은 「비공개」만"""
import http.server, importlib.util, json, os, re, shutil, socketserver, sys, tempfile, threading, unittest, urllib.request
from urllib import robotparser
sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hjpii  # noqa: E402


def read(*p):
    return open(os.path.join(ROOT, *p), encoding='utf-8').read()


def load(root=ROOT):
    spec = importlib.util.spec_from_file_location('make_llms_t', os.path.join(root, 'tools', 'make_llms.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


GEN = ['llms.txt', 'llms-full.txt', 'robots.txt', 'ai/index.json']
PRIVATE_MUST = ['chat', 'docs', 'status', 'who', 'lockers', 'dorm', 'computers', 'filefind', 'ot-attach', 'haksa', 'calendar', 'schedule', 'todo', 'bots', 'board', 'coop', 'charts', 'check']


class Generator(unittest.TestCase):
    def test_committed_equals_generated(self):
        m = load()
        self.assertEqual(m.main(['--check']), 0, 'python3 tools/make_llms.py 를 다시 돌려 커밋하세요')

    def test_every_registry_screen_listed(self):
        reg = read('js', 'registry.js')
        ids = [i for body in re.findall(r"MODULE_(?:LIST|EXTRA)\s*=\s*\[([^\]]*)\]", reg) for i in re.findall(r"'([\w-]+)'", body)]
        self.assertGreater(len(ids), 20)
        idx = json.loads(read('ai', 'index.json'))
        got = [s['id'] for s in idx['screens']]
        for i in ids:
            self.assertIn(i, got)
        self.assertEqual(len(got), len(set(got)))

    def test_new_module_appears_private_by_default(self):
        tmp = tempfile.mkdtemp()
        try:
            for d in ('js', 'tools', 'public'):
                shutil.copytree(os.path.join(ROOT, d), os.path.join(tmp, d))
            p = os.path.join(tmp, 'js', 'registry.js')
            s = open(p, encoding='utf-8').read().replace("'notice']", "'notice', 'zzsecret']")
            open(p, 'w', encoding='utf-8').write(s)
            m = load(tmp)
            m.ROOT = tmp
            files, ss = m.build()
            row = [s for s in ss if s['id'] == 'zzsecret']
            self.assertEqual(len(row), 1, '소스(registry.js)에 넣은 화면이 목록에 나와야 함')
            self.assertEqual(row[0]['visibility'], 'private')
            self.assertNotIn('ai/zzsecret.md', files)
            self.assertNotIn('zzsecret.md', files['llms.txt'])
        finally:
            shutil.move(tmp, tempfile.mkdtemp(prefix='trash_'))  # 지우지 않고 옮김(rm 금지)


class LlmsTxt(unittest.TestCase):
    def test_format(self):
        t = read('llms.txt')
        lines = t.splitlines()
        self.assertTrue(lines[0].startswith('# '))
        self.assertTrue(any(l.startswith('> ') for l in lines[:4]), '요약 인용줄')
        links = re.findall(r'^- \[([^\]]+)\]\((ai/[\w-]+\.md)\): (.+)$', t, re.M)
        self.assertGreaterEqual(len(links), 10)
        for title, href, desc in links:
            self.assertTrue(re.search(r'[가-힣]', title), '한글 제목: ' + title)
            self.assertTrue(os.path.exists(os.path.join(ROOT, href)), href)
            self.assertTrue(desc.strip())
        self.assertIn('## Optional', t)

    def test_representative_md_has_body(self):
        s = read('ai', 'students.md')
        self.assertGreater(len(s), 5000)
        guide = json.loads(read('public', 'guide.json'))
        for sec in guide['sections']:
            self.assertIn('## ' + sec['title'], s)
        self.assertIn('| 교시 | 시간 |', s)
        self.assertNotIn('<script', s)

    def test_private_screens_only_named(self):
        idx = {s['id']: s for s in json.loads(read('ai', 'index.json'))['screens']}
        t = read('llms.txt')
        for i in PRIVATE_MUST:
            self.assertEqual(idx[i]['visibility'], '비공개', i)
            self.assertEqual(set(idx[i]), {'id', 'title', 'visibility'}, i)
            self.assertFalse(os.path.exists(os.path.join(ROOT, 'ai', i + '.md')), i)
            self.assertNotIn('(ai/%s.md)' % i, t)
            self.assertNotRegex(read('llms-full.txt'), r'#/%s(?![\w-])' % re.escape(i))

    def test_no_chat_or_raw_data_dump(self):
        full = read('llms-full.txt')
        for bad in ('chat/room.json', 'ciphertext', '"iv"', 'data/', 'docs_important', 'bot_status'):
            self.assertNotIn(bad, full)


class Privacy(unittest.TestCase):
    BAN = re.compile(r'(봇공유|볼트|vault|업무폴더|(?<![A-Za-z])[A-Z]:[\\/]|/home/|/workspace/|@|[?&](t|key|token)=|비밀번호|password|유진님)')

    def files(self):
        out = GEN[:]
        out += ['ai/' + f for f in os.listdir(os.path.join(ROOT, 'ai'))]
        return sorted(set(out))

    def test_no_pii_or_internal_paths(self):
        for f in self.files():
            for n, line in enumerate(read(*f.split('/')).splitlines(), 1):
                if f == 'robots.txt' and line.startswith('#'):
                    continue
                kinds = [k for k in hjpii.find_pii(line) if k != '이름 의심']
                self.assertEqual(kinds, [], '%s:%d' % (f, n))
                self.assertIsNone(self.BAN.search(line), '%s:%d' % (f, n))


class Robots(unittest.TestCase):
    AI = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'Google-Extended', 'PerplexityBot', 'Applebot-Extended', 'CCBot']

    def rp(self):
        r = robotparser.RobotFileParser()
        r.parse(read('robots.txt').splitlines())
        return r

    def test_ai_bots_allowed_on_llms_only(self):
        r = self.rp()
        for b in self.AI:
            for pre in ('', '/hj-app'):
                for p in ('/llms.txt', '/llms-full.txt', '/ai/students.md', '/ai/index.json'):
                    self.assertTrue(r.can_fetch(b, pre + p), b + ' ' + pre + p)
                for p in ('/', '/index.html', '/data/charts.json', '/public-pack.json'):
                    self.assertFalse(r.can_fetch(b, pre + p), b + ' ' + pre + p)

    def test_search_engines_still_blocked(self):
        r = self.rp()
        for b in ('Googlebot', 'Bingbot', 'Yeti', 'Daum', '*'):
            for p in ('/', '/hj-app/', '/llms.txt', '/hj-app/ai/students.md', '/ai/students.md'):
                self.assertFalse(r.can_fetch(b, p), b + ' ' + p)

    def test_no_sitemap_and_app_still_noindex(self):
        self.assertNotIn('Sitemap', read('robots.txt'))
        self.assertFalse(os.path.exists(os.path.join(ROOT, 'sitemap.xml')))
        self.assertIn('<meta name="robots" content="noindex, nofollow">', read('index.html'))


class Html(unittest.TestCase):
    def test_alternate_links_and_cache(self):
        h = read('index.html')
        self.assertRegex(h, r'<link rel="alternate" type="text/markdown" href="llms.txt"')
        self.assertIn('href="ai/index.json"', h)
        self.assertIn('<a href="llms.txt">', h)
        self.assertIn("var CACHE = 'hj-v95';", read('sw.js'))
        self.assertTrue(os.path.exists(os.path.join(ROOT, '.nojekyll')), '.nojekyll 유지(Jekyll 이 파일을 먹지 않게)')


class Served(unittest.TestCase):
    """정적 서버로 내보냈을 때 자바스크립트 없이 200 + 본문."""
    @classmethod
    def setUpClass(cls):
        h = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=ROOT, **k)
        http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
        cls.srv = socketserver.TCPServer(('127.0.0.1', 0), h)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = 'http://127.0.0.1:%d/' % cls.srv.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def get(self, p):
        with urllib.request.urlopen(self.base + p) as r:
            return r.status, r.read().decode('utf-8')

    def test_llms_and_md_200(self):
        st, body = self.get('llms.txt')
        self.assertEqual(st, 200)
        self.assertIn('# 행정 업무 연습장', body)
        st, body = self.get('ai/students.md')
        self.assertEqual(st, 200)
        self.assertIn('## 일정·강의실', body)
        st, body = self.get('ai/index.json')
        self.assertEqual(json.loads(body)['generator'], 'tools/make_llms.py')


if __name__ == '__main__':
    unittest.main()
