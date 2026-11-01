// R4 두 번 돌려도 같은 결과: SQL statements that fail or double-apply on a rerun.
import type { Rule, Finding } from './types.ts';
import { isDbSql, codeLines, codeBefore, codeAfter, esc } from './sql.ts';

export const r4: Rule = {
  id: 'R4_idempotent', title: '재실행 안전(멱등)',
  check(f) {
    if (!isDbSql(f.path)) return [];
    const out: Finding[] = [];
    const push = (n: number, code: string, why: string, fix: string) =>
      out.push({ rule: 'R4_idempotent', severity: 'warn', path: f.path, line: n, code, why, fix });
    for (const l of codeLines(f)) {
      let m: RegExpMatchArray | null;
      if ((m = l.text.match(/^CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX|TRIGGER|VIEW)\s+(?!IF\s+NOT\s+EXISTS)(\w+)/i))) {
        const [, kind, name] = m;
        const temp = kind.toUpperCase() === 'TABLE' && new RegExp(`\\b${esc(name)}\\s+RENAME\\s+TO\\b`, 'i').test(codeAfter(f, l.n));
        if (!temp) push(l.n, l.text, `${name} 이(가) 이미 있으면 두 번째 실행에서 멈춤.`, `CREATE ${kind.toUpperCase()} IF NOT EXISTS ${name} …`);
        else out.push({ rule: 'R4_idempotent', severity: 'low', path: f.path, line: l.n, code: l.text,
          why: `임시 표 ${name} 를 IF NOT EXISTS 없이 만듦(중간에 멈춘 뒤 다시 돌리면 「already exists」).`,
          fix: `DROP TABLE IF EXISTS ${name}; 를 앞에 두거나 CREATE TABLE IF NOT EXISTS ${name} …` });
      } else if ((m = l.text.match(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/i))) {
        push(l.n, l.text, `${m[1]}.${m[2]} 칸이 이미 있으면 「duplicate column」 으로 멈춤(실 D1에는 적용 기록 표가 없어 다시 돌 수 있음).`,
          '적용 스크립트에서 pragma_table_info 로 칸이 있는지 먼저 보고 없을 때만 실행(건너뜀 기록).');
      } else if ((m = l.text.match(/ALTER\s+TABLE\s+(\w+)\s+RENAME\s+TO\s+(\w+)/i))) {
        const [, a, b] = m;
        const before = codeBefore(f, l.n);
        const freed = new RegExp(`DROP\\s+TABLE\\s+(IF\\s+EXISTS\\s+)?${esc(b)}\\b|ALTER\\s+TABLE\\s+${esc(b)}\\s+RENAME\\s+TO\\b`, 'i').test(before);
        if (!freed) push(l.n, l.text, `두 번째 실행에서 ${b} 가 이미 있어 이름이 부딪힘(또는 ${a} 가 없어 멈춤).`,
          `실행 전 sqlite_master 에서 ${b} 가 있는지 보고 있으면 이 단계 건너뛰기, 또는 보관 이름에 실행 번호를 붙이고 머리말에 「한 번만, 두 번째는 건너뜀」 적기.`);
      } else if ((m = l.text.match(/RENAME\s+COLUMN\s+(\w+)\s+TO\s+(\w+)/i))) {
        push(l.n, l.text, `두 번째 실행에서 ${m[1]} 칸이 없어 멈춤.`, '실행 전 pragma_table_info 로 확인 후 건너뛰기.');
      }
    }
    return out;
  },
};
