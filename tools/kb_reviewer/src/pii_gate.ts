// pii gate: run on the comment body BEFORE it is posted. Exit 1 (and print counts only, never values) if the body
// contains a key/token, 주민번호, phone, any email address, a bot-box absolute path, or a name from KB_NAMES_FILE.
// Same patterns as R5 (rules/r5_secret_pii.ts) + any email + box paths. In CI there is no names list, so names are
// only checked locally (the local pii_check runs with the names list before every push).
//   node --experimental-strip-types src/pii_gate.ts <file>
import { readFileSync } from 'node:fs';
import { PATTERNS } from '../rules/r5_secret_pii.ts';
import { loadCtx } from './review.ts';

const EXTRA: [string, RegExp][] = [
  ['이메일(가짜 포함)', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/],
  ['상자 절대 경로', /\/home\/box\b|(^|[\s"'`=(:])\/workspace\//],
];
export function piiGate(body: string, names: string[] = []): Record<string, number> {
  const hits: Record<string, number> = {};
  const lines = body.split('\n');
  for (const [label, re] of [...PATTERNS.filter(([l]) => l !== '이메일'), ...EXTRA]) {
    const n = lines.filter(l => re.test(l) && !/noreply/.test(l)).length; if (n) hits[label] = n;
  }
  const nn = lines.filter(l => names.some(nm => nm && l.includes(nm))).length; if (nn) hits['실명 목록'] = nn;
  return hits;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const f = process.argv[2];
  const hits = piiGate(readFileSync(f, 'utf8'), loadCtx().names);
  const total = Object.values(hits).reduce((a, b) => a + b, 0);
  console.log(JSON.stringify({ pii_gate: total ? 'FAIL' : 'OK', lines: total, by: hits }));
  process.exit(total ? 1 : 0);
}
