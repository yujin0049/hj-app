"""브랜드 C(블랙 우선) 색 바꾸기: 밝은 화면 색 → 어두운 화면 색. OKLab 기준, 쓰임(바탕·글자·선)마다 다르게."""
import math, re
def hex2rgb(h):
    h = h.lstrip('#')
    if len(h) in (3, 4): h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
def rgb2hex(c): return '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255))) for v in c)
def _lin(v): return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
def _gam(v): return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
def to_oklch(rgb):
    r, g, b = (_lin(v) for v in rgb)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.atan2(bb, a)
def from_oklch(L, C, h):
    a, b = C * math.cos(h), C * math.sin(h)
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(max(0, min(1, _gam(max(0, v)))) for v in (r, g, bb))
def lum(rgb):
    r, g, b = (_lin(v) for v in rgb); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def contrast(a, b):
    la, lb = lum(hex2rgb(a) if isinstance(a, str) else a), lum(hex2rgb(b) if isinstance(b, str) else b)
    hi, lo = max(la, lb), min(la, lb); return (hi + 0.05) / (lo + 0.05)
BG, TEXT, ACCENT, ON_ACCENT, LINK = '#101214', '#e4e7ea', '#4cc3ff', '#091017', '#96d8fe'
def is_blue(h):
    L, C, hh = to_oklch(hex2rgb(h)); deg = math.degrees(hh) % 360
    return C > 0.08 and 230 <= deg <= 275
def map_color(h, role):
    """role: bg | text | border"""
    rgb = hex2rgb(h); L, C, hh = to_oklch(rgb)
    if role == 'bg':
        if C < 0.025:
            if L >= 0.6:                                                                    # 흰·연회색 → 어두운 면(흰=#171a1e 카드, 연회색=#1f2328~)
                t = max(0.0, min(1.0, (1 - L) / 0.12)); a, b = hex2rgb('#171a1e'), hex2rgb('#2a3037')
                return rgb2hex(tuple(a[i] + (b[i] - a[i]) * t for i in range(3)))
            return rgb2hex(from_oklch(max(0.30, L + 0.06), C, hh))                         # 진한 회색(토스트 등) → 조금 밝게
        if L >= 0.8: return rgb2hex(from_oklch(0.27, min(C, 0.045) + 0.01, hh))            # 연한 색 바탕 → 어두운 색 바탕
        if is_blue(h): return ACCENT                                                       # 파란 강조 바탕 → 시안
        return rgb2hex(from_oklch(max(L, 0.72), min(C, 0.15), hh))                          # 진한 색 바탕(버튼) → 밝게(글자는 검정)
    if role == 'border':
        if C < 0.025: return '#2e343b' if L >= 0.6 else '#4a525b'
        if L >= 0.8: return rgb2hex(from_oklch(0.42, min(C, 0.06), hh))
        return rgb2hex(from_oklch(max(L, 0.72), min(C, 0.15), hh))
    # text
    if C < 0.025:
        if L >= 0.9: return h if len(h) == 7 else rgb2hex(rgb)                              # 흰 글자는 그대로(바탕 짝으로 따로 봄)
        return rgb2hex(from_oklch(min(0.93, 0.95 - L * 0.4), C, hh))
    if is_blue(h): return LINK if L < 0.7 else h
    return rgb2hex(from_oklch(max(0.80, 1.35 - L), min(C, 0.13), hh))
