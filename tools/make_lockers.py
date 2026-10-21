#!/usr/bin/env python3
"""make_lockers.py — 엑셀봇 사물함 CSV를 hj-app 「사물함」 판용 data/lockers.json 으로 바꾼다.

- 쓰는 열: 번호,위치,열쇠수,상태,시작일,반납일 (이름·학번·전화는 없어야 함)
- 이름·학번·전화·연락처 같은 열이 있거나, 전화번호·주민번호·이메일·학번처럼 보이는 값이 있으면
  아무것도 쓰지 않고 실패(종료 코드 2)한다. hj-app 은 공개 저장소다.
- 열쇠 0개는 항상 「사용 중지」. 상태 글자를 모르면 「확인 필요」.
- 돈(보증금·분실비) 열은 다루지 않는다.

사용:
  python3 tools/make_lockers.py 사물함.csv [--out data/lockers.json] [--sample | --assumed --version v01]
  예) python3 tools/make_lockers.py 261021_사물함_연습장판용_v01.csv --assumed --version v01
  (CSV 글자: UTF-8 또는 엑셀 기본 CP949 둘 다 됨)
"""
import argparse, csv, datetime as dt, io, json, os, re, sys

KST = dt.timezone(dt.timedelta(hours=9))
COLS = ["번호", "위치", "열쇠수", "상태", "시작일", "반납일"]
STATUSES = ["빈칸", "사용", "확인 필요", "사용 중지"]
# js/dorm.js DROP + js/modules/lockers.js PII_HEAD 와 같은 목록
DROP = {"전화", "휴대폰", "전화번호", "비밀번호", "암호", "주민번호", "주민등록번호", "phone", "ip", "pass" + "word"}
PII_HEAD = re.compile(r"(이름|성명|성함|학번|학생|사용자|신청자|대여자|전화|휴대폰|핸드폰|연락처|폰|phone|tel|mobile|주민|생년|생일|birth|주소|address|메일|email|계좌|account|은행|bank|비밀번호|암호|name|학과|소속)", re.I)
PII_VAL = [
    ("전화번호", re.compile(r"01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}")),
    ("주민번호", re.compile(r"\d{6}\s?-\s?[1-4]\d{6}")),
    ("이메일", re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")),
]
ALIAS = {"번호": "번호", "사물함번호": "번호", "사물함": "번호", "위치": "위치", "장소": "위치",
         "열쇠수": "열쇠수", "열쇠": "열쇠수", "열쇠개수": "열쇠수", "키": "열쇠수", "키수": "열쇠수", "상태": "상태",
         "시작일": "시작일", "사용시작일": "시작일", "대여일": "시작일", "반납일": "반납일", "반납예정일": "반납일"}


class PiiError(Exception):
    pass


def flat(s):
    return re.sub(r"\s+", "", str(s or "")).lower()


def is_pii_head(h):
    f = flat(h)
    return bool(f) and (f in DROP or bool(PII_HEAD.search(f)))


def place(v):
    f = flat(v)
    if not f:
        return ""
    if re.fullmatch(r"5101(호)?", f):
        return "5101호"
    if f in ("2층휴게실", "2층"):
        return "2층 휴게실"
    n = re.sub(r"\s+", " ", str(v)).strip()
    if len(n) > 20 or not re.search(r"(\d|휴게실|복도|로비|강의실|사무실|실습동|창고)", n):
        return None
    return n


def status(v):
    f = flat(v)
    if f in ("빈칸", "빈", "비어있음", "공실", "미사용"):
        return "빈칸"
    if f in ("사용", "사용중", "배정"):
        return "사용"
    if f in ("확인필요", "확인"):
        return "확인 필요"
    if f in ("사용중지", "중지", "고장", "폐쇄"):
        return "사용 중지"
    return None


def day(v):
    m = re.fullmatch(r"(20\d{2})[-./ ]\s*(\d{1,2})[-./ ]\s*(\d{1,2})\.?", str(v or "").strip())
    return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else ""


def read_text(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    raise SystemExit("CSV 글자 인코딩을 읽지 못했어요 (UTF-8·CP949 아님)")


def convert(text):
    first = text.splitlines()[0] if text else ""
    delim = "\t" if "\t" in first and "," not in first else ","
    rows = [r for r in csv.reader(io.StringIO(text), delimiter=delim) if any(c.strip() for c in r)]
    if not rows:
        raise SystemExit("빈 CSV예요")
    head = rows[0]
    bad = [h.strip() for h in head if is_pii_head(h)]
    if bad:
        raise PiiError("개인정보로 보이는 열: " + ", ".join(bad))
    cmap = [ALIAS.get(flat(h).replace("(", "").replace(")", ""), "") for h in head]
    miss = [c for c in ("번호", "위치") if c not in cmap]
    if miss:
        raise SystemExit("필수 열이 없어요: " + ", ".join(miss))
    items, seen, notes = [], set(), {"뺀 줄(번호 이상)": 0, "뺀 줄(위치 이상)": 0, "겹친 줄": 0, "0개→사용 중지": 0, "확인 필요로 둠": 0}
    for n, r in enumerate(rows[1:], start=2):
        for c in r:
            for label, rx in PII_VAL:
                if rx.search(c):
                    raise PiiError(f"{label}로 보이는 값: {n}번째 줄")
        src = {cmap[i]: (r[i] if i < len(r) else "") for i in range(len(cmap)) if cmap[i]}
        raw = re.sub(r"\s+", "", str(src.get("번호", ""))).removesuffix("번")
        if not raw:
            continue
        if re.fullmatch(r"\d{7,}", raw):
            raise PiiError(f"학번처럼 보이는 번호: {n}번째 줄")
        m = re.fullmatch(r"(?:[0-9A-Za-z]{1,5}층?-)?([0-9A-Za-z]{1,4})", raw)
        if not m:
            notes["뺀 줄(번호 이상)"] += 1
            continue
        no = str(int(m.group(1))) if m.group(1).isdigit() else m.group(1).upper()  # 5101-012 → 12
        loc = place(src.get("위치", ""))
        if not loc:
            notes["뺀 줄(위치 이상)"] += 1
            continue
        if (loc, no) in seen:
            notes["겹친 줄"] += 1
            continue
        seen.add((loc, no))
        k = re.sub(r"개$", "", str(src.get("열쇠수", "")).strip())
        keys = int(k) if re.fullmatch(r"\d", k) else None
        st = status(src.get("상태", ""))
        if st is None or (keys is None and st != "사용 중지"):
            st = "확인 필요"
            notes["확인 필요로 둠"] += 1
        if keys == 0 and st != "사용 중지":
            st = "사용 중지"
            notes["0개→사용 중지"] += 1
        items.append({"번호": no, "위치": loc, "열쇠수": keys, "상태": st, "시작일": day(src.get("시작일")), "반납일": day(src.get("반납일"))})
    return items, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "lockers.json"))
    ap.add_argument("--sample", action="store_true", help="예시 데이터 표시(앱에 「예시 데이터예요」)")
    ap.add_argument("--assumed", action="store_true", help="칸 수가 가정치일 때(앱에 「칸 수는 가정치예요」)")
    ap.add_argument("--version", default="", help="자료 판 표시, 예: v01")
    ap.add_argument("--note", default="", help="가정치 설명 한 줄(이름·학번 넣지 말 것)")
    a = ap.parse_args()
    try:
        for label, rx in PII_VAL:
            if rx.search(a.note):
                raise PiiError(f"--note 에 {label}로 보이는 값")
        items, notes = convert(read_text(a.csv))
    except PiiError as e:
        print("실패: " + str(e) + " — 아무것도 쓰지 않았어요. 이름·학번·전화 열을 지운 CSV를 주세요.", file=sys.stderr)
        return 2
    if not items:
        print("실패: 넣을 사물함이 없어요 — 아무것도 쓰지 않았어요.", file=sys.stderr)
        return 1
    out = {"format": 1, "entity": "lockers", "sample": bool(a.sample),
           "updated": dt.datetime.now(KST).isoformat(timespec="minutes"),
           "source": "예시(실제 아님)" if a.sample else "엑셀봇 사물함 대장 CSV(이름·학번·전화 없음)",
           "items": items}
    if a.assumed:
        out["assumed"] = True
        out["note"] = a.note or "열쇠함 사진 확인 후 v02로 갱신할 예정이에요."
    if a.version:
        out["version"] = a.version
    tmp = a.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        # 한 사물함 = 한 줄 (변경 내역 보기 쉽게)
        head = {k: v for k, v in out.items() if k != "items"}
        f.write(json.dumps(head, ensure_ascii=False)[:-1] + ', "items": [\n')
        f.write(",\n".join(json.dumps(x, ensure_ascii=False) for x in items))
        f.write("\n]}\n")
    os.replace(tmp, a.out)
    cnt = {s: sum(1 for x in items if x["상태"] == s) for s in STATUSES}
    print(f"{os.path.normpath(a.out)}: {len(items)}개 · " + " · ".join(f"{k} {v}" for k, v in cnt.items())
          + "".join(f" · {k} {v}" for k, v in notes.items() if v))
    return 0


if __name__ == "__main__":
    sys.exit(main())
