"""390px에서 글자 12.8px 이상. python3 -m unittest tests.test_min_font"""
import os, re, unittest

R = os.path.join(os.path.dirname(__file__), '..')
MIN_PX = 12.8
FS = re.compile(r'font-size\s*:\s*([0-9]*\.?[0-9]+)(px|rem|em)\b', re.I)
FONT = re.compile(r'font\s*:\s*(?:[a-z]+|\d{3})\s+([0-9]*\.?[0-9]+)(px|rem|em)\b', re.I)
FONT2 = re.compile(r'font\s*:\s*([0-9]*\.?[0-9]+)(px|rem|em)\b', re.I)
SKIP_DIRS = {'.git', 'node_modules', 'vendor', '3d', '_archive', '.claude', '.cursor', '.grok', 'tests'}
SKIP_FILES = set()


def px(n, unit):
    return n if unit.lower() == 'px' else n * 16.0


def walk():
    out = []
    for dp, dns, fns in os.walk(R):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if not fn.endswith(('.css', '.js')):
                continue
            path = os.path.join(dp, fn)
            rel = os.path.relpath(path, R)
            with open(path, encoding='utf-8') as fh:
                text = fh.read()
            for rx in (FS, FONT, FONT2):
                for m in rx.finditer(text):
                    n, u = float(m.group(1)), m.group(2)
                    out.append((rel, m.group(0), px(n, u)))
    return out


class MinFont(unittest.TestCase):
    def test_css_token_floor(self):
        with open(os.path.join(R, 'css', 'app.css'), encoding='utf-8') as fh:
            css = fh.read()
        self.assertIn('--fs-min: 12.8px', css)
        self.assertRegex(css, r'--fs-xs:\s*0\.8rem')
        self.assertIn('font-size: 16px', css)  # html

    def test_no_declaration_below_128(self):
        bad = [(rel, raw, p) for rel, raw, p in walk() if p < MIN_PX - 1e-9]
        self.assertEqual(bad, [], '390px 기준 12.8px 보다 작은 글자: ' + ', '.join(
            '%s %s (%.2fpx)' % (rel, raw, p) for rel, raw, p in bad[:20]
        ))
