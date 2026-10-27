# -*- coding: utf-8 -*-
"""261027 연습장 카드 5장 — changelog + anki, 실명·금액 UI 금지."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CL = json.loads((ROOT / "data/changelog_cards.json").read_text(encoding="utf-8"))
ANKI = json.loads((ROOT / "data/wrong_anki_seed.json").read_text(encoding="utf-8"))

CARD_IDS = [
    "cause-attach",
    "no-bot-trace",
    "ot-pay-schedule",
    "material-line",
    "lecture-docs",
]
ANKI_IDS = ["ANKI-17", "ANKI-18", "ANKI-19", "ANKI-20", "ANKI-21"]
# 실명·금액 UI 금지 (카드 본문). 협조 내선은 허용.
BANNED_NAMES = ["이동렬", "김정임", "유진"]
AMOUNT_MARKERS = ["원", "만원", "75,780", "금액 "]


class TestCard5(unittest.TestCase):
    def test_changelog_five(self):
        by = {it["id"]: it for it in CL["items"]}
        for cid in CARD_IDS:
            self.assertIn(cid, by, cid)
            it = by[cid]
            self.assertTrue(it.get("panels"), cid)
            blob = json.dumps(it, ensure_ascii=False)
            for name in BANNED_NAMES:
                self.assertNotIn(name, blob, f"{cid} has name {name}")

    def test_anki_five(self):
        by = {c["id"]: c for c in ANKI["cards"]}
        for aid in ANKI_IDS:
            self.assertIn(aid, by, aid)
            blob = json.dumps(by[aid], ensure_ascii=False)
            for name in BANNED_NAMES:
                self.assertNotIn(name, blob, f"{aid} has name {name}")

    def test_cause_attach_one_doc_rule(self):
        it = next(x for x in CL["items"] if x["id"] == "cause-attach")
        blob = json.dumps(it, ensure_ascii=False)
        self.assertIn("1서류", blob)
        self.assertIn("A4", blob)

    def test_ot_coop_extensions(self):
        it = next(x for x in CL["items"] if x["id"] == "ot-pay-schedule")
        blob = json.dumps(it, ensure_ascii=False)
        self.assertIn("7334", blob)
        self.assertIn("7363", blob)
        self.assertIn("시수", blob)


if __name__ == "__main__":
    unittest.main()
