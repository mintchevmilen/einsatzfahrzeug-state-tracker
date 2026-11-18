"""Prüft den Diktier Knopf mit einer simulierten Spracherkennung (kein echtes Mikrofon)."""
import os, subprocess, time, sys
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
MOCK = """
window.webkitSpeechRecognition = undefined; window.SpeechRecognition = class { constructor(){ this.lang=''; }
  start(){ window.__lang=this.lang; setTimeout(()=>{ this.onstart&&this.onstart();
    this.onresult&&this.onresult({results:[[{transcript:'Warndreieck fehlt'}]]});
    setTimeout(()=>this.onend&&this.onend(),50); },50); }
  stop(){ this.onend&&this.onend(); } };
"""
res = []
def ok(n, c): res.append(c); print('PASS' if c else 'FAIL', n)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for label, mock in (('mit Diktat', True), ('ohne Diktat', False)):
            pg = b.new_page()
            pg.add_init_script(MOCK if mock else 'delete window.SpeechRecognition; delete window.webkitSpeechRecognition;')
            pg.goto('http://localhost:8766/?demo'); pg.wait_for_selector('#t-admin')
            pg.click('#t-admin'); pg.fill('#f-admin [name=email]', 'admin@demo.de'); pg.fill('#f-admin [name=password]', 'demo1234'); pg.click('#f-admin button[type=submit]')
            pg.wait_for_selector('#add-v'); pg.click('#add-v')
            n = pg.locator('.modal .mic').count()
            if mock:
                ok(label + ': Mikrofon Knöpfe vorhanden', n >= 2)
                pg.fill('.modal [name=name]', 'MTW'); pg.locator('.modal .mic').first.click(); time.sleep(.5)
                v = pg.input_value('.modal [name=name]')
                ok(label + ': Text übernommen (' + v + ')', v == 'MTW Warndreieck fehlt')
                ok(label + ': Sprache de-DE', pg.evaluate('window.__lang') == 'de-DE')
            else:
                ok(label + ': keine Knöpfe, Eingabe bleibt nutzbar', n == 0 and pg.locator('.modal [name=name]').count() == 1)
            pg.close()
        b.close()
finally:
    srv.terminate()
print('PASS ALL' if all(res) else 'FAILURES')
