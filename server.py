from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
print('Tu Ruta Cádiz: http://127.0.0.1:9100')
ThreadingHTTPServer(('127.0.0.1',9100), SimpleHTTPRequestHandler).serve_forever()
