"""#/skill-map 입력·글자 대비율(계산 스타일, 4.5:1 이상)."""
import json, os, subprocess, unittest

ROOT = os.path.join(os.path.dirname(__file__), '..')
SCRIPT = os.path.join(os.path.dirname(__file__), 'skill_map_contrast_cdp.js')

class SkillMapContrast(unittest.TestCase):
    def test_css_pins_textarea_colors(self):
        ui = open(os.path.join(ROOT, 'js', 'modules', 'skill-map.js'), encoding='utf-8').read()
        self.assertIn('background-color:#05121A !important', ui)
        self.assertIn('color:#EAF6FF !important', ui)
        # 전역 textarea { background-color:#F2F4F6 !important } 를 이기려면 입력이 더 구체적이어야 함
        self.assertIn('#sm textarea', ui)
        self.assertIn('#sm #sm-text', ui)

    def test_computed_contrast_all_skill_map_text(self):
        r = subprocess.run(
            ['node', SCRIPT],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if r.returncode not in (0, 2):
            self.fail('contrast probe failed rc=%s\nstdout=%s\nstderr=%s' % (r.returncode, r.stdout[-1500:], r.stderr[-1500:]))
        data = json.loads(r.stdout)
        ta = data.get('textarea') or {}
        self.assertGreaterEqual(ta.get('ratio') or 0, 4.5, 'textarea contrast %s (%s on %s)' % (ta.get('ratio'), ta.get('fg'), ta.get('bg')))
        self.assertEqual(ta.get('bg', '').upper(), '#05121A')
        self.assertEqual(ta.get('fg', '').upper(), '#EAF6FF')
        self.assertEqual(data.get('fail_count'), 0, 'contrast fails: %s' % data.get('fails'))
        self.assertTrue(data.get('ok'))

if __name__ == '__main__':
    unittest.main()
