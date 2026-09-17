#!/usr/bin/env python3
"""Static file server with permissive CORS headers.

Plain `python3 -m http.server` sends no `Access-Control-Allow-Origin`, so the
NIMBUS player (served from one origin/port) cannot fetch an MPD or segments
hosted on a different origin/port — the browser blocks it as a CORS error.
This server adds `Access-Control-Allow-Origin: *` to every response and
answers OPTIONS preflight requests, so the player can load a stream from
any URL this server hosts.

Usage:
    python3 cors_server.py [PORT] [DIRECTORY]

Examples:
    python3 cors_server.py 11000 /home/ubuntu/gpcc_dataset/GPCC/octree-soldier
    python3 cors_server.py 10000 .
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Injected just before the header-terminating blank line, so every
        # response — files, directory listings, errors — carries CORS.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Expose-Headers',
                         'Content-Length, Content-Range, Accept-Ranges')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_OPTIONS(self):
        # CORS preflight — reply 204 with the headers from end_headers().
        self.send_response(204)
        self.end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    handler = partial(CORSRequestHandler, directory=directory)
    httpd = ThreadingHTTPServer(('0.0.0.0', port), handler)
    print(f'CORS static server: http://0.0.0.0:{port}  (serving {directory})')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()


if __name__ == '__main__':
    main()
