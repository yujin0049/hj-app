#!/usr/bin/env python3
"""남해캠 공지 증분 수집: 게시판 1쪽부터 읽어 새 nttId 만 본문까지 받아 원자료(박스 전용 SRC)에 덧붙임.
  python3 tools/notices_update.py [--src /workspace/namhae_notice_261111] [--max-pages 5]
- 원본 수집기(SRC/scrape.py, 261111 전체 수집)와 같은 게시판·같은 읽는 법. 여기선 새 글만: 한 쪽에 새 글이 하나도 없으면 멈춤.
- 본문의 주민번호·휴대전화는 받자마자 「개인정보 포함」으로 가림(원본 수집기와 같은 규칙). 첨부는 이름만, 내려받지 않음.
- 공개 게시판 GET 만(로그인·쓰기 없음), 요청 간격 0.5초.
- 원자료가 바뀌는 건 새 글이 있을 때뿐(목록 덧붙임 + _articles.jsonl 줄 추가). 이미 있는 글의 조회수는 안 고침(같은 입력 → 같은 출력).
종료 코드: 0 새 글 반영(또는 새 글 없음) · 3 원자료 없음 · 4 네트워크 실패·차단(아무것도 안 바꿈)
"""
import argparse, json, os, re, sys, time

SRC_DEFAULT = '/workspace/namhae_notice_261111'
BASE = 'https://www.namhae.ac.kr'
BBS_ID = 'BBSMSTR_000000000284'
LIST_URL = BASE + '/namhae_01/web/cop/bbs/selectBoardList.do'
ARTICLE_URL = BASE + '/namhae_01/web/cop/bbs/selectBoardArticle.do'
DELAY, TIMEOUT = 0.5, 15
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
RRN_RE = re.compile(r'\b\d{6}\s*[-–—]\s*[1-8]\d{6}\b')
RRN_BARE_RE = re.compile(r'\b(?:\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))[1-8]\d{6}\b')
MOBILE_RE = re.compile(r'\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b')
BYTE_SUFFIX_RE = re.compile(r'\s*\[\d[\d,]*\s*byte\]\s*$', re.I)
CAPTCHA_RE = re.compile(r'captcha|캡차|자동입력|로봇이\s*아닙니다', re.I)


class NetFail(Exception):
    pass


def mask_pii(text):
    n = 0
    def repl(_m):
        nonlocal n
        n += 1
        return '「개인정보 포함」'
    for rx in (RRN_RE, RRN_BARE_RE, MOBILE_RE):
        text = rx.sub(repl, text or '')
    return text, n


class Fetcher:
    def __init__(self):
        import requests
        self.rq = requests
        self.s = requests.Session()
        self.s.headers.update({'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9'})
        self.last = 0.0

    def get(self, url, params):
        wait = DELAY - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        try:
            r = self.s.get(url, params=params, timeout=TIMEOUT)
        except self.rq.RequestException as e:
            raise NetFail(type(e).__name__)
        finally:
            self.last = time.time()
        if r.status_code != 200 or CAPTCHA_RE.search(r.text or ''):
            raise NetFail('HTTP %d' % r.status_code)
        return r.text


def html_to_text(el):
    from bs4 import BeautifulSoup
    if el is None:
        return ''
    root = BeautifulSoup(str(el), 'html.parser')
    for junk in root.select('#hwpEditorBoardContent, script, style'):
        junk.decompose()
    for br in root.find_all('br'):
        br.replace_with('\n')
    for tag in root.find_all(['p', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
        tag.append('\n')
    for td in root.find_all(['td', 'th']):
        td.append('\t')
    t = root.get_text().replace('\xa0', ' ').replace('\u3000', ' ')
    t = re.sub(r'[ \t]+\n', '\n', t)
    t = re.sub(r'\n[ \t]+', '\n', t)
    t = re.sub(r'[ \t]{2,}', ' ', t)
    return re.sub(r'\n{3,}', '\n\n', t).strip()


def parse_list(html, page):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    for tr in soup.select('table.bo_basic_list tbody tr'):
        tds = tr.find_all('td')
        if len(tds) < 6:
            continue
        m = re.search(r"fn_egov_inqire_notice\(\s*'([^']+)'\s*,\s*'(\d+)'\s*\)", tds[1].get('onclick') or '')
        if m:
            nid = m.group(2)
        else:
            a = tds[1].find('a')
            m2 = re.search(r'nttId=(\d+)', (a.get('href') if a else '') or '')
            if not m2:
                continue
            nid = m2.group(1)
        num_raw = tds[0].get_text(strip=True)
        pin = num_raw.startswith('[') or '공지' in num_raw
        num = None if pin else (int(num_raw.replace(',', '')) if re.fullmatch(r'[\d,]+', num_raw) else None)
        views_raw = tds[4].get_text(strip=True).replace(',', '')
        rows.append({'번호': num, '공지고정': pin, '제목': tds[1].get_text(' ', strip=True), '작성자': tds[3].get_text(strip=True),
                     '작성일': tds[5].get_text(strip=True), '조회수': int(views_raw) if views_raw.isdigit() else views_raw,
                     '첨부유무': 'Y' if (tds[2].find('img') or '첨부' in tds[2].get_text()) else 'N', 'nttId': nid,
                     '글URL': '%s?bbsId=%s&nttId=%s' % (ARTICLE_URL, BBS_ID, nid), '목록페이지': page})
    return rows


def parse_article(html, nid):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    subject, content, meta = soup.select_one('.view_subject'), soup.select_one('.view_content'), soup.select_one('.view_wrap .meta')
    body, pii_n = mask_pii(html_to_text(content))
    writer = date = views = ''
    if meta:
        for sp in [s.get_text(' ', strip=True) for s in meta.find_all('span')]:
            if sp.startswith('조회수'):
                views = sp.replace('조회수', '').replace(':', '').strip()
            elif re.search(r'\d{4}-\d{2}-\d{2}', sp):
                date = re.search(r'\d{4}-\d{2}-\d{2}', sp).group(0)
            else:
                writer = sp
    locked = bool(soup.select_one('#passwordInput') and not content)
    if locked:
        body = '[비밀번호가 등록된 글]'
    files = []
    table = soup.select_one('#egov_file_view_table')
    for a in (table.find_all('a') if table else []):
        text = a.get_text(' ', strip=True)
        if 'pdfView' in (a.get('href') or '') + (a.get('onclick') or '') or text == 'PDF 미리보기' or not text:
            continue
        name = BYTE_SUFFIX_RE.sub('', text).replace('\xa0', ' ').strip()
        if name and name not in files:
            files.append(name)
    return {'nttId': nid, '본문제목': subject.get_text(' ', strip=True) if subject else '', '본문작성자': writer, '본문작성일': date,
            '본문조회수': views, '본문': body, '첨부파일명': files, '개인정보마스킹수': pii_n, '비밀번호글': locked,
            '본문없음': (not body) and (not locked), 'http_ok': True}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SRC_DEFAULT)
    ap.add_argument('--max-pages', type=int, default=5)
    a = ap.parse_args(argv)
    lp, artp = os.path.join(a.src, '_list.json'), os.path.join(a.src, '_articles.jsonl')
    if not (os.path.exists(lp) and os.path.exists(artp)):
        print('공지 원자료 없음: 증분 건너뜀')
        return 3
    with open(lp, encoding='utf-8') as f:
        saved = json.load(f)
    known = {str(p.get('nttId')) for p in saved.get('posts') or []}
    try:
        fx = Fetcher()
        new = []
        for page in range(1, a.max_pages + 1):
            rows = [r for r in parse_list(fx.get(LIST_URL, {'bbsId': BBS_ID, 'pageIndex': page}), page) if r['번호'] is not None]
            fresh = [r for r in rows if r['nttId'] not in known and r['nttId'] not in {x['nttId'] for x in new}]
            new += fresh
            if not fresh or not rows:
                break
        arts = [parse_article(fx.get(ARTICLE_URL, {'bbsId': BBS_ID, 'nttId': r['nttId']}), r['nttId']) for r in new]
    except NetFail as e:
        print('공지 증분: 네트워크 실패(%s) → 건너뜀, 원자료 그대로' % e)
        return 4
    except ImportError as e:
        print('공지 증분: 모듈 없음(%s) → 건너뜀' % e.name)
        return 4
    if not new:
        print('공지 증분: 새 글 없음')
        return 0
    posts = new + list(saved.get('posts') or [])
    posts.sort(key=lambda x: (-(x['번호'] if isinstance(x.get('번호'), int) else -1), str(x['nttId'])))
    saved['posts'] = posts
    saved['unique_count'] = len(posts)
    saved['numbered_count'] = sum(1 for p in posts if p.get('번호') is not None)
    tmp = lp + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(saved, f, ensure_ascii=False, indent=1)
    with open(artp, 'a', encoding='utf-8') as f:
        for o in arts:
            f.write(json.dumps(o, ensure_ascii=False) + '\n')
    os.replace(tmp, lp)
    print('공지 증분: 새 글 %d건 반영' % len(new))
    return 0


if __name__ == '__main__':
    sys.exit(main())
