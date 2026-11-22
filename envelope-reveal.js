/* ============================================================================
   The reveal: an envelope opening, as a video.

   Two ways to keep the moment a friend opens an envelope:

   1. Post it to your Story. After opening, the receiver gets an 8 second
      vertical video (1080x1920) of the opening: the sealed envelope with
      the sender's initial in the wax, the seal cracking in a flash of gold,
      the flap lifting, the letter rising out of it with their line on it,
      with a soft paper-and-wax sound. "{from} sealed this for me" on top,
      unless they turn the name off. The phone's share sheet takes it to
      Instagram, TikTok, WhatsApp; where there is none it is a download.

   2. Film yourself opening it. Before opening, the receiver can turn the
      front camera on. The page records them, and the same opening drawn
      under their face, from a moment before they open it until a few
      seconds after they have read it. Then they can send it to whoever
      sealed it, post it, or delete it.

   Nothing leaves the phone. Both videos are drawn on a canvas here and
   recorded here (MediaRecorder: MP4 in Safari and recent Chrome), and only
   go anywhere through the share sheet. The camera stops as soon as the
   recording does.

   The opening is drawn from the same pictures as the page (img/envelope/),
   timed like sealed.js openEnvelope(), so the video is the opening they saw.
   Instagram covers about the top 250 and the bottom 340 pixels of a Story
   with its own controls, so nothing that matters is drawn there.

     DailiesReveal.button(o)     the "Post it to your Story" button
     DailiesReveal.open(o)       the same, without the button
     DailiesReveal.canFilm()     whether this browser can film the receiver
     DailiesReveal.film(o)       { arm(), opened(), stop(), cancel(), active() }

   o: {
     to, from, text, author,      the envelope, names and line as shown
     look,                        {src} | {gradient:[a,b]} | {color}
     lang,                        'en', 'es', 'pt', 'fr', 'de' or 'ja'
     forName,                     the envelope's "For {to}" template
     note,                        the short line under the name, or null
     postmark,                    "No. 3", or null for a first envelope
     stamp,                       the page's stamp <svg>, or null
     onEvent(action, props),      reveal_* and film_* (see analytics.js)
     onDone()                     film only: the receiver is finished with it
   }

   Needs /envelope-seal.js for the wax, and /envelope-reveal.css.
   ========================================================================= */
(function () {
  'use strict';

  var W = 1080, H = 1920;

  var STRINGS = {
    en: { button: 'Post it to your Story', headFrom: '{from} sealed this for me', headSomeone: 'Someone sealed this for me',
      showFrom: 'Show who sent it', share: 'Share', save: 'Save video', close: 'Close', making: 'Making your video',
      film: 'Film yourself opening it', filmHint: 'Recording. Open it when you’re ready.',
      filmPrivate: 'Only you have this video until you share it.', filmDone: 'Done', filmCancel: 'Stop filming',
      filmNoCamera: 'The camera didn’t start, so it opens without filming.', recording: 'Recording',
      reaction: 'Your reaction', sendTo: 'Send it to {from}', sendIt: 'Send it', toStory: 'Post it to your Story',
      del: 'Delete', soundOn: 'Turn the sound on', soundOff: 'Turn the sound off' },
    es: { button: 'Publícalo en tu historia', headFrom: '{from} selló esto para mí', headSomeone: 'Alguien selló esto para mí',
      showFrom: 'Mostrar quién lo mandó', share: 'Compartir', save: 'Guardar video', close: 'Cerrar', making: 'Preparando tu video',
      film: 'Grábate al abrirlo', filmHint: 'Grabando. Ábrelo cuando quieras.',
      filmPrivate: 'Solo tú tienes este video hasta que lo compartas.', filmDone: 'Listo', filmCancel: 'Dejar de grabar',
      filmNoCamera: 'La cámara no se encendió, así que se abre sin grabar.', recording: 'Grabando',
      reaction: 'Tu reacción', sendTo: 'Envíaselo a {from}', sendIt: 'Envíalo', toStory: 'Publícalo en tu historia',
      del: 'Borrar', soundOn: 'Activar el sonido', soundOff: 'Silenciar' },
    pt: { button: 'Poste nos seus stories', headFrom: '{from} selou isto para mim', headSomeone: 'Alguém selou isto para mim',
      showFrom: 'Mostrar quem enviou', share: 'Compartilhar', save: 'Salvar vídeo', close: 'Fechar', making: 'Preparando seu vídeo',
      film: 'Grave você abrindo', filmHint: 'Gravando. Abra quando quiser.',
      filmPrivate: 'Só você tem este vídeo até compartilhar.', filmDone: 'Pronto', filmCancel: 'Parar de gravar',
      filmNoCamera: 'A câmera não ligou, então ele abre sem gravar.', recording: 'Gravando',
      reaction: 'Sua reação', sendTo: 'Envie para {from}', sendIt: 'Enviar', toStory: 'Poste nos seus stories',
      del: 'Apagar', soundOn: 'Ativar o som', soundOff: 'Desativar o som' },
    fr: { button: 'Publie-la en story', headFrom: '{from} a scellé ceci pour moi', headSomeone: 'Quelqu’un a scellé ceci pour moi',
      showFrom: 'Montrer qui l’a envoyée', share: 'Partager', save: 'Enregistrer la vidéo', close: 'Fermer', making: 'Préparation de ta vidéo',
      film: 'Filme-toi en l’ouvrant', filmHint: 'Ça tourne. Ouvre-la quand tu veux.',
      filmPrivate: 'Cette vidéo reste sur ton téléphone tant que tu ne la partages pas.', filmDone: 'Terminé', filmCancel: 'Arrêter de filmer',
      filmNoCamera: 'La caméra ne s’est pas lancée, l’enveloppe s’ouvre donc sans filmer.', recording: 'Enregistrement',
      reaction: 'Ta réaction', sendTo: 'Envoie-la à {from}', sendIt: 'Envoie-la', toStory: 'Publie-la en story',
      del: 'Supprimer', soundOn: 'Activer le son', soundOff: 'Couper le son' },
    de: { button: 'In deiner Story posten', headFrom: '{from} hat das für mich versiegelt', headSomeone: 'Jemand hat das für mich versiegelt',
      showFrom: 'Zeigen, wer es geschickt hat', share: 'Teilen', save: 'Video speichern', close: 'Schließen', making: 'Dein Video wird erstellt',
      film: 'Film dich beim Öffnen', filmHint: 'Die Aufnahme läuft. Öffne ihn, wenn du so weit bist.',
      filmPrivate: 'Nur du hast dieses Video, bis du es teilst.', filmDone: 'Fertig', filmCancel: 'Aufnahme beenden',
      filmNoCamera: 'Die Kamera ist nicht angegangen, also öffnet er sich ohne Aufnahme.', recording: 'Aufnahme läuft',
      reaction: 'Deine Reaktion', sendTo: 'An {from} schicken', sendIt: 'Schicken', toStory: 'In deiner Story posten',
      del: 'Löschen', soundOn: 'Ton an', soundOff: 'Ton aus' },
    ja: { button: 'ストーリーズに投稿する', headFrom: '{from}さんから届きました', headSomeone: 'だれかから届きました',
      showFrom: '送り主の名前を表示', share: '共有', save: '動画を保存', close: '閉じる', making: '動画を作成しています',
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

  /* The opening, in seconds: sealed.js openEnvelope() step by step, with a
     beat before it to see the envelope sealed, and the time to read after. */
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

  /* ---------------------------------------------------------------- layouts */

  /* Where everything goes, on a 1080x1920 frame. "story": the opening fills
     the frame, with the headline over it. "film": the receiver's face on
     top, the opening under it. */
  var LAYOUTS = {
    story: { y0: 0, y1: H, EW: 800, cy: 1080, cardW: 720, cardY: 1000, head: 300, brand: 1545 },
    film: { y0: 900, y1: H, EW: 700, cy: 1265, cardW: 540, cardY: 1250, face: [0, 0, W, 900], brand: 840 }
  };

  /* ------------------------------------------------------------------ scene */

  function makeScene(A, o, L, showFrom) {
    var S = stringsFor(o.lang);
    var EW = L.EW, EH = EW / 1.36, k = EW / 420, cx = W / 2;
    var bg = backdropCanvas(A, o, W, L.y1 - L.y0);
    var front = frontCanvas(A, o, EW);
    var card = cardCanvas(A, o, L.cardW);
    var flapH = EH * 0.5893;
    var cw = EW * 0.84, ch = cw * 1.25;
    var sealSize = EW * 0.24;
    var head = L.head != null ? (showFrom && o.from ? S.headFrom.split('{from}').join(o.from) : S.headSomeone) : null;
    var parts = particles(L, EW, EH, k);

    function draw(ctx, t, now) {
      ctx.drawImage(bg, 0, L.y0);

      // The way in: a fade and a little growth (the story only; the film
      // starts on the envelope already there).
      var pin = easeOut(seg(t, 0, 0.7));
      // Floating while it waits, as on the page; still from the crack.
      var still = seg(t, T.crack - 0.25, T.crack);
      var fl = (1 - still) * Math.sin(now / 1000 * Math.PI * 2 / 6.5) * 7 * k;
      var ex = cx - EW / 2, ey = L.cy - EH / 2 + fl;
      var pd = easeIn(seg(t, T.drop, T.dropEnd)), bodyDy = 90 * k * pd, bodyA = 1 - pd;

      ctx.save();
      ctx.translate(cx, L.cy);
      ctx.scale(lerp(0.94, 1, pin), lerp(0.94, 1, pin));
      ctx.translate(-cx, -L.cy);

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

      // The way in, from dark (layers faded one by one would show the letter
      // through the envelope).
      if (pin < 1) {
        ctx.fillStyle = 'rgba(8,10,14,' + (1 - pin).toFixed(3) + ')';
        ctx.fillRect(0, L.y0, W, L.y1 - L.y0);
      }

      // The headline: the brag.
      if (head) {
        var ha = easeOut(seg(t, 0.25, 1.0));
        ctx.save();
        ctx.globalAlpha = ha;
        ctx.fillStyle = CREAM;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 24;
        ctx.font = '400 74px ' + F_DISPLAY;
        var hl = wrap(ctx, head, W - 200);
        if (hl.length > 2) { ctx.font = '400 58px ' + F_DISPLAY; hl = wrap(ctx, head, W - 200).slice(0, 2); }
        var lh = parseFloat(ctx.font.match(/([\d.]+)px/)[1]) * 1.16;
        var hy = L.head + (1 - ha) * 14 - (hl.length - 1) * lh / 2;
        hl.forEach(function (l, i) { ctx.fillText(l, W / 2, hy + i * lh); });
        ctx.restore();
      }

      // Where it came from.
      var ba = L.face ? 1 : easeOut(seg(t, T.glideEnd + 0.2, T.glideEnd + 0.9));
      if (ba > 0) brand(ctx, A, L, ba);
    }

    return { draw: draw };
  }

  function brand(ctx, A, L, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    var label = 'mydailies.app';
    if (L.face) {
      // A pill in the corner of the face.
      ctx.font = '600 28px ' + F_BODY;
      var isz = 40, gap = 12, lw = ctx.measureText(label).width, pw = 16 + isz + gap + lw + 22, ph = 60;
      var px = 36, py = L.brand - ph;
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
    } else {
      ctx.font = '600 34px ' + F_BODY;
      var lw2 = ctx.measureText(label).width, sz = 52, g2 = 16;
      var bx = (W - (sz + g2 + lw2)) / 2;
      if (A.icon) {
        ctx.save();
        roundRect(ctx, bx, L.brand - sz / 2, sz, sz, sz * 0.23, sz * 0.23);
        ctx.clip();
        ctx.drawImage(A.icon, bx, L.brand - sz / 2, sz, sz);
        ctx.restore();
      } else bx -= (sz + g2) / 2;
      ctx.fillStyle = 'rgba(246,239,225,0.92)';
      ctx.fillText(label, bx + sz + g2, L.brand + 1);
    }
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
  /* Made here, not played from a file: a crack and a low thump when the
     seal breaks, paper as the flap lifts, a soft shimmer as the letter
     rises and a twinkle when it lands, over a quiet warm note. */

  function audioKit(outLoud) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      var ctx = new AC();
      if (!ctx.createMediaStreamDestination) { ctx.close(); return null; }
      var dest = ctx.createMediaStreamDestination();
      var master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(dest);
      var speaker = null;
      if (outLoud) { speaker = ctx.createGain(); speaker.gain.value = 0.7; master.connect(speaker); speaker.connect(ctx.destination); }
      var nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = nb.getChannelData(0), r = rand(5);
      for (var i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
      return { ctx: ctx, dest: dest, master: master, noise: nb, speaker: speaker };
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
  function score(kit, at, withBed) {
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
    // A warm note under the reading.
    if (withBed) {
      [196, 293.66, 392].forEach(function (f, j) {
        var o = kit.ctx.createOscillator(), g = kit.ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        o.connect(g); g.connect(kit.master);
        g.gain.setValueAtTime(0.0001, base + T.rise);
        g.gain.linearRampToValueAtTime(0.03 / (j + 1), base + T.glideEnd);
        g.gain.setValueAtTime(0.03 / (j + 1), base + T.end - 1.2);
        g.gain.linearRampToValueAtTime(0.0001, base + T.end);
        o.start(base + T.rise); o.stop(base + T.end + 0.1);
      });
    }
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
    var wrapEl = h('div', 'rv-wrap');
    wrapEl.setAttribute('role', 'dialog');
    wrapEl.setAttribute('aria-modal', 'true');
    wrapEl.setAttribute('aria-label', label);
    var x = h('button', 'rv-x');
    x.type = 'button';
    x.setAttribute('aria-label', S.close);
    x.innerHTML = X_ICON;
    var frame = h('div', 'rv-frame');
    var wait = h('p', 'rv-wait', S.making);
    frame.appendChild(wait);
    var actions = h('div', 'rv-actions');
    wrapEl.appendChild(x);
    wrapEl.appendChild(frame);
    wrapEl.appendChild(actions);
    document.body.appendChild(wrapEl);
    document.documentElement.classList.add('rv-open');
    requestAnimationFrame(function () { wrapEl.classList.add('is-in'); });
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      wrapEl.classList.remove('is-in');
      document.documentElement.classList.remove('rv-open');
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
    Array.prototype.slice.call(frame.querySelectorAll('canvas,video,.rv-sound')).forEach(function (n) { n.remove(); });
    var v = h('video', 'rv-media');
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.src = url;
    frame.insertBefore(v, frame.firstChild);
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
    var snd = h('button', 'rv-sound');
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

  /* ------------------------------------------- 1. Post it to your Story */

  var openSheet = null;

  function open(o) {
    if (openSheet) return;
    var S = stringsFor(o.lang);
    var ev = o.onEvent || function () {};
    var showFrom = !!o.from, file = null, url = null, gen = 0, take = null, shared = false;
    var kit = canRecord() ? audioKit(true) : null; // inside the tap, so it may play

    var sh = sheet(S, S.button, function () {
      openSheet = null;
      gen++;
      if (take) take.abort();
      if (url) URL.revokeObjectURL(url);
      if (kit) try { kit.ctx.close(); } catch (e) {}
      ev('reveal_closed', { from_shown: showFrom, shared: shared });
      if (o.returnFocus && o.returnFocus.focus) o.returnFocus.focus();
    });
    openSheet = sh;

    var row = h('label', 'rv-toggle');
    var cb = h('input');
    cb.type = 'checkbox';
    cb.checked = true;
    row.appendChild(cb);
    row.appendChild(h('span', 'rv-switch'));
    row.appendChild(h('span', null, S.showFrom));
    if (!o.from) row.hidden = true;

    var go = shareButton('btn btn-primary btn-big rv-go', S.share, S.save, function () { return file; }, function (how) {
      shared = true;
      ev('reveal_shared', { destination: how, from_shown: showFrom, format: file && /mp4/.test(file.type) ? 'mp4' : file && /webm/.test(file.type) ? 'webm' : 'jpg' });
    });
    go.textContent = S.making;
    sh.actions.appendChild(row);
    sh.actions.appendChild(go);

    function make() {
      var mine = ++gen;
      if (take) take.abort();
      file = null;
      sh.frame.classList.add('is-making');
      go.setAttribute('aria-disabled', 'true');
      go.textContent = S.making;
      loadAssets(o).then(function (A) {
        if (mine !== gen) return;
        var scene = makeScene(A, o, LAYOUTS.story, showFrom);
        if (!canRecord()) return still(scene, mine);
        take = playTake(scene, mine);
      });
    }

    // No recorder: the last frame, as a picture.
    function still(scene, mine) {
      var cv = canvas(W, H), ctx = cv.getContext('2d');
      scene.draw(ctx, T.end, 0);
      cv.toBlob(function (b) {
        if (mine !== gen || !b) return;
        done(b);
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(b);
        var img = h('img', 'rv-media');
        img.alt = '';
        img.src = url;
        Array.prototype.slice.call(sh.frame.querySelectorAll('canvas,video,img')).forEach(function (n) { n.remove(); });
        sh.frame.insertBefore(img, sh.frame.firstChild);
      }, 'image/jpeg', 0.92);
    }

    function done(blob) {
      file = fileFor(blob, 'dailies-envelope');
      go.relabel(file);
      go.removeAttribute('aria-disabled');
      sh.frame.classList.remove('is-making');
    }

    /* Plays the opening into the frame while recording it: the take is the
       preview. */
    function playTake(scene, mine) {
      var cv = canvas(W, H), ctx = cv.getContext('2d');
      cv.className = 'rv-media';
      Array.prototype.slice.call(sh.frame.querySelectorAll('canvas,video,img,.rv-sound')).forEach(function (n) { n.remove(); });
      sh.frame.insertBefore(cv, sh.frame.firstChild);
      var t0 = performance.now() + 60, raf = 0, stopped = false;
      scene.draw(ctx, 0, t0);
      if (kit) { try { kit.ctx.resume(); } catch (e) {} score(kit, kit.ctx.currentTime + 0.06 + T.crack, true); }
      var rec = startRecorder(cv, kit && kit.dest.stream, 8000000);
      function frame(now) {
        if (stopped) return;
        var t = Math.max(0, (now - t0) / 1000);
        scene.draw(ctx, t, now);
        if (t >= T.end) { stopped = true; rec.stop(); return; }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      rec.done.then(function (blob) {
        if (mine !== gen || !blob) return;
        done(blob);
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        showVideo(sh.frame, url, S);
      });
      return { abort: function () { stopped = true; cancelAnimationFrame(raf); rec.stop(); } };
    }

    cb.addEventListener('change', function () {
      showFrom = cb.checked;
      if (kit) try { kit.ctx.close(); } catch (e) {}
      kit = canRecord() ? audioKit(true) : null;
      make();
    });

    ev('reveal_opened', {});
    make();
  }

  /* The button for the page, already labelled; the page places it.
     o.className styles it like the page's own buttons. */
  function button(o) {
    var S = stringsFor(o.lang);
    var b = h('button', o.className || 'btn btn-ghost rv-cta');
    b.type = 'button';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="3.2"/><path d="M10.5 9.2v5.6l4.6-2.8z"/></svg>';
    b.appendChild(h('span', null, S.button));
    b.addEventListener('click', function () {
      var opts = typeof o.get === 'function' ? o.get() : o;
      opts.returnFocus = b;
      open(opts);
    });
    return b;
  }

  /* ----------------------------------- 2. Film yourself opening it */

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
      kit = audioKit(false);
      if (kit) try { kit.ctx.resume(); } catch (e) {}
      return navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      }).catch(function () {
        // No microphone (or not allowed): the face without the sound.
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
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
          scene = makeScene(r[1], o, LAYOUTS.film, true);
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
      // The face, mirrored as a selfie is, over the top of the frame.
      var F = LAYOUTS.film.face;
      ctx.save();
      ctx.beginPath();
      ctx.rect(F[0], F[1], F[2], F[3]);
      ctx.clip();
      ctx.fillStyle = '#111';
      ctx.fillRect(F[0], F[1], F[2], F[3]);
      if (video && video.videoWidth) {
        var s = Math.max(F[2] / video.videoWidth, F[3] / video.videoHeight);
        var dw = video.videoWidth * s, dh = video.videoHeight * s;
        ctx.translate(F[0] + F[2], F[1]);
        ctx.scale(-1, 1);
        ctx.drawImage(video, (F[2] - dw) / 2, (F[3] - dh) / 2, dw, dh);
      }
      ctx.restore();
      // A soft edge where the face meets the envelope.
      var g = ctx.createLinearGradient(0, F[3] - 90, 0, F[3]);
      g.addColorStop(0, 'rgba(10,12,18,0)');
      g.addColorStop(1, 'rgba(10,12,18,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, F[3] - 90, W, 90);
      // The opening under it; the letter may rise over the face.
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
      if (kit) score(kit, kit.ctx.currentTime + 0.05, false);
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
      bubble = h('div', 'rv-bubble');
      bubble.setAttribute('role', 'status');
      // The same video the recording draws from: Safari may stop updating
      // one that is not on the page.
      var live = video;
      live.className = 'rv-bubble-cam';
      var dot = h('span', 'rv-rec');
      dot.appendChild(h('span', 'vh', S.recording));
      var x = h('button', 'rv-bubble-x');
      x.type = 'button';
      x.setAttribute('aria-label', S.filmCancel);
      x.innerHTML = X_ICON;
      x.addEventListener('click', cancel);
      doneBtn = h('button', 'rv-bubble-done', S.filmDone);
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
      sh.el.classList.add('rv-review');
      sh.frame.classList.remove('is-making');
      showVideo(sh.frame, url, S);
      var title = h('p', 'rv-title', S.reaction);
      sh.el.insertBefore(title, sh.frame);
      var share = canShare(file.type);
      function done(dest) { return function (how) { shared = true; ev('film_shared', { destination: how === 'download' ? 'download' : dest }); }; }
      var toSender = shareButton('btn btn-primary btn-big rv-go', o.from ? S.sendTo.split('{from}').join(o.from) : S.sendIt, S.save,
        function () { return file; }, done('sender'));
      toSender.relabel(file);
      toSender.removeAttribute('aria-disabled');
      sh.actions.appendChild(toSender);
      if (share) {
        var toStory = shareButton('btn btn-ghost rv-second', S.toStory, S.save, function () { return file; }, done('story'));
        toStory.removeAttribute('aria-disabled');
        sh.actions.appendChild(toStory);
      }
      var del = h('button', 'rv-del', S.del);
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

  window.DailiesReveal = {
    open: open, button: button, film: film, canFilm: canFilm, canRecord: canRecord,
    STRINGS: STRINGS, T: T,
    // For tests and the page's own checks.
    _scene: function (o, layout, showFrom) {
      return loadAssets(o).then(function (A) { return makeScene(A, o, LAYOUTS[layout || 'story'], showFrom !== false); });
    }
  };
})();
