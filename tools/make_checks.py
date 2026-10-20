#!/usr/bin/env python3
"""make_checks.py — 숫자 정본(ojnt.json)과 경로 검사 결과를 hj-app 「확인 필요」 탭용 data/checks.json 으로 바꾼다.

- 숫자는 스크립트가 계산한 값만 옮긴다. AI가 세지 않는다.
- 이름·전화·계좌·주민번호 같은 개인정보 필드나 값이 보이면 아무것도 쓰지 않고 실패(종료 코드 2)한다.
- 구글 시트 ID는 공개 저장소에 넣지 않는다(시트 이름만).

사용:
  python3 tools/make_checks.py --ojnt /home/box/vault/봇공유/숫자/ojnt.json \
      [--paths path_check_dryrun.txt --paths-at 2026-10-21T08:38+09:00] [--out data/checks.json]
"""
import argparse, datetime as dt, json, os, re, sys

KST = dt.timezone(dt.timedelta(hours=9))
BAD_KEYS = re.compile(r"(^|_)(이름|성명|성함|name|전화|연락처|휴대폰|phone|tel|계좌|account|bank|주민|rrn|생년월일|birth|주소|address|email|이메일)($|_)", re.I)
BAD_VALUES = [
    ("주민번호", re.compile(r"\b\d{6}\s?-\s?[1-4]\d{6}\b")),
    ("전화번호", re.compile(r"\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b")),
    ("계좌번호", re.compile(r"\b\d{2,6}-\d{2,6}-\d{2,8}(-\d{1,3})?\b")),
    ("이메일", re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")),
]
SHEET_ID = re.compile(r"\s*\(?\b[A-Za-z0-9_-]{40,}\b\)?")


class PiiError(Exception):
    pass


def scan(obj, where="$"):
    """개인정보로 보이는 키·값이 있으면 PiiError."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if BAD_KEYS.search(str(k)):
                raise PiiError(f"개인정보 필드로 보이는 키: {where}.{k}")
            scan(v, f"{where}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            scan(v, f"{where}[{i}]")
    elif isinstance(obj, str):
        for label, rx in BAD_VALUES:
            if rx.search(obj):
                raise PiiError(f"{label}로 보이는 값: {where}")


def no_id(s):
    return SHEET_ID.sub("", s or "").strip()


def item(i, name, res, val, cmp_, why, at, src):
    assert res in ("일치", "불일치", "판단 불가")
    return {"id": i, "항목": name, "결과": res, "값": val, "비교값": cmp_, "근거": why, "computed_at": at, "source": src}


def from_ojnt(d):
    v = d["값"]
    g = lambda k: v[k]["value"]
    at = lambda k: v[k]["computed_at"]
    src = "봇공유/숫자/ojnt.json (" + d.get("만든_스크립트", "number_check.py") + ")"
    tab = "OJNT 입사서류체크 시트"
    out = []
    b = d.get("현황판_대조") or {}
    if b:
        bad = b.get("불일치", 0) + b.get("판단 불가", 0)
        out.append(item("ojnt-board", "현황판 ↔ OJNT 시트 숫자 대조", "일치" if bad == 0 else "불일치",
                        f"일치 {b.get('일치', 0)}건", f"불일치 {b.get('불일치', 0)} · 판단 불가 {b.get('판단 불가', 0)}",
                        f"{no_id(b.get('현황판', '현황판'))} · 읽은 시각 {b.get('읽은_때', '')}", b.get("읽은_때") or d["만든_때"], src))
    # 현황판에 숫자가 없어 대조 못 한 것(유진님 확인 필요)
    out.append(item("ojnt-submit-board", "입사신청서 제출 수 (현황판)", "판단 불가",
                    f"제출 {g('입사신청서_제출')} / 대상 {g('입사신청서_대상')}", "현황판에 숫자 없음",
                    f"{tab} {v['입사신청서_제출']['source']} · 현황판에 이 숫자가 없어 대조 못 함", at("입사신청서_제출"), src))
    out.append(item("ojnt-room-board", "호실 배정 수 (현황판)", "판단 불가",
                    f"배정 {g('호실_배정')} · 미배정 {g('호실_미배정')}", "현황판에 숫자 없음",
                    f"{tab} {v['호실_배정']['source']} · 현황판에 이 숫자가 없어 대조 못 함", at("호실_배정"), src))
    # 시트 안 검산(스크립트 계산)
    def eq(i, name, a, b_, av, bv, why, k):
        out.append(item(i, name, "일치" if a == b_ else "불일치", av, bv, why, at(k), src))
    eq("ojnt-submit-a2-j23", "입사신청서 제출: A2 ↔ J23", g("입사신청서_제출"), g("입사신청서_제출_J23"),
       f"A2 {g('입사신청서_제출')}", f"J23 {g('입사신청서_제출_J23')}", f"{tab} A2·J23 (시트 수식)", "입사신청서_제출")
    eq("ojnt-made-a2-i23", "입사신청서 작성 중: A2 ↔ I23 만듦", g("입사신청서_작성중"), g("입사신청서_만듦"),
       f"A2 {g('입사신청서_작성중')}", f"I23 {g('입사신청서_만듦')}", f"{tab} A2·I23 (시트 수식)", "입사신청서_작성중")
    s = g("입소완료") + g("입소예정_1021")
    eq("ojnt-in-1021", "10.21.까지 입소 = 입소완료 + 10.21. 예정", g("입소_21일까지"), s,
       f"{g('입소_21일까지')}", f"{g('입소완료')} + {g('입소예정_1021')} = {s}", f"{tab} D5:D22 (스크립트 집계)", "입소_21일까지")
    r = g("호실_배정") + g("호실_미배정")
    eq("ojnt-room-total", "호실 배정 + 미배정 = 입사신청서 대상", r, g("입사신청서_대상"),
       f"{g('호실_배정')} + {g('호실_미배정')} = {r}", f"대상 {g('입사신청서_대상')}", f"{tab} N5:N22 · A2", "호실_배정")
    return out


def from_paths(text, at):
    m = re.search(r"새로 옮김 (\d+) · 이미 옮겨져 있음 (\d+) · 실패 (\d+) · 이름 규칙 다름 (\d+)", text)
    if not m:
        raise SystemExit("경로 검사 결과 줄을 못 찾았어요")
    moved, _, failed, bad = map(int, m.groups())
    names = [x.split("(")[0].strip() for x in re.findall(r"- 이름: (.+)", text)]
    src = "99 봇/스크립트/path_check.py --dry-run"
    return [
        item("path-place", "봇교훈·결정기록 경로 검사 (봇공유 밖에 쓴 파일)", "일치" if moved == 0 and failed == 0 else "불일치",
             f"제자리 아닌 파일 {moved} · 실패 {failed}", "0", "봇공유 밖 /home/box/vault/99 봇/ 등 검사", at, src),
        item("path-name", "봇공유 파일 이름 규칙 (YYMMDD_제목_v01.md)", "일치" if bad == 0 else "불일치",
             f"규칙 다름 {bad}개", "0", " · ".join(names) or "없음", at, src),
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ojnt", required=True)
    ap.add_argument("--paths")
    ap.add_argument("--paths-at")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "checks.json"))
    a = ap.parse_args()
    try:
        d = json.load(open(a.ojnt, encoding="utf-8"))
        scan(d, "ojnt.json")
        items = from_ojnt(d)
        if a.paths:
            t = open(a.paths, encoding="utf-8").read()
            at = a.paths_at or dt.datetime.now(KST).isoformat(timespec="minutes")
            items += from_paths(t, at)
        scan(items, "checks.json")
    except PiiError as e:
        print("실패: " + str(e) + " — 아무것도 쓰지 않았어요.", file=sys.stderr)
        return 2
    tmp = a.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, a.out)
    need = sum(1 for x in items if x["결과"] != "일치")
    print(f"{os.path.normpath(a.out)}: 전체 {len(items)}건 중 확인 필요 {need}건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
