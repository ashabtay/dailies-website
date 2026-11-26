#!/usr/bin/env python3
"""
Keeps two pieces of JSON-LD in step with what the page itself says, so that
nobody has to copy them by hand.

Run it from the root of this repo after editing a Help page or a guide:

    python3 tools/structured_data.py           # rewrite what is out of step
    python3 tools/structured_data.py --check   # say what is, change nothing

1. The Help pages (all nine languages) get a FAQPage block built from their
   <details> entries: the <summary> is the question and the text of the
   <div class="details-body"> is the answer. The block is rebuilt every run,
   so adding, rewording or deleting an entry is just an edit to the HTML.
   Search engines and AI assistants read this block to tell which answer
   belongs to which question; the accordion alone does not say so.

2. The guides (every page with a HowTo block) get dateModified on their
   HowTo, taken from the date in the page's .doc-meta line ("Steps checked on
   iOS on 21 September 2026", "Pasos escritos el 8 de octubre de 2026",
   "手順の作成：2026年11月3日"...), in whichever of the nine languages the page
   is in. Move the visible date and the next run moves this one. They also
   get datePublished, the day git first saw the file, written once and then
   left alone.

No other JSON-LD is touched.
"""

import html
import json
import os
import re
import subprocess
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HELP_PAGES = [
    "help/index.html",
    "es/ayuda/index.html",
    "pt/ajuda/index.html",
    "fr/aide/index.html",
    "de/hilfe/index.html",
    "ja/help/index.html",
    "it/aiuto/index.html",
    "ko/help/index.html",
    "zh-hant/help/index.html",
]

MONTHS = {}
for names in (
    "january february march april may june july august september october november december",
    "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre",
    "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro",
    "janvier février mars avril mai juin juillet août septembre octobre novembre décembre",
    "januar februar märz april mai juni juli august september oktober november dezember",
    "gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre",
):
    for i, name in enumerate(names.split(), 1):
        MONTHS[name] = i

LD_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


# ---------------------------------------------------------------- help pages

class _Text(HTMLParser):
    """The visible text of an answer, one line per paragraph or list item.
    Ordered lists keep their numbers, unordered ones get a dash."""

    BLOCKS = {"p", "li", "div", "ol", "ul", "br"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lines, self.cur, self.lists = [], [], []

    def _flush(self):
        line = re.sub(r"\s+", " ", "".join(self.cur)).strip()
        if line:
            self.lines.append(line)
        self.cur = []

    def handle_starttag(self, tag, attrs):
        if tag in self.BLOCKS:
            self._flush()
        if tag in ("ol", "ul"):
            self.lists.append([tag, 0])
        elif tag == "li" and self.lists:
            kind = self.lists[-1]
            kind[1] += 1
            self.cur.append(f"{kind[1]}. " if kind[0] == "ol" else "- ")

    def handle_endtag(self, tag):
        if tag in self.BLOCKS:
            self._flush()
        if tag in ("ol", "ul") and self.lists:
            self.lists.pop()

    def handle_data(self, data):
        self.cur.append(data)

    def text(self):
        self._flush()
        return "\n".join(self.lines)


def plain(fragment):
    p = _Text()
    p.feed(fragment)
    return p.text()


def faq_block(page):
    items = []
    for m in re.finditer(
        r"<details(?:\s+open)?>\s*<summary>(.*?)</summary>\s*"
        r'<div class="details-body">(.*?)</div>\s*</details>',
        page,
        re.S,
    ):
        q = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", m.group(1)))).strip()
        a = plain(m.group(2))
        if q and a:
            items.append({"@type": "Question", "name": q,
                          "acceptedAnswer": {"@type": "Answer", "text": a}})
    if not items:
        return None
    # One question per line, the same shape as the guides' hand-written blocks.
    lines = ",\n".join(json.dumps(i, ensure_ascii=False) for i in items)
    return ('<script type="application/ld+json">\n'
            '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[\n'
            f"{lines}\n]}}\n</script>"), len(items)


def sync_help(path, page):
    built = faq_block(page)
    if not built:
        sys.exit(f"{path}: found no <details> entries; has the markup changed?")
    block, n = built
    for m in LD_RE.finditer(page):
        if '"@type":"FAQPage"' in m.group(1).replace(" ", ""):
            return page[: m.start()] + block + page[m.end():], n
    anchor = page.find('<script src="/analytics.js">')
    if anchor < 0:
        anchor = page.rfind("</body>")
    return page[:anchor] + block + "\n\n" + page[anchor:], n


# -------------------------------------------------------------------- guides

def visible_date(page):
    m = re.search(r'<p class="doc-meta">(.*?)</p>', page, re.S)
    if not m:
        return None
    t = html.unescape(re.sub(r"<[^>]+>", " ", m.group(1))).lower()
    j = re.search(r"(\d{4})\s*[年년]\s*(\d{1,2})\s*[月월]\s*(\d{1,2})\s*[日일]", t)
    if j:
        y, mo, d = map(int, j.groups())
        return f"{y:04d}-{mo:02d}-{d:02d}"
    for e in re.finditer(r"(\d{1,2})(?:er)?\.?\s+(?:de\s+)?([^\W\d_]+)\s+(?:de\s+)?(\d{4})", t):
        d, name, y = e.groups()
        if name in MONTHS:
            return f"{int(y):04d}-{MONTHS[name]:02d}-{int(d):02d}"
    return None


def first_commit(path):
    out = subprocess.run(
        ["git", "log", "--follow", "--diff-filter=A", "--format=%as", "--", path],
        cwd=ROOT, capture_output=True, text=True,
    ).stdout.split()
    return out[-1] if out else None


def set_field(obj_src, key, value, before):
    """Set "key":"value" inside one JSON-LD object's source text, keeping its
    hand formatting. Inserted just before the "before" key when absent."""
    pat = re.compile(rf'"{key}"\s*:\s*"[^"]*"')
    new = f'"{key}":"{value}"'
    if pat.search(obj_src):
        return pat.sub(new, obj_src, count=1)
    i = obj_src.find(f'"{before}"')
    return obj_src[:i] + new + "," + obj_src[i:]


def sync_guide(path, page):
    for m in LD_RE.finditer(page):
        src = m.group(1)
        if '"@type":"HowTo"' not in src.replace(" ", ""):
            continue
        modified = visible_date(page)
        if not modified:
            sys.exit(f"{path}: HowTo page with no readable date in .doc-meta")
        existing = re.search(r'"datePublished"\s*:\s*"([^"]+)"', src)
        published = existing.group(1) if existing else (first_commit(path) or modified)
        published = min(published, modified)
        before = "author" if '"author"' in src else "step"
        new = set_field(src, "datePublished", published, before)
        new = set_field(new, "dateModified", modified, before)
        return page[: m.start(1)] + new + page[m.end(1):], modified
    return None, None


# ---------------------------------------------------------------------- main

def guide_pages():
    for dirpath, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("tools", "img")]
        if "index.html" in files:
            rel = os.path.relpath(os.path.join(dirpath, "index.html"), ROOT)
            with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
                if '"@type":"HowTo"' in f.read():
                    yield rel


def main():
    check = "--check" in sys.argv[1:]
    stale = []
    jobs = [(p, sync_help) for p in HELP_PAGES] + [(p, sync_guide) for p in sorted(guide_pages())]
    for rel, fn in jobs:
        full = os.path.join(ROOT, rel)
        with open(full, encoding="utf-8") as f:
            page = f.read()
        new, _ = fn(rel, page)
        if new is None or new == page:
            continue
        for block in LD_RE.findall(new):
            json.loads(block)  # never write a page whose JSON-LD does not parse
        stale.append(rel)
        if not check:
            with open(full, "w", encoding="utf-8") as f:
                f.write(new)
    verb = "out of step" if check else "updated"
    for rel in stale:
        print(f"{verb}: {rel}")
    print(f"{len(stale)} page(s) {verb}, {len(jobs)} checked.")
    if check and stale:
        sys.exit(1)


if __name__ == "__main__":
    main()
