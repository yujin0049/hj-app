#!/usr/bin/env python3
"""사람별 하는 일(people_roles.json) + 협조(coop.json) 정본 생성기 — 같은 입력 → 같은 출력.

T2 (261111 춘식이 kv 「협조·사람현황 앱정본」): 볼트 99 봇/스크립트/people_roles_v01.py 를 저장소로 옮김.
  1단계 base   : 문서대장(19개) + 주소록 xlsx → v01 모양 사람 목록 (v01 과 같은 셈법, 시각·난수 없음)
  2단계 patch  : 업무분장 patch json(들) → people_roles v02 · coop v10 (같은 patch 를 두 번 넣어도 결과 같음)
  3단계 검사   : 주소록·기준판·허용목록 밖 실명 / 연락처·생년월일 꼴 / since(발령일) 칸 → 쓰지 않고 rc 2

사용:
  python3 tools/make_people_roles.py --config CFG.json [--out-people data/people_roles.json] [--out-coop data/coop.json] [--check]
  입력 경로는 전부 인자(또는 --config)로 받음. 저장소에는 개인 자료 경로 기본값 없음.
  --docreg-v04 XLSX : 문서대장 우선순위 v04 — 아직 처리 안 함(보류). 주면 rc 3 으로 멈춤.
종료 코드: 0 성공 · 1 --check 에서 파일이 다름 · 2 개인정보·기준선 밖 이름(아무것도 안 씀) · 3 입력 없음/보류 입력
"""
import argparse, collections, contextlib, copy, io, json, os, re, sys
from pathlib import Path

MASK_RX = re.compile(r'\*')
PHONE_RX = re.compile(r'01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}')
RRN_RX = re.compile(r'\d{6}-?[1-4]\d{6}')
PRIVATE_KEYS = {'since', 'phone', 'mobile', 'birth', 'birthday', '휴대폰', '생년월일', 'email'}


def mask(n):
    return n[0] + '*' * (len(n) - 2) + n[-1] if len(n) > 2 else n[0] + '*'


def load_json(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def dumps(obj, indent=1):
    return json.dumps(obj, ensure_ascii=False, indent=indent) + '\n'


# ───────────────────────── 1단계: v01 셈법 그대로 ─────────────────────────
def sources(cfg):
    out = []
    d = Path(cfg['docreg_dir'])
    for p in sorted(d.glob('문서등록대장_*261027.xls')) + sorted(d.glob('문서등록대장_*~1009.xls')):
        out.append((str(p), 0, f'D원본/{p.name}'))
    inbox = cfg.get('inbox') or {}
    for name, pri in inbox.get('files', []):
        p = Path(inbox['dir']) / name
        if p.exists():
            out.append((str(p), pri, f'받은함/{name}'))
    for path, pri, label in cfg.get('extra', []):
        if os.path.exists(path):
            out.append((path, pri, label))
    return out


def rebuild(cfg):
    """v01 과 같은 셈 → (공개 사람 목록, 볼트 쪽 {실명: 공개 id·label·dept}, 주소록 이름 집합, 출처 이름표, 원자료 건수)"""
    sys.path.insert(0, cfg['coop_lib'])
    import build_coop_graph as B  # noqa: E402  (load_xls 등만 씀)
    import openpyxl  # noqa: E402
    a = argparse.Namespace(directory=cfg['directory'])
    SRC = sources(cfg)
    rows = []
    with contextlib.redirect_stdout(io.StringIO()):
        for path, pri, label in SRC:
            rows += B.load_xls(path, pri, label)[0]
    by_key = {}
    for r in rows:
        k = (r['docno'], r['reg'])
        if k not in by_key or r['priority'] < by_key[k]['priority']:
            by_key[k] = r
    DOCS = sorted(by_key.values(), key=lambda r: (r['docno'], r['reg']))
    N_RAW, N_DEDUP = len(rows), len(DOCS)

    wb = openpyxl.load_workbook(a.directory, read_only=True)
    hdr, *body = list(wb['인물'].iter_rows(values_only=True))
    H = {h: i for i, h in enumerate(hdr)}
    def col(row, prefix):
        for h, i in H.items():
            if h and str(h).startswith(prefix):
                v = row[i]
                return str(v).strip() if v not in (None, '') else None
        return None
    DIR = {}
    for row in body:
        n = col(row, '이름')
        if not n:
            continue
        DIR[n] = {'소속': col(row, '소속'), '직위': col(row, '직위'), '겸직': col(row, '겸직'),
                 '업무': col(row, '업무'), '4.1.판': col(row, '4.1.판')}

    # ── 3. 제목 낱말 묶음 ──
    CATS = [
        ('지출결의·원인행위', ['지출결의', '원인행위', '지출의뢰', '지출품의', '결의']),
        ('강사료·수당', ['강사료', '수당', '시간강사']),
        ('급여·보험·세금', ['급여', '보험', '원천', '연말정산', '간이지급', '세금', '인건비']),
        ('예산·결산·정산', ['예산', '결산', '사업비', '집행', 'e나라', '나라도움', '정산']),
        ('계약·구매·검수', ['계약', '구매', '검수', '견적', '납품', '입찰']),
        ('물품·장비·재료', ['물품', '기자재', '재물', '비품', '재료']),
        ('시설·공사·안전', ['시설', '공사', '보수', '안전', '소방', '전기', '승강기', '청사']),
        ('차량·당직', ['차량', '당직', '관용']),
        ('인사·복무·채용', ['인사', '복무', '채용', '임용', '발령', '휴가', '겸직', '겸무', '근무']),
        ('출장·여비', ['출장', '여비']),
        ('학사·수업·성적', ['학사', '수업', '성적', '시험', '학점', '시간표', '수강', '휴강', '보강', '출석']),
        ('교육과정·교양', ['교육과정', '교양', '교과']),
        ('학적·증명', ['학적', '증명', '자퇴', '제적', '휴학', '복학', '졸업']),
        ('입시·홍보', ['입시', '입학', '모집', '홍보', '박람회']),
        ('장학·근로', ['장학', '근로']),
        ('생활관·기숙사', ['생활관', '기숙사', '입사', '퇴사', '관생']),
        ('현장실습·취업', ['현장실습', '취업', '산업체', '인턴']),
        ('RISE 사업', ['RISE']),
        ('글로컬 사업', ['글로컬']),
        ('국제교류·해외연수', ['국제', '해외', '연수', '유학생', '어학', 'OJNT', '싱가포르']),
        ('규정·입법예고·의견조회', ['규정', '입법예고', '의견조회', '지침', '세칙']),
        ('수요조사·자료제출', ['수요조사', '자료제출', '자료 제출', '제출 요청', '조사']),
        ('회의·협의회', ['회의', '위원회', '간담회', '협의회']),
        ('행사·특강·교육', ['행사', '특강', '설명회', '워크숍', '캠프', '교육 실시']),
        ('전산·보안·시스템', ['전산', '보안', '홈페이지', '시스템', '개인정보', '네트워크', '소프트웨어', '정보화']),
        ('정보공시·통계', ['정보공시', '통계', '공시']),
        ('항공훈련기관·국토부', ['국토', '훈련운영', '전문교육기관', '항공훈련', '정기검사', '정기심사']),
        ('도서관', ['도서']),
        ('인권·상담·장애학생', ['인권', '상담', '장애']),
        ('평생교육', ['평생교육']),
    ]
    OTHER = '기타 공문'
    def cats_of(title):
        t = title or ''
        hit = [lab for lab, kws in CATS if any(k in t for k in kws)]
        return hit or [OTHER]

    NAMHAE_ORIG = ('남해캠퍼스', '대학운영실', '행정지원과', '경남항공교육원', '항공정비과', '항공호텔관광과', '호텔조리제빵경영과',
                   '방산기계AI과', '에너지산업안전과', '원예조경과', '학생생활관')
    def namhae_orig(orig):
        pre = re.sub(r'-\d+$', '', orig or '')
        return bool(pre) and any(k in pre for k in NAMHAE_ORIG)

    def orig_dept(orig):
        pre = re.sub(r'-\d+$', '', orig or '')
        for k in NAMHAE_ORIG[1:]:
            if k in pre:
                return k
        return pre.replace('남해캠퍼스', '') or None

    def ymd(reg):
        m = re.match(r'(\d{4})\.(\d{2})\.(\d{2})', reg or '')
        return f'{m.group(1)}-{m.group(2)}-{m.group(3)}' if m else None

    ROLES = ('기안', '접수', '결재', '원문기안')

    # 앱 data/dept_spider.json(커밋 7959a1a) 부서 이름·reg_catalog 그대로(해시태그가 맞게)
    DEPT_SET = {'글로컬대학사업센터', '대학운영처', '원예조경과', '대학홍보원', '글로컬인재교육원', '에너지산업안전과', '교육혁신처', '국립대학육성사업단',
                '대학운영실', '방산기계AI과', '기획처', '기획과', '교무과', '항공호텔관광과', '교무처', '산학기획과', '경남항공교육원', '학생생활관',
                '글로컬국제협력센터', '산학기획본부', '항공정비과', '교육학사과', '재무과', '호텔조리제빵경영과', '사무국', '글로컬대학사업단', '도서관',
                '행정지원과', '정보전산원', '취업현장실습지원센터', '평생교육원', 'RISE본부', '총무과'}
    REG_CATALOG = [
        ('국립창원대 위임전결규정', ['위임전결', '전결', '사무분장개정', '입법예고']),
        ('국립창원대 학사운영규정', ['학사운영', '휴보강', '휴강', '보강', '출석인정', '수강신청', '성적', '학적']),
        ('국립창원대 학칙', ['학칙', '학적', '입학', '졸업', '전과', '휴학', '복학']),
        ('경남항공교육원 교육규정', ['교육규정', '주임교관', '전문교육기관', '이수증명', '교관']),
        ('경남항공교육원 운영규정(제141호)', ['운영규정', '학사보고', '항공교육훈련포털', '교육원운영']),
        ('훈련운영기준', ['훈련운영', '훈련기준']),
        ('강사료지급규정·특례지침', ['강사료', '초과강사료', '시간강사']),
        ('공무원여비규정(국내여비)', ['여비', '출장', '국내여비', '출장신청', '출장정산']),
        ('국가계약법·입찰및계약업무처리지침', ['계약', '입찰', 'MAS', '제안요청', '검수', '감독공무원', '검사(수)']),
        ('국고금관리법·회계(원인·결의)', ['원인행위', '지출결의', '징수결의', '과목경정', '대체결의', 'KORUS']),
        ('글로컬대학사업 지침·세부사업', ['글로컬', 'e나라도움', '나라도움', '제반사항']),
        ('RISE/앵커사업', ['RISE', '앵커', '리빙랩']),
        ('학생생활관규정·관생수칙', ['생활관', '기숙사', '입사', '관생', '실거주']),
        ('개인정보보호법', ['개인정보', '고유식별', '정보공개']),
        ('항공안전법·시행규칙', ['항공안전', '면장', '정비사']),
    ]
    ALIAS = {'남해캠퍼스RISE본부': 'RISE본부', '글로컬국제': '글로컬국제협력센터', '글로컬사업': '글로컬대학사업센터'}
    def short(dname):
        return B.short_dept(dname or '') if dname else ''
    def norm_dept(c):
        c = (c or '').strip()
        if not c or c.startswith('?'):
            return None
        c = ALIAS.get(c, c)
        if c in DEPT_SET:
            return c
        c2 = c.replace('남해캠퍼스', '')
        if c2 in DEPT_SET:
            return c2
        for k in sorted(DEPT_SET, key=len, reverse=True):
            if k in c:
                return k
        return None
    DOC_BY_NO = {}
    for _r in DOCS:
        DOC_BY_NO.setdefault(_r['docno'], _r)
    ORIG_ROW = {}
    for _r in DOCS:
        if _r['orig']:
            ORIG_ROW.setdefault(_r['orig'], _r)
    # 일괄 공지 판정: 같은 원문서번호가 19개 대장 중 5곳 이상에 수신으로 들어왔거나, 보낸 문서 수신처가 5개 부서 이상
    MASS_MIN = 5
    ORIG_SPREAD = collections.defaultdict(set)
    for _r in DOCS:
        if _r['kind'] == '수신' and _r['orig']:
            ORIG_SPREAD[_r['orig']].add(_r['dept'])
    def is_mass(r, rcv=None):
        key = r['orig'] if r['kind'] == '수신' else r['docno']
        if key and len(ORIG_SPREAD.get(key, ())) >= MASS_MIN:
            return True
        return rcv is not None and len(set(rcv)) >= MASS_MIN
    # 공개 파일에서 이름을 가릴 주소록 사람(todo.json 과 같게)
    MASK_DIR = set()  # 10.29. 20:14 지시: 주소록 교직원은 모두 실명
    REG_NAME_RX = re.compile(r'[가-힣A-Za-z0-9]{2,30}(?:규정|학칙|지침|세칙|규칙)')

    # ── 4. 사람별 모으기 ──
    P = collections.defaultdict(lambda: {r: {} for r in ROLES})   # name → role → {docno: (reg, title, dept_short)}
    for r in DOCS:
        dr, apv = (r['drafter'] or '').strip(), (r['approver'] or '').strip()
        item = (r['reg'] or '', r['title'] or '', r['dept_short'] or r['dept'] or '')
        if dr:
            P[dr]['접수' if r['kind'] == '수신' else '기안'][r['docno']] = item
        if apv and apv != dr:
            P[apv]['결재'][r['docno']] = item
    reg_people = set(P)   # 기안·접수·결재로 나온 사람(남해캠 대장 담당자)
    for r in DOCS:
        od = (r['orig_drafter'] or '').strip()
        if od and (od in DIR or od in reg_people) and namhae_orig(r['orig']) and r['orig']:
            P[od]['원문기안'].setdefault(r['orig'], (r['reg'] or '', r['title'] or '', r['dept_short'] or ''))
    for n in list(P):
        own = set(P[n]['기안'])
        P[n]['원문기안'] = {k: v for k, v in P[n]['원문기안'].items() if k not in own}

    register_only = sorted(n for n in reg_people if n not in DIR and re.fullmatch(r'[가-힣]{2,4}', n))
    people_names = sorted(DIR) + register_only

    def mask(n):
        return n[0] + '*' * (len(n) - 2) + n[-1] if len(n) > 2 else n[0] + '*'

    VERB = {'기안': '기안', '접수': '접수', '결재': '결재', '원문기안': '원문기안(다른 부서 대장)'}
    PREF = {'기안': 0, '결재': 1, '접수': 2, '원문기안': 3}

    def build(n, xid):
        d = DIR.get(n)
        roles = P.get(n, {r: {} for r in ROLES})
        counts = {r: len(roles[r]) for r in ROLES}
        counts['협조제목'] = sum(1 for v in roles['기안'].values() if '협조' in v[1])
        total = sum(counts[r] for r in ROLES)
        # 낱말 묶음 × 역할 건수
        cat = collections.defaultdict(lambda: collections.Counter())
        cat_docs = collections.defaultdict(list)
        for role in ROLES:
            for docno, (reg, title, dsh) in roles[role].items():
                for c in cats_of(title):
                    cat[c][role] += 1
                    cat_docs[c].append((PREF[role], tuple(-int(x) for x in re.findall(r'\d+', reg)[:3]) or (0,), docno, role, title, reg))
        order = sorted(cat, key=lambda c: (c == OTHER, -sum(cat[c].values()), c))
        # 대표 문서: 위 묶음에서 하나씩(기안>결재>접수>원기안, 최근 먼저), 모자라면 전체에서
        picks, seen = [], set()
        for c in order:
            for t in sorted(cat_docs[c]):
                if t[2] not in seen:
                    picks.append((c,) + t); seen.add(t[2]); break
            if len(picks) == 3:
                break
        # 소속
        ledger = collections.Counter()
        for role in ('기안', '접수', '결재'):
            for v in roles[role].values():
                ledger[v[2]] += 1
        main_ledger = sorted(ledger.items(), key=lambda kv: (-kv[1], kv[0]))[0][0] if ledger else None
        own = collections.Counter(v[2] for role in ('기안', '접수') for v in roles[role].values())
        own_main = sorted(own.items(), key=lambda kv: (-kv[1], kv[0]))[0][0] if own else None
        orig_led = collections.Counter(orig_dept(k) for k in roles['원문기안'])
        orig_main = sorted(orig_led.items(), key=lambda kv: (-kv[1], kv[0]))[0][0] if orig_led else None
        inferred_notes = []
        campus = None
        if d:
            dept = d['소속'] if d['소속'] and not d['소속'].startswith('(') else None
            if not dept:
                why = re.sub(r'\s*—.*$', '', (d['소속'] or '소속 빈칸').strip('()'))
                if main_ledger:
                    dept = main_ledger
                    inferred_notes.append(f'추론: 주소록상 8.13.판 소속 없음({why}) → 기안·결재가 가장 많은 대장 부서({dept})를 소속으로 봄')
                elif orig_main:
                    dept = orig_main
                    inferred_notes.append(f'추론: 주소록상 8.13.판 소속 없음({why}) → 원문기안 문서번호 부서({dept})를 소속으로 봄')
                else:
                    inferred_notes.append(f'주소록상 8.13.판 소속 없음({why}) · 문서대장 근거 없음 → 소속 미상')
            elif own_main and own[own_main] >= 10 and own_main not in dept and own_main not in (d['겸직'] or '') and dept not in own_main:
                inferred_notes.append(f'추론: 기안·접수 대부분이 {own_main} 대장에 있음(주소록상 소속 {dept}) — 이동·겸직·대장 담당일 수 있음, 확인 필요')
            rank_inf = d['직위']
            rank_conf = '확정' if d['직위'] else None
            rank_ev = '주소록상 직위(8.13.판 인물업무분장표 v02)' if d['직위'] else None
        else:
            dept = main_ledger
            all_led = {v[2] for role in ROLES for v in roles[role].values()}
            if all_led == {'정보전산원'}:
                campus = '창원캠 추정'
                inferred_notes.append('추론: 남해캠 주소록에 없고 문서가 모두 정보전산원 대장에만 있음 → 창원캠 추정(공개 파일에서 뺌). 직위 미확인')
            else:
                inferred_notes.append(f'추론: 남해캠 주소록에 없음 → 문서대장 부서({main_ledger})를 소속으로 봄. 캠퍼스·직위 미확인')
            rank_inf = rank_conf = rank_ev = None
        # 상대 부서·규정
        link = collections.defaultdict(set)
        regc = collections.defaultdict(set)
        for role in ROLES:
            for docno in roles[role]:
                r = DOC_BY_NO.get(docno) if role != '원문기안' else ORIG_ROW.get(docno)
                if r is None:
                    continue
                if role == '원문기안':
                    mass = is_mass({'kind': '수신', 'orig': docno, 'docno': ''})
                    cps = [] if mass else [r['dept_short'] or short(r['dept'])]
                else:
                    _, _, snd, rcv = B.classify_direction(r)
                    mass = is_mass(r, rcv)
                    cps = [] if mass else list(snd) + list(rcv)
                    if '협조' in (r['title'] or '') and not mass:
                        cps += B.canon_depts_from_text(r['title'])
                for c in cps:
                    c = norm_dept(c)
                    if c and c != dept:
                        link[c].add(docno)
                for lab, kws in REG_CATALOG:
                    if any(k in (r['title'] or '') for k in kws):
                        regc[lab].add(docno)
        links_dept = [{'dept': k, 'n': len(v)} for k, v in sorted(link.items(), key=lambda kv: (-len(kv[1]), kv[0])) if len(v) >= 2][:5]
        regs = [{'name': k, 'n': len(v)} for k, v in sorted(regc.items(), key=lambda kv: (-len(kv[1]), kv[0])) if len(v) >= 2][:5]
        # 하는 일 줄
        lines = []
        if d and d['업무']:
            lines.append(f'주소록상 업무: {d["업무"]}')
        want = 3 - len(lines)
        for c in [c for c in order if c != OTHER][:want] or ([OTHER] if total else []):
            parts = '·'.join(f'{VERB[r]} {cat[c][r]}' for r in ROLES if cat[c][r])
            lines.append(f'{c}: {parts}건')
            if len(lines) == 3:
                break
        if total == 0:
            lines.append('문서대장 근거 없음(19개 대장 3.~10.)')
        periods = sorted(ymd(v[0]) for role in ROLES for v in roles[role].values() if ymd(v[0]))
        base = {
            'id': f'person:{xid}' if xid else f'person:{n}',
            'label': mask(n) if xid else n,
            'in_directory': bool(d),
            'dept': dept,
            'rank': None,
            'rank_inferred': rank_inf,
            'rank_confidence': rank_conf,
            'rank_evidence': rank_ev,
            'roles_summary': lines,
            'inferred': bool(inferred_notes),
            'inferred_notes': inferred_notes,
            'doc_nos': [p[3] for p in picks],
            'counts': {k: counts[k] for k in ('기안', '접수', '결재', '원문기안', '협조제목')},
            'links_dept': links_dept,
            'regs': regs,
            'period': {'first': periods[0], 'last': periods[-1]} if periods else None,
        }
        vault = dict(base)
        vault['id'] = f'person:{n}'
        vault['label'] = n
        vault['campus_note'] = campus
        vault['public_id'] = None if campus else base['id']
        vault['public_label'] = None if campus else base['label']
        if d:
            vault['directory'] = {k: d[k] for k in ('소속', '직위', '겸직', '업무', '4.1.판')}
        vault['main_ledger'] = main_ledger
        tn = collections.Counter()
        for role in ROLES:
            for docno, (reg, title, dsh) in roles[role].items():
                for m in sorted(set(REG_NAME_RX.findall(title))):
                    tn[m] += 1
        vault['regs_title_names'] = [{'name': k, 'n': v} for k, v in sorted(tn.items(), key=lambda kv: (-kv[1], kv[0]))[:5]]
        vault['categories'] = [{'cat': c, **{r: cat[c][r] for r in ROLES if cat[c][r]},
                                'examples': [{'docno': t[2], 'role': t[3], 'reg': ymd(t[5]), 'title': t[4]} for t in sorted(cat_docs[c])[:3]]}
                               for c in order[:6]]
        vault['doc_refs'] = [{'docno': p[3], 'cat': p[0], 'role': p[4], 'title': p[5], 'reg': ymd(p[6])} for p in picks]
        return base, vault

    pub_people, vault_people = [], []
    xmap = {n: f'x{i + 1:02d}' for i, n in enumerate(sorted(set(register_only) | (MASK_DIR & set(DIR))))}
    for n in people_names:
        b, v = build(n, xmap.get(n))
        vault_people.append(v)
        if not v['campus_note']:
            pub_people.append(b)
    pub_people.sort(key=lambda p: (not p['in_directory'], p['dept'] or '', p['id']))
    vault_people.sort(key=lambda p: (not p['in_directory'], bool(p['campus_note']), p['dept'] or '', p['id']))

    n_inf = sum(1 for p in pub_people if p['inferred'])
    n_zero = sum(1 for p in pub_people if not any(p['counts'][r] for r in ROLES))
    n_cw = sum(1 for p in vault_people if p['campus_note'])
    v_inf = sum(1 for p in vault_people if p['inferred'])
    vmap = {v['label']: {'id': v['public_id'], 'label': v['public_label'], 'dept': v['dept'], 'in_directory': v['in_directory']}
            for v in vault_people}
    n_d_orig = sum(1 for s in SRC if s[2].startswith(('D원본/', '받은함/')))
    counts = {'n_raw': N_RAW, 'n_dedup': N_DEDUP, 'n_sources': len(SRC), 'n_directory': len(DIR),
              'n_register_only': len(register_only) - n_cw, 'n_people': len(pub_people), 'n_inferred': n_inf, 'n_no_docs': n_zero,
              'sources': ['문서등록대장(부서별 %d개)' % n_d_orig, '문서등록대장 다른 사본(%d개)' % (len(SRC) - n_d_orig)]}
    return pub_people, vmap, set(DIR), counts


V01_META = {
    'rank_note': '문서대장 직급 컬럼 없음 → rank=null. rank_inferred는 주소록상 직위만(confidence=확정). 주소록에 없으면 null.',
    'fields': {'counts': '기안=직접 만든 문서 · 접수=받은 공문 접수 · 결재=결재(담당)자(기안자와 다를 때) · 원문기안=남해캠 다른 부서 대장에 원기안자로 나온 문서 · 협조제목=기안 중 제목에 「협조」',
               'roles_summary': '주소록상 업무 + 제목 낱말 묶음별 건수(많은 순)', 'inferred': '주소록·제목에 직접 없는 것(소속 추정 등) 있으면 true, inferred_notes에 「추론」',
               'links_dept': '그 사람 문서(기안·접수·결재·원문기안)의 상대 부서: 수신=발신처, 발신·시행=수신처, 원문서번호 부서, 원문기안=받은 대장 부서, 제목 「협조」=제목 속 부서. 일괄 공지(같은 원문서번호가 19개 대장 중 5곳 이상에 수신, 또는 수신처 5개 부서 이상) 뺌. 자기 소속 뺌, dept_spider 부서명만, 2건 이상, 많은 순 5개',
               'regs': '앱 규정목록(dept_spider reg_catalog 15개) 낱말이 그 사람 문서 제목에 든 건수. 2건 이상, 많은 순 5개. 없으면 빈 목록'},
}


def v01_doc(pub_people, counts, cfg):
    """v01 공개판(main fd6a908 의 data/people_roles.json)과 바이트까지 같은 모양"""
    sc = {k: counts[k] for k in ('n_raw', 'n_dedup', 'n_sources')}
    sc['directory'] = cfg.get('directory_label', '주소록(8.13.)')
    sc.update({k: counts[k] for k in ('n_directory', 'n_register_only', 'n_people', 'n_inferred', 'n_no_docs')})
    meta = {'id': 'D261029_people_roles_v01', 'generated': '2026-10-29',
            'request': '유진님 10.29. 19:57 남해캠 주소록상 사람별 하는 일(문서대장 기반) → 앱 협조 화면',
            'source_counts': sc, 'rank_note': V01_META['rank_note'],
            'notice': '실명은 주소록상 교직원만(coop·dept_spider와 같은 규칙). 주소록에 없으면 김*수 꼴로 가림, id=person:xNN. 정보전산원 대장에만 나온 사람(창원캠 추정)은 뺌. 전화·내선·메일·주민번호·생년 없음. 제목 원문 없음. 규정은 키워드로 맞춘 추정.',
            'fields': V01_META['fields'], 'sources': counts['sources'] + [sc['directory']]}
    return {'meta': meta, 'people': pub_people}


# ───────────────────────── 2단계: 업무분장 patch ─────────────────────────
DROP_NOTE = ('추론: 기안·접수 대부분이', '추론: 남해캠 주소록에 없음', '추론: 주소록상 8.13.판 소속 없음')


def public_ref(name, vmap, dir_names, real_ok, new_ids):
    """patch 실명 → 공개 {id, label, in_directory, merged}. 주소록 사람=실명, 대장에만=xNN 가림(허용목록이면 실명), 새 사람=nNN 가림"""
    if name in dir_names:
        return {'id': f'person:{name}', 'label': name, 'in_directory': True, 'merged': None}
    v = vmap.get(name)
    if v and v.get('id'):
        if name in real_ok:
            return {'id': f'person:{name}', 'label': name, 'in_directory': False, 'merged': v['id']}
        return {'id': v['id'], 'label': v['label'], 'in_directory': False, 'merged': v['id']}
    if name not in new_ids:
        new_ids[name] = 'n%02d' % (len(new_ids) + 1)
    if name in real_ok:
        return {'id': f'person:{name}', 'label': name, 'in_directory': False, 'merged': None}
    return {'id': f'person:{new_ids[name]}', 'label': mask(name), 'in_directory': False, 'merged': None}


def apply_people(doc, patches, vmap, dir_names, real_ok, generated):
    doc = copy.deepcopy(doc)
    people = doc['people']
    by_id = {p['id']: p for p in people}
    new_ids, report = {}, {'masked': [], 'merged': [], 'added': 0, 'updated': 0, 'flagged': 0, 'as_of': None}
    for pt in patches:
        src = pt['meta'].get('source', '')
        m = re.search(r'(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.', src)
        as_of = '%s-%02d-%02d' % (m.group(1), int(m.group(2)), int(m.group(3))) if m else None
        report['as_of'] = as_of
        refs = {x['label']: public_ref(x['label'], vmap, dir_names, real_ok, new_ids) for x in pt['people']}
        for x in pt['people']:
            ref = refs[x['label']]
            p = by_id.get(ref['id']) or (by_id.get(ref['merged']) if ref['merged'] else None)
            if p is None:
                p = {'id': ref['id'], 'label': ref['label'], 'in_directory': False, 'dept': None, 'rank': None,
                     'rank_inferred': None, 'rank_confidence': None, 'rank_evidence': None,
                     'roles_summary': ['문서대장 근거 없음(19개 대장 3.~10.)'], 'inferred': False, 'inferred_notes': [],
                     'doc_nos': [], 'counts': {'기안': 0, '접수': 0, '결재': 0, '원문기안': 0, '협조제목': 0},
                     'links_dept': [], 'regs': [], 'period': None}
                people.append(p)
                by_id[p['id']] = p
                report['added'] += 1
            else:
                report['updated'] += 1
            if ref['merged']:
                report['merged'].append(ref['merged'])
                if p['id'] != ref['id']:
                    p['was_id'] = p['id']   # 가린 id → 실명 id 로 바뀐 경우 바뀜 비교용
                p['id'], p['label'] = ref['id'], ref['label']
                by_id[p['id']] = p
            if not ref['in_directory'] and '*' in ref['label']:
                report['masked'].append(ref['id'])
            p['dept'] = x['dept']
            p['rank'] = x['rank']
            p['rank_confidence'] = '확정'
            p['rank_evidence'] = '업무분장(%s 기준)' % (as_of or '날짜 미상')
            p['duties'] = list(x.get('duties') or [])
            dn = x.get('deputy')
            p['deputy'] = {k: refs.get(dn, public_ref(dn, vmap, dir_names, real_ok, new_ids))[k] for k in ('id', 'label')} if dn else None
            p['as_of'] = as_of
            notes = [n for n in p.get('inferred_notes', []) if not n.startswith(DROP_NOTE)]
            p['inferred_notes'], p['inferred'] = notes, bool(notes)
            if x.get('self') and x.get('app_now', {}).get('dept') and x['app_now']['dept'] != x['dept']:
                p['work_at'] = x['app_now']['dept']
        for x in pt.get('not_in_source', []):
            ref = public_ref(x['label'], vmap, dir_names, real_ok, new_ids)
            p = by_id.get(ref['id'])
            if p is None:
                continue
            p['status_note'] = '~10.31. 센터 팀장(전)' if '팀장' in (x.get('app_now') or {}).get('rank_inferred', '') else '~10.31.(전)'
            p['as_of'] = as_of
            report['flagged'] += 1
    people.sort(key=lambda p: (not p['in_directory'], p['dept'] or '', p['id']))
    for p in people:   # since(발령일)는 공개 안 함
        for k in list(p):
            if k in PRIVATE_KEYS:
                del p[k]
    pt0 = patches[0]['meta'] if patches else {}
    m = doc['meta']
    sc = dict(m['source_counts'])
    sc['n_people'] = len(people)
    sc['n_inferred'] = sum(1 for p in people if p['inferred'])
    sc['n_no_docs'] = sum(1 for p in people if not any(p['counts'][r] for r in ('기안', '접수', '결재', '원문기안')))
    sc['n_patch_people'] = sum(len(pt['people']) for pt in patches)
    doc['meta'] = {
        'id': 'D261111_people_roles_v02', 'generated': generated, 'base': m['id'],
        'request': m['request'] + ' · 유진님 11.11. 업무분장(11.1.) 반영 지시',
        'as_of': report['as_of'], 'patches': [pt['meta']['id'] for pt in patches],
        'source_counts': sc, 'rank_note': m['rank_note'] + ' 업무분장 patch 대상 rank=업무분장 직위(rank_evidence에 기준일).',
        'notice': m['notice'] + ' 업무분장 반영: 소속·직위·담당업무(duties, 원문 그대로)·대리(deputy). 발령일(since)은 공개 안 함. 주소록 밖 인원: 유진님 결정 때까지 가림.',
        'fields': dict(m['fields'], duties='업무분장 담당업무(원문 그대로, 오타 같아 보여도 안 고침)', deputy='업무분장 대리(공개 id·label)',
                       as_of='이 사람 줄의 기준일(업무분장 날짜)', status_note='예전 자리 표시(줄 안 지움)', work_at='근무·지원 대상(소속 칸과 다를 때)'),
        'sources': m['sources'] + ['업무분장(%s)' % (report['as_of'] or '날짜 미상')],
    }
    return doc, report


# coop: 11.1. 팀장 교체 — 「팀장결재」 자리와 결재 줄 노드만 새 팀장으로. 내선은 번호부 대조 뒤에만(없으면 빈칸)
def apply_coop(coop, old, new, new_ext=''):
    c = copy.deepcopy(coop)
    n = {'replaced': 0, 'chain': 0}
    tag = new + (new_ext or '')

    def fix(s):
        if '팀장결재' not in s or old not in s:
            return s
        t = s
        t = re.sub(r'\*\*%s\(\d{4}\)\*\*' % old, '**%s%s**' % (new, '(%s)' % new_ext if new_ext else ''), t)
        t = re.sub(r'%s\(\d{4}\)' % old, new + ('(%s)' % new_ext if new_ext else ''), t)
        t = re.sub(r'%s\(\d{4}·팀장결재\)' % old, new + '(%s팀장결재)' % (new_ext + '·' if new_ext else ''), t)
        t = re.sub(r'%s\d{4}' % old, tag, t)
        t = t.replace('%s=팀장결재' % old, '%s=팀장결재(11.1.~)' % new)
        if t != s:
            n['replaced'] += 1
        return t

    def walk(o):
        if isinstance(o, dict):
            return {k: walk(v) for k, v in o.items()}
        if isinstance(o, list):
            return [walk(v) for v in o]
        return fix(o) if isinstance(o, str) else o
    for k in ('notice', 'top5', 'rows', 'rules', 'edu_now', 'keywords', 'cautions'):
        if k in c:
            c[k] = walk(c[k])
    for r in c.get('rows', []):   # 옛 팀장 내선(7481)을 「/」 목록에서 뺌(바꾼 줄만)
        if new in r.get('who', '') and '팀장결재' in r.get('who', '') and old not in r.get('who', ''):
            parts = [x.strip() for x in r.get('phone', '').split('/')]
            if len(parts) > 1 and '7481' in parts:
                r['phone'] = ' / '.join(x for x in parts if x != '7481')
    for ch in c.get('chains', []):
        for nd in ch.get('nodes', []):
            if nd.get('name') == old:
                nd['name'], nd['ext'] = new, new_ext
                n['chain'] += 1
    for p in c.get('people', []):
        if p.get('name') == old and not p.get('job', '').startswith('~10.31.'):
            p['job'] = '~10.31. 센터 팀장(전) · ' + p['job']
            p['phone_note'] = re.sub(r'\(글로컬 팀장', '(~10.31. 글로컬 팀장(전)', p['phone_note'])
        if p.get('name') == new and '11.1.~' not in p.get('job', ''):
            p['job'] = '글로컬대학사업센터 팀장(11.1.~) · 팀장결재(지출결의) · 내선 번호부 대조 전'
            p['phone_note'] = new_ext
    c['version'] = 'v%d' % max(10, int(re.sub(r'\D', '', c.get('version', 'v0')) or 0))
    return c, n


# ───────────────────────── 3단계: 검사 ─────────────────────────
def check(doc, coop, allowed):
    bad = []
    for p in doc['people']:
        lab = p['label']
        if '*' not in lab and re.fullmatch(r'[가-힣]{2,4}', lab) and lab not in allowed:
            bad.append('기준선 밖 실명 1명')
        dep = (p.get('deputy') or {}).get('label') or ''
        if dep and '*' not in dep and re.fullmatch(r'[가-힣]{2,4}', dep) and dep not in allowed:
            bad.append('기준선 밖 실명(대리) 1명')
        for k in p:
            if k in PRIVATE_KEYS:
                bad.append('비공개 칸 %s' % k)
    for name, obj in (('people_roles', doc), ('coop', coop)):
        s = json.dumps(obj, ensure_ascii=False)
        if PHONE_RX.search(s):
            bad.append('%s 휴대전화 꼴' % name)
        if RRN_RX.search(s):
            bad.append('%s 주민번호 꼴' % name)
        if '생년월일' in s:
            bad.append('%s 생년월일' % name)
    return bad


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', required=True, help='입력 경로 json(docreg_dir·inbox·extra·directory·coop_lib·patches·real_names·generated)')
    ap.add_argument('--out-people')
    ap.add_argument('--out-coop')
    ap.add_argument('--coop-in', help='고칠 coop.json(기본: --out-coop)')
    ap.add_argument('--out-base', help='1단계 v01 판도 따로 씀(검증용)')
    ap.add_argument('--docreg-v04', help='문서대장 우선순위 v04 xlsx — 보류(주면 rc 3)')
    ap.add_argument('--check', action='store_true', help='쓰지 않고 지금 파일과 같은지만(다르면 rc 1)')
    a = ap.parse_args(argv)
    cfg = load_json(a.config)
    if a.docreg_v04 or cfg.get('docreg_v04'):
        print('문서대장 v04 처리는 보류(아직 없음) → 멈춤')
        return 3
    need = [cfg.get('docreg_dir'), cfg.get('directory'), cfg.get('coop_lib')] + list(cfg.get('patches') or [])
    miss = [p for p in need if not p or not os.path.exists(p)]
    if miss:
        print('입력 없음 %d개 → 멈춤(예전 파일 유지)' % len(miss))
        return 3
    pub, vmap, dir_names, counts = rebuild(cfg)
    base = v01_doc(pub, counts, cfg)
    patches = [load_json(p) for p in cfg.get('patches') or []]
    real_ok = set(cfg.get('real_names') or [])
    doc, rep = apply_people(base, patches, vmap, dir_names, real_ok, cfg.get('generated', '2026-11-11'))
    out_files = {}
    if a.out_base:
        out_files[a.out_base] = dumps(base)
    if a.out_people:
        out_files[a.out_people] = dumps(doc)
    coop = None
    if a.out_coop:
        coop_in = load_json(a.coop_in or a.out_coop)
        coop = coop_in
        for pt in patches:
            for f in pt.get('not_in_source', []):
                if '팀장' in (f.get('app_now') or {}).get('rank_inferred', ''):
                    new = next((x['label'] for x in pt['people'] if x['rank'] == '팀장' and x['dept'] == (f.get('app_now') or {}).get('dept')), None)
                    if new:
                        coop, cn = apply_coop(coop, f['label'], new, cfg.get('new_lead_ext', ''))
        coop['updated'] = cfg.get('generated', coop.get('updated'))
        if coop != coop_in and patches and patches[0]['meta']['id'] not in coop.get('source', ''):
            coop['source'] = coop['source'] + ' · ' + patches[0]['meta']['id']
        out_files[a.out_coop] = dumps(coop, indent=2)   # coop.json 은 원래 2칸 들여쓰기
    allowed = dir_names | {p['label'] for p in pub} | real_ok
    bad = check(doc, coop or {}, allowed)
    if bad:
        print('개인정보·기준선 검사 실패 → 아무것도 안 씀: ' + ' / '.join(sorted(set(bad))))
        return 2
    print('people=%d patch_people=%d added=%d updated=%d flagged=%d masked=%d merged=%d as_of=%s' % (
        len(doc['people']), doc['meta']['source_counts']['n_patch_people'], rep['added'], rep['updated'], rep['flagged'],
        len(set(rep['masked'])), len(set(rep['merged'])), rep['as_of']))
    diff = 0
    for path, text in out_files.items():
        old = open(path, encoding='utf-8').read() if os.path.exists(path) else None
        if old != text:
            diff += 1
            if not a.check:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(text)
    print(('다른 파일 %d개' if a.check else '바뀐 파일 %d개') % diff)
    return 1 if (a.check and diff) else 0


if __name__ == '__main__':
    sys.exit(main())
