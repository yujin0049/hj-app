"""수기 문제(data/docreg_manual.json)를 data/docreg.json questions에 합친다. 같은 id는 바꿔 넣는다(다시 돌려도 같음)."""
import json, os
R = os.path.join(os.path.dirname(__file__), '..', 'data')
d = json.load(open(os.path.join(R, 'docreg.json'), encoding='utf-8'))
m = json.load(open(os.path.join(R, 'docreg_manual.json'), encoding='utf-8'))
ids = {q['id'] for q in m}
d['questions'] = [q for q in d['questions'] if q['id'] not in ids] + m
json.dump(d, open(os.path.join(R, 'docreg.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(m), len(d['questions']))
