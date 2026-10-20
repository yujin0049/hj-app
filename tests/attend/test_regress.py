"""Claude 검토(A~E) 회귀 테스트. 가짜 명단만 써요.
실행: 저장소에서 python3 -m http.server 8765 → python tests/attend/test_regress.py http://127.0.0.1:8765/"""
import sys, os, json, openpyxl
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
OUT = os.environ.get('OUT', '/tmp/hj_attend_out/'); os.makedirs(OUT, exist_ok=True)
F = os.path.dirname(os.path.abspath(__file__)) + '/'
R = []; errors = []
def ok(name, cond, detail=''):
    R.append({'test': name, 'pass': bool(cond), 'detail': detail})
def load(pg, f):
    pg.set_input_files('#at-file', F + f); pg.wait_for_selector('#at-info .at-file', timeout=15000); pg.wait_for_timeout(400)
def form(pg, fid): pg.click(f'[data-form="{fid}"]'); pg.wait_for_timeout(250)
def typ(pg, sel, val): pg.fill(sel, val); pg.wait_for_timeout(350)   # 150ms 디바운스
def xlsx(pg, name):
    with pg.expect_download() as d: pg.click('#at-xlsx-btn')
    d.value.save_as(OUT + name); return openpyxl.load_workbook(OUT + name)
def viewtext(pg): return pg.inner_text('#view') + pg.inner_html('#at-cols')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    pg.goto(BASE + '#/attend'); pg.wait_for_selector('#at-file', state='attached')
    # B1 합계 줄(A:C 병합)이 사람으로 안 들어감
    load(pg, 'fake_small_total.xlsx'); form(pg, 'sign')
    chk = pg.inner_text('#at-check')
    ok('B1 small roster 합계 row skipped', '명단 5명 = 출력 5줄' in chk and '합계 줄 1' in chk, chk.split('\n')[0])
    ok('B1 합계 not in preview', '합계' not in pg.inner_text('#at-pv tbody'))
    # B2 보호자성명이 성명을 밀어내지 않음, 부전공은 소속 아님, 보호자 연락처는 민감
    load(pg, 'fake_guardian.xlsx'); form(pg, 'sign')
    names = pg.eval_on_selector_all('#at-pv tbody tr', 'rs => rs.map(r => r.innerText)')
    sel = pg.eval_on_selector_all('[data-map]', 'ss => ss.map(s => s.closest("th").querySelector(".at-lab").textContent + "=" + s.value)')
    ok('B2 성명 column = 성명 (not 보호자성명)', '성명=name' in sel and '보호자성명=name' not in sel, sel)
    ok('B2 부전공 not dept', '부전공=dept' not in sel and '학과=dept' in sel, sel)
    ok('B2 guardian name/phone hidden', '김보호' not in viewtext(pg) and '010-0000' not in viewtext(pg))
    # B3/C 제목 줄 없는 파일: 전화·이메일 칸을 값으로 찾아 숨김
    load(pg, 'fake_headerless_phone.xlsx')
    t = viewtext(pg)
    ok('B3 headerless: phone/email values hidden', '010-0000' not in t and '@example.com' not in t, pg.inner_text('#at-info'))
    ok('B3 headerless: sensitive notice shown', '개인정보 칸 2개' in pg.inner_text('#at-info'), pg.inner_text('#at-info'))
    # C HP·생년·H.P 칸 숨김 + E 날짜 칸 yyyy.mm.dd
    load(pg, 'fake_hp_birth.xlsx'); form(pg, 'attend')
    info = pg.inner_text('#at-info'); t = viewtext(pg)
    ok('C HP/생년/H.P hidden', '개인정보 칸 3개' in info and '01000000000' not in t and '010-0000' not in t, info)
    ok('E date cell -> 2026.03.02', '2026.03.02' in pg.inner_html('#at-cols'), pg.inner_text('#at-cols')[:300])
    # A 날짜 칸 수·이름: 미리보기 = 엑셀 (OJNT 20일차), 21개 넣으면 경고
    load(pg, 'fake_roster_25.xlsx'); form(pg, 'ojnt-attend')
    ok('A sessions-count input hidden for template form', not pg.is_visible('#at-sess'))
    typ(pg, '#at-dates', ', '.join(f'11.{d}' for d in range(1, 22)))
    ok('A 21 dates -> dropped warning', '1개는 빠져요' in pg.inner_text('#at-check'), pg.inner_text('#at-check'))
    typ(pg, '#at-dates', '10.21, 10.22, 10.23')
    head = pg.eval_on_selector_all('#at-pv thead th', 'ts => ts.map(t => t.innerText.replace(/\\n/g, " "))')
    ws = xlsx(pg, 'reg_ojnt_dates.xlsx').active
    xl = [str(ws.cell(4, c).value).replace('\n', ' ') for c in range(1, 27)]
    diff = [(i, a, b) for i, (a, b) in enumerate(zip(head, xl)) if a != b]
    ok('A preview date headers == Excel (OJNT, 20 cols)', len(head) >= 24 and not [d for d in diff if 4 <= d[0] < 24], diff)
    fr = next(r for r in range(5, ws.max_row + 1) if ws.cell(r, 1).value == '출석 인원'); lr = fr - 1
    ok('A 27 > 18 rows: per-row formula on new rows', ws[f'Y{lr}'].value == f'=COUNTIF(E{lr}:X{lr},"O")', [lr, ws[f'Y{lr}'].value])
    ok('A footer moved + range grown', fr == 32 and ws[f'E{fr}'].value == f'=COUNTIF(E5:E{lr},"O")' and f'A{fr}:D{fr}' in [str(m) for m in ws.merged_cells.ranges], [fr, ws[f'E{fr}'].value])
    wbx = openpyxl.load_workbook(OUT + 'reg_ojnt_dates.xlsx')
    ok('A fullCalcOnLoad set', bool(wbx.calculation.fullCalcOnLoad), wbx.calculation.fullCalcOnLoad)
    # A 비교과 날짜가 엑셀에 들어감 + 그림이 표 아래로 같이 내려감
    form(pg, 'noncredit'); typ(pg, '#at-dates', '09.01, 09.08, 09.15')
    ws = xlsx(pg, 'reg_noncredit_dates.xlsx').active
    ok('A noncredit dates in Excel row 4', [ws['A4'].value, ws['D4'].value, ws['H4'].value, ws['M4'].value] == ['09.01', '09.08', '09.15', None], [ws['A4'].value, ws['D4'].value, ws['H4'].value, ws['M4'].value])
    img_row = ws._images[0].anchor._from.row if ws._images else None
    last_data = max(r for r in range(10, ws.max_row + 1) if str(ws.cell(r, 1).value or '').isdigit())
    ok('A noncredit image below roster', img_row is not None and img_row + 1 > last_data, {'img_row1': (img_row or 0) + 1, 'last_data': last_data})
    # C 인쇄 정리: PDF 뒤 att-printing·@page가 남지 않음 / 화면 이동 때도 정리
    pg.evaluate('window.print = function(){}'); pg.click('#at-print-btn')
    pg.pdf(path=OUT + 'reg_print.pdf', prefer_css_page_size=True)
    pg.wait_for_timeout(300)
    st = pg.evaluate('({cls: document.body.classList.contains("att-printing"), page: (document.getElementById("att-page")||{}).textContent || "", title: document.title})')
    ok('C cleanup after print (matchMedia)', not st['cls'] and st['page'] == '' and st['title'] == '행정 업무 연습장', st)
    pg.click('#at-print-btn'); pg.goto(BASE + '#/home'); pg.wait_for_timeout(300)
    st = pg.evaluate('({cls: document.body.classList.contains("att-printing"), page: (document.getElementById("att-page")||{}).textContent || "", title: document.title})')
    ok('C cleanup on leave (hookLeave)', not st['cls'] and st['page'] == '' and st['title'] == '행정 업무 연습장', st)
    pg.goto(BASE + '#/attend'); pg.wait_for_timeout(400)
    # E 디바운스: 글자 하나씩 칠 때 미리보기를 매번 다시 그리지 않음
    load(pg, 'fake_roster_25.xlsx'); form(pg, 'sign')
    pg.evaluate('window.__n = 0; new MutationObserver(function(){ window.__n++; }).observe(document.getElementById("at-pv"), {childList: true});')
    pg.type('#at-title', '디바운스테스트', delay=20); pg.wait_for_timeout(400)
    n = pg.evaluate('window.__n')
    ok('E debounce (typing 7 chars -> <=2 repaints)', n <= 2, n)
    # E 긴 학과 이름이 잘리면 알려 줌
    load(pg, 'fake_long_dept.xlsx'); form(pg, 'attend'); typ(pg, '#at-dates', ', '.join(f'11.{d}' for d in range(1, 15)))
    ok('E clipped-cell notice (long 학과 in dense mode)', '잘린 칸' in pg.inner_text('#at-check'), pg.inner_text('#at-check'))
    ok('no page errors', not errors, errors)
    b.close()
print(json.dumps(R, ensure_ascii=False, indent=1))
print('PASS', sum(r['pass'] for r in R), '/', len(R))
