-- 출석부 서버(D1) 표. 학생·교수 이름과 시간표는 여기에만(저장소·사이트에는 없음).
-- 적용(처음 한 번): npx wrangler d1 execute hj-attend --remote --file=schema.sql
-- 동시 접속: 학생 한 명 × 회차 = marks 한 줄. 화면은 그 한 줄만 고침(UPSERT). 명단 전체를 덮어쓰지 않음.
-- 출석 체크는 모두 학생 id(바뀌지 않는 번호)로 붙음. 명단 순서를 바꿔 다시 넣어도 체크가 다른 학생에게 옮겨 가지 않음.
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  no INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS profs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
-- 회차 = 날짜 + 교시 범위(같은 과목·교수가 이어지는 칸). 시간 = 교시 수.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  p_from INTEGER NOT NULL,
  p_to INTEGER NOT NULL,
  hours INTEGER NOT NULL,
  subject TEXT NOT NULL,
  prof_id INTEGER REFERENCES profs (id),
  unlocked INTEGER NOT NULL DEFAULT 0
);
-- 링크 열쇠: 원래 값은 저장하지 않고 SHA-256 만. 교수님마다 하나, 관리자 하나. 기한 지나면 막힘.
CREATE TABLE IF NOT EXISTS tokens (
  hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('prof', 'admin')),
  prof_id INTEGER REFERENCES profs (id),
  label TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS marks (
  session TEXT NOT NULL REFERENCES sessions (id),
  student_id INTEGER NOT NULL REFERENCES students (id),
  status TEXT NOT NULL DEFAULT '' CHECK (status IN ('', 'o', 'l', 'x')),
  ver INTEGER NOT NULL DEFAULT 1,
  who TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (session, student_id)
);
-- 고친 기록: 덧붙이기만. 고치기·지우기는 아래 트리거가 막음. 같은 학생을 두 사람이 동시에 고쳐도 두 줄 다 남음.
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session TEXT NOT NULL,
  student_id INTEGER,           -- NULL = 회차 잠금 풀기·잠그기
  field TEXT NOT NULL,          -- 'mark' | 'unlock'
  old TEXT,
  new TEXT NOT NULL,
  who TEXT NOT NULL,
  at TEXT NOT NULL,
  base_ver INTEGER,             -- 화면이 보고 있던 버전
  prev_ver INTEGER              -- 실제로 덮어쓴 버전(다르면 다른 사람이 먼저 바꾼 것)
);
CREATE INDEX IF NOT EXISTS history_session ON history (session, id);
CREATE TRIGGER IF NOT EXISTS history_no_update BEFORE UPDATE ON history BEGIN SELECT RAISE(ABORT, 'history is append-only'); END;
CREATE TRIGGER IF NOT EXISTS history_no_delete BEFORE DELETE ON history BEGIN SELECT RAISE(ABORT, 'history is append-only'); END;
