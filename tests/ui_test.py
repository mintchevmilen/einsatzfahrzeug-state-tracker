"""Oberflächentest im Testmodus (ohne Supabase).
Aufruf:  python3 tests/ui_test.py [android|iphone]
Braucht: pip install playwright und einen Chrome/Chromium (Pfad in CHROME).
Android nutzt Pixel 7 Emulation (Chrome). iPhone nutzt nur eine iPhone Fenstergröße,
KEINE Safari/WebKit Engine. Ein Test auf einem echten iPhone ersetzt das nicht.
"""
import os, sys, json, subprocess, time
from playwright.sync_api import sync_playwright, expect

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PHOTO = os.path.join(HERE, 'photo.png')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
DEVICE = (sys.argv[1] if len(sys.argv) > 1 else 'android').lower()
PORT = 8765
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', REPO], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = f'http://localhost:{PORT}/'
errors = []; results = []
def ok(name, cond, extra=''):
    results.append((name, bool(cond), extra)); print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if extra and not cond else ''))

try:
  with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    if DEVICE == 'android':
        ctx = br.new_context(**p.devices['Pixel 7'], service_workers='block')
    else:
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' else None)
    page.on('dialog', lambda d: d.accept())
    page.goto(BASE + '?demo=empty')

    expect(page.locator('#f-member')).to_be_visible(); ok('login screen shown', True)
    ok('demo hint on login', 'Test-1234' in page.locator('.demohint').inner_text())
    ok('demo banner not shown before login', page.locator('.demo').count() == 0)
    page.fill('#f-member [name=code]', 'falsch'); page.fill('#f-member [name=name]', 'Anna'); page.click('#f-member button[type=submit]')
    expect(page.locator('.toast.bad')).to_contain_text('falsch'); ok('wrong code rejected', True)
    page.click('#t-admin'); page.fill('#f-admin [name=email]', 'admin@demo.de'); page.fill('#f-admin [name=password]', 'x'); page.click('#f-admin button[type=submit]')
    expect(page.locator('.toast.bad').last).to_be_visible(); ok('wrong admin pw rejected', True)
    page.fill('#f-admin [name=password]', 'demo1234'); page.click('#f-admin button[type=submit]')
    expect(page.locator('h2')).to_have_text('Fahrzeuge'); ok('admin logged in', True)
    ok('demo banner shown', page.locator('.demo').count() == 1)

    page.click('#add-v'); page.fill('.modal [name=name]', 'MTW 1'); page.fill('.modal [name=type]', 'Mannschaftstransporter'); page.fill('.modal [name=location]', 'Halle 2')
    page.fill('.modal [name=next_inspection]', '2026-12-01'); page.click('.modal button[type=submit]')
    expect(page.locator('h2')).to_have_text('MTW 1'); ok('vehicle created and opened', True)
    ok('edit mode on after create', page.locator('#edit-toggle').is_checked())

    with page.expect_file_chooser() as fc: page.click('#e-photo')
    fc.value.set_files(PHOTO)
    expect(page.locator('#pinbox img')).to_be_visible(); ok('vehicle photo shown', True)

    box = page.locator('#pinimg').bounding_box()
    page.mouse.click(box['x'] + box['width'] * 0.25, box['y'] + box['height'] * 0.40)
    page.fill('.modal [name=name]', 'Heck links'); page.click('.modal button[type=submit]')
    expect(page.locator('.pin')).to_have_count(1)
    left = page.locator('.pin').first.evaluate("e=>e.style.left+'|'+e.style.top")
    lx, ly = [float(v.replace('%', '')) for v in left.split('|')]
    ok('area pin position ~25/40', abs(lx - 25) < 1.5 and abs(ly - 40) < 1.5, left)
    page.click('#e-area'); page.fill('.modal [name=name]', 'Dachbox'); page.click('.modal button[type=submit]')
    expect(page.locator('.rows .row')).to_have_count(2); ok('second area without pin listed', True)

    page.locator('.pin').first.click(); page.click('.modal [data-action=open]')
    expect(page.locator('h2')).to_have_text('Heck links'); ok('area opened', True)
    with page.expect_file_chooser() as fc: page.click('#a-photo')
    fc.value.set_files(PHOTO); expect(page.locator('#pinbox img')).to_be_visible(); ok('area photo shown', True)
    box = page.locator('#pinimg').bounding_box()
    page.mouse.click(box['x'] + box['width'] * 0.7, box['y'] + box['height'] * 0.3)
    page.fill('.modal [name=name]', 'Verbandkasten'); page.fill('.modal [name=qty]', '2'); page.click('.modal button[type=submit]')
    page.mouse.click(box['x'] + box['width'] * 0.3, box['y'] + box['height'] * 0.8)
    page.fill('.modal [name=name]', 'Warndreieck'); page.click('.modal button[type=submit]')
    expect(page.locator('.pin')).to_have_count(2); expect(page.locator('.item')).to_have_count(2)
    ok('two items with pins', True)
    ok('qty shown', 'x 2' in page.locator('.item').first.inner_text())
    page.locator('.pin').nth(1).click(); page.click('.modal [data-action=move]')
    expect(page.locator('.banner')).to_be_visible()
    box = page.locator('#pinimg').bounding_box(); page.mouse.click(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5)
    expect(page.locator('.banner')).to_have_count(0)
    left = page.locator('.pin').nth(1).evaluate("e=>e.style.left"); ok('item moved to 50%', abs(float(left.replace('%', '')) - 50) < 1.5, left)
    page.screenshot(path=os.path.join(HERE, f'shot_{DEVICE}_area_edit.png'))

    page.click('#edit-toggle')
    page.click('.back'); ok('back to vehicle', 'MTW 1' in page.locator('h2').inner_text())
    page.screenshot(path=os.path.join(HERE, f'shot_{DEVICE}_vehicle.png'))
    page.click('#start')
    expect(page.locator('.checkbar')).to_be_visible(); ok('check started', True)
    page.locator('.rows .row').first.click()
    expect(page.locator('.stbtns').first).to_be_visible()
    page.locator('.item').nth(0).locator('[data-st=ok]').click()
    page.locator('.item').nth(1).locator('[data-st=missing]').click()
    ok('progress 2 of 2', '2 von 2' in page.locator('#pcount').inner_text(), page.locator('#pcount').inner_text())
    ok('pin colored', 'missing' in page.locator('.pin').nth(1).get_attribute('class'))
    page.locator('.item').nth(1).locator('[data-more]').click()
    page.fill('.modal [name=note]', 'Fach leer, Warndreieck fehlt')
    page.set_input_files('.modal [name=photo]', PHOTO); page.click('.modal button[type=submit]')
    expect(page.locator('.item').nth(1).locator('.rnote')).to_contain_text('(Foto)'); ok('note and photo saved in draft', True)
    page.screenshot(path=os.path.join(HERE, f'shot_{DEVICE}_check.png'))
    page.reload(); expect(page.locator('.stbtns').first).to_be_visible(); ok('draft survives reload', True)
    ok('status survives reload', 'on' in page.locator('.item').nth(0).locator('[data-st=ok]').get_attribute('class'))
    page.click('.back'); page.click('#finish'); page.fill('.modal [name=note]', 'Übung'); page.click('.modal button[type=submit]')
    expect(page.locator('h2')).to_have_text('Verlauf'); ok('check finished -> history', True)
    expect(page.locator('.check .badge.bad')).to_contain_text('1 Mängel'); ok('history shows 1 issue', True)
    page.click('[data-details]'); expect(page.locator('.rlist li')).to_have_count(2)
    ok('details sorted, missing first', 'Fehlt' in page.locator('.rlist li').first.inner_text())
    ok('details show photo', page.locator('.rthumb').count() == 1)
    page.click('nav.tabs a >> text=Einstellungen')
    expect(page.locator('#f-set [name=code]')).to_have_value('Test-1234')
    page.fill('#f-set [name=code]', 'abc'); page.click('#f-set button[type=submit]')
    expect(page.locator('.toast.bad').last).to_contain_text('mindestens 6'); ok('short code rejected', True)
    page.click('#logout'); expect(page.locator('#f-member')).to_be_visible(); ok('admin logout', True)

    page.fill('#f-member [name=code]', 'Test-1234'); page.fill('#f-member [name=name]', 'Anna'); page.click('#f-member button[type=submit]')
    expect(page.locator('h2')).to_have_text('Fahrzeuge'); ok('member logged in', True)
    ok('member has no add button', page.locator('#add-v').count() == 0)
    page.locator('.vcard').first.click()
    ok('member has no edit toggle', page.locator('#edit-toggle').count() == 0)
    ok('member has no edit panel', page.locator('.editpanel').count() == 0)
    page.click('#start'); page.locator('.rows .row').first.click()
    page.locator('.item').nth(0).locator('[data-st=ok]').click(); page.locator('.item').nth(1).locator('[data-st=defect]').click()
    page.click('.back'); page.click('#finish'); page.click('.modal button[type=submit]')
    expect(page.locator('h2')).to_have_text('Verlauf'); expect(page.locator('.check')).to_have_count(2)
    ok('member check saved with name', 'Anna' in page.locator('.check').first.inner_text())
    ok('member sees no delete button', page.locator('[data-del]').count() == 0)
    page.click('nav.tabs a >> text=Konto'); ok('member account has no settings form', page.locator('#f-set').count() == 0)
    page.reload(); expect(page.locator('.who')).to_have_text('Anna'); ok('member session persists', True)

    # Beispieldaten
    page.goto(BASE + '?demo=reset')
    page.fill('#f-member [name=code]', 'Test-1234'); page.fill('#f-member [name=name]', 'Ben'); page.click('#f-member button[type=submit]')
    expect(page.locator('.vcard')).to_have_count(1); ok('seed vehicle present', 'Beispiel' in page.locator('.vcard').inner_text())
    ok('seed vehicle photo loads', page.locator('.vcard img').count() == 1)
    page.locator('.vcard').click(); expect(page.locator('.pin')).to_have_count(2); ok('seed vehicle has 2 area pins', True)
    ok('seed due date shown', 'Prüfung' in page.locator('.due').inner_text())
    page.click('#start')
    for i in range(2):
        page.locator('.rows .row').nth(i).click()
        n = page.locator('.item').count()
        for j in range(n): page.locator('.item').nth(j).locator('[data-st=ok]').click()
        page.click('.back')
    page.click('#finish'); page.click('.modal button[type=submit]')
    expect(page.locator('.check .badge.ok')).to_contain_text('alles ok'); ok('seed full check -> alles ok', True)
    page.goto(BASE + '?demo=off')
    cfg_real = 'supabase.co' in open(os.path.join(REPO, 'config.js')).read()
    if cfg_real:
        ok('demo off with real config: no demo banner', page.locator('.demo').count() == 0)
    else:
        ok('demo off with no config shows setup hint', 'Noch nicht eingerichtet' in page.locator('body').inner_text())

    # Manifest und Icons (Android Installation)
    m = json.loads(subprocess.check_output(['curl', '-s', BASE + 'manifest.webmanifest']))
    ok('manifest standalone + start_url', m.get('display') == 'standalone' and m.get('start_url') == './')
    sizes = {(i['sizes'], i.get('purpose', 'any')) for i in m['icons']}
    ok('manifest has 192 and 512 any icons', ('192x192', 'any') in sizes and ('512x512', 'any') in sizes, sizes)
    ok('manifest has maskable icon', any('maskable' in i.get('purpose', '') for i in m['icons']))
    for i in m['icons']:
        r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', BASE + i['src']], capture_output=True, text=True).stdout
        ok('icon reachable ' + i['src'], r == '200', r)
    br.close()
finally:
    srv.terminate()

bad = [e for e in errors if 'favicon' not in e and 'Code ist falsch' not in e and 'Anmeldung falsch' not in e and 'mindestens 6' not in e and 'Failed to load resource' not in e]
ok('no console/page errors', not bad, bad[:3])
f = [r for r in results if not r[1]]
print(f'\n{DEVICE}: {len(results) - len(f)} pass / {len(f)} fail'); sys.exit(1 if f else 0)
