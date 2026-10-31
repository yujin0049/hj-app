"""밝은 CSS(파일·모듈 안 CSS 글자열) → 브랜드 C 어두운 덮어쓰기 CSS. 색이 적힌 칸만, 선택자 앞에 :root 를 붙여 이기게."""
import os, re, sys, tinycss2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from color import map_color, hex2rgb, rgb2hex, contrast, lum, ON_ACCENT
HEX = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b')
RGBA = re.compile(r'rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)')
NAMED = {'white': '#ffffff', 'black': '#000000'}
def role(prop):
    p = prop.lower()
    if p.startswith('background') or p in ('box-shadow',): return 'bg'
    if p.startswith('border') or p.startswith('outline') or p in ('column-rule', 'text-decoration-color'): return 'border'
    if p in ('color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color', 'accent-color'): return 'text'
    return None
def mapval(v, r, prop):
    if prop == 'box-shadow' and 'inset' not in v: return 'none' if HEX.search(v) or RGBA.search(v) else v
    def h(m):
        s = m.group(0)
        if len(s) in (5, 9):  # 알파 있는 hex
            a = s[-2:] if len(s) == 9 else s[-1] * 2
            return map_color(s[:-2] if len(s) == 9 else s[:-1], r) + a
        return map_color(s, r)
    def rg(m):
        c = rgb2hex(tuple(float(m.group(i)) / 255 for i in (1, 2, 3)))
        mc = hex2rgb(map_color(c, r)); a = m.group(4)
        if a is None: return rgb2hex(mc)
        if r == 'bg' and float(a.rstrip('%')) < 0.5 and lum(hex2rgb(c)) < 0.1:  # 어둡게 덮는 막(모달 뒤)은 그대로
            return m.group(0)
        return 'rgba(%d,%d,%d,%s)' % tuple([round(x * 255) for x in mc] + [a])
    v2 = HEX.sub(h, v); v2 = RGBA.sub(rg, v2)
    for k, hx in NAMED.items(): v2 = re.sub(r'(?<![\w-])%s(?![\w-])' % k, map_color(hx, r), v2)
    return v2
def css_from_js(src):
    out = []
    for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'", src):
        s = m.group(1)
        if '{' in s and '}' in s and ':' in s and not s.lstrip().startswith('<'): out.append(s.replace("\\'", "'"))
    return '\n'.join(out)
def resolve(v, vars_):
    return re.sub(r'var\((--[\w-]+)(?:,[^)]*)?\)', lambda m: vars_.get(m.group(1), m.group(0)), v)
def first_color(v):
    m = HEX.search(v)
    if m and len(m.group(0)) in (4, 7): return m.group(0)
    m = RGBA.search(v)
    if m: return rgb2hex(tuple(float(m.group(i)) / 255 for i in (1, 2, 3)))
    return None
def gen(css, vars_, prefix=':root '):
    rules = tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True)
    out = []
    def walk(rs, wrap=None):
        for r in rs:
            if r.type == 'at-rule' and r.lower_at_keyword in ('media', 'supports') and r.content:
                inner = tinycss2.parse_rule_list(r.content, skip_comments=True, skip_whitespace=True)
                walk(inner, '@%s %s' % (r.lower_at_keyword, tinycss2.serialize(r.prelude).strip()))
                continue
            if r.type != 'qualified-rule': continue
            sel = tinycss2.serialize(r.prelude).strip()
            if sel.startswith(':root') and '{' not in sel and sel.strip() == ':root': continue
            decls = [d for d in tinycss2.parse_declaration_list(r.content, skip_comments=True, skip_whitespace=True) if d.type == 'declaration']
            new = {}; final = {}
            for d in decls:
                v = tinycss2.serialize(d.value).strip(); rl = role(d.lower_name)
                if d.lower_name.startswith('--'): continue
                final[d.lower_name] = v
                if rl and (HEX.search(v) or RGBA.search(v) or re.search(r'(?<![\w-])(white|black)(?![\w-])', v)):
                    nv = mapval(v, rl, d.lower_name)
                    if nv != v: new[d.lower_name] = nv + (' !important' if d.important else '')
            # 짝 맞추기: 바탕이 밝은 강조색이 되면 흰 글자 → 검정 글자
            bgv = new.get('background') or new.get('background-color') or resolve(final.get('background', final.get('background-color', '')), vars_)
            bc = first_color(bgv or '')
            if bc and lum(hex2rgb(bc)) > 0.3:
                cv = new.get('color') or resolve(final.get('color', ''), vars_)
                cc = first_color(cv or '')
                if cc and contrast(cc, bc) < 4.5: new['color'] = ON_ACCENT
            if not new: continue
            sels = ', '.join(prefix + s.strip() if not s.strip().startswith(('html', ':root', 'body')) else ':root ' + s.strip() if s.strip().startswith('body') else s.strip() for s in sel.split(','))
            body = '; '.join('%s: %s' % kv for kv in new.items())
            out.append((wrap, '%s { %s; }' % (sels, body)))
    walk(rules)
    lines = []
    for wrap, rule in out: lines.append('%s { %s }' % (wrap, rule) if wrap else rule)
    return '\n'.join(lines)
