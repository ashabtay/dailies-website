#!/usr/bin/env python3
"""Two small buttons under every quote on the blog and the author pages.

    Make it a wallpaper     the wallpaper maker, opened on that quote
    Send it in an envelope  the envelope composer, opened on that quote

Run from the root of the repo, after editing a post (and after
tools/author_pages.py, which writes the author pages):

    python3 tools/blog_actions.py

It does two things, in every language:

  1. Writes lines/blog-<lang>.json: every quote on that language's blog posts
     and author pages that may go on a picture, by the first eight characters
     of its quote id, as [text, author], word for word from the app's
     assets/quotes.db. play.js fetches the file only when an address names
     one of its lines (#q=b-<id>, or an envelope link with q "b-<id>"), so
     the address can never put words on a picture that are not the app's.

  2. Writes the buttons after each quote's </blockquote> (after the photo
     card's </figure>, for the quote on a picture), replacing the ones it
     wrote last time. A quote gets no buttons when:
       - it is from the `modern` source: living authors' grants cover
         quotation, not pictures (the same rule as tools/play/lines.json);
       - it is longer than the maker or the envelope can hold (WALL_MAX and
         ENV_MAX characters), button by button.

A quote that is not in quotes.db stops the run: the blog's own rule is that
every quote is the database's, word for word.
"""
import glob
import html
import json
import os
import re
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "..", "dailies", "assets", "quotes.db")

# The site's languages, and each one's column suffix in quotes.db.
COL = {"en": "", "es": "Es", "pt": "Pt", "fr": "Fr", "de": "De", "ja": "Ja", "it": "It",
       "ko": "Ko", "zh-hant": "Hant", "nl": "Nl", "sv": "Sv", "ar": "Ar"}

WALL_MAX = 140   # the maker's own-words limit (wallpaper.js)
ENV_MAX = 200    # the envelope's (play.js, MAX_OWN)

LABELS = {
    "en": ("Make it a wallpaper", "Send it in an envelope"),
    "es": ("Hazla fondo de pantalla", "Envíala en un sobre"),
    "pt": ("Transformar em papel de parede", "Enviar em um envelope"),
    "fr": ("En faire un fond d’écran", "L’envoyer dans une enveloppe"),
    "de": ("Als Hintergrundbild", "Im Umschlag verschicken"),
    "ja": ("壁紙にする", "封筒で送る"),
    "it": ("Trasformala in uno sfondo", "Inviala in una busta"),
    "ko": ("배경화면으로 만들기", "봉투에 담아 보내기"),
    "zh-hant": ("做成背景圖片", "裝進信封送出"),
    "nl": ("Maak er een achtergrond van", "Verstuur hem in een envelop"),
    "sv": ("Gör den till bakgrundsbild", "Skicka den i ett kuvert"),
    "ar": ("تحويلها إلى خلفية", "إرسالها في ظرف"),
}

# Pages that carry quotes, besides the blog posts. tools/author_pages.py
# writes these; their paths are its AUTHORS' slugs, in every language.
AUTHOR_PAGES = os.path.join(ROOT, "tools", "authors", "pages.json")

QUOTE = re.compile(r"<blockquote><p>(.*?)</p>.*?</blockquote>(\s*</figure>)?", re.S)
OLD = re.compile(r"\n?<div class=\"qa[^\"]*\">.*?</div>", re.S)


def lang_of(path):
    first = path.split("/")[0]
    return first if first in COL and first != "en" else "en"


def pages():
    out = sorted(glob.glob("blog/*/index.html"))
    for l in COL:
        if l != "en":
            out += sorted(glob.glob(l + "/blog/*/index.html"))
    if os.path.exists(AUTHOR_PAGES):
        out += json.load(open(AUTHOR_PAGES, encoding="utf-8"))
    return out


def play_urls():
    s = open("play-lines.js", encoding="utf-8").read()
    d = json.loads(s[s.index("=") + 1:].strip().rstrip(";"))
    return d["wallUrl"], d["encUrl"]


def lookup(db):
    """{lang: {text: (quoteId, source, author)}}"""
    out = {}
    for l, s in COL.items():
        m = {}
        q = (f"select q.quoteId, q.text{s}, q.sourceDbId, coalesce(a.name{s}, a.name) "
             f"from quotes q left join authors a using(authorId) where q.text{s} is not null") if s else (
             "select q.quoteId, q.text, q.sourceDbId, a.name "
             "from quotes q left join authors a using(authorId) where q.text is not null")
        for qid, text, src, author in db.execute(q):
            m.setdefault(text, (qid, src, author or ""))
        out[l] = m
    return out


def row(l, sid, text, wall, enc, fig):
    a, b = LABELS[l]
    links = []
    if len(text) <= WALL_MAX:
        links.append('<a class="qa-wall" href="%s#q=b-%s">%s</a>' % (wall, sid, html.escape(a)))
    if len(text) <= ENV_MAX:
        links.append('<a class="qa-env" href="%s#q=b-%s">%s</a>' % (enc, sid, html.escape(b)))
    if not links:
        return ""
    return '\n<div class="qa%s">%s</div>' % (" qa-fig" if fig else "", "".join(links))


def main():
    os.chdir(ROOT)
    db = sqlite3.connect(DB)
    known = lookup(db)
    wall_url, enc_url = play_urls()
    lines = {l: {} for l in COL}
    missing, changed, buttons = [], 0, 0

    for path in pages():
        l = lang_of(path)
        src = open(path, encoding="utf-8").read()
        body = OLD.sub("", src)

        def put(m):
            nonlocal buttons
            text = html.unescape(m.group(1))
            hit = known[l].get(text)
            if not hit:
                missing.append((path, text))
                return m.group(0)
            qid, source, author = hit
            if source == "modern":
                return m.group(0)
            sid = qid.split("-")[0]
            seen = lines[l].get(sid)
            if seen and seen[0] != text:
                sys.exit("Two quotes share the short id %s in %s" % (sid, l))
            lines[l][sid] = [text, author]
            r = row(l, sid, text, wall_url[l], enc_url[l], bool(m.group(2)))
            buttons += bool(r)
            return m.group(0) + r

        out = QUOTE.sub(put, body)
        if out != src:
            open(path, "w", encoding="utf-8").write(out)
            changed += 1

    if missing:
        for path, text in missing:
            print("NOT IN quotes.db:", path, text[:80])
        sys.exit(1)

    os.makedirs("lines", exist_ok=True)
    for l, m in lines.items():
        with open("lines/blog-%s.json" % l, "w", encoding="utf-8") as f:
            json.dump(dict(sorted(m.items())), f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
    print("%d pages changed, %d quotes with buttons, %s" % (
        changed, buttons, ", ".join("%s %d" % (l, len(m)) for l, m in lines.items())))


if __name__ == "__main__":
    main()
