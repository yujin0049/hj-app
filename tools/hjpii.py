#!/usr/bin/env python3
"""개인정보 거르기 공용 모듈 (make_calendar.py · make_ojnt_progress.py · cal_pii_check.py 가 같이 씀).
- 전화·주민번호·이메일·계좌 모양 글자 찾기
- 사람 이름 찾기: ① 「OOO 교수님/선생님/주무관…」 앞 이름 ② 성씨로 시작하는 3글자 낱말 중 ALLOW(보통 낱말)에 없는 것
- 이름 목록은 원자료에서 그때그때 만들고 어디에도 저장하지 않음."""
import re

SURNAMES = set('김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예봉경사부가복태목형피두감음빈동온호범좌팽승간상갈단견당화창')
# 성씨 글자로 시작하지만 사람 이름이 아닌 3글자 낱말. 새 낱말이 지워지면 여기 넣는다(지운 낱말 목록: calendar/지운낱말.txt).
ALLOW = set('''
문서봇
현황판 현황표 단계명 이상한 이상함 이상은 이미지 이메일 이번에 이후로 기준일 마감일 시작일 종료일 납품일 입고일 개강일 종강일 수료일 결재일 상신일 제출일 지급일 반복일 고치기 반대표 이월됨 임대인 임용자 정하기 주마다 강사료 강의실 강의평 고사장 공문을 공문서 국토부 기숙사 배치표 변경에 사물함 사업비 서명부 선생님 성범죄 연습장 원계획 원보다 정비사
표준화 하는지 하반기 현수막 목요일 금요일 월요일 화요일 수요일 토요일 일요일 유진님 교육원 정산서 결과서 계획서 신청서 확인서 동의서 서약서
지출서 이력서 견적서 조교비 신분증 안내문 기안문 남해대 남해캠 부총장 원장님 학과장 담당자 수강생 연수생 입소자 대상자 지원자 참가자
통장에 부서별 성과표 주간별 월별로 정기적 기말고 중간고 추가로 진행중 진행률 완료율 제출률 확인중 미제출 미배정 입소완 지급의 지출의 원인행
고정익 회전익 경남항 산업기 정복지 장비실 실습동 실습재 재료비 운영비 예산서 사업단 공학관 시설과 총무과 교무과 학사팀 성적표 출석부 출석표
기숙사비 견학지 사천시 사천에 남해군 창원대 국립대 한국어 영어로 어학원 어학과 강사님 교관님 조교님 무엇을 하도록 하면서 하려고 하기로
주무관 팀장님 과장님 진행표 이번주 다음주 지난주 연말에 상반기 하반기 기본값 기본안 정리안 정리본 최종본 수정본 원본은 사본은 백업본
사무국 방문처 인프라 여행사 동행자 온나라 공정비 정비학 용호기 공개문 공개용 공개본 공개한 문서철 문서함 장학금 장학생 근로장 방학중 방학에 겨울방 여름방 주말에 신규로 신청은 신청을 선착순
''' .split())
HONOR = r'(교수님|교수|선생님|선생|주무관|팀장님|팀장|과장님|과장|조교|씨)'

PATTERNS = [
    ('전화번호', re.compile(r'(?<!\d)0(1[016789]|2|[3-6][1-5]|70)[-\s.)]?\d{3,4}[-\s.]?\d{4}(?!\d)')),
    ('주민번호', re.compile(r'(?<!\d)\d{6}\s?-\s?[1-4]\d{6}(?!\d)')),
    ('이메일', re.compile(r'[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![\w])')),
]
ACCOUNT = re.compile(r'(?<![\d-])\d{2,6}(?:-\d{2,7}){2,3}(?![\d-])')
DATE_LIKE = re.compile(r'^20\d\d-\d\d-\d\d$')


def runs3(text):
    """성씨로 시작하는 딱 3글자 한글 덩어리."""
    return [m for m in re.findall(r'[가-힣]+', str(text)) if len(m) == 3 and m[0] in SURNAMES]


def suspicious(text):
    # 「~에·~을·~를」로 끝나는 3글자(목록에, 공문을)는 조사 붙은 낱말로 봄(이름 끝 글자로 거의 안 씀)
    return sorted({w for w in runs3(text) if w not in ALLOW and w[-1] not in '에을를'})


def derive_names(texts):
    """원자료 글자들에서 사람 이름 후보를 모음(저장 안 함)."""
    names = set()
    rx = re.compile(r'((?:[가-힣]{3}\s?[·,/]\s?)*[가-힣]{3})\s?' + HONOR + r'(?![가-힣])')
    for t in texts:
        t = str(t)
        for m in rx.finditer(t):
            for n in re.split(r'\s?[·,/]\s?', m.group(1)):
                if n[0] in SURNAMES and n not in ALLOW:
                    names.add(n)
    return names


def scrub(text, names):
    """업무 이름에서 사람 이름을 지움. 「A·B 선생님」→「선생님」, 남은 이름 낱말은 빼기. (지운 낱말 목록 함께 돌려줌)"""
    s = str(text)
    # 「(성)교수님」처럼 성 한 글자+호칭만 붙은 것도 성을 뺌(→ 「교수님」). 앞이 한글이면(「학과장교수」 등) 그대로
    s = re.sub(r'(?<![가-힣])[' + ''.join(sorted(SURNAMES)) + r'](?=(교수님|교수|선생님|주무관|팀장님|과장님|원장님)(?![가-힣]))', '', s)
    removed = set()
    allnames = set(names) | set(suspicious(s))
    if not allnames:
        return s, removed
    alt = '|'.join(sorted(map(re.escape, allnames), key=len, reverse=True))
    rx = re.compile(r'(?:(?:' + alt + r')\s?[·,/]\s?)*(?:' + alt + r')\s?' + HONOR + r'(?![가-힣])')
    def keep_honor(m):
        for n in re.findall(alt, m.group(0)):
            removed.add(n)
        return m.group(m.lastindex)
    s = rx.sub(keep_honor, s)
    rx2 = re.compile(r'(?:(?<=[^가-힣])|^)(?:' + alt + r')(?:\s?[·,/]\s?(?:' + alt + r'))*(?![가-힣])\s?')
    for n in re.findall(r'(?:(?<=[^가-힣])|^)(' + alt + r')(?![가-힣])', s):
        removed.add(n)
    s = rx2.sub('', s)
    s = re.sub(r'\(\s*[,·]\s*', '(', s)
    s = re.sub(r'\s*[,·]\s*\)', ')', s)
    s = re.sub(r'\(\s*\)', '', s)
    s = re.sub(r':\s*·', ': ', s)
    s = re.sub(r'\s{2,}', ' ', s).strip()
    return s, removed


def find_pii(text, names=()):
    """글자 하나에서 개인정보 모양을 찾아 [(종류, 위치표시)] 로 돌려줌(값 자체는 돌려주지 않음)."""
    s = str(text)
    hits = []
    for kind, rx in PATTERNS:
        if rx.search(s):
            hits.append(kind)
    for m in ACCOUNT.finditer(s):
        v = m.group(0)
        if DATE_LIKE.match(v):
            continue
        if sum(c.isdigit() for c in v) >= 10 and set(v) - set('0-'):  # 0과 -만 있는 자리표시(예시용 빈 번호)는 뺌
            hits.append('계좌번호')
            break
    words = set(re.findall(r'[가-힣]+', s))
    if any(n in words or n in s for n in names):
        hits.append('사람 이름')
    elif suspicious(s):
        hits.append('이름 의심')
    return hits


def walk_strings(obj, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(k, path + '/<key>')
            yield from walk_strings(v, path + '/' + str(k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, '%s[%d]' % (path, i))
    elif isinstance(obj, str):
        yield path, obj
