"""대장↔클로드 방(#/chat, js/chat-crypto.js, tools/hj_chat.mjs, chat-collect workflow) 시험: python3 -m unittest tests.test_chat
- 시험 열쇠는 시험 때마다 무작위로 만들고 어디에도 안 남겨요(진짜 열쇠는 계정_메모.md, 대장·유진님이 넣음).
- 저장소에 올라가는 방 파일에는 평문(본문·보낸 사람·시각)이 없어야 해요.
- 틀린 열쇠·고친 암호문·번호 바꿔 붙이기·다른 방 글은 못 풀어요. 합치기는 열쇠 없이 번호 합집합, 다른 방이면 거절.
- 화면은 열쇠를 저장하지 않고(localStorage·쿠키 없음) 글은 그냥 글자로만 보여요.
출처: 유진님 10.30. 19:43 「거기에 클로드 pc연결끊겨도 채팅방형식으로 답할 수 있게 만들어. 대장-클로드랑」."""
import json
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = os.path.join(ROOT, 'js', 'chat-crypto.js')
TOOL = os.path.join(ROOT, 'tools', 'hj_chat.mjs')


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8') as fh:
        return fh.read()


def node(script, payload):
    js = ("const C=require(%s);const P=JSON.parse(require('fs').readFileSync(0,'utf8'));(async()=>{%s})().then(r=>process.stdout.write(JSON.stringify(r)),e=>{console.error(e&&e.stack||e);process.exit(1)});"
          % (json.dumps(CORE), script))
    r = subprocess.run(['node', '-e', js], input=json.dumps(payload, ensure_ascii=False), capture_output=True, text=True, timeout=120)
    if r.returncode:
        raise AssertionError(r.stderr)
    return json.loads(r.stdout)


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class ChatCrypto(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = 'test-' + secrets.token_urlsafe(24)
        cls.room = node("""
          let room=await C.initRoom(P.k); const k=await C.unlock(P.k,room);
          room=await C.post(k,room,'대장','첫 글 <img src=x onerror=alert(1)>','2026-10-30T19:50:01+09:00');
          room=await C.post(k,room,'클로드','두 번째\\n줄바꿈','2026-10-30T19:51:02+09:00');
          return room;""", {'k': cls.key})

    def test_room_has_only_ciphertext(self):
        raw = json.dumps(self.room, ensure_ascii=False)
        for word in ('첫 글', '두 번째', '대장', '클로드', 'img', self.key):
            self.assertNotIn(word, raw)
        self.assertEqual(sorted(self.room), ['check', 'iter', 'msgs', 'salt', 'v'])
        for m in self.room['msgs']:
            self.assertEqual(sorted(m), ['ct', 'id', 'iv'])
            self.assertRegex(m['id'], r'^m\d{12}-[0-9a-f]{6}$')
        self.assertGreaterEqual(self.room['iter'], 600000)

    def test_roundtrip_and_order(self):
        out = node("const k=await C.unlock(P.k,P.r);return C.readAll(k,P.r);", {'k': self.key, 'r': self.room})
        self.assertEqual([m['from'] for m in out], ['대장', '클로드'])
        self.assertEqual(out[1]['text'], '두 번째\n줄바꿈')
        self.assertFalse(any(m.get('bad') for m in out))

    def test_wrong_key_refused(self):
        out = node("try{await C.unlock(P.k,P.r);return 'opened'}catch(e){return e.message}", {'k': self.key + 'x', 'r': self.room})
        self.assertEqual(out, '열쇠가 달라요')

    def test_tamper_swap_and_cross_room_are_bad(self):
        out = node("""
          const k=await C.unlock(P.k,P.r); const r=JSON.parse(JSON.stringify(P.r));
          const ct=Buffer.from(r.msgs[0].ct,'base64'); ct[3]^=1; r.msgs[0].ct=ct.toString('base64');   // 한 바이트 고침
          const a=r.msgs[1]; r.msgs.push({id:'m261030200000-abcdef',iv:a.iv,ct:a.ct});                // 번호 바꿔 붙이기
          r.msgs.push(JSON.parse(JSON.stringify(a)));                                                   // 같은 번호 또 넣기
          let other=await C.initRoom(P.k); const k2=await C.unlock(P.k,other);
          other=await C.post(k2,other,'대장','다른 방 글','2026-10-30T19:59:00+09:00');
          r.msgs.push(other.msgs[0]);                                                                  // 다른 방 글(같은 열쇠라도)
          return C.readAll(k,r);""", {'k': self.key, 'r': self.room})
        bad = [m for m in out if m.get('bad')]
        good = [m for m in out if not m.get('bad')]
        self.assertEqual(len(good), 1)
        self.assertEqual(good[0]['text'], '두 번째\n줄바꿈')
        self.assertEqual(len(bad), 4)

    def test_low_iteration_room_refused(self):
        r = dict(self.room, iter=1000)
        out = node("try{await C.unlock(P.k,P.r);return 'opened'}catch(e){return e.message}", {'k': self.key, 'r': r})
        self.assertIn('반복 횟수', out)

    def test_short_key_refused(self):
        out = node("try{await C.initRoom('짧은열쇠');return 'made'}catch(e){return e.message}", {})
        self.assertIn('20자', out)

    def test_merge_union_idempotent_and_other_room_refused(self):
        out = node("""
          const k=await C.unlock(P.k,P.r);
          const b=await C.post(k,P.r,'클로드','가지에서 쓴 글','2026-10-30T20:01:00+09:00');
          const m1=C.merge(P.r,b), m2=C.merge(m1.room,b);
          const junk=JSON.parse(JSON.stringify(b)); junk.msgs.push({id:'../x',iv:'a',ct:'<b>'});
          const m3=C.merge(P.r,junk);
          let other=await C.initRoom(P.k); let refused='';
          try{C.merge(P.r,other)}catch(e){refused=e.message}
          return {a1:m1.added,a2:m2.added,n:m1.room.msgs.length,a3:m3.added,refused};""", {'k': self.key, 'r': self.room})
        self.assertEqual((out['a1'], out['a2'], out['n'], out['a3']), (1, 0, 3, 1))
        self.assertIn('다른 방', out['refused'])

    def test_bubble_is_plain_text(self):
        out = node("""const k=await C.unlock(P.k,P.r);const m=await C.readAll(k,P.r);
          return m.map(C.bubbleHTML).join('')+C.bubbleHTML({from:'x<script>',at:'',text:'`a`"b\\'',id:'m1'});""", {'k': self.key, 'r': self.room})
        self.assertNotIn('<img', out)
        self.assertNotIn('<script', out)
        self.assertIn('&lt;img src=x onerror=alert(1)&gt;', out)
        self.assertIn('그 밖', out)   # 모르는 보낸 사람은 '그 밖'
        tags = set(re.findall(r'<(\w+)', out))
        self.assertLessEqual(tags, {'div', 'time'})


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class ChatTool(unittest.TestCase):
    def run_tool(self, args, key, cwd, stdin=None):
        env = dict(os.environ)
        env.pop('HJ_CHAT_KEY', None)
        if key is not None:
            env['HJ_CHAT_KEY'] = key
        return subprocess.run(['node', TOOL] + args, cwd=cwd, env=env, input=stdin, capture_output=True, text=True, timeout=120)

    def test_cli_flow(self):
        key = 'test-' + secrets.token_urlsafe(24)
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(self.run_tool(['init'], None, d).returncode, 2)          # 열쇠 없으면 멈춤
            self.assertEqual(self.run_tool(['init'], key, d).returncode, 0)
            self.assertEqual(self.run_tool(['init'], key, d).returncode, 2)           # 덮어쓰지 않음
            self.assertEqual(self.run_tool(['post', '--from', '클로드', '--text', key], key, d).returncode, 2)  # 열쇠를 명령 줄에
            self.assertEqual(self.run_tool(['post', '--from', '누구', '--text', 'x'], key, d).returncode, 2)
            self.assertEqual(self.run_tool(['post', '--from', '클로드'], key, d, stdin='표준입력 글').returncode, 0)
            r = self.run_tool(['read'], key, d)
            self.assertIn('표준입력 글', r.stdout)
            self.assertIn('방 지문', r.stdout)
            self.assertEqual(self.run_tool(['read'], key + 'x', d).returncode, 2)
            raw = open(os.path.join(d, 'chat', 'room.json'), encoding='utf-8').read()
            self.assertNotIn('표준입력', raw)
            self.assertNotIn(key, raw)


class ChatWiring(unittest.TestCase):
    def test_screen_keeps_no_key_and_no_write(self):
        js = re.sub(r'/\*.*?\*/', '', read('js', 'modules', 'chat.js'), flags=re.S)
        for bad in ('localStorage', 'sessionStorage', 'document.cookie', 'indexedDB', 'innerText =', 'api.github.com', 'Authorization'):
            self.assertFalse(bad in js, bad)
        self.assertIn("type=\"password\"", js)
        self.assertIn("inp.value = ''", js)
        self.assertIn("ShellModules.chat", js)
        self.assertIn("'chat'", read('js', 'registry.js'))
        self.assertIn('#/chat', read('js', 'modules', 'bots.js'))

    def test_workflow_is_schedule_only_and_has_no_secret_values(self):
        y = '\n'.join(l for l in read('.github', 'workflows', 'chat-collect.yml').splitlines() if not l.lstrip().startswith('#'))
        on = y.split('\non:', 1)[1].split('\npermissions:', 1)[0]
        self.assertIn('schedule', on)
        self.assertNotIn('push', on)
        self.assertFalse('pull_request' in y)
        self.assertIn('secrets.HJ_CHAT_HOOK_URL', y)
        for u in re.findall(r'https?://[^\s"\']+', y):   # 웹훅 주소 같은 진짜 URL 없음(자리표시만)
            self.assertIn('${', u)
        self.assertIn('-o /dev/null', y)
        self.assertIn('workflow_run', on)          # 바로 모으기(main 판 파일로 돎)
        self.assertIn("'chat-ping'", on)

    def wf(self, name):
        return '\n'.join(l for l in read('.github', 'workflows', name).splitlines() if not l.lstrip().startswith('#'))

    def test_ping_has_no_secrets_and_no_permissions(self):
        y = self.wf('chat-ping.yml')
        self.assertIn('permissions: {}', y)
        self.assertNotIn('secrets.', y)
        self.assertIn("claude/**", y)
        self.assertNotIn('pull_request', y)

    def test_wake_claude_is_dispatch_only_and_skips_without_secrets(self):
        y = self.wf('chat-wake-claude.yml')
        on = y.split('\non:', 1)[1].split('\npermissions:', 1)[0]
        self.assertIn('workflow_dispatch', on)
        for bad in ('push', 'pull_request', 'schedule', 'issue'):
            self.assertNotIn(bad, on)
        self.assertIn('secrets.HJ_CLAUDE_FIRE_URL', y)
        self.assertIn('secrets.HJ_CLAUDE_FIRE_TOKEN', y)
        self.assertIn('건너뜀', y)
        self.assertIn('-o /dev/null', y)
        self.assertNotRegex(y, r'sk-ant-[A-Za-z0-9]')
        for u in re.findall(r'https?://[^\s"\']+', y):
            self.assertIn('${', u)

    def test_no_key_or_room_committed(self):
        self.assertFalse(os.path.exists(os.path.join(ROOT, 'chat', 'room.json')), 'main 쪽에 방 파일을 넣지 않아요(chat 가지 전용)')
        for p in (('js', 'chat-crypto.js'), ('js', 'modules', 'chat.js'), ('tools', 'hj_chat.mjs'), ('.github', 'workflows', 'chat-collect.yml'), ('.github', 'workflows', 'chat-wake-claude.yml'), ('docs', 'hj_chat_연동.md')):
            s = read(*p)
            self.assertNotRegex(s, r'HJ_CHAT_KEY\s*=\s*[\'"]?[A-Za-z0-9_\-]{12,}')


if __name__ == '__main__':
    unittest.main()
