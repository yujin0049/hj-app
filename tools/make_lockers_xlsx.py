#!/usr/bin/env python3
"""make_lockers_xlsx.py — T053 (261021): 엑셀봇 사물함 장부 xlsx → hj-app data/lockers.json.

- 읽는 시트: 「엔진실습실」「2층학생」 두 개만. 읽는 열: 칸번호(또는 번호)·열쇠 수·상태 세 개만.
  학번·이름·시작일·반납일·비고 같은 다른 열은 값을 아예 읽지 않는다(머리글 이름으로 열 위치만 찾음).
- 개인정보 거르기와 상태 규칙은 tools/make_lockers.py convert() 를 그대로 쓴다(열쇠 0개 → 사용 중지, 모르면 확인 필요).
- 엔진실습실 칸번호 「1층-001」 → 위치 「엔진실습실 1층」, 번호 「1」.
- 2층학생 시트에서 번호가 빈 줄(입력용 빈 줄)은 넣지 않는다.

사용:
  python3 tools/make_lockers_xlsx.py 261021_사물함장부_돈안받기_v01.xlsx [--out data/lockers.json] [--version v02]
종료 코드: 0 됨, 1 넣을 칸 없음, 2 개인정보로 보이는 값(아무것도 안 씀)
"""
import argparse, csv, datetime as dt, io, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_lockers as M
import openpyxl

SHEETS = {"엔진실습실": "엔진실습실", "2층학생": "2층 휴게실"}
NO_HEADS = ("칸번호", "번호")
KEY_HEAD, ST_HEAD = "열쇠수", "상태"
HEAD_ROW_SCAN = 10
# 칸이 0개여도 앱에서 늘 보여 줄 위치(2층 학생 사물함은 유진님 담당 구역, 10.21.)
SECTIONS = [{"위치": "엔진실습실 1층"}, {"위치": "엔진실습실 2층"},
            {"위치": "2층 휴게실", "note": "2층 학생 사물함(유진님 담당)이에요. 번호·칸 수 확인 전이라 아직 0칸이에요. 장부 「2층학생」 시트에 번호가 채워지면 여기에 나와요."}]


def find_cols(ws):
    """머리글 줄에서 번호·열쇠 수·상태 열 위치만 찾는다."""
    for r in range(1, HEAD_ROW_SCAN + 1):
        heads = [M.flat(c.value) for c in ws[r]]
        no = next((heads.index(h) for h in NO_HEADS if h in heads), None)
        if no is not None and KEY_HEAD in heads and ST_HEAD in heads:
            return r, no, heads.index(KEY_HEAD), heads.index(ST_HEAD)
    raise SystemExit(f"「{ws.title}」 시트에서 칸번호·열쇠 수·상태 머리글을 못 찾았어요")


def rows_from(wb):
    """(위치, 번호, 열쇠수, 상태) 줄. 세 열 말고는 읽지 않는다."""
    out, info = [], {}
    for sheet, base in SHEETS.items():
        if sheet not in wb.sheetnames:
            raise SystemExit(f"시트 없음: {sheet}")
        ws = wb[sheet]
        hr, ci, ck, cs = find_cols(ws)
        blank = n = 0
        for row in ws.iter_rows(min_row=hr + 1):
            no = str(row[ci].value or "").strip()
            if not no:
                blank += 1
                continue
            m = re.fullmatch(r"(\d{1,2})층-(\d{1,4})", no)
            loc, num = (f"{base} {int(m.group(1))}층", m.group(2)) if m and sheet == "엔진실습실" else (base, no)
            out.append([loc, num, "" if row[ck].value is None else str(row[ck].value), "" if row[cs].value is None else str(row[cs].value)])
            n += 1
        info[sheet] = {"번호 있는 칸": n, "번호 빈 줄(넣지 않음)": blank}
    return out, info


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "lockers.json"))
    ap.add_argument("--version", default="v02")
    a = ap.parse_args(argv)
    wb = openpyxl.load_workbook(a.xlsx, data_only=True, read_only=False)
    rows, info = rows_from(wb)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["위치", "번호", "열쇠수", "상태"])
    w.writerows(rows)
    try:
        items, notes = M.convert(buf.getvalue())
    except M.PiiError as e:
        print("실패: " + str(e) + " — 아무것도 쓰지 않았어요.", file=sys.stderr)
        return 2
    if not items:
        print("실패: 넣을 사물함이 없어요 — 아무것도 쓰지 않았어요.", file=sys.stderr)
        return 1
    eng = info["엔진실습실"]["번호 있는 칸"]
    two = info["2층학생"]["번호 있는 칸"]
    note = (f"엔진실습실 {eng}칸 칸번호는 10.20. 사진 판독본에서 가져왔어요(호실이 5101호인지는 확인 전). "
            "열쇠 수·상태는 장부에 아직 비어 있어 「확인 필요」로 둬요. "
            + ("2층 학생 사물함은 번호·칸 수 확인 전이라 아직 안 넣었어요." if not two else f"2층 학생 사물함 {two}칸."))
    out = {"format": 1, "entity": "lockers", "sample": False,
           "updated": dt.datetime.now(M.KST).isoformat(timespec="minutes"),
           "source": "엑셀봇 사물함 장부 xlsx(엔진실습실·2층학생 시트의 칸번호·열쇠 수·상태만, 이름·학번 없음)",
           "assumed": True, "note": note, "version": a.version, "sheets": info, "sections": SECTIONS, "items": items}
    tmp = a.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        head = {k: v for k, v in out.items() if k != "items"}
        f.write(json.dumps(head, ensure_ascii=False)[:-1] + ', "items": [\n')
        f.write(",\n".join(json.dumps(x, ensure_ascii=False) for x in items))
        f.write("\n]}\n")
    os.replace(tmp, a.out)
    cnt = {s: sum(1 for x in items if x["상태"] == s) for s in M.STATUSES}
    print(f"{os.path.normpath(a.out)}: {len(items)}개 · " + " · ".join(f"{k} {v}" for k, v in cnt.items())
          + " · " + json.dumps(info, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
