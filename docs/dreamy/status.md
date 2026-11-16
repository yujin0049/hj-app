# dreamy 인수인계 — status

구독 종료(2026-11-16) 대비. 이 문서만 읽고 이어서 할 수 있게 적는다.

## 지금

- 참고 사이트 분석 끝. 표는 `docs/dreamy/ref_analysis.md`.
- 한 장짜리 정적 가이드(화면 1, 쪽 10, 동작은 목차·인쇄·주소 복사). 로그인·서버 없음.
- 작업 위치: `/workspace/hjapp_dreamy_261116/repo` (origin/main `9f9cf1a` 에서 새 클론). 브랜치 `feature/dreamy-ref-261116`.
- `/workspace/hj-app-inventory` 는 만지지 않음.
- 코드 1차(화면 `#/office-guide`)는 이 커밋 다음에 이어서 넣는다.

## 다음

1. `#/office-guide` 1차: 10쪽 안내 + 목차 + 인쇄 + 주소 복사 + 체크리스트(이 기기만). 브랜드 C(`#4CC3FF`, Hahmlet).
2. 인트라넷 메뉴·더보기에서 열리게. 레지스트리·CACHE·시험.
3. `pii_check --target github` rc0 뒤 브랜치 push. **main 머지·live(GitHub Pages) 금지.**
4. live가 아닌 미리보기 주소: 기존처럼 박스의 `build_preview.py` → Cloudflare Worker(이름 예: `hj-pv-dreamy-261116`). `dorm.json` 은 새 주소로 퍼뜨리지 않음.
5. 홈 첫 화면 타일은 1차 범위 밖(메뉴·더보기로 충분). 교수·학생용 다른 화면 없음.

## 막힘

- 없음(분석 단계). 로그인·결제·새 secret 이 필요해지면 그 지점에서 멈춘다.
- 미리보기는 Cloudflare execute 가 통할 때만 연다. 새 로그인·secret 이 필요하면 주소 없이 보고한다.

## 근거

- 유진님 11.9 「출석앱 끝나면 이거 해」
- 대장 261116 착수 OK
- 춘식이 배분 261116: repo `yujin0049/hj-app`, 브랜치 `feature/dreamy-ref-261116`, 작은 커밋·매일 push, `docs/dreamy/status.md` 유지, 브랜드 C, 예시데이터·실명 금지, 없으면 「데이터 없음」, main 머지·live 반영 금지
- 참고: https://dreamy-semolina-6aea11.netlify.app/
- live 앱: https://yujin0049.github.io/hj-app/ (이 브랜치에서 올리지 않음)
- 미리보기 관례: `/workspace/hj_audit/preview/build_preview.py` 로 워커 파일을 만들고 Cloudflare 커넥터 execute 로 배포. GitHub Pages 미리보기 워크플로는 없음.
