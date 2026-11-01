// Small SQL helpers shared by rules. Only plain-text heuristics: no DB, no network.
import type { DiffFile, AddedLine } from './types.ts';

export const isDbSql = (p: string) =>
  /\.sql$/i.test(p) && !/(^|\/)tests?\//.test(p) && /(migrations\/|rollback\/|schema\.sql$)/.test(p);
export const isForwardMigration = (p: string) => /\.sql$/i.test(p) && /(^|\/)migrations\//.test(p) && !/rollback|_down/.test(p);

export const code = (t: string) => t.replace(/--.*$/, '').trim();
export const isComment = (t: string) => /^\s*--/.test(t);
export const comments = (f: DiffFile) => f.added.filter(l => isComment(l.text) || /--/.test(l.text)).map(l => l.text).join('\n');
export const codeLines = (f: DiffFile): AddedLine[] => f.added.map(l => ({ n: l.n, text: code(l.text) })).filter(l => l.text);
// Code lines outside CREATE TRIGGER ... END; bodies (a trigger body runs later, it does not move data now).
export const topLevelCode = (f: DiffFile): AddedLine[] => {
  let inTrig = false; const out: AddedLine[] = [];
  for (const l of codeLines(f)) {
    if (/^CREATE\s+TRIGGER\b/i.test(l.text)) { inTrig = !/\bEND\s*;\s*$/i.test(l.text); out.push(l); continue; }
    if (inTrig) { if (/^END\s*;/i.test(l.text)) inTrig = false; continue; }
    out.push(l);
  }
  return out;
};
export const codeBefore = (f: DiffFile, n: number) => codeLines(f).filter(l => l.n < n).map(l => l.text).join('\n');
export const codeAfter = (f: DiffFile, n: number) => codeLines(f).filter(l => l.n > n).map(l => l.text).join('\n');

export const mentionsBackup = (c: string) => /백업|backup/i.test(c) && !/백업[^\n]{0,15}(필요\s*(는\s*)?없|안\s*함|생략|불필요)/.test(c);
export const backupNegated = (c: string) => /백업[^\n]{0,15}(필요\s*(는\s*)?없|안\s*함|생략|불필요)/.test(c);
export const mentionsOk = (c: string) => /유진님[^\n]{0,8}(OK|승인|허락)|OK\s*(받고|뒤|후)|OK\s*전\s*실\s*D1\s*금지/i.test(c);
export const mentionsCount = (c: string) => /행\s*수|row\s*count|COUNT\s*\(|건수|전\s*=\s*후/i.test(c);
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
