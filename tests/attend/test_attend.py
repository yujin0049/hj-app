import sys, json, openpyxl
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
import os
OUT = os.environ.get('OUT', '/tmp/hj_attend_out/'); os.makedirs(OUT, exist_ok=True)
F = os.path.dirname(os.path.abspath(__file__)) + '/'
res = []
errors = []
def setup(page):
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    page.goto(BASE + '#/attend'); page.wait_for_selector('#at-file', state='attached')
def load(page, f):
    page.set_input_files('#at-file', F + f); page.wait_for_selector('.at-sheet', timeout=15000); page.wait_for_timeout(300)
def fill(page, title, when='2026. 10. 23.(금) 10:00~', dates='', place='남해캠퍼스 강의실', confirm=True):
    page.fill('#at-title', title); page.fill('#at-when', when)
    if page.is_visible('#at-dates'): page.fill('#at-dates', dates)
    page.fill('#at-place', place)
    if page.is_checked('#at-confirm') != confirm: page.click('#at-confirm')
    page.wait_for_timeout(200)
def form(page, fid):
    page.click(f'[data-form="{fid}"]'); page.wait_for_timeout(200)
def pdf(page, name):
    page.evaluate('window.print = function(){}'); page.click('#at-print-btn')
    page.pdf(path=OUT + name, prefer_css_page_size=True, print_background=True)
def xlsx(page, name):
    with page.expect_download() as d: page.click('#at-xlsx-btn')
    d.value.save_as(OUT + name); return OUT + name
def check_xlsx(path, n):
    ws = openpyxl.load_workbook(path).active
    hdr = next(r for r in range(1, 12) if str(ws.cell(r, 1).value or '').replace('\n', '').replace(' ', '') in ('연번', '번호', '순번'))
    data = [r for r in range(hdr + 1, ws.max_row + 1) if str(ws.cell(r, 1).value or '').strip().isdigit()]
    last = data[-1] if data else hdr
    return dict(file=path.split('/')[-1], header_row=hdr, data_rows=len(data), expected=n, ok=len(data) == n,
                orient=ws.page_setup.orientation, fitW=ws.page_setup.fitToWidth, titles=ws.print_title_rows, fitToPage=ws.sheet_properties.pageSetUpPr.fitToPage if ws.sheet_properties.pageSetUpPr else None, footer=ws.oddFooter.center.text,
                headers=[c.value for c in ws[hdr]][:8], last_row_border=ws.cell(last, 2).border.left.style, b_A=ws.cell(last, 1).border.left.style, merges_after=[str(m) for m in ws.merged_cells.ranges if m.min_row > last][:4], print_area=ws.print_area,
                names=[ws.cell(r, 1).value for r in data[:2]], sensitive_leak=any(v and ('010-' in str(v) or '@' in str(v) or '2000.01.01' in str(v)) for row in ws.iter_rows(values_only=True) for v in row))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w, h in ((390, 844), (1280, 900)):
        ctx = b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True, device_scale_factor=2 if w == 390 else 1)
        page = ctx.new_page(); setup(page)
        page.screenshot(path=OUT + f'{w}_0_empty.png', full_page=True)
        load(page, 'fake_roster_25.xlsx')
        chk = page.inner_text('#at-check'); info = page.inner_text('#at-info')
        res.append(dict(w=w, step='load xlsx', check=chk, info=info))
        form(page, 'attend'); fill(page, '항공정비 실무교육(테스트)', dates='10.21, 10.22, 10.23, 10.24, 10.27, 10.28, 10.29, 10.30')
        page.screenshot(path=OUT + f'{w}_1_attend.png', full_page=True)
        if w == 1280:
            pdf(page, 'attend_basic_25.pdf'); res.append(check_xlsx(xlsx(page, 'attend_basic_25.xlsx'), 27))
        form(page, 'sign'); page.click('[data-sort="name"]'); page.wait_for_timeout(200)
        page.screenshot(path=OUT + f'{w}_2_sign.png', full_page=True)
        if w == 1280:
            pdf(page, 'sign_basic_25.pdf'); res.append(check_xlsx(xlsx(page, 'sign_basic_25.xlsx'), 27))
            form(page, 'trip-sign'); pdf(page, 'trip_sign_25.pdf'); res.append(check_xlsx(xlsx(page, 'trip_sign_25.xlsx'), 27))
            form(page, 'event-sign'); res.append(check_xlsx(xlsx(page, 'event_sign_25.xlsx'), 27))
            form(page, 'noncredit'); page.click('[data-sort="input"]'); fill(page, '비교과 프로그램(테스트)', dates='')
            pdf(page, 'noncredit_25.pdf'); res.append(check_xlsx(xlsx(page, 'noncredit_25.xlsx'), 27))
        # OJNT 명단 (2행 제목 줄, 개인정보 칸)
        load(page, 'fake_ojnt_roster_20.xlsx')
        res.append(dict(w=w, step='load ojnt', check=page.inner_text('#at-check'), info=page.inner_text('#at-info')))
        form(page, 'ojnt-attend'); fill(page, 'OJNT 싱가포르 항공정비 어학연수(테스트)', dates='')
        page.screenshot(path=OUT + f'{w}_3_ojnt_attend.png', full_page=True)
        if w == 1280:
            pdf(page, 'ojnt_attend_20.pdf'); r = check_xlsx(xlsx(page, 'ojnt_attend_20.xlsx'), 20)
            ws = openpyxl.load_workbook(OUT + 'ojnt_attend_20.xlsx').active
            r['formulas'] = [ws.cell(r['header_row'] + 1, c).value for c in range(1, ws.max_column + 1) if str(ws.cell(r['header_row'] + 1, c).value).startswith('=')] + [(ws.cell(rr, 1).value, ws.cell(rr, 5).value, ws.cell(rr, 25).value) for rr in range(20, ws.max_row + 1) if ws.cell(rr, 1).value == '출석 인원' or rr == 24] + [ws['A1'].value, ws['B2'].value, ws['E4'].value]
            res.append(r)
            form(page, 'ojnt-dorm-sign'); fill(page, 'OJNT 기숙사 입사(테스트)', place='한울관')
            pdf(page, 'ojnt_dorm_sign_20.pdf'); res.append(check_xlsx(xlsx(page, 'ojnt_dorm_sign_20.xlsx'), 20))
            page.screenshot(path=OUT + f'{w}_4_ojnt_dorm_sign.png', full_page=True)
            for f in ('fake_roster_25.xls', 'fake_roster_25_cp949.csv', 'fake_roster_25_utf8.csv'):
                load(page, f); res.append(dict(step='load ' + f, check=page.inner_text('#at-check').split('\n')[0], info=page.inner_text('#at-info').replace('\n', ' | ')))
        page.goto(BASE + '#/home'); page.wait_for_timeout(300); page.goto(BASE + '#/attend'); page.wait_for_timeout(500)
        res.append(dict(w=w, step='leave-and-return clears roster', preview_empty=page.inner_html('#at-pv').strip() == '', print_disabled=page.is_disabled('#at-print-btn')))
        if w == 390:
            page.goto(BASE + '#/home'); page.wait_for_timeout(800); page.screenshot(path=OUT + '390_5_home_tile.png', full_page=True)
            page.goto(BASE + '#/more'); page.wait_for_timeout(500); page.screenshot(path=OUT + '390_6_more_menu.png', full_page=True)
        ctx.close()
    b.close()
print(json.dumps(res, ensure_ascii=False, indent=1)); print('ERRORS', errors)
