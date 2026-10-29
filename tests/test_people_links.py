"""people_roles → 거미줄 사람 연결 시험 (가짜 이름 P1·P2)."""
import copy, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import people_links  # noqa: E402


def base():
    return {'meta': {}, 'nodes': [{'id': 'dept:D1', 'label': 'D1', 'type': 'dept'},
                                  {'id': 'person:P1', 'label': 'P1', 'type': 'person'}], 'edges': []}


def test_inferred_person_dept_edge_is_dashed():
    pr = {'people': [{'id': 'person:P1', 'label': 'P1', 'dept': 'D1', 'inferred': True}]}
    sp, _ = people_links.merge(base(), pr)
    assert [(e['kind'], e['est']) for e in sp['edges']] == [('person-dept', True)]


def test_empty_or_missing_keeps_spider():
    for pr in (None, [], {'people': []}, {}):
        sp = base()
        out, st = people_links.merge(copy.deepcopy(sp), pr)
        assert out == sp and st == {}


def test_repo_file_is_empty_and_spider_unchanged():
    with open(os.path.join(ROOT, 'data', 'people_roles.json'), encoding='utf-8') as f:
        assert people_links.people(json.load(f)) == []


def test_links_and_inferred_and_unknown_names_skipped():
    pr = {'meta': {}, 'people': [{'id': 'person:P1', 'label': 'P1', 'dept': 'D1', 'doc_nos': ['D1-1'],
                                  'collab': [{'name': 'P2', 'inferred': True}, 'D1', 'P9']},
                                 {'id': 'person:P9', 'label': 'P9', 'dept': 'D1'}]}
    sp, st = people_links.merge(base(), pr, known_names={'P2'})
    kinds = sorted((e['from'], e['to'], e['kind'], e['est']) for e in sp['edges'])
    assert kinds == [('person:P1', 'dept:D1', 'person-dept', False), ('person:P1', 'dept:D1', 'person-협조', False),
                     ('person:P1', 'person:P2', 'person-협조', True)]
    assert 'person:P9' not in {n['id'] for n in sp['nodes']}
    assert st['건너뜀(공개 명단에 없는 이름)'] == 2
    again, _ = people_links.merge(copy.deepcopy(sp), pr, known_names={'P2'})
    assert len(again['edges']) == len(sp['edges'])
