# 전문가검토 top5 인수인계 — status

구독 종료(2026-11-16) 대비. 이 문서만 읽고 이어서 할 수 있게 적는다.
③(역량맵)은 main에 합쳐진 PR #79·#81을 이 브랜치에 `git merge origin/main`으로 들여왔다(rebase·force 없음).

## 지금

- 브랜치 `feature/expert-top5-261116`. draft PR https://github.com/yujin0049/hj-app/pull/80 (합치지 않음). 작업 클론 `/workspace/hjapp_top5_261116/repo`. 다른 클론·`/workspace/hj-app-inventory`는 건드리지 않음.
- main은 `92a53a32` (PR #81, live CACHE `hj-v98`). 이 브랜치는 CACHE `hj-v99`. css `?v=40`, app.js `?v=58`, registry `?v=39`, intranet-nav `?v=5`, modules `?v=52`, freshness `?v=3`.
- main 머지 충돌 처리: `js/app.js`·`intranet-nav.js`·`modules/more.js`·`registry.js`는 메뉴 한 곳(HJNav/MENU)을 유지하고, 역량맵을 MENU에 넣음(tabOf study, 더보기「공부·규정」, 왼쪽「그 밖」). main의 weekEngine(사다리 겹침 주 우선, `lad.cps`로 study_days 걸러 냄)은 `app.js`에 옮김. 시험·llms 훅은 새 registry 형식에 맞춤. `data/skill_map/questions.json`은 충돌 없이 main과 동일(purchase-02 보기4에서 ‘매각’ 없음). CACHE 핀은 모두 `hj-v99`.
- 미리보기(live 아님, `dorm.json`·3d 모델·`lastwork`·`meta` 제외. 홈·현황·할일용 `data/status.json`·`data/todo.json`과 `public-pack.json`, main에서 들어온 `data/skill_map` 포함): https://hj-pv-top5-261116.yujin06344.workers.dev/#/status
  - 워커 version `30636419-72aa-471d-ad42-701e5c6698b6` **100%**, 재배포 시각 2026-11-16 11:11:58 (Asia/Seoul). 배포 id `9998e3b3-adb3-4868-986a-ea2b4c414833`. (직전 `634e9f05` 10:50:58, 그 앞 `146310b8` 10:46:52.) 브라우저 UA로 `/`와 css `?v=40`, app `?v=58`, status/skill-map 모듈 `?v=52`, public-pack, status JSON, 역량맵 자료, sw.js 모두 200, CACHE `hj-v99`.
- 화면 갈무리(커밋하지 않음): `/workspace/hjapp_top5_261116/shots/` — home·status·todo·budget·more·work 각각 390·1280. 검수 수정 뒤 `#/status`·`#/skill-map` 390을 다시 찍음(`status-390.png`, `skill-map-390.png`).
- **① 홈 `#/home`을 오늘 할 일 한 장으로.** 남는 것은 날짜·제목, 오래된 자료 경고, `built_at` 한 줄, 오늘 마감·미완료 최대 3개, 지난 마감 건수(현황으로 이동), 할 일 전체 단추. 바로가기·봇 작업·게시판·AI·3D 타일은 홈에서 뺐다(메뉴·더보기·`#/3d`로). 오늘 남은 일이 없으면 「오늘 남은 할 일이 없어요.」, 자료를 못 읽으면 「데이터 없음」. 시험: `tests/home_core.test.js`, `tests/test_expert_top5.py`.
- **② 신선도는 `source_at`(원자료 시각) 기준.** 한국 날짜가 오늘이면 오늘 사용 가능, 아니면 「N일 전 자료」 경고. 두 시각이 모두 없으면 「데이터 없음」. 시험: `tests/freshness_core.test.js`(고정 시계 2026-11-16 10:00 KST: 오늘·N일 전·git 커밋 시각·없음), `tests.test_built_at`, `tests.test_make_calendar.BuiltAt`, `tests.test_expert_top5`.
  - 현황: `tools/make_calendar.py`가 `built_at`(변환 시각)과 `source_at`을 같이 씀. 원자료 `raw_업무.json`에는 파일 시각 칸이 없어, 변환 시점의 파일 mtime을 기록. 이번 값 `source_at=2026-11-11T19:14:19+09:00`, `built_at=2026-11-16T10:44:11+09:00`. 화면: 「원자료 11.11. 19:14 · 변환 10:44 / 5일 전 자료」. 업무 내용은 직전 변환과 같음. `api.pack()`이 `source_at`을 버려서 예산 줄이 안 나오던 것은 `js/app.js`의 view()에서 그대로 넘기도록 고침.
  - 할 일·예산은 생성 스크립트가 없어 `tools/built_at.py --git-source`가 내용이 바뀐 마지막 git 커밋 `%cI`를 `source_at`으로 넣음(stamp만 바꾼 커밋은 건너뜀). 할 일 `2026-11-10T15:31:53+09:00` → 「마지막 수정 11.10. 15:31 / 6일 전 자료」. 예산 `2026-10-29T20:31:51+09:00` → 「마지막 수정 10.29. 20:31 / 18일 전 자료」. 시각은 손으로 넣지 않음.
- **④ 탭·왼쪽 메뉴·홈 바로가기 후보·더보기를 `js/registry.js`의 MENU 한 곳에서 만듦.** 이름 겹침 없음. 실무 도구(판정·문서 만들기·자료함·지출·원인행위 건현황·협조리스트·원인행위 붙임·그래프·대화방)는 실무 탭이 켜진다. 출석부는 공식 주소이고 모듈이 아니다. 3D 새/옛 전환은 `#/3d`로 옮김. `tools/make_llms.py`도 같은 MENU를 읽는다. 시험: `tests/menu_registry.test.js`, `tests/test_nav.py`, `tests/test_intranet_home.py`, `tests/test_llms.py`.
- **⑤ 390px에서 선언·computed 글자 크기 최소 12.8px.** `--fs-min: 12.8px`, `--fs-xs: 0.8rem`, html 16px, `small{font-size:var(--fs-min)}`. 역량맵의 `.72/.76/.78rem`과 `.sm-kicker`는 `0.8rem`으로 맞춤. 현황 `.st-steps small` 등도 12.8px(UA `smaller`가 10.67px로 줄지 않게). 390·768·1024·1280에서 현황·역량맵 가로넘침·잘림 0, computed 최솟값 12.8px. 브랜드 C(`#4CC3FF`)·Hahmlet 유지. IBM Carbon 간격(`--sp-*`)은 그대로. 시험: `tests/test_min_font.py`.
- 시험(검수 수정 뒤 전체): `node --test tests/*.js` 122/122. python 322개 중 통과 나머지, 실패 3은 기존 main과 같은 `test_p002_schema`·`test_ot_attach_pack`·`test_worker_pii_word`. 환경 제한으로 `T화면` 5개는 headless Chrome `--dump-dom` 90초 타임아웃(이번 글자 수정과 무관, 예전에도 이 환경에서 같음). `tests/menu_registry.test.js`는 skill-map을 moduleExtra에 넣는 쪽으로 고침.
- 개인정보: 이번 변경 파일 11개 `pii_check --target github` rc0. `tests/test_built_at.py`의 이메일 형태 테스트 값은 `git-test.invalid`로 바꿈. main과 같은 오탐 15건은 이번 파일이 아님. `data/meta.json`·`data/lastwork.json`은 커밋하지 않음.
- **PR 합치기·live(GitHub Pages) 안 함.** PR은 draft로만 둔다. 제목: 「[미리보기·합치지 말 것] 전문가검토 top5(홈·읽은시각·메뉴하나·글자)」.

## 다음

1. 재검수(390 최소 글자 12.8px, menu_registry, 미리보기). 1차 검수 결함 2건은 이 커밋에서 고쳤다.
2. squash·rebase·live 여부는 다음 판단. 지금은 올리지 않음. rebase·force push 하지 말 것.
3. main(`92a53a32`, PR #81)은 이미 `git merge origin/main`으로 이 브랜치에 들어왔다. 역량맵은 MENU 한 줄로 연결됨. 다음 main이 오면 같은 방식으로 merge만 하고 CACHE를 한 단계 더 올린다.
4. 할 일·예산 JSON을 만드는 스크립트가 생기면 그 스크립트가 `source_at`을 원자료 시각으로 쓰게 한다. 지금은 `tools/built_at.py --git-source`로 마지막 내용 커밋 시각을 넣는다. 손으로 시각을 넣지 말 것. 시트 원자료(`raw_업무.json`) mtime은 2026-11-11 19:14이라 현황은 「5일 전 자료」가 맞다.

## 막힘

- 없음.

## 근거

- 대장 1005, 유진님「ㅇ」
- 춘식이 배분 261116, `/workspace/docs/261116_hj-app_전문가검토_v01.md`
- live 앱(올리지 않음): https://yujin0049.github.io/hj-app/
