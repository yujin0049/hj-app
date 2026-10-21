// 편집 설정(오버라이드) 모델 — 뷰어와 편집 페이지가 같이 씀
export const FLOOR_IDS = ['1F', '2F', '3F', 'RF', 'ALL'];
export const COLORS = { '': '기본', blue: '파랑', green: '초록', orange: '주황', purple: '보라', gray: '회색' };
export function defaultConfig(data) {
  const labels = {};
  for (const f of [...data.floors.map((f) => f.id), 'RF']) labels[f] = [];
  for (const r of data.rooms) labels[r.floor].push({ id: r.id, no: r.no, name: r.name, p: r.p, kind: r.kind === 'entry' ? 'entry' : 'room', color: '', dwg: r.dwg });
  for (const [i, l] of data.roof.labels.entries()) labels.RF.push({ id: 'RF-' + (i + 1), no: '', name: l.name, p: l.p, kind: 'room', color: '', dwg: l.name });
  return {
    v: 1,
    title: '경남항공교육원 전경 3D',
    subtitle: '국립창원대학교 남해캠퍼스',
    note: '2020.04 준공도면 기준 단순화 모델 · 실제와 다를 수 있어요',
    floors: [
      { id: '1F', tab: '1F', name: '지상 1층' }, { id: '2F', tab: '2F', name: '지상 2층' }, { id: '3F', tab: '3F', name: '지상 3층' },
      { id: 'RF', tab: '지붕', name: '지붕 · 옥상' }, { id: 'ALL', tab: '전체', name: '전체' },
    ],
    labels,
    cams: {},
  };
}
// 저장된 설정을 기본값 위에 얹기 (빠진 값은 기본값)
export function mergeConfig(def, o) {
  if (!o || typeof o !== 'object') return structuredClone(def);
  const c = structuredClone(def);
  for (const k of ['title', 'subtitle', 'note']) if (typeof o[k] === 'string') c[k] = o[k];
  if (Array.isArray(o.floors)) {
    const seen = new Set(); const fl = [];
    for (const f of o.floors) { const d = def.floors.find((x) => x.id === f.id); if (d && !seen.has(f.id)) { seen.add(f.id); fl.push({ id: f.id, tab: String(f.tab ?? d.tab), name: String(f.name ?? d.name) }); } }
    for (const d of def.floors) if (!seen.has(d.id)) fl.push(d);
    c.floors = fl;
  }
  if (o.labels && typeof o.labels === 'object') for (const k of Object.keys(c.labels)) if (Array.isArray(o.labels[k])) c.labels[k] = o.labels[k].filter((l) => l && Array.isArray(l.p)).map((l) => ({ id: String(l.id), no: String(l.no || ''), name: String(l.name || ''), p: [+l.p[0], +l.p[1]], kind: l.kind === 'entry' ? 'entry' : 'room', color: COLORS[l.color] ? l.color : '', dwg: String(l.dwg || '') }));
  if (o.cams && typeof o.cams === 'object') for (const [k, v] of Object.entries(o.cams)) if (FLOOR_IDS.includes(k) && v && v.pos?.length === 3 && v.target?.length === 3) c.cams[k] = { pos: v.pos.map(Number), target: v.target.map(Number) };
  return c;
}
export const labelText = (l) => [l.no, l.name].map((s) => (s || '').trim()).filter(Boolean).join(' ');
