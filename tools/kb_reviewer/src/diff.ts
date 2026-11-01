// Unified diff -> files with added lines (new-file line numbers). Deleted lines are ignored on purpose:
// the reviewer only comments on what the PR adds.
import type { DiffFile } from '../rules/types.ts';

export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let cur: DiffFile | null = null;
  let n = 0;
  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git ')) { cur = null; continue; }
    if (raw.startsWith('--- ')) { continue; }
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4).trim();
      if (p === '/dev/null') { cur = null; continue; }
      cur = { path: p.replace(/^b\//, ''), isNew: false, added: [], addedText: '' };
      files.push(cur);
      continue;
    }
    if (!cur) continue;
    const h = raw.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,\d+)? @@/);
    if (h) { n = Number(h[3]); if (h[1] === '0' && h[2] === '0') cur.isNew = true; continue; }
    if (raw.startsWith('+')) { cur.added.push({ n, text: raw.slice(1) }); n++; }
    else if (raw.startsWith('-')) { /* old side only */ }
    else if (raw.startsWith('\\')) { /* no newline marker */ }
    else n++;
  }
  for (const f of files) f.addedText = f.added.map(l => l.text).join('\n');
  return files;
}
// New files are detected from the '@@ -0,0' hunk header.
