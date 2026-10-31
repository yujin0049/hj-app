"""브랜드 C 덮어쓰기 CSS 만들기: css/app.css + 화면 모듈 안 CSS 의 밝은 색 → 어두운 색. 결과 css/brand-c.css.
   사용: python3 tools/brand_c_build.py   (tinycss2 필요)"""
import glob, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'brand_c'))
from gen import gen, css_from_js
VARS = {}
for line in open(os.path.join(ROOT, 'tools', 'brand_c', 'base.css'), encoding='utf-8'):
    for part in line.split(';'):
        if part.strip().startswith('--') and ':' in part:
            k, v = part.split(':', 1); VARS[k.strip()] = v.strip()
parts = [open(os.path.join(ROOT, 'tools', 'brand_c', 'base.css'), encoding='utf-8').read()]
parts.append('/* ── css/app.css 색 덮어쓰기 ── */\n' + gen(open(os.path.join(ROOT, 'css', 'app.css'), encoding='utf-8').read(), VARS))
for f in sorted(glob.glob(os.path.join(ROOT, 'js', '**', '*.js'), recursive=True)):
    if '/vendor/' in f: continue
    css = css_from_js(open(f, encoding='utf-8').read())
    if not css: continue
    g = gen(css, VARS)
    if g: parts.append('/* ── %s ── */\n%s' % (os.path.relpath(f, ROOT), g))
open(os.path.join(ROOT, 'css', 'brand-c.css'), 'w', encoding='utf-8').write('\n'.join(parts) + '\n')
print('ok', sum(p.count('{') for p in parts[1:]), 'rules')
