# dailies-website

The website for the Dailies app — https://mydailies.app

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `index.html` | The landing page |
| `/help` | `help/index.html` | Help center, with a client-side search over the entries |
| `/guides` | `guides/index.html` | Guides hub, linking the how-to articles below |
| `/guides/quotes-on-your-iphone-lock-screen` | `guides/quotes-on-your-iphone-lock-screen/index.html` | How to put quotes on your iPhone Lock Screen |
| `/guides/add-a-widget-to-your-home-screen` | `guides/add-a-widget-to-your-home-screen/index.html` | How to add a widget to your Home Screen |
| `/about` | `about/index.html` | Who makes Dailies, the editorial rules, and the contact route |
| `/terms` | `terms/index.html` | Terms of Use |
| `/privacy` | `privacy/index.html` | Privacy Policy |
| `/cookies` | `cookies/index.html` | Cookie Policy |
| `/compare` | `compare/index.html` | Comparison hub, linking the four articles below |
| `/compare/dailies-vs-motivation` | `compare/dailies-vs-motivation/index.html` | Dailies vs Motivation (Monkey Taps) |
| `/compare/dailies-vs-i-am` | `compare/dailies-vs-i-am/index.html` | Dailies vs I am (Monkey Taps) |
| `/compare/dailies-vs-thinkup` | `compare/dailies-vs-thinkup/index.html` | Dailies vs ThinkUp (Precise Wellness) |
| `/compare/dailies-vs-motivate` | `compare/dailies-vs-motivate/index.html` | Dailies vs Motivate (Brave New Logic) |
| any missing path | `404.html` | The custom 404 |

`/terms` and `/privacy` are not optional paths: the app links to them from the
legal line on the first onboarding screen (`lib/app_config.dart` in the `dailies`
repo), and Apple checks those links during review. Each document page is a
directory with an `index.html` so the extensionless URL resolves on GitHub Pages,
Netlify, Vercel and Cloudflare Pages alike — do not flatten them to `terms.html`.

## How the files are organized

`index.html` is a single self-contained file: its styles, scripts, app icon, QR
code and quote-card photography are all inlined, so it has no build step and no
local assets.

The document and comparison pages carry no photography, so they share two small
assets instead of each inlining a copy:

- `doc.css` — all their styling, including the design tokens
- `icon.png` — the app icon in the nav, extracted from the data URI in `index.html`

One more asset is shared by every page including the landing page:

- `og.png` — the 1200×630 card link previews show. See
  [The share image](#the-share-image).

**The token block at the top of `doc.css` is duplicated from `index.html`.**
Change a color in one and change it in the other, or the landing page and the
document pages will drift apart.

The only external request from any page is to Google Fonts.

## House rules for the copy

Two rules apply to every page, and both are easy to break by accident.

**1. No numbers about Dailies.** Not the size of the quote library, not how many
topics there are, not how many backgrounds or typefaces are free, not how many
quotes a day you can have. Every one of these moves whenever the app ships, and
a number on a page nobody remembered to update is worse than no number at all.
Write "thousands of quotes", "a large free slice", "as many or as few a day as
you like". The `<div class="stat">` block in `doc.css` exists for competitor
figures and for nothing else.

Competitor numbers are the exception and stay: they are dated and sourced on the
page, which is what makes them defensible. See
[The comparison pages](#the-comparison-pages).

**2. American spelling.** The app, the App Store listing and the app repo's docs
all use American spelling, and the site follows. `color`, `favorite`, `license`,
`recognize`, `catalog`, `labeled`, `personalize`. Quote text is exempt and stays
exactly as it was written.

## Editing the content

Every page but the landing page is plain HTML with no build step and no
templating. Edit the file, reload the browser, done.

| To change | Edit |
| --- | --- |
| Terms of Use | `terms/index.html` |
| Privacy Policy | `privacy/index.html` |
| Cookie Policy | `cookies/index.html` |
| Help center | `help/index.html` |
| A comparison article | `compare/dailies-vs-<app>/index.html` |
| A how-to guide | `guides/<slug>/index.html` |
| About page | `about/index.html` |
| The 404 page | `404.html` |
| Landing page | `index.html` |
| Shared styling for all of them | `doc.css` |

Run `./serve.sh` first and edit against http://localhost:8000 — see
[Running locally](#running-locally) for why double-clicking the file does not
work.

Everything a reader sees lives between `<div class="prose">` and its closing
`</div>`. Above that is the page head and the nav; below it is the footer. You
should rarely need to touch either.

**The nav on every document and comparison page is a hand-copied version of the
landing page's nav.** Its links point at landing-page anchors (`/#taste`,
`/#how`, `/#get`). Add, remove or rename a section on the landing page and
update every other page's nav to match, or they link to anchors that no longer
exist. Nothing checks this.

`sitemap.xml` is **generated** — do not hand-edit it. Add a page to `PAGES` in
`tools/sitemap.py` and run it. See [The sitemap](#the-sitemap).

**Every page's footer is hand-copied too**, and it now carries nine links.
Adding a top-level page means adding it to the footer of all of them, the same
way the nav works.

### The document pages

Each numbered section is one `<section>` block:

```html
<section id="sharing">
  <h2>7. Sharing quote pictures</h2>
  <p>Body text.</p>
</section>
```

Two rules when adding or removing one:

1. **The `id` is the anchor.** `terms/index.html` `id="sharing"` is what
   `mydailies.app/terms#sharing` scrolls to, and the app and the other pages
   link to some of these. Renaming an id breaks those links silently.
2. **The sidebar is hand-maintained.** It is the `<aside class="toc">` block near
   the top of the same file, one `<a href="#id">` per section. Add a section and
   you must add its line there too — nothing generates it.

Useful blocks, all styled by `doc.css`:

```html
<!-- a highlighted box -->
<div class="callout">
  <div class="callout-label">Short label</div>
  <p>The point.</p>
</div>

<!-- a quieter aside, just a rule down the left -->
<div class="callout plain"><p>The point.</p></div>

<!-- a big number. Competitor figures only - never a number about Dailies -->
<div class="stat"><b>4.8</b><span>what it counts, and whose it is</span></div>

<!-- a table; the wrapper is what stops wide tables breaking the page -->
<div class="table-scroll">
  <table>
    <tr><th>Heading</th><th>Heading</th></tr>
    <tr><td>Cell</td><td>Cell</td></tr>
  </table>
</div>

<!-- a blank you still have to fill in -->
<span class="fill">[WHAT IS MISSING]</span>
```

### The help page

Every question is one self-contained `<details>` block. To add one, copy this
anywhere inside an existing `<div class="faq">`:

```html
<details><summary>The question, as somebody would ask it</summary>
  <div class="details-body">
    <p>The answer.</p>
  </div></details>
```

- `<details open>` makes it start expanded. Keep **one** open per section — it
  is the section's headline answer.
- The `<div class="details-body">` wrapper is required. Without it the answer
  loses its padding and type styles.
- **The search box needs nothing.** It reads the visible text of every
  `<details>` on the page at load, so a new entry is searchable the moment you
  save. Do not register it anywhere.
- Adding a whole new section means adding a `<section id="...">` with its own
  `<div class="faq">`, plus a line in the `<aside class="toc">` sidebar.
- The three cards at the top are hand-picked shortcuts, not generated. They are
  the `<div class="cards">` block; each is an `<a class="card" href="#id">`.

## The guides

`/guides` and its articles answer how-to queries — *how to put quotes on your
iPhone Lock Screen*, *how to add a widget to your Home Screen*. The material was
already on the help page, and that is the point: **a `<details>` inside a help
accordion is not a page and cannot rank.** A guide is the same answer given room
to be complete, at a URL of its own, with the troubleshooting attached.

They are built out of the same blocks as the comparison articles, so there is
nothing new to learn to edit one. Four things to keep true:

1. **The guide is the long version, the help entry stays the short one.** Do not
   delete the help entry when you write a guide. Link the two: the help entries
   for the Home Screen and Lock Screen widgets each end with a line pointing at
   the matching guide, and the guides point back at `/help` for everything they
   do not cover.
2. **No number about Dailies**, the same as everywhere else — see
   [House rules for the copy](#house-rules-for-the-copy). The guides get close to
   this rule twice and stay the right side of it: the widget sizes are named
   (`medium` and `large`) rather than counted, and the minimum iOS version is
   written as "every iPhone that can run Dailies can show a Lock Screen widget"
   rather than as a version number, because the version number moves when the
   app raises its deployment target and the sentence never does.
3. **Each guide carries a `HowTo` and a `FAQPage` JSON-LD block** at the bottom
   of the file. The `HowTo` steps must match the numbered `<ol>` in the body and
   the `FAQPage` must match the visible `<details>` list, or the structured data
   and the page disagree. Edit one, edit the other.
4. **Steps get a date, like competitor figures do.** The `.doc-meta` line says
   when they were last checked against a real phone. iOS moves the buttons every
   few releases — the `+` in the Home Screen editor became `Edit → Add Widget` —
   so re-walk them when a major version ships and move the date when you do.

Adding a guide: copy the closest existing one, then add it to the cards and the
sidebar on `guides/index.html`, to `PAGES` in `tools/sitemap.py`, and to the
help entry it is the long version of.

## The comparison pages

`/compare` and its four articles are SEO pages: somebody searching *dailies vs
motivation* or *best daily quotes app* should land on one. They use `doc.css`
and the same nav and footer as the document pages, so there is nothing new to
maintain in the styling.

Two rules keep them defensible, and both are load-bearing rather than editorial
taste:

1. **Every number about another app is dated on the page and sourced to that
   app's own App Store listing.** The current figures were read from the US
   storefront on **8 September 2026**. Ratings counts, prices, sizes, languages
   and age ratings all move, and prices in this category are A/B tested — an
   undated claim about a competitor's price goes stale within weeks and is the
   one thing a rival could reasonably complain about.
2. **No number about Dailies appears at all** — see
   [House rules for the copy](#house-rules-for-the-copy). The library size, the
   free tier and the delivery limits all move with the app, so the articles
   describe them in words. The comparison tables read "Thousands of quotes, a
   large free slice" against a competitor's dated, sourced figure, and that
   asymmetry is deliberate: their number is checked, ours would not stay true.

**The articles state no price for Dailies Premium**, and no trial length. They
send the reader to the purchase screen instead. That is rule 1 applied to the one
number most tempting to write down: App Store prices are tested and change, and
the page would be the last place anyone remembered to update.

The articles also never recommend Dailies for a child or a teenager, whatever
its App Store age rating says. The Terms of Use ask that users be adults, and a
comparison page that contradicts the terms is worse than one row shorter.

Re-check the competitor figures roughly every six months, and update the date
line in the header (`.doc-meta`) and in the Sources section when you do. If a
rival ships something that removes a difference the article leans on — a Lock
Screen widget, say — change the article rather than leaving it to age.

Each article carries two JSON-LD blocks at the bottom of the file: an `Article`
and a `FAQPage`. If you edit a question or answer in the visible `<details>`
list, edit the `FAQPage` too, or the structured data and the page disagree.

**Every article is signed.** The first `.doc-meta` span is a byline linking to
`/about`, sitting in front of the dated sourcing line. Comparison content is
judged on whether somebody stands behind it, and an unsigned page arguing that
its rivals are worse is the weakest version of that argument. The same name is
in the `Article` block's `author`, and it is the same name already on the
[Terms of Use](terms/index.html) and the [Privacy Policy](privacy/index.html) —
so the byline discloses nothing the legal pages did not already say. Keep the
three in step.

## The share image

`og.png` is the 1200×630 card Slack, iMessage, X and LinkedIn render when
somebody pastes a link. Every page points at the same one.

It used to be `icon.png`, which is 256×256 — small enough that every one of
those services fell back to the tiny-thumbnail layout instead of the wide card.
The size is the whole reason the file exists; 1200×630 is what they all want.

It is generated rather than drawn:

```bash
python3 tools/make-og.py
```

The script needs Pillow. It fetches Fraunces, Figtree and Courier Prime from the
Google Fonts repo into `~/.cache/dailies-og-fonts` on first run, so no font file
is checked in. **Its colors are the same tokens `doc.css` declares, and its
ridge is a transcription of the contour curve `index.html` draws live on its
hero canvas.** Change a token in the CSS and change it in the script too, the
same way `doc.css` and `index.html` have to stay in step — otherwise the card
slowly stops looking like the site it is advertising.

Three `<meta>` tags go with it on every page and are not optional: `og:image`
needs `og:image:width` and `og:image:height` for the card to lay out before the
image has loaded, and `twitter:card` must be `summary_large_image` or X renders
the small square regardless of what size the image actually is.

## The sitemap

`sitemap.xml` is generated. **Do not hand-edit it**, and do not add a `<url>`
entry by hand — add the page to `PAGES` in `tools/sitemap.py` and run:

```bash
python3 tools/sitemap.py
```

The point of the script is the `<lastmod>` dates. Every entry used to carry the
date of the deploy, which is the one thing `<lastmod>` must not be: a date that
advances whether or not anything changed tells a crawler nothing, and a crawler
that learns the dates are noise stops reading them — which costs you the field's
only real use, getting a genuinely updated page re-read quickly.

So the script never looks at the clock to decide. For each page it hashes the
page's **content** — the file with its `<head>` and its HTML comments stripped
and whitespace flattened — and compares that against the hash it recorded last
run in `tools/sitemap-state.json`:

| What you changed | What happens to that page's `<lastmod>` |
| --- | --- |
| The words, the links, the JSON-LD | Moves to today |
| `<head>`: a meta tag, the og image, the stylesheet link | Held |
| `doc.css`, or the indentation of a file | Held |
| Nothing — you just redeployed | Held |

`tools/sitemap-state.json` is the record of those hashes and dates and **is
committed**. Delete it and every date reseeds from git, losing the history the
whole mechanism exists to keep.

A page listed in `PAGES` for the first time is seeded from git — the date of the
last commit that touched its file — rather than from today, so adding a page to
the script does not stamp it with the day you happened to add it.

`404.html` is deliberately not in `PAGES`. It is not a destination, and it is
`noindex`.

## Analytics, pixels and consent

`consent.js` is loaded by every page and is the **only** place a tracking tag is
allowed to live. Nothing that measures loads itself: the PostHog snippet and the
Google, Meta and TikTok pixels all sit inside that file behind a stored decision, so
"no non-essential cookie is set until you agree" is enforced by code rather than
promised by the policy.

Fill in `CONFIG` at the top of `consent.js` before any of it does anything:

```js
var CONFIG = {
  posthogKey:  '',                         // phc_...
  posthogHost: 'https://eu.i.posthog.com', // EU host keeps data in the EU
  googleId:    '',                         // AW-... (Ads) or G-... (GA4)
  metaPixelId: '',                         // 16-digit pixel id
  tiktokPixelId: ''                        // 20-character id from TikTok Events Manager
};
```

**While an id is empty its tag is skipped**, so the banner works and the site
stays clean until you are ready. The docs already describe the EU PostHog host,
session recording being off, and a one-year consent lifetime (`MAX_AGE_DAYS`) —
if you change any of those in code, change them in `cookies/index.html` too.

`consent.js` also honours **Global Privacy Control** and **Do Not Track**. When
either signal is present the tags never load and the banner never opens; the
signal is re-read on every page load and never persisted, so switching it off
restores normal behavior. The one thing that beats it is a visitor explicitly
ticking a category in the settings panel while being told the signal is on —
that is stored as `override: true`.

Two switches are offered, Analytics (PostHog) and Advertising (Google, Meta and
TikTok).
"Strictly necessary" covers only the consent record itself, which is kept in
local storage as `dailies_consent`, not as a cookie.

**The download CTA is also a conversion.** `analytics.js` sends PostHog's
`download_clicked`, then calls `window.dailiesTags.downloadClicked()`, which
lives in `consent.js` and reports a `Download` event to whichever advertising
pixels the visitor allowed. The two sit on separate consent switches and will
never agree on a number; that is the switches working. Ad-platform events
belong in `consent.js` with the tags, never in `analytics.js`.

A `Cookie settings` link in every footer reopens the panel — that is the
withdrawal route the policy promises, so do not remove it. Any element with a
`data-cookie-settings` attribute does the same thing.

## Unfilled placeholders

Anything on a legal page that still needs a decision is marked up as
`<span class="fill">`. It renders as a bright yellow highlight so that an
unfilled blank is impossible to miss on a published page. None remain at the
time of writing; the grep below is how to be sure before publishing.

Two things the privacy policy says about the app are checked against the app
repo rather than filled in here, and both must stay true: analytics can be
switched off under **Profile → Additional Info → Share usage analytics**, and
the app shows no App Tracking Transparency prompt and does no ad attribution.
If either changes, sections 3 and 4 of the policy change with it, and the help
page's "Can I switch the usage measurements off?" entry too.

Find them all — **run this from the root of this repo, not the app repo**:

```bash
cd ~/Develop/dailies-website && grep -rno 'class="fill"[^>]*>\[[^]]*\]' terms privacy cookies compare guides about 404.html | sed 's/class="fill"[^>]*>//'
```

Delete the `<span>` wrapper as you fill each one in. The page is not ready to
publish while any remain.

## Running locally

```bash
./serve.sh
```

Then open http://localhost:8000/help/ (the script opens it for you).

**Do not open the pages by double-clicking them.** Every asset is referenced
from the site root — `/doc.css`, `/icon.png`, `/consent.js` — because that is
what they resolve to once the site is deployed at mydailies.app. A `file://`
URL has no root, so `/doc.css` resolves to `file:///doc.css`, which does not
exist, and the page renders as unstyled text. Nothing is broken; it is just
being opened the wrong way.

Leave the server running while you edit. Save the file, reload the browser —
there is no build step and no watcher to restart.

`serve.sh` serves `404.html` for any path it cannot find, with a real 404
status, because that is what GitHub Pages, Netlify, Vercel and Cloudflare Pages
all do. Without it the 404 page would be the one page on the site you could
never see the way a visitor does — you would get Python's grey error page
instead. Open any made-up path to check it:

```bash
open http://localhost:8000/no-such-page
```

Note that `python3 -m http.server` on its own does **not** do this, so the
`.claude/launch.json` preview server shows the stock error page. Use `serve.sh`
when the 404 is what you are working on.

## The landing page's quote picker

The quotes in the "Pick a topic. See what lands." picker are real quotes from
`assets/quotes.db` in the `dailies` repo, and each chip is named after a real
**section** of the app's topic list — Confidence, Humor, Direction, Calm,
Starting, Self-kindness.

Two things have to stay true, and neither is enforced by anything:

1. **Every quote must still exist in `quotes.db`.** Lines get withdrawn from the
   corpus, usually for rights reasons, and a withdrawn line sitting on the
   marketing page is the one copy nobody is guarding.
2. **Every quote must genuinely carry the section its chip is named after.**

Check both at once, from the root of this repo:

```bash
python3 - <<'EOF'
import json,re,subprocess
DB='../dailies/assets/quotes.db'
s=open('index.html',encoding='utf-8').read()
k=s.find('const SETS = ')+len('const SETS = ')
d=0
for i,c in enumerate(s[k:]):
    d+= c=='[' ; d-= c==']'
    if c==']' and d==0: break
for st in json.loads(s[k:k+i+1]):
    for q in st['quotes']:
        t=q['t'].replace("'","''")
        out=subprocess.run(['sqlite3',DB,"select coalesce(group_concat(distinct s.displayName),'MISSING') from quotes q join quoteTopics qt on qt.quoteId=q.quoteId join topics t on t.slug=qt.topicSlug join sections s on s.slug=t.sectionSlug where q.text='"+t+"';"],capture_output=True,text=True).stdout.strip()
        print(('ok ' if st['label'] in out.split(',') else 'BAD'),st['label'],'|',out)
EOF
```

The download buttons still point at mydailies.app — swap them for the App Store
URL (`kAppStoreUrl` in `lib/app_config.dart`) once the app is listed.
