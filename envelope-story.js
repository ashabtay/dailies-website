/* ============================================================================
   Show what you got: an opened envelope as a picture for a Story.

   After a friend opens an envelope (/sealed/ for one sealed in the app, /e/
   for one sealed on these pages), "Post it to your Story" makes a 1080x1920
   picture of it - the open envelope with their name on it, the letter
   standing in it with their line, the broken wax with the sender's initial
   - and offers it to the phone's share sheet (Instagram, TikTok, WhatsApp
   status, Save Image), or as a download where there is no share sheet. The
   brag is "someone thought of me", so the picture says who sealed it,
   unless the receiver turns that off.

   Nothing leaves the phone: the picture is drawn on a canvas here and
   handed straight to the share sheet. Instagram covers about the top 250
   and bottom 340 pixels of a Story with its own controls, so nothing that
   matters is drawn there.

     window.DailiesStory.open({
       to, from, text, author,        the envelope (names and line as shown)
       look,                          {src} | {gradient:[a,b]} | {color}
       lang,                          'en', 'es', 'pt', 'fr', 'de' or 'ja'
       forName,                       the envelope's "For {to}" template
       onEvent(action, props)         story_opened, story_shared, story_closed
     })

   Needs /envelope-seal.js for the wax, and /envelope-story.css.
   ========================================================================= */
(function () {
  'use strict';

  var W = 1080, H = 1920;

  var STRINGS = {
    en: { button: 'Post it to your Story', headFrom: '{from} sealed this for me', headSomeone: 'Someone sealed this for me',
      showFrom: 'Show who sent it', share: 'Share', save: 'Save picture', close: 'Close', making: 'Getting it ready' },
    es: { button: 'Publícalo en tu historia', headFrom: '{from} selló esto para mí', headSomeone: 'Alguien selló esto para mí',
      showFrom: 'Mostrar quién lo mandó', share: 'Compartir', save: 'Guardar imagen', close: 'Cerrar', making: 'Preparándolo' },
    pt: { button: 'Poste nos seus stories', headFrom: '{from} selou isto para mim', headSomeone: 'Alguém selou isto para mim',
      showFrom: 'Mostrar quem enviou', share: 'Compartilhar', save: 'Salvar imagem', close: 'Fechar', making: 'Preparando' },
    fr: { button: 'Publie-le en story', headFrom: '{from} a scellé ceci pour moi', headSomeone: 'Quelqu’un a scellé ceci pour moi',
      showFrom: 'Montrer qui l’a envoyé', share: 'Partager', save: 'Enregistrer l’image', close: 'Fermer', making: 'Préparation' },
    de: { button: 'In deiner Story posten', headFrom: '{from} hat das für mich versiegelt', headSomeone: 'Jemand hat das für mich versiegelt',
      showFrom: 'Zeigen, wer es geschickt hat', share: 'Teilen', save: 'Bild speichern', close: 'Schließen', making: 'Wird vorbereitet' },
    ja: { button: 'ストーリーズに投稿する', headFrom: '{from}さんから届きました', headSomeone: 'だれかから届きました',
      showFrom: '送り主の名前を表示', share: '共有', save: '画像を保存', close: '閉じる', making: '準備しています' }
  };

  var F_DISPLAY = 'Fraunces, Georgia, serif';
  var F_HAND = 'Caveat, "Bradley Hand", "Segoe Print", cursive';
  var F_BODY = 'Figtree, -apple-system, "Segoe UI", sans-serif';
  var F_MONO = '"Courier Prime", "Courier New", monospace';

  function stringsFor(lang) { return STRINGS[lang] || STRINGS.en; }
  function chars(s) { return Array.from(String(s || '')).length; }

  /* Quote size in px on a 402px-wide card, as on the pages and in the app. */
  function textSize(len) {
    if (len <= 80) return 33;
    if (len <= 160) return 27;
    if (len <= 260) return 22;
    return 18;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      '400 60px Fraunces', 'italic 400 60px Fraunces', '400 60px Caveat', '600 40px Figtree', '400 30px "Courier Prime"'
    ].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }

  /* Lines that fit maxWidth: at spaces, and anywhere in a word too long to
     fit (Japanese and Chinese have no spaces to break at). */
  function wrap(ctx, text, maxWidth) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var words = para.split(/(\s+)/), line = '';
      words.forEach(function (w) {
        if (!w) return;
        var tryLine = line + w;
        if (ctx.measureText(tryLine.trim()).width <= maxWidth || !line.trim()) {
          if (ctx.measureText(tryLine.trim()).width <= maxWidth) { line = tryLine; return; }
        } else {
          out.push(line.trim());
          line = /^\s+$/.test(w) ? '' : w;
          if (ctx.measureText(line).width <= maxWidth) return;
        }
        // Too long on its own: break it by characters.
        var cur = line.trim() ? '' : '';
        Array.from(line.trim() ? line : tryLine).forEach(function (ch) {
          if (ctx.measureText(cur + ch).width > maxWidth && cur) { out.push(cur); cur = ch; }
          else cur += ch;
        });
        line = cur;
      });
      if (line.trim() || !out.length) out.push(line.trim());
    });
    return out;
  }

  function roundRect(ctx, x, y, w, h, rx, ry) {
    ctx.beginPath();
    ctx.moveTo(x + rx, y);
    ctx.lineTo(x + w - rx, y);
    ctx.ellipse(x + w - rx, y + ry, rx, ry, 0, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - ry);
    ctx.ellipse(x + w - rx, y + h - ry, rx, ry, 0, 0, Math.PI / 2);
    ctx.lineTo(x + rx, y + h);
    ctx.ellipse(x + rx, y + h - ry, rx, ry, 0, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + ry);
    ctx.ellipse(x + rx, y + ry, rx, ry, 0, Math.PI, Math.PI * 1.5);
    ctx.closePath();
  }

  /* The sender's background over a box: a photograph cropped to cover, or
     the app's gradient (Alignment(-0.5,-1) to (0.5,1)), or a flat color. */
  function paintLook(ctx, look, photo, x, y, w, h) {
    if (photo) {
      var s = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
      var dw = photo.naturalWidth * s, dh = photo.naturalHeight * s;
      ctx.drawImage(photo, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else if (look && look.gradient) {
      var g = ctx.createLinearGradient(x + w * 0.25, y, x + w * 0.75, y + h);
      g.addColorStop(0, look.gradient[0]);
      g.addColorStop(1, look.gradient[1]);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.fillStyle = (look && look.color) || '#2b302c';
      ctx.fillRect(x, y, w, h);
    }
  }

  /* A soft copy of the look for the whole background: halved down to a
     few dozen pixels and doubled back up, a step at a time, which blurs it
     smoothly and the same in every browser. */
  function backdrop(ctx, look, photo) {
    // A real blur where the canvas has one (Chrome, Firefox, Safari 18+).
    ctx.save();
    ctx.filter = 'blur(42px)';
    if (ctx.filter === 'blur(42px)') {
      paintLook(ctx, look, photo, -120, -120, W + 240, H + 240);
      ctx.restore();
      return shade(ctx);
    }
    ctx.restore();
    var w = 270, h = 480;
    var cur = document.createElement('canvas');
    cur.width = w; cur.height = h;
    paintLook(cur.getContext('2d'), look, photo, 0, 0, w, h);
    function step(nw, nh) {
      var c = document.createElement('canvas');
      c.width = nw; c.height = nh;
      var x = c.getContext('2d');
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = 'high';
      x.drawImage(cur, 0, 0, nw, nh);
      cur = c;
    }
    while (w > 20) { w = Math.round(w / 2); h = Math.round(h / 2); step(w, h); }
    while (w * 2 < W) { w *= 2; h *= 2; step(w, h); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, -60, -100, W + 120, H + 200);
    shade(ctx);
  }

  function shade(ctx) {
    // Deep and a little navy, so the letter and the paper carry the light.
    ctx.fillStyle = 'rgba(12,16,28,0.52)';
    ctx.fillRect(0, 0, W, H);
    var v = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.18, W / 2, H * 0.5, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // The seal's two halves, cut where the page cuts them (.seal-half).
  var CUT_L = [[-0.2, -0.2], [0.53, -0.2], [0.53, 0.02], [0.46, 0.17], [0.55, 0.31], [0.45, 0.47], [0.54, 0.63], [0.47, 0.79], [0.52, 0.98], [0.52, 1.2], [-0.2, 1.2]];
  var CUT_R = [[0.53, -0.2], [1.2, -0.2], [1.2, 1.2], [0.52, 1.2], [0.52, 0.98], [0.47, 0.79], [0.54, 0.63], [0.45, 0.47], [0.55, 0.31], [0.46, 0.17], [0.53, 0.02]];

  function sealHalf(ctx, img, cut, cx, cy, size, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-size / 2, -size / 2);
    ctx.beginPath();
    cut.forEach(function (p, i) { (i ? ctx.lineTo : ctx.moveTo).call(ctx, p[0] * size, p[1] * size); });
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0, size, size);
    ctx.restore();
  }

  function tinted(img, color) {
    var c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    var x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // The same spread every time, so the picture never changes between taps.
  function rand(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  /* Writes a line that may hold a name, shrinking it to fit maxWidth. */
  function fitText(ctx, text, font, size, maxWidth, minSize) {
    var s = size;
    do { ctx.font = font.replace('{s}', s); s -= 2; } while (ctx.measureText(text).width > maxWidth && s > minSize);
    return ctx.measureText(text).width;
  }

  function render(o, showFrom) {
    var S = stringsFor(o.lang);
    return Promise.all([
      loadImage(o.look && o.look.src),
      loadImage('/img/envelope/back.webp'),
      loadImage('/img/envelope/pocket.webp'),
      loadImage('/img/envelope/flap_in.webp'),
      loadImage('/img/envelope/sparkle.webp'),
      loadImage('/icon.png'),
      window.DailiesSeal ? window.DailiesSeal.url(window.DailiesSeal.initialOf(o.from)).then(loadImage) : loadImage('/img/envelope/seal.webp'),
      loadFonts()
    ]).then(function (r) {
      var photo = r[0], back = r[1], pocket = r[2], flapIn = r[3], sparkle = r[4], icon = r[5], wax = r[6];
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');
      ctx.textBaseline = 'alphabetic';
      backdrop(ctx, o.look, photo);

      // ---- The headline: the brag.
      var head = showFrom && o.from ? S.headFrom.split('{from}').join(o.from) : S.headSomeone;
      ctx.fillStyle = '#F6EFE1';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 24;
      var headLines;
      ctx.font = '400 66px ' + F_DISPLAY;
      headLines = wrap(ctx, head, W - 200);
      if (headLines.length > 2) { ctx.font = '400 54px ' + F_DISPLAY; headLines = wrap(ctx, head, W - 200).slice(0, 2); }
      var lh = parseInt(ctx.font.match(/(\d+)px/)[1], 10) * 1.16;
      var hy = 330 - (headLines.length - 1) * lh / 2;
      headLines.forEach(function (l, i) { ctx.fillText(l, W / 2, hy + i * lh); });
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // ---- The envelope, open, with the letter standing in it.
      var EW = 760, EH = EW / 1.36;
      var ex = (W - EW) / 2;
      var cw = EW * 0.84, ch = cw * 5 / 4;
      var cx = ex + EW * 0.08;
      var cardTop = 440;
      var ey = cardTop + ch - EH * 0.50;     // the letter's foot is in the pocket
      var flapH = EW * 0.4333;

      // A warm light from inside, behind everything.
      var glow = ctx.createRadialGradient(W / 2, ey + EH * 0.1, 10, W / 2, ey, EW * 0.85);
      glow.addColorStop(0, 'rgba(255,226,168,0.42)');
      glow.addColorStop(0.5, 'rgba(255,184,102,0.14)');
      glow.addColorStop(1, 'rgba(255,154,64,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, ey - EW, W, EW * 2);

      // Ground shadow.
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 70;
      ctx.shadowOffsetY = 40;
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      ctx.fillRect(ex + 20, ey + 20, EW - 40, EH - 30);
      ctx.restore();

      if (back) ctx.drawImage(back, ex, ey, EW, EH);
      // The open flap: its inside, hinged on the top edge, pointing up.
      if (flapIn) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.scale(1, -1);
        ctx.drawImage(flapIn, 0, 0, EW, flapH);
        ctx.restore();
      }

      // The letter.
      var rx = cw * 0.052, ry = ch * 0.0416;
      ctx.save();
      ctx.shadowColor = 'rgba(30,20,10,0.35)';
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = -2;
      roundRect(ctx, cx, cardTop, cw, ch, rx, ry);
      ctx.fillStyle = '#2b302c';
      ctx.fill();
      ctx.restore();
      ctx.save();
      roundRect(ctx, cx, cardTop, cw, ch, rx, ry);
      ctx.clip();
      paintLook(ctx, o.look, photo, cx, cardTop, cw, ch);
      var sc = ctx.createRadialGradient(cx + cw / 2, cardTop + ch / 2, 0, cx + cw / 2, cardTop + ch / 2, ch * 0.62);
      sc.addColorStop(0, 'rgba(10,12,10,0.55)');
      sc.addColorStop(1, 'rgba(10,12,10,0.32)');
      ctx.fillStyle = sc;
      ctx.fillRect(cx, cardTop, cw, ch);

      // The line, as the page sets it, shrunk if it would not fit.
      var fs = textSize(chars(o.text)) * cw / 402;
      var pad = cw * 0.07, lines, lineH, authorH = o.author ? fs * 0.55 + cw * 0.03 : 0;
      for (var tries = 0; tries < 12; tries++) {
        ctx.font = '400 ' + fs.toFixed(1) + 'px ' + F_DISPLAY;
        lines = wrap(ctx, o.text, cw - pad * 2);
        lineH = fs * 1.24;
        if (lines.length * lineH + authorH <= ch * 0.78) break;
        fs *= 0.92;
      }
      var block = lines.length * lineH + authorH;
      // Centered in the part of the letter that stands out of the pocket.
      var visible = ey + EH * 0.3 - cardTop;
      var ty = cardTop + Math.max(pad, (Math.min(ch, visible) - block) / 2) + fs * 0.95;
      ctx.fillStyle = '#F6EFE1';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 16;
      lines.forEach(function (l, i) { ctx.fillText(l, cx + cw / 2, ty + i * lineH); });
      if (o.author) {
        ctx.font = '400 ' + Math.max(22, fs * 0.42).toFixed(1) + 'px ' + F_MONO;
        ctx.fillStyle = 'rgba(246,239,225,0.82)';
        ctx.fillText('- ' + o.author, cx + cw / 2, ty + (lines.length - 1) * lineH + cw * 0.03 + fs * 0.6);
      }
      ctx.restore();

      // The pocket over the letter's foot, and their name on it.
      if (pocket) ctx.drawImage(pocket, ex, ey, EW, EH);
      var forText = (o.forName || 'For {to}').split('{to}').join(o.to);
      ctx.fillStyle = '#1F2A44';
      ctx.textAlign = 'center';
      fitText(ctx, forText, '400 {s}px ' + F_HAND, Math.round(EW * 0.095), EW * 0.84, 30);
      ctx.fillText(forText, W / 2, ey + EH * 0.785 + EW * 0.03);

      // The broken wax, its two halves fallen by the corner.
      if (wax) {
        var ws = EW * 0.22;
        sealHalf(ctx, wax, CUT_L, ex + EW * 0.87, ey + EH * 0.97, ws, -0.32);
        sealHalf(ctx, wax, CUT_R, ex + EW * 0.96, ey + EH * 0.91, ws, 0.24);
      }

      // Sparkles round the letter.
      if (sparkle) {
        var gold = tinted(sparkle, '#FFD98A'), rnd = rand(7);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var k = 0; k < 16; k++) {
          var side = rnd() < 0.5 ? -1 : 1;
          var px = W / 2 + side * (cw * 0.42 + rnd() * cw * 0.22);
          var py = cardTop - 40 + rnd() * (ch * 0.9);
          var sz = 26 + rnd() * 46;
          ctx.globalAlpha = 0.45 + rnd() * 0.55;
          ctx.drawImage(gold, px - sz / 2, py - sz / 2, sz, sz);
        }
        for (k = 0; k < 6; k++) {
          var qx = cx + rnd() * cw, qy = cardTop - 70 + rnd() * 60, qs = 30 + rnd() * 50;
          ctx.globalAlpha = 0.6 + rnd() * 0.4;
          ctx.drawImage(gold, qx - qs / 2, qy - qs / 2, qs, qs);
        }
        ctx.restore();
      }

      // ---- Where it came from.
      var by = Math.min(H - 300, ey + EH + 86);
      ctx.font = '600 34px ' + F_BODY;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(246,239,225,0.92)';
      var label = 'mydailies.app';
      var lw = ctx.measureText(label).width, isz = 52, gap = 16;
      var bx = (W - (isz + gap + lw)) / 2;
      if (icon) {
        ctx.save();
        roundRect(ctx, bx, by - isz + 12, isz, isz, isz * 0.23, isz * 0.23);
        ctx.clip();
        ctx.drawImage(icon, bx, by - isz + 12, isz, isz);
        ctx.restore();
      } else { bx -= (isz + gap) / 2; }
      ctx.fillText(label, bx + isz + gap, by);
      return cv;
    });
  }

  function toBlob(cv) {
    return new Promise(function (resolve) {
      // JPEG: a photograph-backed picture, so a quarter of a PNG's size,
      // and much quicker to encode on a phone.
      if (cv.toBlob) cv.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.92);
      else {
        var d = atob(cv.toDataURL('image/jpeg', 0.92).split(',')[1]), u = new Uint8Array(d.length);
        for (var i = 0; i < d.length; i++) u[i] = d.charCodeAt(i);
        resolve(new Blob([u], { type: 'image/jpeg' }));
      }
    });
  }

  /* ----------------------------------------------------- the preview sheet */

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  var current = null;

  function open(o) {
    if (current) return;
    var S = stringsFor(o.lang);
    var ev = o.onEvent || function () {};
    var showFrom = true;
    var file = null, objectUrl = null, gen = 0;

    var wrapEl = h('div', 'st-wrap');
    wrapEl.setAttribute('role', 'dialog');
    wrapEl.setAttribute('aria-modal', 'true');
    wrapEl.setAttribute('aria-label', S.button);
    var x = h('button', 'st-x');
    x.type = 'button';
    x.setAttribute('aria-label', S.close);
    x.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    var frame = h('div', 'st-frame');
    var img = h('img', 'st-img');
    img.alt = '';
    var wait = h('p', 'st-wait', S.making);
    frame.appendChild(img);
    frame.appendChild(wait);

    var row = h('label', 'st-toggle');
    var cb = h('input');
    cb.type = 'checkbox';
    cb.checked = true;
    var sw = h('span', 'st-switch');
    row.appendChild(cb);
    row.appendChild(sw);
    row.appendChild(h('span', 'st-toggle-label', S.showFrom));
    // No sender's name on the envelope: nothing to show or hide.
    if (!o.from) { row.hidden = true; showFrom = false; }

    var canShareFiles = false;
    try {
      canShareFiles = !!(navigator.canShare && navigator.share &&
        navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/jpeg' })], 'x.jpg', { type: 'image/jpeg' })] }));
    } catch (e) {}
    var go = h(canShareFiles ? 'button' : 'a', 'btn btn-primary btn-big st-go', canShareFiles ? S.share : S.save);
    if (canShareFiles) go.type = 'button';
    go.setAttribute('aria-disabled', 'true');

    var actions = h('div', 'st-actions');
    actions.appendChild(row);
    actions.appendChild(go);
    wrapEl.appendChild(x);
    wrapEl.appendChild(frame);
    wrapEl.appendChild(actions);
    document.body.appendChild(wrapEl);
    document.documentElement.classList.add('st-open');
    requestAnimationFrame(function () { wrapEl.classList.add('is-in'); });

    function draw() {
      var mine = ++gen;
      frame.classList.add('is-making');
      go.setAttribute('aria-disabled', 'true');
      render(o, showFrom).then(toBlob).then(function (blob) {
        if (mine !== gen || !blob) return;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        file = new File([blob], 'dailies-envelope.jpg', { type: 'image/jpeg' });
        img.src = objectUrl;
        if (!canShareFiles) { go.href = objectUrl; go.download = 'dailies-envelope.jpg'; }
        frame.classList.remove('is-making');
        go.removeAttribute('aria-disabled');
      });
    }

    cb.addEventListener('change', function () { showFrom = cb.checked; draw(); });

    go.addEventListener('click', function (e) {
      if (go.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
      if (!canShareFiles) { ev('story_shared', { destination: 'download', from_shown: showFrom }); return; }
      // Straight from the tap: Safari only opens the sheet inside one.
      navigator.share({ files: [file] }).then(function () {
        ev('story_shared', { destination: 'share', from_shown: showFrom });
      }, function () {});
    });

    function close() {
      if (!current) return;
      current = null;
      gen++;
      wrapEl.classList.remove('is-in');
      document.documentElement.classList.remove('st-open');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () {
        wrapEl.remove();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }, 260);
      ev('story_closed', { from_shown: showFrom });
      if (o.returnFocus && o.returnFocus.focus) o.returnFocus.focus();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    x.addEventListener('click', close);
    wrapEl.addEventListener('click', function (e) { if (e.target === wrapEl) close(); });
    document.addEventListener('keydown', onKey);

    current = { close: close };
    ev('story_opened', {});
    draw();
    setTimeout(function () { x.focus(); }, 50);
  }

  /* The button for the page, already labelled; the page places it.
     o.className styles it like the page's own buttons. */
  function button(o) {
    var S = stringsFor(o.lang);
    var b = h('button', o.className || 'btn btn-ghost st-cta');
    b.type = 'button';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="3.2"/><circle cx="12" cy="11" r="3.2"/><path d="M9.5 18h5"/></svg>';
    b.appendChild(h('span', null, S.button));
    b.addEventListener('click', function () {
      var opts = typeof o.get === 'function' ? o.get() : o;
      opts.returnFocus = b;
      open(opts);
    });
    return b;
  }

  window.DailiesStory = { open: open, button: button, render: render, STRINGS: STRINGS };
})();
