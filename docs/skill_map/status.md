# skill-map 인수인계 — status

구독 종료(2026-11-16) 대비. 이 문서만 읽고 이어서 할 수 있게 적는다.

## 지금

- 화면: `#/skill-map` (역량맵). 브랜드 C(`#4CC3FF`, Hahmlet).
- 브랜치 `feature/skill-map-261116`. PR #79 DRAFT(합치지 않음, live 안 올림). 작업 클론 `/workspace/hjapp_skillmap_261116/repo`.
- main(`75a45b4`, PR #78)을 **rebase가 아니라 merge 커밋**으로 넣음. force push 없음.
- 코드 head: `4913d6bc0048c75eee3ec1620b581691111e4f38` (짧게 `4913d6b`). CACHE `hj-v97`.
- 미리보기(live 아님, `dorm.json` 없음, `data/skill_map`만 포함): https://hj-pv-skillmap-261116.yujin06344.workers.dev/#/skill-map
  - 워커 version `737b594a-ac00-46de-9f14-f519979fc873` **100%**, 배포 시각 2026-11-16 10:05:23 (Asia/Seoul)
- **충돌을 풀어 두 기능을 모두 유지**한 파일: `js/registry.js`, `js/app.js`, `js/intranet-nav.js`, `js/modules/more.js`, `tests/test_llms.py`, `llms.txt`, `ai/index.json`. MODULE_EXTRA 끝은 `office-guide`, `skill-map`.
- 시험(합친 뒤): `node --test tests/skill_map_core.test.js tests/office_guide_core.test.js` 13/13, `python3 -m unittest tests.test_skill_map tests.test_office_guide tests.test_nav tests.test_intranet_home tests.test_llms` 28 OK, CACHE 고정(chat·docreg_cal·collab_board) 46 OK. 개인정보 변경 파일 rc0.
- 하는 일: 새 일 글을 붙여 넣으면 앱 안 낱말 사전으로 16칸 가운데 맞는 것을 밝힘. 「일 끝내기」는 밝힌 칸에서 객관식 3문항. 점수는 이 기기 localStorage에 칸 id와 득점만.
- **네 갈래 묶음**(판단 기록):
  - **돈**: 예산·집행률, 원인행위·지출결의, 강사료·시수, 구매·검수 — 예산이 나가 정산되기까지의 돈의 흐름.
  - **문서**: 공문·기안·결재, 규정·법령, 회의자료·보고, 문서대장·기록 — 글을 만들고 남기는 일.
  - **사람**: 학사·휴보강, 기숙사·학생관리, 민원·소통, 협조·부서연결 — 학생·민원인·다른 부서와 맞닿는 일.
  - **운영**: 글로컬사업·성과지표, 항공교육 인가(ATO·국토부), 일정·마감관리, 엑셀·데이터 — 사업·인가·기한·자료 관리.
- 문제 수(출처 없는 문항 0, 16칸 모두 5개 이상 → 「문제 준비 중」인 칸 없음):
  - 예산·집행률 5, 원인행위·지출결의 6, 강사료·시수 5, 구매·검수 5
  - 공문·기안·결재 6, 규정·법령 5, 회의자료·보고 5, 문서대장·기록 5
  - 학사·휴보강 5, 기숙사·학생관리 5, 민원·소통 5, 협조·부서연결 5
  - 글로컬사업·성과지표 5, 항공교육 인가(ATO·국토부) 7, 일정·마감관리 5, 엑셀·데이터 5
  - 합계 84. `src`에는 규정·법령·문서 제목과 조문만. 금고 경로·사람 이름은 없음.
- 문제 출처 개인 대조표(커밋하지 않음): `/workspace/skillmap_261116/src_private.md`
- 화면 갈무리(커밋하지 않음): `/workspace/skillmap_261116/shots/skill-map-empty-390.png`, `skill-map-empty-1280.png`, `skill-map-match-390.png`, `skill-map-match-1280.png`, `skill-map-quiz-1280.png`
- 시험: `node --test tests/skill_map_core.test.js` 6/6, `python3 -m unittest tests.test_skill_map tests.test_nav tests.test_intranet_home tests.test_llms` OK, CACHE 고정(chat·docreg_cal·collab_board) 46 OK.
- 개인정보: 이번 변경 파일 `pii_check --target github` rc0. (`index.html` Pretendard `@v1.3.9` 이메일 오탐은 main에도 있음, 이번 변경 아님.)
- **main 머지·live(GitHub Pages) 안 함.** PR은 draft로만 열어 둠.

## 다음

1. 검수(갈래 묶음, 문제 근거, 390·1280 화면, 미리보기).
2. squash·rebase·live 여부는 다음 판단. 지금은 올리지 않음.
3. 엑셀 공식·시트 조작처럼 규정에 없는 내용은 넣지 않음. 엑셀·데이터 칸의 5문항은 학적·출석 자료 보관과 개인정보 안전조치·파기다.
4. 미리보기 워커는 앱 껍데기+JS/CSS/icons/public + `data/skill_map`만. data 나머지·3d·dorm.json 제외.

## 막힘

- 없음.

## 근거

- 대장 0949, 유진님「ㅇㅇ 앱에 만들어」
- 법령은 korean-law 도구로 2026-11-16(Asia/Seoul) 현행 조문을 읽음. 학교 규정은 `/home/box/obsidian_vault/봇공유/20 규정·지침`과 박스 전환본(`/workspace/md_전환`, `/workspace/regs/articles`)을 읽음.
- live 앱(올리지 않음): https://yujin0049.github.io/hj-app/
- PR: https://github.com/yujin0049/hj-app/pull/79
