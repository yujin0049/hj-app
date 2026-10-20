# 출석부·서명부 테스트

- `fake_*.xlsx / .xls / .csv` 는 **가짜 명단**이에요(홍길동1~25, 2026xxxx, 010-0000-0000). 진짜 명단은 넣지 마세요.
- `fake_ojnt_roster_20.xlsx` 는 유진님 OJNT 명단과 같은 칸 순서(2행이 제목 줄, 생년월일·이메일·전화번호 포함)예요. 개인정보 칸이 화면·엑셀에 안 나오는지 봐요.
- 실행: 저장소 폴더에서 `python3 -m http.server 8765` 를 켜고 `python tests/attend/test_attend.py http://127.0.0.1:8765/` (Playwright + openpyxl 필요).
  390px·1280px 화면, 서식 7개, PDF(인쇄 CSS), 엑셀 줄 수·인쇄 설정을 확인해요.
