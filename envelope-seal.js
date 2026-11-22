/* ============================================================================
   The sender's own seal: their initial pressed into the wax.

   /img/envelope/seal_blank.webp is the app's wax (tool/envelope/
   render_envelope.py in the app repo) with nothing pressed into its field.
   This file presses a letter into it with the renderer's own lighting: the
   letter is drawn, blurred into a low relief, and each pixel of the field is
   lit again from that relief's slope - the same light direction, the same
   diffuse and specular terms and the same shadow in the crevices. Pressing
   the quote mark this way gives back seal.webp to within a fraction of a
   percent, so a pressed initial is the same wax, not a letter laid on top.
   The app does the same in lib/widgets/seal_press.dart; keep the numbers in
   step.

   Any script works: the letter is whatever the browser draws for it, in
   Yeseva One (the face the quote mark is cut in) when it has the glyph.

     window.DailiesSeal.initialOf(name)   "dana" -> "D", "山田" -> "山",
                                          "🙂x" -> null (no letter first)
     window.DailiesSeal.url(initial)      Promise of an image URL for the
                                          wax (seal.webp when initial is
                                          null or anything fails)
     window.DailiesSeal.apply(root, name) points every wax <img> under root
                                          (the halves of a seal) at it
   ========================================================================= */
(function () {
  'use strict';

  var PLAIN = '/img/envelope/seal.webp';
  var BLANK = '/img/envelope/seal_blank.webp';
  var SIZE = 560;              // the wax pictures' size
  var R = SIZE * 0.36;         // the renderer's R
  var FONT = '"Yeseva One", Fraunces, Georgia, serif';

  function initialOf(name) {
    var s = String(name || '').trim();
    if (!s) return null;
    var first;
    try {
      if (window.Intl && Intl.Segmenter) {
        first = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next().value.segment;
      }
    } catch (e) {}
    if (!first) first = Array.from(s)[0];
    var letter;
    try { letter = new RegExp('^\\p{L}', 'u').test(first); }
    catch (e) { letter = /^[A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-׿؀-ۿ぀-ヿ一-鿿가-힯]/.test(first); }
    if (!letter) return null;
    return first.toLocaleUpperCase();
  }

  // Three box passes each way, which is close enough to a Gaussian.
  function blur(src, w, h, sigma) {
    var r = Math.max(1, Math.round(Math.sqrt(12 * sigma * sigma / 3 + 1) / 2 - 0.5));
    var a = Float32Array.from(src), t = new Float32Array(src.length);
    for (var pass = 0; pass < 3; pass++) {
      boxH(a, t, w, h, r);
      boxV(t, a, w, h, r);
    }
    return a;
  }
  function boxH(s, d, w, h, r) {
    var n = 2 * r + 1;
    for (var y = 0; y < h; y++) {
      var o = y * w, acc = 0, x;
      for (x = -r; x <= r; x++) acc += s[o + Math.min(w - 1, Math.max(0, x))];
      for (x = 0; x < w; x++) {
        d[o + x] = acc / n;
        acc += s[o + Math.min(w - 1, x + r + 1)] - s[o + Math.max(0, x - r)];
      }
    }
  }
  function boxV(s, d, w, h, r) {
    var n = 2 * r + 1;
    for (var x = 0; x < w; x++) {
      var acc = 0, y;
      for (y = -r; y <= r; y++) acc += s[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (y = 0; y < h; y++) {
        d[y * w + x] = acc / n;
        acc += s[Math.min(h - 1, y + r + 1) * w + x] - s[Math.max(0, y - r) * w + x];
      }
    }
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }

  /* The pressed wax as a canvas, SIZE square. */
  function press(initial, blank) {
    var c = SIZE / 2;
    // The letter, as the die that presses it.
    var g = document.createElement('canvas');
    g.width = g.height = SIZE;
    var gx = g.getContext('2d');
    gx.fillStyle = '#000';
    gx.fillRect(0, 0, SIZE, SIZE);
    gx.fillStyle = '#fff';
    gx.textAlign = 'center';
    gx.textBaseline = 'alphabetic';
    var fs = R * 0.95;
    gx.font = fs + 'px ' + FONT;
    var m = gx.measureText(initial);
    var asc = m.actualBoundingBoxAscent || fs * 0.7, desc = m.actualBoundingBoxDescent || 0;
    var width = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width);
    // Never wider or taller than the field allows.
    var fit = Math.min(1, (R * 0.86) / Math.max(width, 1), (R * 0.82) / Math.max(asc + desc, 1));
    if (fit < 1) {
      fs *= fit;
      gx.font = fs + 'px ' + FONT;
      m = gx.measureText(initial);
      asc = m.actualBoundingBoxAscent || fs * 0.7; desc = m.actualBoundingBoxDescent || 0;
    }
    gx.fillText(initial, c, c + (asc - desc) / 2);
    var gd = gx.getImageData(0, 0, SIZE, SIZE).data;
    var N = SIZE * SIZE, hgt = new Float32Array(N), i, x, y;
    for (i = 0; i < N; i++) hgt[i] = gd[i * 4] / 255;
    hgt = blur(hgt, SIZE, SIZE, R * 0.012);

    // Only inside the sunken field.
    var rp = 0.72 * R;
    for (y = 0; y < SIZE; y++) for (x = 0; x < SIZE; x++) {
      var rho = Math.sqrt((x - c) * (x - c) + (y - c) * (y - c));
      var f = Math.min(1, Math.max(0, (rp - rho) / (0.035 * R)));
      f = f * f * (3 - 2 * f);
      hgt[y * SIZE + x] *= 0.24 * f;
    }
    var near = blur(hgt, SIZE, SIZE, R * 0.05);

    // The renderer's light.
    var L = [-0.45, -0.62, 0.65], ln = Math.hypot(L[0], L[1], L[2]);
    L = [L[0] / ln, L[1] / ln, L[2] / ln];
    var Hv = [L[0], L[1], L[2] + 1], hn = Math.hypot(Hv[0], Hv[1], Hv[2]);
    Hv = [Hv[0] / hn, Hv[1] / hn, Hv[2] / hn];
    var scale = R * 0.10;
    var diff0 = L[2], nh0 = Hv[2];
    var spec0 = Math.pow(nh0, 90) * 0.75 + Math.pow(nh0, 14) * 0.12;

    var out = document.createElement('canvas');
    out.width = out.height = SIZE;
    var ox = out.getContext('2d');
    ox.drawImage(blank, 0, 0, SIZE, SIZE);
    var img = ox.getImageData(0, 0, SIZE, SIZE), px = img.data;
    for (y = 1; y < SIZE - 1; y++) for (x = 1; x < SIZE - 1; x++) {
      i = y * SIZE + x;
      var dhx = (hgt[i + 1] - hgt[i - 1]) * 0.5 * scale;
      var dhy = (hgt[i + SIZE] - hgt[i - SIZE]) * 0.5 * scale;
      var ao = Math.min(1, Math.max(0.55, 1 - Math.min(1, Math.max(0, near[i] - hgt[i])) * 2.2));
      if (dhx === 0 && dhy === 0 && ao === 1) continue;
      var nl = Math.hypot(dhx, dhy, 1);
      var nx = -dhx / nl, ny = -dhy / nl, nz = 1 / nl;
      var diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      var nh = Math.max(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]);
      var rr = Math.sqrt((x - c) * (x - c) + (y - c) * (y - c));
      var ff = Math.min(1, Math.max(0, (rp - rr) / (0.035 * R)));
      ff = ff * ff * (3 - 2 * ff);
      var gloss = 1 - 0.45 * ff;
      var ds = ((Math.pow(nh, 90) * 0.75 + Math.pow(nh, 14) * 0.12) - spec0) * gloss * 255;
      var k = ((0.30 + 0.85 * diff) / (0.30 + 0.85 * diff0)) * ao;
      var p = i * 4;
      px[p] = px[p] * k + ds;
      px[p + 1] = px[p + 1] * k + ds * 0.94;
      px[p + 2] = px[p + 2] * k + ds * 0.86;
    }
    ox.putImageData(img, 0, 0);
    return out;
  }

  var cache = {};
  var blankImage = null;

  function url(initial) {
    if (!initial) return Promise.resolve(PLAIN);
    if (cache[initial]) return cache[initial];
    cache[initial] = Promise.all([
      blankImage || (blankImage = loadImage(BLANK)),
      document.fonts && document.fonts.load ? document.fonts.load('100px ' + FONT, initial).catch(function () {}) : null
    ]).then(function (r) {
      var cv = press(initial, r[0]);
      return new Promise(function (resolve) {
        if (cv.toBlob) cv.toBlob(function (b) { resolve(b ? URL.createObjectURL(b) : cv.toDataURL('image/png')); }, 'image/png');
        else resolve(cv.toDataURL('image/png'));
      });
    }).catch(function () { delete cache[initial]; return PLAIN; });
    return cache[initial];
  }

  /* Points every wax picture under root at this name's seal. The plain
     seal shows until the pressed one is ready (a few frames). */
  function apply(root, name) {
    var initial = initialOf(name);
    var imgs = Array.prototype.slice.call((root || document).querySelectorAll('img[src$="seal.webp"], img[data-wax]'));
    imgs.forEach(function (im) { im.setAttribute('data-wax', ''); });
    var want = initial || '';
    imgs.forEach(function (im) { im.setAttribute('data-initial', want); });
    return url(initial).then(function (u) {
      imgs.forEach(function (im) {
        if (im.getAttribute('data-initial') === want && im.getAttribute('src') !== u) im.src = u;
      });
      return u;
    });
  }

  window.DailiesSeal = { initialOf: initialOf, url: url, apply: apply, PLAIN: PLAIN };
})();
