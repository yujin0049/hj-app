# 전문가검토 top5 인수인계 — status

구독 종료(2026-11-16) 대비. 이 문서만 읽고 이어서 할 수 있게 적는다.
③(역량맵)은 PR #79에서 다루며 이 브랜치에는 넣지 않았다.

## 지금

- 브랜치 `feature/expert-top5-261116` (main `75a45b4`에서). draft PR https://github.com/yujin0049/hj-app/pull/80 (합치지 않음). 작업 클론 `/workspace/hjapp_top5_261116/repo`. 다른 클론·`/workspace/hj-app-inventory`는 건드리지 않음.
- CACHE `hj-v98` (main은 hj-v96, PR #79는 hj-v97). css `?v=39`, app.js `?v=55`, registry `?v=38`, intranet-nav `?v=5`, modules `?v=51`, freshness `?v=2`.
- 미리보기(live 아님, `dorm.json`·3d 제외. 홈·현황·할일용으로 `data/status.json`·`data/todo.json`과 `public-pack.json`만 포함): https://hj-pv-top5-261116.yujin06344.workers.dev/#/home
  - 워커 version `63eaba78-5ef4-4ed7-9851-3bf1ff85fc72` **100%**, 재배포 시각 2026-11-16 10:40:43 (Asia/Seoul). 배포 id `dfb76473-a22c-4e40-abce-27147930068e`. (직전 `8088c44b`, 10:34:20.)
- 화면 갈무리(커밋하지 않음): `/workspace/hjapp_top5_261116/shots/` — home·status·todo·budget·more·work 각각 390·1280. ② 추가 후 현황·할 일·예산 390은 다시 찍음.
- **① 홈 `#/home`을 오늘 할 일 한 장으로.** 남는 것은 날짜·제목, 오래된 자료 경고, `built_at` 한 줄, 오늘 마감·미완료 최대 3개, 지난 마감 건수(현황으로 이동), 할 일 전체 단추. 바로가기·봇 작업·게시판·AI·3D 타일은 홈에서 뺐다(메뉴·더보기·`#/3d`로). 오늘 남은 일이 없으면 「오늘 남은 할 일이 없어요.」, 자료를 못 읽으면 「데이터 없음」. 시험: `tests/home_core.test.js`, `tests/test_expert_top5.py`.
- **② 현황(`#/status`)·할 일(`#/todo`)·예산(`#/more/budget`)에 「읽은 시각 / 오늘 사용 가능」 고정 줄.** 기준은 `built_at`만. 한국 날짜가 오늘이면 오늘 사용 가능, 아니면 「N일 전 자료」 경고, 없거나 못 읽으면 「데이터 없음」. 시험: `tests/freshness_core.test.js`(고정 시계 2026-11-16 10:00 KST), `tests/test_expert_top5.py`, `tests/test_make_calendar.BuiltAt`.
  - 현황: `tools/make_calendar.py`(refresh_all이 부름)가 최상위 `built_at`을 실행 시각 ISO `+09:00`으로 씀. 이번 실행 `2026-11-16T10:39:46+09:00`. 원자료는 `/workspace/hj_audit/calendar/raw_업무.json`(2026-11-11 19:14). 업무 99건은 그대로이고, T018의 11.13 하위 단계 2줄만 일정총괄→통합일정 출처로 바뀜(수업→일정 1칸). 같은 실행이 `data/calendar.json`에도 `built_at`을 남김.
  - 할 일 `data/todo.json`: 만드는 스크립트를 찾지 못함. CMS 설계는 손편집, 최근 반영은 커밋으로 json을 갈아끼움. 시각을 손으로 넣지 않아 화면은 「데이터 없음」.
  - 예산 `public-pack.json`: 만드는 스크립트를 찾지 못함(`packVersion` 2026-10-26, `built_at` 없음). 시각을 손으로 넣지 않아 화면은 「데이터 없음」.
  - `tools/refresh_all.py --no-worker --no-notices-fetch` rc0. charts·docs_important·lastwork·meta는 같이 바뀌었으나 이 범위 밖이라 커밋하지 않음(meta·lastwork는 커밋 금지).
- **④ 탭·왼쪽 메뉴·홈 바로가기 후보·더보기를 `js/registry.js`의 MENU 한 곳에서 만듦.** 이름 겹침 없음. 실무 도구(판정·문서 만들기·자료함·지출·원인행위 건현황·협조리스트·원인행위 붙임·그래프·대화방)는 실무 탭이 켜진다. 출석부는 공식 주소이고 모듈이 아니다. 3D 새/옛 전환은 `#/3d`로 옮김. `tools/make_llms.py`도 같은 MENU를 읽는다. 시험: `tests/menu_registry.test.js`, `tests/test_nav.py`, `tests/test_intranet_home.py`, `tests/test_llms.py`.
- **⑤ 390px에서 선언 글자 크기 최소 12.8px.** `--fs-min: 12.8px`, `--fs-xs: 0.8rem`, html 16px. 브랜드 C(`#4CC3FF`)·Hahmlet 유지. IBM Carbon 간격(`--sp-*`)은 그대로. 시험: `tests/test_min_font.py`.
- 시험: `node --test tests/freshness_core.test.js` 5/5, `python3 -m unittest tests.test_expert_top5 tests.test_make_calendar.BuiltAt` OK. (기존 깨진 3개는 main과 같고 이번 범위 밖.)
- 개인정보: 이번 후속 변경 파일 `pii_check --target github` rc0.
- **main 머지·live(GitHub Pages) 안 함.** PR은 draft로만 연다. 제목: 「[미리보기·합치지 말 것] 전문가검토 top5(홈·읽은시각·메뉴하나·글자)」.

## 다음

1. 검수(홈 한 장, 읽은 시각 줄, 메뉴 한 곳, 390 글자, 미리보기).
2. squash·rebase·live 여부는 다음 판단. 지금은 올리지 않음.
3. PR #79와 같이 합치면 충돌이 날 파일: `js/registry.js`, `js/app.js`, `js/intranet-nav.js`, `js/modules/more.js`, `sw.js`, `index.html`, CACHE를 고정한 시험, `llms.txt`·`ai/*`, `tools/make_llms.py`. 이 브랜치에 skill-map을 넣지 말 것. 나중에 합치는 쪽에서 CACHE를 한 단계 더 올리면 된다.
4. 할 일·예산 JSON을 만드는 스크립트가 생기면 그 스크립트에 `tools/built_at.py`를 붙여 실행 시각을 남긴다. 손으로 `built_at`을 넣지 말 것. 시트 원자료(`raw_업무.json`)는 2026-11-11이라, 현황의 `built_at`은 「이 변환을 돌린 시각」이다.

## 막힘

- 없음.

## 근거

- 대장 1005, 유진님「ㅇ」
- 춘식이 배분 261116, `/workspace/docs/261116_hj-app_전문가검토_v01.md`
- live 앱(올리지 않음): https://yujin0049.github.io/hj-app/
