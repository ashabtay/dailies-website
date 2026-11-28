#!/usr/bin/env python3
"""The author pages: Rumi and Marcus Aurelius quotes, in every language.

Each is a quote collection on the blog (/blog/rumi-quotes/ and its
translations; Marcus Aurelius in every language but English, where the older
/blog/marcus-aurelius-quotes/ post is the page). Its sections are the app's
own topics, under their names in the app ("Let a little go", "When the worry
won't sit down"), and every line is word for word from the app's quotes.db.

Run from the root of the repo:

    python3 tools/author_pages.py
    python3 tools/blog_actions.py      # the buttons under each quote
    python3 tools/languages.py         # hreflang and the language menus
    python3 tools/sitemap.py

Inputs, in tools/authors/:
    authors.json      per author: its URL in each language (also in PAGES in
                      tools/languages.py, which must agree), the photograph,
                      the sections (an app topic and its quote ids, in order)
                      and the related posts for Keep reading
    copy-<lang>.json  every other word, per language (copy-en.json is the
                      source the others were translated from)

Each page is written from that language's "strength to keep going" post, so
the nav, the footer, the store badges and the scripts stay the blog's own:
this script replaces the head's text, the header, the photograph, the table
of contents, the article and the JSON-LD, and leaves the rest. It also puts
a card for each page on that language's blog hub (once) and writes
tools/authors/pages.json, the list tools/blog_actions.py reads.
"""
import html
import json
import os
import re
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import languages  # noqa: E402

DB = os.path.join(ROOT, "..", "dailies", "assets", "quotes.db")
BACKGROUNDS = os.path.join(ROOT, "..", "dailies", "assets", "backgrounds")
HERE = os.path.join(ROOT, "tools", "authors")
SITE = "https://mydailies.app"
LANGS = [l[0] for l in languages.LANGS]
COL = {"en": "", "es": "Es", "pt": "Pt", "fr": "Fr", "de": "De", "ja": "Ja", "it": "It",
       "ko": "Ko", "zh-hant": "Hant", "nl": "Nl", "sv": "Sv", "ar": "Ar"}
TEMPLATE = "/blog/quotes-about-strength-to-keep-going/"
# The hub card's icon, a line drawing like the other cards' (see the blog hub).
ICON = {
    "rumi": '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z"/><path d="M17 4.5v3M15.5 6h3"/>',
    "marcus-aurelius": '<path d="M4 8.5 12 4l8 4.5M5 8.5h14M7 8.5v10M12 8.5v10M17 8.5v10M4 20h16"/>',
}


def esc(s):
    return html.escape(s, quote=False)


def attr(s):
    return html.escape(s, quote=True)


def row_for(en_url):
    for row in languages.PAGES:
        if row[0] == en_url:
            return row
    sys.exit("not in languages.PAGES: " + en_url)


def url_in(en_url, lang):
    return row_for(en_url)[LANGS.index(lang)]


def read(url):
    return open(languages.file_for(url), encoding="utf-8").read()


def write(url, text):
    path = languages.file_for(url)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write(text)


def sub1(pattern, repl, text, flags=re.S):
    out, n = re.subn(pattern, lambda m: repl(m) if callable(repl) else repl, text, count=1, flags=flags)
    if n != 1:
        sys.exit("template changed, no match for: " + pattern)
    return out


def h1_of(url):
    m = re.search(r"<h1>(.*?)</h1>", read(url), re.S)
    return re.sub(r"<[^>]+>", "", m.group(1)).strip()


# ------------------------------------------------------------------ data

def quote(db, qid, lang):
    s = COL[lang]
    r = db.execute(
        f"select q.text{s}, coalesce(a.name{s}, a.name), q.source{s}, q.sourceDbId "
        f"from quotes q join authors a using(authorId) where q.quoteId=?", (qid,)).fetchone()
    if not r or not r[0]:
        sys.exit("no %s text for %s" % (lang, qid))
    if r[3] == "modern":
        sys.exit("a modern-source line cannot go on an author page: " + qid)
    return {"text": r[0], "author": r[1], "source": r[2]}


def topic_name(db, slug, lang):
    s = COL[lang]
    col = "displayName" + ({"zh-hant": "Hant"}.get(lang, s))
    r = db.execute(f"select {col} from topics where slug=?", (slug,)).fetchone()
    if not r:
        sys.exit("no topic " + slug)
    return r[0]


def fill_quotes(db, s, lang, ids):
    def one(m):
        short = m.group(1)
        full = [i for i in ids if i.startswith(short)]
        if not full:
            sys.exit("{q:%s} is not on the page" % short)
        return quote(db, full[0], lang)["text"]
    return re.sub(r"\{q:([0-9a-f]{8})\}", one, s)


# ---------------------------------------------------------------- images

def images(a):
    img = a["image"]
    if "reuse" in img:
        return img["reuse"]
    from PIL import Image
    name = img["name"]
    out = os.path.join(ROOT, "img", "blog")
    src = Image.open(os.path.join(BACKGROUNDS, img["from"])).convert("RGB")
    W, H = src.size

    def crop(ratio, y, size, file, q=84):
        h = round(W / ratio)
        top = max(0, min(H - h, round(H * y)))
        im = src.crop((0, top, W, top + h)).resize(size, Image.LANCZOS)
        im.save(os.path.join(out, file), "JPEG", quality=q, optimize=True, progressive=True)

    crop(1080 / 608, img["hero_y"], (1080, 608), name + ".jpg")
    crop(1080 / 608, img["hero_y"], (640, 360), name + "-thumb.jpg", 80)
    crop(1200 / 630, img["hero_y"], (1200, 630), name + "-og.jpg")
    crop(720 / 900, img["quote_y"], (720, 900), name + "-quote.jpg")
    return name


# ------------------------------------------------------------------ page

# How each language's posts write a byline: author and work.
CITE = {"ar": "%s، «%s»", "ja": "%s『%s』", "zh-hant": "%s《%s》", "ko": "%s, 『%s』"}


def blockquote(q, lang):
    if not q["source"]:
        cite = esc(q["author"])
    else:
        cite = CITE.get(lang, "%s, <em>%s</em>") % (esc(q["author"]), esc(q["source"]))
    return "<blockquote><p>%s</p><cite>%s</cite></blockquote>" % (esc(q["text"]), cite)


def page(db, key, a, lang, c, common, tpl, img):
    url = a["urls"][lang]
    full = SITE + url
    ids = [i for s in a["sections"] for i in s["ids"]]
    faq = [{"q": f["q"], "a": fill_quotes(db, f["a"], lang, ids)} for f in c["faq"]]

    # The labels the template already has in this language.
    toc_label = re.search(r'<div class="toc-label">(.*?)</div>', tpl).group(1)
    faq_h = re.search(r'<section id="faq">\s*<h2>(.*?)</h2>', tpl, re.S).group(1)
    faq_toc = re.search(r'<a href="#faq">(.*?)</a>', tpl).group(1)
    more_h = re.search(r'<section id="more">\s*<h2>(.*?)</h2>', tpl, re.S).group(1)

    t = tpl
    t = sub1(r"<title>.*?</title>", "<title>%s | Dailies</title>" % esc(c["title"]), t)
    t = sub1(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % attr(c["description"]), t)
    t = sub1(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="%s">' % full, t)
    t = sub1(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="%s">' % attr(c["ogTitle"]), t)
    t = sub1(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="%s">' % attr(c["ogDesc"]), t)
    t = sub1(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="%s">' % full, t)
    t = sub1(r'<meta property="og:image" content="[^"]*">', '<meta property="og:image" content="%s/img/blog/%s-og.jpg">' % (SITE, img), t)
    t = sub1(r'<meta property="og:image:alt" content="[^"]*">', '<meta property="og:image:alt" content="%s">' % attr(c["heroAlt"]), t)
    t = sub1(r"<h1>.*?</h1>", "<h1>%s</h1>" % esc(c["h1"]), t)
    t = sub1(r'(<header class="doc-head">.*?)<p class="lede">.*?</p>', lambda m: m.group(1) + '<p class="lede">%s</p>' % esc(c["lede"]), t)
    t = sub1(r'(<p class="doc-meta">.*?</span> )<span>.*?</span></p>', lambda m: m.group(1) + "<span>%s</span></p>" % esc(common["publishedOn"]), t)
    t = sub1(r'<figure class="post-hero"><img src="[^"]*" width="1080" height="608" alt="[^"]*"',
             '<figure class="post-hero"><img src="/img/blog/%s.jpg" width="1080" height="608" alt="%s"' % (img, attr(c["heroAlt"])), t)

    names = [(s["topic"], topic_name(db, s["topic"], lang)) for s in a["sections"]]
    toc = ['      <a href="#about">%s</a>' % esc(c["aboutH"])]
    toc += ['      <a href="#%s">%s</a>' % (slug, esc(n)) for slug, n in names]
    toc.append('      <a href="#faq">%s</a>' % faq_toc)
    t = sub1(r'(<div class="toc-label">.*?</div>\n).*?(    </aside>)',
             lambda m: m.group(1) + "\n".join(toc) + "\n" + m.group(2), t)

    body = ['', '      <section id="about">', '        <h2>%s</h2>' % esc(c["aboutH"])]
    body += ['        <p>%s</p>' % p for p in c["about"]]
    body += ['        <h3>%s</h3>' % esc(c["sourceH"]), '        <p>%s</p>' % (c["source"] if lang == "en" else c["sourceTranslated"])]
    body.append('      </section>')
    first = True
    for sec, (slug, name) in zip(a["sections"], names):
        body += ['', '      <section id="%s">' % slug, '        <h2>%s</h2>' % esc(name),
                 '        <p>%s</p>' % esc(c["sections"][slug])]
        for qid in sec["ids"]:
            bq = blockquote(quote(db, qid, lang), lang)
            if first:
                bq = '<figure class="qfig"><img src="/img/blog/%s-quote.jpg" width="720" height="900" alt="" loading="lazy">%s</figure>' % (img, bq)
                first = False
            body.append(bq)
        body.append('      </section>')
    body += ['', '      <section id="faq">', '        <h2>%s</h2>' % faq_h, '        <div class="faq">']
    for i, f in enumerate(faq):
        body += ['          <details%s><summary>%s</summary>' % (" open" if i == 0 else "", esc(f["q"])),
                 '            <div class="details-body">', '              <p>%s</p>' % f["a"], '            </div></details>', '']
    body += ['        </div>', '      </section>', '', '      <section id="more">', '        <h2>%s</h2>' % more_h, '        <ul>']
    for rel in a["related"]:
        u = url_in(rel, lang)
        if not u or u == url:
            continue
        other = [k for k, v in AUTHORS.items() if (v["urls"].get(lang) == u)]
        label = COPY[lang][other[0]]["h1"] if other and not os.path.exists(languages.file_for(u)) else h1_of(u)
        body.append('          <li><a href="%s">%s</a></li>' % (u, esc(label)))
    wall, enc = PLAY_URLS
    body.append('          <li><a href="%s">%s</a></li>' % (wall[lang], esc(common["wallMore"])))
    body.append('          <li><a href="%s">%s</a></li>' % (enc[lang], esc(common["encMore"])))
    body += ['        </ul>', '      </section>', '', '    ']
    t = sub1(r'(<div class="prose">\n).*?(</div>\n  </div>\n\n  <section class="strip">)',
             lambda m: m.group(1) + "\n".join(body) + m.group(2), t)

    # JSON-LD: the template's three blocks, rewritten for this page.
    blocks = re.findall(r'<script type="application/ld\+json">\n(.*?)\n</script>', t, re.S)
    post, crumbs = json.loads(blocks[0]), json.loads(blocks[2])
    for k in ("headline", "description", "url", "image", "keywords", "datePublished", "dateModified", "mainEntityOfPage"):
        post.pop(k, None)
    post.update({"headline": c["h1"], "description": c["description"], "mainEntityOfPage": {"@type": "WebPage", "@id": full},
                 "url": full, "image": "%s/img/blog/%s-og.jpg" % (SITE, img), "keywords": c["keywords"],
                 "datePublished": a["published"], "dateModified": a["published"],
                 "about": dict({"@type": "Person"}, **a["person"])})
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", f["a"])}} for f in faq]}
    crumbs["itemListElement"][-1].update({"name": c["h1"], "item": full})
    new = [json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in (post, faq_ld, crumbs)]
    it = iter(new)
    t = re.sub(r'(<script type="application/ld\+json">\n).*?(\n</script>)', lambda m: m.group(1) + next(it) + m.group(2), t, flags=re.S)
    return t


# ------------------------------------------------------------------- hub

def hub_card(key, a, lang, c, img):
    hub = url_in("/blog/", lang)
    t = read(hub)
    url = a["urls"][lang]
    if not url or ('href="%s"' % url) in t:
        return False
    tpl_url = url_in(TEMPLATE, lang)
    m = re.search(r'( *)<a class="post-card" href="%s">.*?</a>\n' % re.escape(tpl_url), t, re.S)
    if not m:
        sys.exit("no template card on " + hub)
    card = m.group(0)
    card = card.replace('href="%s"' % tpl_url, 'href="%s"' % url)
    card = re.sub(r'src="/img/blog/[^"]*-thumb\.jpg"', 'src="/img/blog/%s-thumb.jpg"' % img, card)
    card = re.sub(r'(<svg class="ico"[^>]*>).*?(</svg>)', lambda x: x.group(1) + ICON[key] + x.group(2), card, flags=re.S)
    card = re.sub(r"<h3>.*?</h3>", "<h3>%s</h3>" % esc(c["cardTitle"]), card, flags=re.S)
    card = re.sub(r"<p>.*?</p>", "<p>%s</p>" % esc(c["cardText"]), card, flags=re.S)
    t = t[:m.start()] + card + t[m.start():]
    entry = json.dumps({"@type": "BlogPosting", "headline": c["h1"], "url": SITE + url, "datePublished": a["published"]},
                       ensure_ascii=False, separators=(",", ":"))
    t = sub1(r'("blogPost":\[)', lambda x: x.group(1) + entry + ",", t)
    write(hub, t)
    return True


# ------------------------------------------------------------------ main

AUTHORS = json.load(open(os.path.join(HERE, "authors.json"), encoding="utf-8"))
COPY = {}
for _l in LANGS:
    _p = os.path.join(HERE, "copy-%s.json" % _l)
    if os.path.exists(_p):
        COPY[_l] = json.load(open(_p, encoding="utf-8"))
_s = open(os.path.join(ROOT, "play-lines.js"), encoding="utf-8").read()
_d = json.loads(_s[_s.index("=") + 1:].strip().rstrip(";"))
PLAY_URLS = (_d["wallUrl"], _d["encUrl"])


def main():
    os.chdir(ROOT)
    db = sqlite3.connect(DB)
    written, cards = [], 0
    for key, a in AUTHORS.items():
        img = images(a)
        if url_in(a.get("english_page") or a["urls"]["en"], "en") is None:
            sys.exit("languages.PAGES has no row for " + key)
        for lang in LANGS:
            url = a["urls"].get(lang)
            if not url:
                continue
            if row_for(a.get("english_page") or a["urls"]["en"])[LANGS.index(lang)] != url:
                sys.exit("authors.json and languages.PAGES disagree on %s %s" % (key, lang))
            if lang not in COPY:
                print("no copy-%s.json yet, skipped %s" % (lang, url))
                continue
            c, common = COPY[lang][key], COPY[lang]
            tpl = read(url_in(TEMPLATE, lang))
            write(url, page(db, key, a, lang, c, common, tpl, img))
            written.append(languages.file_for(url)[len(ROOT) + 1:])
            cards += hub_card(key, a, lang, c, img)
    json.dump(sorted(written), open(os.path.join(HERE, "pages.json"), "w"), indent=1)
    print("%d pages, %d new hub cards" % (len(written), cards))


if __name__ == "__main__":
    main()
