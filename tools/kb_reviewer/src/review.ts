// kb-reviewer CLI. Reads a diff (file or git range), runs RULES, writes findings JSON + one comment body.
// It only produces text. Posting is a separate step; it never approves, requests changes or merges.
//   node --experimental-strip-types src/review.ts --diff x.diff [--out f.json] [--comment c.md]
//   node --experimental-strip-types src/review.ts --git <repoDir> <base> <head> [--main <ref>] ...
//     diff = <base>...<head> (merge-base). --main: skip files whose content on <ref> already equals <head>.
// env: KB_NAMES_FILE (optional real-name list path; names are never printed)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseDiff } from './diff.ts';
import { RULES, type Finding, type Ctx } from '../rules/index.ts';
import { cite } from './quote.ts';

const SELF = /(^|\/)tools\/kb_reviewer\//;   // the reviewer's own rules/evals quote the patterns it looks for

export function loadCtx(): Ctx {
  const p = process.env.KB_NAMES_FILE;
  const names = p && existsSync(p) ? readFileSync(p, 'utf8').split('\n').map(s => s.trim()).filter(s => s.length >= 2) : [];
  return { names };
}

export interface ReviewOpts { onMain?: Set<string> }

export function review(diffText: string, ctx: Ctx = loadCtx(), opts: ReviewOpts = {}): Finding[] {
  const out: Finding[] = [];
  for (const f of parseDiff(diffText)) {
    if (SELF.test(f.path) || opts.onMain?.has(f.path)) continue;
    for (const r of RULES) out.push(...r.check(f, ctx));
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

const git = (dir: string, args: string[]) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const blob = (dir: string, ref: string, path: string) => { try { return git(dir, ['rev-parse', `${ref}:${path}`]).trim(); } catch { return ''; } };

export function gitReview(dir: string, base: string, head: string, main?: string, ctx: Ctx = loadCtx()) {
  const diff = git(dir, ['diff', `${base}...${head}`]);
  const onMain = new Set<string>();
  if (main) for (const f of parseDiff(diff)) { const h = blob(dir, head, f.path); if (h && h === blob(dir, main, f.path)) onMain.add(f.path); }
  return { findings: review(diff, ctx, { onMain }), skippedOnMain: [...onMain] };
}

const SEV = { block: '막음', warn: '주의', low: '참고' } as const;
const TEMPLATE_PATH = new URL('../prompts/comment_template.md', import.meta.url);

export function renderComment(fs: Finding[], title = ''): string {
  const tpl = readFileSync(TEMPLATE_PATH, 'utf8');
  const blocks = fs.map((f, i) => [
    `**${i + 1}. [${SEV[f.severity]} · ${f.rule}] \`${f.path}:${f.line}\`**`,
    '```', f.code, '```',
    `- 왜: ${f.why}`, `- 고칠 것: ${f.fix}`,
    ...cite(f.rule).map(c => `- ${c}`),
  ].join('\n')).join('\n\n');
  const counts = (['block', 'warn', 'low'] as const).map(s => `${SEV[s]} ${fs.filter(f => f.severity === s).length}`).join(' · ');
  return tpl.replace('{{title}}', title).replace('{{counts}}', counts).replace('{{findings}}', blocks || '규칙 위반 없음.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  const get = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  let fs: Finding[]; let skipped: string[] = [];
  if (get('--diff')) fs = review(readFileSync(get('--diff')!, 'utf8'));
  else if (a.includes('--git')) { const i = a.indexOf('--git'); const r = gitReview(a[i + 1], a[i + 2], a[i + 3], get('--main')); fs = r.findings; skipped = r.skippedOnMain; }
  else { console.error('need --diff <file> or --git <dir> <base> <head>'); process.exit(2); }
  if (get('--out')) writeFileSync(get('--out')!, JSON.stringify(fs, null, 2));
  if (get('--comment')) writeFileSync(get('--comment')!, renderComment(fs, get('--title') ?? ''));
  const by: Record<string, number> = {};
  for (const f of fs) by[f.rule] = (by[f.rule] ?? 0) + 1;
  console.log(JSON.stringify({ findings: fs.length, by, skippedOnMain: skipped.length }));
}
