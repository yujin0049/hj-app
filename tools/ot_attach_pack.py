#!/usr/bin/env python3
"""10월 시간외근무수당 원인행위 붙임.

서류 폴더에서 지급내역표·신분증·재직증명서·통장사본을 확인해요.
작은 서류(신분증·재직·통장)는 A4 한 장에 맞추고, 지급내역표에서는 봇 표기를 빼요.
빠진 칸이 있으면 PDF를 만들지 않아요. 공식 PDF에는 봇 표기·볼트 경로를 넣지 않아요.

js/otattach-core.js 와 같은 칸·같은 금지 낱말이에요.
브라우저가 F: 에 직접 쓰지 못하므로, 이 스크립트는 자기 폴더에 PDF를 저장해요.

  python3 ot_attach_pack.py
  python3 ot_attach_pack.py --src 서류폴더
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zlib

OUT_NAME = '2026-10_시간외근무수당_원인행위붙임.pdf'
TITLE = '10월 시간외근무수당'
A4W = 595.28
A4H = 841.89
PHRASES = (
    '만든봇', '봇공유', '원본경로', '박스경로', '자동생성', '봇메모', '봇교훈',
    '봇 메모', '99 봇/', '99 봇\\', 'obsidian://',
)
SLOTS = (
    {'id': 'pay', 'label': '지급내역표', 'kind': 'clean', 'keys': ('지급내역표', '지급내역', '지급조서')},
    {'id': 'idcard', 'label': '신분증', 'kind': 'fit', 'keys': ('신분증', '주민등록증', 'idcard')},
    {'id': 'employ', 'label': '재직증명서', 'kind': 'fit', 'keys': ('재직증명서', '재직증명', 'employment')},
    {'id': 'bank', 'label': '통장사본', 'kind': 'fit', 'keys': ('통장사본', '통장', 'bankbook')},
)
IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'}
TEXT_EXT = {'.txt', '.csv', '.md', '.html', '.htm'}
PDF_EXT = {'.pdf'}
META_LINE = re.compile(
    r'^(만든봇|자동생성|원본경로|박스경로|전환본|전환일|개인정보)\s*[:：]|봇\s*메모|^(source|tags|vault)\s*:',
    re.I,
)


def read_bin(path: str) -> bytes:
    with open(path, 'rb') as fh:
        return fh.read()


def write_text(path: str, text: str) -> None:
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text)


def base_name(name: str) -> str:
    return name.replace('\\', '/').split('/')[-1]


def ignored(name: str) -> bool:
    b = base_name(name).lower()
    if not b or b.startswith('.'):
        return True
    if b in ('desktop.ini', 'thumbs.db', OUT_NAME.lower(), 'ot_attach_pack.py', '원인행위_붙임_원클릭.bat'):
        return True
    return False


def has_forbidden_text(text: str) -> bool:
    return any(p in text for p in PHRASES)


def bytes_have_forbidden(data: bytes) -> bool:
    for phrase in PHRASES:
        raw = phrase.encode('utf-8')
        if raw in data:
            return True
        if phrase.encode('utf-16-le') in data or phrase.encode('utf-16-be') in data:
            return True
    return False


def is_meta_line(line: str) -> bool:
    t = line.strip()
    if not t:
        return False
    if has_forbidden_text(t) or META_LINE.search(t):
        return True
    return False


def html_to_text(text: str) -> str:
    text = re.sub(r'<script[\s\S]*?</script>', '', text, flags=re.I)
    text = re.sub(r'<style[\s\S]*?</style>', '', text, flags=re.I)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.I)
    text = re.sub(r'</(p|div|tr|h\d|li|table|thead|tbody)>', '\n', text, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    return text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')


def clean_pay_text(raw: str) -> dict:
    text = raw.lstrip('\ufeff')
    dropped = 0

    def _drop_comment(m):
        nonlocal dropped
        dropped += m.group(0).count('\n') + 1
        return ''

    text = re.sub(r'<!--[\s\S]*?-->', _drop_comment, text)
    if re.search(r'</?[a-z][^>]*>', text, re.I):
        text = html_to_text(text)
    if text.startswith('---'):
        end = text.find('\n---', 3)
        if end >= 0:
            block = text[:end]
            if has_forbidden_text(block) or re.search(
                r'^(만든봇|자동생성|원본경로|박스경로|전환본|전환일)\s*[:：]', block, re.M
            ):
                dropped += block.count('\n') + 1
                text = text[end + 4 :].lstrip('\r\n')
    lines = []
    for line in text.splitlines():
        if is_meta_line(line):
            dropped += 1
            continue
        lines.append(line.rstrip())
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    joined = '\n'.join(lines).strip()
    if has_forbidden_text(joined):
        return {'text': '', 'dropped': dropped + len(lines), 'blocked': True}
    return {'text': joined, 'dropped': dropped, 'blocked': False}


def match_slot(name: str):
    norm = name.replace('\\', '/').lower()
    base = norm.split('/')[-1]
    best = None
    best_score = -1
    for order, slot in enumerate(SLOTS):
        for key in slot['keys']:
            k = key.lower()
            in_base = k in base
            in_path = k in norm
            if not in_base and not in_path:
                continue
            score = len(k) * 10 + (5 if in_base else 0) - order * 0.01
            if score > best_score:
                best = slot
                best_score = score
    return best


def _dict_before(data: bytes, stream_at: int) -> str:
    end = stream_at
    while end > 0 and data[end - 1] in b' \t\r\n':
        end -= 1
    if end < 2 or data[end - 2 : end] != b'>>':
        return ''
    start = data.rfind(b'<<', max(0, end - 4000), end)
    if start < 0:
        return ''
    return data[start:end].decode('latin1', errors='ignore')


def _filters(dct: str) -> list:
    m = re.search(r'/Filter\s*(\[[^\]]+\]|/[A-Za-z]+)', dct or '')
    if not m:
        return []
    return [n[1:] for n in re.findall(r'/([A-Za-z]+)', m.group(1))]


def _length(dct: str):
    m = re.search(r'/Length\s+(\d+)', dct or '')
    if not m:
        return None
    rest = dct[m.end() : m.end() + 8]
    if re.match(r'\s+\d+\s+R', rest):
        return None
    return int(m.group(1))


def list_streams(data: bytes) -> dict:
    streams = []
    pos = 0
    while True:
        at = data.find(b'stream', pos)
        if at < 0:
            break
        if at >= 3 and data[at - 3 : at] == b'end':
            pos = at + 6
            continue
        dct = _dict_before(data, at)
        start = at + 6
        if data[start : start + 2] == b'\r\n':
            start += 2
        elif start < len(data) and data[start] in (10, 13):
            start += 1
        length = _length(dct)
        if length is not None:
            if length < 0 or start + length > len(data):
                return {'error': True, 'streams': streams}
            chunk = data[start : start + length]
            pos = start + length
        else:
            end = data.find(b'endstream', start)
            if end < 0:
                return {'error': True, 'streams': streams}
            data_end = end
            if data_end > start and data[data_end - 1] in (10, 13):
                data_end -= 1
            if data_end > start and data[data_end - 1] == 13:
                data_end -= 1
            chunk = data[start:data_end]
            pos = end + len(b'endstream')
        streams.append({'filters': _filters(dct), 'data': chunk})
    return {'error': False, 'streams': streams}


def scan_pdf(data: bytes) -> dict:
    if len(data) < 8:
        return {'forbidden': False, 'unverified': True}
    if bytes_have_forbidden(data):
        return {'forbidden': True, 'unverified': False}
    parsed = list_streams(data)
    if parsed['error']:
        return {'forbidden': False, 'unverified': True}
    for st in parsed['streams']:
        unknown = [f for f in st['filters'] if f not in ('FlateDecode', 'DCTDecode')]
        if unknown:
            return {'forbidden': False, 'unverified': True}
        if 'FlateDecode' not in st['filters']:
            continue
        try:
            out = zlib.decompress(st['data'])
        except zlib.error:
            return {'forbidden': False, 'unverified': True}
        if bytes_have_forbidden(out):
            return {'forbidden': True, 'unverified': False}
    return {'forbidden': False, 'unverified': False}


def strip_jpeg_meta(data: bytes) -> bytes:
    if len(data) < 4 or data[:2] != b'\xff\xd8':
        return data
    out = bytearray(data[:2])
    i = 2
    while i + 1 < len(data):
        if data[i] != 0xFF:
            break
        marker = data[i + 1]
        if marker == 0xFF:
            i += 1
            continue
        if marker == 0xD9:
            out += data[i : i + 2]
            break
        if marker == 0xDA:
            out += data[i:]
            break
        if marker == 0x01 or 0xD0 <= marker <= 0xD7:
            out += data[i : i + 2]
            i += 2
            continue
        if i + 3 >= len(data):
            break
        seg = int.from_bytes(data[i + 2 : i + 4], 'big')
        if seg < 2 or i + 2 + seg > len(data):
            break
        skip = marker == 0xFE or 0xE1 <= marker <= 0xEF
        if not skip:
            out += data[i : i + 2 + seg]
        i += 2 + seg
    return bytes(out)


def jpeg_info(data: bytes):
    if data[:2] != b'\xff\xd8':
        return None
    i = 2
    while i + 8 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker == 0xD8:
            i += 2
            continue
        if marker in (0xD9, 0xDA):
            break
        if i + 3 >= len(data):
            break
        seglen = int.from_bytes(data[i + 2 : i + 4], 'big')
        if marker in (0xC0, 0xC1, 0xC2) and i + 9 < len(data):
            h = int.from_bytes(data[i + 5 : i + 7], 'big')
            w = int.from_bytes(data[i + 7 : i + 9], 'big')
            n = data[i + 9]
            cs = {1: 'DeviceGray', 3: 'DeviceRGB'}.get(n)
            if not cs or w < 1 or h < 1:
                return None
            return w, h, cs
        i += 2 + seglen
    return None


def build_pdf(jpegs: list) -> bytes | None:
    pages = []
    for blob in jpegs:
        info = jpeg_info(blob)
        if not info:
            return None
        if bytes_have_forbidden(blob):
            return None
        pages.append((blob, info))
    if not pages:
        return None
    parts: list[bytes] = []

    def add(chunk: bytes):
        parts.append(chunk)

    offsets = []

    def obj(num: int, body: bytes):
        offsets.append(sum(len(p) for p in parts))
        add(f'{num} 0 obj\n'.encode('ascii'))
        add(body)
        add(b'\nendobj\n')

    add(b'%PDF-1.4\n%\xff\xff\xff\xff\n')
    kids = ' '.join(f'{3 + i * 3} 0 R' for i in range(len(pages)))
    obj(1, f'<< /Type /Pages /Count {len(pages)} /Kids [ {kids} ] >>'.encode('ascii'))
    obj(2, b'<< /Type /Catalog /Pages 1 0 R >>')
    for i, (blob, (w, h, cs)) in enumerate(pages):
        scale = min(A4W / w, A4H / h)
        dw, dh = w * scale, h * scale
        x = (A4W - dw) / 2
        y = (A4H - dh) / 2
        pid, iid, cid = 3 + i * 3, 4 + i * 3, 5 + i * 3
        obj(
            pid,
            (
                f'<< /Type /Page /Parent 1 0 R /MediaBox [0 0 {A4W} {A4H}] '
                f'/Resources << /XObject << /Im0 {iid} 0 R >> >> /Contents {cid} 0 R >>'
            ).encode('ascii'),
        )
        obj(
            iid,
            (
                f'<< /Type /XObject /Subtype /Image /Width {w} /Height {h} '
                f'/ColorSpace /{cs} /BitsPerComponent 8 /Filter /DCTDecode /Length {len(blob)} >>\nstream\n'
            ).encode('ascii')
            + blob
            + b'\nendstream',
        )
        content = f'q {dw:.2f} 0 0 {dh:.2f} {x:.2f} {y:.2f} cm /Im0 Do Q'.encode('ascii')
        obj(cid, f'<< /Length {len(content)} >>\nstream\n'.encode('ascii') + content + b'\nendstream')
    xref_at = sum(len(p) for p in parts)
    nobj = 2 + len(pages) * 3
    xref = [b'xref\n', f'0 {nobj + 1}\n'.encode('ascii'), b'0000000000 65535 f \n']
    for off in offsets:
        xref.append(f'{off:010d} 00000 n \n'.encode('ascii'))
    add(b''.join(xref))
    add(f'trailer\n<< /Size {nobj + 1} /Root 2 0 R >>\nstartxref\n{xref_at}\n%%EOF\n'.encode('ascii'))
    data = b''.join(parts)
    if bytes_have_forbidden(data) or b'pdf-lib' in data or b'/Producer' in data:
        return None
    return data


def read_text(path: str) -> str:
    data = read_bin(path)
    utf8 = data.decode('utf-8', errors='replace')
    if '\ufffd' not in utf8:
        return utf8
    try:
        return data.decode('cp949')
    except UnicodeDecodeError:
        return utf8


def collect(root: str) -> list:
    found = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith('.')]
        for fn in filenames:
            rel = os.path.relpath(os.path.join(dirpath, fn), root)
            if ignored(rel):
                continue
            found.append(rel)
    return found


def judge(slot: dict, rel: str, root: str) -> dict:
    path = os.path.join(root, rel)
    ext = os.path.splitext(rel)[1].lower()
    try:
        size = os.path.getsize(path)
    except OSError:
        return {'state': 'rejected', 'note': '파일을 열지 못했어요', 'role': '', 'text': ''}
    if slot['kind'] == 'fit':
        if size <= 0:
            return {'state': 'rejected', 'note': '빈 파일은 넣지 않았어요', 'role': '', 'text': ''}
        if ext in IMAGE_EXT:
            return {'state': 'ready', 'note': 'A4 한 장에 맞춰요', 'role': 'fit-image', 'text': ''}
        if ext in PDF_EXT:
            scan = scan_pdf(read_bin(path))
            if scan['forbidden']:
                return {'state': 'rejected', 'note': '봇 표기나 볼트 경로가 있어 넣지 않았어요', 'role': '', 'text': ''}
            if scan['unverified']:
                return {'state': 'rejected', 'note': '안을 확인하지 못해 넣지 않았어요', 'role': '', 'text': ''}
            return {
                'state': 'rejected',
                'note': 'PDF 원본은 연습장 화면에서 폴더를 고르면 A4로 맞춰요',
                'role': '',
                'text': '',
            }
        return {'state': 'rejected', 'note': '사진이나 PDF만 A4 한 장으로 맞춰요', 'role': '', 'text': ''}
    if ext in TEXT_EXT:
        cleaned = clean_pay_text(read_text(path))
        if not cleaned['text']:
            return {'state': 'rejected', 'note': '봇 표기를 빼면 남는 내용이 없어요', 'role': '', 'text': ''}
        note = f"봇 표기 {cleaned['dropped']}줄을 뺐어요" if cleaned['dropped'] else '표만 남겼어요'
        return {'state': 'ready', 'note': note, 'role': 'pay-text', 'text': cleaned['text']}
    if size <= 0:
        return {'state': 'rejected', 'note': '빈 파일은 넣지 않았어요', 'role': '', 'text': ''}
    if ext in IMAGE_EXT:
        return {'state': 'ready', 'note': '표 그림만 넣어요', 'role': 'pay-image', 'text': ''}
    if ext in PDF_EXT:
        scan = scan_pdf(read_bin(path))
        if scan['forbidden']:
            return {'state': 'rejected', 'note': '봇 표기나 볼트 경로가 있어 넣지 않았어요', 'role': '', 'text': ''}
        if scan['unverified']:
            return {'state': 'rejected', 'note': '안을 확인하지 못해 넣지 않았어요', 'role': '', 'text': ''}
        return {
            'state': 'rejected',
            'note': 'PDF 원본은 연습장 화면에서 폴더를 고르면 표만 붙여요',
            'role': '',
            'text': '',
        }
    return {'state': 'rejected', 'note': 'PDF, 사진, txt, csv 만 붙여요', 'role': '', 'text': ''}


def plan_dir(root: str) -> dict:
    names = collect(root)
    groups = {s['id']: [] for s in SLOTS}
    extras = []
    for rel in names:
        slot = match_slot(rel)
        if not slot:
            extras.append(base_name(rel))
        else:
            groups[slot['id']].append(rel)
    slots = []
    for slot in SLOTS:
        cands = sorted(groups[slot['id']], key=lambda n: base_name(n))
        if not cands:
            slots.append({
                'id': slot['id'], 'label': slot['label'], 'state': 'missing',
                'note': '이 칸이 없어요', 'file': '', 'rel': '', 'role': '', 'text': '',
            })
            continue
        evals = []
        for rel in cands:
            judged = judge(slot, rel, root)
            evals.append({
                'rel': rel,
                'file': base_name(rel),
                'state': judged['state'],
                'note': judged['note'],
                'role': judged['role'],
                'text': judged['text'],
            })
        ready = [e for e in evals if e['state'] == 'ready']
        chosen = ready[0] if ready else evals[0]
        skipped = [e['file'] for e in evals if e is not chosen]
        note = chosen['note']
        if skipped:
            note = (note + ' ' if note else '') + '같은 칸의 다른 파일은 넣지 않았어요: ' + ', '.join(skipped)
        slots.append({
            'id': slot['id'],
            'label': slot['label'],
            'state': chosen['state'],
            'note': note,
            'file': chosen['file'],
            'rel': chosen['rel'] if chosen['state'] == 'ready' else '',
            'role': chosen['role'] if chosen['state'] == 'ready' else '',
            'text': chosen['text'] if chosen['state'] == 'ready' else '',
        })
    ok = all(s['state'] == 'ready' for s in slots)
    return {'ok': ok, 'checklistOnly': not ok, 'outName': OUT_NAME, 'title': TITLE, 'slots': slots, 'extras': extras}


def image_to_jpeg(path: str) -> bytes | None:
    ext = os.path.splitext(path)[1].lower()
    data = read_bin(path)
    if ext in ('.jpg', '.jpeg'):
        return strip_jpeg_meta(data)
    fd, tmp = tempfile.mkstemp(suffix='.jpg')
    os.close(fd)
    try:
        if os.name == 'nt':
            ps = (
                "Add-Type -AssemblyName System.Drawing; "
                "$img=[System.Drawing.Image]::FromFile($env:OT_IN); "
                "$img.Save($env:OT_OUT,[System.Drawing.Imaging.ImageFormat]::Jpeg); "
                "$img.Dispose()"
            )
            env = dict(os.environ)
            env['OT_IN'] = os.path.abspath(path)
            env['OT_OUT'] = tmp
            proc = subprocess.run(
                ['powershell', '-NoProfile', '-Command', ps],
                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            if proc.returncode != 0 or not os.path.getsize(tmp):
                return None
            return strip_jpeg_meta(read_bin(tmp))
        ffmpeg = shutil.which('ffmpeg')
        if not ffmpeg:
            return None
        proc = subprocess.run(
            [ffmpeg, '-y', '-i', path, '-frames:v', '1', tmp],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        if proc.returncode != 0 or not os.path.getsize(tmp):
            return None
        return strip_jpeg_meta(read_bin(tmp))
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def raster_text(text: str) -> list | None:
    if has_forbidden_text(text) or not text.strip():
        return None
    if os.name == 'nt':
        return _raster_text_windows(text)
    ffmpeg = shutil.which('ffmpeg')
    font = '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'
    if not ffmpeg or not os.path.exists(font):
        return None
    lines = []
    for row in text.split('\n'):
        if not row:
            lines.append('')
            continue
        for i in range(0, len(row), 28):
            lines.append(row[i : i + 28])
    per = 36
    pages = []
    for start in range(0, max(len(lines), 1), per):
        chunk = '\n'.join(lines[start : start + per]) or ' '
        fd, txt = tempfile.mkstemp(suffix='.txt')
        os.close(fd)
        fdj, jpg = tempfile.mkstemp(suffix='.jpg')
        os.close(fdj)
        try:
            write_text(txt, chunk)
            proc = subprocess.run(
                [
                    ffmpeg, '-y', '-f', 'lavfi', '-i', 'color=c=white:s=1240x1754',
                    '-vf',
                    f"drawtext=fontfile={font}:textfile={txt}:fontsize=28:fontcolor=black:x=72:y=72",
                    '-frames:v', '1', jpg,
                ],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            if proc.returncode != 0 or not os.path.getsize(jpg):
                return None
            pages.append(strip_jpeg_meta(read_bin(jpg)))
        finally:
            for p in (txt, jpg):
                try:
                    os.remove(p)
                except OSError:
                    pass
    return pages or None


def _raster_text_windows(text: str) -> list | None:
    lines = []
    for row in text.split('\n'):
        if not row:
            lines.append('')
            continue
        for i in range(0, len(row), 28):
            lines.append(row[i : i + 28])
    per = 36
    pages = []
    ps = r'''
Add-Type -AssemblyName System.Drawing
$text = [IO.File]::ReadAllText($env:OT_IN, [Text.Encoding]::UTF8)
$bmp = New-Object System.Drawing.Bitmap 1240, 1754
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font "Malgun Gothic", 16
$rect = New-Object System.Drawing.RectangleF 48, 48, 1144, 1658
$g.DrawString($text, $font, [System.Drawing.Brushes]::Black, $rect)
$bmp.Save($env:OT_OUT, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose(); $bmp.Dispose()
'''
    for start in range(0, max(len(lines), 1), per):
        chunk = '\n'.join(lines[start : start + per])
        fd, txt = tempfile.mkstemp(suffix='.txt')
        os.close(fd)
        fdj, jpg = tempfile.mkstemp(suffix='.jpg')
        os.close(fdj)
        try:
            write_text(txt, chunk)
            env = dict(os.environ)
            env['OT_IN'] = txt
            env['OT_OUT'] = jpg
            proc = subprocess.run(
                ['powershell', '-NoProfile', '-Command', ps],
                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            if proc.returncode != 0 or not os.path.getsize(jpg):
                return None
            pages.append(strip_jpeg_meta(read_bin(jpg)))
        finally:
            for p in (txt, jpg):
                try:
                    os.remove(p)
                except OSError:
                    pass
    return pages or None


def slot_jpegs(slot: dict, root: str) -> list | None:
    role = slot['role']
    if role == 'pay-text':
        return raster_text(slot['text'])
    if role in ('pay-image', 'fit-image'):
        jpg = image_to_jpeg(os.path.join(root, slot['rel']))
        return [jpg] if jpg else None
    return None


def print_plan(plan: dict) -> None:
    print(plan['title'] + ' 원인행위 붙임')
    print('서류 확인')
    for slot in plan['slots']:
        mark = {'ready': '있음', 'missing': '없음'}.get(slot['state'], '빼 둠')
        line = f"[{mark}] {slot['label']}"
        if slot['file']:
            line += ' — ' + slot['file']
        if slot['note']:
            line += ' — ' + slot['note']
        print(line)
    if plan['extras']:
        print('칸에 없어서 넣지 않은 파일: ' + ', '.join(plan['extras']))


def run(root: str) -> int:
    root = os.path.abspath(root)
    plan = plan_dir(root)
    print_plan(plan)
    if not plan['ok']:
        print('확인이 끝나지 않아 PDF를 만들지 않았습니다. 없는 서류는 빈 종이로 채우지 않습니다.')
        return 2
    jpegs = []
    for slot in plan['slots']:
        pages = slot_jpegs(slot, root)
        if not pages:
            print(slot['label'] + '을 종이 모양으로 바꾸지 못해 PDF를 만들지 않았습니다.')
            return 2
        jpegs.extend(pages)
    data = build_pdf(jpegs)
    if not data:
        print('결과에 봇 표기가 있거나 그림을 열지 못해 저장하지 않았습니다.')
        return 1
    out = os.path.join(root, plan['outName'])
    with open(out, 'wb') as fh:
        fh.write(data)
    print('결과: ' + out)
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=TITLE + ' 원인행위 붙임')
    p.add_argument('--src', default='.', help='서류 폴더')
    args = p.parse_args(argv)
    return run(args.src)


if __name__ == '__main__':
    sys.exit(main())
