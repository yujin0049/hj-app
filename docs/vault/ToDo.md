# 볼트 문서 ToDo

## 한 것
- [x] 범위 설정 `tools/vault_folders.json`
- [x] 팩 만들기 `tools/build_vault_pack.py` (저장소 밖에만, 주민번호 가림, 폴더별 문서 수)
- [x] 화면 `js/modules/vault.js` · `js/vault-api.js` · `js/vault-md.js` (폴더 나무·찾기·문서·마지막 갱신·잠김 화면)
- [x] 더보기 메뉴 「볼트 문서」, 공부 규정 카드 「원문 보기」
- [x] 서비스 워커가 `/api/` 를 저장하지 않게
- [x] 시험: `tests/test_vault_pack.py`, `tests/test_vault_guard.py`, `tests/test_vault_viewer.py`(크롬 있을 때)

## 남은 것
- [ ] KV `hj-vault` 만들고 팩 올리기, 잠긴 Worker 에 `handleVault` + `VAULT_KV` 붙이기 (배포는 따로)
- [ ] 로그아웃 상태에서 `/api/vault/*` 가 403 인지 확인
- [ ] 볼트가 바뀌면 팩 다시 만들고 올리는 자동 루틴
- [ ] 유진님 휴대폰·PC 에서 확인 뒤 main 반영
