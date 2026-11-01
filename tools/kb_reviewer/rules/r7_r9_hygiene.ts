// R7 지우지 않기 (med) · R8 상자 절대 경로 (low) · R9 가짜 연락처 문자열 (low). Added lines only, any text file.
import type { Rule, Finding, DiffFile } from './types.ts';

const BIN = /(^|\/)(package-lock\.json|.*\.min\.js|vendor\/|fonts\/)|\.(svg|png|jpe?g|gif|woff2?|ttf|pdf|lock)$/i;
const isCode = (p: string) => /\.(m?[jt]sx?|cjs|py|sh|bash|gs|ya?ml|sql|toml|json|html|css)$|(^|\/)(Makefile|Dockerfile)$/i.test(p);
const isProse = (t: string) => /^\s*(#|\/\/|--|\*)\s/.test(t) && !/\b(rm|unlink)\b\s+-/.test(t);
const mk = (rule: Finding['rule'], severity: Finding['severity'], f: DiffFile, n: number, code: string, why: string, fix: string): Finding =>
  ({ rule, severity, path: f.path, line: n, code: code.trim().slice(0, 160), why, fix });

const DEL: [string, RegExp][] = [
  ['rm 명령', /(^|[\s;&|('"`{])(sudo\s+)?rm\s+(-[A-Za-z]+\s+)*["'$~./\w]/],
  ['trap 으로 rm', /\btrap\s+["'][^"']*\brm\b/],
  ['Node 파일 지우기', /\bfs(\.promises)?\.(rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync)\s*\(|\b(rmSync|unlinkSync|rmdirSync)\s*\(/],
  ['Python 파일 지우기', /\b(shutil\.rmtree|os\.(remove|unlink|rmdir)|\.unlink\(\s*(missing_ok)?)/],
  ['find -delete', /\bfind\b[^\n]*\s-delete\b/],
];
export const r7: Rule = {
  id: 'R7_no_delete', title: '지우지 않기(rm 대신 .trash)',
  check(f) {
    if (BIN.test(f.path) || !isCode(f.path) || /\.sql$/i.test(f.path)) return [];
    const out: Finding[] = [];
    for (const l of f.added) {
      if (isProse(l.text)) continue;
      const hit = DEL.find(([, re]) => re.test(l.text));
      if (hit) out.push(mk('R7_no_delete', 'warn', f, l.n, l.text, `${hit[0]} 으로 파일·폴더를 지움(임시 폴더라도 되살릴 길 없음).`,
        '지우지 말고 .trash/<날짜>/ 또는 _archive/ 로 mv. 임시 폴더는 만든 곳을 출력해 두고 남겨도 됨.'));
    }
    return out;
  },
};

const BOX = /(\/home\/box\b|(^|[\s"'`=(:])\/workspace\/)/;
export const r8: Rule = {
  id: 'R8_box_path', title: '상자 절대 경로 없음',
  check(f) {
    if (BIN.test(f.path)) return [];
    const l = f.added.find(x => BOX.test(x.text));
    if (!l) return [];
    const n = f.added.filter(x => BOX.test(x.text)).length;
    return [mk('R8_box_path', 'low', f, l.n, l.text.replace(/\/home\/box\/[^\s"'`)]*|\/workspace\/[^\s"'`)]*/g, '<상자 경로>'),
      `봇 상자 내부 절대 경로가 들어감(${n}줄). 다른 컴퓨터·CI 에서는 없는 경로.`,
      '환경 변수(예: TLA2TOOLS)를 필수로 받고 없으면 안내 후 멈추기, 또는 저장소 안 상대 경로.')];
  },
};

const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const REAL_MAIL = /[A-Za-z0-9._%+-]+@(?!(example|test|invalid|localhost)\b)[A-Za-z0-9-]+\.[A-Za-z.]{2,}/;  // R5 already blocks these
export const r9: Rule = {
  id: 'R9_fake_contact', title: '가짜 연락처도 문자열로 두지 않기',
  check(f) {
    if (BIN.test(f.path) || !isCode(f.path) || /\.ya?ml$/i.test(f.path)) return [];
    const out: Finding[] = [];
    for (const l of f.added) {
      if (!MAIL.test(l.text) || /noreply|users\.noreply\.github\.com/.test(l.text)) continue;
      if (REAL_MAIL.test(l.text)) continue;
      out.push(mk('R9_fake_contact', 'low', f, l.n, l.text.replace(new RegExp(MAIL.source, 'g'), '***@***'),
        '시험·코드에 (가짜라도) 이메일 주소가 문자열 그대로 들어감 → 개인정보 검사에 걸리고, 진짜 값으로 바뀌어도 눈에 안 띔.',
        "'dev' + '@' + 'example.com' 처럼 실행 때 조립하거나 공용 가짜값 모듈에서 가져오기."));
    }
    return out;
  },
};
