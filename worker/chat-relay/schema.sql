-- hj-chat-relay-db: 암호문 글만(본문·보낸 사람·시각은 ct 안). n = 받은 순서 번호(GET /msgs?since=n).
CREATE TABLE IF NOT EXISTS msgs (n INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, iv TEXT NOT NULL, ct TEXT NOT NULL, at TEXT NOT NULL);
-- 분당 횟수 제한: IP 는 SHA-256 앞 16자로만(원래 IP 저장 안 함), 10분 지난 줄은 지움.
CREATE TABLE IF NOT EXISTS rl (ip TEXT NOT NULL, minute INTEGER NOT NULL, c INTEGER NOT NULL, PRIMARY KEY (ip, minute));
