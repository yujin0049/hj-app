"""출석부(#/attend) 시험: python3 -m unittest tests.test_attend
- 더보기 버튼 하나(공부·규정), 홈·index.html 그대로, 공용 파일은 처음 열 때만, 캐시 hj-v74
- 서버(worker/): 열쇠는 해시만, history 덧붙이기만(트리거), CORS 는 Pages 주소만, 비밀값·D1 id 없음
- 저장소에 명단·시간표 자료 없음(이름은 서버 D1 에만), 0.3초 자동 저장 없음(누를 때 저장)"""
import os, re, unittest
R = os.path.join(os.path.dirname(__file__), '..')

def read(*p):
    with open(os.path.join(R, *p), encoding='utf-8') as f:
        return f.read()

class Wiring(unittest.TestCase):
    def test_more_button(self):
        m = read('js', 'modules', 'more.js')
        self.assertEqual(m.count("menuBtn('attend'"), 1)
        self.assertIn("id === 'attend') api.go('#/attend')", m)
        self.assertIn("'attend'", read('js', 'registry.js'))
        self.assertIn("id === 'attend'", read('js', 'app.js'))

    def test_lazy_and_cache(self):
        self.assertNotIn('attend', read('index.html'))
        self.assertNotIn('attend', read('js', 'modules', 'home.js'))
        self.assertIn('js/attend-core.js?v=', read('js', 'modules', 'attend.js'))
        sw = read('sw.js')
        self.assertIn("var CACHE = 'hj-v74';", sw)
        self.assertNotIn('attend', sw)

    def test_front(self):
        a = read('js', 'modules', 'attend.js')
        self.assertIn('출석 책임: 담당 교수', a)
        self.assertIn('지각=출석으로 계산', a)
        self.assertIn('다른 분이 먼저 바꿈', a)
        self.assertIn('history.replaceState', a)  # 주소창에서 열쇠 지움
        self.assertIn("'Bearer '", a)
        self.assertIn('20000', a)  # 20초 새로 읽기
        self.assertNotRegex(a, r'setTimeout\([^)]*\b300\b')  # 0.3초 자동 저장 없음
        self.assertNotIn('indexedDB', a)
        self.assertNotRegex(a, r'<script[^>]+src=["\']https?:')  # 바깥 라이브러리 없음

class Server(unittest.TestCase):
    def test_schema(self):
        s = read('worker', 'schema.sql')
        self.assertIn('PRIMARY KEY (session, student_id)', s)
        self.assertRegex(s, r'BEFORE UPDATE ON history[\s\S]*append-only')
        self.assertRegex(s, r'BEFORE DELETE ON history[\s\S]*append-only')
        self.assertIn("CHECK (status IN ('', 'o', 'l', 'x'))", s)

    def test_worker(self):
        w = read('worker', 'src', 'index.js')
        self.assertIn("crypto.subtle.digest('SHA-256'", w)
        self.assertNotRegex(w, r'console\.(log|info|warn|error)')
        self.assertNotIn('/api/admin/wipe', w)
        self.assertNotRegex(w, r'DELETE FROM|UPDATE history')
        t = read('worker', 'wrangler.toml')
        self.assertIn('ALLOWED_ORIGIN = "https://yujin0049.github.io"', t)
        self.assertNotRegex(t, r'(?i)(secret|token|key)\s*=')
        gi = read('worker', '.gitignore')
        for x in ('.dev.vars', '.wrangler/', 'dist/'):
            self.assertIn(x, gi)

    def test_no_roster_in_repo(self):
        for root, dirs, files in os.walk(R):
            dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '.wrangler')]
            for f in files:
                self.assertFalse(re.search(r'(?i)(roster|명단|attend).*\.(json|csv|xlsx)$', f), f)
        for p in (('worker', 'src', 'index.js'), ('js', 'attend-core.js'), ('js', 'modules', 'attend.js')):
            self.assertNotRegex(read(*p), r'(?i)ojnt_timetable|students\s*:\s*\[\s*["\']')

if __name__ == '__main__':
    unittest.main()
