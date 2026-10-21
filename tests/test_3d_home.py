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
        self.assertIn('hj-v18', read('sw.js'))
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

    def test_no_person_names_in_labels(self):
        L = self._labels()
        for arr in L.values():
            for l in arr:
                self.assertNotIn('-', l['name'].replace('B-737', ''), l['id'])  # 「실 이름-사람」 꼴 없음
                self.assertNotIn('이름가림', l['name'])


if __name__ == '__main__':
    unittest.main()
