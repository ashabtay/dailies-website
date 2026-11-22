#!/usr/bin/env python3
"""
Builds the wallpaper pages and the words-of-encouragement pages, in all six
languages, and everything they need:

    /motivational-wallpapers/        and its five translations (see play_copy.WALL)
    /words-of-encouragement/         and its five translations (play_copy.ENC)
    /play-lines.js                   the lines, by id, for the browser
    /img/wallpapers/<lang>/*.jpg     the ready-made wallpapers in each gallery
    /img/wallpapers/og-*.jpg         the share images

Run it from the root of the repo after changing a line, a word of copy or the
layout, then run tools/languages.py (it writes each page's hreflang block and
language menu) and tools/sitemap.py:

    python3 tools/play_pages.py
    python3 tools/languages.py
    python3 tools/sitemap.py

The pages are ordinary static HTML once written: everything a search engine
reads (the headings, every line as text, the steps, the questions) is in the
file, and the maker and the envelope composer are scripts on top of it.

Inputs, all in this repo:
    tools/play/lines.json        the lines, word for word from the app's
                                 assets/quotes.db, with their quote ids
    tools/play/backgrounds.json  the app's backgrounds used here, their names in
                                 each language (the app's own), and credits
    tools/play_copy.py           every other word

The wallpaper is drawn here (Pillow) and in wallpaper.js (a canvas) to one
layout, LAYOUT below; keep the two in step.
"""

import html
import json
import os
import re
import sys
import unicodedata

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import play_copy as C  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://mydailies.app"
LINES = json.load(open(os.path.join(ROOT, "tools/play/lines.json")))
BGS = json.load(open(os.path.join(ROOT, "tools/play/backgrounds.json")))
STORE = "https://apps.apple.com/us/app/dailies-motivational-quotes/id6804210416?pt=129347926&amp;ct={ct}&amp;mt=8"
BADGE = {
    "en": ("/img/app-store-badge.svg", 156, "Download on the App Store"),
    "es": ("/img/app-store-badge-es.svg", 156, "Descárgalo en el App Store"),
    "pt": ("/img/app-store-badge-pt.svg", 156, "Baixar na App Store"),
    "fr": ("/img/app-store-badge-fr.svg", 164, "Télécharger dans l’App Store"),
    "de": ("/img/app-store-badge-de.svg", 156, "Laden im App Store"),
    "ja": ("/img/app-store-badge-ja.svg", 142, "App Store からダウンロード"),
}
HTML_LANG = {"en": "en", "es": "es-MX", "pt": "pt-BR", "fr": "fr-FR", "de": "de-DE", "ja": "ja"}
HUB = {"en": "guides", "es": "es/guias", "pt": "pt/guias", "fr": "fr/guides", "de": "de/anleitungen", "ja": "ja/guides"}

FONT_LATIN = os.path.join(ROOT, "tools/play/Lora-Regular.ttf")
FONT_JA = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"

# ------------------------------------------------------------------ layout
# The one layout both renderers follow. A 1080 x 2340 picture (the 9:19.5 of
# a current phone; the app's 1080 x 1920 backgrounds are scaled to cover it).
# The words are centered on 58% of the height and never start above 40%, so
# they stay under the clock and the row where Lock Screen widgets sit.

W, H = 1080, 2340
LAYOUT = {
    "center": 0.58, "top_min": 0.40, "max_w": 864, "line_h": 1.32,
    "author_scale": 0.52, "author_gap": 0.62, "mark_y": 0.885, "mark_size": 30,
}


def text_size(text, ja):
    n = len(text)
    if ja:
        return 84 if n <= 14 else 74 if n <= 24 else 66 if n <= 34 else 58
    return 96 if n <= 28 else 84 if n <= 44 else 74 if n <= 62 else 64


NO_START = set("、。，．・：；？！」』）】〉》ー…")
NO_END = set("「『（【〈《")


def wrap(text, font, max_w, ja):
    measure = lambda s: font.getlength(s)
    lines = []
    if ja:
        # Japanese has no spaces: pack whole phrases (split after 、 and 。)
        # and only break inside one that is wider than a line by itself.
        phrases = re.findall(r"[^、。]+[、。]?", text)
        cur = ""
        for ph in phrases:
            if not cur or measure(cur + ph) <= max_w:
                cur += ph
                continue
            lines.append(cur)
            cur = ph
        if cur:
            lines.append(cur)
        out = []
        for ln in lines:
            cur = ""
            for ch in ln:
                if cur and measure(cur + ch) > max_w and ch not in NO_START and cur[-1] not in NO_END:
                    out.append(cur)
                    cur = ch
                else:
                    cur += ch
            if cur:
                out.append(cur)
        return out
    cur = ""
    for word in text.split(" "):
        test = (cur + " " + word).strip()
        if cur and measure(test) > max_w:
            lines.append(cur)
            cur = word
        else:
            cur = test
    if cur:
        lines.append(cur)
    return lines


def font_for(ja, size):
    return ImageFont.truetype(FONT_JA if ja else FONT_LATIN, size)


def render(text, author, bg_file, lang):
    ja = lang == "ja"
    bg = Image.open(os.path.join(ROOT, "img/wallpapers/bg", bg_file)).convert("RGB")
    s = H / bg.height
    bw = round(bg.width * s)
    bg = bg.resize((bw, H), Image.LANCZOS).crop(((bw - W) // 2, 0, (bw - W) // 2 + W, H))

    # The scrim: a light veil over everything, deeper behind the words.
    shade = Image.new("L", (1, H))
    stops = [(0, .16), (.30, .10), (.50, .34), (.80, .34), (1, .20)]
    for y in range(H):
        t = y / H
        for (a, va), (b, vb) in zip(stops, stops[1:]):
            if a <= t <= b:
                v = va + (vb - va) * (t - a) / (b - a)
                break
        shade.putpixel((0, y), int(v * 255))
    shade = shade.resize((W, H))
    bg = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), bg, shade)

    size = text_size(text, ja)
    font = font_for(ja, size)
    lines = wrap(text, font, LAYOUT["max_w"], ja)
    lh = size * LAYOUT["line_h"]
    asize = round(size * LAYOUT["author_scale"])
    afont = font_for(ja, asize)
    block = len(lines) * lh + ((size * LAYOUT["author_gap"] + asize * 1.3) if author else 0)
    top = max(H * LAYOUT["top_min"], H * LAYOUT["center"] - block / 2)

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ink = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds, di = ImageDraw.Draw(shadow), ImageDraw.Draw(ink)

    def put(y, s, f, fill):
        x = (W - f.getlength(s)) / 2
        ds.text((x, y + 3), s, font=f, fill=(0, 0, 0, 110))
        di.text((x, y), s, font=f, fill=fill)

    y = top
    for ln in lines:
        put(y + (lh - size) / 2, ln, font, (255, 255, 255, 255))
        y += lh
    if author:
        y += size * LAYOUT["author_gap"]
        put(y, author, afont, (255, 255, 255, 214))
    mfont = ImageFont.truetype(FONT_LATIN, LAYOUT["mark_size"])
    put(H * LAYOUT["mark_y"], "mydailies.app", mfont, (255, 255, 255, 150))

    shadow = shadow.filter(ImageFilter.GaussianBlur(9))
    out = bg.convert("RGBA")
    out.alpha_composite(shadow)
    out.alpha_composite(ink)
    return out.convert("RGB")


# ------------------------------------------------------------------- data

def short(qid):
    return qid.split("-")[0]


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    words = re.findall(r"[a-z0-9]+", s.lower())
    return "-".join(words[:8])


def esc(s):
    return html.escape(s, quote=True)


# Where each page's lines start in the background list, and how far apart
# neighbors sit. The first two are the original pages' and must not change:
# an envelope link names its background by position.
_BG_START = {"wallpapers": (3, 7), "encouragement": (1, 5), "inspirational": (9, 7), "positive": (12, 5),
             "friend": (6, 7), "love": (4, 3), "morning": (10, 5)}


def items(page):
    """A page's lines in page order, each with its group, its place in the
    group and its background."""
    start, step = _BG_START[page["key"]]
    out, i = [], 0
    for g in page["groups"]:
        for gi, it in enumerate(LINES[page["key"]][g]):
            out.append(dict(it, mood=g, occ=g, gi=gi, k=(i * step + start) % len(BGS)))
            i += 1
    return out


def page_by_key(key):
    return next(p for p in C.PAGES if p["key"] == key)


def author_of(it, lang):
    return (it["author"] or {}).get(lang) or ""


def write_lines_js():
    """play-lines.js: every line by its short id, for the maker, the composer
    and /e/, which looks a sealed line up by id rather than carrying its text
    in the link (so a link can only ever open to one of these lines). `sets`
    holds each page's groups, its address in each language, and what its
    "more" link is called on an opened envelope."""
    lines, sets = {}, {}
    for page in C.PAGES:
        groups = {g: [] for g in page["groups"]}
        for it in items(page):
            sid = short(it["id"])
            groups[it["mood"]].append([sid, it["k"]])
            entry = {"t": it["text"], "a": it["author"]}
            if it["mood"] == "named":
                entry["n"] = 1
            assert sid not in lines or lines[sid]["t"] == entry["t"], sid
            lines[sid] = entry
        sets[page["key"]] = {"kind": page["kind"], "groups": groups, "url": page["url"],
                             "more": {l: page["copy"][l].get("more", "") for l in C.LANGS}}
    data = {
        "bg": [b["file"] for b in BGS],
        "bgName": {l: [b["name"][l] for b in BGS] for l in C.LANGS},
        "lines": lines, "sets": sets,
        "wall": sets["wallpapers"]["groups"], "enc": sets["encouragement"]["groups"],
        "wallUrl": C.WALL, "encUrl": C.ENC,
    }
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(ROOT, "play-lines.js"), "w") as f:
        f.write("/* Written by tools/play_pages.py from tools/play/lines.json; do not edit by hand.\n"
                "   Every line here is word for word from the app's assets/quotes.db (see the README). */\n")
        f.write("window.DailiesLines=" + body + ";\n")


# ----------------------------------------------------------------- images

def gallery_file(it, lang):
    base = slugify(it["text"]["en"] if lang == "ja" else it["text"][lang])
    return "/img/wallpapers/%s/%s.jpg" % (lang, base)


def write_images():
    for lang in C.LANGS:
        os.makedirs(os.path.join(ROOT, "img/wallpapers", lang), exist_ok=True)
        for page in C.PAGES:
            if page["kind"] == "wall":
                for it in items(page):
                    if not gallery_pick(it, page):
                        continue
                    im = render(it["text"][lang], author_of(it, lang), BGS[it["k"]]["file"], lang)
                    im.resize((540, 1170), Image.LANCZOS).save(
                        ROOT + gallery_file(it, lang), "JPEG", quality=78, optimize=True, progressive=True)
                og_wall(page, lang)
            else:
                og_enc(page, lang)


def gallery_pick(it, page):
    """The first few lines of each group get a picture in the gallery."""
    return it["gi"] < page.get("gallery", 3)


def og_file(page, lang):
    name = {"wallpapers": "og-wallpapers", "encouragement": "og-encouragement"}.get(page["key"], "og-" + page["key"])
    return "/img/wallpapers/%s-%s.jpg" % (name, lang)


def rounded(im, r):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    out = Image.new("RGBA", im.size)
    out.paste(im, (0, 0), mask)
    return out


def og_wall(page, lang):
    ground = Image.new("RGB", (1200, 630), (25, 28, 29))
    its = items(page)
    n = len(LINES[page["key"]][page["groups"][0]])
    picks = [its[0], its[2 * n], its[n]]
    ph, pw = 560, round(560 * W / H)
    gap = 44
    x0 = (1200 - 3 * pw - 2 * gap) // 2
    for i, it in enumerate(picks):
        im = render(it["text"][lang], author_of(it, lang), BGS[it["k"]]["file"], lang).resize((pw, ph), Image.LANCZOS)
        ground.paste(rounded(im, 26), (x0 + i * (pw + gap), 35), rounded(im, 26))
    ground.save(ROOT + og_file(page, lang), "JPEG", quality=84, optimize=True)


def og_enc(page, lang):
    ja = lang == "ja"
    bg = Image.open(os.path.join(ROOT, "img/wallpapers/bg/sky-cloud-line.jpg")).convert("RGB")
    bg = bg.resize((1200, round(1200 * bg.height / bg.width))).crop((0, 520, 1200, 1150))
    bg = bg.filter(ImageFilter.GaussianBlur(6))
    bg = Image.blend(bg, Image.new("RGB", bg.size, (12, 14, 16)), 0.45)
    d = ImageDraw.Draw(bg)
    # The envelope, the same one /e/ draws.
    ex, ey, ew, eh = 90, 175, 420, 280
    d.rounded_rectangle((ex, ey, ex + ew, ey + eh), 18, fill=(243, 236, 220))
    d.polygon([(ex, ey + 8), (ex + ew // 2, ey + eh * 0.58), (ex + ew, ey + 8)], fill=(230, 220, 199))
    d.line([(ex + 4, ey + eh - 6), (ex + ew // 2, ey + eh * 0.5), (ex + ew - 4, ey + eh - 6)], fill=(214, 202, 178), width=3)
    cx, cy = ex + ew // 2, int(ey + eh * 0.56)
    d.ellipse((cx - 38, cy - 38, cx + 38, cy + 38), fill=(196, 92, 62))
    sf = ImageFont.truetype(FONT_LATIN, 44)
    d.text((cx - sf.getlength("D") / 2, cy - 30), "D", font=sf, fill=(250, 238, 222))
    title = page["copy"][lang]["og_title"]
    size = 58 if not ja else 54
    f = font_for(ja, size)
    lines = wrap(title, f, 560, ja)
    y = 315 - len(lines) * size * 1.25 / 2
    for ln in lines:
        d.text((580, y), ln, font=f, fill=(255, 255, 255))
        y += size * 1.25
    mf = ImageFont.truetype(FONT_LATIN, 26)
    d.text((580, y + 24), "mydailies.app", font=mf, fill=(220, 214, 200))
    bg.save(ROOT + og_file(page, lang), "JPEG", quality=84, optimize=True)


# ------------------------------------------------------------------ pages

def chrome(lang):
    """The nav and footer of this language's guides hub, so the new pages
    carry exactly what every other page does. languages.py rewrites the
    language menu afterwards."""
    src = open(os.path.join(ROOT, HUB[lang], "index.html")).read()
    nav = re.search(r'<nav class="nav">.*?\n</nav>', src, re.S).group(0)
    foot = re.search(r'<div class="wrap"><footer>.*?</footer></div>', src, re.S).group(0)
    return nav, foot


def badge(lang, ct, where):
    src, w, alt = BADGE[lang]
    token = ct if lang == "en" else ct + "-" + lang
    return ('<a class="store-badge" href="%s" data-download="%s"><img src="%s" width="%d" height="52" alt="%s"></a>'
            % (STORE.format(ct=token), where, src, w, esc(alt)))


def head(lang, title, desc, url, og_title, og_desc, og_img, og_alt, extra_fonts="", extra_css=""):
    return f"""<!DOCTYPE html>
<html lang="{HTML_LANG[lang]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="apple-itunes-app" content="app-id=6804210416">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{BASE}{url}">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(og_title)}">
<meta property="og:description" content="{esc(og_desc)}">
<meta property="og:url" content="{BASE}{url}">
<meta property="og:image" content="{BASE}{og_img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{esc(og_alt)}">
<meta property="og:site_name" content="Dailies">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#191c1d" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f3ecdc" media="(prefers-color-scheme: light)">
<link rel="icon" href="/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=Figtree:wght@300;400;500;600;700&family=Courier+Prime:wght@400{extra_fonts}&display=swap">
<link rel="stylesheet" href="/doc.css">
{extra_css}</head>
"""


def faq_html(items, links):
    out = []
    for q, a in items:
        out.append("          <details><summary>%s</summary>\n            <div class=\"details-body\"><p>%s</p></div></details>"
                   % (esc(q), fill_links(esc(a), links)))
    return "\n".join(out)


def faq_ld(items, links=None):
    def plain(a):
        for k, (_, text) in (links or {}).items():
            a = a.replace("{%s}" % k, text)
        return a
    return json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": plain(a)}}
        for q, a in items]}, ensure_ascii=False)


def fill_links(s, links):
    for k, (href, text) in links.items():
        s = s.replace("{%s}" % k, '<a href="%s">%s</a>' % (href, esc(text)))
    return s


def quote_html(text, author, lang, name_ph=None):
    t = esc(text)
    if name_ph is not None:
        t = t.replace("{name}", '<span class="en-name">%s</span>' % esc(name_ph))
    cite = '<cite>%s</cite>' % esc(author) if author else ""
    return '<blockquote><p>%s</p>%s</blockquote>' % (t, cite)


def strings_json(d):
    return '<script type="application/json" id="play-strings">%s</script>' % json.dumps(d, ensure_ascii=False).replace("</", "<\\/")


def related(page, lang):
    """Links to every other page in this language: how a visitor (and a
    crawler) finds the rest."""
    lis = "\n".join('        <li><a href="%s">%s</a></li>' % (p["url"][lang], esc(p["copy"][lang]["h1"]))
                    for p in C.PAGES if p is not page)
    return """    <nav class="wp-related" aria-label="%s">
      <h2>%s</h2>
      <ul>
%s
      </ul>
    </nav>""" % (esc(C.RELATED[lang]), esc(C.RELATED[lang]), lis)


def page_wall(page, lang):
    c = page["copy"][lang]
    url = page["url"][lang]
    nav, foot = chrome(lang)
    its = items(page)
    first = its[0]
    links = {"guide": (C.GUIDE[lang], c["guide_text"]), "other": (C.ENC[lang], c["other_text"])}
    h = head(lang, c["title"], c["desc"], url, c["og_title"], c["og_desc"],
             og_file(page, lang), c["og_alt"], "&family=Lora:wght@400")

    chips = "\n".join('            <button type="button" class="pl-chip" data-mood="%s" aria-pressed="%s">%s</button>'
                      % (m, "true" if i == 0 else "false", esc(c["moods"][m])) for i, m in enumerate(page["groups"]))
    chips += '\n            <button type="button" class="pl-chip pl-chip-own" data-mood="own" aria-pressed="false">%s</button>' % esc(c["own"])
    swatches = "\n".join('            <button type="button" class="wp-sw" data-k="%d" aria-pressed="%s" aria-label="%s"><img src="/img/wallpapers/bg/thumb/%s" width="48" height="85" alt="" loading="lazy"></button>'
                         % (i, "true" if i == first["k"] else "false", esc(b["name"][lang]), b["file"]) for i, b in enumerate(BGS))
    still_alt = c["alt"].format(mood=c["moods"][first["mood"]], text=first["text"][lang])

    gallery = []
    for mood in page["groups"]:
        mi = [it for it in its if it["mood"] == mood]
        figs, more = [], []
        for it in mi:
            sid = short(it["id"])
            a = author_of(it, lang)
            if gallery_pick(it, page):
                alt = c["alt"].format(mood=c["moods"][mood], text=it["text"][lang]) + ((" (%s)" % a) if a else "")
                figs.append(
                    '          <li><a class="wp-pick" href="#maker" data-q="%s" data-k="%d"><img src="%s" width="540" height="1170" alt="%s" loading="lazy"></a>\n'
                    '            %s</li>' % (sid, it["k"], gallery_file(it, lang), esc(alt), quote_html(it["text"][lang], a, lang)))
            else:
                more.append(
                    '          <li>%s<a class="wp-use" href="#maker" data-q="%s" data-k="%d">%s</a></li>'
                    % (quote_html(it["text"][lang], a, lang), sid, it["k"], esc(c["use"])))
        gallery.append(f"""      <section class="wp-mood" id="{mood}">
        <h3>{esc(c["mood_h3"][mood])}</h3>
        <ul class="wp-grid">
{chr(10).join(figs)}
        </ul>
        <ul class="wp-more">
{chr(10).join(more)}
        </ul>
      </section>""")

    iphone = "\n".join("          <li>%s</li>" % s for s in c["iphone"])
    android = "\n".join("          <li>%s</li>" % s for s in c["android"])
    images_ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": c["h1"], "url": BASE + url,
                 "inLanguage": HTML_LANG[lang], "description": c["desc"],
                 "isPartOf": {"@type": "WebSite", "name": "Dailies", "url": BASE + "/"},
                 "mainEntity": {"@type": "ItemList", "itemListElement": [
                     {"@type": "ListItem", "position": i + 1, "item": {
                         "@type": "ImageObject", "contentUrl": BASE + gallery_file(it, lang),
                         "caption": it["text"][lang], "width": 540, "height": 1170,
                         "creditText": "Dailies", "creator": {"@type": "Organization", "name": "Dailies"},
                         # Google's image metadata fields. The Terms (English only) say these
                         # pictures may be shared for personal, non-commercial use; this page
                         # is where anyone gets them, free.
                         "license": BASE + "/terms/#sharing", "acquireLicensePage": BASE + url,
                         "copyrightNotice": "© 2026 Dailies"}}
                     for i, it in enumerate([it for it in its if gallery_pick(it, page)])]}}

    body = f"""<body>

{nav}

<main>
  <section class="wp-hero">
    <div class="wrap">
      <header class="wp-head">
        <div class="eyebrow">{esc(c["eyebrow"])}</div>
        <h1>{esc(c["h1"])}</h1>
        <p class="lede">{esc(c["lede"])}</p>
      </header>
      <div class="wp-maker" id="maker" data-page="{page["key"]}" data-lang="{lang}" data-q="{short(first["id"])}" data-k="{first["k"]}">
        <div class="wp-phone">
          <img class="wp-still" src="{gallery_file(first, lang)}" width="540" height="1170" alt="{esc(still_alt)}" fetchpriority="high">
          <div class="wp-clock" aria-hidden="true"><span class="wp-date"></span><span class="wp-time">9:41</span></div>
        </div>
        <div class="wp-controls">
          <div class="pl-chips" role="group" aria-label="{esc(c["mood_label"])}">
{chips}
          </div>
          <textarea class="pl-own" rows="3" maxlength="140" aria-label="{esc(c["own_label"])}" placeholder="{esc(c["own_ph"])}" dir="auto" hidden></textarea>
          <div class="pl-linenav">
            <button type="button" class="pl-btn pl-step" data-step="-1" aria-label="{esc(c["prev"])}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg><span>{esc(c["prev_t"])}</span></button>
            <button type="button" class="pl-btn pl-step" data-step="1" aria-label="{esc(c["next"])}"><span>{esc(c["next_t"])}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg></button>
          </div>
          <div class="wp-bglabel">{esc(c["bg_label"])}</div>
          <div class="wp-swatches" role="group" aria-label="{esc(c["bg_label"])}">
{swatches}
          </div>
          <button type="button" class="pl-primary wp-save">{esc(c["save"])}</button>
          <p class="wp-note">{esc(c["note"])}</p>
        </div>
      </div>
    </div>
  </section>

  <div class="wrap wp-body">
    <section class="wp-gallery" id="gallery">
      <h2>{esc(c["gallery_h2"])}</h2>
      <p class="wp-intro">{esc(c["gallery_p"])}</p>
{chr(10).join(gallery)}
    </section>

    <section class="wp-how" id="how">
      <h2>{esc(c["how_h2"])}</h2>
      <div class="wp-steps">
        <div class="wp-step" id="steps-iphone">
          <h3>{esc(c["iphone_h3"])}</h3>
          <ol>
{iphone}
          </ol>
        </div>
        <div class="wp-step" id="steps-android">
          <h3>{esc(c["android_h3"])}</h3>
          <ol>
{android}
          </ol>
        </div>
      </div>
      <p>{fill_links(esc(c["how_more"]), links)}</p>
    </section>

    <section class="wp-faq" id="faq">
      <h2>{esc(c["faq_h2"])}</h2>
      <div class="faq">
{faq_html(c["faq"], links)}
      </div>
    </section>

    <p class="wp-cross">{fill_links(esc(c["cross"]), {"other": (C.ENC[lang], c["cross_text"])})}</p>

{related(page, lang)}
  </div>

  <section class="strip">
    <div class="wrap strip-in">
      <h2>{esc(c["strip_h2"])}</h2>
      <p class="lede">{esc(c["strip_p"])}</p>
      {badge(lang, "web-wallpaper", "page")}
    </div>
  </section>

  {foot}
</main>

{strings_json(dict(c["js"], badge=badge(lang, "web-wallpaper", "wallpaper-saved")))}
<script type="application/ld+json">
{json.dumps(images_ld, ensure_ascii=False)}
</script>
<script type="application/ld+json">
{faq_ld(c["faq"], links)}
</script>

<script src="/play-lines.js" defer></script>
<script src="/play.js" defer></script>
<script src="/wallpaper.js" defer></script>
<script src="/analytics.js"></script>
<script src="/consent.js"></script>
</body>
</html>
"""
    write_page(url, h + body)


def page_enc(page, lang):
    c = page["copy"][lang]
    url = page["url"][lang]
    nav, foot = chrome(lang)
    its = items(page)
    first = its[0]
    # The composer's envelope: the app's own (envelope-art.css/.js), with
    # the name written on it in Caveat, as on /sealed/.
    h = head(lang, c["title"], c["desc"], url, c["og_title"], c["og_desc"],
             og_file(page, lang), c["og_alt"], extra_fonts="&family=Caveat:wght@400",
             extra_css='<link rel="stylesheet" href="/envelope-art.css">\n')

    chips = "\n".join('            <button type="button" class="pl-chip" data-occ="%s" aria-pressed="%s">%s</button>'
                      % (o, "true" if i == 0 else "false", esc(c["occ"][o])) for i, o in enumerate(page["groups"]))
    chips += '\n            <button type="button" class="pl-chip pl-chip-own" data-occ="own" aria-pressed="false">%s</button>' % esc(c["own"])
    steps = "\n".join('          <li><span>%d</span>%s</li>' % (i + 1, esc(st)) for i, st in enumerate(c["steps"]))
    groups = []
    for occ in page["groups"]:
        lis = []
        for it in [x for x in its if x["occ"] == occ]:
            lis.append('          <li>%s<button type="button" class="en-send" data-q="%s" data-k="%d" hidden>%s</button></li>'
                       % (quote_html(it["text"][lang], author_of(it, lang), lang, c["name_ph"] if occ == "named" else None),
                          short(it["id"]), it["k"], esc(c["send"])))
        groups.append(f"""    <section class="en-group" id="{occ}">
      <h2>{esc(c["h2"][occ])}</h2>
      <p class="wp-intro">{esc(c["intro"][occ])}</p>
      <ul class="en-list">
{chr(10).join(lis)}
      </ul>
    </section>""")
    a0 = author_of(first, lang)
    page_ld = {"@context": "https://schema.org", "@type": "WebPage", "name": c["h1"], "url": BASE + url,
               "inLanguage": HTML_LANG[lang], "description": c["desc"],
               "isPartOf": {"@type": "WebSite", "name": "Dailies", "url": BASE + "/"}}

    body = f"""<body>

{nav}

<main>
  <section class="wp-hero en-hero">
    <div class="wrap">
      <header class="wp-head">
        <div class="eyebrow">{esc(c["eyebrow"])}</div>
        <h1>{esc(c["h1"])}</h1>
        <ol class="en-steps">
{steps}
        </ol>
      </header>
      <form class="en-composer ph-no-capture" id="composer" data-page="{page["key"]}" data-lang="{lang}" data-q="{short(first["id"])}" data-k="{first["k"]}" autocomplete="off">
        <div class="pl-chips" role="group" aria-label="{esc(c["occ_label"])}">
{chips}
        </div>
        <div class="en-stage">
          <figure class="pl-card en-card"><img src="/img/wallpapers/bg/{BGS[first["k"]]["file"]}" width="1080" height="1920" alt="" fetchpriority="high"><blockquote class="pl-card-q"><p dir="auto">{esc(first["text"][lang])}</p>{('<cite>%s</cite>' % esc(a0)) if a0 else ''}</blockquote></figure>
        </div>
        <p class="pl-hint" aria-live="polite"></p>
        <textarea class="pl-own" rows="3" maxlength="200" aria-label="{esc(c["own_label"])}" placeholder="{esc(c["own_ph"])}" dir="auto" hidden></textarea>
        <div class="pl-linenav">
          <button type="button" class="pl-btn pl-step" data-step="-1" aria-label="{esc(c["prev"])}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg><span>{esc(c["prev_t"])}</span></button>
          <button type="button" class="pl-btn pl-step" data-step="1" aria-label="{esc(c["next"])}"><span>{esc(c["next_t"])}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg></button>
        </div>
        <div class="en-fields">
          <label class="pl-field"><span>{esc(c["their"])}</span><input type="text" name="to" maxlength="40" autocapitalize="words" spellcheck="false" dir="auto"></label>
          <label class="pl-field"><span>{esc(c["yours"])}</span><input type="text" name="from" maxlength="40" autocapitalize="words" spellcheck="false" dir="auto"></label>
        </div>
      </form>
    </div>
  </section>

  <div class="wrap wp-body">
{chr(10).join(groups)}

    <section class="wp-faq" id="faq">
      <h2>{esc(c["faq_h2"])}</h2>
      <div class="faq">
{faq_html(c["faq"], {})}
      </div>
    </section>

    <p class="wp-cross">{fill_links(esc(c["cross"]), {"other": (C.WALL[lang], c["cross_text"])})}</p>

{related(page, lang)}
  </div>

  <section class="strip">
    <div class="wrap strip-in">
      <h2>{esc(c["strip_h2"])}</h2>
      <p class="lede">{esc(c["strip_p"])}</p>
      {badge(lang, "web-envelope", "page")}
    </div>
  </section>

  {foot}
</main>

{strings_json({"need": c["need"], "nameph": c["name_ph"], "ownEmpty": c["own_ph"]})}
<script type="application/ld+json">
{json.dumps(page_ld, ensure_ascii=False)}
</script>
<script type="application/ld+json">
{faq_ld(c["faq"])}
</script>

<script src="/play-lines.js" defer></script>
<script src="/play.js" defer></script>
<script src="/envelope-art.js" defer></script>
<script src="/encourage.js" defer></script>
<script src="/analytics.js"></script>
<script src="/consent.js"></script>
</body>
</html>
"""
    write_page(url, h + body)


def write_page(url, text):
    path = os.path.join(ROOT, url.strip("/"), "index.html")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # Keep what languages.py wrote last time (the hreflang block and the
    # language menu), so running this script alone leaves the page in step.
    if os.path.exists(path):
        old = open(path).read()
        m = re.search(r'(<link rel="canonical"[^>]*>\n)((?:<link rel="alternate"[^>]*>\n|<script>/\* Written by tools/languages\.py.*?</script>\n)+)', old, re.S)
        if m:
            text = text.replace(m.group(1), m.group(1) + m.group(2), 1)
    with open(path, "w") as f:
        f.write(text)


def thumbs():
    os.makedirs(os.path.join(ROOT, "img/wallpapers/bg/thumb"), exist_ok=True)
    for b in BGS:
        im = Image.open(os.path.join(ROOT, "img/wallpapers/bg", b["file"])).convert("RGB")
        im.resize((96, 170), Image.LANCZOS).save(os.path.join(ROOT, "img/wallpapers/bg/thumb", b["file"]),
                                                 "JPEG", quality=72, optimize=True)


def main():
    write_lines_js()
    if "--pages-only" not in sys.argv:
        thumbs()
        write_images()
    for page in C.PAGES:
        for lang in C.LANGS:
            (page_wall if page["kind"] == "wall" else page_enc)(page, lang)
    print("wrote", ", ".join(p["url"]["en"] for p in C.PAGES), "and their translations")


if __name__ == "__main__":
    main()
