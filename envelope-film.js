/* ============================================================================
   Film yourself opening it.

   On /sealed/, before opening an envelope, the receiver can turn the front
   camera on. The page records them, with the same opening drawn under
   their face, from the moment they turn it on until a few seconds after
   they have read the letter (or they tap Done). Then they can send it to
   whoever sealed it, post it, or delete it.

   Nothing leaves the phone. The video is drawn on a canvas here and
   recorded here (MediaRecorder: MP4 in Safari and recent Chrome), and only
   goes anywhere through the share sheet. A small picture of the receiver
   with a red dot stays on screen the whole time the camera is on, and the
   camera stops as soon as the recording does.

   The opening is drawn from the same pictures as the page (img/envelope/),
   timed like sealed.js openEnvelope(), so the video shows the opening they
   saw, with a soft sound made here: a crack, paper, a shimmer, a twinkle.

     DailiesFilm.canFilm()     whether this browser can film the receiver
     DailiesFilm.film(o)       { arm(), opened(), stop(), cancel(), active() }

   o: {
     to, from, text, author,      the envelope, names and line as shown
     look,                        {src} | {gradient:[a,b]} | {color}
     lang,                        'en', 'es', 'pt', 'fr', 'de' or 'ja'
     forName,                     the envelope's "For {to}" template
     note,                        the short line under the name, or null
     postmark,                    "No. 3", or null for a first envelope
     stamp,                       the page's stamp <svg>, or null
     onEvent(action, props),      film_* (see analytics.js)
     onDone()                     the receiver is finished with it
   }

   Needs /envelope-seal.js for the wax, and /envelope-film.css.
   ========================================================================= */
(function () {
  'use strict';

  var W = 1080, H = 1920;

  var STRINGS = {
    en: { save: 'Save video', close: 'Close',
      film: 'Film yourself opening it', filmHint: 'Recording. Open it when you’re ready.',
      filmPrivate: 'Only you have this video until you share it.', filmDone: 'Done', filmCancel: 'Stop filming',
      filmNoCamera: 'The camera didn’t start, so it opens without filming.', recording: 'Recording',
      reaction: 'Your reaction', sendTo: 'Send it to {from}', sendIt: 'Send it', toStory: 'Post it to your Story',
      del: 'Delete', soundOn: 'Turn the sound on', soundOff: 'Turn the sound off' },
    es: { save: 'Guardar video', close: 'Cerrar',
      film: 'Grábate al abrirlo', filmHint: 'Grabando. Ábrelo cuando quieras.',
      filmPrivate: 'Solo tú tienes este video hasta que lo compartas.', filmDone: 'Listo', filmCancel: 'Dejar de grabar',
      filmNoCamera: 'La cámara no se encendió, así que se abre sin grabar.', recording: 'Grabando',
      reaction: 'Tu reacción', sendTo: 'Envíaselo a {from}', sendIt: 'Envíalo', toStory: 'Publícalo en tu historia',
      del: 'Borrar', soundOn: 'Activar el sonido', soundOff: 'Silenciar' },
    pt: { save: 'Salvar vídeo', close: 'Fechar',
      film: 'Grave você abrindo', filmHint: 'Gravando. Abra quando quiser.',
      filmPrivate: 'Só você tem este vídeo até compartilhar.', filmDone: 'Pronto', filmCancel: 'Parar de gravar',
      filmNoCamera: 'A câmera não ligou, então ele abre sem gravar.', recording: 'Gravando',
      reaction: 'Sua reação', sendTo: 'Envie para {from}', sendIt: 'Enviar', toStory: 'Poste nos seus stories',
      del: 'Apagar', soundOn: 'Ativar o som', soundOff: 'Desativar o som' },
    fr: { save: 'Enregistrer la vidéo', close: 'Fermer',
      film: 'Filme-toi en l’ouvrant', filmHint: 'Ça tourne. Ouvre-la quand tu veux.',
      filmPrivate: 'Cette vidéo reste sur ton téléphone tant que tu ne la partages pas.', filmDone: 'Terminé', filmCancel: 'Arrêter de filmer',
      filmNoCamera: 'La caméra ne s’est pas lancée, l’enveloppe s’ouvre donc sans filmer.', recording: 'Enregistrement',
      reaction: 'Ta réaction', sendTo: 'Envoie-la à {from}', sendIt: 'Envoie-la', toStory: 'Publie-la en story',
      del: 'Supprimer', soundOn: 'Activer le son', soundOff: 'Couper le son' },
    de: { save: 'Video speichern', close: 'Schließen',
      film: 'Film dich beim Öffnen', filmHint: 'Die Aufnahme läuft. Öffne ihn, wenn du so weit bist.',
      filmPrivate: 'Nur du hast dieses Video, bis du es teilst.', filmDone: 'Fertig', filmCancel: 'Aufnahme beenden',
      filmNoCamera: 'Die Kamera ist nicht angegangen, also öffnet er sich ohne Aufnahme.', recording: 'Aufnahme läuft',
      reaction: 'Deine Reaktion', sendTo: 'An {from} schicken', sendIt: 'Schicken', toStory: 'In deiner Story posten',
      del: 'Löschen', soundOn: 'Ton an', soundOff: 'Ton aus' },
    ja: { save: '動画を保存', close: '閉じる',
      film: '開ける瞬間を撮影する', filmHint: '撮影中です。準備ができたら開けてください。',
      filmPrivate: 'この動画は、共有するまであなたの手元にだけあります。', filmDone: '完了', filmCancel: '撮影をやめる',
      filmNoCamera: 'カメラを起動できなかったため、撮影せずに開きます。', recording: '撮影中',
      reaction: 'あなたのリアクション', sendTo: '{from}さんに送る', sendIt: '送る', toStory: 'ストーリーズに投稿する',
      del: '削除', soundOn: '音をオンにする', soundOff: '音をオフにする' }
  };

  var F_DISPLAY = 'Fraunces, Georgia, serif';
  var F_HAND = 'Caveat, "Bradley Hand", "Segoe Print", cursive';
  var F_BODY = 'Figtree, -apple-system, "Segoe UI", sans-serif';
  var F_MONO = '"Courier Prime", "Courier New", monospace';
  var INK = '#1F2A44', CREAM = '#F6EFE1';

  /* The opening, in seconds: sealed.js openEnvelope() step by step. The
     video sits at 1.0 (sealed, floating) until the tap, which is the crack;
     `end` is the reading time after it. */
  var T = {
    crack: 1.5,                  // the seal breaks
    flap: 1.7, flapEnd: 2.12,    // the flap lifts (200ms later, 420ms)
    rise: 2.12, riseEnd: 2.68,   // the letter rises (560ms)
    drop: 2.26, dropEnd: 2.74,   // the envelope drops away (140ms later, 480ms)
    glide: 2.8, glideEnd: 3.32,  // the letter becomes the card (520ms)
    end: 8.0
  };

  function stringsFor(lang) { return STRINGS[lang] || STRINGS.en; }
  function chars(s) { return Array.from(String(s || '')).length; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function easeIn(p) { return p * p * p; }
  function easeInOut(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  var RTL = /^[^A-Za-zÀ-ɏͰ-ϿЀ-ӿ぀-ヿ一-鿿]*[֐-ࣿ]/;

  /* Quote size in px on a 402px-wide card, as on the pages and in the app. */
  function textSize(len) {
    if (len <= 80) return 33;
    if (len <= 160) return 27;
    if (len <= 260) return 22;
    return 18;
  }

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
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

  /* The page's own stamp, drawn from its <svg> (every attribute is inline). */
  function svgImage(el) {
    if (!el || !window.XMLSerializer) return Promise.resolve(null);
    try {
      var c = el.cloneNode(true);
      var vb = (c.getAttribute('viewBox') || '0 0 100 122').split(/\s+/).map(Number);
      c.setAttribute('width', String(vb[2] * 4));
      c.setAttribute('height', String(vb[3] * 4));
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c)));
    } catch (e) { return Promise.resolve(null); }
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      '400 60px Fraunces', '400 60px Caveat', '600 40px Figtree', '400 30px "Courier Prime"'
    ].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }

  /* Lines that fit maxWidth: at spaces, and anywhere in a word too long to
     fit (Japanese and Chinese have no spaces to break at). */
  function wrap(ctx, text, maxWidth) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var line = '';
      para.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        var next = line + w;
        if (ctx.measureText(next.trim()).width <= maxWidth) { line = next; return; }
        if (line.trim()) { out.push(line.trim()); line = /^\s+$/.test(w) ? '' : w; }
        else line = next;
        if (ctx.measureText(line).width <= maxWidth) return;
        // Too long on its own: break it by characters.
        var cur = '';
        Array.from(line).forEach(function (ch) {
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

  /* The sender's background over a box: a photograph cropped to cover (its
     focus a third of the way down, as the page's object-position), the
     app's gradient (Alignment(-0.5,-1) to (0.5,1)), or a flat color. */
  function paintLook(ctx, look, photo, x, y, w, h) {
    if (photo) {
      var s = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
      var dw = photo.naturalWidth * s, dh = photo.naturalHeight * s;
      ctx.drawImage(photo, x + (w - dw) / 2, y + (h - dh) * 0.34, dw, dh);
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

  function tinted(img, color) {
    var c = canvas(img.naturalWidth, img.naturalHeight);
    var x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // The same spread every time, so a video never changes between takes.
  function rand(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  /* Sets a font that fits maxWidth, from size down to minSize. */
  function fitFont(ctx, text, font, size, maxWidth, minSize) {
    var s = size;
    do { ctx.font = font.replace('{s}', s.toFixed(1)); s -= 1; } while (ctx.measureText(text).width > maxWidth && s > minSize);
  }

  /* ---------------------------------------------------------------- pieces */

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

  /* The card with the line on it, as the page sets it (.qc), with its
     shadow, on a canvas with room round it for the shadow. */
  function cardCanvas(A, o, w) {
    var h = w * 1.25, m = Math.round(w * 0.16);
    var c = canvas(w + m * 2, h + m * 2), x = c.getContext('2d');
    var rx = w * 0.052, ry = h * 0.0416;
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.6)';
    x.shadowBlur = w * 0.1;
    x.shadowOffsetY = w * 0.05;
    roundRect(x, m, m, w, h, rx, ry);
    x.fillStyle = '#3a3a33';
    x.fill();
    x.restore();
    x.save();
    roundRect(x, m, m, w, h, rx, ry);
    x.clip();
    paintLook(x, o.look, A.photo, m, m, w, h);
    var fs0 = textSize(chars(o.text));
    var kind = A.photo ? 'photo' : (o.look && o.look.gradient ? 'grad' : 'flat');
    var stops = kind === 'grad' ? [[0, 0.23], [0.35, 0.15], [1, 0.63]]
      : kind === 'flat' ? [[0, 0.37], [0.35, 0.29], [1, 0.77]]
      : fs0 === 22 ? [[0.08, 0.05], [0.34, 0.42], [0.6, 0.74], [1, 0.88]]
      : fs0 === 18 ? [[0, 0.18], [0.22, 0.6], [0.5, 0.8], [1, 0.9]]
      : [[0, 0.28], [0.4, 0.48], [1, 0.6]];
    var g = x.createLinearGradient(0, m, 0, m + h);
    stops.forEach(function (s) { g.addColorStop(s[0], (kind === 'photo' ? 'rgba(10,12,10,' : 'rgba(0,0,0,') + s[1] + ')'); });
    x.fillStyle = g;
    x.fillRect(m, m, w, h);

    // The line: Fraunces, 1.22 apart, white, in the middle of the card.
    var u = w / 402, padX = w * 0.08, padT = w * 0.08, padB = w * 0.064;
    var fs = fs0 * u, lines, lh;
    var byFs = 13.5 * u, byH = o.author ? w * 0.036 + byFs * 1.3 : 0;
    for (var tries = 0; tries < 14; tries++) {
      x.font = '400 ' + fs.toFixed(1) + 'px ' + F_DISPLAY;
      lines = wrap(x, o.text, w - padX * 2);
      lh = fs * 1.22;
      if (lines.length * lh + byH <= h - padT - padB) break;
      fs *= 0.93;
    }
    var rtl = RTL.test(o.text);
    var tx = rtl ? m + w - padX : m + padX;
    x.textAlign = rtl ? 'right' : 'left';
    x.textBaseline = 'alphabetic';
    var top = m + padT + (h - padT - padB - (lines.length * lh + byH)) / 2;
    x.fillStyle = CREAM;
    x.shadowColor = 'rgba(0,0,0,0.5)';
    x.shadowBlur = 20 * u;
    lines.forEach(function (l, i) { x.fillText(l, tx, top + i * lh + fs * 0.98); });
    if (o.author) {
      x.shadowBlur = 0;
      x.font = '400 ' + byFs.toFixed(1) + 'px ' + F_MONO;
      x.fillStyle = 'rgba(246,239,225,0.8)';
      var by = '- ' + o.author;
      x.textAlign = RTL.test(o.author) ? 'right' : x.textAlign;
      x.fillText(by, x.textAlign === 'right' ? m + w - padX : m + padX, top + lines.length * lh + w * 0.036 + byFs);
    }
    x.restore();
    return { c: c, m: m, w: w, h: h };
  }

  /* What is written and stuck on the front of the envelope: the name, the
     short line under it, the stamp and the postmark (.env-front). */
  function frontCanvas(A, o, EW) {
    var EH = EW / 1.36;
    var c = canvas(EW, EH), x = c.getContext('2d');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    if (A.stamp) {
      var sw = EW * 0.135, sh = sw * 1.22;
      x.save();
      x.translate(EW * (1 - 0.065) - sw / 2, EH * 0.075 + sh / 2);
      x.rotate(4 * Math.PI / 180);
      x.shadowColor = 'rgba(0,0,0,0.24)';
      x.shadowBlur = EW * 0.004;
      x.shadowOffsetY = EW * 0.0035;
      x.drawImage(A.stamp, -sw / 2, -sh / 2, sw, sh);
      x.restore();
    }
    if (o.postmark && window.Path2D) {
      var pw = EW * 0.303, s = pw / 150;
      x.save();
      x.translate(EW * 0.555 + pw * 0.7867, EH * 0.2 + 32 * s);
      x.rotate(-11.5 * Math.PI / 180);
      x.translate(-pw * 0.7867, -32 * s);
      x.scale(s, s);
      x.globalCompositeOperation = 'multiply';
      x.strokeStyle = '#9C3B2A';
      x.lineCap = 'round';
      x.globalAlpha = 0.45;
      x.lineWidth = 1.8;
      [23, 32, 41].forEach(function (yy) {
        x.stroke(new Path2D('M82 ' + yy + ' q-4.5 -4.5 -9 0 t-9 0 t-9 0 t-9 0 t-9 0 t-9 0 t-9 0 t-9 0'));
      });
      x.globalAlpha = 0.6;
      x.lineWidth = 2.1;
      x.beginPath(); x.arc(118, 32, 30, 0, Math.PI * 2); x.stroke();
      x.lineWidth = 1.2;
      x.beginPath(); x.arc(118, 32, 24.75, 0, Math.PI * 2); x.stroke();
      x.globalAlpha = 0.78;
      x.fillStyle = '#9C3B2A';
      x.font = '700 13.5px ' + F_BODY;
      x.textBaseline = 'alphabetic';
      x.fillText(o.postmark, 118, 36.7);
      x.restore();
      x.textBaseline = 'middle';
    }
    var forText = (o.forName || 'For {to}').split('{to}').join(o.to || '');
    x.fillStyle = INK;
    fitFont(x, forText, '400 {s}px ' + F_HAND, EW * 0.095, EW * 0.86, EW * 0.05);
    x.fillText(forText, EW / 2, EH * 0.785);
    if (o.note) {
      x.fillStyle = 'rgba(31,42,68,0.82)';
      fitFont(x, o.note, '400 {s}px ' + F_HAND, EW * 0.06, EW * 0.86, EW * 0.036);
      x.fillText(o.note, EW / 2, EH * 0.905);
    }
    return c;
  }

  /* The sender's background, blurred and darkened, for behind the envelope. */
  function backdropCanvas(A, o, w, h) {
    var c = canvas(w, h), x = c.getContext('2d');
    x.filter = 'blur(42px)';
    if (x.filter === 'blur(42px)') {
      paintLook(x, o.look, A.photo, -120, -120, w + 240, h + 240);
      x.filter = 'none';
    } else {
      // No canvas blur (older Safari): halve it down and double it back up.
      var sw = 27, sh = Math.round(27 * h / w), small = canvas(sw, sh);
      paintLook(small.getContext('2d'), o.look, A.photo, 0, 0, sw, sh);
      var cur = small;
      while (cur.width * 2 < w) {
        var next = canvas(cur.width * 2, cur.height * 2), nx = next.getContext('2d');
        nx.imageSmoothingQuality = 'high';
        nx.drawImage(cur, 0, 0, next.width, next.height);
        cur = next;
      }
      x.imageSmoothingQuality = 'high';
      x.drawImage(cur, -40, -40, w + 80, h + 80);
    }
    // Deep and a little navy, so the letter and the paper carry the light.
    x.fillStyle = 'rgba(12,16,28,0.55)';
    x.fillRect(0, 0, w, h);
    var v = x.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.2, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = v;
    x.fillRect(0, 0, w, h);
    return c;
  }

  function loadAssets(o) {
    var Seal = window.DailiesSeal;
    return Promise.all([
      loadImage(o.look && o.look.src),
      loadImage('/img/envelope/back.webp'),
      loadImage('/img/envelope/pocket.webp'),
      loadImage('/img/envelope/flap_out.webp'),
      loadImage('/img/envelope/flap_in.webp'),
      loadImage('/img/envelope/sparkle.webp'),
      loadImage('/icon.png'),
      (Seal ? Seal.url(Seal.initialOf(o.from)) : Promise.resolve('/img/envelope/seal.webp')).then(loadImage),
      svgImage(o.stamp),
      loadFonts()
    ]).then(function (r) {
      return {
        photo: r[0], back: r[1], pocket: r[2], flapOut: r[3], flapIn: r[4],
        gold: r[5] ? tinted(r[5], '#FFD48A') : null, ember: r[5] ? tinted(r[5], '#FF9A5C') : null,
        icon: r[6], wax: r[7], stamp: r[8]
      };
    });
  }

  /* ----------------------------------------------------------------- layout */

  /* Where everything goes, on a 1080x1920 frame. The receiver's face fills
     the frame's full width, 1440 tall (a phone's front camera is 3:4, so
     all of it); the opening is drawn over the lower part, its background
     fading in from `fade` so the face carries on behind it. */
  var LAYOUT = { y0: 860, fade: 380, y1: H, EW: 680, cy: 1470, cardW: 480, cardY: 1340, face: [0, 0, W, 1440], brand: [36, 260] };

  /* ------------------------------------------------------------------ scene */

  function makeScene(A, o, L) {
    var EW = L.EW, EH = EW / 1.36, k = EW / 420, cx = W / 2;
    var bg = backdropCanvas(A, o, W, L.y1 - L.y0);
    if (L.fade) {
      // Clear at the top, so the face shows through, solid by `fade`.
      var bx = bg.getContext('2d'), fg = bx.createLinearGradient(0, 0, 0, L.fade);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(1, 'rgba(0,0,0,1)');
      bx.globalCompositeOperation = 'destination-in';
      bx.fillStyle = fg;
      // All of it: destination-in clears whatever the fill does not cover.
      bx.fillRect(0, 0, W, bg.height);
      bx.globalCompositeOperation = 'source-over';
    }
    var front = frontCanvas(A, o, EW);
    var card = cardCanvas(A, o, L.cardW);
    var flapH = EH * 0.5893;
    var cw = EW * 0.84, ch = cw * 1.25;
    var sealSize = EW * 0.24;
    var parts = particles(L, EW, EH, k);

    function draw(ctx, t, now) {
      ctx.drawImage(bg, 0, L.y0);

      // Floating while it waits, as on the page; still from the crack.
      var still = seg(t, T.crack - 0.25, T.crack);
      var fl = (1 - still) * Math.sin(now / 1000 * Math.PI * 2 / 6.5) * 7 * k;
      var ex = cx - EW / 2, ey = L.cy - EH / 2 + fl;
      var pd = easeIn(seg(t, T.drop, T.dropEnd)), bodyDy = 90 * k * pd, bodyA = 1 - pd;

      ctx.save();

      // The ground shadow under it.
      if (bodyA > 0) {
        ctx.save();
        ctx.globalAlpha = bodyA * 0.5;
        var gr = ctx.createRadialGradient(cx, ey + EH * 1.08 + bodyDy, 0, cx, ey + EH * 1.08 + bodyDy, EW * 0.42);
        gr.addColorStop(0, 'rgba(0,0,0,0.9)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.translate(0, ey + EH * 1.08 + bodyDy);
        ctx.scale(1, 0.14);
        ctx.translate(0, -(ey + EH * 1.08 + bodyDy));
        ctx.fillStyle = gr;
        ctx.fillRect(cx - EW * 0.45, ey + EH * 1.08 + bodyDy - EW * 0.45, EW * 0.9, EW * 0.9);
        ctx.restore();
      }

      // Light from inside, as the letter rises; after, a softer one stays
      // behind the card.
      var gl = Math.max(
        seg(t, T.rise, T.rise + 0.38) * (1 - seg(t, T.rise + 0.38, T.rise + 1.1)),
        0.45 * seg(t, T.glide, T.glideEnd + 0.6));
      if (gl > 0) {
        var gy = t < T.glide ? ey + EH * 0.04 : lerp(ey + EH * 0.04, L.cardY, easeOut(seg(t, T.glide, T.glideEnd)));
        ctx.save();
        ctx.globalAlpha = gl;
        ctx.translate(cx, gy);
        ctx.scale(1, 0.7);
        var gg = ctx.createRadialGradient(0, 0, 0, 0, 0, EW * 0.85);
        gg.addColorStop(0, 'rgba(255,226,168,0.8)');
        gg.addColorStop(0.45, 'rgba(255,184,102,0.33)');
        gg.addColorStop(1, 'rgba(255,154,64,0)');
        ctx.fillStyle = gg;
        ctx.fillRect(-EW, -EW, EW * 2, EW * 2);
        ctx.restore();
      }

      // The back of the envelope.
      if (bodyA > 0 && A.back) {
        ctx.save();
        ctx.globalAlpha = bodyA;
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = EW * 0.085;
        ctx.shadowOffsetY = EW * 0.05;
        ctx.drawImage(A.back, ex, ey + bodyDy, EW, EH);
        ctx.restore();
      }

      // The flap. Upright it turns from outside to inside; open, it lies
      // behind the letter and drops away with the envelope.
      var fp = easeInOut(seg(t, T.flap, T.flapEnd));
      var cosA = Math.cos(fp * Math.PI);
      function drawFlap() {
        var img = cosA >= 0 ? A.flapOut : A.flapIn;
        if (!img) return;
        var fh = flapH * Math.abs(cosA);
        if (fh < 0.5) return;
        var fdy = t > T.drop ? 40 * k * pd : 0;
        ctx.save();
        ctx.globalAlpha = (t > T.drop ? bodyA : 1);
        if (cosA >= 0) ctx.drawImage(img, ex, ey + fdy, EW, fh);
        else {
          ctx.translate(ex, ey + fdy);
          ctx.scale(1, -1);
          ctx.drawImage(img, 0, 0, EW, fh);
        }
        ctx.restore();
      }
      var flapBehind = t >= T.flapEnd;
      if (flapBehind) drawFlap();

      // The letter, rising out of the envelope, then gliding to be the card.
      var lx = ex + EW * 0.08, ly = ey + EH * 0.06 - easeOut(seg(t, T.rise, T.riseEnd)) * ch * 0.46;
      var gp = easeOut(seg(t, T.glide, T.glideEnd));
      var fw = card.w, fx = cx - fw / 2, fy = L.cardY - card.h / 2;
      var rw = lerp(cw, fw, gp), rxx = lerp(lx, fx, gp), ryy = lerp(ly, fy, gp);
      var sc = rw / card.w;
      ctx.save();
      if (t < T.glide) {
        ctx.beginPath();
        ctx.rect(ex, -H, EW, ey + EH + H);
        ctx.clip();
      }
      ctx.drawImage(card.c, rxx - card.m * sc, ryy - card.m * sc, card.c.width * sc, card.c.height * sc);
      ctx.restore();

      // The pocket over the letter's foot.
      if (bodyA > 0 && A.pocket) {
        ctx.save();
        ctx.globalAlpha = bodyA;
        ctx.drawImage(A.pocket, ex, ey + bodyDy, EW, EH);
        ctx.restore();
      }
      if (!flapBehind) drawFlap();

      // The wax: pressed a little, as a hold presses it, then broken.
      if (A.wax) {
        var sx = cx, sy = ey + EH / 2;
        if (t < T.crack) {
          var press = easeOut(seg(t, T.crack - 0.5, T.crack - 0.05));
          var ss = sealSize * (1 - 0.07 * press);
          ctx.save();
                    ctx.drawImage(A.wax, sx - ss / 2, sy - ss / 2, ss, ss);
          ctx.restore();
        } else if (t < T.crack + 0.62) {
          var e = Math.pow(seg(t, T.crack, T.crack + 0.62), 2);
          var a = e < 0.22 ? 1 : 1 - (e - 0.22) / 0.78;
          function key(k0, k1) { return e < 0.22 ? lerp(0, k0, e / 0.22) : lerp(k0, k1, (e - 0.22) / 0.78); }
          ctx.save();
          ctx.globalAlpha = a;
          sealHalf(ctx, A.wax, CUT_L, sx + key(-0.05, -0.38) * sealSize, sy + key(0.01, 1.6) * sealSize, sealSize, key(-7, -38) * Math.PI / 180);
          sealHalf(ctx, A.wax, CUT_R, sx + key(0.05, 0.34) * sealSize, sy + key(0, 1.5) * sealSize, sealSize, key(6, 32) * Math.PI / 180);
          ctx.restore();
        }
      }

      // The name, stamp and postmark.
      if (bodyA > 0) {
        ctx.save();
        ctx.globalAlpha = bodyA;
        ctx.drawImage(front, ex, ey + bodyDy, EW, EH);
        ctx.restore();
      }
      ctx.restore();

      drawParticles(ctx, parts, t, A, ey - (L.cy - EH / 2));

      // Where it came from.
      brand(ctx, A, L);
    }

    return { draw: draw };
  }

  /* Where it came from: a pill over the face, just below the strip at the
     top that Instagram covers in a Story. */
  function brand(ctx, A, L) {
    var label = 'mydailies.app';
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '600 28px ' + F_BODY;
    var isz = 40, gap = 12, lw = ctx.measureText(label).width, pw = 16 + isz + gap + lw + 22, ph = 60;
    var px = L.brand[0], py = L.brand[1];
    roundRect(ctx, px, py, pw, ph, ph / 2, ph / 2);
    ctx.fillStyle = 'rgba(12,16,28,0.55)';
    ctx.fill();
    if (A.icon) {
      ctx.save();
      roundRect(ctx, px + 12, py + 10, isz, isz, isz * 0.23, isz * 0.23);
      ctx.clip();
      ctx.drawImage(A.icon, px + 12, py + 10, isz, isz);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(246,239,225,0.95)';
    ctx.fillText(label, px + 12 + isz + gap, py + ph / 2 + 1);
    ctx.restore();
  }

  /* ------------------------------------------------------------- sparkles */
  /* The page's star flare, thrown and drifted as sealed.js throws it: a
     burst when the seal breaks, dust as the letter rises, a twinkle when it
     lands, then a few drifting while it is read. Worked out from the time,
     not stepped, so every frame is the same in every take. */

  function particles(L, EW, EH, k) {
    var rnd = rand(11), ps = [], cx = W / 2, top = L.cy - EH / 2;
    function add(t0, x, y, vx, vy, life, size, ember, rise) {
      ps.push({ t0: t0, x: x, y: y, vx: vx, vy: vy, life: life, size: size, ember: ember, rise: rise,
        rot: rnd() * Math.PI, spin: (rnd() - 0.5) * 2, tw: rnd() * 6.283 });
    }
    function burst(t0, x, y, n, speed, size, life, ember) {
      for (var i = 0; i < n; i++) {
        var a = rnd() * 6.283, v = speed * k * (0.35 + rnd() * 0.75);
        add(t0, x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + rnd() * 0.6), size * k * (0.4 + rnd() * 0.8), ember, 30 * k);
      }
    }
    function dust(t0, x, y, n, jx, jy, dy, size, life) {
      for (var i = 0; i < n; i++) {
        add(t0, x + (rnd() - 0.5) * 2 * jx, y + (rnd() - 0.5) * 2 * jy, (rnd() - 0.5) * 40 * k, dy + (rnd() - 0.5) * 40 * k,
          life * (0.6 + rnd() * 0.7), size * k * (0.35 + rnd() * 0.85), false, 18 * k);
      }
    }
    burst(T.crack, cx, top + EH / 2, 44, 300, 30, 1.3, false);
    burst(T.crack, cx, top + EH / 2, 12, 120, 14, 0.8, true);
    dust(T.rise, cx, top + 6 * k, 26, EW * 0.32, 6 * k, -90 * k, 20, 1.7);
    var ch = L.cardW * 1.25;
    dust(T.glideEnd, cx, L.cardY, 20, L.cardW * 0.45, ch * 0.45, 0, 18, 1.4);
    for (var t0 = T.glideEnd + 0.4; t0 < T.end + 30; t0 += 0.16) {
      var side = rnd() < 0.5 ? -1 : 1;
      dust(t0, cx + side * L.cardW * (0.42 + rnd() * 0.12), L.cardY + (rnd() - 0.5) * ch * 0.9, 1, 0, 0, -26 * k, 14, 2.4);
    }
    return ps;
  }

  var DRAG = -Math.log(0.08);

  function drawParticles(ctx, ps, t, A, floatDy) {
    if (!A.gold) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], age = t - p.t0;
      if (age <= 0 || age >= p.life) continue;
      var e = Math.exp(-DRAG * age), f = (1 - e) / DRAG;
      var x = p.x + p.vx * f;
      var y = p.y + (p.vy + p.rise / DRAG) * f - p.rise * age / DRAG;
      var u = age / p.life;
      var fade = u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88;
      var tw = 0.65 + 0.35 * Math.sin(p.tw + t * 14);
      var sz = p.size * (0.7 + 0.3 * tw) * (1.1 - 0.4 * u);
      ctx.globalAlpha = Math.max(0, fade * tw);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot + p.spin * age);
      ctx.drawImage(p.ember ? A.ember : A.gold, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------------- sound */
  /* Made here, not played from a file, and only into the recording (the
     microphone hears the room): a crack and a low thump when the seal
     breaks, paper as the flap lifts, a soft shimmer as the letter rises and
     a twinkle when it lands. */

  function audioKit() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      var ctx = new AC();
      if (!ctx.createMediaStreamDestination) { ctx.close(); return null; }
      var dest = ctx.createMediaStreamDestination();
      var master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(dest);
      var nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = nb.getChannelData(0), r = rand(5);
      for (var i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
      return { ctx: ctx, dest: dest, master: master, noise: nb };
    } catch (e) { return null; }
  }

  function env(g, at, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }
  function noise(kit, at, dur, type, freq, q) {
    var s = kit.ctx.createBufferSource(), f = kit.ctx.createBiquadFilter(), g = kit.ctx.createGain();
    s.buffer = kit.noise;
    f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    s.connect(f); f.connect(g); g.connect(kit.master);
    s.start(at, Math.random() * 0.5, dur + 0.05);
    return g;
  }
  function tone(kit, at, freq, type, peak, attack, decay, toFreq) {
    var o = kit.ctx.createOscillator(), g = kit.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, at);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, at + attack + decay);
    o.connect(g); g.connect(kit.master);
    env(g, at, peak, attack, decay);
    o.start(at); o.stop(at + attack + decay + 0.05);
  }

  /* The opening's sounds, with the crack at ctx time `at`. */
  function score(kit, at) {
    var c0 = at, base = at - T.crack;
    // The crack.
    env(noise(kit, c0, 0.12, 'highpass', 1800), c0, 0.9, 0.003, 0.08);
    env(noise(kit, c0 + 0.035, 0.08, 'highpass', 2600), c0 + 0.035, 0.35, 0.002, 0.05);
    tone(kit, c0, 150, 'sine', 0.5, 0.004, 0.2, 50);
    // Paper as the flap lifts.
    var pg = noise(kit, base + T.flap, 0.5, 'bandpass', 2000, 0.7);
    pg.gain.setValueAtTime(0.0001, base + T.flap);
    var r = rand(3);
    for (var i = 1; i <= 16; i++) {
      var tt = base + T.flap + i * 0.026;
      pg.gain.linearRampToValueAtTime((0.05 + r() * 0.22) * Math.sin(Math.PI * i / 17), tt);
    }
    pg.gain.linearRampToValueAtTime(0.0001, base + T.flap + 0.48);
    // The shimmer as the letter rises.
    [1046.5, 1318.5, 1568, 2093, 2637].forEach(function (f, j) {
      tone(kit, base + T.rise + j * 0.07, f, 'sine', 0.07, 0.01, 1.6);
      tone(kit, base + T.rise + j * 0.07, f / 2, 'triangle', 0.025, 0.02, 1.2);
    });
    // A breath of air as it glides.
    var wg = noise(kit, base + T.glide, 0.6, 'lowpass', 900);
    wg.gain.setValueAtTime(0.0001, base + T.glide);
    wg.gain.linearRampToValueAtTime(0.12, base + T.glide + 0.25);
    wg.gain.linearRampToValueAtTime(0.0001, base + T.glide + 0.55);
    // The twinkle as it lands.
    [2637, 3136, 3951].forEach(function (f, j) { tone(kit, base + T.glideEnd + j * 0.09, f, 'sine', 0.045, 0.005, 0.9); });
  }

  /* ----------------------------------------------------------- recording */

  function pickMime() {
    if (!window.MediaRecorder) return null;
    var list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < list.length; i++) {
      try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {}
    }
    return '';
  }

  var recordable = null;
  function canRecord() {
    if (recordable === null) {
      recordable = !!(window.MediaRecorder && window.MediaStream && document.createElement('canvas').captureStream && pickMime() !== null);
    }
    return recordable;
  }

  function canFilm() {
    return canRecord() && !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function startRecorder(cv, audioStream, bps) {
    var mime = pickMime();
    var vs = cv.captureStream(30);
    var tracks = vs.getVideoTracks().slice();
    if (audioStream) audioStream.getAudioTracks().forEach(function (t) { tracks.push(t); });
    var rec, opts = { videoBitsPerSecond: bps, audioBitsPerSecond: 128000 };
    if (mime) opts.mimeType = mime;
    try { rec = new MediaRecorder(new MediaStream(tracks), opts); }
    catch (e) { rec = new MediaRecorder(new MediaStream(tracks)); }
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var done = new Promise(function (resolve) {
      rec.onstop = function () {
        vs.getTracks().forEach(function (t) { t.stop(); });
        var type = (rec.mimeType || mime || 'video/webm').split(';')[0];
        resolve(chunks.length ? new Blob(chunks, { type: type }) : null);
      };
    });
    rec.start(500);
    return {
      stop: function () { if (rec.state !== 'inactive') rec.stop(); },
      done: done
    };
  }

  function fileFor(blob, name) {
    var ext = /mp4/.test(blob.type) ? 'mp4' : /webm/.test(blob.type) ? 'webm' : 'jpg';
    return new File([blob], name + '.' + ext, { type: blob.type });
  }

  function canShare(type) {
    try {
      return !!(navigator.canShare && navigator.share &&
        navigator.canShare({ files: [new File([new Blob(['x'], { type: type })], 'x.' + type.split('/')[1], { type: type })] }));
    } catch (e) { return false; }
  }

  /* ---------------------------------------------------------- the sheets */

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  var X_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var SOUND_ON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  var SOUND_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';

  /* The overlay both sheets use: a close button, a 9:16 frame and a place
     for the buttons. Escape and a tap outside close it. */
  function sheet(S, label, onClose) {
    var wrapEl = h('div', 'fm-wrap');
    wrapEl.setAttribute('role', 'dialog');
    wrapEl.setAttribute('aria-modal', 'true');
    wrapEl.setAttribute('aria-label', label);
    var x = h('button', 'fm-x');
    x.type = 'button';
    x.setAttribute('aria-label', S.close);
    x.innerHTML = X_ICON;
    var frame = h('div', 'fm-frame');
    var actions = h('div', 'fm-actions');
    wrapEl.appendChild(x);
    wrapEl.appendChild(frame);
    wrapEl.appendChild(actions);
    document.body.appendChild(wrapEl);
    document.documentElement.classList.add('fm-open');
    requestAnimationFrame(function () { wrapEl.classList.add('is-in'); });
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      wrapEl.classList.remove('is-in');
      document.documentElement.classList.remove('fm-open');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { wrapEl.remove(); }, 260);
      onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    x.addEventListener('click', close);
    wrapEl.addEventListener('click', function (e) { if (e.target === wrapEl) close(); });
    document.addEventListener('keydown', onKey);
    setTimeout(function () { x.focus(); }, 50);
    return { el: wrapEl, frame: frame, actions: actions, close: close };
  }

  /* A finished video in the frame, looping, muted until asked. */
  function showVideo(frame, url, S) {
    var v = h('video', 'fm-media');
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.src = url;
    frame.insertBefore(v, frame.firstChild);
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
    var snd = h('button', 'fm-sound');
    snd.type = 'button';
    function paint() {
      snd.innerHTML = v.muted ? SOUND_OFF : SOUND_ON;
      snd.setAttribute('aria-label', v.muted ? S.soundOn : S.soundOff);
    }
    snd.addEventListener('click', function () { v.muted = !v.muted; if (!v.muted) { v.currentTime = 0; v.play(); } paint(); });
    paint();
    frame.appendChild(snd);
    return v;
  }

  /* A share button for a file: the share sheet where there is one,
     straight from the tap (Safari only opens it inside one), else a
     download. */
  function shareButton(cls, label, saveLabel, get, onShared) {
    var b = h('button', cls, label);
    b.type = 'button';
    b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', function () {
      if (b.getAttribute('aria-disabled') === 'true') return;
      var f = get();
      if (!f) return;
      if (canShare(f.type)) {
        navigator.share({ files: [f] }).then(function () { onShared('share'); }, function () {});
      } else {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        onShared('download');
      }
    });
    b.relabel = function (f) { b.textContent = canShare(f.type) ? label : saveLabel; };
    return b;
  }

  /* ------------------------------------------------------------- filming */

  var MAX_MS = 60000;              // never longer than a minute in all
  var AFTER_S = T.end - T.crack + 2; // filming goes on this long after the tap

  function film(o) {
    var S = stringsFor(o.lang);
    var ev = o.onEvent || function () {};
    var state = 'idle';             // idle, arming, armed, opened, stopping, review, done
    var kit = null, cam = null, video = null, cv = null, ctx = null, scene = null, rec = null;
    var raf = 0, tapAt = 0, startedAt = 0, bubble = null, doneBtn = null, cap = 0;
    var Q = 2 / 3;                  // 720x1280: the camera is no sharper

    function arm() {
      if (state !== 'idle') return Promise.resolve(false);
      state = 'arming';
      kit = audioKit();
      if (kit) try { kit.ctx.resume(); } catch (e) {}
      return navigator.mediaDevices.getUserMedia({
        // 4:3, the front camera's whole picture: 16:9 would crop it in.
        video: { facingMode: 'user', width: { ideal: 1440 }, height: { ideal: 1080 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      }).catch(function () {
        // No microphone (or not allowed): the face without the sound.
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1440 }, height: { ideal: 1080 } } });
      }).then(function (stream) {
        if (state !== 'arming') { stream.getTracks().forEach(function (t) { t.stop(); }); return false; }
        cam = stream;
        video = h('video');
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.srcObject = stream;
        return Promise.all([video.play().catch(function () {}), loadAssets(o)]).then(function (r) {
          if (state !== 'arming') return false;
          scene = makeScene(r[1], o, LAYOUT);
          if (kit && cam.getAudioTracks().length) {
            var mic = kit.ctx.createMediaStreamSource(cam);
            var mg = kit.ctx.createGain();
            mg.gain.value = 1;
            mic.connect(mg);
            mg.connect(kit.master);
          }
          cv = canvas(W * Q, H * Q);
          ctx = cv.getContext('2d');
          // On the page, though out of sight: Safari may stop feeding a
          // recorder from a canvas that is not.
          cv.setAttribute('aria-hidden', 'true');
          cv.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
          document.body.appendChild(cv);
          showBubble();
          startedAt = performance.now();
          drawFrame(startedAt);
          rec = startRecorder(cv, kit && kit.dest.stream, 5000000);
          raf = requestAnimationFrame(loop);
          cap = setTimeout(stop, MAX_MS);
          state = 'armed';
          ev('film_started', { mic: cam.getAudioTracks().length > 0 });
          return true;
        });
      }).catch(function (err) {
        cleanup();
        state = 'idle';
        ev('film_failed', { reason: err && err.name === 'NotAllowedError' ? 'denied' : 'camera' });
        return false;
      });
    }

    function drawFrame(now) {
      ctx.setTransform(Q, 0, 0, Q, 0, 0);
      var t = tapAt ? T.crack - 0.05 + (now - tapAt) / 1000 : 1.0;
      // The face, mirrored as a selfie is, across the whole width.
      var F = LAYOUT.face;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, W, H);
      if (video && video.videoWidth) {
        var s = Math.max(F[2] / video.videoWidth, F[3] / video.videoHeight);
        var dw = video.videoWidth * s, dh = video.videoHeight * s;
        ctx.save();
        ctx.translate(F[0] + F[2], F[1]);
        ctx.scale(-1, 1);
        ctx.drawImage(video, (F[2] - dw) / 2, (F[3] - dh) / 2, dw, dh);
        ctx.restore();
      }
      // The opening over its lower part; the letter rises over the face.
      scene.draw(ctx, t, now);
    }

    function loop(now) {
      if (state !== 'armed' && state !== 'opened') return;
      drawFrame(now);
      if (tapAt && (now - tapAt) / 1000 >= AFTER_S) { stop(); return; }
      raf = requestAnimationFrame(loop);
    }

    function opened() {
      if (state !== 'armed') return;
      state = 'opened';
      tapAt = performance.now();
      if (kit) score(kit, kit.ctx.currentTime + 0.05);
      if (bubble) {
        bubble.classList.add('is-opened');
        doneBtn.hidden = false;
      }
    }

    function stop() {
      if (state !== 'armed' && state !== 'opened') return;
      state = 'stopping';
      clearTimeout(cap);
      cancelAnimationFrame(raf);
      var secs = Math.round((performance.now() - startedAt) / 1000);
      rec.stop();
      rec.done.then(function (blob) {
        cleanup();
        if (!blob) { state = 'done'; if (o.onDone) o.onDone(); return; }
        ev('film_recorded', { seconds: secs });
        review(blob);
      });
    }

    function cancel() {
      if (state === 'idle' || state === 'done') return;
      var was = state;
      state = 'done';
      clearTimeout(cap);
      cancelAnimationFrame(raf);
      if (rec) rec.stop();
      cleanup();
      if (was !== 'arming') ev('film_cancelled', {});
      if (o.onDone) o.onDone();
    }

    function cleanup() {
      if (cam) cam.getTracks().forEach(function (t) { t.stop(); });
      cam = null;
      if (video) { video.srcObject = null; video = null; }
      if (cv && cv.parentNode) cv.remove();
      if (bubble) { bubble.remove(); bubble = null; }
      if (kit) { try { kit.ctx.close(); } catch (e) {} kit = null; }
    }

    /* The receiver's own picture while it records, so they always know. */
    function showBubble() {
      bubble = h('div', 'fm-bubble');
      bubble.setAttribute('role', 'status');
      // The same video the recording draws from: Safari may stop updating
      // one that is not on the page.
      var live = video;
      live.className = 'fm-bubble-cam';
      var dot = h('span', 'fm-rec');
      dot.appendChild(h('span', 'vh', S.recording));
      var x = h('button', 'fm-bubble-x');
      x.type = 'button';
      x.setAttribute('aria-label', S.filmCancel);
      x.innerHTML = X_ICON;
      x.addEventListener('click', cancel);
      doneBtn = h('button', 'fm-bubble-done', S.filmDone);
      doneBtn.type = 'button';
      doneBtn.hidden = true;
      doneBtn.addEventListener('click', stop);
      bubble.appendChild(live);
      bubble.appendChild(dot);
      bubble.appendChild(x);
      bubble.appendChild(doneBtn);
      document.body.appendChild(bubble);
    }

    /* What they filmed: send it to whoever sealed it, post it, or delete it. */
    function review(blob) {
      state = 'review';
      var file = fileFor(blob, 'dailies-reaction'), url = URL.createObjectURL(blob), shared = false;
      var sh = sheet(S, S.reaction, function () {
        state = 'done';
        URL.revokeObjectURL(url);
        ev('film_closed', { shared: shared });
        if (o.onDone) o.onDone();
      });
      sh.el.classList.add('fm-review');
      showVideo(sh.frame, url, S);
      var title = h('p', 'fm-title', S.reaction);
      sh.el.insertBefore(title, sh.frame);
      var share = canShare(file.type);
      function done(dest) { return function (how) { shared = true; ev('film_shared', { destination: how === 'download' ? 'download' : dest }); }; }
      var toSender = shareButton('btn btn-primary btn-big fm-go', o.from ? S.sendTo.split('{from}').join(o.from) : S.sendIt, S.save,
        function () { return file; }, done('sender'));
      toSender.relabel(file);
      toSender.removeAttribute('aria-disabled');
      sh.actions.appendChild(toSender);
      if (share) {
        var toStory = shareButton('btn btn-ghost fm-second', S.toStory, S.save, function () { return file; }, done('story'));
        toStory.removeAttribute('aria-disabled');
        sh.actions.appendChild(toStory);
      }
      var del = h('button', 'fm-del', S.del);
      del.type = 'button';
      del.addEventListener('click', function () { ev('film_deleted', {}); shared = true; sh.close(); });
      sh.actions.appendChild(del);
    }

    return {
      arm: arm,
      opened: opened,
      stop: stop,
      cancel: cancel,
      // Until they are finished with it, the review included.
      active: function () { return state !== 'idle' && state !== 'done'; }
    };
  }

  window.DailiesFilm = {
    film: film, canFilm: canFilm,
    STRINGS: STRINGS, T: T,
    // For tests and the page's own checks.
    _scene: function (o) {
      return loadAssets(o).then(function (A) { return makeScene(A, o, LAYOUT); });
    }
  };
})();
