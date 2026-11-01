// Shared types. A rule sees one parsed file of a diff and returns findings on ADDED lines only.
export type Severity = 'block' | 'warn' | 'low';   // 막음(high) · 주의(med) · 참고(low)

export interface AddedLine { n: number; text: string }

export interface DiffFile {
  path: string;
  isNew: boolean;
  added: AddedLine[];      // every '+' line with its new-file line number
  addedText: string;       // added lines joined (for file-level context such as header comments)
}

export interface Finding {
  rule: RuleId;
  severity: Severity;
  path: string;
  line: number;
  code: string;            // the offending added line (trimmed, max 160 chars; secrets masked)
  why: string;             // plain Korean reason
  fix: string;             // what to do instead
}

export type RuleId = 'R1_backup' | 'R2_expand_order' | 'R3_row_count' | 'R4_idempotent' | 'R5_secret_pii' | 'R6_live_d1_ok'
  | 'R7_no_delete' | 'R8_box_path' | 'R9_fake_contact';

export interface Rule {
  id: RuleId;
  title: string;
  check(file: DiffFile, ctx: Ctx): Finding[];
}

export interface Ctx { names: string[] }   // optional names list (from a file path); never printed
