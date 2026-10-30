#!/usr/bin/env node
/* 대장↔클로드 채팅방 쓰기·읽기 도구 (PC 없이도: claude.ai 웹 Claude Code · 대장 상자 · 업무 PC 어디서나 node 22+).
   열쇠는 환경변수 HJ_CHAT_KEY 로만 받아요(명령 줄·파일·로그에 안 남김). 정본: 볼트 00 홈/계정_메모.md.
   방 파일: chat 가지의 chat/room.json (main 아님 → 글을 써도 사이트가 안 바뀜). 이 도구는 git 은 안 건드려요.
   쓰는 법(열쇠는 미리 환경변수로: claude.ai/code 환경 설정, 또는 대장 상자 환경):
     node tools/hj_chat.mjs init                                  # 대장이 한 번(방 만들기)
     git fetch origin chat && git show origin/chat:chat/room.json > chat/room.json   # 최신 방 받기
     node tools/hj_chat.mjs read [--last 20]
     node tools/hj_chat.mjs post --from 클로드 --text "…"   (또는 --text-file 경로, 또는 표준입력)
   그다음:
     대장(상자): git add chat/room.json && git commit -m "chat: 대장 글" && git push origin HEAD:chat
     클로드(claude.ai/code 웹·폰): 자기 세션 가지(claude/…)에 커밋·푸시만 하면 돼요. main 의 chat-collect workflow 가
       5분마다 claude/* 가지의 chat/room.json 을 chat 가지로 모으고(열쇠 없이 번호로 합집합), 새 글이 있으면 대장 웹훅을 깨워요.
     node tools/hj_chat.mjs merge --file 기준.json --extra 다른.json   # 열쇠 필요 없음(모으기용) */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const C = createRequire(import.meta.url)(resolve(here, '../js/chat-crypto.js'));

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }
function die(msg) { console.error('멈춤: ' + msg); process.exit(2); }
function nowSeoul() {
  const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19);
  return d + '+09:00';
}
const cmd = process.argv[2];
const file = resolve(arg('file', 'chat/room.json'));
const key = process.env.HJ_CHAT_KEY || '';
if (process.argv.some(a => a === key && key)) die('열쇠를 명령 줄에 쓰지 마세요. HJ_CHAT_KEY 환경변수로만.');
if (!['init', 'post', 'read', 'merge'].includes(cmd)) die('init | post | read | merge 중 하나');
if (cmd === 'merge') {
  const ex = arg('extra', '');
  if (!ex || !existsSync(ex)) die('--extra 파일이 없어요');
  const base = load();
  let r;
  try { r = C.merge(base, JSON.parse(readFileSync(ex, 'utf8'))); } catch (e) { die(e.message); }
  if (r.added) save(r.room);
  console.log('added=' + r.added);
  process.exit(0);
}
if (!key) die('HJ_CHAT_KEY 환경변수가 없어요(열쇠는 계정_메모.md, 대장·유진님이 넣음)');

function save(room) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  writeFileSync(tmp, JSON.stringify(room, null, 1) + '\n');
  renameSync(tmp, file);
}
function load() {
  if (!existsSync(file)) die(file + ' 가 없어요. 먼저 init(대장) 또는 chat 가지로 바꾸기');
  const r = JSON.parse(readFileSync(file, 'utf8'));
  if (!C.valid(r)) die('방 파일 모양이 달라요');
  return r;
}
if (cmd === 'init') {
  if (existsSync(file)) die(file + ' 가 이미 있어요(덮어쓰지 않음)');
  save(await C.initRoom(key).catch(e => die(e.message)));
  console.log('방을 만들었어요: ' + file);
} else if (cmd === 'post') {
  const from = arg('from', '');
  let text = arg('text', null);
  const tf = arg('text-file', null);
  if (text == null && tf) text = readFileSync(tf, 'utf8');
  if (text == null && !process.stdin.isTTY) text = readFileSync(0, 'utf8');
  const room = load();
  const k = await C.unlock(key, room).catch(e => die(e.message));
  const next = await C.post(k, room, from, text, nowSeoul()).catch(e => die(e.message));
  save(next);
  const id = next.msgs.map(m => m.id).filter(x => !room.msgs.some(o => o.id === x))[0];
  console.log('썼어요: ' + id + '  다음: git add chat/room.json && git commit -m "chat: ' + from + ' 글" && git push (대장은 origin HEAD:chat)');
} else {
  const room = load();
  const k = await C.unlock(key, room).catch(e => die(e.message));
  const all = await C.readAll(k, room);
  const n = Math.max(1, +arg('last', 20) || 20);
  for (const m of all.slice(-n)) {
    if (m.bad) console.log('[' + m.id + '] (풀 수 없는 글)');
    else console.log('[' + m.id + '] ' + m.from + ' · ' + C.atText(m.at) + '\n' + m.text + '\n');
  }
  console.log('방 지문 ' + C.fingerprint(room) + ' · 글 ' + all.length + '개');
}
