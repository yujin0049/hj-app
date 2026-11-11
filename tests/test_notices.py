"""남해캠 공지사항(#/notice) 자료 시험: python3 -m unittest tests.test_notices
- 본문 전문 없음(앞부분만), 연락처·이름 꼴 있는 글은 요약 없이 「개인정보 포함」, 이미지 본문은 요약 없음
- 같은 입력 → 같은 출력(두 번 만들어 바이트 같음), 원자료 없으면 rc 3 으로 예전 파일 유지"""
import glob, json, os, shutil, sys, tempfile, unittest
R = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, os.path.join(R, 'tools'))
import make_notices as M  # noqa: E402
import refresh_all  # noqa: E402


def rd(p):
    with open(os.path.join(R, p), encoding='utf-8') as f:
        return json.load(f)


def fake_src(d, posts, arts):
    with open(os.path.join(d, '_list.json'), 'w', encoding='utf-8') as f:
        json.dump({'posts': posts}, f, ensure_ascii=False)
    with open(os.path.join(d, '_articles.jsonl'), 'w', encoding='utf-8') as f:
        for a in arts:
            f.write(json.dumps(a, ensure_ascii=False) + '\n')


# 시험용 연락처 꼴은 실행 때 이어 붙여 만듦(저장소 글자에 번호 모양을 남기지 않음)
PHONE = '0' + '55' + '-' + '000' + '-' + '1' + '234'
MAIL = 'office' + '@' + 'school' + '.' + 'kr'


class Notices(unittest.TestCase):
    def test_kinds_and_summary(self):
        posts = [{'nttId': str(i), '번호': i, '제목': '안내 %d' % i, '작성자': '교무처', '작성일': '2026-01-0%d' % i, '조회수': i} for i in range(1, 6)]
        arts = [
            {'nttId': '1', 'http_ok': True, '본문': '가' * 300, '첨부파일명': ['붙임.hwp']},
            {'nttId': '2', 'http_ok': True, '본문': '문의 ' + PHONE},
            {'nttId': '3', 'http_ok': True, '본문': '', '본문없음': True},
            {'nttId': '4', 'http_ok': False, '본문': ''},
            {'nttId': '5', 'http_ok': True, '본문': '메일 ' + MAIL},
        ]
        files = M.build(posts, {a['nttId']: a for a in arts})
        rows = {r['id']: r for r in files['notices/2026.json']['rows']}
        self.assertEqual([r['id'] for r in files['notices/2026.json']['rows']], ['5', '4', '3', '2', '1'])
        self.assertEqual(rows['1']['k'], 'ok')
        self.assertLessEqual(len(rows['1']['s']), M.SUMMARY_LEN + 1)
        self.assertEqual((rows['2']['k'], rows['3']['k'], rows['4']['k'], rows['5']['k']), ('pii', 'img', 'fail', 'pii'))
        for i in '2345':
            self.assertNotIn('s', rows[i])
        c = files['notices.json']['counts']
        self.assertEqual((c['ok'], c['pii'], c['img'], c['fail']), (1, 2, 1, 1))
        self.assertEqual(M.leftover_pii(files), 0)

    def test_title_contact_masked(self):
        t, ch = M.scrub_meta('행사 안내(문의 ' + PHONE + ')')
        self.assertTrue(ch)
        self.assertNotIn(PHONE, t)
        self.assertIn(M.MASK, t)

    def test_same_input_same_output_and_check(self):
        posts = [{'nttId': '9', '번호': 9, '제목': '수강 안내', '작성자': '교무처', '작성일': '2025-03-02', '조회수': 3}]
        arts = [{'nttId': '9', 'http_ok': True, '본문': '수강 기간 안내'}]
        src, out1, out2 = tempfile.mkdtemp(), tempfile.mkdtemp(), tempfile.mkdtemp()
        try:
            fake_src(src, posts, arts)
            self.assertEqual(M.main(['--src', src, '--out-dir', out1]), 0)
            self.assertEqual(M.main(['--src', src, '--out-dir', out2]), 0)
            for p in ('notices.json', 'notices/2025.json'):
                self.assertEqual(open(os.path.join(out1, p), 'rb').read(), open(os.path.join(out2, p), 'rb').read())
            self.assertEqual(M.main(['--src', src, '--out-dir', out1, '--check']), 0)
            self.assertNotIn('generated', open(os.path.join(out1, 'notices.json'), encoding='utf-8').read())
        finally:
            for d in (src, out1, out2):
                shutil.rmtree(d, ignore_errors=True)

    def test_missing_src_keeps_old(self):
        d = tempfile.mkdtemp()
        try:
            self.assertEqual(M.main(['--src', os.path.join(d, 'none'), '--out-dir', d]), 3)
            steps = {}
            self.assertEqual(refresh_all.notice_step(os.path.join(d, 'none'), d, steps, fetch=False), 3)
            self.assertFalse(steps[refresh_all.NOTICE_KEY]['ok'])
        finally:
            shutil.rmtree(d, ignore_errors=True)

    def test_public_files(self):
        ix = rd('data/notices.json')
        n = 0
        for y in ix['years']:
            f = rd(y['file'])
            self.assertEqual(len(f['rows']), y['n'])
            n += len(f['rows'])
            for r in f['rows']:
                if r['k'] == 'ok':
                    self.assertLessEqual(len(r['s']), ix['summary_len'] + 1)
                else:
                    self.assertNotIn('s', r)
        self.assertEqual(n, ix['n'])
        self.assertEqual(sorted(glob.glob(os.path.join(R, 'data', 'notices', '*.json'))),
                         sorted(os.path.join(R, y['file']) for y in ix['years']))
        self.assertEqual(M.leftover_pii({k: rd(os.path.join('data', k)) for k in ['notices.json'] + [y['file'][5:] for y in ix['years']]}), 0)

    @unittest.skipUnless(os.path.exists(os.path.join(M.SRC_DEFAULT, '_list.json')), '박스 원자료 없음')
    def test_committed_matches_source(self):
        self.assertEqual(M.main(['--check']), 0)


if __name__ == '__main__':
    unittest.main()
