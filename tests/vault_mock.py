"""가짜 잠긴 API 서버(시험·화면 확인용). 저장소 정적 파일 + /api/vault/* (가짜 볼트 tests/fixtures/vault_docs 로 만든 팩).
직접 실행: python tests/vault_mock.py PORT [ok|locked|missing|down|drop|empty]
  locked=403 · missing=404 · down=503 · drop=연결 끊김(인터넷 없음) · empty=문서 0개"""
import http.server, json, os, socketserver, sys, tempfile, threading, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build_vault_pack as B


def build_fixture_pack(today='2026-10-21 10:30'):
    with open(os.path.join(ROOT, 'tools', 'vault_folders.json'), encoding='utf-8') as f:
        cfg = json.load(f)
    out = tempfile.mkdtemp(prefix='hj_mockvault_')
    B.build(cfg, os.path.join(HERE, 'fixtures', 'vault_docs'), out, today)
    return out


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def send_json(self, obj, st=200, raw=None):
        b = raw if raw is not None else json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(st)
        self.send_header('content-type', 'application/json; charset=utf-8')
        self.send_header('cache-control', 'no-store, private')
        self.send_header('content-length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if not u.path.startswith('/api/vault/'):
            return super().do_GET()
        mode, pack = self.server.mode, self.server.pack
        if mode == 'drop':
            self.close_connection = True
            self.connection.close()
            return
        if mode == 'locked':
            return self.send_json({'error': '잠금 확인 실패(로그인 필요)'}, 403)
        if mode == 'missing':
            return self.send_json({'error': '자료 없음'}, 404)
        if mode == 'down':
            return self.send_json({'error': '자료 없음(VAULT_KV 바인딩 없음)'}, 503)
        with open(os.path.join(pack, 'index.json'), encoding='utf-8') as f:
            idx = json.load(f)
        if mode == 'empty':
            idx['docs'], idx['count'] = [], 0
        q = urllib.parse.parse_qs(u.query)
        if u.path == '/api/vault/index':
            return self.send_json(idx)
        if u.path == '/api/vault/doc':
            i = (q.get('id') or [''])[0]
            p = os.path.join(pack, 'docs', i + '.json')
            if len(i) != 12 or not all(c in '0123456789abcdef' for c in i):
                return self.send_json({'error': 'id 형식'}, 400)
            if not os.path.isfile(p):
                return self.send_json({'error': '없는 문서'}, 404)
            with open(p, 'rb') as f:
                return self.send_json(None, raw=f.read())
        if u.path == '/api/vault/search':   # lock/vault_api.js 와 같은 규칙
            s = (q.get('q') or [''])[0].strip().lower()[:50]
            if len(s) < 2:
                return self.send_json({'q': s, 'hits': []})
            with open(os.path.join(pack, 'search.json'), encoding='utf-8') as f:
                srch = json.load(f)
            by = {d['id']: d for d in idx['docs']}
            hits = []
            for i, t in srch.items():
                k = t.find(s)
                if k >= 0 and i in by:
                    hits.append({'id': i, 'title': by[i]['title'], 'folder': by[i]['folder'], 'path': by[i]['path'],
                                 'snip': t[max(0, k - 40):k + 80]})
            return self.send_json({'q': s, 'hits': hits[:30]})
        return self.send_json({'error': 'not found'}, 404)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def start(mode='ok', pack=None, port=0):
    srv = Server(('127.0.0.1', port), Handler)
    srv.mode, srv.pack = mode, pack or build_fixture_pack()
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


if __name__ == '__main__':
    s = start(sys.argv[2] if len(sys.argv) > 2 else 'ok', port=int(sys.argv[1]))
    print('http://127.0.0.1:%d/#/vault  (%s)' % (s.server_address[1], s.mode))
    threading.Event().wait()
