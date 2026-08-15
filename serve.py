from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os, socket
os.chdir(os.path.dirname(__file__))
port=8765
while True:
    try:
        server=ThreadingHTTPServer(("0.0.0.0",port),SimpleHTTPRequestHandler)
        break
    except OSError:
        port+=1
print(f"Tu Ruta Cádiz: http://localhost:{port}", flush=True)
server.serve_forever()
