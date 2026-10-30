// 첫 관리자 열쇠 만들기(상자에서 한 번): node worker/bootstrap_admin.mjs <저장할 파일> [기한 ISO]
// 원래 열쇠는 그 파일(권한 600)에만 쓰고, 화면에는 D1 에 넣을 SQL(해시만)을 찍음. 열쇠를 저장소에 넣지 말 것.
import { webcrypto as crypto } from 'node:crypto';
import fs from 'node:fs';
const file = process.argv[2], exp = process.argv[3] || '2026-12-31T23:59:59.999+09:00';
if (!file) { console.error('파일 경로'); process.exit(2); }
const b = crypto.getRandomValues(new Uint8Array(32));
const t = Buffer.from(b).toString('base64url');
const h = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))).toString('hex');
fs.writeFileSync(file, t + '\n', { mode: 0o600 });
console.log(`INSERT INTO tokens (hash, role, prof_id, label, expires_at, created_at) VALUES ('${h}', 'admin', NULL, '관리자', '${new Date(Date.parse(exp)).toISOString()}', '${new Date().toISOString()}');`);
