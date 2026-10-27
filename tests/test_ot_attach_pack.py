"""10월 시간외 원인행위 붙임: 칸 확인, 봇 표기 제거, 빠진 칸은 PDF 없음."""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import ot_attach_pack as P  # noqa: E402

JPG = os.path.join(ROOT, 'tests', 'fixtures', 'otattach', 'tiny.jpg')
PHRASES = ('만든봇', '봇공유', 'pdf-lib')


def read(path):
    with open(path, 'rb') as fh:
        return fh.read()


class T(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.d)

    def put(self, name, data):
        path = os.path.join(self.d, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        mode = 'wb' if isinstance(data, bytes) else 'w'
        with open(path, mode, encoding=None if isinstance(data, bytes) else 'utf-8') as fh:
            fh.write(data)
        return path

    def test_clean_keeps_table_drops_bot_notes(self):
        raw = '\n'.join([
            '---',
            '만든봇: 연습',
            '원본경로: 봇공유/예시',
            '---',
            '구분,시간,금액',
            '주간,2,1000',
            '봇 메모: 빼기',
        ])
        cleaned = P.clean_pay_text(raw)
        self.assertIn('주간,2,1000', cleaned['text'])
        self.assertNotIn('만든봇', cleaned['text'])
        self.assertNotIn('봇공유', cleaned['text'])
        self.assertEqual(P.clean_pay_text('만든봇: 연습\n')['text'], '')

    def test_missing_slot_writes_no_pdf(self):
        self.put('지급내역표.jpg', read(JPG))
        self.put('신분증.jpg', read(JPG))
        self.put('재직증명서.jpg', read(JPG))
        code = P.run(self.d)
        self.assertEqual(code, 2)
        self.assertFalse(os.path.exists(os.path.join(self.d, P.OUT_NAME)))

    def test_four_jpegs_make_clean_pdf(self):
        comment = '만든봇'.encode('utf-8')
        seg = b'\xff\xfe' + (len(comment) + 2).to_bytes(2, 'big') + comment
        raw = read(JPG)
        dirty = raw[:2] + seg + raw[2:]
        self.assertIn('만든봇'.encode('utf-8'), dirty)
        self.put('지급내역표.jpg', dirty)
        self.put('신분증.jpg', raw)
        self.put('재직증명서.jpg', raw)
        self.put('통장사본.jpg', raw)
        self.put('메모.txt', '만든봇: 칸 밖\n')
        code = P.run(self.d)
        self.assertEqual(code, 0, code)
        out = os.path.join(self.d, P.OUT_NAME)
        data = read(out)
        self.assertTrue(data.startswith(b'%PDF'))
        for phrase in PHRASES:
            self.assertNotIn(phrase.encode('utf-8'), data, phrase)
        self.assertEqual(data.count(b'/Type /Page '), 4)
        self.assertNotIn(b'/Producer', data)

    def test_text_table_and_folder_name(self):
        self.put('10월_지급내역표.csv', '구분,시간,금액\n주간,2,1000\n만든봇: 빼기\n')
        os.makedirs(os.path.join(self.d, '신분증'))
        self.put('신분증/scan.jpg', read(JPG))
        self.put('재직증명서.jpg', read(JPG))
        self.put('지급내역/통장사본.jpg', read(JPG))
        code = P.run(self.d)
        self.assertEqual(code, 0, code)
        data = read(os.path.join(self.d, P.OUT_NAME))
        for phrase in PHRASES:
            self.assertNotIn(phrase.encode('utf-8'), data)

    def test_bat_calls_script(self):
        with open(os.path.join(ROOT, 'tools', '원인행위_붙임_원클릭.bat'), encoding='utf-8') as fh:
            bat = fh.read()
        self.assertIn('ot_attach_pack.py', bat)
        self.assertNotIn('api_key', bat.lower())
        self.assertNotIn('sk-', bat)


if __name__ == '__main__':
    unittest.main()
