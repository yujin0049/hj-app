"""협업 보드(#/bots 맨 위, js/collab-board-core.js) 시험: python3 -m unittest tests.test_collab_board
- 카드에는 허용 목록 7칸(일 번호·짧은 제목·봇 이름·상태·다음 단계·시각·연습장 링크)만 나와요. 다른 칸은 버려요.
- 카드 글은 그냥 글자(HTML 해석 안 함). 링크는 앱 안(#/…)만.
- 보기 전용: 보드 부분에 입력칸 없음. 캐시 hj-v77.
출처: 유진님 10.30. 19:22 「너희들이랑 나랑 협업가능하게 행정업무연습장 개선예정」, 계획서 261030_연습장_협업툴_검토_v01."""
import json
import os
import re
import shutil
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = os.path.join(ROOT, 'js', 'collab-board-core.js')
FIELDS = ['no', 'title', 'bot', 'state', 'next', 'at', 'link']


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8') as fh:
        return fh.read()


def node(script, payload):
    """node 로 core 를 불러 script 를 돌리고 JSON 결과를 받아요."""
    js = ("const H=require(%s);const P=JSON.parse(require('fs').readFileSync(0,'utf8'));" % json.dumps(CORE)) + script
    r = subprocess.run(['node', '-e', js], input=json.dumps(payload, ensure_ascii=False), capture_output=True, text=True, timeout=60)
    if r.returncode:
        raise AssertionError(r.stderr)
    return json.loads(r.stdout)


FAKE_PHONE = '-'.join(['010', '1234', '5678'])  # 시험용 가짜 모양(파일에 그대로 안 적음)
FAKE_MAIL = 'a' + chr(64) + 'b.kr'
EVIL = '<img src=x onerror=alert(1)>"\'`&'
TASK = {'t': 'T901', 'title': '실습재료 납품 ' + EVIL + ' (15,180,000원·용호기공)', 'bot': '춘식이', 'state': '대기(유진님 몫)',
        'raw': '비밀원문칸', 'progress': 37, 'verified': '점검비밀', 'due': '2026-11-01', 'updated': '2026-10-30 19:40',
        'yujin': ['결재', '송금 3천만원(용호기공)', {'x': 1}], 'yujin_src': '현황판', 'yujin_guess': [], 'risk': ['감사위험비밀'],
        'memo': '메모비밀', 'phone': FAKE_PHONE, 'folder': 'F:/비밀/경로'}
TODO = {'date': '2026-10-30', 'items': [
    {'id': 't1', 'title': 'T901 납품서 받기', 'note': '노트비밀 F:/경로', 'path': '경로비밀', 'who': 'yujin', 'done': False},
    {'id': 't2', 'title': '코러스 ' + EVIL, 'note': '노트비밀2', 'who': 'yujin', 'done': False},
    {'id': 't4', 'title': 'T999 현황판에 없는 일', 'note': '노트비밀3', 'who': 'yujin', 'done': False},
    {'id': 't3', 'title': '끝난 일', 'note': '', 'who': 'yujin', 'done': True}]}
SECRETS = ['비밀원문칸', '점검비밀', '감사위험비밀', '메모비밀', FAKE_PHONE, 'F:/비밀', '노트비밀', '경로비밀', '15,180,000', '용호기공', '3천만', 'object Object', '>37<', '37%']


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class Whitelist(unittest.TestCase):
    def setUp(self):
        self.out = node("const c=H.build({tasks:P.tasks},P.todo,Date.UTC(2026,9,30,11,0));"
                        "process.stdout.write(JSON.stringify({fields:H.FIELDS,cards:c.map(H.pick),html:c.map(H.cardHTML).join('')}))",
                        {'tasks': [TASK], 'todo': TODO})

    def test_fields_are_the_seven(self):
        self.assertEqual(self.out['fields'], FIELDS)
        self.assertEqual(len(self.out['cards']), 3)  # T901 + 번호 없는 할 일 + 현황판에 없는 T999 할 일(끝난 일 빠짐)
        for c in self.out['cards']:
            self.assertEqual(set(c), set(FIELDS) | {'stale'})
            self.assertIsInstance(c['stale'], bool)

    def test_other_columns_never_rendered(self):
        blob = json.dumps(self.out['cards'], ensure_ascii=False) + self.out['html']
        for s in SECRETS:
            self.assertNotIn(s, blob, s)

    def test_card_values(self):
        c = self.out['cards'][0]
        self.assertEqual(c['no'], 'T901')
        self.assertEqual(c['state'], '유진님 확인 필요')
        self.assertEqual(c['bot'], '춘식이')
        self.assertEqual(c['link'], '#/bots?t=T901')
        self.assertEqual(c['at'], '10.30.(금) 19:40')
        self.assertEqual(c['next'], '유진님: 납품서 받기')
        nos = [x['no'] for x in self.out['cards']]
        self.assertEqual(nos[1:], ['할 일 2', '할 일 3'])  # 남은 일만 세어요
        self.assertIn('T999', self.out['cards'][2]['title'])
        self.assertFalse(c['stale'])
        self.assertLessEqual(len(c['title']), 28)

    def test_html_has_only_seven_slots(self):
        h = self.out['html']
        self.assertEqual(h.count('<article'), 3)
        cls = set(re.findall(r'class="(cb-[a-z0-9]+)', h))
        self.assertLessEqual(cls, {'cb-card', 'cb-t1', 'cb-dot', 'cb-no', 'cb-st', 'cb-title', 'cb-meta', 'cb-bot', 'cb-at', 'cb-next', 'cb-link'})
        self.assertNotRegex(h, r'<(input|textarea|select|button|form)\b')


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class PlainText(unittest.TestCase):
    def test_escaped(self):
        out = node("process.stdout.write(JSON.stringify(H.cardHTML(H.pick(P.c))))",
                   {'c': {'no': EVIL, 'title': EVIL, 'bot': EVIL, 'state': EVIL, 'next': EVIL, 'at': EVIL, 'link': '#/bots'}})
        self.assertNotIn('<img', out)
        self.assertNotIn('onerror=alert(1)>', out.replace('&gt;', ''))
        self.assertIn('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&#96;&amp;', out)

    def test_link_only_inside_app(self):
        for bad in ['javascript:alert(1)', 'https://evil.example/', '#/bots" onclick="x', '//evil']:
            out = node("process.stdout.write(JSON.stringify(H.cardHTML(H.pick(P.c))))",
                       {'c': {'no': 'T1', 'title': 'a', 'bot': 'b', 'state': '진행', 'next': 'n', 'at': '', 'link': bad}})
            self.assertIn('href="#/bots"', out, bad)
            self.assertNotIn('javascript:', out)
            self.assertNotIn('evil', out)

    def test_short_title_drops_money_and_contacts(self):
        out = node("process.stdout.write(JSON.stringify(P.l.map(H.shortTitle)))",
                   {'l': ['[719] 실습재료 15,180,000원(용호기공) 품의', '조교 지급(4개월 113만 원) 상세', '문의 ' + FAKE_PHONE + ' ' + FAKE_MAIL, '<script>x</script>제목']})
        self.assertEqual(out[0], '실습재료 품의')
        self.assertEqual(out[1], '조교 지급 상세')
        self.assertNotIn('010', out[2]); self.assertNotIn('@', out[2])
        self.assertNotIn('<', out[3])

    def test_more_money_and_contact_shapes(self):
        l = ['송금 3천만원', '예산 1억 원 확보', '단가 5백만원', '집행 \\15,180,000', '집행 15,180,000 KRW', '금 1,500,000 지급',
             '견적(용호기공', '【업체명】 품의', '연락 ' + '0101234' + '5678', '연락 010.1234.5678', '번호 ' + '900101' + '1234567',
             '(x)·품의', '2원칙 지키기']
        out = node("process.stdout.write(JSON.stringify(P.l.map(H.shortTitle)))", {'l': l})
        for o in out[:6]:
            self.assertNotRegex(o, r'\d', o)
        self.assertNotIn('용호기공', out[6]); self.assertNotIn('업체명', out[7])
        for o in out[8:11]:
            self.assertNotRegex(o, r'\d{4}', o)
        self.assertEqual(out[11], '품의')
        self.assertEqual(out[12], '2원칙 지키기')

    def test_odd_input_does_not_throw(self):
        out = node("process.stdout.write(JSON.stringify([H.build(null,null).length,H.build({tasks:{}},{items:'x'}).length,"
                   "H.build({tasks:[null,1,{t:'T1'},{t:'T123',state:'보류',updated:'2026-13-45 99:99'}]},null).map(H.pick)]))", {})
        self.assertEqual(out[0], 0); self.assertEqual(out[1], 0)
        self.assertEqual(len(out[2]), 1)
        self.assertEqual(out[2][0]['state'], '그 밖')
        self.assertEqual(out[2][0]['at'], '')

    def test_stale_after_three_days(self):
        out = node("const t=(h)=>H.build({tasks:[{t:'T100',title:'a',bot:'대장',state:'진행',updated:'2026-10-27 10:00'}]},null,Date.UTC(2026,9,27,1,0)+h*3600000)[0].stale;"
                   "process.stdout.write(JSON.stringify([t(72),t(72.1),t(1)]))", {})
        self.assertEqual(out, [False, True, False])


@unittest.skipUnless(shutil.which('node'), 'node 없음')
class RealData(unittest.TestCase):
    def test_real_files_whitelisted(self):
        out = node("const c=H.build(P.s,P.t);process.stdout.write(JSON.stringify({c:c.map(H.pick),g:H.group(c,'state').map(x=>x.key),b:H.group(c,'bot').map(x=>x.key)}))",
                   {'s': json.loads(read('data', 'bot_status.json')), 't': json.loads(read('data', 'todo.json'))})
        self.assertGreater(len(out['c']), 0)
        for c in out['c']:
            self.assertEqual(set(c), set(FIELDS) | {'stale'})
            self.assertNotRegex(c['title'] + c['next'], r'\d[\d,.]*(\s*[억천백만])*\s*원(?![가-힣])|\d{1,3}(,\d{3})+')
            self.assertNotRegex(c['title'] + c['next'], r'\d{2,3}-\d{3,4}-\d{4}|[\w.]+@[\w-]+\.\w|\d{6}-\d{7}')
            self.assertTrue(c['link'].startswith('#/'))
        self.assertEqual(out['g'][0], '유진님 확인 필요')
        self.assertEqual(out['b'][0], '유진님')


class Screen(unittest.TestCase):
    def test_bots_screen_uses_board_view_only(self):
        ui = read('js', 'modules', 'bots.js')
        self.assertIn('js/collab-board-core.js', ui)
        self.assertIn('data/todo.json', ui)
        self.assertIn('id="cb-board"', ui)
        board = ui[ui.index('function boardSection'):ui.index('var CSS = [')]
        self.assertNotRegex(board, r'<(input|textarea|form)\b')
        self.assertNotIn('localStorage', board)
        self.assertNotIn('method:', board)
        self.assertIn('H.cardHTML', board)

    def test_cache_bumped(self):
        self.assertIn("var CACHE = 'hj-v77';", read('sw.js'))

    def test_no_contact_info_in_core(self):
        text = read('js', 'collab-board-core.js')
        self.assertNotRegex(text, r'\d{3}-\d{4}-\d{4}')
        self.assertNotRegex(text, r'[\w.]+@[\w-]+\.[a-z]{2,}')
        self.assertNotRegex(text, r'\d{6}-\d{7}')


if __name__ == '__main__':
    unittest.main()
