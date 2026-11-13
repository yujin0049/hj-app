#!/usr/bin/env python3
"""AI·크롤러가 자바스크립트 없이 읽는 파일 만들기 (llmstxt.org 규격).

만드는 것(모두 저장소에 넣어 GitHub Pages 가 그대로 내보냄, .nojekyll 유지):
  llms.txt        화면 목록: 한글 제목 · 한 줄 설명 · 정적 .md 주소. 비공개 화면은 이름과 「비공개」만.
  llms-full.txt   공개 .md 본문을 한 파일로 이어 붙인 것
  ai/<id>.md      화면마다 정적 마크다운(공개 화면만)
  ai/index.json   공개 화면 색인(개인정보 없음)
  robots.txt      AI 수집기는 llms·ai/ 만 허용, 그 밖(구글 검색 등)은 전체 막음

화면 목록은 손으로 쓰지 않고 소스에서 뽑아요:
  js/registry.js (MODULE_LIST·MODULE_EXTRA) + js/modules/*.js 의 ShellModules 등록 → 화면 id 전부
  js/intranet-nav.js MENU → 한글 제목·묶음,  js/modules/more.js menuBtn → 제목·한 줄 설명,  ShellModules tab → 마지막 제목
공개 기준: tools/llms_policy.json. 거기 없는 화면은 자동으로 「비공개」(기본 닫힘).
본문은 public/*.json(공개용으로 만든 자료)만 써요. data/*.json 원본은 읽지 않아요.
위치(업무폴더·볼트 경로)·이메일·전화·이름 의심 줄은 빼요(tools/hjpii.py).

쓰기:  python3 tools/make_llms.py          # 파일 다시 만들기
       python3 tools/make_llms.py --check  # 저장소 파일이 소스와 같은지(다르면 종료 코드 1)
"""
import json, os, re, sys

sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hjpii  # noqa: E402

SITE = 'https://yujin0049.github.io/hj-app/'
AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
           'Google-Extended', 'PerplexityBot', 'Perplexity-User', 'Applebot-Extended', 'CCBot', 'Meta-ExternalAgent',
           'Bytespider', 'cohere-ai', 'MistralAI-User', 'DuckAssistBot', 'Amazonbot']
AI_PATHS = ['/llms.txt', '/llms-full.txt', '/ai/']
PREFIXES = ['', '/hj-app']  # 미리보기(맨 위) · GitHub Pages(/hj-app/) 둘 다
# 공개 파일에 넣지 않는 줄: 업무 PC·볼트 경로, 상자 경로, 이메일, 주소창 열쇠 등
BAN = re.compile(r'(봇공유|볼트|vault|업무폴더|(?<![A-Za-z])[A-Z]:(?:[\\/)]|\s)|/home/|/workspace/|\\\\|@|[?&](?:t|key|token)=|비밀번호|password|api[_ -]?key|claude -p)')
# 바꿔 쓰기: 개인 호칭 → 역할, 개인정보 검사(이름 앞+「교수님」 모양) 오탐 문장 → 같은 뜻 다른 말
SWAP = [('유진님', '담당자'), ('피드백은' + ' 교수님 채점 뒤에', '피드백은 채점이 끝난 뒤에')]


def read(*p):
    return open(os.path.join(ROOT, *p), encoding='utf-8').read()


def clean(s):
    s = re.sub(r'\s+', ' ', str(s or '')).strip()
    for a, b in SWAP:
        s = s.replace(a, b)
    return s


def pii(s):
    """전화·이메일·주민번호·계좌 모양(이름 추측 「이름 의심」은 오탐이 많아 빼고, 시험에서 따로 봄)."""
    return [h for h in hjpii.find_pii(s) if h != '이름 의심']


def ok(s):
    """공개해도 되는 글인지: 금지 낱말·경로 없음 + 개인정보 모양 없음."""
    return bool(s) and not BAN.search(s) and not pii(s)


# ── 소스에서 화면 목록 뽑기 ──
def screens():
    reg = read('js', 'registry.js')
    ids = []
    for name in ('MODULE_LIST', 'MODULE_EXTRA'):
        m = re.search(name + r"\s*=\s*\[([^\]]*)\]", reg)
        ids += re.findall(r"'([^']+)'", m.group(1)) if m else []
    tabs = {}
    mdir = os.path.join(ROOT, 'js', 'modules')
    for f in sorted(os.listdir(mdir)):
        if not f.endswith('.js'):
            continue
        src = read('js', 'modules', f)
        for m in re.finditer(r"ShellModules(?:\.([\w$]+)|\[['\"]([\w-]+)['\"]\])\s*=\s*\{([^}]*)\}", src):
            sid = m.group(1) or m.group(2)
            t = re.search(r"tab:\s*'([^']*)'", m.group(3))
            tabs[sid] = t.group(1) if t else ''
            if sid not in ids:
                ids.append(sid)
    nav = {}
    for g, body in re.findall(r"\{\s*group:\s*'([^']*)',\s*items:\s*\[(.*?)\]\s*\}", read('js', 'intranet-nav.js'), re.S):
        for href, label in re.findall(r"\[\s*'(#/[^']+)',\s*'([^']+)'", body):
            nav[href[2:]] = (label, g)
    more = {i: (t, s) for i, t, s in re.findall(r"menuBtn\('([^']+)',\s*'([^']+)',\s*'([^']*)'\)", read('js', 'modules', 'more.js'))}
    # 실무 탭 입구 카드(['#/judge', '판정', '한 줄 설명']) 같은 세 칸 목록도 제목·설명 소스
    for i, t, sub in re.findall(r"\[\s*'#/([\w-]+)',\s*'([^']+)',\s*'([^']+)'\s*\]", read('js', 'modules', 'work.js')):
        more.setdefault(i, (t, sub))
    pol = json.loads(read('tools', 'llms_policy.json'))
    out = []
    for sid in ids:
        label, group = nav.get(sid, ('', ''))
        title = label or more.get(sid, ('', ''))[0] or tabs.get(sid) or pol.get('title', {}).get(sid) or sid
        desc = pol['desc'].get(sid) or more.get(sid, ('', ''))[1]
        if sid in pol['public']:
            vis = 'public'
        elif sid in pol['describe']:
            vis = 'describe'
        else:
            vis = 'private'
        d = clean(desc)
        out.append({'id': sid, 'title': clean(title), 'group': clean(group) or ('홈' if sid in nav else '그 밖'),
                    'desc': d if ok(d) else '', 'visibility': vis, 'route': '#/' + sid})
    return out, pol


# ── 공개 본문(public/*.json) → 마크다운 ──
def lines_ok(items):
    return [clean(x) for x in (items or []) if ok(clean(x))]


def md_guide(j):
    o = []
    if ok(clean(j.get('notice'))):
        o.append('> ' + clean(j['notice']))
    for s in j.get('sections', []):
        o.append('\n## ' + clean(s['title']))
        for b in s.get('blocks', []):
            t = b.get('type')
            if t == 'h' and ok(clean(b.get('text'))):
                o.append('\n### ' + clean(b['text']))
            elif t == 'p' and ok(clean(b.get('text'))):
                o.append('\n' + clean(b['text']))
            elif t == 'ul':
                o.append('\n' + '\n'.join('- ' + x for x in lines_ok(b.get('items'))))
            elif t == 'table':
                rows = [r for r in b.get('rows', []) if all(ok(clean(c)) or not clean(c) for c in r)]
                if rows:
                    head = [clean(h) for h in b.get('head', [])]
                    o.append('\n| ' + ' | '.join(head) + ' |\n|' + '---|' * len(head))
                    o += ['| ' + ' | '.join(clean(c).replace('|', '/') for c in r) + ' |' for r in rows]
    if ok(clean(j.get('ask'))):
        o.append('\n' + clean(j['ask']))
    return o


def md_library(j):
    cats = {c['v']: clean(c['t']) for c in j.get('cats', [])}
    o = ['위치(업무 PC·내부 보관 경로)는 공개 문서에 싣지 않아요.']
    for cv, ct in cats.items():
        items = [i for i in j.get('items', []) if i.get('cat') == cv and ok(clean(i.get('title')))]
        if not items:
            continue
        o.append('\n## ' + ct)
        for i in items:
            o.append('\n### ' + clean(i['title']))
            if ok(clean(i.get('sub'))):
                o.append(clean(i['sub']))
            st = lines_ok(i.get('steps'))
            if st:
                o.append('\n' + '\n'.join('%d. %s' % (n + 1, x) for n, x in enumerate(st)))
            nt = lines_ok(i.get('notes'))
            if nt:
                o.append('\n' + '\n'.join('- ' + x for x in nt))
            if ok(clean(i.get('basis'))):
                o.append('\n근거: ' + clean(i['basis']))
            lk = str(i.get('link') or '')
            if lk.startswith('https://') and ok(lk):
                o.append('\n바깥 링크: <' + lk + '>')
    return o


def md_judge(j):
    o = ['선택을 고르면 위에서부터 처음 맞는 규칙 하나가 결론이에요. 아래는 그 규칙을 글로 옮긴 거예요.']
    for k in j.get('kinds', []):
        o.append('\n## ' + clean(k.get('title') or k.get('tab')))
        if ok(clean(k.get('lead'))):
            o.append(clean(k['lead']))
        labs = {}
        for inp in k.get('inputs', []):
            opts = {str(x.get('v')): clean(x.get('t')) for x in inp.get('opts', [])}
            labs[inp['id']] = (clean(inp.get('label')), opts)
        if labs:
            o.append('\n고르는 칸: ' + ' · '.join(v[0] + ('(' + '/'.join(v[1].values()) + ')' if v[1] else '') for v in labs.values()))
        for r in k.get('rules', []) + k.get('adds', []):
            cond = []
            for key, val in (r.get('when') or {}).items():
                lab, opts = labs.get(key, (key, {}))
                if isinstance(val, list):
                    v = '/'.join(opts.get(str(x), str(x)) for x in val)
                elif isinstance(val, dict):
                    v = ' '.join('%s %s' % ({'gte': '≥', 'gt': '>', 'lte': '≤', 'lt': '<', 'from': '부터', 'to': '까지', 'empty': '빈칸'}.get(a, a), '' if a == 'empty' else b) for a, b in val.items()).strip()
                else:
                    v = opts.get(str(val), str(val))
                cond.append(lab + '=' + clean(v))
            verdict = clean(r.get('verdict'))
            if not ok(verdict):
                continue
            o.append('\n- **' + (' · '.join(cond) or '그 밖') + '** → ' + verdict)
            o += ['  - ' + x for x in lines_ok(r.get('reasons'))]
            b = lines_ok(r.get('basis'))
            if b:
                o.append('  - 근거: ' + ' · '.join(b))
    return o


def md_docgen(j):
    o = ['칸을 채우면 초안이 만들어져요. 입력한 내용은 쓰는 사람 기기에만 남고 이 문서에는 없어요.']
    for t in j.get('templates', []):
        o.append('\n## ' + clean(t['title']))
        if ok(clean(t.get('설명'))):
            o.append(clean(t['설명']))
        f = [clean(x.get('label')) for x in t.get('fields', []) if ok(clean(x.get('label')))]
        if f:
            o.append('\n채우는 칸: ' + ' · '.join(f))
        b = lines_ok(t.get('근거'))
        if b:
            o.append('\n근거:\n' + '\n'.join('- ' + x for x in b))
        c = lines_ok(t.get('주의'))
        if c:
            o.append('\n주의:\n' + '\n'.join('- ' + x for x in c))
    return o


KIND = {'guide': md_guide, 'library': md_library, 'judge': md_judge, 'docgen': md_docgen}


def head(s, extra=''):
    return ['# ' + s['title'], '', '> ' + (s['desc'] or '데이터 없음'), '',
            '- 앱에서 열기: <' + SITE + s['route'] + '> (자바스크립트 필요)',
            '- 묶음: ' + s['group'], '- 만든 곳: tools/make_llms.py (소스에서 자동 생성, 손으로 고치지 않음)' + extra, '']


def build():
    ss, pol = screens()
    files = {}
    for s in ss:
        if s['visibility'] == 'public':
            p = pol['public'][s['id']]
            j = json.loads(read(*p['src'].split('/')))
            body = KIND[p['kind']](j)
            upd = clean(j.get('updated') or j.get('version') or '')
            files['ai/%s.md' % s['id']] = '\n'.join(head(s, ('\n- 자료 날짜: ' + upd) if upd else '') + body).strip() + '\n'
        elif s['visibility'] == 'describe':
            files['ai/%s.md' % s['id']] = '\n'.join(head(s) + [
                '이 화면은 앱 안에서 자료를 불러와 그려요. 이 문서에는 화면 설명만 있고 원본 자료는 싣지 않아요.']).strip() + '\n'
    pub = [s for s in ss if s['visibility'] != 'private']
    prv = [s for s in ss if s['visibility'] == 'private']
    L = ['# 행정 업무 연습장', '',
         '> 경남항공교육원 행정 업무 연습장(hj-app). 학생 안내·업무 판정·문서 초안·자료함 같은 공개 안내 화면을 자바스크립트 없이 읽을 수 있게 마크다운으로 둔 목록이에요. 실제 결재·개인정보 정본이 아니에요.', '',
         '- 사이트: <' + SITE + '> (앱은 자바스크립트로 그려요. 아래 .md 는 정적 파일이에요)',
         '- 화면 색인(JSON): [ai/index.json](ai/index.json)', '- 공개 본문 한 파일: [llms-full.txt](llms-full.txt)',
         '- 개인정보·원본 문서·실명은 싣지 않아요. 자료가 없으면 「데이터 없음」.', '']
    L.append('## 공개 안내 (본문 있음)\n')
    L += ['- [%s](ai/%s.md): %s' % (s['title'], s['id'], s['desc'] or '데이터 없음') for s in pub if s['visibility'] == 'public']
    L.append('\n## 화면 설명\n')
    L += ['- [%s](ai/%s.md): %s' % (s['title'], s['id'], s['desc'] or '데이터 없음') for s in pub if s['visibility'] == 'describe']
    L.append('\n## Optional\n')
    L.append('- [비공개 화면 %d개](ai/index.json): %s — 모두 「비공개」. 내용·주소는 싣지 않아요.' % (len(prv), ' · '.join(s['title'] for s in prv)))
    files['llms.txt'] = '\n'.join(L).strip() + '\n'
    full = ['# 행정 업무 연습장 — 공개 본문 모음', '', '> llms.txt 의 공개 .md 를 한 파일로 이어 붙였어요(tools/make_llms.py).', '']
    for s in pub:
        full += ['', '---', '', files['ai/%s.md' % s['id']].strip()]
    files['llms-full.txt'] = '\n'.join(full).strip() + '\n'
    idx = {'version': 1, 'site': SITE, 'generator': 'tools/make_llms.py', 'llms': 'llms.txt',
           'screens': [dict({k: s[k] for k in ('id', 'title', 'group', 'desc', 'route')}, visibility='공개' if s['visibility'] != 'private' else '비공개',
                            md=('ai/%s.md' % s['id']) if s['visibility'] != 'private' else None, body=s['visibility'] == 'public')
                       if s['visibility'] != 'private' else {'id': s['id'], 'title': s['title'], 'visibility': '비공개'} for s in ss]}
    files['ai/index.json'] = json.dumps(idx, ensure_ascii=False, indent=1) + '\n'
    R = ['# 만든 곳: tools/make_llms.py (손으로 고치지 말 것)',
         '# AI 수집기: llms.txt · llms-full.txt · ai/ (공개 안내 마크다운)만 허용. 앱 화면은 막음.',
         '# 그 밖(Googlebot 등 검색엔진)은 전체 막음 → 검색 색인은 열지 않아요(「링크 있는 사람」 공개 유지).', '']
    R += ['User-agent: ' + b for b in AI_BOTS]
    R += ['Allow: ' + pre + p for pre in PREFIXES for p in AI_PATHS]
    R += ['Disallow: /', '', 'User-agent: *', 'Disallow: /']
    files['robots.txt'] = '\n'.join(R) + '\n'
    return files, ss


def main(argv):
    files, ss = build()
    bad = [f for f, t in files.items() for line in t.splitlines() if pii(line) or (BAN.search(line) and not line.startswith('#'))]
    if bad:
        print('개인정보·금지 낱말 의심 파일:', sorted(set(bad)))
        return 2
    want = set(files)
    have = {'ai/' + f for f in os.listdir(os.path.join(ROOT, 'ai')) if f.endswith('.md') or f.endswith('.json')} if os.path.isdir(os.path.join(ROOT, 'ai')) else set()
    stale = sorted(have - want)
    if '--check' in argv:
        diff = [f for f, t in files.items() if not os.path.exists(os.path.join(ROOT, f)) or read(*f.split('/')) != t]
        if diff or stale:
            print('소스와 다름:', diff, '남은 파일:', stale)
            return 1
        print('같음: %d개 파일, 화면 %d개' % (len(files), len(ss)))
        return 0
    os.makedirs(os.path.join(ROOT, 'ai'), exist_ok=True)
    for f, t in files.items():
        with open(os.path.join(ROOT, f), 'w', encoding='utf-8') as fh:
            fh.write(t)
    if stale:
        print('소스에 없는 ai/ 파일(손으로 /home/box/.trash 로 옮기세요):', stale)
    pub = sum(1 for s in ss if s['visibility'] != 'private')
    print('만듦: %d개 파일 · 화면 %d개(공개 %d · 비공개 %d)' % (len(files), len(ss), pub, len(ss) - pub))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
