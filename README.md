# dailies-website

The website for the Dailies app — https://mydailies.app

`index.html` is the landing page. It is a single self-contained file: the
styles, the scripts, the app icon, the QR code and the quote-card photography
are all inlined, so the site has no build step and no local assets. The only
external request is to Google Fonts.

## Running locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## Editing

The quotes shown in the "What do you need today?" picker come from the app's
own library (`assets/quotes.db` in the `dailies` repo) and are tagged to the
category they appear under. The download buttons currently point at
mydailies.app — swap them for the App Store URL once the app is listed.
