#!/usr/bin/env bash
# Serve the site locally, with caching disabled.
#
# Two reasons this is a script and not just `python3 -m http.server`:
#
#  1. The pages must be opened over http, not by double-clicking the file.
#     Every asset is referenced from the site root — /doc.css, /icon.png,
#     /consent.js — because that is what they resolve to once deployed at
#     mydailies.app. Under file:// there is no root, so /doc.css resolves to
#     file:///doc.css, which does not exist, and the page renders unstyled.
#
#  2. Plain http.server sends Last-Modified but no Cache-Control, so browsers
#     apply heuristic caching and happily serve an edit-old copy of a page or
#     of consent.js without revalidating. That looks exactly like "my change
#     did not save". The handler below sends no-store, so every reload is real.
#
# Usage:  ./serve.sh [port]        (default 8000)
set -euo pipefail
PORT="${1:-8000}"
cd "$(dirname "$0")"

# Free the port if a previous run is still holding it.
lsof -ti tcp:"$PORT" | xargs -r kill 2>/dev/null || true
sleep 0.3

echo "Dailies site  →  http://localhost:$PORT   (caching disabled)"
echo "  /           landing page"
echo "  /help       help centre"
echo "  /terms      terms of use"
echo "  /privacy    privacy policy"
echo "  /cookies    cookie policy"
echo
echo "Edit a file, reload the browser. Ctrl-C to stop."

command -v open >/dev/null && (sleep 1; open "http://localhost:$PORT/") &

exec python3 - "$PORT" <<'PY'
import sys, socket, http.server

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # One tidy line per request; the default prints the date on every line.
        sys.stderr.write("  %s\n" % (fmt % args))

# Threaded, like `python3 -m http.server` itself: a single-threaded server
# handles one connection at a time, and a browser that holds an idle keep-alive
# socket open then blocks every other request until it times out.
class Server(http.server.ThreadingHTTPServer):
    # Dual-stack, also matching the stdlib CLI, and what makes
    # http://localhost work. Binding IPv4 127.0.0.1 alone looks tighter but
    # breaks it: on macOS `localhost` resolves to the IPv6 ::1 first, so
    # requests hang before they ever reach an IPv4-only socket.
    address_family = socket.AF_INET6
    daemon_threads = True
    allow_reuse_address = True

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()

with Server(("", int(sys.argv[1])), NoCache) as httpd:
    httpd.serve_forever()
PY
