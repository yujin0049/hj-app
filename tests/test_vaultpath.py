"""공개 JSON 에 볼트·박스·PC 경로가 없어야 함 + 이름만 남기는 규칙 (261029)."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import vaultpath  # noqa: E402


def test_public_json_has_no_vault_paths():
    assert vaultpath.main(['--check'] + vaultpath.public_files()) == 0


def test_plain_names():
    assert vaultpath.plain('볼트 봇공유/10 업무/261022_업무방식_정본_v01.md') == '261022_업무방식_정본_v01'
    assert vaultpath.plain('근거: 조사/a_v01.md · 10 업무/b.md') == '근거: a_v01 · b'
    assert vaultpath.plain('폴더: F:\\2026학년도\\특강\\강사료지급\\') == '폴더: 「강사료지급」'
    assert vaultpath.plain('F:\\자료를 정리') == 'F드라이브 자료를 정리'
    assert vaultpath.plain('https://www.law.go.kr/법령/국고금관리법/제20조') == 'https://www.law.go.kr/법령/국고금관리법/제20조'
    assert vaultpath.plain('data/calendar_extra.json') == 'data/calendar_extra.json'


def test_scrub_obj_keeps_repo_copies_and_blanks_obsidian():
    o = {'file': 'docs/regs/위임전결규정.md', 'vault': '봇공유/20 규정·지침/국립창원대_위임전결규정.md',
         'obsidian': 'obsidian://open?vault=x&file=y', 'path': '봇공유/50 자료색인/r045__25.12.17_ 2025 편람(최종).md'}
    n = vaultpath.scrub_obj(o)
    assert n == {'file': 'docs/regs/위임전결규정.md', 'vault': '국립창원대_위임전결규정', 'obsidian': '', 'path': 'r045__25.12.17_ 2025 편람(최종)'}
