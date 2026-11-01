// Small hand-made diffs for rules the real PRs never trip (R2, R5, R6 commands, R1 DELETE) plus clean negatives.
// Fake secrets are assembled at run time so this file itself holds no key-shaped string.
const j = (...p: string[]) => p.join('');
const newFile = (path: string, lines: string[]) =>
  `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines.length} @@\n` + lines.map(l => '+' + l).join('\n') + '\n';

export interface SynCase { id: string; diff: string; expect: [string, string, number][]; mustNotAny?: boolean; onMain?: string[] }

export const SYN: SynCase[] = [
  { id: 's01_contract_in_forward', diff: newFile('worker/migrations/0099_x.sql', [
      '-- 유진님 OK 뒤에만. 적용 전 백업. 전후 행 수 COUNT(*) 비교.',
      'ALTER TABLE courses DROP COLUMN warn_rate;']),
    expect: [['R2_expand_order', 'worker/migrations/0099_x.sql', 2], ['R1_backup', 'worker/migrations/0099_x.sql', 2]] },
  { id: 's02_drop_table_no_backup', diff: newFile('docs/rollback/0098_down.sql', [
      '-- 실 D1 은 유진님 OK 받고만. 행 수 전=후.',
      'DROP TABLE prof_notes;']),
    expect: [['R1_backup', 'docs/rollback/0098_down.sql', 2]] },
  { id: 's03_delete_no_backup', diff: newFile('docs/rollback/0097_down.sql', [
      '-- 유진님 OK 뒤. 행 수 전=후.',
      'DELETE FROM marks WHERE status = \'e\';']),
    expect: [['R1_backup', 'docs/rollback/0097_down.sql', 2]] },
  { id: 's04_secrets', diff: newFile('worker/src/x.js', [
      `const k = "${j('gh', 'p_', 'A'.repeat(36))}";`,
      `fetch("https://x.workers.dev/api?t=${j('abc', 'DEF', '0123456789xyz')}");`,
      `const api_key = "${j('Zq', '9'.repeat(22))}";`,
      'const ok = env.LINK_ENC_KEY; // env 이름만',
      `// 연락: ${j('010', '-', '1234', '-', '5678')}`]),
    expect: [['R5_secret_pii', 'worker/src/x.js', 1], ['R5_secret_pii', 'worker/src/x.js', 2], ['R5_secret_pii', 'worker/src/x.js', 3], ['R5_secret_pii', 'worker/src/x.js', 5]] },
  { id: 's05_live_commands', diff: newFile('docs/deploy.md', [
      'npx wrangler d1 migrations apply hj-attend --remote',
      'npx wrangler d1 execute hj-attend --remote --file=worker/migrations/0099_x.sql']),
    expect: [['R6_live_d1_ok', 'docs/deploy.md', 1], ['R6_live_d1_ok', 'docs/deploy.md', 2]] },
  { id: 's06_clean_migration', mustNotAny: true, diff: newFile('worker/migrations/0096_ok.sql', [
      '-- 더하기만. ① 미리보기 D1 먼저 ② 실 D1은 백업 뒤 유진님 OK 받고만.',
      'CREATE TABLE IF NOT EXISTS t1 (id INTEGER PRIMARY KEY);',
      'CREATE INDEX IF NOT EXISTS t1_id ON t1 (id);']),
    expect: [] },
  { id: 's07_clean_rollback_archive', mustNotAny: true, diff: newFile('docs/rollback/0095_down.sql', [
      '-- 실 D1은 백업 뒤 유진님 OK 받고만. 전: SELECT COUNT(*) FROM t1; 후: 보관 표 행 수 = 전.',
      'CREATE TABLE IF NOT EXISTS t1_c_archive AS SELECT id, c FROM t1;',
      'ALTER TABLE t1 DROP COLUMN c;']),
    expect: [] },
  { id: 's08_clean_code_with_env_and_fake_name', mustNotAny: true, diff: newFile('worker/src/y.js', [
      'const key = env.GSYNC_SALT; // 이름만',
      "const who = '가짜학생77';",
      'const mail = "dev@example.com";']),
    expect: [] },
  { id: 's09_skip_file_already_on_main', mustNotAny: true, onMain: ['worker/migrations/0012_x.sql'], diff: newFile('worker/migrations/0012_x.sql', [
      'ALTER TABLE t1 ADD COLUMN c TEXT;']),
    expect: [] },
  { id: 's10_self_folder_skipped', mustNotAny: true, diff: newFile('tools/kb_reviewer/evals/x.ts', [
      "const s = 'npx wrangler d1 migrations apply x --remote';"]),
    expect: [] },
];
