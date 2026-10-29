#!/usr/bin/env python3
"""사람별 하는 일(data/people_roles.json) → 거미줄(dept_spider.json) 사람 연결 (261029, 춘식이2).
- 정한 모양: people[].id = "person:이름"(거미줄 사람 노드 id 와 같음), label, dept, inferred, doc_nos … (js/people-roles.js 머리말).
- 칸 이름은 js/people-roles.js 의 맞춤표 F 와 같게 읽음(춘식이3이 정하면 둘 다 고침).
- 공개 페이지라 새 이름은 안 넣음: 거미줄·협조(coop.json)에 이미 있는 사람만 사람 노드로 씀. 나머지는 건너뜀(개수만 셈).
- 간선: 사람→부서 'person-dept'(부서 노드가 있을 때), 사람→사람/부서 'person-협조'. 추론이면 est=True(점선).
- people_roles 가 없거나 비면 거미줄을 그대로 둠. 여러 번 돌려도 같은 결과.
사용: python3 tools/people_links.py --spider data/dept_spider.json [--people data/people_roles.json] [--coop data/coop.json] [--dry]"""
import argparse, collections, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = {
    'list': ['people', 'persons', 'items', '사람'],
    'id': ['id'],
    'name': ['label', 'name', '이름'],
    'dept': ['dept', '부서', 'department'],
    'roles': ['roles_summary', 'roles', 'duties'],
    'text': ['text', 'role', 'label', 't'],
    'doc': ['doc_nos', 'doc_no', 'docs', 'doc'],
    'collab': ['collab', 'collaborators', 'partners'],   # 261029 정한 모양엔 없음(있으면 씀)
    'inferred': ['inferred'],
    'kind': ['kind', 'type', '종류'],
}
KINDS = ('person-dept', 'person-협조')


def pick(o, keys):
    if not isinstance(o, dict):
        return None
    for k in keys:
        if o.get(k) not in (None, ''):
            return o[k]
    return None


def s(v):
    if isinstance(v, list):
        v = v[0] if v else ''
    if isinstance(v, dict):
        v = pick(v, F['text'] + F['name'] + F['doc']) or ''
    return re.sub(r'\s+', ' ', str(v or '')).strip()


def inf(o, parent=False):
    v = pick(o, F['inferred']) if isinstance(o, dict) else None
    if v is None and isinstance(o, dict):
        c = o.get('confidence') or o.get('rank_confidence')
        if c and re.search(r'추론|추정', str(c)):
            v = True
    if v is None:
        return bool(parent)
    return v is True or v == 1 or bool(re.fullmatch(r'(?i)true|추론|추정|yes|y', str(v)))


def arr(v):
    return [] if v is None else (v if isinstance(v, list) else [v])


def people(j):
    """파일 → [{name, dept, doc, collab:[{name,kind,inferred}], inferred}]"""
    if not j:
        return []
    lst = j if isinstance(j, list) else pick(j, F['list'])
    if lst is None and isinstance(j, dict):
        lst = j
    out = []
    items = [(k, v) for k, v in lst.items() if not re.match(r'^(version|updated|meta|note|source|_)', k)] if isinstance(lst, dict) else [(None, v) for v in arr(lst)]
    for hint, r in items:
        if not isinstance(r, dict):
            continue
        pid0 = s(pick(r, F['id']))
        name = s(pick(r, F['name']) or (pid0[7:] if pid0.startswith('person:') else '') or hint)
        if not name:
            continue
        pi = inf(r)
        collab = []
        for c in arr(pick(r, F['collab'])):
            nm = s((pick(c, F['name']) or pick(c, F['dept'])) if isinstance(c, dict) else c)
            if nm:
                collab.append({'name': nm, 'kind': s(pick(c, F['kind'])) if isinstance(c, dict) else '', 'inferred': inf(c)})
        doc = s(pick(r, F['doc']))
        if not doc:
            for x in arr(pick(r, F['roles'])):
                if isinstance(x, dict) and pick(x, F['doc']):
                    doc = s(pick(x, F['doc']))
                    break
        out.append({'id': pid0 or 'person:' + name, 'name': name, 'dept': s(pick(r, F['dept'])), 'doc': doc, 'collab': collab, 'inferred': pi})
    return out


def merge(sp, pr_json, known_names=()):
    """sp 를 고쳐서 돌려줌. 통계 dict 도 같이."""
    ps = people(pr_json)
    st = collections.Counter()
    if not ps:
        return sp, dict(st)
    nodes = {n['id']: n for n in sp.get('nodes', [])}
    known = {n['label'] for n in sp.get('nodes', []) if n.get('type') == 'person'} | set(known_names)
    dept_by_label = {n['label']: n['id'] for n in sp.get('nodes', []) if n.get('type') == 'dept'}
    have = {(e['from'], e['to'], e['kind']) for e in sp.get('edges', [])}

    def person_id(name, pid=None):
        pid = pid or 'person:' + name
        if pid not in nodes and name not in known:
            return None
        if pid not in nodes:
            n = {'id': pid, 'label': name, 'type': 'person', 'value': 8, 'rank': None, 'rank_inferred': None,
                 'rank_confidence': None, 'rank_evidence': None, 'strength': 1}
            sp['nodes'].append(n)
            nodes[pid] = n
            st['사람 노드 추가'] += 1
        return pid

    def add(a, b, kind, est, doc):
        if not a or not b or a == b or (a, b, kind) in have:
            return
        have.add((a, b, kind))
        sp['edges'].append({'from': a, 'to': b, 'kind': kind, 'weight': 1, 'directed': False, 'undirected': True,
                            'samples': [doc] if doc else [], 'est': bool(est), 'src': 'people_roles'})
        st[kind] += 1

    for p in ps:
        pid = person_id(p['name'], p['id'])
        if not pid:
            st['건너뜀(공개 명단에 없는 이름)'] += 1
            continue
        if p['dept'] in dept_by_label:
            add(pid, dept_by_label[p['dept']], 'person-dept', p['inferred'], p['doc'])
        for c in p['collab']:
            if c['name'] in dept_by_label and c['kind'] != 'person':
                to = dept_by_label[c['name']]
            else:
                to = person_id(c['name'])
                if not to:
                    st['건너뜀(공개 명단에 없는 이름)'] += 1
                    continue
            add(pid, to, 'person-협조', c['inferred'] or p['inferred'], p['doc'])
    m = sp.setdefault('meta', {})
    m['n_nodes'] = len(sp['nodes'])
    m['n_edges'] = len(sp['edges'])
    m['edge_kind_counts'] = dict(collections.Counter(e['kind'] for e in sp['edges']))
    m['people_roles'] = {'people': len(ps), **dict(st)}
    return sp, dict(st)


def coop_names(path):
    try:
        with open(path, encoding='utf-8') as f:
            d = json.load(f)
    except (OSError, ValueError):
        return set()
    names = {p.get('name') for p in d.get('people') or [] if p.get('name')}
    for ch in d.get('chains') or []:
        names |= {n.get('name') for n in ch.get('nodes') or [] if n.get('name')}
    return names


def load(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--spider', default=os.path.join(ROOT, 'data', 'dept_spider.json'))
    ap.add_argument('--people', default=os.path.join(ROOT, 'data', 'people_roles.json'))
    ap.add_argument('--coop', default=os.path.join(ROOT, 'data', 'coop.json'))
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args(argv)
    pr = load(a.people)
    sp = load(a.spider)
    if sp is None:
        print('거미줄 파일을 못 읽음:', a.spider, file=sys.stderr)
        return 2
    if not people(pr):
        print('people_roles 없음/비어 있음 → 거미줄 그대로')
        return 0
    sp, st = merge(sp, pr, coop_names(a.coop))
    print('사람 연결:', st)
    if not a.dry:
        with open(a.spider, 'w', encoding='utf-8') as f:
            f.write(json.dumps(sp, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
