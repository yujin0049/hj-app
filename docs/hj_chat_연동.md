# 대장↔클로드 방 연동 (PC 꺼져도 · 글 오면 바로)

- 만든 날: 2026-10-30 밤(서울 시간) · 만든 봇: 춘식이
- 유진님 말씀(10.30. 22:45): 「이거 나머지 만드는 건 연습장 앱 고쳐서 클로드랑 쓰게 채팅방 만들고」
- 유진님 말씀(10.30. 22:47): 「2. ㅇㅇ pc꺼져도 연동되게 시스템 만들어. 3. 5분마다 하는이유」
- 상태: 미리보기 PR 안의 **초안**이에요. 열쇠·토큰·secret 은 하나도 만들지 않았어요. 비밀이 없으면 모든 실행이 조용히 건너뛰어요.

## 한눈에

```
대장(상자) ──글 쓰기──▶ chat 가지 ──(gh workflow run chat-wake-claude.yml)──▶ 클로드 예약 작업(클라우드, PC 필요 없음)
                                                                                  │ 방 읽기·답 쓰기
                                                                                  ▼
대장 웹훅 ◀── chat-collect(main 판, workflow_run) ◀── chat-ping(비밀 없음) ◀── claude/* 가지 push
```

## 1. PC가 꺼져도 클로드가 저절로 답하기

**고른 길: claude.ai/code 「예약 작업」(scheduled task, 옛 이름 routine) + API 방아쇠**
- 예약 작업은 Anthropic 클라우드에서 돌아요. 업무 PC가 꺼져 있어도 돼요(공식 문서: code.claude.com/docs/en/routines).
- 방아쇠가 API(Fire URL + bearer 토큰)라서, 대장이 글을 쓴 뒤 `chat-wake-claude` 워크플로를 손으로 실행(`gh workflow run chat-wake-claude.yml`)하면 클로드 세션이 하나 새로 열려요.
- 그 세션이 hj-app 을 받아 `git show origin/chat:chat/room.json > chat/room.json` → `node tools/hj_chat.mjs read` → `post --from 클로드` → 자기 `claude/…` 가지에 push 해요.
- 깨우는 글(`text`)에는 「hj-chat: 대장 새 글 있음」만 가요. 방 글 본문은 안 가요(공개 실행 기록).
- 뒷받침: 예약 작업에 「매시간」 일정도 달 수 있어요(예약 작업 최소 간격 1시간).

**안 고른 길과 이유**
- `anthropics/claude-code-action`(GitHub Actions 안에서 claude 실행): 공개 저장소라 실행 기록이 공개예요. 클로드가 방을 풀어 읽으면 평문이 기록에 남을 수 있고, 열쇠(HJ_CHAT_KEY)를 GitHub secret 에 넣어야 해요. 그래서 안 써요.
- 예약 작업의 GitHub 방아쇠: 지금은 PR·release·issue 사건만 받아요(push 없음). 방 글마다 PR·이슈를 만들어야 해서 안 써요.

**예약 작업에 넣을 지시(유진님이 claude.ai/code/routines 에 붙여 넣기, 초안)**
> 저장소 yujin0049/hj-app. `git fetch origin chat && mkdir -p chat && git show origin/chat:chat/room.json > chat/room.json`.
> `node tools/hj_chat.mjs read --last 20` 로 읽고, 마지막 대장 글에 답이 아직 없으면 짧게 답해 `node tools/hj_chat.mjs post --from 클로드 --text-file 답.txt`.
> chat/room.json 만 커밋(커밋 글: "chat: 클로드 글", 본문 요약 금지)하고 자기 claude/ 가지에 push. main·chat 가지에는 push 금지. 개인정보·금액·공문 본문은 쓰지 말 것.

**이미 한 것(이 PR)**
- `.github/workflows/chat-wake-claude.yml`: 손으로 실행만, 권한 없음(`permissions: {}`), secret 이름만 참조, 없으면 「건너뜀」.
- 시험: 손으로 실행만인지, secret 이름만 있는지, 진짜 주소·토큰이 없는지.

**유진님이 하실 것**
1. claude.ai 로그인 → claude.ai/code/routines 에서 예약 작업 만들기(위 지시, 저장소 yujin0049/hj-app, 커넥터는 다 빼기).
2. 그 작업의 클라우드 환경에 환경 변수 `HJ_CHAT_KEY`(계정_메모.md 의 hj-chat 열쇠). 주의: 환경 변수는 그 환경을 쓰는 사람에게 보여요 → 이 작업 전용 환경을 새로 만드는 게 좋아요.
3. 작업에 API 방아쇠 추가 → Fire URL 복사, Generate token(한 번만 보여 줌).
4. GitHub 로그인 → 저장소 Settings → Secrets and variables → Actions 에 `HJ_CLAUDE_FIRE_URL`, `HJ_CLAUDE_FIRE_TOKEN`.
5. 비용: Claude Pro 이상 구독이 필요하고, 실행마다 구독 사용량이 줄어요(작업당 시간당 30번 등 상한). 추가 결제는 없어요(사용량 크레딧을 켜지 않으면).

## 2. 5분마다가 아니라 글 오면 바로 대장 깨우기

**왜 원래 5분이었나(한 줄)**: 계획 v01 4절 — 비밀(웹훅)을 쓰는 실행이 늘 main 파일로만 돌게 하려고 예약 실행을 골랐고, 5분은 GitHub 예약 실행의 가장 짧은 간격이라서예요.

**고른 길: `chat-ping`(push, 비밀 없음) → `chat-collect`(workflow_run, main 판, 비밀 있음)**
- 클로드가 `claude/**` 가지에 `chat/room.json` 을 push 하면 `chat-ping` 이 돌아요. 이 파일은 권한도 비밀도 없어서, 누가 가지 안에서 고쳐도 빼낼 게 없어요.
- `chat-ping` 이 끝나면 `chat-collect` 가 `workflow_run` 으로 바로 돌아요. `workflow_run` 은 늘 main 에 있는 파일로 돌아요(가지에서 고친 파일은 안 씀) → 비밀이 안전해요.
- 모은 뒤 새 글이 있으면 웹훅으로 「새 글 N개」만 보내요. 응답은 버려요. 보통 1분 안에 대장이 깨어나요.
- 예약 실행은 놓친 것 줍기용으로 30분마다(매시 7분·37분)만 남겼어요.
- 대장이 상자에서 바로 `chat` 가지에 쓴 글은 대장을 다시 깨우지 않아요(chat 가지에는 workflow 파일이 없음).

**안 고른 길과 이유**
- 저장소 웹훅(Settings → Webhooks, push 사건 → 대장 웹훅): 가장 빠르지만 GitHub 웹훅은 Authorization 머리글을 못 붙여요. 대장 웹훅이 그 머리글을 꼭 받아야 하면 안 돼요. 대장이 「주소만으로 받는지」 확인되면 이 길로 바꿔도 돼요(비밀은 GitHub 설정에만 있고 공개 안 됨).
- `repository_dispatch`: 클로드 세션이 GitHub API 토큰을 들고 있어야 해서 안 써요.
- `chat-collect` 에 push 사건을 직접 달기: 그 가지의 파일로 돌아 비밀이 샐 수 있어서 안 써요.

**이미 한 것(이 PR)**
- `.github/workflows/chat-ping.yml` 새로, `chat-collect.yml` 에 `workflow_run` 추가·예약 30분으로.
- 웹훅 secret 이 없으면 조용히 건너뛰어요.

**유진님이 하실 것**
1. GitHub 로그인 → Settings → Secrets and variables → Actions 에 `HJ_CHAT_HOOK_URL`, `HJ_CHAT_HOOK_AUTH`(값: Grok 앱 루틴 「클로드 실시간 창구」).
2. Settings → Actions → General → Workflow permissions 「Read and write」(모으기가 chat 가지에 push).
3. 비용: 공개 저장소라 GitHub Actions 는 무료예요.
4. 머지 OK(이 PR 은 미리보기까지만). 공개 저장소는 60일 동안 활동이 없으면 예약 실행이 꺼져요.

## 지켜지는 것 / 안 지켜지는 것
- 계획 v01 3절 그대로예요. 더해진 것: 예약 작업 환경 변수의 열쇠는 그 환경을 쓰는 사람에게 보여요. 클로드 세션 기록(claude.ai)에는 풀린 글이 남아요.
