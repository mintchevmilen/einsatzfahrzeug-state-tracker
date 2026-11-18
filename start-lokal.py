#!/usr/bin/env python3
"""Startet die App lokal auf deinem Computer zum Ausprobieren (Testmodus, ohne Datenbank).
Beenden mit Strg+C. Braucht nur Python 3, sonst nichts."""
import http.server, os, socket, socketserver, sys, threading, webbrowser

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')  # immer die neueste Version laden
        super().end_headers()

    def log_message(self, *a):
        pass


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


socketserver.TCPServer.allow_reuse_address = True
try:
    httpd = socketserver.ThreadingTCPServer(('', PORT), Handler)
except OSError:
    print(f'Port {PORT} ist belegt. Starte mit einem anderen: python3 start-lokal.py 8081')
    sys.exit(1)

ip = lan_ip()
print('\nFahrzeug Check läuft im Testmodus (ohne Datenbank).\n')
print(f'  Auf diesem Computer:  http://localhost:{PORT}/?demo=1')
if ip:
    print(f'  Am Handy im selben WLAN:  http://{ip}:{PORT}/?demo=1')
print('\nBeenden mit Strg+C.\n')
threading.Timer(0.8, lambda: webbrowser.open(f'http://localhost:{PORT}/?demo=1')).start()
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print('\nBeendet.')
