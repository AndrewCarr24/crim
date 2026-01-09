import http.server
import socketserver
import mimetypes
import os

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Update MIME types map
        self.extensions_map.update({
            '.glb': 'model/gltf-binary',
            '.gltf': 'model/gltf+json',
            '.wasm': 'application/wasm',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
        })
        super().__init__(*args, **kwargs)

    def end_headers(self):
        # Enable CORS just in case
        self.send_header('Access-Control-Allow-Origin', '*')
        # Disable caching to ensure fresh reloads
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

print(f"Starting server at http://localhost:{PORT}")
print("Serving with correct MIME types for .glb, .wasm, etc.")

# Reuse address to prevent 'Address already in use' errors on quick restarts
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    httpd.serve_forever()
