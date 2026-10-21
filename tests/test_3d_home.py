"""홈 3D(3d/ 폴더) 점검: 서버·편집 저장값 없음, 사람 이름 없음, 호실번호 = 유진님 입력값, 새/이전 버전 전환, 홈·라우트 연결."""
import json
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8') as f:
        return f.read()


class ThreeDHome(unittest.TestCase):
    def test_files_present_no_edit_or_server(self):
        for p in ['3d/index.html', '3d/assets/app.js', '3d/assets/scene.js', '3d/assets/config.js',
                  '3d/assets/building.json', '3d/assets/vendor/three.module.min.js', '3d/assets/vendor/OrbitControls.js']:
            self.assertTrue(os.path.exists(os.path.join(ROOT, p)), p)
        for p in ['3d/edit.html', '3d/assets/edit.js', '3d/assets/edit.css', '3d/worker', '3d/server']:
            self.assertFalse(os.path.exists(os.path.join(ROOT, p)), p)
        app = read('3d', 'assets', 'app.js')
        self.assertNotIn("fetch('/api", app)
        self.assertNotIn('/api/', app)

    def test_labels_are_generic_room_names(self):
        d = json.loads(read('3d', 'assets', 'building.json'))
        allowed = {'', '세미나실', '시뮬레이터실', '종합실습실', '항공기체실습실(격납고)', '헬기실습실'}
        self.assertTrue({r['name'] for r in d['rooms']} <= allowed)
        self.assertEqual([l['name'] for l in d['roof']['labels']], ['옥상'])

    def test_home_card_and_route(self):
        home = read('js', 'modules', 'home.js')
        self.assertIn("'3d/index.html'", home)
        self.assertIn('?embed=1', home)
        self.assertIn('data-go="#/3d"', home)
        self.assertIn('3D 사이트(PIN)', home)
        self.assertIn("'3d'", read('js', 'registry.js'))
        self.assertIn('3d/index.html', read('js', 'modules', '3d.js'))
        self.assertNotIn('workers.dev', read('js', 'modules', '3d.js').split('SITE =')[0])
        import re as _re
        self.assertGreaterEqual(int(_re.search(r"'hj-v(\d+)'", read('sw.js')).group(1)), 18)  # 3D 넣은 v18 이상
        self.assertIn('data-3dver="new"', home)
        self.assertIn('data-3dver="old"', home)
        self.assertIn('3d/v01/index.html', home)
        self.assertIn('HJ3D', read('js', 'modules', '3d.js'))

    # 유진님이 3D 사이트에 입력한 호실번호(2026-10-20 17:39 저장값). 호실번호만 적음 — 사람 이름은 넣지 않음.
    YUJIN_ROOM_NOS = {
        '1F': {'1F-1': '5101', '1F-2': '5102', '1F-3': '5103'},
        '2F': {'2F-2': '5201', '2F-3': '5202', '2F-4': '5203'},
        '3F': {'3F-6': '5301'},
    }

    def _labels(self):
        return json.loads(read('3d', 'assets', 'labels.json'))['labels']

    def test_room_numbers_match_yujin_input(self):
        L = self._labels()
        for fid, want in self.YUJIN_ROOM_NOS.items():
            got = {l['id']: l['no'] for l in L[fid] if l['no']}
            self.assertEqual(got, want, fid)
        # 번호를 지어내지 않음: 입력값에 없는 층에는 호실번호 없음
        self.assertFalse([l for l in L.get('RF', []) if l['no']])

    def test_both_versions_use_same_labels(self):
        self.assertIn("fetch('assets/labels.json'", read('3d', 'assets', 'app.js'))
        v1 = read('3d', 'v01', 'assets', 'app.js')
        self.assertIn("fetch('../assets/labels.json'", v1)
        self.assertNotIn('/api/', v1)
        for p in ['3d/v01/index.html', '3d/v01/assets/app.js', '3d/v01/assets/building.json']:
            self.assertTrue(os.path.exists(os.path.join(ROOT, p)), p)
        for p in ['3d/v01/edit.html', '3d/v01/assets/edit.js']:
            self.assertFalse(os.path.exists(os.path.join(ROOT, p)), p)
        # 두 버전 모두 이름표 id 가 그 모델의 방 id 와 맞음
        L = self._labels()
        for b in (('3d', 'assets', 'building.json'), ('3d', 'v01', 'assets', 'building.json')):
            ids = {r['id'] for r in json.loads(read(*b))['rooms']}
            for fid in ('1F', '2F', '3F'):
                self.assertTrue({l['id'] for l in L[fid]} <= ids, (b, fid))

    # 2026-10-21 시설 사진 5장으로 넣은 저폴리 모형 (building.json geo 칸)
    PHOTO_1021_IDS = {'rf-ac-1', 'rf-water-tank', 'rf-booster-pump-1', 'rf-stair-tower', '3f-extinguisher', 'site-weld-ventilator'}

    def _geo_equipment(self):
        g = json.loads(read('3d', 'assets', 'building.json'))['geo']
        items = list(g['roof']['equipment']) + [g['roof']['penthouse']]
        for F in g['floors'].values():
            items += F.get('equipment', [])
        return {e['id']: e for e in items if e.get('id')}

    def test_photo_1021_models_in_data(self):
        E = self._geo_equipment()
        self.assertTrue(self.PHOTO_1021_IDS <= set(E), self.PHOTO_1021_IDS - set(E))
        self.assertGreaterEqual(len([i for i in E if i.startswith('rf-ac-')]), 3)  # 사진: 최소 3대
        self.assertEqual(E['3f-extinguisher']['n'], 2)
        self.assertEqual(E['site-weld-ventilator']['n'], 3)
        self.assertEqual(len([i for i in E if i.startswith('rf-pressure-tank-')]), 2)
        for i in self.PHOTO_1021_IDS:
            self.assertTrue(E[i].get('label'), i)
            self.assertIn('사진 10.21. 기준, 위치·치수는 대략', E[i].get('note', ''), i)
        for i in ('rf-ac-1', '3f-extinguisher', 'site-weld-ventilator'):  # 사진만으로 위치 불확실
            self.assertIn('위치 추정', E[i]['label'], i)

    # 옥상 물탱크·가압펌프·압력탱크: 이름표 3개 따로, 각각 누르면 설명(note), 계단탑(옥탑) 밖에 있음
    def test_roof_tank_pump_ptank_labels_split(self):
        E = self._geo_equipment()
        want = {'rf-water-tank': '물탱크', 'rf-booster-pump-1': '가압펌프', 'rf-pressure-tank-1': '압력탱크'}
        for i, name in want.items():
            self.assertEqual(E[i]['label'], name, i)
            self.assertIn('사진 10.21. 기준, 위치·치수는 대략', E[i].get('note', ''), i)
        labels = [e['label'] for e in E.values() if e.get('label')]
        self.assertNotIn('물탱크·가압펌프', labels)
        for name in want.values():
            self.assertEqual(labels.count(name), 1, name)
        x0, y0, x1, y1 = json.loads(read('3d', 'assets', 'building.json'))['geo']['roof']['penthouse']['rect']
        for i, e in E.items():
            if i.startswith(('rf-water-tank', 'rf-booster-pump-', 'rf-pressure-tank-')):
                hw, hd = (e.get('l', 0) / 2, e['r']) if e.get('shape') == 'cyl' else (e['w'] / 2 + 0.1, e['d'] / 2 + 0.1)
                out = e['c'][0] + hw < x0 or e['c'][0] - hw > x1 or e['c'][1] + hd < y0 or e['c'][1] - hd > y1
                self.assertTrue(out, i)  # 계단탑과 겹치지 않음
        self.assertIn('e.label_p', read('3d', 'assets', 'scene.js'))
        self.assertIn('item.view', read('3d', 'assets', 'app.js'))
        import re as _re
        self.assertGreaterEqual(int(_re.search(r"'hj-v(\d+)'", read('sw.js')).group(1)), 24)

    def test_photo_1021_rendered_without_photo_files(self):
        scene = read('3d', 'assets', 'scene.js')
        for k in ("e.k === 'ext'", "e.k === 'vent'", 'P.label_p'):
            self.assertIn(k, scene)
        self.assertIn('e.floor', read('3d', 'assets', 'app.js'))
        for dp, _, fs in os.walk(os.path.join(ROOT, '3d')):
            self.assertFalse([f for f in fs if f.lower().endswith(('.jpg', '.jpeg', '.heic'))], dp)  # 사진 원본 복사 안 함
        import re as _re
        self.assertGreaterEqual(int(_re.search(r"'hj-v(\d+)'", read('sw.js')).group(1)), 23)  # 사진 모형 넣은 v23 이상

    def test_no_person_names_in_labels(self):
        L = self._labels()
        for arr in L.values():
            for l in arr:
                self.assertNotIn('-', l['name'].replace('B-737', ''), l['id'])  # 「실 이름-사람」 꼴 없음
                self.assertNotIn('이름가림', l['name'])


if __name__ == '__main__':
    unittest.main()
