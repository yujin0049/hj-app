// R2 칸 추가(확장) → 코드 배포 → 옛 칸 정리(축소): a forward migration must not also contract.
import type { Rule, Finding } from './types.ts';
import { isForwardMigration, codeLines, codeBefore, codeAfter, esc } from './sql.ts';

export const r2: Rule = {
  id: 'R2_expand_order', title: '확장 → 배포 → 정리 순서',
  check(f) {
    if (!isForwardMigration(f.path)) return [];
    const out: Finding[] = [];
    for (const l of codeLines(f)) {
      let m: RegExpMatchArray | null;
      if ((m = l.text.match(/DROP\s+COLUMN\s+(\w+)|RENAME\s+COLUMN\s+(\w+)/i))) {
        out.push({ rule: 'R2_expand_order', severity: 'block', path: f.path, line: l.n, code: l.text,
          why: '앞으로 가는 migration 안에서 옛 칸을 빼거나 이름을 바꿈 → 아직 옛 칸을 읽는 배포 코드가 깨짐.',
          fix: '이번 migration은 더하기만. 새 코드 배포·확인 뒤 별도 날짜의 정리 migration으로(백업·유진님 OK 뒤).' });
      } else if ((m = l.text.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i))) {
        const t = m[1];
        const rebuild = new RegExp(`INSERT\\s+INTO\\s+\\w+[^;]*FROM\\s+${esc(t)}\\b`, 'i').test(codeBefore(f, l.n))
          && new RegExp(`RENAME\\s+TO\\s+${esc(t)}\\b`, 'i').test(codeAfter(f, l.n));
        if (!rebuild) out.push({ rule: 'R2_expand_order', severity: 'block', path: f.path, line: l.n, code: l.text,
          why: `앞으로 가는 migration이 ${t} 표를 없앰(재구성 패턴 아님).`, fix: '정리(축소)는 배포 확인 뒤 별도 단계로.' });
      }
    }
    return out;
  },
};
