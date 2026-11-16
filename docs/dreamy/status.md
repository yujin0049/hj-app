# dreamy 인수인계 — status

구독 종료(2026-11-16) 대비. 이 문서만 읽고 이어서 할 수 있게 적는다.

## 지금

- 참고 분석: `docs/dreamy/ref_analysis.md` (화면 1, 쪽 10, 동작: 목차·인쇄·주소 복사. 원본 체크리스트는 글자 □).
- 화면: `#/office-guide` (신입 업무 가이드). 브랜드 C(`#4CC3FF`, Hahmlet).
- 브랜치 `feature/dreamy-ref-261116`. PR #78 OPEN(합치지 않음). 작업 클론 `/workspace/hjapp_dreamy_261116/repo`.
- head: `c9468bd09aefc78eae1133dc15e68b1b16a71b7e` (짧게 `c9468bd`). CACHE `hj-v96`.
- 미리보기(live 아님, `dorm.json` 없음): https://hj-pv-dreamy-261116.yujin06344.workers.dev/#/office-guide
  - 워커 version `edcee44c-8aea-4b78-9e6a-551d7d95a7d0` **100%**, 배포 시각 2026-11-16 09:39:53 (Asia/Seoul)
- **춘식이3 1차 검수 미통과 4건을 고침** (커밋 `5d4fa25`).
  - 높음: 인쇄에서 `.og *` 글자를 `#111`/`#000`으로. 본문 p/li 대비율 **18.88:1**(고치기 전 **1.1:1**, `#EAF6FF` on white). 제목은 **21:1**. 보이는 가이드 글자 264개 모두 4.5:1 이상.
  - 낮음: 인쇄에서 `#hj-stamp`(달력 자료 갱신 띠) 숨김.
  - 낮음: 체크리스트 1–5는 9쪽, 6–10은 10쪽. localStorage id `c1`–`c10` 유지.
  - 낮음: `.og-page`의 `break-inside:avoid`를 `auto`로. A4 PDF **18쪽 → 12쪽**. 고치기 전 2–6줄 잔여 쪽(4,6,8,10,12,14,16)이 없어짐.
- **춘식이3 재검수 통과, 관찰 1건을 고침** (커밋 `c9468bd`).
  - 고치기 전: A4 PDF 11쪽이 `PAGE 10 / 10` 제목만으로 끝나고, 체크 6–10은 12쪽에 시작.
  - 고친 뒤: `.og-lab`에 `break-after:avoid`, 제목+체크(6–10)를 `.og-keep{break-inside:avoid}`로 묶음. 9쪽의 제목+체크 1–5도 같은 방식으로 묶음.
  - A4 PDF **12쪽 유지**. `PAGE 10 / 10` 제목과 항목 6–10(「공유 폴더 및 파일 경로 확인하기」…「하루 업무가 끝나면 노트 정리하기」)과 「마지막으로!」가 **12쪽에 같이** 있음. 11쪽은 파일명 안내·체크 1–5로 끝남.
- 인쇄 PDF: `/workspace/dreamy_fix_261116/pdf/after2_office-guide_a4.pdf` (재검수 후 제목 묶음). 직전 `after_office-guide_a4.pdf`, 고치기 전 `before_office-guide_a4.pdf`.
- 시험: `node --test tests/office_guide_core.test.js` 7/7, `python3 -m unittest tests.test_office_guide tests.test_nav tests.test_intranet_home tests.test_llms` 25 OK, CACHE 고정(chat·docreg_cal·collab_board) 46 OK.
- 개인정보: 이번 변경 파일(`js/modules/office-guide.js`, `tests/test_office_guide.py`, 이 status) `pii_check --target github` rc0. (`index.html` Pretendard `@v1.3.9` 이메일 오탐은 main에도 있음, 이번 변경 아님.)
- **main 머지·live(GitHub Pages) 안 함.**

## 다음

1. 춘식이3이 제목 묶음(PAGE 10과 체크 6–10이 같은 쪽)만 다시 보면 됨. squash·rebase·live 여부는 다음 판단. 지금은 올리지 않음.
2. 홈 첫 화면 타일, 검색, 본문 수정은 범위 밖.
3. 미리보기 워커는 앱 껍데기+JS/CSS/icons/public 만. data·3d·dorm.json 제외.

## 막힘

- 없음.

## 근거

- 유진님 11.9 「출석앱 끝나면 이거 해」
- 대장 261116 착수 OK
- 춘식이 배분 261116, 춘식이3 1차 검수 `/workspace/dreamy_check_261116/결과_v01.md` (미통과, 높음 1·낮음 3), 재검수 통과(PAGE 10 제목 고아 관찰)
- 참고: https://dreamy-semolina-6aea11.netlify.app/
- live 앱(올리지 않음): https://yujin0049.github.io/hj-app/
