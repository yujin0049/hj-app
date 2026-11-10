"""#/chat 「EXAONE 시험 칸」(js/modules/exaone.js) + 중계 Worker(worker/exaone-proxy/) 시험: python3 -m unittest tests.test_exaone
- 진짜 EXAONE 은 부르지 않아요(가짜 fetch·가짜 답). 시험 열쇠는 매번 무작위로 만들고 어디에도 안 남겨요.
- 열쇠 없음 → {error:'키 미설정'} · 추론(reasoning_content)은 화면·Worker 답 어디에도 없음 · 허용 출처 밖 403 · 분당 횟수 넘으면 429.
출처: 유진님 11.10. 22:36 「ㄱ」(대장 전달, 춘식이 exaone_trial)."""
import json
import os
import re
import secrets
import shutil
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROXY = os.path.join(ROOT, 'worker', 'exaone-proxy', 'index.mjs')
UI = os.path.join(ROOT, 'js', 'modules', 'exaone.js')
APP = 'https://yujin0049.github.io'


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8') as fh:
        return fh.read()


def run_proxy(script, payload=None):
    js = ("import * as P from %s; const W=P.default; const IN=JSON.parse((await import('node:fs')).readFileSync(0,'utf8'));"
          "const out=await (async()=>{%s})(); process.stdout.write(JSON.stringify(out));" % (json.dumps('file://' + PROXY), script))
    r = subprocess.run(['node', '--input-type=module', '-e', js], input=json.dumps(payload or {}), capture_output=True, text=True, timeout=60)
    if r.returncode:
        raise AssertionError(r.stderr)
    return json.loads(r.stdout), r.stderr


# 가짜 EXAONE 답(문서의 응답 모양 + 추론 글). 진짜 서버로는 안 나가요.
MOCK_HELPERS = r"""
const SECRET_THOUGHT='REASONING-SHOULD-NOT-SHOW';
const calls=[];
const fakeFetch=async(u,o)=>{calls.push({u,auth:o.headers.Authorization,body:JSON.parse(o.body)});
  return new Response(JSON.stringify({id:'x',object:'chat.completion',model:'k-exaone_v2.5',
    choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'\n\n안녕하세요, 시험 답이에요.',reasoning_content:SECRET_THOUGHT}}],
    usage:{prompt_tokens:3,completion_tokens:9,reasoning_tokens:5}}),{status:200,headers:{'Content-Type':'application/json'}});};
const post=async(env,body,origin,ip,deps)=>{const h={'Content-Type':'application/json','CF-Connecting-IP':ip||'1.2.3.4'}; if(origin) h.Origin=origin;
  const r=await W.fetch(new Request('https://proxy/chat',{method:'POST',headers:h,body:typeof body==='string'?body:JSON.stringify(body)}),env,{},deps||{fetch:fakeFetch});
  const t=await r.text(); return {s:r.status,acao:r.headers.get('access-control-allow-origin'),t};};
const ask={messages:[{role:'user',content:'안녕'}]};
"""


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class ExaoneProxy(unittest.TestCase):
    def test_no_key_says_key_missing_and_never_calls_out(self):
        out, err = run_proxy(MOCK_HELPERS + r"""
          const env={ALLOW_ORIGINS:'%s'};
          const a=await post(env,ask,'%s'); const b=await post(Object.assign({EXAONE_API_KEY:'  '},env),ask,'%s','5.5.5.5');
          return {a,b,calls:calls.length};""" % (APP, APP, APP))
        self.assertEqual(out['a']['s'], 503)
        self.assertEqual(json.loads(out['a']['t'])['error'], '키 미설정')
        self.assertEqual(out['a']['acao'], APP)
        self.assertEqual(json.loads(out['b']['t'])['error'], '키 미설정')   # 빈칸 열쇠도 없음으로
        self.assertEqual(json.loads(out['b']['t'])['diag'], {'key_present': False, 'key_had_space': True, 'key_had_quotes': False, 'key_had_bearer': False})
        self.assertEqual(out['calls'], 0)
        self.assertEqual(err, '')

    def test_mock_answer_hides_reasoning_and_sends_spec_fields(self):
        key = 'test-' + secrets.token_urlsafe(18)
        out, err = run_proxy(MOCK_HELPERS + r"""
          const env={ALLOW_ORIGINS:'%s',EXAONE_API_KEY:IN.k};
          const r=await post(env,{messages:[{role:'user',content:'하나'},{role:'assistant',content:'둘'},{role:'user',content:'셋'}]},'%s');
          return {r,call:calls[0],pick:P.pickAnswer({choices:[{message:{reasoning_content:'x'}}]})};""" % (APP, APP), {'k': key})
        self.assertEqual(out['r']['s'], 200)
        self.assertEqual(json.loads(out['r']['t']), {'ok': True, 'text': '안녕하세요, 시험 답이에요.'})
        self.assertNotIn('REASONING', out['r']['t'])
        self.assertNotIn('reasoning', out['r']['t'])
        self.assertNotIn(key, out['r']['t'])
        c = out['call']
        self.assertEqual(c['u'], 'https://api.exaone.ai/v1/chat/completions')
        self.assertEqual(c['auth'], 'Bearer ' + key)
        self.assertEqual(c['body']['model'], 'k-exaone_v2.5')
        self.assertEqual(c['body']['reasoning_effort'], 'low')
        self.assertIs(c['body']['stream'], False)
        self.assertEqual([m['role'] for m in c['body']['messages']], ['user', 'assistant', 'user'])
        self.assertIsNone(out['pick'])                     # 추론만 있고 답이 없으면 아무것도 안 보여 줌
        self.assertNotIn(key, err)

    def test_origin_rejected(self):
        out, _ = run_proxy(MOCK_HELPERS + r"""
          const env={ALLOW_ORIGINS:'%s',EXAONE_API_KEY:'test-x'};
          const evil=await post(env,ask,'https://evil.example'); const none=await post(env,ask,null);
          const pre=await W.fetch(new Request('https://proxy/chat',{method:'OPTIONS',headers:{Origin:'https://evil.example'}}),env);
          const preOk=await W.fetch(new Request('https://proxy/chat',{method:'OPTIONS',headers:{Origin:'%s'}}),env);
          const get=await W.fetch(new Request('https://proxy/chat',{headers:{Origin:'%s'}}),env);
          return {evil:[evil.s,evil.acao],none:none.s,pre:[pre.status,pre.headers.get('access-control-allow-origin')],preOk:preOk.status,get:get.status,calls:calls.length};""" % (APP, APP, APP))
        self.assertEqual(out['evil'], [403, None])
        self.assertEqual(out['none'], 403)
        self.assertEqual(out['pre'], [403, None])
        self.assertEqual(out['preOk'], 204)
        self.assertEqual(out['get'], 405)
        self.assertEqual(out['calls'], 0)

    def test_rate_limit_per_ip_and_bad_shapes(self):
        out, _ = run_proxy(MOCK_HELPERS + r"""
          P._resetRate();
          const env={ALLOW_ORIGINS:'%s'};
          const codes=[]; for(let i=0;i<8;i++) codes.push((await post(env,ask,'%s','9.9.9.9')).s);
          const other=(await post(env,ask,'%s','8.8.8.8')).s;
          const ck=(o)=>{const r=P.checkRequest(typeof o==='string'?o:JSON.stringify(o));return r.ok?'ok':r.status+':'+r.error};
          return {codes,other,rate:P.RATE_PER_MIN,
            plain:ck('안녕'), extra:ck({messages:ask.messages,model:'x'}), role:ck({messages:[{role:'system',content:'x'}]}),
            last:ck({messages:[{role:'assistant',content:'x'}]}), many:ck({messages:Array(9).fill({role:'user',content:'x'})}),
            long:ck({messages:[{role:'user',content:'가'.repeat(4001)}]}), empty:ck({messages:[{role:'user',content:'  '}]}),
            field:ck({messages:[{role:'user',content:'x',reasoning_content:'y'}]})};""" % (APP, APP, APP))
        self.assertEqual(out['rate'], 6)
        self.assertEqual(out['codes'][:6], [503] * 6)       # 열쇠 없음이라도 횟수는 셈
        self.assertEqual(out['codes'][6:], [429, 429])
        self.assertEqual(out['other'], 503)                  # 다른 IP 는 따로
        self.assertEqual(out['plain'], '400:not-json')
        self.assertEqual(out['extra'], '400:shape')
        self.assertEqual(out['role'], '400:role')
        self.assertEqual(out['last'], '400:last-not-user')
        self.assertEqual(out['many'], '400:messages')
        self.assertEqual(out['long'], '413:too-long')
        self.assertEqual(out['empty'], '400:content')
        self.assertEqual(out['field'], '400:shape')

    def test_upstream_status_mapping(self):
        """401·403 만 key-rejected. 그 밖 4xx·5xx 는 상류 상태 그대로 + 짧은 detail(열쇠·긴 토큰 가림)."""
        key = 'test-' + secrets.token_urlsafe(24)
        out, err = run_proxy(MOCK_HELPERS + r"""
          P._resetRate();
          const env={ALLOW_ORIGINS:'%s',EXAONE_API_KEY:IN.k};
          const mk=(s,b)=>({fetch:async()=>new Response(b||JSON.stringify({error:{message:'bad thing '+IN.k+' '+'x'.repeat(300)}}),{status:s})});
          const res={}; let i=0;
          for (const s of [401,403,400,404,422,500,503]) res[s]=await post(env,ask,'%s','1.1.1.'+(i++),mk(s));
          res.r429=await post(env,ask,'%s','1.1.2.1',mk(429));
          res.html=await post(env,ask,'%s','1.1.2.2',mk(403,'<html><title>Just a moment...</title></html>'));
          res.down=await post(env,ask,'%s','1.1.2.3',{fetch:async()=>{throw new Error('down')}});
          return res;""" % (APP, APP, APP, APP, APP), {'k': key})
        J = {k: json.loads(v['t']) for k, v in out.items()}
        for s in ('401', '403'):
            self.assertEqual(out[s]['s'], 502)
            self.assertEqual((J[s]['error'], J[s]['code'], J[s]['diag']['upstream_status']), ('key-rejected', int(s), int(s)))
        for s in ('400', '404', '422', '500', '503'):
            self.assertEqual(out[s]['s'], int(s))
            self.assertEqual((J[s]['error'], J[s]['code']), ('upstream', int(s)))
            self.assertTrue(J[s]['detail'].startswith('bad thing'))
            self.assertLessEqual(len(J[s]['detail']), 120)
        self.assertEqual((out['r429']['s'], J['r429']['error']), (429, 'upstream-rate'))
        self.assertEqual(J['html']['detail'], 'html: Just a moment...')
        self.assertEqual(out['down']['s'], 502)
        self.assertEqual(J['down']['error'], 'upstream-unreachable')
        for v in out.values():
            self.assertNotIn(key, v['t'])            # 열쇠는 어디에도 안 나옴
        self.assertNotIn(key, err)

    def test_key_trim_quotes_and_bearer(self):
        """비밀에 앞뒤 공백·줄바꿈·따옴표·「Bearer 」가 붙어도 상류엔 정확히 'Bearer <열쇠>' 로 가요. diag 는 참/거짓만."""
        key = 'test-' + secrets.token_urlsafe(18)
        out, _ = run_proxy(MOCK_HELPERS + r"""
          P._resetRate(); const res=[];
          for (const raw of [' '+IN.k+'\n', '\t"'+IN.k+'"\r\n', 'Bearer '+IN.k, IN.k]) {
            const r=await post({ALLOW_ORIGINS:'%s',EXAONE_API_KEY:raw},ask,'%s','2.2.2.'+res.length);
            res.push({s:r.s, auth:calls[calls.length-1].auth, diag:P.cleanKey(raw).diag});
          }
          return res;""" % (APP, APP), {'k': key})
        for r in out:
            self.assertEqual(r['s'], 200)
            self.assertEqual(r['auth'], 'Bearer ' + key)
            self.assertTrue(all(isinstance(v, bool) for v in r['diag'].values()))
        self.assertTrue(out[0]['diag']['key_had_space'])
        self.assertTrue(out[1]['diag']['key_had_quotes'])
        self.assertTrue(out[2]['diag']['key_had_bearer'])
        self.assertEqual(out[3]['diag'], {'key_present': True, 'key_had_space': False, 'key_had_quotes': False, 'key_had_bearer': False})

    def test_source_has_no_key_and_no_logging(self):
        w = read('worker', 'exaone-proxy', 'index.mjs') + read('worker', 'exaone-proxy', 'wrangler.toml')
        self.assertNotIn('console.', w)
        self.assertNotRegex(w, r'EXAONE_API_KEY\s*=\s*["\'][^"\']+')
        self.assertNotRegex(w, r'(sk|ex)-[A-Za-z0-9]{20,}')
        self.assertIn('ALLOW_ORIGINS = "https://yujin0049.github.io"', w)
        code = re.sub(r'/\*.*?\*/', '', read('worker', 'exaone-proxy', 'index.mjs'), flags=re.S)
        for bad in ('env.DB', 'KV', '.put('):     # 저장소 없음(본문·답을 남기지 않음)
            self.assertNotIn(bad, code)


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class ExaoneScreen(unittest.TestCase):
    def screen(self, mode):
        js = r"""
global.window=global; const mode=process.argv[1]; const sent=[];
global.fetch=async(u,o)=>{sent.push({u,body:JSON.parse(o.body)});
  if(mode==='nokey') return new Response(JSON.stringify({error:'키 미설정'}),{status:503});
  if(mode==='raw') return new Response(JSON.stringify({choices:[{message:{content:'원본',reasoning_content:'THOUGHT'}}]}),{status:200});
  return new Response(JSON.stringify({ok:true,text:'시험 답',reasoning_content:'THOUGHT'}),{status:200});};
require(process.argv[2]);
const mk=()=>{let html='';const nodes={};return {get innerHTML(){return html},set innerHTML(v){html=v},
  querySelector(q){ if(q==='#ex-text') return nodes.ta||(nodes.ta={value:'안녕'}); if(q==='#ex-form') return nodes.f||(nodes.f={}); return null; }, nodes};};
const slot=mk(); const api={esc:(x)=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;')};
HJExaone.mount(slot,api); const first=slot.innerHTML;
slot.nodes.f.onsubmit({preventDefault(){}});
setTimeout(()=>{console.log(JSON.stringify({first,html:slot.innerHTML,sent}))},100);
"""
        r = subprocess.run(['node', '-e', js, mode, UI], capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads(r.stdout.strip().splitlines()[-1])

    def test_notice_above_input(self):
        h = self.screen('ok')['first']
        self.assertIn('개인정보·내부문서는 외부(EXAONE)로 보내지 마세요', h)
        self.assertLess(h.index('id="ex-notice"'), h.index('id="ex-text"'))

    def test_no_key_path_shows_notice_only(self):
        o = self.screen('nokey')
        self.assertIn('키 미설정', o['html'])
        self.assertEqual(o['sent'][0]['u'], 'https://hj-exaone-proxy.yujin06344.workers.dev/chat')
        self.assertEqual(o['sent'][0]['body'], {'messages': [{'role': 'user', 'content': '안녕'}]})
        self.assertNotIn('class="ex-msg user"', o['html'])   # 못 보낸 글은 입력칸으로 돌려놓음
        self.assertIn('>안녕</textarea>', o['html'])

    def test_answer_shown_without_reasoning(self):
        o = self.screen('ok')
        self.assertIn('시험 답', o['html'])
        self.assertNotIn('THOUGHT', o['html'])
        o2 = self.screen('raw')                       # Worker 를 거치지 않은 원본 모양이 와도 추론을 안 보여 줌
        self.assertNotIn('THOUGHT', o2['html'])

    def test_screen_holds_no_key_and_no_storage(self):
        s = re.sub(r'/\*.*?\*/', '', read('js', 'modules', 'exaone.js'), flags=re.S)
        for bad in ('localStorage', 'sessionStorage', 'document.cookie', 'indexedDB', 'Authorization', 'api.exaone.ai', 'EXAONE_API_KEY', 'reasoning_content'):
            self.assertNotIn(bad, s)
        self.assertEqual(s.count("method: 'POST'"), 1)

    def test_chat_page_mounts_pane_without_touching_room(self):
        c = read('js', 'modules', 'chat.js')
        self.assertIn('<div id="ex-slot"></div>', c)
        self.assertIn("js/modules/exaone.js?v=1", c)
        self.assertIn('root.HJExaone.mount(slot, api)', c)
        self.assertNotIn('exaone', read('js', 'registry.js'))      # 새 화면이 아니라 #/chat 안의 칸


if __name__ == '__main__':
    unittest.main()
