# 계획 달력 · 현황표 — ToDo (feat/calendar)

시안: `docs/calendar/mock.html` (가짜 자료, 390px 캡처는 박스 /workspace/hj_audit/shots_calendar/mock_390.png)

- [x] Concept.md (화면·정본·갱신·접근·개인정보)
- [x] 시안(mock.html)
- [x] tools/make_calendar.py — 현황판 '업무' 덤프 + data/calendar_extra.json → data/calendar.json, data/status.json (이름 지우기, 합치기, 날짜 다름 = 확인 필요)
- [x] tools/make_ojnt_progress.py — OJNT 덤프 → data/ojnt_progress.json (숫자·비율만)
- [x] tools/pii_check.py — data/*.json 등 모든 출력 검사, 걸리면 종료 2
- [x] tools/refresh_all.py — 위 셋 + data/meta.json(마지막 갱신·성공 여부) + 미리보기 워커 파일
- [x] js/calendar-core.js — 날짜 계산(KST 오늘, D-day, D-3, 지연, 주 경계) 브라우저·node 같이 씀
- [x] js/modules/calendar.js — 월·주 보기, 레인 2개, 다가오는 일정, 거르기, 경고 띠, 모든 화면 갱신 표시
- [x] js/modules/status.js — 현황표, 유진님 칸 고정, OJNT 진행률
- [x] 더보기 메뉴 2줄, registry
- [x] 시험: tests/test_make_calendar.py(가짜 fixture), tests/calendar_core.test.js(날짜), pii_check, e2e(390·1280)
- [ ] 미리보기 hj-pv-calendar 배포(Cloudflare 커넥터) — 시도 결과는 보고 참고. main 병합은 유진님 OK 뒤
- [x] 일정총괄.json(대장) 자동 읽기·충돌 표시, 통합일정/통합할일(ingest) 읽기 + fixture 시험
- [x] 사람 칸은 잠긴 API에서(없으면 「잠금 확인 후 표시」), sw.js 는 /api/ 저장 안 함
- [ ] 잠긴 API 명세(/workspace/hj_audit/lock/API.md) 나오면 api/people 주소·응답 모양 맞추기
- [ ] 「교수님 일정」 캘린더 생기면 통합일정으로 들어오는지 확인
