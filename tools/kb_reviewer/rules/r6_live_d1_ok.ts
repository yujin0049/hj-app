// R6 실 D1 변경은 유진님 OK: risky live-DB commands and assumptions about wrangler's migration log.
import type { Rule, Finding } from './types.ts';
import { comments, mentionsOk } from './sql.ts';

export const r6: Rule = {
  id: 'R6_live_d1_ok', title: '실 D1 변경은 유진님 OK',
  check(f) {
    if (/(^|\/)tests?\//.test(f.path)) return [];
    const out: Finding[] = [];
    const fileOk = mentionsOk(f.addedText);
    for (const l of f.added) {
      const t = l.text;
      if (/d1\s+migrations\s+apply/i.test(t)) {
        out.push({ rule: 'R6_live_d1_ok', severity: 'block', path: f.path, line: l.n, code: t.trim().slice(0, 160),
          why: '`d1 migrations apply` 는 적용 기록 표(d1_migrations)를 봄. 실 D1에는 이 표가 없어 0001부터 다시 돌 수 있음.',
          fix: '실 D1은 파일 하나씩 `d1 execute --file` + 적용 전 백업·행 수 비교 + 유진님 OK. apply 는 미리보기 D1에서만.' });
      } else if (/wrangler[^\n]*d1\s+execute[^\n]*--remote/i.test(t) && !(mentionsOk(t) || fileOk)) {
        out.push({ rule: 'R6_live_d1_ok', severity: 'block', path: f.path, line: l.n, code: t.trim().slice(0, 160),
          why: '실 D1(--remote)에 쓰는 명령인데 유진님 OK 단계가 없음.', fix: '명령 옆에 「백업 뒤 유진님 OK 받고만」 적기, 기본은 미리보기 D1.' });
      } else if (/--/.test(t) && /wrangler\s*(는|가|이)?[^\n]{0,30}(한\s*번만\s*돌|적용\s*기록)/.test(t)) {
        out.push({ rule: 'R6_live_d1_ok', severity: 'warn', path: f.path, line: l.n, code: t.trim().slice(0, 160),
          why: '「wrangler 가 적용 기록을 보고 한 번만 돌린다」 는 가정. 실 D1에는 d1_migrations 표가 없어 이 가정이 틀림.',
          fix: '가정 문구를 빼고, 파일 자체를 재실행 안전하게 하거나 「실 D1은 손으로 한 번, 백업·유진님 OK 뒤」 로 적기.' });
      }
    }
    if (f.isNew && /\.sql$/.test(f.path) && /(migrations\/|rollback\/)/.test(f.path) && !mentionsOk(comments(f))) {
      const first = f.added.find(l => l.text.trim() && !/^\s*--/.test(l.text)) ?? f.added[0];
      if (first) out.push({ rule: 'R6_live_d1_ok', severity: 'low', path: f.path, line: first.n, code: first.text.trim().slice(0, 160),
        why: '실 D1에 적용하는 파일인데 머리말에 「유진님 OK 뒤에만」 문구가 없음.', fix: '머리말에 「① 미리보기 D1 먼저 ② 실 D1은 백업 뒤 유진님 OK 받고만」 한 줄.' });
    }
    return out;
  },
};
