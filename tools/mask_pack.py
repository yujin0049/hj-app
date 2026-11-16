#!/usr/bin/env python3
"""공개 팩·일정 담당(owner)에서 실명을 역할명으로 바꾼다.
저장소에는 public-pack.json 을 처음부터 만드는 생성기가 없다.
일정 항목의 owner 는 시트(entities.schedule.sheetUrl)에서 다시 들어올 수 있어,
여기에 모은 뒤·refresh_all 끝·js/schedule.js cleanItem 에서 같은 규칙으로 가린다.
사용: python3 tools/mask_pack.py [public-pack.json]
"""
import json, os, re, sys

ROLES = ('교수님', '팀장', '주무관', '강사', '학생', '담당자')
KEEP = {'', '본인', '담당자', '교수님', '팀장', '주무관', '강사', '학생'}
# 더 긴 것을 먼저 (교수님 > 교수)
_TITLE_RX = re.compile(r'(교수님|팀장|주무관|강사|학생|담당자|교수)')


def mask_owner(raw):
    """시트·팩에서 온 담당 칸. 직함이 있으면 직함만, 없으면 담당자. 본인·빈 칸은 그대로."""
    s = re.sub(r'\s+', ' ', str(raw or '')).strip()
    if s in KEEP:
        return s
    found = []
    for m in _TITLE_RX.finditer(s):
        t = m.group(1)
        if t == '교수':
            t = '교수님'
        if t not in found:
            found.append(t)
    if found:
        return '·'.join(found)
    return '담당자'


def mask_schedule_items(items):
    out = []
    for it in items or []:
        if isinstance(it, dict) and 'owner' in it:
            it = dict(it)
            it['owner'] = mask_owner(it.get('owner'))
        out.append(it)
    return out


def mask_pack(obj):
    """public-pack 객체를 제자리에서 고치고 같은 객체를 돌려준다."""
    ents = (obj or {}).get('entities') or {}
    sch = ents.get('schedule')
    if isinstance(sch, dict) and isinstance(sch.get('items'), list):
        sch['items'] = mask_schedule_items(sch['items'])
    return obj


def _dump(path, obj):
    """줄 단위 검사(pii_check)가 한 줄 JSON 문맥으로 오탐하지 않게 indent=2 로 쓴다."""
    text = json.dumps(obj, ensure_ascii=False, indent=2) + '\n'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def apply_file(path):
    with open(path, encoding='utf-8') as f:
        obj = json.load(f)
    mask_pack(obj)
    _dump(path, obj)
    return obj


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = argv[0] if argv else os.path.join(root, 'public-pack.json')
    if not os.path.isfile(path):
        print('없음:', path)
        return 1
    apply_file(path)
    print('담당 칸을 역할명으로 맞춤:', os.path.relpath(path, root) if path.startswith(root) else path)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
