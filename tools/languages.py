#!/usr/bin/env python3
"""
Keeps the site's three languages wired together: English at /, Mexican
Spanish at /es/ and Brazilian Portuguese at /pt/.

Run it from the root of this repo after adding or renaming a translated page:

    python3 tools/languages.py           # rewrite every page that is out of step
    python3 tools/languages.py --check   # say which are, change nothing

PAGES below is the one record of which page is a translation of which. From
it, the script writes three things into each page, so that none of them is
ever hand-maintained in thirty places:

  1. <html lang="...">: en, es-MX or pt-BR.
  2. The hreflang block in <head>, right after the canonical link: one
     <link rel="alternate"> per language the page exists in, plus x-default
     (the English). Only real translations get one. A Spanish page that merely
     links to the English Terms is not their alternate, and saying it was
     would tell Google to show the wrong page to Spanish searchers.
  3. The language menu in the nav, just before the Get Dailies pill: the
     <details class="lang"> block. Its button names the page's language in
     full ("Español", never "ES"), and it opens a list of all three, each
     going to this page in that language, or to that language's home page
     when there is no translation (the legal pages are English only; see the
     README). A one-line script after it closes the list on a click outside
     it or on Escape, which <details> does not do by itself. Phones show the
     globe and the chevron without the name.
  4. On English pages that have a translation, a few lines of inline script
     right after the hreflang block: a visitor arriving from outside the site
     whose browser asks for Spanish or Portuguese before English is sent on to
     this page in that language, the way the app follows the phone's language.
     Arriving from another page of the site never redirects, so choosing
     English in the menu sticks for the visit, and nothing is stored: the Cookie Policy
     says the consent answer is the only thing the site keeps. Crawlers
     report English, so they are never redirected and index every page.

The Spanish is es-MX and the Portuguese pt-BR because those are the app's own
(see lib/l10n/app_locale.dart in the dailies repo): every Spanish phone gets
es-MX and every Portuguese one pt-BR. The hreflang values are the bare
language, es and pt, for the same reason: the page is the one Spanish there
is, for Spain and Argentina as much as Mexico.

sitemap.py reads PAGES too, for the translated pages' sitemap entries and
their xhtml:link alternates.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://mydailies.app"

# (code, html lang, what it calls itself, its home page)
LANGS = [
    ("en", "en", "English", "/"),
    ("es", "es-MX", "Español", "/es/"),
    ("pt", "pt-BR", "Português", "/pt/"),
]

# What the language menu is called, for screen readers, in the page's own language.
MENU_LABEL = {"en": "Language", "es": "Idioma", "pt": "Idioma"}

# One row per page: its English, Spanish and Portuguese URL. None where the
# page has no translation. The order is the sitemap's order.
PAGES = [
    ("/", "/es/", "/pt/"),
    ("/help/", "/es/ayuda/", "/pt/ajuda/"),
    ("/guides/", "/es/guias/", "/pt/guias/"),
    ("/guides/quotes-on-your-iphone-lock-screen/",
     "/es/guias/frases-en-la-pantalla-de-bloqueo-del-iphone/",
     "/pt/guias/frases-na-tela-bloqueada-do-iphone/"),
    ("/guides/add-a-widget-to-your-home-screen/",
     "/es/guias/agregar-un-widget-a-la-pantalla-de-inicio/",
     "/pt/guias/adicionar-um-widget-na-tela-de-inicio/"),
    ("/guides/bible-verse-on-iphone-lock-screen/",
     "/es/guias/versiculo-biblico-en-la-pantalla-de-bloqueo-del-iphone/",
     "/pt/guias/versiculo-biblico-na-tela-bloqueada-do-iphone/"),
    ("/guides/focus-lock-screen-iphone/",
     "/es/guias/concentracion-pantalla-de-bloqueo-iphone/",
     "/pt/guias/foco-tela-bloqueada-iphone/"),
    ("/guides/iphone-widget-not-updating/",
     "/es/guias/widget-del-iphone-no-se-actualiza/",
     "/pt/guias/widget-do-iphone-nao-atualiza/"),
    ("/guides/iphone-notifications-not-working/",
     "/es/guias/no-me-llegan-las-notificaciones-del-iphone/",
     "/pt/guias/notificacoes-do-iphone-nao-chegam/"),
    ("/guides/customize-iphone-lock-screen/",
     "/es/guias/personalizar-la-pantalla-de-bloqueo-del-iphone/",
     "/pt/guias/personalizar-a-tela-bloqueada-do-iphone/"),
    ("/guides/quote-wallpaper-iphone/",
     "/es/guias/fondo-de-pantalla-con-frases-en-el-iphone/",
     "/pt/guias/papel-de-parede-com-frases-no-iphone/"),
    ("/guides/add-widgets-on-ipad/",
     "/es/guias/agregar-widgets-en-el-ipad/",
     "/pt/guias/adicionar-widgets-no-ipad/"),
    ("/blog/", "/es/blog/", "/pt/blog/"),
    ("/blog/how-to-motivate-yourself/",
     "/es/blog/como-motivarte/",
     "/pt/blog/como-se-motivar/"),
    ("/blog/motivation-vs-discipline/",
     "/es/blog/motivacion-vs-disciplina/",
     "/pt/blog/motivacao-vs-disciplina/"),
    ("/blog/how-to-stop-procrastinating/",
     "/es/blog/como-dejar-de-procrastinar/",
     "/pt/blog/como-parar-de-procrastinar/"),
    ("/blog/how-to-stay-motivated/",
     "/es/blog/como-mantener-la-motivacion/",
     "/pt/blog/como-manter-a-motivacao/"),
    ("/blog/quotes-for-when-you-feel-stuck/",
     "/es/blog/frases-para-cuando-no-avanzas/",
     "/pt/blog/frases-para-quando-nada-anda/"),
    ("/blog/motivational-quotes-for-hard-times/",
     "/es/blog/frases-motivadoras-para-tiempos-dificiles/",
     "/pt/blog/frases-motivacionais-para-tempos-dificeis/"),
    ("/blog/quotes-for-self-doubt/",
     "/es/blog/frases-para-cuando-dudas-de-ti/",
     "/pt/blog/frases-para-quando-voce-duvida-de-si/"),
    ("/blog/morning-motivation-quotes/",
     "/es/blog/frases-de-motivacion-para-la-manana/",
     "/pt/blog/frases-de-motivacao-para-a-manha/"),
    ("/blog/quotes-about-starting-over/",
     "/es/blog/frases-para-empezar-de-nuevo/",
     "/pt/blog/frases-para-recomecar/"),
    ("/blog/discipline-and-consistency-quotes/",
     "/es/blog/frases-de-disciplina-y-constancia/",
     "/pt/blog/frases-de-disciplina-e-constancia/"),
    ("/blog/quotes-for-anxiety-and-overthinking/",
     "/es/blog/frases-para-la-ansiedad-y-el-sobrepensamiento/",
     "/pt/blog/frases-para-ansiedade-e-pensar-demais/"),
    ("/blog/how-to-stop-overthinking/",
     "/es/blog/como-dejar-de-sobrepensar/",
     "/pt/blog/como-parar-de-pensar-demais/"),
    ("/blog/how-long-does-it-take-to-form-a-habit/",
     "/es/blog/cuanto-tiempo-se-tarda-en-formar-un-habito/",
     "/pt/blog/quanto-tempo-leva-para-criar-um-habito/"),
    ("/blog/do-affirmations-work/",
     "/es/blog/funcionan-las-afirmaciones/",
     "/pt/blog/afirmacoes-funcionam/"),
    ("/blog/how-to-use-your-phone-less/",
     "/es/blog/como-usar-menos-el-celular/",
     "/pt/blog/como-usar-menos-o-celular/"),
    ("/compare/", "/es/comparar/", "/pt/comparar/"),
    ("/compare/dailies-vs-motivation/",
     "/es/comparar/dailies-vs-motivation/",
     "/pt/comparar/dailies-vs-motivation/"),
    ("/compare/dailies-vs-i-am/",
     "/es/comparar/dailies-vs-i-am/",
     "/pt/comparar/dailies-vs-i-am/"),
    ("/compare/dailies-vs-thinkup/",
     "/es/comparar/dailies-vs-thinkup/",
     "/pt/comparar/dailies-vs-thinkup/"),
    ("/compare/dailies-vs-motivate/",
     "/es/comparar/dailies-vs-motivate/",
     "/pt/comparar/dailies-vs-motivate/"),
    ("/about/", "/es/acerca-de/", "/pt/sobre/"),
    # English only. The Terms, the Privacy Policy and the Cookie Policy are
    # the binding text, and a translation would be a second version of a
    # contract nobody has had reviewed. The translated footers link here.
    ("/terms/", None, None),
    ("/privacy/", None, None),
    ("/cookies/", None, None),
]

# Written right after the hreflang block on English pages that have one. It
# walks the browser's languages in order, the way the app walks the phone's:
# English first means stay, Spanish or Portuguese first means go, anything
# else is skipped. A referrer on this site means the visitor is already
# browsing it and has seen the language links, so nothing happens.
REDIRECT = (
    "<script>/* Written by tools/languages.py: send a visitor whose browser asks for "
    "Spanish or Portuguese before English to this page in that language. */\n"
    "(function(){try{\n"
    "  var r=document.referrer; if(r&&r.indexOf(location.origin+'/')===0) return;\n"
    "  var l=navigator.languages||[navigator.language||''];\n"
    "  for(var i=0;i<l.length;i++){\n"
    "    var c=String(l[i]).slice(0,2).toLowerCase(); if(c==='en') return;\n"
    "    var a=document.querySelector('link[rel=\"alternate\"][hreflang=\"'+c+'\"]');\n"
    "    if(a){location.replace(new URL(a.href).pathname+location.search+location.hash); return;}\n"
    "  }\n"
    "}catch(e){}})();</script>\n"
)

ALT_RE = re.compile(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n')
CANON_RE = re.compile(r'<link rel="canonical" href="[^"]*">\n')
LANG_ATTR_RE = re.compile(r'<html lang="[^"]*">')
REDIRECT_RE = re.compile(r'<script>/\* Written by tools/languages\.py:.*?</script>\n', re.S)
NAV_RE = re.compile(r'[ \t]*<details class="lang">.*?</details>(?:<script>.*?</script>)?\n', re.S)
PILL_RE = re.compile(r'([ \t]*)<a class="btn btn-primary" href="[^"]*#get">')

GLOBE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
         'stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/>'
         '<path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>')
CHEVRON = ('<svg class="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" '
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>')
# Closes the open list on a click outside it or on Escape. The <details> is
# the element just before this script.
CLOSER = ("<script>(function(d){var l=d.currentScript.previousElementSibling;"
          "d.addEventListener('click',function(e){if(l.open&&!l.contains(e.target))l.open=false});"
          "d.addEventListener('keydown',function(e){if(e.key==='Escape'&&l.open){l.open=false;"
          "l.querySelector('summary').focus()}})})(document);</script>")


def file_for(url):
    return os.path.join(ROOT, url.strip("/"), "index.html") if url != "/" else os.path.join(ROOT, "index.html")


def every_page():
    """(url, lang code, row) for every page that exists in some language."""
    for row in PAGES:
        for i, url in enumerate(row):
            if url:
                yield url, LANGS[i][0], row


def alternates(row):
    """The hreflang block for a page, or '' when it exists in one language."""
    present = [(LANGS[i][0], url) for i, url in enumerate(row) if url]
    if len(present) < 2:
        return ""
    lines = ['<link rel="alternate" hreflang="%s" href="%s%s">\n' % (code, BASE, url) for code, url in present]
    lines.append('<link rel="alternate" hreflang="x-default" href="%s%s">\n' % (BASE, row[0]))
    return "".join(lines)


def menu(code, row, indent):
    """The language menu for a page in `code` whose translations are `row`."""
    links, here = [], None
    for i, (c, html_lang, name, home) in enumerate(LANGS):
        current = ' aria-current="true"' if c == code else ""
        if c == code:
            here = name
        links.append('<a href="%s" hreflang="%s" lang="%s"%s>%s</a>' % (row[i] or home, c, html_lang, current, name))
    return ('%s<details class="lang"><summary aria-label="%s: %s"><span class="lang-btn">%s'
            '<span class="lang-name">%s</span>%s</span></summary><div class="lang-menu">%s</div></details>%s\n') % (
        indent, MENU_LABEL[code], here, GLOBE, here, CHEVRON, "".join(links), CLOSER)


def render(s, code, row, hreflang=True):
    html_lang = dict((l[0], l[1]) for l in LANGS)[code]
    s = LANG_ATTR_RE.sub('<html lang="%s">' % html_lang, s, count=1)

    s = ALT_RE.sub("", s)
    s = REDIRECT_RE.sub("", s)
    alt = alternates(row) if hreflang else ""
    if alt:
        if code == "en":
            alt += REDIRECT
        m = CANON_RE.search(s)
        if not m:
            raise ValueError("no canonical link to put the hreflang block after")
        s = s[:m.end()] + alt + s[m.end():]

    s = NAV_RE.sub("", s)
    m = PILL_RE.search(s)
    if not m:
        raise ValueError("no Get Dailies pill in the nav to put the language menu before")
    s = s[:m.start()] + menu(code, row, m.group(1)) + s[m.start():]
    return s


def main():
    check = "--check" in sys.argv[1:]
    stale, missing = [], []
    for url, code, row in every_page():
        path = file_for(url)
        if not os.path.exists(path):
            missing.append(url)
            continue
        s = open(path, encoding="utf-8").read()
        try:
            out = render(s, code, row)
        except ValueError as e:
            sys.exit("%s: %s" % (os.path.relpath(path, ROOT), e))
        if out != s:
            stale.append(url)
            if not check:
                open(path, "w", encoding="utf-8").write(out)

    # The 404 is served at whatever address was asked for, so it gets the
    # language menu (each row goes to that language's home) but no hreflang:
    # it is noindex and is nobody's alternate. Its own script translates it
    # under /es/ and /pt/, the menu's button included.
    path = os.path.join(ROOT, "404.html")
    s = open(path, encoding="utf-8").read()
    out = render(s, "en", ("/", None, None), hreflang=False)
    if out != s:
        stale.append("404.html")
        if not check:
            open(path, "w", encoding="utf-8").write(out)

    if missing:
        print("missing (listed in PAGES, no file):", ", ".join(missing))
    if check:
        if stale:
            print("out of step:", ", ".join(stale))
        if stale or missing:
            sys.exit(1)
        print("all pages in step")
    else:
        print("rewrote %d page(s)" % len(stale))
        if missing:
            sys.exit(1)


if __name__ == "__main__":
    main()
