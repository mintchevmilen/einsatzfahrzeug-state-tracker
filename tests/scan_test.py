"""Scanner Test mit gefälschter Kamera (Chrome liest ein Video mit QR Code als Kamerabild).
Aufruf: python3 tests/scan_test.py   Braucht playwright, Chrome, ffmpeg.
Prüft Erkennung und Navigation. Ersetzt keinen Test mit der echten Handykamera."""
import os, sys, subprocess, time, tempfile
from playwright.sync_api import sync_playwright, expect
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
PORT = 8767
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', REPO], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = f'http://localhost:{PORT}/'
FAKE = '00000000-0000-4000-8000-00000000abcd'
res = []
def ok(n, c, x=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (' ' + str(x) if x and not c else ''))
tmp = tempfile.mkdtemp()
try:
  with sync_playwright() as p:
    def make_video(text, name):
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 600, 'height': 600}); pg.goto(BASE + '?demo')
        svg = pg.evaluate("async (t) => { const m = await import('/vendor/qrcode.mjs'); const q = m.default(0,'M'); q.addData(t); q.make(); return q.createSvgTag({cellSize: 6, margin: 4, scalable: true}); }", text)
        pg.set_content(f'<body style="margin:0;background:#fff"><div style="width:560px;height:560px;margin:20px">{svg.replace("<svg", "<svg width=560 height=560", 1)}</div></body>')
        png = os.path.join(tmp, name + '.png'); pg.screenshot(path=png); b.close()
        y4m = os.path.join(tmp, name + '.y4m')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', png, '-t', '3', '-vf', 'scale=480:480,pad=640:480:80:0:white,format=yuv420p', '-r', '10', y4m], check=True)
        return y4m
    good = make_video(BASE + '#/v/' + FAKE + '/a/' + FAKE, 'good')
    bad = make_video('https://example.com/#/v/' + FAKE, 'bad')
    def run(video, expect_nav, nodet=False):
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', f'--use-file-for-fake-video-capture={video}'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, permissions=['camera'], service_workers='block')
        pg = ctx.new_page(); errs = []
        if nodet: pg.add_init_script('delete window.BarcodeDetector'); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '?demo'); pg.click('#t-admin'); pg.fill('#f-admin [name=email]', 'admin@demo.de'); pg.fill('#f-admin [name=password]', 'demo1234'); pg.click('#f-admin button[type=submit]')
        expect(pg.locator('h2')).to_have_text('Fahrzeuge')
        pg.click('#scan-btn'); expect(pg.locator('#scan-v')).to_be_visible()
        if expect_nav:
            pg.wait_for_function(f"location.hash.includes('{FAKE}')", timeout=15000)
            ok('Scanner erkennt QR und öffnet Ziel', f'/a/{FAKE}' in pg.url)
            ok('Scanner Fenster geschlossen', pg.locator('#scan-v').count() == 0)
        else:
            expect(pg.locator('#scan-msg')).to_contain_text('nicht zu dieser App', timeout=15000)
            ok('fremder QR wird abgelehnt', '#/v/' not in pg.url)
        ok('keine Seitenfehler', not errs, errs)
        b.close()
    run(good, True); run(bad, False); run(good, True, nodet=True); run(bad, False, nodet=True)  # zweiter Durchlauf ohne BarcodeDetector (wie iPhone Safari), nur mit jsQR
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox']); pg = b.new_page(); pg.goto(BASE + '?demo')
    ok('parseScan Regeln', pg.evaluate("(b) => [window.__fz.parseScan(b + '#/v/' + 'abcdef12-0000-0000-0000-000000000001'), window.__fz.parseScan(b + '#/settings'), window.__fz.parseScan('quatsch')]", BASE) == ['#/v/abcdef12-0000-0000-0000-000000000001', None, None])
    b.close()
finally:
    srv.terminate()
print(f'scan: {sum(res)} pass / {len(res) - sum(res)} fail'); sys.exit(0 if all(res) else 1)
