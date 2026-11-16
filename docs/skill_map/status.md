# skill-map 인수인계 — status

구독 종료(2026-11-16) 대비. 이 문서만 읽고 이어서 할 수 있게 적는다.

## 지금

- 화면: `#/skill-map` (역량맵). 브랜드 C(`#4CC3FF`, Hahmlet).
- 브랜치 `feature/skill-map-261116`. PR #79 DRAFT(합치지 않음, live 안 올림). 작업 클론 `/workspace/hjapp_skillmap_261116/repo`.
- main(`75a45b4`, PR #78)을 **rebase가 아니라 merge 커밋**으로 넣음. force push 없음.
- 코드 head: `18b0be0d538c754b478f86a53ba3ebbc515204c6` (짧게 `18b0be0`; 이 status를 올린 뒤 브랜치 끝에 문서 커밋이 한 번 더 붙음). CACHE `hj-v97`(main은 아직 hj-v96, 올리지 않음).
- 미리보기(live 아님, `dorm.json` 없음, `data/skill_map` + `data/competency_map_v02.json` + 루트 `public-pack.json` 포함): https://hj-pv-skillmap-261116.yujin06344.workers.dev/#/skill-map
  - 워커 version `5b13b7d6-d041-43cc-b626-8d09c88c990e` **100%**, 배포 시각 2026-11-16 10:41:17 (Asia/Seoul)
- **충돌을 풀어 두 기능을 모두 유지**한 파일(앞선 merge): `js/registry.js`, `js/app.js`, `js/intranet-nav.js`, `js/modules/more.js`, `tests/test_llms.py`, `llms.txt`, `ai/index.json`. MODULE_EXTRA 끝은 `office-guide`, `skill-map`.
- **③ 기존 역량 10 위에 연결**(전문가 검토). 전용 화면은 원래 없었고, 자료는 `data/competency_map_v02.json`, 주간 엔진은 `js/app.js` `weekEngine`/`applyCompetencyMap`, 화면은 `#/study/week`(`js/modules/study.js`). 보조: `data/t020_zero_tolerance.json`, `data/wrong_anki_seed.json`, `tests/test_p002_schema.py`. 맵·붙여넣기·퀴즈 3문항은 `#/skill-map` 한 입구. 주간 카드·연습장 채점 뒤에 퀴즈로 이어짐. 레지스트리에서 메뉴를 지우거나 파일을 `_archive`로 옮기지 않음(중복 화면이 없었음).
- **CP01~CP10 → 16칸 짝**(`data/skill_map/cp_map.json`):
  - CP01 지출 1사이클 → cause, budget
  - CP02 견적·원인행위 → cause, purchase
  - CP03 공문 꼴 → official
  - CP04 카드·증빙 → cause (16칸에 카드 전용 칸 없음)
  - CP05 재원·과목 분리 → budget
  - CP06 재료(글로컬) → glocal, purchase
  - CP07 특강 → pay
  - CP08 기자재 → purchase
  - CP09 예산·정산·마감 → budget, schedule
  - CP10 일정·보고 → schedule, meeting
  - 기존 10에 없는 16칸: regs, records, haksa, dorm, civil, coop, ato, excel
- 주간 카드는 사다리와 같은 CP만 보여 줌. 퀴즈 문항은 16칸 id라 나중에 고치기 쉽다.
- **문서봇 내용검수**(79 pass · 5 fix · 0 drop): purchase-03 해설 재정경제부장관, cause-06 src 1-7 계산증명(`src_private.md` 같은 줄), meeting-01 정답에 법률 문구「출석한 위원과 교직원의 성명 및 표결수 등」, 해설은 제9조제1항 확정문, glocal-04·dorm-01 해설(및 glocal-04 정답)을 원문 요지에 맞춤. 겹침 4쌍은 한쪽만 다시 씀(regs-03, records-02, records-04, records-05). 보기 순서는 `shuffleChoices`로 렌더 때 섞음. 오답 길이를 정답의 45% 이상(정답 20자 이상)으로 맞춤.
- **대비(춘식이3 HIGH)**: 전역 `textarea{background-color:#F2F4F6 !important}`에 밀려 `#sm-text`가 `#EAF6FF` on `#F2F4F6`(1.00:1)였음. 입력 배경 `#05121A`·글자 `#EAF6FF`를 `!important`로 고정. 계산 스타일 실측 **17.26:1**. `#sm` 안 입력·글자 64개 모두 4.5:1 이상(`tests/test_skill_map_contrast.py`).
- **길이 추측 보완**(春食이): 앞선 맞춤은 오답을 정답 길이 이하로만 늘려, 정답이 유일하게 가장 긴 문항이 67/84(동률 포함 75)였음. 정답·해설·출처는 그대로 두고(meeting-01 해설만 예외), 같은 출처 문서의 다른 조·절차명·가까운 금액·기관·기한으로 오답을 늘림. 발명한 사실을 참으로 적지 않음. **이전** 유일하게 가장 김 67 · 동률 포함 75 · 아님 9, 최단오답/정답 최소 0.29·1사분위 0.57·중앙 0.65·3사분위 0.75·최대 2.25. **이후** 유일하게 가장 김 **0/84** · 동률 포함 **0** · 아님 84, 최단오답/정답 최소 0.60·1사분위 1.12·중앙 1.32·3사분위 1.84·최대 6.00(정답 문구를 못 바꾸는 짧은 문항). 출처 용어 없이 늘릴 수 없었던 문항은 없음. 시험이 36%(84문항이면 30개) 상한을 고정.
- **meeting-01**(문서봇, 회계법 제9조① 확인): 해설을 정확히 「제9조제1항은 회의록에 일시·안건·의사·출석한 위원과 교직원의 성명·표결수 등을 적도록 한다.」로 바꿈. 정답 끝은 「성명 및 표결수 등」(이미 있음). 보기 3의 ‘만’ 중복(「생략)만으로」)을 고침. 새 해설의 「성명·표결수」는 `pii_check --target github` NAME_LABEL에 걸리지 않음(허용 목록을 넣지 않음).
- **미리보기 `public-pack.json` 누락**: slim 제외 규칙이 루트 공개 자료를 `data` 나머지와 같이 빼 버려, preview에서 `/public-pack.json`이 404였다(live는 200, 저장소에도 있음). 그래서 연습 제출·주간/일자 카드의 퀴즈 링크를 끝까지 따라갈 수 없었다. live에 이미 공개된 `public-pack.json`만 slim에 넣었고 `dorm.json`은 그대로 제외. 배포 뒤 브라우저 UA로 curl: `/public-pack.json` **200**(303695바이트, 저장소와 같음, study_days 24·tasks 16), `/#/skill-map`(서버는 `/`) **200**.
- **길이 순위 재조정**: 오답을 모두 정답보다 길게 늘린 뒤 정답이 유일하게 가장 짧은 문항이 77/84, 길이 순위 칸(정답보다 긴 오답 수 0·1·2·3)이 [0, 1, 6, 77]이었다. 오답 일부를 다시 정답보다 짧게 되돌렸고(정답·해설·출처는 그대로, meeting-01 해설 유지), 정답 문구는 바꾸지 않음. **이후** 칸 **[21, 21, 21, 21]**(각 12–32), 유일하게 가장 김 **21/84**, 유일하게 가장 짧음 **21/84**. 최단오답/정답 최소 0.29·1사분위 0.60·중앙 0.68·3사분위 1.00·최대 2.90(정답 20자 미만은 0.45 비 적용). 시험은 가장 긴·가장 짧은 쪽을 각각 36%(84문항이면 30개) 이하, 칸은 12–32로 고정. 미리보기 slim에 `public-pack.json`을 유지했고, 재배포 뒤 브라우저 UA curl `/public-pack.json` **200**, `/#/skill-map` **200**.
- **오답 문장 틀 다듬기**(문서봇 선택 사항, 검수 54 통과·이중정답 0·지어낸 조항 0): 정답 문구를 옮긴 뒤 「~하지 않는다」로만 끊던 오답을, 같은 출처의 다른 주어·조건·기관·기한·금액이나 절 순서로 다시 썼다. purchase-04 보기 2의 꼬인 문장(「생략하고 … 경우에만 생략하지 않는다」)을 고쳤고, meeting-01 보기 2·4와 ato-05 보기 3·4의 「다른 절차는 필요하지 않다」 꼬리를 걷었다. 정답·해설·출처는 그대로. 「하지 않는다/않다」로 끝나는 오답 **145/252 → 0/252**. 길이 순위 칸은 **[21, 21, 21, 21]** 유지(유일하게 가장 김 21, 가장 짧음 21). 시험이 오답의 25% 상한을 고정. 미리보기 slim에 `public-pack.json`을 유지했고, 재배포 뒤 브라우저 UA curl `/public-pack.json` **200**, `/#/skill-map` **200**.
- 시험: node skill_map+office_guide **19/19**(길이 양측 상한·순위 칸·「하지 않는다」 25% 시험 포함), python skill_map+office_guide+nav+intranet_home+llms 및 대비 시험 OK, CACHE 고정 46 OK. pii 변경 파일 rc0.
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
- 시험: `node --test tests/skill_map_core.test.js tests/office_guide_core.test.js` 19/19, `python3 -m unittest tests.test_skill_map tests.test_office_guide tests.test_nav tests.test_intranet_home tests.test_llms tests.test_skill_map_contrast` OK, CACHE 고정(chat·docreg_cal·collab_board) 46 OK.
- 개인정보: 이번 변경 파일 `pii_check --target github` rc0. (`index.html` Pretendard `@v1.3.9` 이메일 오탐은 main에도 있음, 이번 변경 아님.)
- **main 머지·live(GitHub Pages) 안 함.** PR은 draft로만 열어 둠.

## 다음

1. 검수(갈래 묶음, 문제 근거, 390·1280 화면, 미리보기).
2. squash·rebase·live 여부는 다음 판단. 지금은 올리지 않음.
3. 엑셀 공식·시트 조작처럼 규정에 없는 내용은 넣지 않음. 엑셀·데이터 칸의 5문항은 학적·출석 자료 보관과 개인정보 안전조치·파기다.
4. 미리보기 워커는 앱 껍데기+JS/CSS/icons/public + `data/skill_map` + `data/competency_map_v02.json` + 루트 `public-pack.json`. data 나머지·3d·dorm.json 제외. `public-pack.json`은 live에도 있는 공개 자료라 빼지 않는다.

## 막힘

- 없음.

## 근거

- 대장 0949, 유진님「ㅇㅇ 앱에 만들어」
- 법령은 korean-law 도구로 2026-11-16(Asia/Seoul) 현행 조문을 읽음. 학교 규정은 `/home/box/obsidian_vault/봇공유/20 규정·지침`과 박스 전환본(`/workspace/md_전환`, `/workspace/regs/articles`)을 읽음.
- live 앱(올리지 않음): https://yujin0049.github.io/hj-app/
- PR: https://github.com/yujin0049/hj-app/pull/79
