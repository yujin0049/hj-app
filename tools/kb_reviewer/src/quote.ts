// Citation text for a rule: its one-line wording + note filenames. Needs no vault, works the same locally and in CI.
import { NOTES } from '../rules/notes.ts';
import type { RuleId } from '../rules/types.ts';

export function cite(rule: RuleId): string[] {
  const c = NOTES[rule];
  return [`규칙: ${c.rule}`, `근거 노트(봇교훈): ${c.notes.map(n => `「${n}」`).join(' · ')}`];
}
