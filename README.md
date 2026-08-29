# dailies-website

The website for the Dailies app — https://mydailies.app

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `index.html` | The landing page |
| `/help` | `help/index.html` | Help centre, with a client-side search over the entries |
| `/terms` | `terms/index.html` | Terms of Use |
| `/privacy` | `privacy/index.html` | Privacy Policy |
| `/cookies` | `cookies/index.html` | Cookie Policy |

`/terms` and `/privacy` are not optional paths: the app links to them from the
legal line on the first onboarding screen (`lib/app_config.dart` in the `dailies`
repo), and Apple checks those links during review. Each document page is a
directory with an `index.html` so the extensionless URL resolves on GitHub Pages,
Netlify, Vercel and Cloudflare Pages alike — do not flatten them to `terms.html`.

## How the files are organised

`index.html` is a single self-contained file: its styles, scripts, app icon, QR
code and quote-card photography are all inlined, so it has no build step and no
local assets.

The four document pages carry no photography, so they share two small assets
instead of each inlining a copy:

- `doc.css` — all their styling, including the design tokens
- `icon.png` — the app icon in the nav, extracted from the data URI in `index.html`

**The token block at the top of `doc.css` is duplicated from `index.html`.**
Change a colour in one and change it in the other, or the landing page and the
document pages will drift apart.

The only external request from any page is to Google Fonts.

## Editing the content

All four document pages are plain HTML with no build step and no templating.
Edit the file, reload the browser, done.

| To change | Edit |
| --- | --- |
| Terms of Use | `terms/index.html` |
| Privacy Policy | `privacy/index.html` |
| Cookie Policy | `cookies/index.html` |
| Help centre | `help/index.html` |
| Landing page | `index.html` |
| Shared styling for all four | `doc.css` |

Run `./serve.sh` first and edit against http://localhost:8000 — see
[Running locally](#running-locally) for why double-clicking the file does not
work.

Everything a reader sees lives between `<div class="prose">` and its closing
`</div>`. Above that is the page head and the nav; below it is the footer. You
should rarely need to touch either.

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

<!-- a big number -->
<div class="stat"><b>4,000+</b><span>what it counts</span></div>

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

## Analytics, pixels and consent

`consent.js` is loaded by every page and is the **only** place a tracking tag is
allowed to live. Nothing that measures loads itself: the PostHog snippet and the
Google and Meta pixels all sit inside that file behind a stored decision, so
"no non-essential cookie is set until you agree" is enforced by code rather than
promised by the policy.

Fill in `CONFIG` at the top of `consent.js` before any of it does anything:

```js
var CONFIG = {
  posthogKey:  '',                         // phc_...
  posthogHost: 'https://eu.i.posthog.com', // EU host keeps data in the EU
  googleId:    '',                         // AW-... (Ads) or G-... (GA4)
  metaPixelId: ''                          // 16-digit pixel id
};
```

**While an id is empty its tag is skipped**, so the banner works and the site
stays clean until you are ready. The docs already describe the EU PostHog host,
session recording being off, and a one-year consent lifetime (`MAX_AGE_DAYS`) —
if you change any of those in code, change them in `cookies/index.html` too.

`consent.js` also honours **Global Privacy Control** and **Do Not Track**. When
either signal is present the tags never load and the banner never opens; the
signal is re-read on every page load and never persisted, so switching it off
restores normal behaviour. The one thing that beats it is a visitor explicitly
ticking a category in the settings panel while being told the signal is on —
that is stored as `override: true`.

Two switches are offered, Analytics (PostHog) and Advertising (Google + Meta).
"Strictly necessary" covers only the consent record itself, which is kept in
local storage as `dailies_consent`, not as a cookie.

A `Cookie settings` link in every footer reopens the panel — that is the
withdrawal route the policy promises, so do not remove it. Any element with a
`data-cookie-settings` attribute does the same thing.

## Unfilled placeholders

The legal pages contain placeholders — trading address, jurisdiction, age limit,
analytics retention and so on — marked up as `<span class="fill">`. They render
as bright yellow highlights so that anything still unfilled is impossible to
miss on a published page.

Two of them are not text to fill in but **work to do**: the privacy policy
describes an in-app Analytics opt-out switch, and assumes ad attribution ships
in the app. Both must be true before the policy is accurate.

Find them all — **run this from the root of this repo, not the app repo**:

```bash
cd ~/Develop/dailies-website && grep -rno 'class="fill"[^>]*>\[[^]]*\]' terms privacy cookies | sed 's/class="fill"[^>]*>//'
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

## The landing page's quote picker

The quotes shown in the "What do you need today?" picker come from the app's
own library (`assets/quotes.db` in the `dailies` repo) and are tagged to the
category they appear under. The download buttons currently point at
mydailies.app — swap them for the App Store URL once the app is listed.
