// R1 먼저 백업 · 지우지 말고 보관: destructive SQL needs an archive copy and a backup step.
import type { Rule, Finding } from './types.ts';
import { isDbSql, codeLines, codeBefore, codeAfter, comments, mentionsBackup, backupNegated, mentionsCount, esc } from './sql.ts';

export const r1: Rule = {
  id: 'R1_backup', title: '먼저 백업 · 영구 삭제 대신 보관',
  check(f) {
    if (!isDbSql(f.path)) return [];
    const out: Finding[] = [];
    const head = comments(f);
    for (const l of codeLines(f)) {
      const before = codeBefore(f, l.n);
      const dc = l.text.match(/ALTER\s+TABLE\s+(\w+)\s+DROP\s+COLUMN\s+(\w+)/i);
      if (dc) {
        const [, t, c] = dc;
        const archived = new RegExp(`CREATE\\s+TABLE[^;]*AS\\s+SELECT[^;]*\\b${esc(c)}\\b[^;]*FROM\\s+${esc(t)}\\b`, 'i').test(before);
        if (archived && !mentionsCount(before + '\n' + head)) { out.push({ rule: 'R1_backup', severity: 'low', path: f.path, line: l.n, code: l.text,
          why: `${t}.${c} 를 보관한 바로 다음 줄에서 칸을 지움(보관 표 행 수를 확인하는 단계가 없음).`,
          fix: `보관 뒤 SELECT COUNT(*) 로 ${t} 와 보관 표 행 수가 같은지 보고, 칸 삭제는 다른 단계(따로 OK)로.` }); continue; }
        if (!archived) out.push({ rule: 'R1_backup', severity: 'block', path: f.path, line: l.n, code: l.text,
          why: `${t}.${c} 칸을 보관 표 없이 지움(되살릴 길 없음)${backupNegated(head) ? ' · 머리말이 「백업 필요 없음」이라고 함' : ''}.`,
          fix: `지우기 전에 CREATE TABLE IF NOT EXISTS ${t}_${c}_archive AS SELECT rowid, ${c} FROM ${t}; 로 옮기거나, DROP 대신 RENAME COLUMN ${c} TO ${c}_old 로 보관.` });
        continue;
      }
      const dt = l.text.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
      if (dt) {
        const t = dt[1];
        const copied = new RegExp(`INSERT\\s+INTO\\s+\\w+[^;]*SELECT[^;]*FROM\\s+${esc(t)}\\b`, 'i').test(before);
        const renamedBack = new RegExp(`RENAME\\s+TO\\s+${esc(t)}\\b`, 'i').test(codeAfter(f, l.n));
        if (copied && renamedBack && mentionsBackup(head)) {
          const kept = new RegExp(`(RENAME\\s+TO\\s+${esc(t)}_(archive|old|bak)\\w*|CREATE\\s+TABLE[^;]*AS\\s+SELECT[^;]*FROM\\s+${esc(t)}\\b)`, 'i').test(before);
          if (!(kept && mentionsCount(before + '\n' + head))) out.push({ rule: 'R1_backup', severity: 'warn', path: f.path, line: l.n, code: l.text,
            why: `재구성(새 표→복사→지우기→이름 바꾸기)이라도 옛 ${t} 표를 바로 지움${kept ? '' : ' · 옛 표 보관 이름 없음'}${mentionsCount(before + '\n' + head) ? '' : ' · 지우기 전 행 수 확인 없음'}.`,
            fix: `DROP TABLE ${t} 대신 ALTER TABLE ${t} RENAME TO ${t}_old_<날짜> 로 남기고, 그 전에 SELECT COUNT(*) 로 새 표와 행 수가 같은지 확인. 옛 표 삭제는 다른 단계로.` });
          continue;
        }
        if (!(copied && renamedBack && mentionsBackup(head))) out.push({ rule: 'R1_backup', severity: 'block', path: f.path, line: l.n, code: l.text,
          why: `${t} 표를 지움${copied ? '' : '(먼저 옮겨 담은 곳 없음)'}${mentionsBackup(head) ? '' : ' · 머리말에 적용 전 백업 단계가 없음'}.`,
          fix: `DROP TABLE 대신 ALTER TABLE ${t} RENAME TO ${t}_archive_<날짜> 로 보관, 머리말에 「적용 전 D1 백업」 적기.` });
        continue;
      }
      if (/^(DELETE\s+FROM|TRUNCATE)\b/i.test(l.text) && !mentionsBackup(head)) out.push({ rule: 'R1_backup', severity: 'block', path: f.path, line: l.n, code: l.text,
        why: '줄을 지우는데 머리말에 백업 단계가 없음.', fix: '지우기 전 보관 표로 복사 + 「적용 전 D1 백업」 문구.' });
    }
    return out;
  },
};
