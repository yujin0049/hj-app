"""위임전결 실무 기준 시험 (유진님 10.21. 확인). 실행: python -m unittest tests/test_practical_std.py -v
- 정해진 모든 자리에 「1,000만원 이상 부총장(담당 선생님 구두 안내, 유진님 10.21.)」 + 작은 메모 「규정 원문 경계는 3,000만원(위임전결규정 별표)」
- 연습·문제 정답은 1,000만원 실무 기준을 따름
- 실제 담당자 이름은 공개 저장소에 두지 않음(「담당 선생님 구두 안내」). 이름은 볼트·잠긴 묶음에만
- 카드 덮어쓰기는 앱(js/app.js applyOverrides)과 같은 규칙(파이썬판 tools/link_sources.py apply_override_obj)"""
import copy, json, os, re, shutil, subprocess, sys, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import link_sources as L

OV_PATH = os.path.join(ROOT, 'data', 'card_overrides.json')
with open(os.path.join(ROOT, 'public-pack.json'), encoding='utf-8') as f:
    RAW = json.load(f)
with open(OV_PATH, encoding='utf-8') as f:
    OV = json.load(f)
PRACT = '1,000만원 이상 부총장(담당 선생님 구두 안내, 유진님 10.21.)'
SOURCE = '담당 선생님 구두 안내, 유진님 10.21.'
NOTE = '규정 원문 경계는 3,000만원(위임전결규정 별표)'
NODE = shutil.which('node')

# 자리 → 화면에 보이는 칸(점 = 안쪽 칸). 규칙 R18·R19 = 규칙 목록 19·20번째, 문제 = 목록 순번(0부터) 101·119·136·142·256·258·263
PLACES = {
    'rules:R18': ['text'], 'rules:R19': ['text'],
    'tasks:t1': ['situation'], 'tasks:t4': ['situation'], 'tasks:t6': ['situation'],
    'questions:L17-05': ['해설'], 'questions:L20-05': ['해설'], 'questions:L24-02': ['해설'], 'questions:L25-03': ['해설'],
    'questions:M-02': ['해설'], 'questions:M-04': ['해설'], 'questions:M-09': ['해설'],
    'manual:blocks.5': ['rows.1.1'], 'work_items:w-mat': ['line'],
    'regulations:g8': ['summary'],
}
POSITIONS = {('rules', 18): 'R18', ('rules', 19): 'R19', ('questions', 101): 'L17-05', ('questions', 119): 'L20-05',
             ('questions', 136): 'L24-02', ('questions', 142): 'L25-03', ('questions', 256): 'M-02',
             ('questions', 258): 'M-04', ('questions', 263): 'M-09'}
# 정답(1,000만원 실무 기준). 바뀐 것 없음: 이미 1,000만원 기준이었음
Q_KEYS = {'L17-05': 'X', 'L20-05': '센터장까지', 'L24-02': 'O', 'L25-03': '부총장', 'M-02': '부총장',
          'M-04': '계장 또는 부총장', 'M-09': '선례는 그랬지만 기준은 1,000만 원 이상 = 부총장이에요.'}
T_KEYS = {('t1', 'under'): ['계장', '부총장'], ('t4', 'plan'): '부총장', ('t4', 'big'): '부총장', ('t4', 'edge'): '부총장',
          ('t4', 'offer'): '센터장', ('t4', 'small'): ['계장', '부총장'], ('t6', 'line'): '부총장'}
MAN = re.compile(r'1\s?,?\s?000\s?만\s?원|1\s?천\s?만\s?원|(?<![\d천])천만\s?원')


def loaded(ov=OV):
    return L.apply_override_obj(copy.deepcopy(RAW), ov)


def target(pack, key):
    col, cid = key.split(':', 1)
    ent = pack['entities'][col]
    if isinstance(ent, list):
        return [c for c in ent if str(c.get('id')) == cid][0]
    return L._walk(ent, cid.split('.'))


def field(obj, path):
    return L._walk(obj, path.split('.'))


class T실무기준(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = loaded()

    def test_config_text(self):
        self.assertEqual(OV['_practical_standard'], {'text': PRACT, 'note': NOTE})

    def test_positions_match_ids(self):
        for (col, i), cid in POSITIONS.items():
            self.assertEqual(RAW['entities'][col][i]['id'], cid, (col, i))

    def test_every_place_has_rule_source_note(self):
        for key, fields in PLACES.items():
            c = target(self.pack, key)
            for f in fields:
                s = field(c, f)
                self.assertIsInstance(s, str, key + ' ' + f)
                self.assertIn(PRACT, s, key + ' 실무 기준 없음')
                self.assertIn(SOURCE, s, key + ' 출처 없음')
                self.assertIn(NOTE, s, key + ' 3,000만원 메모 없음')
                self.assertLess(s.index(PRACT), s.index(NOTE), key + ' 실무 기준이 먼저')

    def test_note_is_last_except_g8_detail(self):
        # 메모부터 끝까지 작게 보이므로 메모 뒤에는 다른 안내가 없어야 함(g8 은 규정 원문 설명만 뒤에)
        for key, fields in PLACES.items():
            if key == 'regulations:g8':
                continue
            for f in fields:
                self.assertTrue(field(target(self.pack, key), f).endswith(NOTE), key)

    def test_overrides_reach_every_place(self):
        for key, fields in PLACES.items():
            for f in fields:
                self.assertIn(f, OV[key], key)
                self.assertIsNotNone(field(target(RAW, key), f), key + ' 원래 칸이 없음')

    def test_g8_card(self):
        c = target(self.pack, 'regulations:g8')
        self.assertTrue(c['summary'].startswith('실무 기준: ' + PRACT), c['summary'][:60])
        for k in ('3,000만원 미만', '3,000만원 이상 1억원 미만'):
            self.assertIn(k, c['summary'][c['summary'].index(NOTE):])   # 규정 원문 숫자는 작은 메모 쪽
        self.assertIn('남해캠퍼스부총장 전결(별표1)', c['summary'])
        for k in ('제3조', '제4조', '제5조', '제9조', '별표1', '별표2'):
            self.assertIn(k, c['articles'])
        self.assertIn('국립창원대_위임전결규정.md', c['source'])
        self.assertNotIn('넣지 않아요', OV['_설명'])
        self.assertIn('1,000만원 이상 부총장', OV['_설명'])

    def test_answer_keys_follow_1000(self):
        q = {x['id']: x for x in self.pack['entities']['questions']}
        for i, a in Q_KEYS.items():
            self.assertEqual(q[i]['정답'], a, i)
            if q[i]['보기']:
                self.assertIn(a, q[i]['보기'], i)
        t = {x['id']: x for x in self.pack['entities']['tasks']}
        for (tid, f), want in T_KEYS.items():
            got = [c['expect'] for c in t[tid]['checks'] if c.get('field') == f]
            self.assertEqual(got, [want], (tid, f))
        self.assertEqual(t['t6']['sample']['line'], '부총장')
        self.assertEqual(t['t4']['sample']['edge'], '부총장')   # 딱 1,000만원 = 부총장(3,000만원 기준이면 다름)

    def test_grading_fields_not_overridden(self):
        for key, fields in OV.items():
            if key.startswith('_'):
                continue
            for f in fields:
                self.assertNotIn(f.split('.')[0], ('정답', '보기', 'checks', 'sample', 'fields'), key + ' ' + f)

    def test_no_other_1000_busachang_text(self):
        # 정해진 자리 밖에서 1,000만원 결재 문구가 따로 남지 않음
        bad = []
        for col, ent in self.pack['entities'].items():
            items = ent if isinstance(ent, list) else [ent]
            for i, c in enumerate(items):
                key = '%s:%s' % (col, c.get('id') if isinstance(c, dict) else i)
                s = json.dumps(c, ensure_ascii=False)
                if col == 'manual':
                    continue   # 매뉴얼은 표(blocks.5) 하나만 해당, 아래에서 따로 봄
                if MAN.search(s) and '부총장' in s and key not in PLACES:
                    bad.append(key)
        self.assertEqual(bad, [])
        blocks = self.pack['entities']['manual']['blocks']
        hits = [i for i, b in enumerate(blocks) if MAN.search(json.dumps(b, ensure_ascii=False)) and '부총장' in json.dumps(b, ensure_ascii=False)]
        self.assertEqual(hits, [5])

    def test_idempotent(self):
        once = loaded()
        twice = L.apply_override_obj(copy.deepcopy(once), OV)
        self.assertEqual(once, twice)


class T덮어쓰기규칙(unittest.TestCase):
    """applyOverrides 넓힌 부분(가짜 자료)"""
    def pack(self):
        return {'entities': {'a': [{'id': 'x', 'v': 1, 'n': {'k': [1, 2]}}, {'id': 'y', 'v': 2}],
                             'm': {'blocks': [{'rows': [['a', 'b']]}]}}}

    def test_old_style_still_works(self):
        p = L.apply_override_obj(self.pack(), {'_x': {}, 'a:x': {'v': 9, 'new': 'ok'}})
        self.assertEqual(p['entities']['a'][0], {'id': 'x', 'v': 9, 'n': {'k': [1, 2]}, 'new': 'ok'})
        self.assertEqual(p['entities']['a'][1]['v'], 2)

    def test_nested_field_existing_only(self):
        p = L.apply_override_obj(self.pack(), {'a:x': {'n.k.1': 7, 'n.k.5': 8, 'n.zz.q': 1, 'n.new': 3}})
        self.assertEqual(p['entities']['a'][0]['n'], {'k': [1, 7]})

    def test_dict_collection_by_path(self):
        p = L.apply_override_obj(self.pack(), {'m:blocks.0': {'rows.0.1': 'B'}, 'm:blocks.9': {'rows.0.0': 'Z'}, 'nope:1': {'v': 1}})
        self.assertEqual(p['entities']['m']['blocks'][0]['rows'], [['a', 'B']])

    @unittest.skipUnless(NODE, 'node 없음')
    def test_js_same_as_python(self):
        src = open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
        a = src.index('  function walk(')
        b = src.index('  /* 「규정 원문 경계는')
        js = ('var state={};' + src[a:b] + ';const fs=require("fs");'
              'const pk=JSON.parse(fs.readFileSync(%s,"utf8"));applyOverrides(pk,JSON.parse(fs.readFileSync(%s,"utf8")));'
              'process.stdout.write(JSON.stringify(pk));') % (json.dumps(os.path.join(ROOT, 'public-pack.json')), json.dumps(OV_PATH))
        out = subprocess.run([NODE, '-e', js], capture_output=True, text=True, encoding='utf-8', check=True).stdout
        self.assertEqual(json.loads(out), loaded())

    def test_app_js_reads_note(self):
        src = open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
        self.assertIn('_practical_standard', src)
        self.assertIn("'reg-note'", src)
        css = open(os.path.join(ROOT, 'css', 'app.css'), encoding='utf-8').read()
        self.assertIn('.reg-note', css)


# 공개 저장소에 실제 이름을 두지 않음. 이름 자체는 이 시험에도 안 적음:
# ① 「OOO 선생님 구두 안내」 꼴은 「담당」만 허용 ② HJ_NAMES_FILE(저장소 밖, 한 줄에 이름 하나)이 있으면 그 이름이 추적 파일에 없는지
# public-pack.json·dorm.json 은 유진님 결정(10.21. 「지금은 그대로 둬」)으로 이번 범위 밖
HELD = {'public-pack.json', 'dorm.json'}
SRC_RX = re.compile(r'([가-힣]{1,6})\s?선생님\s?구두\s?안내')
TEXT_EXT = ('.json', '.js', '.py', '.html', '.css', '.md', '.txt', '.webmanifest', '.svg', '')


def tracked_text_files():
    try:
        out = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, capture_output=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return None
    for rel in out.decode('utf-8').split('\0'):
        if not rel or os.path.basename(rel) in HELD or os.path.splitext(rel)[1].lower() not in TEXT_EXT:
            continue
        fp = os.path.join(ROOT, rel)
        if os.path.isfile(fp):
            with open(fp, encoding='utf-8', errors='replace') as f:
                yield rel, f.read()


class T실명없음(unittest.TestCase):
    def test_wording_is_generic(self):
        self.assertTrue(PRACT.startswith('1,000만원 이상 부총장(담당 선생님 구두 안내'))
        self.assertEqual(SOURCE, '담당 선생님 구두 안내, 유진님 10.21.')
        self.assertTrue(OV['rules:R18']['basis'].startswith('담당 선생님 구두 안내'))

    def test_only_generic_source_in_tracked_files(self):
        files = tracked_text_files()
        if files is None:
            self.skipTest('git 없음')
        bad = []
        for rel, s in files:
            for m in SRC_RX.finditer(s):
                if m.group(1) != '담당':
                    bad.append(rel)
        self.assertEqual(sorted(set(bad)), [], '구두 안내 출처에 실제 이름(값은 안 보임)')

    def test_names_file_absent(self):
        nf = os.environ.get('HJ_NAMES_FILE')
        if not nf or not os.path.isfile(nf):
            self.skipTest('HJ_NAMES_FILE 없음')
        with open(nf, encoding='utf-8') as f:
            names = [l.strip() for l in f if len(l.strip()) >= 2]
        files = tracked_text_files()
        if files is None:
            self.skipTest('git 없음')
        bad = sorted({rel for rel, s in files for n in names if n in s})
        self.assertEqual(bad, [], '추적 파일에 실제 이름(값은 안 보임)')


if __name__ == '__main__':
    unittest.main()
