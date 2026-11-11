#!/usr/bin/env python3
"""남해캠 공지사항(#/notice) 자료 만들기 — 261111 춘식이 kv(대장 전달 「앱에 적용해」).
  python3 tools/make_notices.py [--src /workspace/namhae_notice_261111] [--out-dir data] [--check]
입력(박스 전용, 저장소에 안 넣음): SRC/_list.json(목록) + SRC/_articles.jsonl(본문, 수집 때 주민번호·휴대전화는 이미 「개인정보 포함」으로 가림)
출력(공개):
  data/notices.json        = 목차(건수·연도별 파일·부서 목록·가린 건수). 제목·본문 없음
  data/notices/YYYY.json   = 그 해 글(최신순): 제목·부서·날짜·조회수·첨부파일 이름·nttId(원문 주소는 화면이 만듦)·본문 앞부분 짧게
규칙
- 본문 전문은 안 넣음: 앞부분 SUMMARY_LEN 자만(띄어쓰기 한 칸으로 줄여서).
- 본문에 전화·이메일·주민번호·계좌·「개인정보 포함」(수집 때 가린 자리)·학생 실명 꼴(이름+학생/씨, 성명: 이름)이 있으면
  요약을 빼고 k='pii'(화면 「개인정보 포함·원문 링크만」). 요약 조각에 교직원 이름+호칭이 걸려도 요약 뺌.
- 본문이 비었으면(이미지로만 올린 글) k='img'(화면 「본문 이미지·원문 보기」), 본문을 못 받았으면 k='fail'.
- 제목·첨부파일 이름에 연락처 꼴이 있으면 그 자리만 「개인정보 포함」, 이름+호칭 꼴이면 이름만 ○○ 로 바꿈(t_masked 로 셈).
- 같은 입력 → 같은 출력: 정렬 고정(날짜↓·번호↓·nttId), 시각 안 씀, 키 정렬. --check 는 쓰지 않고 지금 파일과 비교만(다르면 1).
종료 코드: 0 성공 · 1 --check 다름 · 2 출력에 개인정보 꼴이 남음(쓰지 않음) · 3 입력 없음
"""
import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import hjpii  # noqa: E402

SRC_DEFAULT = '/workspace/namhae_notice_261111'
LIST_URL = 'https://www.namhae.ac.kr/namhae_01/web/cop/bbs/selectBoardList.do?bbsId=BBSMSTR_000000000284'
ARTICLE_URL = 'https://www.namhae.ac.kr/namhae_01/web/cop/bbs/selectBoardArticle.do?bbsId=BBSMSTR_000000000284&nttId='
SUMMARY_LEN = 100
MASK = '「개인정보 포함」'
NAME_MASK = '○○'

# 공용 검사(pii_check github·hjpii)와 같은 꼴 + 수집 때 남긴 가림 표시
PHONE = re.compile(r'(?<![\d-])0(?:1[016789]|2|[3-6][1-5]|70|50\d?)[-\s.)]?\d{3,4}[-\s.]?\d{4}(?![\d-])')
RRN = re.compile(r'(?<![\d-])\d{6}\s?[-–—]\s?[1-8](?:\d{6}|(?:\\?[*xX●○#]){4,7}\d{0,2})(?![\d*])')
RRN_BARE = re.compile(r'(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[1-8]\d{6}(?!\d)')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z][A-Za-z-]*(?![\w-])')
ACCOUNT = re.compile(r'(?<![\d-])\d{2,6}(?:-\d{2,8}){1,4}(?![\d-])')
ACCT_CTX = re.compile(r'(계좌|통장|예금주|입금|은행|농협|국민|신한|우리|하나|기업|우체국|새마을|카카오뱅크|토스|수협|부산은행|경남은행|BNK)')
BARE_DIGITS = re.compile(r'(?<![\d-])\d{10,14}(?![\d-])')
DATE_LIKE = re.compile(r'^(19|20)\d\d-\d\d-\d\d$')
HONOR = r'(?:교수님|교수|선생님|선생|주무관|팀장님|팀장|과장님|과장|조교|강사님|강사|학생|씨|님)'
NAME_HONOR = re.compile(r'(?<![가-힣])([가-힣]{2,4})(\s?)(' + HONOR + r')(?![가-힣])')
NAME_LABEL = re.compile(r'((?:성함|성\s?명|이\s?름|예금주)\s*[:：|\t,]\s*)([가-힣]{2,4})(?![가-힣])')
STUDENT_NAME = re.compile(r'(?<![가-힣])[가-힣]{3}\s?(?:학생|씨)(?![가-힣])')
SURNAMES = hjpii.SURNAMES
NOT_NAME = set('유진님 원장님 교수님 선생님 강사님 담당자 수강생 연수생 학생들 참가자 대상자 지원자 신청자 교육생 본인 이름 성명 해당 각자 모든 전체 장애대 장애학생 상태 성별 금액 인정 전에는 서명부 어학과 주무관 부총장 전국대학생 연구장학생 현장견학 현장견학학생 견학학생'.split())


def _account_hit(s):
    for m in ACCOUNT.finditer(s):
        v = m.group(0)
        if DATE_LIKE.match(v):
            continue
        nd = sum(c.isdigit() for c in v)
        if nd >= 10 or (nd >= 8 and ACCT_CTX.search(s)):
            return True
    return bool(ACCT_CTX.search(s) and BARE_DIGITS.search(s))


def _names(s):
    """이름+호칭·「성명: 이름」 꼴에서 사람 이름 후보(공용 검사와 같은 기준)."""
    sn = s
    for w in NOT_NAME:
        if len(w) >= 4:
            sn = sn.replace(w, ' ' * len(w))
    out = []
    for m in NAME_HONOR.finditer(sn):
        n = m.group(1)
        if len(n) >= 3 and n[0] in SURNAMES and n not in NOT_NAME:
            out.append((m.start(1), m.end(1)))
    for m in NAME_LABEL.finditer(sn):
        n = m.group(2)
        if len(n) in (2, 3, 4) and n[0] in SURNAMES and n not in NOT_NAME:
            out.append((m.start(2), m.end(2)))
    return out


def contact_hit(s):
    s = str(s or '')
    return bool(MASK in s or PHONE.search(s) or RRN.search(s) or RRN_BARE.search(s) or EMAIL.search(s) or _account_hit(s))


def body_private(body):
    """요약을 빼야 하는 글인지: 연락처·주민번호·계좌·가림 자리·학생 실명 꼴(「성명: 이름」·「이름 학생/씨」)."""
    if contact_hit(body):
        return True
    for m in NAME_LABEL.finditer(body):
        n = m.group(2)
        if n[0] in SURNAMES and n not in NOT_NAME:
            return True
    for m in STUDENT_NAME.finditer(body):
        n = m.group(0)[:3]
        if n[0] in SURNAMES and n not in NOT_NAME:
            return True
    return False


def scrub_meta(s):
    """제목·첨부 파일명·부서 칸 고치기. 연락처 꼴은 「개인정보 포함」, 이름+호칭 꼴은 이름 자리만 ○○. 돌려줌 = (고친 글자, 바뀜 여부)"""
    s0 = s = str(s or '')
    for rx in (RRN, RRN_BARE, PHONE, EMAIL):
        s = rx.sub(MASK, s)
    if _account_hit(s):
        s = ACCOUNT.sub(lambda m: m.group(0) if DATE_LIKE.match(m.group(0)) else MASK, s)
    spans = sorted(set(_names(s)), reverse=True)
    for a, b in spans:
        s = s[:a] + NAME_MASK + s[b:]
    return s, s != s0


def row_hit(r):
    line = json.dumps(r, ensure_ascii=False, sort_keys=True)
    return contact_hit(line.replace(MASK, '')) or bool(_names(line))


def summary_of(body):
    t = re.sub(r'\s+', ' ', str(body or '')).strip()
    return t if len(t) <= SUMMARY_LEN else t[:SUMMARY_LEN].rstrip() + '…'


def load_src(src):
    lp, ap = os.path.join(src, '_list.json'), os.path.join(src, '_articles.jsonl')
    if not (os.path.exists(lp) and os.path.exists(ap)):
        return None, None
    with open(lp, encoding='utf-8') as f:
        posts = json.load(f).get('posts') or []
    arts = {}
    with open(ap, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except ValueError:
                continue
            nid = str(o.get('nttId') or '')
            if not nid:
                continue
            if o.get('http_ok') or nid not in arts:   # 성공한 줄이 실패 줄보다 우선, 같으면 뒤(최근) 줄
                if not (arts.get(nid, {}).get('http_ok') and not o.get('http_ok')):
                    arts[nid] = o
    return posts, arts


def build(posts, arts):
    seen, rows = set(), []
    cnt = {'pii': 0, 'img': 0, 'fail': 0, 'ok': 0, 't_masked': 0, 'src_masked': 0}
    for p in posts:
        nid = str(p.get('nttId') or '')
        if not nid or nid in seen:
            continue
        seen.add(nid)
        a = arts.get(nid) or {}
        date = str(p.get('작성일') or a.get('본문작성일') or '')
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
            continue
        t, tm = scrub_meta(p.get('제목') or a.get('본문제목') or '')
        files, fm = [], False
        for fn in a.get('첨부파일명') or []:
            x, ch = scrub_meta(fn)
            files.append(x)
            fm = fm or ch
        dept, dm = scrub_meta(p.get('작성자') or '')
        body = a.get('본문') or ''
        if (a.get('개인정보마스킹수') or 0) > 0:
            cnt['src_masked'] += 1
        if not a.get('http_ok'):
            k, s = 'fail', ''
        elif a.get('비밀번호글'):
            k, s = 'fail', ''
        elif not body.strip():
            k, s = 'img', ''
        elif body_private(body):
            k, s = 'pii', ''
        else:
            s = summary_of(body)
            if contact_hit(s) or _names(s):
                k, s = 'pii', ''
            else:
                k = 'ok'
        cnt[k] += 1
        if tm or fm or dm:
            cnt['t_masked'] += 1
        v = p.get('조회수')
        r = {'id': nid, 'd': date, 't': t, 'dept': dept, 'k': k}
        if isinstance(p.get('번호'), int):
            r['no'] = p['번호']
        if isinstance(v, int):
            r['v'] = v
        if files:
            r['f'] = files
        if s:
            r['s'] = s
        # 공용 검사는 한 줄(=글 한 건) 단위: 칸끼리 엮여 걸리면(예: 요약의 「우리」+ 첨부 파일명의 긴 숫자) 요약을 빼고, 그래도 걸리면 숫자 자리를 가림
        if row_hit(r) and 's' in r:
            del r['s']
            cnt[k] -= 1
            k = r['k'] = 'pii'
            cnt[k] += 1
        if row_hit(r):
            sub = lambda x: BARE_DIGITS.sub(MASK, ACCOUNT.sub(lambda m: m.group(0) if DATE_LIKE.match(m.group(0)) else MASK, x))
            r['t'] = sub(r['t'])
            if 'f' in r:
                r['f'] = [sub(x) for x in r['f']]
            if not (tm or fm or dm):
                cnt['t_masked'] += 1
        rows.append(r)
    rows.sort(key=lambda r: (r['d'], r.get('no', -1), int(r['id']) if r['id'].isdigit() else -1, r['id']), reverse=True)
    years = {}
    for r in rows:
        years.setdefault(r['d'][:4], []).append(r)
    depts = {}
    for r in rows:
        if r['dept']:
            depts[r['dept']] = depts.get(r['dept'], 0) + 1
    index = {
        'version': 1,
        'source': LIST_URL,
        'article_url': ARTICLE_URL,
        'n': len(rows),
        'date_min': rows[-1]['d'] if rows else '',
        'date_max': rows[0]['d'] if rows else '',
        'summary_len': SUMMARY_LEN,
        'counts': cnt,
        'years': [{'y': y, 'n': len(years[y]), 'file': 'data/notices/%s.json' % y} for y in sorted(years, reverse=True)],
        'depts': [[d, n] for d, n in sorted(depts.items(), key=lambda kv: (-kv[1], kv[0]))],
    }
    files = {'notices.json': index}
    for y, rs in years.items():
        files['notices/%s.json' % y] = {'y': y, 'n': len(rs), 'rows': rs}
    return files


def dump(o):
    """글 한 건 = 한 줄(공용 개인정보 검사가 줄 단위라, 한 글의 「은행」 낱말이 다른 글 숫자와 엮이지 않게). 키 정렬·시각 없음."""
    one = lambda x: json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    if 'rows' in o:
        head = {k: v for k, v in o.items() if k != 'rows'}
        body = ',\n'.join(one(r) for r in o['rows'])
        return one(head)[:-1] + ',"rows":[\n' + body + '\n]}\n'
    return json.dumps(o, ensure_ascii=False, sort_keys=True, indent=1) + '\n'


def leftover_pii(files):
    """쓰기 전 마지막 검사: 출력 글자에 연락처·이름 꼴이 남았는지(값은 안 돌려줌)."""
    bad = 0
    for o in files.values():
        for _p, s in hjpii.walk_strings(o):
            if s.startswith('https://www.namhae.ac.kr/'):
                continue
            if PHONE.search(s) or RRN.search(s) or RRN_BARE.search(s) or EMAIL.search(s) or _names(s):
                bad += 1
    return bad


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SRC_DEFAULT)
    ap.add_argument('--out-dir', default=os.path.join(ROOT, 'data'))
    ap.add_argument('--check', action='store_true', help='쓰지 않고 지금 파일과 같은지만 봄(다르면 1)')
    a = ap.parse_args(argv)
    posts, arts = load_src(a.src)
    if posts is None:
        print('공지 원자료 없음: %s (예전 파일 유지)' % a.src)
        return 3
    files = build(posts, arts)
    if leftover_pii(files):
        print('공지 출력에 개인정보 꼴이 남음 → 쓰지 않음')
        return 2
    texts = {k: dump(v) for k, v in files.items()}
    old_dir = os.path.join(a.out_dir, 'notices')
    old_years = sorted(f for f in os.listdir(old_dir) if f.endswith('.json')) if os.path.isdir(old_dir) else []
    new_years = sorted(k.split('/', 1)[1] for k in texts if k.startswith('notices/'))
    if a.check:
        same = old_years == new_years and all(
            os.path.exists(os.path.join(a.out_dir, k)) and open(os.path.join(a.out_dir, k), encoding='utf-8').read() == v
            for k, v in texts.items())
        print('공지 자료 %s' % ('같음' if same else '다름'))
        return 0 if same else 1
    os.makedirs(old_dir, exist_ok=True)
    for k, v in texts.items():
        p = os.path.join(a.out_dir, k)
        if os.path.exists(p) and open(p, encoding='utf-8').read() == v:
            continue
        with open(p, 'w', encoding='utf-8') as f:
            f.write(v)
    c = files['notices.json']['counts']
    tot = sum(len(v.encode('utf-8')) for v in texts.values())
    print('공지 %d건 · 파일 %d개 %dB · 요약 %d · 개인정보로 요약 뺌 %d · 본문 이미지 %d · 본문 못 받음 %d · 제목/첨부 가림 %d' % (
        files['notices.json']['n'], len(texts), tot, c['ok'], c['pii'], c['img'], c['fail'], c['t_masked']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
