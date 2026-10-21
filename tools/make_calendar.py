#!/usr/bin/env python3
"""현황판 '업무' 탭 덤프 + data/calendar_extra.json → data/calendar.json, data/status.json
사용: make_calendar.py [--raw 덤프경로] [--extra data/calendar_extra.json] [--out data] [--today YYYY-MM-DD] [--log 지운낱말경로]
- 덤프: 커넥터 read_range 결과(JSON, 앞뒤 글자 있어도 됨) 또는 CSV. 원자료는 저장소 밖(/workspace/hj_audit/calendar/)에 둔다.
- 남기는 것: T번호·업무 이름(사람 이름 지움)·분야·상태·마감일·담당 1봇·유진님 할 일 표시. 담당·상대·근거·다음 행동 글은 버림.
- 출력에 전화·주민번호·계좌·이메일·사람 이름 모양이 보이면 파일을 쓰지 않고 종료 코드 2.
다시 돌리면 = 갱신."""
import argparse, csv, io, json, os, re, sys, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hjpii

KST = dt.timezone(dt.timedelta(hours=9))
DONE = {'완료', '취소', '끝남'}


def is_done(st):
    """「취소(결재 회수 완료)」처럼 꼬리가 붙어도 앞말로 판단"""
    return bool(re.match(r'^\s*(완료|취소|끝남)', str(st or '')))
DEFAULT_RAW = '/workspace/hj_audit/calendar/raw_업무.json'


def read_table(path):
    t = open(path, encoding='utf-8').read()
    i = t.find('{"spreadsheetId')
    if i < 0:
        i = t.find('{')
    if i >= 0:
        try:
            d, _ = json.JSONDecoder().raw_decode(t[i:])
            content = d['ranges'][0]['content'] if 'ranges' in d else d['content']
            return list(csv.reader(io.StringIO(content)))
        except (ValueError, KeyError, IndexError):
            pass
    return list(csv.reader(io.StringIO(t.replace('\ufeff', ''))))


RANGE_RE = re.compile(r'(\d{1,2})\.\s*(\d{1,2})\.?\s*(?:\([월화수목금토일]\))?\s*[~∼-]\s*(?:(\d{1,2})\.\s*)?(\d{1,2})\.?\s*(?:\([월화수목금토일]\))?')


def end_from_title(title, start):
    """제목 안 「11.3.(화)~11.4.(수)」 같은 기간 → 끝 날짜(시작 날짜와 같은 날로 시작할 때만, 60일 안). 없으면 ''."""
    try:
        s = dt.date.fromisoformat(start)
    except (TypeError, ValueError):
        return ''
    for m in RANGE_RE.finditer(str(title or '')):
        mo, d, mo2, d2 = m.groups()
        if (int(mo), int(d)) != (s.month, s.day):
            continue
        try:
            e = dt.date(s.year, int(mo2 or mo), int(d2))
        except ValueError:
            continue
        if e < s:
            e = e.replace(year=s.year + 1)
        if 0 < (e - s).days <= 60:
            return e.isoformat()
    return ''


def norm_date(v, year):
    v = str(v or '').strip()
    m = re.match(r'^(20\d\d)[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})\.?$', v)
    if m:
        y, mo, d = map(int, m.groups())
    else:
        m = re.match(r'^(\d{1,2})[./]\s*(\d{1,2})\.?$', v)
        if not m:
            return ''
        y, (mo, d) = year, map(int, m.groups())
    try:
        return dt.date(y, mo, d).isoformat()
    except ValueError:
        return ''


def col(head, *names):
    for n in names:
        if n in head:
            return head.index(n)
    return -1


def parse_tasks(rows, year):
    if not rows:
        raise ValueError('빈 표')
    head = [h.strip() for h in rows[0]]
    c = {k: col(head, *v) for k, v in {
        'id': ('ID', 'T번호', '번호'), 'title': ('업무명', '업무 이름', '업무'), 'area': ('분류', '업무 분야', '구분'),
        'status': ('상태',), 'due': ('마감일', '마감'), 'bot': ('담당 1봇', '담당1봇'), 'next': ('다음 행동',),
        'who': ('담당·상대',), 'basis': ('근거',)}.items()}
    for k in ('id', 'title', 'status', 'due'):
        if c[k] < 0:
            raise ValueError('필수 열 없음: ' + k)
    g = lambda r, k: (r[c[k]].strip() if 0 <= c[k] < len(r) else '')
    raw = []
    for r in rows[1:]:
        tid = g(r, 'id')
        if not re.match(r'^T\d{2,4}$', tid):
            continue
        raw.append({'t': tid, 'title': g(r, 'title'), 'area': g(r, 'area') or '기타', 'status': g(r, 'status') or '할 일',
                    'due_raw': g(r, 'due'), 'bot': g(r, 'bot'), 'next': g(r, 'next'), 'who': g(r, 'who'), 'basis': g(r, 'basis')})
    return raw


def wait_lists(raw):
    """「대기: PC」「대기: KORUS」 줄의 다음 행동에서 T번호 모음. 「봇이름(T063)」처럼 괄호 안은 담당 표시라 뺌."""
    out = {}
    for x in raw:
        m = re.match(r'^대기\s*:\s*(.+)$', x['title'])
        if m:
            txt = re.sub(r'\(T\d+\)', '', x['next'])
            out[x['t']] = ('대기: ' + m.group(1).strip(), set(re.findall(r'T\d{3}', txt)))
    return out


def yujin_tags(x, waits):
    if is_done(x['status']):
        return []
    tags = []
    for _, (label, ids) in waits.items():
        if x['t'] in ids:
            tags.append(label)
    blob = x['title'] + ' ' + x['next']
    # 「부총장님 결재 대기」처럼 남이 결재할 차례인 건 빼고, 상신·결재 올리기만
    if re.search(r'상신', blob) or re.search(r'결재(?!\s*대기)', re.sub(r'미결재|결재권자|결재 회수 끝', '', blob)):
        tags.append('결재·상신')
    if re.search(r'로그인', x['next']):
        tags.append('로그인')
    if x['status'] == '확인 필요':
        tags.append('확인 필요')
    if re.search(r'유진님\s*(직접|이\s|께|회신|확인 후|승인)|승인 여부', x['next']):
        tags.append('유진님 직접')
    return sorted(set(tags), key=tags.index)


def build(raw, extra, today, year, master=None, ingest_ev=None, ingest_td=None, mnotes=(), mwho=(), decisions=None):
    texts = [v for x in raw for v in (x['title'], x['who'], x['next'], x['basis'])]
    texts += [x.get('title', '') for x in (master or []) + (ingest_ev or []) + (ingest_td or [])]
    names = hjpii.derive_names(texts) | {w for x in raw for w in hjpii.suspicious(x['who'])} | {w for x in mwho for w in hjpii.suspicious(x)}
    removed = set()
    waits = wait_lists(raw)
    tasks, events = [], []
    for x in raw:
        if x['t'] in waits:
            continue  # 묶음 줄은 표시 안 하고 태그로만 씀
        title, rm = hjpii.scrub(x['title'], names)
        removed |= rm
        due = norm_date(x['due_raw'], year)
        task = {'t': x['t'], 'title': title, 'area': x['area'], 'status': x['status'], 'due': due,
                'bot': x['bot'] or '', 'yujin': yujin_tags(x, waits)}
        if x['due_raw'] and not due:
            task['check'] = '마감일 모양 이상'
        tasks.append(task)
        if due:
            events.append({'id': x['t'], 't': x['t'], 'title': title, 'date': due, 'kind': '마감', 'lane': 'yujin',
                           'status': x['status'], 'area': x['area'], 'bot': x['bot'] or '', 'src': 'sheet',
                           'yujin': task['yujin'], 'check': task.get('check', '')})
            end = end_from_title(title, due)  # 현황판엔 끝 날짜 칸이 없어 업무명 속 「11.3.(화)~11.4.(수)」로 읽음
            if end:
                events[-1]['end'] = end
    by_t = {e['t']: e for e in events}
    task_t = {t['t']: t for t in tasks}
    n = {'extra': 0, 'master': 0, 'ingest': 0, 'merged': 0, 'skipped': 0, 'conflict': 0}
    others = []
    master_rep = {}
    for x in master or []:
        if x.get('mkind') == '현황판' and x.get('ref'):
            master_rep[x['ref']] = master_rep.get(x['ref'], 0) + 1

    def lane_of(x):
        return x.get('lane', 'yujin')
    ingest_title_n = {}
    for x in (ingest_ev or []) + (ingest_td or []):
        k = re.sub(r'[\s·()]', '', x.get('title', ''))
        ingest_title_n[k] = ingest_title_n.get(k, 0) + 1

    def toks(x):
        return {w for w in re.findall(r'[A-Za-z]{3,}|[가-힣]{3,}', x)}
    checks = []
    seen = []  # (출처, ref, 날짜, 제목) — 일정총괄이 먼저 들어가 같은 일의 extra 를 막음

    def add_check(t, title, why):
        if not any(c['t'] == t and c['why'] == why for c in checks):
            checks.append({'t': t, 'title': title, 'why': why})

    def key_title(x):
        return re.sub(r'[\s·()]', '', x)

    for i, ex in enumerate(list(master or []) + list(extra.get('items', [])) + list(ingest_ev or []) + list(ingest_td or [])):
        origin = ex.get('_origin', 'extra')
        ref = ex.get('ref', '') or ''
        src_note = ex.get('source', '일정총괄' if origin == 'master' else '')
        # 상태만 알려 주는 줄 (예: T039 완료)
        if origin == 'ingest' and ex.get('_todo') and ref in task_t:
            # 할 일의 정본은 현황판: 같은 T번호면 표시는 현황판 것, 다르면 충돌·확인 필요만
            tt = task_t[ref]
            d2 = norm_date(ex.get('date'), year)
            if d2 and d2 != tt['due']:
                t2, rm = hjpii.scrub(ex.get('title', ''), names); removed |= rm
                events.append({'id': 'I%02d' % (i + 1), 't': ref, 'title': t2, 'date': d2, 'kind': '할 일', 'lane': ex.get('lane', 'yujin'),
                               'status': tt['status'], 'area': tt['area'], 'bot': tt['bot'], 'src': 'ingest', 'source': ex['source'],
                               'yujin': [], 'check': ''})
                n['ingest'] += 1
            if ex.get('status') and ex['status'] != tt['status']:
                add_check(ref, tt['title'], '상태 다름: 현황판 %s / %s %s' % (tt['status'], ex['source'], ex['status']))
            n['merged'] += 1
            continue
        if not ex.get('date'):
            if origin == 'ingest' and ex.get('title'):
                t2, rm = hjpii.scrub(ex['title'], names); removed |= rm
                others.append({'title': t2, 'due': '', 'lane': ex.get('lane', 'yujin'), 'status': ex.get('status', ''),
                               'group': group_of(ex.get('area'), t2), 'source': ex['source']})
                continue
            if ref in task_t and ex.get('status'):
                if task_t[ref]['status'] != ex['status']:
                    add_check(ref, task_t[ref]['title'], '상태 다름: 현황판 %s / %s %s' % (task_t[ref]['status'], src_note, ex['status']))
                else:
                    task_t[ref].setdefault('notes', []).append('%s: %s 맞음' % (src_note, ex['status']))
            continue
        date = norm_date(ex['date'], year)
        if not date:
            raise ValueError('%s 날짜 이상: %d번째' % (origin, i + 1))
        title, rm = hjpii.scrub(ex.get('title', '') or (ref + ' 일정'), names)
        removed |= rm
        if origin == 'master' and ex.get('mkind') == '현황판':
            e = by_t.get(ref)
            if e and e['date'] != date and master_rep.get(ref, 0) > 1:
                # 매주 반복(예: 목요일 성과보고): 반복 날짜를 일정으로 넣음, 충돌 아님
                events.append({'id': 'R%02d' % (i + 1), 't': ref, 'title': e['title'], 'date': date, 'kind': '반복', 'lane': 'yujin',
                               'status': e['status'], 'area': e['area'], 'bot': e['bot'], 'src': 'master', 'source': '일정총괄 · 반복',
                               'yujin': e['yujin'], 'check': ''})
                n['master'] += 1
                continue
            # 날짜 정본 = 현황판(결정 261021): 일정총괄이 옮겨 적은 현황판 날짜가 달라도 현황판 것만 씀
            n['merged'] += 1
            continue
        if origin in ('master', 'ingest') and ex.get('mkind') != '계획' and ref and by_t.get(ref) and by_t[ref]['date'] == date and ex.get('lane') == 'yujin':
            e = by_t[ref]
            if origin not in e['src']:
                e['src'] += '+' + origin
            n['merged'] += 1
            if ref in task_t:
                task_t[ref].setdefault('steps', []).append({'date': date, 'title': title, 'lane': 'yujin', 'kind': '마감', 'source': src_note})
            continue
        if origin == 'extra' and any(o == 'master' and d == date and ((ref and r == ref and ln == ex.get('lane', 'yujin')) or key_title(kt) == key_title(title)
                                                                      or (ln == ex.get('lane', 'yujin') and len(toks(kt) & toks(title)) >= 2))
                                     for o, r, d, kt, ln in seen):
            n['skipped'] += 1  # 일정총괄이 먼저
            continue
        if origin == 'ingest':
            kt = key_title(title)
            # 같은 날: 같은 제목이거나 같은 T번호·같은 레인이면 같은 일 → 합침
            if any(e['date'] == date and (key_title(e['title']) == kt or (ref and e['t'] == ref and e['lane'] == lane_of(ex))) for e in events) \
                    or (ref and by_t.get(ref) and by_t[ref]['date'] == date):
                n['merged'] += 1
                continue
            # 다른 날: 제목이 같은 한 번짜리 일만 충돌(반복 일정·여러 번 나오는 제목은 충돌 아님)
            same = [e for e in events if key_title(e['title']) == kt and e['kind'] != '반복']
            clash = [e for e in same if e['date'] != date] if (not ex.get('_rep') and ingest_title_n.get(kt, 0) == 1 and len(same) == 1) else []
            if clash:
                msg = '충돌: 날짜 다름 · %s %s / %s %s' % (clash[0].get('source') or clash[0]['src'], clash[0]['date'], ex['source'], date)
                for e in clash:
                    e['check'] = msg
                ex = dict(ex, check=msg); n['conflict'] += 1
        seen.append((origin, ref, date, title, ex.get('lane', 'yujin')))
        lane = ex.get('lane', 'yujin')
        step = {'date': date, 'title': title, 'lane': lane, 'kind': ex.get('kind', '일정'), 'source': src_note}
        if ex.get('cond'):
            step['cond'] = ex['cond']
        if ref in task_t:
            task_t[ref].setdefault('steps', []).append(step)
        if ex.get('same_as') == 'deadline' and ref:
            e = by_t.get(ref)
            if e and e['date'] == date:
                e['src'] = 'sheet+' + origin
                e['note'] = title
                e['source'] = src_note
                n['merged'] += 1
                continue
            if e:
                msg = '충돌: 날짜 다름 · 현황판 %s / %s %s' % (e['date'], src_note or origin, date)
                e['check'] = msg
                add_check(ref, e['title'], msg)
            elif ref in task_t:
                add_check(ref, task_t[ref]['title'], '현황판에 마감일 없음, %s %s' % (src_note or origin, date))
        ev = {'id': '%s%02d' % ('M' if origin == 'master' else 'X', i + 1), 't': ref, 'title': title, 'date': date,
              'kind': ex.get('kind', '일정'), 'lane': lane,
              'status': ex.get('status') or (task_t[ref]['status'] if ref in task_t else '할 일'),
              'area': ex.get('area') or (task_t[ref]['area'] if ref in task_t else '기타'),
              'bot': task_t[ref]['bot'] if ref in task_t else '', 'src': origin, 'source': src_note,
              'yujin': [], 'check': ex.get('check', ''), '_mk': ex.get('mkind', '')}
        if ex.get('end'):
            ev['end'] = norm_date(ex['end'], year)
        if not ev.get('end'):
            ev['end'] = end_from_title(title, date)
        if not ev['end'] or ev['end'] <= date:
            ev.pop('end', None)
        if ex.get('cond'):
            ev['cond'] = ex['cond']
        if origin == 'ingest' and ex.get('_todo'):
            others.append({'title': title, 'due': date, 'lane': lane, 'status': ev['status'], 'group': group_of(ev['area'], title), 'source': src_note})
        if ex.get('same_as') == 'deadline' and ref and by_t.get(ref) and by_t[ref]['date'] != date:
            ev['check'] = by_t[ref]['check']
        dup = next((e for e in events if e['date'] == date and key_title(e['title']) == key_title(title)), None)
        if dup:
            dup['src'] = dup['src'] + '+' + origin if origin not in dup['src'] else dup['src']
            n['merged'] += 1
            continue
        if ev['check']:
            add_check(ref, title, ev['check'])
        events.append(ev)
        n[origin] += 1
    # ---- 날짜 정본 = 현황판 (대장 결정 261021_일정날짜_정본결정) ----
    dec = decisions or {}
    step_name = {(x['t'], x['date']): x['step'] for x in dec.get('steps', [])}
    drop = {(x['t'], d) for x in dec.get('drop', []) for d in x.get('dates', [])}
    n_before = n['conflict'] + sum(1 for c in mnotes if c['why'].startswith('충돌')) + sum(1 for c in checks if c['why'].startswith('충돌'))
    kept = []
    n_sub = n_drop = n_dup = 0
    seen_sub = set()
    for e in events:
        tt = task_t.get(e['t'])
        if tt and e['check'].startswith('충돌'):
            e['check'] = ''  # 같은 T번호 날짜 차이는 하위 단계로 풂
        if e['src'].startswith('sheet') or not tt:
            kept.append(e)
            continue
        if (e['t'], e['date']) in drop:
            n_drop += 1
            continue
        # 결정표의 단계명은 캘린더·노션·메모리에서 온 줄에만(볼트 계획 줄은 이미 단계 이름이 있음)
        ov = step_name.get((e['t'], e['date'])) if e.get('_mk') != '계획' else None
        nm = ov or step_of(e['title'], e['t'])
        key = (e['t'], e['date'], nm)
        if key in seen_sub:
            n_dup += 1
            continue
        seen_sub.add(key)
        e['step'] = nm
        e['title'] = '%s 하위: %s' % (e['t'], nm)
        e['sub'] = True
        if e['check'].startswith('충돌'):
            e['check'] = ''
        n_sub += 1
        kept.append(e)
    events[:] = kept
    for e in events:
        e.pop('_mk', None)
    # 현황표의 하위 단계 = 달력의 하위 단계와 똑같이
    for t in tasks:
        t.pop('steps', None)
        sub = sorted((e for e in events if e.get('sub') and e['t'] == t['t']), key=lambda e: e['date'])
        if sub:
            t['steps'] = [dict({'date': e['date'], 'step': e['step'], 'title': e['step'], 'lane': e['lane'], 'kind': e['kind'],
                                'source': e.get('source', '')}, **({'cond': e['cond']} if e.get('cond') else {})) for e in sub]
    checks[:] = [c for c in checks if not (c['why'].startswith('충돌') and c['t'] in task_t)]
    for x in dec.get('canonical', []):
        tt = task_t.get(x['t'])
        if tt and tt['due'] != x['date']:
            add_check(x['t'], tt['title'], '현황판 값 맞추기: 대장 결정 정본 %s, 현황판 아직 %s (현황판이 바뀌면 자동 반영)' % (x['date'], tt['due'] or '없음'))
    for x in dec.get('pending', []):
        if x['t'] in task_t:
            add_check(x['t'], task_t[x['t']]['title'], '확인 필요: ' + x['why'])
    for c in mnotes:
        if c['why'].startswith('충돌') and c['t'] in task_t:
            continue  # 같은 T번호 날짜 차이 = 하위 단계(결정), 충돌 아님
        why, rm = hjpii.scrub(c['why'], names)
        removed |= rm
        tt = task_t.get(c['t'], {})
        add_check(c['t'], tt.get('title', ''), why[:300])
        if why.startswith('충돌'):
            n['conflict'] += 1
    for e in events:
        e['group'] = group_of(e['area'], e['title'])
        if e['check']:
            add_check(e['t'], e['title'], e['check'])
    for t in tasks:
        t['group'] = group_of(t['area'], t['title'])
        if t.get('check'):
            add_check(t['t'], t['title'], t['check'])
        if t.get('steps'):
            t['steps'].sort(key=lambda x: x['date'])
    events.sort(key=lambda e: (e['date'], e['lane'], e['id']))
    n_sheet = sum(1 for e in events if e['src'].startswith('sheet'))
    cal = {'version': 1, 'source': '인수인계봇 현황판 시트 「업무」 탭 + ' + ('00 홈/일정총괄.json + ' if master else '') + 'data/calendar_extra.json',
           'counts': {'sheet': n_sheet, 'master': n['master'], 'extra': n['extra'], 'ingest': n['ingest'], 'merged': n['merged'],
                      'skipped_extra': n['skipped'], 'conflict': sum(1 for c in checks if c['why'].startswith('충돌')),
                      'conflict_before_rule': n_before, 'sub_steps': n_sub, 'dropped': n_drop, 'total': len(events)},
           'groups': GROUPS, 'rule': '날짜 정본 = 현황판. 같은 T번호의 다른 날짜는 「T번호 하위: 단계명」(대장 결정 261021)',
           'lanes': {'yujin': '유진님 할 일', 'prof': '교수님 일정', 'ref': '참고(유진님 일 아님)'},
           'prof_note': extra.get('prof_note', ''), 'events': events, 'checks': checks}
    st = {'version': 1, 'source': '인수인계봇 현황판 시트 「업무」 탭',
          'counts': {'tasks': len(tasks), 'yujin': sum(1 for t in tasks if t['yujin']),
                     'active': sum(1 for t in tasks if not is_done(t['status']))},
          'groups': GROUPS, 'tasks': tasks, 'others': others}
    return cal, st, removed, names


MASTER_DEFAULT = '/home/box/vault/봇공유/00 홈/일정총괄.json'
F_DATE = ('date', '날짜', '일자', '마감', '마감일', 'due', 'deadline', 'start', '시작', '시작일', 'when')
F_TITLE = ('title', '제목', '업무', '업무명', '업무 이름', '일정', '이름', 'name', 'summary', '내용')
F_REF = ('t', 'T', 'T번호', 'ref', 'task', '업무번호', 'id', 'ID')
F_KIND = ('구분', 'lane', '레인', 'category', '분류', 'type', 'kind', '종류')
F_STATUS = ('상태', 'status')
F_SOURCE = ('source', '출처', '근거')
F_KNOWN_EXTRA = ('end', '종료', '종료일', 'area', '분야', 'note', '메모', 'same_as', 'check', '확인')


def _pick(d, keys):
    for k in keys:
        if k in d and d[k] not in (None, ''):
            return k, d[k]
    return None, None


def load_master(path, year):
    """일정총괄.json(대장 build_schedule.py) 읽기. 모양이 달라도 날짜·제목·T번호·구분 칸을 찾아 씀.
    돌려줌: (일정 줄 목록 또는 None, 모르는 칸 이름, 대장이 찾은 충돌·확인 목록, 이름 후보 글자)"""
    if not path or not os.path.exists(path):
        return None, [], [], []
    d = json.load(open(path, encoding='utf-8'))
    items, notes, who = d, [], []
    if isinstance(d, dict):
        for k in ('events', 'items', '일정', 'schedule', 'list', '목록', 'data'):
            if isinstance(d.get(k), list):
                items = d[k]
                break
        else:
            items = [v for v in d.values() if isinstance(v, list) and v and isinstance(v[0], dict)]
            items = items[0] if items else []
        for c in d.get('conflicts', []) or []:
            if isinstance(c, dict):
                k = str(c.get('kind', ''))
                head = '충돌' if re.search(r'날짜 다름|날짜 두 개', k) else ('상태 다름' if '상태' in k else '참고')
                notes.append({'t': str(c.get('t', '')), 'why': head + ': ' + k + ' · ' + str(c.get('detail', ''))})
        for c in d.get('checks', []) or []:
            if isinstance(c, dict):
                notes.append({'t': str(c.get('t', '')), 'why': '%s · %s %s' % (c.get('check', '확인 필요'), c.get('date', ''), c.get('title', ''))})
        for k in ('past_due', 'after_end', 'no_date', 'yujin_todo'):
            for c in d.get(k, []) or []:
                if isinstance(c, dict) and c.get('who'):
                    who.append(str(c['who']))
    out, unknown = [], set()
    used = set(F_DATE + F_TITLE + F_REF + F_KIND + F_STATUS + F_SOURCE + F_KNOWN_EXTRA + ('who', 'weekday', 'calendar', 'condition', 'yujin_action'))
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            continue
        unknown |= {k for k in it if k not in used}
        if it.get('who'):
            who.append(str(it['who']))  # 사람 칸: 화면에 안 씀, 이름 거르기에만 씀
        _, date = _pick(it, F_DATE)
        _, title = _pick(it, F_TITLE)
        _, ref = _pick(it, F_REF)
        m = re.search(r'T\d{3}', str(ref or '') + ' ' + str(title or ''))
        ref = m.group(0) if m else ''
        _, kind = _pick(it, F_KIND)
        kind = str(kind or '')
        _, status = _pick(it, F_STATUS)
        _, src = _pick(it, F_SOURCE)
        title = str(title or '')
        if '교수' in kind or re.search(r'특강\s*\d{1,2}:\d{2}|교수님\s*(일정|출장|강의|수업)', title):
            lane = 'prof'
        elif '참고' in kind:
            lane = 'ref'
        elif 'yujin_action' in it:
            lane = 'yujin' if (it.get('yujin_action') or title.startswith('[할 일]')) else 'ref'
        else:
            lane = 'yujin'
        row = {'_origin': 'master', 'title': title, 'date': str(date or '')[:10], 'ref': ref, 'lane': lane,
               'kind': '수업' if lane == 'prof' else ('참고' if lane == 'ref' else ('마감' if '마감' in kind + title else '일정')),
               'mkind': kind, 'source': '일정총괄' + (' · ' + str(src) if src else '')}
        if it.get('end'):
            row['end'] = str(it['end'])[:10]
        if it.get('condition'):
            row['cond'] = str(it['condition'])
        if it.get('check'):
            row['check'] = str(it['check'])
        if status:
            row['status'] = str(status)
        if not row['date'] and not row.get('status'):
            continue
        out.append(row)
    return out, sorted(unknown), notes, who


def step_of(title, t=''):
    """원래 제목 → 짧은 단계 이름: [태그]·시간·T번호·「 — 」 뒤 설명을 뺌."""
    x = str(title or '')
    x = re.sub(r'\[[^\]]{1,20}\]\s*', '', x)
    x = re.sub(r'\d{1,2}:\d{2}\s*[~-]\s*\d{1,2}:\d{2}', '', x)
    if t:
        x = re.sub(r'\b' + re.escape(t) + r'\b\s*', '', x)
    x = re.sub(r'^.*?하위:\s*', '', x)
    parts = re.split(r'\s+—\s+', x)
    x = parts[0] + (' (%s)' % parts[1].strip() if len(parts) > 1 and 0 < len(parts[1].strip()) <= 8 else '')
    x = re.sub(r'\s{2,}', ' ', x).strip(' ·:-')
    return (x[:40] + '…') if len(x) > 41 else (x or '단계')


GROUPS = ['OJNT', '특강', '강사료', '실습재료', '행사', '사물함', '공문', '기타']


def group_of(area, title):
    """업무 분야 묶음 (거르기용): OJNT·특강·강사료·실습재료·행사·사물함·공문·기타"""
    a, t = str(area or ''), str(title or '')
    if a in GROUPS:
        return a
    if re.search(r'OJNT|싱가포르|기숙사|입사|입소', a + t):
        return 'OJNT'
    if re.search(r'특강|자격취득|산업기사', a + t):
        return '특강'
    if re.search(r'강사료|강의확인|정비사과정', a + t):
        return '강사료'
    if re.search(r'재료', a + t):
        return '실습재료'
    if re.search(r'견학|행사|에어쇼|박람회|설명회', a + t):
        return '행사'
    if re.search(r'사물함', a + t):
        return '사물함'
    if re.search(r'공문|[가-힣]+과-\d+|의견조회|회신|기안|상신', t):
        return '공문'
    return '기타'


INGEST_DIR = '/workspace/hj_audit/ingest'
LANE_WORD = {'유진님 할 일': 'yujin', '유진님': 'yujin', 'yujin': 'yujin', '교수님 일정': 'prof', '교수님': 'prof', 'prof': 'prof',
             '참고': 'ref', 'ref': 'ref'}


def load_ingest(folder):
    """통합일정.json · 통합할일.json (다른 작업자가 Google 캘린더·노션에서 만든 것). 없으면 (None, None, [])."""
    def rows(fn):
        p = os.path.join(folder or '', fn)
        if not folder or not os.path.exists(p):
            return None
        d = json.load(open(p, encoding='utf-8'))
        if isinstance(d, dict):
            for k in ('items', 'events', 'tasks', '일정', '할일', 'data', 'list'):
                if isinstance(d.get(k), list):
                    return d[k]
            return []
        return d if isinstance(d, list) else []
    known = set(F_DATE + F_TITLE + F_REF + F_KIND + F_STATUS + F_SOURCE + F_KNOWN_EXTRA + ('업무 분야', '업무분야', 'id', 'source'))
    unknown = set()

    def conv(items, todo):
        out = []
        for it in items or []:
            if not isinstance(it, dict):
                continue
            unknown.update(k for k in it if k not in known)
            _, date = _pick(it, F_DATE + ('due',))
            date = str(date or '')[:10]
            _, end = _pick(it, ('end', '종료', '종료일'))
            _, title = _pick(it, F_TITLE)
            _, ref = _pick(it, ('T번호', 't', 'T', 'ref', 'task'))
            m = re.search(r'T\d{3}', str(ref or '') + ' ' + str(title or ''))
            _, lane = _pick(it, ('lane', '레인', '구분'))
            _, area = _pick(it, ('업무 분야', '업무분야', 'area', '분야', '분류'))
            _, status = _pick(it, F_STATUS)
            _, src = _pick(it, ('source', '출처'))
            if todo and it.get('from_sheet'):
                continue  # 현황판에서 온 할 일은 현황판이 정본(중복)
            _, ik = _pick(it, ('kind', '종류'))
            row = {'_origin': 'ingest', '_todo': todo, 'title': str(title or ''), 'date': date, 'ref': m.group(0) if m else '',
                   'lane': LANE_WORD.get(str(lane or '').strip(), 'yujin'), 'area': str(area or ''),
                   'kind': '할 일' if todo else ('참고' if LANE_WORD.get(str(lane or '').strip()) == 'ref' else (str(ik) if ik in ('마감', '일정', '할 일', '수업') else '일정')),
                   '_rep': str(status or '') == '반복',
                   'source': '통합' + ('할일' if todo else '일정') + (' · ' + str(src) if src else '')}
            if end and str(end)[:10] != date:
                row['end'] = str(end)[:10]
            if status:
                row['status'] = str(status)
            out.append(row)
        return out
    ev, td = rows('통합일정.json'), rows('통합할일.json')
    return (None if ev is None else conv(ev, False)), (None if td is None else conv(td, True)), sorted(unknown)


def check_outputs(objs, names):
    bad = []
    for fname, obj in objs.items():
        for path, s in hjpii.walk_strings(obj):
            for kind in hjpii.find_pii(s, names):
                bad.append('%s %s: %s' % (fname, path, kind))
    return bad


def main(argv=None):
    ap = argparse.ArgumentParser()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument('--raw', default=DEFAULT_RAW)
    ap.add_argument('--extra', default=os.path.join(root, 'data', 'calendar_extra.json'))
    ap.add_argument('--out', default=os.path.join(root, 'data'))
    ap.add_argument('--today', default=dt.datetime.now(KST).date().isoformat())
    ap.add_argument('--log', default='/workspace/hj_audit/calendar/지운낱말.txt')
    ap.add_argument('--decisions', default=os.path.join(root, 'data', 'calendar_decisions.json'))
    ap.add_argument('--master', default=MASTER_DEFAULT, help='일정총괄.json (없으면 건너뜀)')
    ap.add_argument('--ingest', default=INGEST_DIR, help='통합일정.json·통합할일.json 폴더 (없으면 건너뜀)')
    ap.add_argument('--unknown-log', default='/workspace/hj_audit/calendar/일정총괄_모르는칸.txt')
    a = ap.parse_args(argv)
    year = int(a.today[:4])
    raw = parse_tasks(read_table(a.raw), year)
    extra = json.load(open(a.extra, encoding='utf-8')) if os.path.exists(a.extra) else {'items': []}
    master, unknown, mnotes, mwho = load_master(a.master, year)
    if master is not None:
        print('일정총괄.json 읽음: %d줄%s' % (len(master), (' · 모르는 칸 ' + ', '.join(unknown)) if unknown else ''))
        if unknown and a.unknown_log:
            with open(a.unknown_log, 'w', encoding='utf-8') as f:
                f.write('# 일정총괄.json 에서 쓰지 않은 칸 이름(값은 안 적음)\n' + '\n'.join(unknown) + '\n')
    iev, itd, iunk = load_ingest(a.ingest)
    if iev is not None or itd is not None:
        print('통합 자료 읽음: 일정 %s줄 · 할일 %s줄%s' % (len(iev or []), len(itd or []), (' · 모르는 칸 ' + ', '.join(iunk)) if iunk else ''))
        if iunk and a.unknown_log:
            with open(a.unknown_log, 'a', encoding='utf-8') as f:
                f.write('# 통합일정/통합할일 에서 쓰지 않은 칸 이름\n' + '\n'.join(iunk) + '\n')
    decisions = json.load(open(a.decisions, encoding='utf-8')) if a.decisions and os.path.exists(a.decisions) else None
    cal, st, removed, names = build(raw, extra, a.today, year, master, iev, itd, mnotes, mwho, decisions)
    cal['master_read'] = master is not None
    cal['ingest_read'] = {'통합일정': iev is not None, '통합할일': itd is not None}
    bad = check_outputs({'calendar.json': cal, 'status.json': st}, names)
    if bad:
        print('개인정보 모양이 보여 멈춤(파일 안 씀):', file=sys.stderr)
        for b in bad[:30]:
            print('  ' + b, file=sys.stderr)
        return 2
    os.makedirs(a.out, exist_ok=True)
    for fn, obj in (('calendar.json', cal), ('status.json', st)):
        with open(os.path.join(a.out, fn), 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if a.log and removed:
        os.makedirs(os.path.dirname(a.log), exist_ok=True)
        with open(a.log, 'w', encoding='utf-8') as f:
            f.write('# 업무 이름에서 지운 낱말(사람 이름 또는 처음 보는 낱말). 이름이 아니면 tools/hjpii.py ALLOW 에 넣기\n')
            f.write('\n'.join(sorted(removed)) + '\n')
        os.chmod(a.log, 0o600)
    c = cal['counts']
    print('calendar.json 일정 %d (현황판 %d · 일정총괄 %d · 대장 고정 %d · 통합 %d · 합침 %d · 일정총괄에 밀린 고정 %d) · 하위 단계 %d · 없앰 %d · 충돌 %d (규칙 전 %d) · 확인 필요 %d · status.json 업무 %d (유진님 %d) · 지운 낱말 %d개'
          % (c['total'], c['sheet'], c['master'], c['extra'], c['ingest'], c['merged'], c['skipped_extra'], c['sub_steps'], c['dropped'], c['conflict'], c['conflict_before_rule'], len(cal['checks']), st['counts']['tasks'], st['counts']['yujin'], len(removed)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
