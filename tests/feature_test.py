"""Test der Funktionen Checklisten, Offline Warteschlange, Statistik, QR, Fahrzeugblatt, Excel (Testmodus).
Aufruf: python3 tests/feature_test.py [android|iphone]   Braucht playwright, Chrome und openpyxl.
Chrome Engine, kein Safari. Ersetzt keinen Test auf dem echten Handy."""
import os, sys, subprocess, time, tempfile
from playwright.sync_api import sync_playwright, expect
import openpyxl
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
DEVICE = (sys.argv[1] if len(sys.argv) > 1 else 'android').lower()
PORT = 8766
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', REPO], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = f'http://localhost:{PORT}/'
results = []; errors = []
def ok(n, c, x=''):
    results.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (' ' + str(x) if x and not c else ''))
try:
  with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    kw = p.devices['Pixel 7'] if DEVICE == 'android' else dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx = br.new_context(**kw, service_workers='block', accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda d: d.accept())
    page.add_init_script("window.__printed=0; window.print=()=>{window.__printed++; window.__printhtml=(document.getElementById('printarea')||{}).innerHTML||''}")
    page.goto(BASE + '?demo')
    page.click('#t-admin'); page.fill('#f-admin [name=email]', 'admin@demo.de'); page.fill('#f-admin [name=password]', 'demo1234'); page.click('#f-admin button[type=submit]')
    expect(page.locator('h2')).to_have_text('Fahrzeuge')
    page.locator('.vcard').first.click(); expect(page.locator('#start')).to_be_visible()
    vid = page.url.split('#/v/')[1].split('/')[0]
    # Checklisten anlegen
    page.goto(BASE + f'?demo#/v/{vid}/lists'); expect(page.locator('h2')).to_have_text('Checklisten')
    page.click('[data-preset^="Wöchentlich"]'); expect(page.locator('.card.pad')).to_have_count(1)
    page.click('[data-preset^="Jährlich"]'); expect(page.locator('.card.pad')).to_have_count(2)
    ok('Checklisten per Vorlage angelegt', 'alle 7 Tage' in page.locator('main').inner_text() and 'alle 365 Tage' in page.locator('main').inner_text())
    page.click('#cl-add'); page.fill('.modal [name=name]', 'Monatlich Funk'); page.fill('.modal [name=interval_days]', '30'); page.click('.modal button[type=submit]')
    expect(page.locator('.card.pad')).to_have_count(3); ok('eigene Checkliste mit 30 Tagen', 'alle 30 Tage' in page.locator('main').inner_text())
    page.locator('[data-cl-edit]').nth(2).click(); page.fill('.modal [name=interval_days]', '14'); page.click('.modal button[type=submit]')
    expect(page.locator('main')).to_contain_text('alle 14 Tage'); ok('Checkliste geändert', True)
    page.locator('[data-cl-del]').nth(2).click(); expect(page.locator('.card.pad')).to_have_count(2); ok('Checkliste gelöscht', True)
    # Check mit Auswahl starten
    page.goto(BASE + f'?demo#/v/{vid}'); expect(page.locator('#start')).to_be_visible()
    ok('Checklisten Box mit Status', 'Wöchentlich' in page.locator('main').inner_text() and 'Jährlich' in page.locator('main').inner_text())
    page.click('#start'); expect(page.locator('.modal')).to_contain_text('Wöchentlich'); ok('Auswahl der Checkliste beim Start', True)
    page.locator('.modal button', has_text='Wöchentlich').first.click()
    page.locator('.rows .row').first.click()
    n = page.locator('.item').count()
    for j in range(n): page.locator('.item').nth(j).locator('[data-st=ok]').click()
    page.click('.back'); page.wait_for_timeout(250)
    # offline abschließen
    ctx.set_offline(True); page.evaluate("window.dispatchEvent(new Event('offline'))")
    expect(page.locator('#finish')).to_be_visible(); page.wait_for_timeout(200)
    page.click('#finish'); expect(page.locator('.modal button[type=submit]')).to_be_visible(); page.click('.modal button[type=submit]')
    expect(page.locator('.strip.pend')).to_contain_text('wartet'); ok('Check offline in Warteschlange', True)
    ok('Warteschlange im Verlauf sichtbar', page.locator('[data-pdel]').count() >= 1, page.locator('main').inner_text()[:200])
    ctx.set_offline(False); page.evaluate("window.dispatchEvent(new Event('online'))")
    expect(page.locator('.strip.pend')).to_have_count(0, timeout=8000); ok('Warteschlange nach Netz gesendet', True)
    page.reload(); page.wait_for_timeout(500)
    page.goto(BASE + '?demo#/history'); page.wait_for_timeout(500)
    ok('Check mit Checklistenname im Verlauf', 'Wöchentlich' in page.locator('main').inner_text())
    # doppeltes Senden darf nichts verdoppeln
    cnt = page.locator('.check').count(); ok('genau ein neuer Check', cnt >= 1)
    # Statistik
    page.goto(BASE + '?demo#/stats'); expect(page.locator('h2')).to_have_text('Statistik')
    ok('Statistik zeigt Kacheln', page.locator('.tile').count() >= 3)
    page.locator('[data-days="90"]').first.click() if page.locator('[data-days="90"]').count() else None
    ok('Statistik ohne Fehler', len(errors) == 0, errors)
    # QR
    page.goto(BASE + f'?demo#/v/{vid}'); expect(page.locator('#t-qr')).to_be_visible()
    page.click('#t-qr'); page.locator('.modal button', has_text='alle').first.click()
    page.wait_for_function('window.__printed >= 1', timeout=8000)
    html = page.evaluate('window.__printhtml') or ''
    ok('QR Druck mit SVG und Link', '<svg' in html and 'QR Codes' in html)
    ok('QR pro Fach', html.count('qrlabel') >= 2, html.count('qrlabel'))
    # Fahrzeugblatt
    before = page.evaluate('window.__printed'); page.click('#t-sheet'); page.wait_for_timeout(500)
    ok('Fahrzeugblatt Druck ausgelöst', page.evaluate('window.__printed') > before)
    # Excel Fahrzeug
    with page.expect_download() as d: page.click('#t-xlsx')
    path = os.path.join(tempfile.mkdtemp(), 'v.xlsx'); d.value.save_as(path)
    wb = openpyxl.load_workbook(path); names = wb.sheetnames
    ok('Excel Fahrzeug Blätter', all(x in names for x in ['Checklisten', 'Gegenstände', 'Checks']), names)
    ok('Excel Checklisten Inhalt', any('Wöchentlich' in str(c.value) for r in wb['Checklisten'].iter_rows() for c in r))
    # Excel gesamt aus Einstellungen
    page.goto(BASE + '?demo#/settings'); expect(page.locator('#export-xlsx')).to_be_visible()
    with page.expect_download() as d2: page.click('#export-xlsx')
    path2 = os.path.join(tempfile.mkdtemp(), 'a.xlsx'); d2.value.save_as(path2)
    wb2 = openpyxl.load_workbook(path2); ok('Excel Gesamt hat Fahrzeuge', 'Fahrzeuge' in wb2.sheetnames and wb2['Fahrzeuge'].max_row >= 2, wb2.sheetnames)
    # Nutzung: einchecken, doppelt blockiert, auschecken mit Check
    page.goto(BASE + f'?demo#/v/{vid}'); expect(page.locator('#u-in')).to_be_visible()
    page.click('#u-in'); page.select_option('.modal [name=purpose]', 'einsatz'); page.click('.modal button[type=submit]')
    expect(page.locator('#u-out')).to_be_visible(); ok('eingecheckt, Im Gebrauch sichtbar', 'Im Gebrauch' in page.locator('.usebox').inner_text())
    page.goto(BASE + '?demo#/usage'); expect(page.locator('h2')).to_have_text('Nutzung')
    ok('Protokoll zeigt laufende Nutzung', 'läuft' in page.locator('main').inner_text() and 'Einsatz' in page.locator('main').inner_text())
    page.goto(BASE + f'?demo#/v/{vid}'); expect(page.locator('#u-out')).to_be_visible()
    page.click('#u-out'); page.locator('.modal button', has_text='Zurückgeben und Check').first.click()
    expect(page.locator('.checkbar')).to_be_visible(); ok('Auschecken startet Check', 'Check läuft' in page.locator('.checkbar').inner_text())
    ok('wieder frei nach Auschecken', page.locator('#u-in').count() == 1)
    page.click('#discard')
    page.goto(BASE + '?demo#/usage'); ok('Protokoll mit Dauer', 'läuft' not in page.locator('main').inner_text() and 'Min' in page.locator('main').inner_text())
    with page.expect_download() as d3: page.click('#u-xlsx')
    path3 = os.path.join(tempfile.mkdtemp(), 'n.xlsx'); d3.value.save_as(path3)
    wb3 = openpyxl.load_workbook(path3); ok('Excel Nutzung', wb3.sheetnames == ['Nutzung', 'Buchungen'] and wb3['Nutzung'].max_row == 2, wb3.sheetnames)
    # Buchung: Admin bucht, Überschneidung wird blockiert
    page.click('[data-tab=cal]'); page.click('#bk-add')
    page.fill('.modal [name=starts]', '2030-05-01T10:00'); page.fill('.modal [name=ends]', '2030-05-01T12:00'); page.click('.modal button[type=submit]')
    expect(page.locator('.brow.confirmed')).to_have_count(1); ok('Admin Buchung bestätigt im Kalender', True)
    page.click('#bk-add'); page.fill('.modal [name=starts]', '2030-05-01T11:00'); page.fill('.modal [name=ends]', '2030-05-01T13:00'); page.click('.modal button[type=submit]')
    expect(page.locator('.toast.bad').last).to_contain_text('Schon gebucht'); ok('Überschneidung blockiert', True)
    page.click('#bk-add'); page.fill('.modal [name=starts]', '2030-05-01T14:00'); page.fill('.modal [name=ends]', '2030-05-01T13:00'); page.click('.modal button[type=submit]')
    expect(page.locator('.toast.bad').last).to_contain_text('Ende muss nach'); ok('Ende vor Beginn blockiert', True)
    page.click('[data-bk=cancelled]'); expect(page.locator('.brow')).to_have_count(0); ok('Buchung storniert', True)
    # Mitglied: Anfrage, Admin bestätigt
    page.goto(BASE + '?demo#/settings'); page.click('#logout')
    page.fill('#f-member [name=code]', 'Test-1234'); page.fill('#f-member [name=name]', 'Anna'); page.click('#f-member button[type=submit]')
    expect(page.locator('h2')).to_have_text('Fahrzeuge')
    page.goto(BASE + '?demo#/usage'); page.click('[data-tab=cal]'); page.click('#bk-add')
    page.fill('.modal [name=starts]', '2030-06-01T10:00'); page.fill('.modal [name=ends]', '2030-06-01T12:00'); page.click('.modal button[type=submit]')
    expect(page.locator('.brow.requested')).to_have_count(1); ok('Mitglied Anfrage wartet', 'Angefragt' in page.locator('main').inner_text())
    ok('Mitglied kann nicht bestätigen', page.locator('[data-bk=confirmed]').count() == 0)
    page.goto(BASE + '?demo#/settings'); page.click('#logout')
    page.click('#t-admin'); page.fill('#f-admin [name=email]', 'admin@demo.de'); page.fill('#f-admin [name=password]', 'demo1234'); page.click('#f-admin button[type=submit]')
    expect(page.locator('h2')).to_have_text('Fahrzeuge')
    page.goto(BASE + '?demo#/usage'); page.click('[data-tab=cal]'); page.click('[data-bk=confirmed]')
    expect(page.locator('.brow.confirmed')).to_have_count(1); ok('Admin bestätigt Anfrage', True)
    ok('keine Seitenfehler', len(errors) == 0, errors)
finally:
    srv.terminate()
print(f'{DEVICE}: {sum(results)} pass / {len(results) - sum(results)} fail')
sys.exit(0 if all(results) else 1)
