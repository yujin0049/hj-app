// R5 코드·노트에 개인정보·비밀 키 없음. Matched values are masked; names are never printed.
import type { Rule, Finding } from './types.ts';

const SKIP = /(^|\/)(package-lock\.json|.*\.min\.js|vendor\/|fonts\/)/;
export const PATTERNS: [string, RegExp][] = [
  ['GitHub 토큰', /\b(ghp|gho|ghu|ghs)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ['API 키(sk-)', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['AWS 키', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack 토큰', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['개인 키', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['키 값 직접 적음', /(api[_-]?key|secret|token|passw(or)?d|pwd)\w*["']?\s*[:=]\s*["'][A-Za-z0-9_\-+/=.]{20,}["']/i],
  ['URL 에 키', /[?&](t|token|key|api_key|access_token|secret)=[A-Za-z0-9_\-.%]{16,}/i],
  ['주민번호', /\b\d{6}-[1-4]\d{6}\b/],
  ['전화번호', /\b01[016789]-?\d{3,4}-?\d{4}\b/],
  ['이메일', /[A-Za-z0-9._%+-]+@(?!(example|test|invalid|localhost)\b)[A-Za-z0-9-]+\.[A-Za-z.]{2,}/],
];

export const r5: Rule = {
  id: 'R5_secret_pii', title: '개인정보·비밀 키 없음',
  check(f, ctx) {
    if (SKIP.test(f.path)) return [];
    const out: Finding[] = [];
    for (const l of f.added) {
      for (const [label, re] of PATTERNS) {
        if (!re.test(l.text)) continue;
        if (label === '이메일' && /noreply|users\.noreply\.github\.com/.test(l.text)) continue;
        out.push({ rule: 'R5_secret_pii', severity: 'block', path: f.path, line: l.n, code: l.text.replace(new RegExp(re.source, re.flags + 'g'), '***').slice(0, 160),
          why: `${label} 으로 보이는 값이 코드에 들어감.`, fix: '값은 지우고 env/secret 이름이나 파일 경로만 남기기. 이미 올라갔다면 키 회전은 유진님 결정.' });
        break;
      }
      const hits = ctx.names.filter(nm => nm && l.text.includes(nm)).length;
      if (hits) out.push({ rule: 'R5_secret_pii', severity: 'block', path: f.path, line: l.n, code: '(가림)',
        why: `실명 목록과 같은 이름 ${hits}개가 들어감.`, fix: '가짜 이름(예: 가짜학생77)으로 바꾸기.' });
    }
    return out;
  },
};
