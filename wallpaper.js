/* ============================================================================
   The wallpaper maker, on /motivational-wallpapers/ and its translations

   The page is complete without this file: the headings, every line, the
   gallery pictures and the steps are all in the HTML (tools/play_pages.py
   writes it). This adds the maker on top: the phone at the top of the page
   draws the chosen line on the chosen background, live, under a Lock Screen
   clock, and Save this wallpaper makes the full-size picture and hands it to
   the phone:

     iPhone and iPad  the share sheet, with the picture attached, where Save
                      Image puts it in Photos
     everything else  a download

   then shows the steps for setting it, and the App Store badge
   (web-wallpaper and -es, -pt, -fr, -de, -ja, -it, -ko, -zh-hant, -nl, -sv, -ar).

   The picture is drawn here on a canvas, to the same layout as
   tools/play_pages.py draws the gallery's ready-made ones with Pillow (its
   LAYOUT). Keep the two in step. Nothing leaves the browser: the picture is
   made on the device, and there is no server to send it to.

   The address can open the maker on a line: #q=<id>&k=<background>&n=<name>,
   which is how "Make it a wallpaper" on an opened envelope (/e/) arrives
   here. The id must be one of the site's lines (play-lines.js), so the
   address cannot put anybody's own words on the picture; n only fills the
   {name} of a line that has one.
   ========================================================================= */
(function () {
  'use strict';

  var P = window.DailiesPlay;
  var root = document.getElementById('maker');
  var stringsEl = document.getElementById('play-strings');
  if (!P || !root || !stringsEl) return;
  var D = P.data;
  // This page's lines by mood: each wallpaper page (motivational,
  // inspirational, positive) has its own set in play-lines.js.
  var G = (D.sets[root.getAttribute('data-page')] || D.sets.wallpapers).groups;
  var S = JSON.parse(stringsEl.textContent);
  var lang = root.getAttribute('data-lang') || 'en';
  var h = P.h;

  /* ------------------------------------------------------------ layout */
  /* tools/play_pages.py, LAYOUT and text_size(): the same numbers. */
  var W = 1080, H = 2340;
  var L = { center: 0.58, topMin: 0.40, maxW: 864, lineH: 1.32, authorScale: 0.52, authorGap: 0.62, markY: 0.885, markSize: 30 };
  var SHADE = [[0, .16], [.30, .10], [.50, .34], [.80, .34], [1, .20]];
  /* Lora has no kana, hangul or hanzi: each CJK language names the system's
     own serif after it, so the line is drawn in that language's forms.
     Dutch and Swedish are all Lora (it has every letter they use). Lora has
     no Arabic at all, so Arabic does not start with it: the line is drawn
     whole in the system's Arabic face, never Lora's punctuation and digits
     between Arabic words. */
  var RTL = lang === 'ar';
  var FAMILY = RTL
    ? '"Geeza Pro", "SF Arabic", "Noto Naskh Arabic", "Segoe UI", sans-serif'
    : 'Lora, ' + ({
      ko: '"AppleMyungjo", "Nanum Myeongjo", "Noto Serif KR", "Batang", serif',
      'zh-hant': '"Songti TC", "Noto Serif TC", "PMingLiU", serif'
    }[lang] || '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif');
  /* Japanese and Chinese break between characters (never before 、。 or
     after 「); Korean breaks at spaces like the Latin languages, but its
     glyphs are as wide as kanji, so it takes the CJK sizes. */
  var CJK = lang === 'ja' || lang === 'ko' || lang === 'zh-hant';
  var BY_CHAR = lang === 'ja' || lang === 'zh-hant';

  function textSize(text, ja) {
    var n = Array.from(text).length;
    if (ja) return n <= 14 ? 84 : n <= 24 ? 74 : n <= 34 ? 66 : 58;
    return n <= 28 ? 96 : n <= 44 ? 84 : n <= 62 ? 74 : 64;
  }

  var NO_START = '、。，．・：；？！」』）】〉》ー…';
  var NO_END = '「『（【〈《';

  function wrap(ctx, text, maxW, ja) {
    var lines = [], cur = '';
    if (ja) {
      var phrases = text.match(/[^、。，；]+[、。，；]?/g) || [text];
      phrases.forEach(function (ph) {
        if (!cur || ctx.measureText(cur + ph).width <= maxW) { cur += ph; return; }
        lines.push(cur);
        cur = ph;
      });
      if (cur) lines.push(cur);
      var out = [];
      lines.forEach(function (ln) {
        var c = '';
        Array.from(ln).forEach(function (ch) {
          if (c && ctx.measureText(c + ch).width > maxW && NO_START.indexOf(ch) === -1 && NO_END.indexOf(c.slice(-1)) === -1) {
            out.push(c);
            c = ch;
          } else c += ch;
        });
        if (c) out.push(c);
      });
      return out;
    }
    text.split(' ').forEach(function (word) {
      var test = cur ? cur + ' ' + word : word;
      if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = word; }
      else cur = test;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  /* Draws the wallpaper into ctx at scale sc (1 for the full picture, less
     for the preview). The background image must already be loaded. */
  function draw(ctx, sc, img, text, author) {
    ctx.save();
    ctx.clearRect(0, 0, W * sc, H * sc);
    var s = H / img.naturalHeight, bw = img.naturalWidth * s;
    ctx.drawImage(img, ((W - bw) / 2) * sc, 0, bw * sc, H * sc);
    var g = ctx.createLinearGradient(0, 0, 0, H * sc);
    SHADE.forEach(function (st) { g.addColorStop(st[0], 'rgba(0,0,0,' + st[1] + ')'); });
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W * sc, H * sc);

    var size = textSize(text, CJK);
    ctx.font = (size * sc) + 'px ' + FAMILY;
    var lines = wrap(ctx, text, L.maxW * sc, BY_CHAR);
    var lh = size * L.lineH;
    var asize = Math.round(size * L.authorScale);
    var block = lines.length * lh + (author ? size * L.authorGap + asize * 1.3 : 0);
    var top = Math.max(H * L.topMin, H * L.center - block / 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // Arabic is laid out right to left: the words of each line run from the
    // right, still centred on the same x (and wrap() still breaks at spaces,
    // first word first). No letter-spacing anywhere, which Arabic, being
    // joined, cannot take. The mark below goes back to left to right.
    ctx.direction = RTL ? 'rtl' : 'ltr';
    ctx.shadowColor = 'rgba(0,0,0,.43)';
    ctx.shadowBlur = 18 * sc;
    ctx.shadowOffsetY = 3 * sc;
    ctx.fillStyle = '#fff';
    var y = top;
    lines.forEach(function (ln) {
      ctx.fillText(ln, (W / 2) * sc, (y + (lh - size) / 2) * sc);
      y += lh;
    });
    if (author) {
      y += size * L.authorGap;
      ctx.font = (asize * sc) + 'px ' + FAMILY;
      ctx.fillStyle = 'rgba(255,255,255,.84)';
      ctx.fillText(author, (W / 2) * sc, y * sc);
    }
    ctx.direction = 'ltr';
    ctx.font = (L.markSize * sc) + 'px Lora, Georgia, serif';
    ctx.fillStyle = 'rgba(255,255,255,.59)';
    ctx.fillText('mydailies.app', (W / 2) * sc, H * L.markY * sc);
    ctx.restore();
  }

  /* ------------------------------------------------------------- state */

  var own = root.querySelector('.pl-own');
  var linenav = root.querySelector('.pl-linenav');
  var state = { mood: null, i: 0, q: root.getAttribute('data-q'), k: +root.getAttribute('data-k') || 0, name: '', from: 'maker' };
  moodOf(state.q);
  readHash();

  function moodOf(q) {
    for (var m in G) {
      for (var i = 0; i < G[m].length; i++) {
        if (G[m][i][0] === q) { state.mood = m; state.i = i; return true; }
      }
    }
    state.mood = null;
    return false;
  }

  function readHash() {
    var raw = location.hash.slice(1);
    if (!raw) return;
    var p = {};
    raw.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) { try { p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) {} }
    });
    var k0 = parseInt(p.k, 10);
    if (k0 >= 0 && k0 < D.bg.length) state.k = k0;
    if (p.t) {
      // An envelope with the sender's own words: they stay on this device.
      own.value = P.clean(p.t, 140);
      state.mood = 'own';
      state.from = 'envelope';
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      return;
    }
    if (!p.q || !P.line(p.q)) return;
    var name = P.clean(p.n, P.MAX_NAME);
    if (P.isNamed(p.q) && !name) return;
    state.q = p.q;
    state.name = name;
    var k = parseInt(p.k, 10);
    if (k >= 0 && k < D.bg.length) state.k = k;
    state.from = 'envelope';
    moodOf(state.q);
    // The line came in the address; the address does not keep it.
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  function isOwn() { return state.mood === 'own'; }
  function ownText() { return P.clean(own.value, 140); }
  function text() { return isOwn() ? (ownText() || S.ownEmpty) : P.lineText(state.q, lang, state.name); }
  function author() { return isOwn() ? '' : P.lineAuthor(state.q, lang); }

  /* ----------------------------------------------------------- preview */

  var phone = root.querySelector('.wp-phone');
  var still = root.querySelector('.wp-still');
  var canvas = document.createElement('canvas');
  var PS = 0.5;
  canvas.width = W * PS;
  canvas.height = H * PS;
  canvas.className = 'wp-canvas';
  canvas.setAttribute('role', 'img');
  var imgs = {};

  function bg(k) {
    if (imgs[k]) return imgs[k];
    var img = new Image();
    img.decoding = 'async';
    img.src = P.bgUrl(k);
    imgs[k] = new Promise(function (res, rej) {
      img.onload = function () { res(img); };
      img.onerror = rej;
    });
    return imgs[k];
  }

  var fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all([document.fonts.load('96px Lora'), document.fonts.ready]).catch(function () {})
    : Promise.resolve();

  var drawn = 0;
  function render() {
    var n = ++drawn;
    var t = text(), a = author();
    Promise.all([bg(state.k), fontsReady]).then(function (r) {
      if (n !== drawn) return;
      draw(canvas.getContext('2d'), PS, r[0], t, a);
      canvas.setAttribute('aria-label', t + (a ? ' (' + a + ')' : ''));
      if (still && still.parentNode) { still.replaceWith(canvas); still = null; }
    }).catch(function () {});
    sync();
  }

  function sync() {
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-mood') === state.mood)); });
    own.hidden = !isOwn();
    linenav.hidden = isOwn();
    swatches.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-k') === state.k)); });
  }

  /* The clock: today's date and the time now, in the page's language, the
     way a Lock Screen shows them (no AM or PM). */
  var dateEl = root.querySelector('.wp-date'), timeEl = root.querySelector('.wp-time');
  var LOCALE = { en: 'en-US', es: 'es-MX', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE', ja: 'ja-JP',
                 it: 'it-IT', ko: 'ko-KR', 'zh-hant': 'zh-TW', nl: 'nl-NL', sv: 'sv-SE',
                 // Western digits, as the app and the site write Arabic.
                 ar: 'ar-u-nu-latn' }[lang];
  function tick() {
    var now = new Date();
    try {
      dateEl.textContent = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
      timeEl.textContent = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' }).formatToParts(now)
        .filter(function (p) { return p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && /[:.h]/.test(p.value)); })
        .map(function (p) { return p.value; }).join('').replace(/^0(\d)/, '$1');
    } catch (e) {}
  }
  tick();
  setInterval(tick, 20000);

  /* ---------------------------------------------------------- controls */

  var counts = {};
  function changed(what) {
    counts[what] = (counts[what] || 0) + 1;
    if (counts[what] <= 3) P.ev('wallpaper_changed', { change: what });
  }

  var chips = Array.prototype.slice.call(root.querySelectorAll('.pl-chip'));
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var m = c.getAttribute('data-mood');
      state.mood = m;
      state.i = 0;
      if (m !== 'own') setFrom(G[m][0]);
      changed(m === 'own' ? 'own' : 'mood');
      render();
      if (m === 'own') own.focus();
    });
  });

  function setFrom(entry) {
    state.q = entry[0];
    state.k = entry[1];
    state.name = '';
  }

  Array.prototype.forEach.call(root.querySelectorAll('[data-step]'), function (b) {
    b.addEventListener('click', function () {
      if (!state.mood || isOwn()) { state.mood = Object.keys(G)[0]; state.i = -1; }
      var list = G[state.mood];
      state.i = (state.i + (+b.getAttribute('data-step')) + list.length) % list.length;
      // A new line keeps the background the reader picked, if they picked one.
      var k = state.k;
      setFrom(list[state.i]);
      if (pickedBg) state.k = k;
      changed('line');
      render();
    });
  });

  var pickedBg = false;
  var swatches = Array.prototype.slice.call(root.querySelectorAll('.wp-sw'));
  swatches.forEach(function (b) {
    b.addEventListener('click', function () {
      state.k = +b.getAttribute('data-k');
      pickedBg = true;
      changed('bg');
      render();
    });
    b.addEventListener('pointerenter', function () { bg(+b.getAttribute('data-k')); }, { once: true });
  });

  /* The gallery and the lists under it open their line up here. */
  Array.prototype.forEach.call(document.querySelectorAll('.wp-pick, .wp-use'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      state.q = a.getAttribute('data-q');
      state.k = +a.getAttribute('data-k');
      state.name = '';
      pickedBg = false;
      moodOf(state.q);
      state.from = a.classList.contains('wp-pick') ? 'gallery' : 'list';
      P.ev('wallpaper_picked', { from: state.from });
      render();
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  var typing;
  own.addEventListener('input', function () {
    clearTimeout(typing);
    typing = setTimeout(render, 120);
  });

  /* -------------------------------------------------------------- save */

  var IOS = P.IOS, ANDROID = P.ANDROID;
  var saveBtn = root.querySelector('.wp-save');

  /* Everything here runs synchronously inside the tap, so iOS still counts
     the share as the reader's own action: toBlob would hand the file over a
     moment later, after Safari has stopped treating it as one. */
  function makeFile(img) {
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    draw(c.getContext('2d'), 1, img, text(), author());
    var url = c.toDataURL('image/jpeg', 0.92);
    var bin = atob(url.split(',')[1]);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var blob = new Blob([bytes], { type: 'image/jpeg' });
    return { blob: blob, url: url, file: new File([blob], (S.fileName || 'dailies-wallpaper') + '.jpg', { type: 'image/jpeg' }) };
  }

  var loaded = {};
  function preload(k) { bg(k).then(function (img) { loaded[k] = img; }); }
  preload(state.k);
  swatches.forEach(function (b) { b.addEventListener('click', function () { preload(state.k); }); });

  saveBtn.addEventListener('click', function () {
    if (isOwn() && !ownText()) { own.focus(); return; }
    var img = loaded[state.k];
    if (!img) { preload(state.k); bg(state.k).then(function () { saveBtn.click(); }); return; }
    var out;
    try { out = makeFile(img); } catch (e) { return; }
    var props = { mood: state.mood || 'none', from: state.from };

    // On an iPhone or iPad the picture must end up in Photos, never Files:
    // the share sheet (Save Image) where the page may use it, and otherwise
    // the picture itself to press and hold (Save to Photos). A download would
    // land in Files, where the wallpaper settings cannot see it.
    if (IOS) {
      if (navigator.canShare && navigator.canShare({ files: [out.file] })) {
        navigator.share({ files: [out.file] }).then(function () {
          P.ev('wallpaper_saved', Object.assign({ method: 'share' }, props));
          after('ios');
        }).catch(function (e) {
          if (e && e.name === 'AbortError') return;
          hold(out, props);
        });
      } else hold(out, props);
      return;
    }
    try {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(out.blob);
      a.download = out.file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      P.ev('wallpaper_saved', Object.assign({ method: 'download' }, props));
      after(IOS ? 'ios' : ANDROID ? 'android' : 'desk');
    } catch (e) { fallback(out, props); }
  });

  /* The picture itself, to press and hold: Save to Photos puts it in the
     camera roll. Then the rest of the steps. */
  function hold(out, props) {
    after(IOS ? 'ios' : ANDROID ? 'android' : 'desk', out);
    P.ev('wallpaper_saved', Object.assign({ method: 'hold' }, props));
  }
  function fallback(out, props) { hold(out, props); }

  /* After saving: the steps for this phone (copied from the page's own
     steps, so there is one wording of them), then the app. */
  function after(platform, out) {
    var o = P.sheet(out ? S.holdTitle : S.savedTitle, 'wp-sheet');
    if (out) {
      o.body.appendChild(h('p', 'pl-lede', S.hold));
      // The picture, with a looping hint over it: a fingertip presses, the
      // picture dips the way iOS lifts it, and the Save to Photos menu pops
      // up. The hint takes no touches, and goes the moment the reader
      // touches the picture themselves.
      var wrap = h('div', 'wp-hold');
      var im = document.createElement('img');
      im.src = URL.createObjectURL(out.blob);
      im.alt = text();
      im.className = 'wp-full';
      wrap.appendChild(im);
      var hint = h('div', 'wp-hold-hint');
      hint.setAttribute('aria-hidden', 'true');
      hint.appendChild(h('span', 'wp-hold-ring'));
      hint.appendChild(h('span', 'wp-hold-dot'));
      var menu = h('span', 'wp-hold-menu');
      menu.appendChild(h('span', null, S.holdMenu));
      menu.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/></svg>');
      hint.appendChild(menu);
      wrap.appendChild(hint);
      ['touchstart', 'pointerdown'].forEach(function (t) {
        im.addEventListener(t, function () { wrap.classList.add('is-touched'); }, { passive: true });
      });
      o.body.appendChild(wrap);
    } else if (platform === 'desk') o.body.appendChild(h('p', 'pl-lede', S.savedDesk));
    var want = platform === 'ios' ? ['iphone'] : platform === 'android' ? ['android'] : ['iphone', 'android'];
    want.forEach(function (p) {
      var src = document.querySelector('#steps-' + p + ' ol');
      if (!src) return;
      if (want.length > 1) o.body.appendChild(h('h3', 'wp-sheet-h', S[p]));
      var ol = src.cloneNode(true);
      // Step one is the button just pressed.
      if (ol.firstElementChild) ol.removeChild(ol.firstElementChild);
      ol.className = 'wp-sheet-steps';
      o.body.appendChild(ol);
    });
    var bridge = h('div', 'pl-bridge');
    bridge.appendChild(h('h3', null, S.bridgeTitle));
    bridge.appendChild(h('p', null, S.bridgeBody));
    var tmp = document.createElement('div');
    tmp.innerHTML = S.badge;
    if (tmp.firstChild) bridge.appendChild(tmp.firstChild);
    o.body.appendChild(bridge);
  }

  render();
})();
