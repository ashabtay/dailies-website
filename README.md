# dailies-website

The website for the Dailies app: https://mydailies.app

Static HTML with no build step. GitHub Pages serves it from `main` (`CNAME` = mydailies.app).

## Running locally

```bash
./serve.sh
```

Then open http://localhost:8000/. Don't open pages from the file system. Assets are linked from the site root (`/doc.css`, `/icon.png`), so they only resolve through a server. `serve.sh` also serves `404.html` for unknown paths, the same as GitHub Pages.

## Layout

- `index.html` and the language folders (`es/`, `pt/`, `fr/`, `de/`, `ja/`): the home pages, with inline styles and scripts
- `doc.css`: shared styles for every other page. Its token block is copied from `index.html`, so keep the two in sync.
- `blog/`, `guides/`, `compare/`, `help/` and the other folders: one `index.html` per page
- `img/`: images, always linked, never inlined
- `tools/`: helper scripts (sitemap, IndexNow, structured data, share images)
