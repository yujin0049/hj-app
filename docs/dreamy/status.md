# dreamy 인수인계 — status

구독 종료(2026-11-16) 대비. 이 문서만 읽고 이어서 할 수 있게 적는다.

## 지금

- 참고 분석: `docs/dreamy/ref_analysis.md` (화면 1, 쪽 10, 동작: 목차·인쇄·주소 복사. 원본 체크리스트는 글자 □).
- 1차 화면: `#/office-guide` (신입 업무 가이드). 브랜드 C(`#4CC3FF`, Hahmlet).
  - 파일: `js/office-guide-core.js`, `js/modules/office-guide.js`
  - 연결: `js/registry.js` MODULE_EXTRA, `js/intranet-nav.js` 「그 밖」, `js/modules/more.js`, `js/app.js` 탭은 더보기
  - 10쪽 목차, 장 01–05 다음 07(06 없음, 원본과 같음), 인쇄, 주소 복사, 첫 출근 체크 10개(이 기기 `localStorage` 키 `hj-office-guide-check`, 항목 id만)
  - 원본 1쪽 1인칭 소개는 빼었고, 호칭·멘트는 `○○` 자리표시만. 본문이 비면 「데이터 없음」
- 작업 위치: `/workspace/hjapp_dreamy_261116/repo` (main `9f9cf1a` 새 클론). 브랜치 `feature/dreamy-ref-261116`.
- head: `3542930baf35bc5a37897126cdfa94c6db738c82` (짧게 `3542930`). CACHE `hj-v96`.
- `/workspace/hj-app-inventory` 는 만지지 않음.
- **main 머지·live(GitHub Pages) 안 함.** PR은 열지 않음(미리보기는 워커).
- 미리보기(live 아님, `dorm.json` 없음): https://hj-pv-dreamy-261116.yujin06344.workers.dev/#/office-guide
- 시험: `node --test tests/office_guide_core.test.js` 6/6, `python3 -m unittest tests.test_office_guide tests.test_nav tests.test_intranet_home tests.test_llms` OK, CACHE 고정 시험(chat·docreg_cal·collab_board) OK.
- 개인정보: `python3 /workspace/pii_build/pii_check.py --target github` 이번 변경 파일 rc0. 저장소 관례 `python3 pii_baseline.py` 새 낱말 0, rc0. (`index.html` 의 pretendard CDN `@v1.3.9` 이메일 오탐은 main에도 이미 있음.)

## 다음

1. 춘식이·춘식이3 검수. squash·rebase·live 여부는 다음 판단. 지금은 올리지 않음.
2. 홈 첫 화면 타일, 검색, 본문 수정 기능은 아직 없음(범위 밖).
3. 미리보기 워커는 앱 껍데기+JS/CSS/icons/public 만 넣음(data·3d·dorm.json 제외). 다른 화면은 자료가 없어 「데이터 없음」이 될 수 있음. 가이드 화면은 확인함.

## 막힘

- 없음. 로그인·결제·새 secret 없이 1차와 미리보기까지 끝.
- 전체 앱을 넣는 미리보기 파일은 24MB라 커넥터 한도(8MB)에 안 들어가, 위처럼 줄여 배포함.

## 근거

- 유진님 11.9 「출석앱 끝나면 이거 해」
- 대장 261116 착수 OK
- 춘식이 배분 261116: repo `yujin0049/hj-app`, 브랜치 `feature/dreamy-ref-261116`, 작은 커밋·매일 push, `docs/dreamy/status.md` 유지, 브랜드 C, 예시데이터·실명 금지, 없으면 「데이터 없음」, main 머지·live 반영 금지
- 참고: https://dreamy-semolina-6aea11.netlify.app/
- live 앱(올리지 않음): https://yujin0049.github.io/hj-app/
- 미리보기 관례: `/workspace/hj_audit/preview/build_preview.py` → Cloudflare 커넥터 execute. GitHub Pages 브랜치 미리보기 워크플로는 없음.
