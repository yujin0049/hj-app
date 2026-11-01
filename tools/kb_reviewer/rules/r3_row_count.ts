// R3 전후 행 수 비교: a data-changing SQL file must say how before/after row counts are compared.
import type { Rule } from './types.ts';
import { isDbSql, topLevelCode, comments, mentionsCount } from './sql.ts';

const CHANGES = /\b(INSERT\s+INTO\s+\w+[^;]*SELECT|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+(TABLE|COLUMN)|RENAME\s+TO|CREATE\s+TABLE[^;]*\bAS\s+SELECT)\b/i;

export const r3: Rule = {
  id: 'R3_row_count', title: '전후 행 수 비교',
  check(f) {
    if (!isDbSql(f.path) || !f.isNew) return [];
    const first = topLevelCode(f).find(l => CHANGES.test(l.text));
    if (!first || mentionsCount(comments(f))) return [];
    return [{ rule: 'R3_row_count', severity: 'warn', path: f.path, line: first.n, code: first.text,
      why: '자료를 옮기거나 바꾸는 파일인데 전후 행 수를 어떻게 비교하는지 없음.',
      fix: '머리말에 「전: SELECT COUNT(*) …  후: 같은 쿼리, 전=후(옮긴 표는 원본 수와 같음)」 확인 쿼리를 적기.' }];
  },
};
