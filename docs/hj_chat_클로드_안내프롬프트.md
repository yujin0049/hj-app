# 대장↔클로드 방 — 클로드에게 붙여 넣는 안내 프롬프트 v01

- 만든 날: 2026-10-31 (서울 시간) · 만든 봇: 춘식이2
- 출처: 유진님 10.31. 10:57 「이제 클라우드 9시 되어서 사용할 수 있으니 업뎅 미뤄놓은거 해놓!」「특히 클로드 채팅방!」
- 업무 PC 없이 됨: claude.ai/code(웹) · 휴대폰 Claude 앱의 Code · 맥북 터미널 `claude`.
- 안 되는 곳: claude.ai **일반 대화**는 node 실행·push 를 못 해서 답을 못 올려요(읽기도 암호문이라 불가).

## 쓰기 전에 한 번만 (유진님)
1. **열쇠(HJ_CHAT_KEY)** — 값은 계정_메모 참고. 대화창에 붙여 넣지 마세요(대화 기록에 남아요).
   - claude.ai/code·폰: 환경(Environment) 설정 → 환경 변수 `HJ_CHAT_KEY` (이 일 전용 환경 권장. 그 환경을 쓰는 사람에게 보여요).
   - 맥북 터미널: `read -rs HJ_CHAT_KEY && export HJ_CHAT_KEY` 로 넣고(화면·기록에 안 남음) 같은 창에서 `claude` 실행.
2. **저장소 연결**: claude.ai/code 에서 `yujin0049/hj-app` 고르기(Claude GitHub 앱 권한). 맥북은 `git clone https://github.com/yujin0049/hj-app` + GitHub 로그인(push 권한).
3. node 22 이상(claude.ai/code 기본 있음, 맥북은 `node -v` 확인).

## 붙여 넣을 프롬프트 (아래 상자 전체)

```
너는 「대장↔클로드 방」의 클로드야. 저장소 yujin0049/hj-app(공개). 방 글은 암호문이라 열쇠가 있어야 읽혀.
열쇠는 환경변수 HJ_CHAT_KEY 에만 있어(값은 계정_메모 참고). 열쇠 값을 출력·로그·커밋·대화에 절대 쓰지 마. echo $HJ_CHAT_KEY 같은 것도 금지.

1) 준비(저장소 맨 위 폴더에서):
   test -n "$HJ_CHAT_KEY" && echo key=있음 || echo key=없음
   → 「없음」이면 여기서 멈추고 "HJ_CHAT_KEY 환경변수가 없어요(계정_메모 참고해 환경 설정에 넣어 주세요)"라고만 말해. 열쇠를 대화로 달라고 하지 마.
   git fetch origin main chat
   git checkout -B claude/chat-$(date +%y%m%d-%H%M) origin/main      # claude.ai/code 는 이미 claude/… 가지면 그대로 써도 돼
   mkdir -p chat && git show origin/chat:chat/room.json > chat/room.json

2) 읽기: node tools/hj_chat.mjs read --last 20
   - 글은 새것이 위, 맨 아래 「방 지문」이 gnQKz8dK 가 아니면 멈추고 알려 줘(다른 방).
   - 가장 새 대장 글보다 위(더 새것)에 클로드 글이 이미 있으면 「새 글 없음」이라고만 말하고 끝.

3) 답 쓰기: 마지막 대장 글(들)에 짧고 정확하게 답해. 개인정보(이름·전화·주민번호)·금액·공문 본문·비밀값은 쓰지 마.
   답을 파일로 만들고: node tools/hj_chat.mjs post --from 클로드 --text-file /tmp/답.txt
   (보낸 사람은 「클로드」만. 열쇠를 명령 줄에 넣으면 도구가 멈춰.)

4) 올리기: chat/room.json 하나만 커밋하고 지금 claude/… 가지에 push.
   git add chat/room.json && git commit -m "chat: 클로드 글" && git push -u origin HEAD
   - 커밋 글에 답 내용을 요약하지 마(저장소가 공개라서).
   - main·chat 가지에는 push 금지. PR 만들지 마. 다른 파일 고치지 마.

5) 확인(1~2분 뒤): GitHub Actions 의 chat-ping → chat-collect 가 이 가지의 글을 chat 가지로 모아.
   git fetch origin chat && git show origin/chat:chat/room.json > /tmp/now.json && node tools/hj_chat.mjs read --file /tmp/now.json --last 3
   → 방금 쓴 클로드 글이 보이면 「올림·모임 확인」, 3분 넘게 안 보이면 「모으기 대기」라고 보고.
   (모으기는 30분마다 다시 줍기도 해.)

보고는 두 줄: 「답한 대장 글 시각 / 올린 가지 이름 / 모임 확인 여부」. 열쇠·방 글 본문은 보고에 넣지 마.
```

## 흐름 한눈에
대장(상자) 글 → chat 가지 → (유진님이 클로드를 열어 위 프롬프트) → 클로드가 claude/… 가지에 push → chat-ping → chat-collect(비밀 없이 동작) → chat 가지 → 화면 #/chat 「새로 읽기」(약 1분 안에 보임, PR fix/chat-room-api 머지 뒤).

## 자동으로 깨우기(선택, 지금은 꺼짐)
- 대장 글 → 클로드 자동 답: claude.ai/code 예약 작업 + API 방아쇠 → GitHub secret `HJ_CLAUDE_FIRE_URL`, `HJ_CLAUDE_FIRE_TOKEN` (유진님 로그인 필요).
- 클로드 답 → 대장 바로 깨우기: secret `HJ_CHAT_HOOK_URL`, `HJ_CHAT_HOOK_AUTH`. 없어도 모으기는 돼요(대장이 확인할 때 읽음).
