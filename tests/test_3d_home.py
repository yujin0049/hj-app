"""홈 3D(3d/ 폴더) 점검: 서버·편집 저장값 없음, 도면 일반 실 이름만, 홈·라우트 연결."""
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
        self.assertIn('3d/index.html?embed=1', home)
        self.assertIn('data-go="#/3d"', home)
        self.assertIn('3D 사이트(PIN)', home)
        self.assertIn("'3d'", read('js', 'registry.js'))
        self.assertIn('3d/index.html', read('js', 'modules', '3d.js'))
        self.assertNotIn('workers.dev', read('js', 'modules', '3d.js').split('SITE =')[0])
        self.assertIn('hj-v17', read('sw.js'))


if __name__ == '__main__':
    unittest.main()
