"""261023 유진님 「적용」: 공개 사이트(GitHub Pages = 이 저장소)에서 내린 것들이 다시 올라오지 않게.
실행: python3 -m unittest tests.test_public_takedown"""
import os, subprocess, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def tracked():
    out = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, capture_output=True, check=True).stdout
    return [p for p in out.decode('utf-8').split('\0') if p]


class T(unittest.TestCase):
    def test_removed_files_not_tracked(self):
        files = set(tracked())
        for p in ('data/bot_status.json', 'data/hyunhwang_score.json', 'dl/mic-relay.apk'):
            self.assertNotIn(p, files, p)

    # 시트 주소(dorm.json·public-pack.json) 비우기는 이번 커밋에 못 넣음: 두 파일이 한 줄 JSON이라 고치면 기존 실명·계좌 줄이 통째로
    # 다시 추가돼 pre-commit(pii_guard)이 막음 → 실명 정리 뒤 같이 넣고 여기 시험을 켠다.

    def test_no_link_to_apk(self):
        for p in tracked():
            if p.endswith(('.html', '.js', '.json', '.webmanifest')):
                with open(os.path.join(ROOT, p), encoding='utf-8', errors='replace') as fh:
                    self.assertNotIn('mic-relay', fh.read(), p)


if __name__ == '__main__':
    unittest.main()
