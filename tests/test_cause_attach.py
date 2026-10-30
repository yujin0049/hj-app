"""원인행위 종류별 붙임 목록(data/cause_attach_types.json)과 화면 연결."""
import json
import os
import re
import shutil
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATERIAL = ['계획 공문', '견적서', '비교견적서(500만원 이상)', '납품서 또는 거래명세서', '계약서(승낙사항)',
            '물품명세서, 물품사진', '신용카드매출전표 또는 전자세금계산서(사업자등록증,통장사본)',
            '국세/지방세완납증명서(500만원 이상)', '(홍보물, 기념품 경우)기념품불출대장 및 수령인 서명대장']


def load():
    with open(os.path.join(ROOT, 'data', 'cause_attach_types.json'), encoding='utf-8') as fh:
        return json.load(fh)


class T(unittest.TestCase):
    def test_material_follows_appendix_order(self):
        d = load()
        mat = [t for t in d['types'] if t['id'] == 'material'][0]
        self.assertEqual([x['name'] for x in mat['items']], MATERIAL)
        self.assertEqual([x['no'] for x in mat['items']], [str(i) for i in range(1, 10)])
        tax = mat['items'][7]
        self.assertIn('4대보험 납부확인으로 대체 가능', tax['note'])
        self.assertIn('지방세', tax['later'])
        self.assertNotIn('청구서', ' '.join(x['name'] for x in mat['items']))
        self.assertIn('청구서', mat['ref'])
        self.assertNotIn('appendix', mat)

    def test_every_type_has_numbered_items(self):
        d = load()
        self.assertEqual(len(d['types']), 17)  # 부록 16종류, 업무추진비만 회의비·식대 두 갈래
        ids = [t['id'] for t in d['types']]
        self.assertEqual(len(ids), len(set(ids)))
        for t in d['types']:
            self.assertTrue(t['items'], t['id'])
            for x in t['items']:
                self.assertTrue(re.fullmatch(r'\d+', x['no']), (t['id'], x))
                self.assertTrue(x['name'].strip())

    def test_unknown_cells_say_later(self):
        d = load()
        self.assertEqual(d['later'], '나중에 업데이트')
        self.assertEqual(d['sourcePage'], '나중에 업데이트')

    def test_no_contact_info(self):
        with open(os.path.join(ROOT, 'data', 'cause_attach_types.json'), encoding='utf-8') as fh:
            text = fh.read()
        self.assertNotRegex(text, r'\d{2,3}-\d{3,4}-\d{4}')
        self.assertNotRegex(text, r'[\w.]+@[\w.]+')
        self.assertNotRegex(text, r'\d{6}-\d{7}')

    def test_screen_reads_the_json(self):
        with open(os.path.join(ROOT, 'js', 'modules', 'ot-attach.js'), encoding='utf-8') as fh:
            ui = fh.read()
        self.assertIn('data/cause_attach_types.json', ui)
        self.assertIn('id="ca-type"', ui)
        self.assertNotIn('<details', ui)


# 글로컬 출장(여비) 단계별 (유진님 10.30. 18:18). 정본: 부록 「2 사업비 지출 구비서류」 국내여비·국외여비 행.
TRIP_IN = ['계획 공문', '출장신청서', '여비정산 신청서', '(유류비 정산 시)자가용 운임 지급 상세 내역',
           '영수증(톨게이트, 대중교통 승차권, 숙박영수증(해당자))', '통장사본']
TRIP_OUT = ['계획 공문(신청서), 허가공문', '출장결과보고서',
            '여비정산 증빙서류(항공권구입영수증, 항공티켓, 숙박영수증 등)', '여권사본', '통장사본']


def trip(d, tid):
    return [t for t in d['types'] if t['id'] == tid][0]


class Trip(unittest.TestCase):
    def test_trip_lists_match_appendix(self):
        d = load()
        self.assertEqual([x['name'] for x in trip(d, 'trip-in')['items']], TRIP_IN)
        self.assertEqual([x['name'] for x in trip(d, 'trip-out')['items']], TRIP_OUT)
        for tid, n in (('trip-in', 6), ('trip-out', 5)):
            self.assertEqual([x['no'] for x in trip(d, tid)['items']], [str(i) for i in range(1, n + 1)])

    def test_stage_counts(self):
        d = load()
        self.assertEqual(list(d['stages']), ['before', 'after', 'later'])

        def count(tid):
            out = {}
            for x in trip(d, tid)['items']:
                out[x['stage']] = out.get(x['stage'], 0) + 1
            return out
        self.assertEqual(count('trip-in'), {'before': 2, 'after': 4})
        self.assertEqual(count('trip-out'), {'before': 1, 'after': 3, 'later': 1})
        self.assertIn('later', [x for x in trip(d, 'trip-out')['items'] if x['name'] == '여권사본'][0])
        self.assertIn('판단', d['stageNote'])

    def test_missing_cells_say_later_not_invented(self):
        d = load()
        gaps = trip(d, 'trip-in')['gaps']
        self.assertEqual([(g['stage'], g['name']) for g in gaps], [('after', '출장 결과보고서')])
        self.assertNotIn('gaps', trip(d, 'trip-out'))
        self.assertIn('현찰매도율', ' '.join(trip(d, 'trip-out')['rules']))

    def test_short_names_for_long_types(self):
        d = load()
        for t in d['types']:
            self.assertLessEqual(len(t.get('short', t['name'])), 16, t['id'])

    def test_screen_has_trip_tabs_and_13px_badge(self):
        with open(os.path.join(ROOT, 'js', 'modules', 'ot-attach.js'), encoding='utf-8') as fh:
            ui = fh.read()
        self.assertIn('data-stage', ui)
        self.assertIn('data-trip', ui)
        self.assertIn('#ca-card .badge{font-size:13px}', ui)
        self.assertIn('x.short || x.name', ui)


NODE = shutil.which('node') or ('/home/box/.local/node/bin/node' if os.path.exists('/home/box/.local/node/bin/node') else None)
SEQ_JS = r"""
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = process.argv[process.argv.length - 1];
const g = { ShellModules: {}, HJOtAttach: {}, console };
g.window = g; vm.createContext(g);
vm.runInContext(fs.readFileSync(path.join(root, 'js/modules/ot-attach.js'), 'utf8'), g);
const c = g.ShellModules['ot-attach']._cause;
c.state.data = JSON.parse(fs.readFileSync(path.join(root, 'data/cause_attach_types.json'), 'utf8'));
const esc = s => String(s);
const snap = () => { const h = c.html(esc); return {
  stage: c.state.stage, rows: (h.match(/class="ca-row[ "]/g) || []).length,
  on: (h.match(/class="chip on" type="button" data-stage="(\w+)"/) || [])[1] || null, html: h }; };
const out = {};
c.pickType('trip-out'); c.pickStage('later'); out.outLater = snap();
c.pickType('trip-in'); out.inAfterOutLater = snap();
c.pickType('trip-out'); c.pickStage('later'); c.state.pick = 'trip-in'; out.directPick = snap();
c.pickType('trip-in'); c.pickStage('after'); c.pickType('trip-out'); out.afterKept = snap();
c.pickType('trip-out'); c.pickStage('later'); c.pickType('material'); out.material = snap();
process.stdout.write(JSON.stringify(out));
"""


@unittest.skipUnless(NODE, 'node 없음')
class TripStageSwitch(unittest.TestCase):
    """춘식이3 검수(10.30.): 국외 → 확인 필요 → 국내 를 누르면 국내 목록이 0개, 탭도 안 골라짐."""

    def run_seq(self):
        r = subprocess.run([NODE, '-e', SEQ_JS, ROOT], capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads(r.stdout)

    def test_out_later_then_in_falls_back_to_all(self):
        o = self.run_seq()
        self.assertEqual(o['outLater']['stage'], 'later')
        self.assertEqual(o['outLater']['rows'], 1)
        self.assertEqual(o['inAfterOutLater']['stage'], 'all')
        self.assertEqual(o['inAfterOutLater']['on'], 'all')
        self.assertEqual(o['inAfterOutLater']['rows'], 6 + 1)  # 부록 6개 + 결과보고서 나중에 업데이트 1칸
        self.assertEqual(o['directPick']['stage'], 'all')       # 고르기 칸으로 바꿔도 그림 그릴 때 「전체」
        self.assertEqual(o['directPick']['rows'], 7)
        self.assertEqual(o['afterKept']['stage'], 'after')      # 두 종류에 다 있는 단계는 그대로
        self.assertEqual(o['afterKept']['rows'], 3)
        self.assertEqual(o['material']['stage'], 'all')

    def test_later_heading_has_no_extra_later_text(self):
        o = self.run_seq()
        h = o['outLater']['html']
        box = h[h.index('data-stage-box="later"'):]
        head = box[:box.index('</p>')]
        self.assertNotIn('나중에 업데이트', head)
        self.assertIn('1가지', head)


if __name__ == '__main__':
    unittest.main()
