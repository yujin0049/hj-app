// Replays PR#17–#21 (local git only: no network, no comments) + synthetic cases, and scores the reviewer.
// caught = expected finding produced · missed = expected not produced · FP = produced but not expected.
// Without KB_REPO (e.g. in CI) only the synthetic cases run. Exit 1 if any synthetic case misses or over-flags.
import { readFileSync, writeFileSync } from 'node:fs';
import { review, gitReview, renderComment, loadCtx } from '../src/review.ts';
import { SYN } from './synthetic/cases.ts';
import { piiGate } from '../src/pii_gate.ts';
import type { Finding } from '../rules/types.ts';

const here = (p: string) => new URL(p, import.meta.url);
const cases = JSON.parse(readFileSync(here('./cases.json'), 'utf8'));
const replay = JSON.parse(readFileSync(here('./replay.json'), 'utf8'));
const REPO = process.env.KB_REPO ?? '';
const ctx = loadCtx();
type Exp = [string, string, number | null, string?];
const hit = (f: Finding, e: Exp) => f.rule === e[0] && f.path === e[1] && (e[2] == null || f.line === e[2]);

interface Row { id: string; expected: number; caught: number; missed: Exp[]; fp: Finding[]; total: number; knownCaught: string[]; skippedOnMain?: string[] }
const rows: Row[] = [];
const realFs: Record<string, Finding[]> = {};
function score(id: string, fs: Finding[], exp: Exp[]): Row {
  const missed = exp.filter(e => !fs.some(f => hit(f, e)));
  const fp = fs.filter(f => !exp.some(e => hit(f, e)));
  const knownCaught = exp.filter(e => (e[3] ?? '').startsWith('known:') && fs.some(f => hit(f, e))).map(e => e[3]!.slice(6));
  return { id, expected: exp.length, caught: exp.length - missed.length, missed, fp, total: fs.length, knownCaught };
}
if (REPO) for (const [id, c] of Object.entries<any>(cases.real)) {
  const r = replay[id];
  const g = gitReview(REPO, r.base, r.head, r.main, ctx);
  realFs[id] = g.findings;
  rows.push({ ...score(id, g.findings, c.expect), skippedOnMain: g.skippedOnMain });
}
for (const s of SYN) rows.push(score(s.id, review(s.diff, { names: [] }, { onMain: new Set(s.onMain ?? []) }), s.expect as Exp[]));

// The comment must cite filename + rule wording only: no vault path, no lesson-text quote marker.
const body = renderComment(review(SYN[0].diff, { names: [] }));
const citeOk = /근거 노트\(봇교훈\): 「261101_엘리트블로그_교훈\.md」/.test(body) && /- 규칙: /.test(body) && !/\/home\/|obsidian|봇공유|^- .*> /m.test(body);

// Every value the rules quote must come out masked, so the pii gate passes on a comment holding all synthetic findings.
const gateHits = piiGate(renderComment(SYN.flatMap(c => review(c.diff, { names: [] }, { onMain: new Set(c.onMain ?? []) }))));
const gateOk = Object.keys(gateHits).length === 0;
const isReal = (r: Row) => r.id.startsWith('pr');
const agg = (pick: (r: Row) => boolean, label: string) => {
  const rs = rows.filter(pick); if (!rs.length) return `${label}: (not run)`;
  const e = rs.reduce((a, r) => a + r.expected, 0), c = rs.reduce((a, r) => a + r.caught, 0), t = rs.reduce((a, r) => a + r.total, 0), fp = rs.reduce((a, r) => a + r.fp.length, 0);
  return `${label}: caught ${c}/${e} · missed ${e - c} · findings ${t} · FP ${fp} (FP rate ${t ? (100 * fp / t).toFixed(1) : '0.0'}%)`;
};
const table = ['| case | expected | caught | missed | findings | FP | skipped (same as main) |', '|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.id} | ${r.expected} | ${r.caught} | ${r.missed.length} | ${r.total} | ${r.fp.length} | ${r.skippedOnMain?.length ?? '-'} |`)];
const detail = rows.flatMap(r => [
  ...r.knownCaught.map(k => `- KNOWN CAUGHT ${r.id}: ${k}`),
  ...r.missed.map(m => `- MISSED ${r.id}: ${m[0]} ${m[1]}:${m[2] ?? '*'} ${m[3] ?? ''}`),
  ...r.fp.map(f => `- FP ${r.id}: ${f.rule} ${f.path}:${f.line}`),
]);
// Second answer set (cross-eval, made blind by another bot): KB_C3=<expected.json>. Caught = any finding on the same file:line.
let c3md: string[] = [];
const C3 = process.env.KB_C3 ?? '';
if (C3 && REPO) {
  const ex: any[] = JSON.parse(readFileSync(C3, 'utf8')).expected;
  const res = ex.map(e => { const fs = realFs['pr' + e.pr] ?? []; const f = fs.find(x => x.path === e.file && x.line === e.line); return { e, f }; });
  const caught = res.filter(r => r.f).length;
  const keys = new Set(ex.map(e => `pr${e.pr}|${e.file}|${e.line}`));
  const extra = Object.entries(realFs).flatMap(([id, fs]) => fs.filter(f => !keys.has(`${id}|${f.path}|${f.line}`)).map(f => ({ id, f })));
  const sevName = (s: string) => ({ block: 'high', warn: 'med', low: 'low' } as any)[s];
  c3md = ['', `## 두 번째 정답표(교차 eval, ${ex.length}건): caught ${caught}/${ex.length} · missed ${ex.length - caught} · 정답표 밖 지적 ${extra.length}`, '',
    '| id | PR | file:line | 기대 sev | 리뷰어 | 리뷰어 sev |', '|---|---|---|---|---|---|',
    ...res.map(({ e, f }) => `| ${e.id} | #${e.pr} | ${e.file}:${e.line} | ${e.sev} | ${f ? f.rule : 'MISSED'} | ${f ? sevName(f.severity) : '-'} |`),
    '', '정답표 밖 지적(규칙별): ' + Object.entries(extra.reduce((a: any, x) => (a[x.f.rule] = (a[x.f.rule] ?? 0) + 1, a), {})).map(([k, v]) => `${k} ${v}`).join(' · ')];
}
const md = ['# kb-reviewer eval', '', `- ${agg(isReal, 'real PR#17–21')}`, `- ${agg(r => !isReal(r), 'synthetic')}`, `- ${agg(() => true, 'all')}`,
  `- comment cites filename + rule wording only, no vault: ${citeOk ? 'OK' : 'FAIL'}`,
  `- pii gate on a comment with all synthetic findings (values masked): ${gateOk ? 'OK' : 'FAIL ' + JSON.stringify(gateHits)}`, '', ...table, '', ...detail, ...c3md, ''].join('\n');
if (process.env.KB_EVAL_WRITE !== '0') { writeFileSync(here('./results.md'), md); writeFileSync(here('./results.json'), JSON.stringify(rows, null, 2)); }
console.log(md);
const synBad = rows.filter(r => !isReal(r)).some(r => r.missed.length || r.fp.length);
process.exit(synBad || !citeOk || !gateOk ? 1 : 0);
