# kb-reviewer (261101)

hj-attend / hj-app PR 의 **더한 줄**을 봇교훈 규칙 6개와 맞춰 보고, 어긴 줄마다 「규칙 한 줄 + 근거 노트 파일 이름」을 단 댓글 하나를 만들어요.
main 과 내용이 같은 파일과 이 폴더(tools/kb_reviewer/) 자체는 건너뛰어요.
승인·변경요청·머지는 하지 않아요(코드에 GitHub 호출 자체가 없어요. 올리기는 별도 한 단계).

## 0) Agent SDK 를 안 쓴 이유 (11.01. 확인, 문서·npm 만 봄)
- `npm view @cursor/agent-sdk` → E404. 문서(https://cursor.com/docs/agent-sdk.md)의 설치 이름은 `@grok/agent-sdk` 0.5.0 (예전 `@cursor/bdk`), 설치 3단계가 `agent-sdk login`(브라우저 로그인).
- CLI 문서(https://cursor.com/docs/agent-sdk/reference/cli.md, Environment variables): 「The CLI tries `--api-key`, `CURSOR_API_KEY`, `CURSOR_API_KEY_FILE`, `CURSOR_SERVICE_ACCOUNT_KEY`, then the stored `agent-sdk login` credential」.
- Evals 문서: 「Model turns need a Cursor credential」, CI 예시 「CURSOR_API_KEY comes from the CI secret store」.
- Deployment 문서: `agent-sdk login` → `agent-sdk deploy`(Cursor 관리 호스팅), 자체 호스팅도 `CURSOR_API_KEY`. Privacy Mode(Legacy) 면 deploy·hosted session·eval 거부.
- `@cursor/sdk` 1.2.0 문서: 「Set `CURSOR_API_KEY` (or pass `apiKey`) before creating an agent」.
- 결론: 모델 한 턴부터 Cursor 키 또는 로그인이 필요 → 새 키/로그인(유보 항목)이라 SDK 길은 멈춤. 요금제는 읽은 문서에 명시 없음(모델 사용은 Cursor 계정 사용량).
- 대신 같은 구조(프롬프트 .md · 규칙 .ts · evals)로 키 없는 규칙 기반 리뷰어를 만듦.

## 구조
- `prompts/review_policy.md` 방침(모델을 붙일 때 그대로 쓸 프롬프트) · `prompts/comment_template.md` 댓글 틀
- `rules/r1..r6_*.ts` 규칙 6개 · `rules/notes.ts` 규칙마다 **우리 말 한 줄 + 노트 파일 이름**만(교훈 문장·볼트 경로 없음 → CI 에서 노트 없이 똑같이 돎)
- `src/diff.ts` unified diff 해석 · `src/review.ts` CLI · `src/quote.ts` 근거 문구
- `evals/` PR#17–21 diff 를 로컬 git 에서 다시 뽑아 재생(`evals/replay.json`, 파일로 저장 안 함) + 합성 10건, `npm run eval` → `evals/results.md` · 설명 `evals/notes_261101.md`
- CI: 저장소의 `.github/workflows/kb-review.yml` — pull_request 때 GITHUB_TOKEN 만(contents: read · pull-requests: write), 합성 eval → 리뷰 → 댓글 1개(표시 `<!-- kb-reviewer -->` 로 같은 댓글을 고쳐 씀). 승인·변경요청·머지 없음.

| 규칙 | 근거 노트(파일 이름) |
|---|---|
| R1 먼저 백업·영구 삭제 대신 보관 | 261101_엘리트블로그_교훈.md · 261029_정리_노션.md |
| R2 확장→배포→정리 | 261101_엘리트블로그_교훈.md |
| R3 전후 행 수 비교 | 261101_엘리트블로그_교훈.md |
| R4 재실행 안전 | 261101_엘리트블로그_교훈.md |
| R5 개인정보·키 없음 | 261027_이종에이전트_보드_세션교체.md · 261030_춘식이_클로드Code_다시쓰기.md |
| R6 실 D1 은 유진님 OK | 261101_엘리트블로그_교훈.md |

## 돌리기 (node 22, 설치 없음)
```bash
cd tools/kb_reviewer   # node 22 이상, 설치 없음
export KB_NAMES_FILE=<실명 목록 파일 경로>  # 선택. 이름은 출력하지 않고 개수만
npm run -s review -- --git <repo> <base> <head> --main <main ref> --out out/f.json --comment out/c.md
KB_REPO=<hj-attend 로컬 clone> npm run -s eval   # 네트워크·댓글 없음 · KB_REPO 없으면 합성만
```
손으로 올릴 때는 댓글 본문을 pii_check(--target github) 종료 0 확인 뒤에.

## 한계
- 줄 단위 정규식이라 여러 줄에 걸친 SQL 문장은 첫 줄 기준으로 봐요. 코드(JS) 쪽 D1 쓰기 흐름은 안 봐요.
- eval 은 같은 사람이 규칙과 기대값을 만든 표본 안 평가예요. 첫 실행에서 나온 오탐 1건(0012 트리거 본문을 R3 로 잡음)은 트리거 본문을 빼도록 고쳤어요.
