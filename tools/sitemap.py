#!/usr/bin/env python3
"""
Regenerates sitemap.xml, and moves a page's <lastmod> only when that page's
content actually moved.

Run it from the root of this repo, after you have edited a page:

    python3 tools/sitemap.py

Why it exists rather than a hand-edited file: every entry in the old sitemap
carried the same date, because the date was whatever the day of the deploy
was. A <lastmod> that advances on every deploy tells a crawler nothing, and a
crawler that learns the dates are noise stops reading them - which costs you
the one thing the field is for, which is getting a genuinely updated page
re-read quickly.

So this script does not look at the clock. For each page it takes a signature
of the page's **content** - the document with its <head> and its HTML comments
removed and whitespace flattened - and compares it against the signature
recorded last time in sitemap-state.json. Same signature, same date as before,
however many times you deploy. Different signature, today's date.

That means restyling the site, swapping an og:image or reindenting a file
leaves every date alone, which is correct: nothing a reader or a crawler cares
about changed. Editing the words, the links or the structured data moves that
one page's date, which is also correct.

A page seen for the first time is seeded from git - the date of the last commit
that touched its file - rather than from today, so adding this script did not
silently stamp the whole site with the day it was added. A page that is not in
git yet is seeded with today.

Adding a page: add it to PAGES in languages.py (with its translations, or
None where it has none) and run the script. Removing one: take it
out of PAGES and delete its entry from sitemap-state.json.

404.html is deliberately absent. It is not a destination and it is noindex.
"""

import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(ROOT, "sitemap.xml")
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sitemap-state.json")
BASE = "https://mydailies.app"

# (url path, file that renders it) - in the order they should appear: every
# English page, then every Spanish one, then every Portuguese one. The list
# itself lives in languages.py, which is the one record of which page is a
# translation of which; add a page there, not here.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import languages  # noqa: E402

PAGES = [(row[i], languages.file_for(row[i])[len(ROOT) + 1:])
         for i in range(len(languages.LANGS)) for row in languages.PAGES if row[i]]

# url -> its hreflang block, as (code, url) pairs, for pages that exist in
# more than one language. The same alternates languages.py writes into each
# page's <head>; Google reads either, and the sitemap is the copy Bing uses.
ALTERNATES = {}
for _row in languages.PAGES:
    _present = [(languages.LANGS[i][0], u) for i, u in enumerate(_row) if u]
    if len(_present) > 1:
        for _code, _u in _present:
            ALTERNATES[_u] = _present + [("x-default", _row[0])]


def signature(path):
    """A hash of what the page says, not of the file it says it in.

    <head> goes because it is metadata and styling - index.html keeps its
    entire stylesheet in there, and a color tweak is not a content change.
    Comments go for the same reason. Whitespace is flattened so reindenting a
    block does not read as an edit. Everything else counts, including the
    inline scripts and the JSON-LD, both of which are content a crawler sees.
    """
    s = open(os.path.join(ROOT, path), encoding="utf-8").read()
    s = re.sub(r"<head\b.*?</head>", "", s, flags=re.S | re.I)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"\s+", " ", s).strip()
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def git_date(path):
    try:
        out = subprocess.run(
            ["git", "-C", ROOT, "log", "-1", "--format=%cs", "--", path],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        return out or None
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def main():
    today = date.today().isoformat()
    state = {}
    if os.path.exists(STATE):
        state = json.load(open(STATE, encoding="utf-8"))

    rows, moved, held, added = [], [], [], []
    for url, path in PAGES:
        if not os.path.exists(os.path.join(ROOT, path)):
            sys.exit("missing: %s (listed in PAGES)" % path)
        sig = signature(path)
        prev = state.get(url)

        if prev is None:
            lastmod = git_date(path) or today
            added.append(url)
        elif prev["sig"] == sig:
            lastmod = prev["lastmod"]
            held.append(url)
        else:
            lastmod = today
            moved.append(url)

        state[url] = {"sig": sig, "lastmod": lastmod}
        rows.append((url, lastmod))

    for stale in set(state) - {u for u, _ in PAGES}:
        del state[stale]

    # The alternates go after <lastmod>, never between it and <loc>:
    # indexnow.py reads the pair with one regex that expects them adjacent.
    def alternates(url):
        return "".join(
            '    <xhtml:link rel="alternate" hreflang="%s" href="%s%s"/>\n' % (code, BASE, u)
            for code, u in ALTERNATES.get(url, [])
        )

    body = "".join(
        "  <url>\n    <loc>%s%s</loc>\n    <lastmod>%s</lastmod>\n%s  </url>\n" % (BASE, url, lastmod, alternates(url))
        for url, lastmod in rows
    )
    open(SITEMAP, "w", encoding="utf-8").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + body + "</urlset>\n"
    )
    json.dump(state, open(STATE, "w", encoding="utf-8"), indent=2, sort_keys=True)
    open(STATE, "a", encoding="utf-8").write("\n")

    print("sitemap.xml: %d urls" % len(rows))
    for label, urls in (("seeded from git", added), ("date moved to " + today, moved), ("date held", held)):
        if urls:
            print("  %-22s %s" % (label + ":", ", ".join(urls)))


if __name__ == "__main__":
    main()
