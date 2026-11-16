"""JSON 정본의 최상위 built_at. 실행 시각을 한국(+09:00) ISO로 남긴다. 손으로 넣지 말 것."""
import datetime as dt

KST = dt.timezone(dt.timedelta(hours=9))
ISO = '%Y-%m-%dT%H:%M:%S+09:00'


def now(t=None):
    if t is None:
        t = dt.datetime.now(KST)
    elif t.tzinfo is None:
        t = t.replace(tzinfo=KST)
    else:
        t = t.astimezone(KST)
    return t.strftime(ISO)


def stamp(obj, t=None):
    if not isinstance(obj, dict):
        return obj
    obj['built_at'] = now(t)
    return obj
