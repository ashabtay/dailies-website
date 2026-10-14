#!/usr/bin/env python3
"""
Tells Bing (and through it ChatGPT search, Copilot, DuckDuckGo and Yahoo)
which pages changed, so they are re-crawled now instead of whenever the
crawler next comes round. Yandex, Naver and Seznam share the same feed.

It reads the change from sitemap.xml rather than from the HTML files, because
the sitemap already knows the answer: tools/sitemap.py only moves a page's
<lastmod> when that page's content moved. So a page is submitted when its
<lastmod> changed, when it first appeared, or when it was taken out (IndexNow
wants removals too, so the dead URL is dropped instead of re-crawled for weeks).

    python3 tools/indexnow.py --since <commit>   # pages changed since that commit
    python3 tools/indexnow.py --all              # every page in the sitemap
    python3 tools/indexnow.py --all --dry-run    # print, send nothing

The GitHub Action in .github/workflows/indexnow.yml runs --since on every push
to main, after GitHub Pages has published the push. Running it by hand is for
the first submission and for re-sending everything after a site-wide change.

The key is public by design: IndexNow proves you own the site by fetching
https://mydailies.app/<KEY>.txt and checking it holds the key. That file sits
in the repo root. Rename or delete it and every submission fails with 403.
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from os.path import abspath, dirname, join

ROOT = dirname(dirname(abspath(__file__)))
HOST = "mydailies.app"
KEY = "fdab89882c61113ed7ab401b375f4a2b"
ENDPOINT = "https://api.indexnow.org/indexnow"


def entries(xml):
    """{url: lastmod} from a sitemap's text."""
    return dict(re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", xml))


def sitemap_at(commit):
    out = subprocess.run(
        ["git", "-C", ROOT, "show", "%s:sitemap.xml" % commit],
        capture_output=True, text=True,
    )
    return out.stdout if out.returncode == 0 else ""


def changed(before, after):
    old, new = entries(before), entries(after)
    return sorted(u for u in set(old) | set(new) if old.get(u) != new.get(u))


def wait_until_live(sitemap, minutes=15):
    """GitHub Pages publishes a minute or two after the push. Submitting before
    that would send the crawler to the old page, so wait until the live
    sitemap matches the one being submitted."""
    deadline = time.time() + minutes * 60
    while True:
        url = "https://%s/sitemap.xml?nocache=%d" % (HOST, time.time())
        try:
            live = urllib.request.urlopen(url, timeout=20).read().decode("utf-8")
            if entries(live) == entries(sitemap):
                return
        except urllib.error.URLError as e:
            print("  sitemap fetch failed: %s" % e)
        if time.time() > deadline:
            sys.exit("the live sitemap never matched the committed one; nothing sent")
        time.sleep(20)


def submit(urls):
    body = json.dumps({
        "host": HOST,
        "key": KEY,
        "keyLocation": "https://%s/%s.txt" % (HOST, KEY),
        "urlList": urls,
    }).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT, data=body, method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        # 403: the key file is not live or does not match. 422: a URL is not on HOST.
        sys.exit("IndexNow refused the submission: HTTP %d %s" % (e.code, e.read().decode("utf-8", "replace")))


def main():
    ap = argparse.ArgumentParser()
    which = ap.add_mutually_exclusive_group(required=True)
    which.add_argument("--all", action="store_true", help="submit every page in sitemap.xml")
    which.add_argument("--since", metavar="COMMIT", help="submit pages whose <lastmod> changed since COMMIT")
    ap.add_argument("--dry-run", action="store_true", help="print the URLs, send nothing")
    ap.add_argument("--no-wait", action="store_true", help="skip waiting for the live sitemap to match")
    args = ap.parse_args()

    current = open(join(ROOT, "sitemap.xml"), encoding="utf-8").read()
    urls = sorted(entries(current)) if args.all else changed(sitemap_at(args.since), current)

    if not urls:
        print("no page changed; nothing to send")
        return
    print("%d url%s:" % (len(urls), "" if len(urls) == 1 else "s"))
    for u in urls:
        print("  " + u)
    if args.dry_run:
        return
    if not args.no_wait:
        wait_until_live(current)
    print("IndexNow: HTTP %d" % submit(urls))


if __name__ == "__main__":
    main()
