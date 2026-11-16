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
- `/workspace/hj-app-inventory` 는 만지지 않음. CACHE `hj-v96`.
- **main 머지·live(GitHub Pages) 안 함.**

## 다음

1. `pii_check --target github` rc0 확인 뒤 이 브랜치만 push.
2. live 아닌 미리보기: `/workspace/hj_audit/preview/build_preview.py` 로 워커 파일을 만들고 Cloudflare execute. 이름 예 `hj-pv-dreamy-261116`. `dorm.json` 은 새 주소에 넣지 않음.
3. 홈 첫 화면 타일, 검색, 본문 수정 기능은 아직 없음(범위 밖).
4. 춘식이 검수 뒤 squash·rebase·live 여부는 다음 판단. 지금은 올리지 않음.

## 막힘

- 미리보기는 Cloudflare execute 가 통할 때만 연다. 새 로그인·secret 이 필요하면 그 지점에서 멈추고 주소 없이 보고한다.
- 로그인·결제·상신은 이 도구에 없음.

## 근거

- 유진님 11.9 「출석앱 끝나면 이거 해」
- 대장 261116 착수 OK
- 춘식이 배분 261116: repo `yujin0049/hj-app`, 브랜치 `feature/dreamy-ref-261116`, 작은 커밋·매일 push, `docs/dreamy/status.md` 유지, 브랜드 C, 예시데이터·실명 금지, 없으면 「데이터 없음」, main 머지·live 반영 금지
- 참고: https://dreamy-semolina-6aea11.netlify.app/
- live 앱(올리지 않음): https://yujin0049.github.io/hj-app/
- 미리보기 관례: `/workspace/hj_audit/preview/build_preview.py` → Cloudflare 커넥터 execute. GitHub Pages 브랜치 미리보기 워크플로는 없음.
- 시험: `node --test tests/office_guide_core.test.js`, `python3 -m unittest tests.test_office_guide tests.test_nav tests.test_intranet_home`
