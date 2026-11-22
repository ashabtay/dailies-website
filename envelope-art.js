/* ============================================================================
   The app's envelope and its motion, for the envelope pages and /e/

   /sealed/ (sealed.js) opens envelopes sealed in the app with the app's own
   rendered envelope and its animations. This file brings the same envelope
   to the pages where one is sealed on the web (/words-of-encouragement/ and
   the other three, in every language: encourage.js) and to /e/, where those
   open (envelope.js):

     sealing   the letter stands in the open envelope; once there is
               something to send, the wax arrives with "Hold to seal" set
               round it. Holding it draws the letter down and folds the flap
               over; at the end the wax lands with a flash of gold, a sheen
               crosses the paper and the stamp goes on. Let go early and the
               paper springs back open.
     changing  a new line: the letter drops into the pocket and comes back
               up with the new words and a little dust.
     opening   the seal cracks and falls away in a burst of gold, the flap
               lifts, the letter rises in light, the envelope drops away and
               the letter becomes the card.

   Pictures: /img/envelope/*.webp, rendered by tool/envelope/render_envelope.py
   in the app repo (the same files /sealed/ uses). Styles: envelope-art.css.
   Nothing moves under prefers-reduced-motion: each step just happens.

   Text from a link or a visitor only ever goes in with textContent.
   ========================================================================= */
(function () {
  'use strict';

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function svgEl(name, attrs, parent) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function chars(s) { return Array.from(String(s || '')).length; }
  function anim(el, frames, opts) {
    if (!el || !el.animate) return Promise.resolve();
    var a = el.animate(frames, opts);
    return a.finished ? a.finished.catch(function () {}) : new Promise(function (r) { a.onfinish = r; });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r };
  }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp01(t) { return Math.max(0, Math.min(1, t)); }

  /* Quote size in px on a 402px-wide card; the card scales it with its
     width. The steps the app's share card uses (sealed.js textSize). */
  function textSize(len) {
    if (len <= 80) return 33;
    if (len <= 160) return 27;
    if (len <= 260) return 22;
    return 18;
  }

  /* ------------------------------------------------------------ sparkles */
  /* The app's star flare, thrown and drifted on a canvas over the page, as
     on /sealed/. */
  var sparkles = (function () {
    var none = { burst: function () {}, dust: function () {} };
    if (reduce || !window.requestAnimationFrame || !document.createElement('canvas').getContext) return none;
    var img = new Image();
    img.src = '/img/envelope/sparkle.webp';
    var cv = null, ctx = null, dpr = 1, ps = [], running = false, last = 0, tints = {};
    function setup() {
      if (cv) return !!ctx;
      cv = document.createElement('canvas');
      cv.className = 'sparkles';
      cv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cv);
      ctx = cv.getContext('2d');
      size();
      window.addEventListener('resize', size);
      return !!ctx;
    }
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(innerWidth * dpr);
      cv.height = Math.round(innerHeight * dpr);
    }
    function tinted(color) {
      if (tints[color]) return tints[color];
      if (!img.complete || !img.naturalWidth) return null;
      var c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, c.width, c.height);
      return (tints[color] = c);
    }
    function add(x, y, vx, vy, life, sz, color, rise) {
      ps.push({ x: x, y: y, vx: vx, vy: vy, age: 0, life: life, size: sz, rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 2, color: color, tw: Math.random() * 6.283, rise: rise });
      if (ps.length > 400) ps.shift();
      if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    }
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000), t0 = now / 1000;
      last = now;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var drag = Math.pow(0.08, dt);
      for (var i = ps.length - 1; i >= 0; i--) {
        var p = ps[i];
        p.age += dt;
        if (p.age >= p.life) { ps.splice(i, 1); continue; }
        p.vx *= drag;
        p.vy = p.vy * drag - p.rise * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
        var t = p.age / p.life;
        var fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
        var tw = 0.65 + 0.35 * Math.sin(p.tw + t0 * 14);
        var sz = p.size * (0.7 + 0.3 * tw) * (1.1 - 0.4 * t);
        var sp = tinted(p.color);
        if (!sp) continue;
        ctx.globalAlpha = Math.max(0, fade * tw);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.drawImage(sp, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (ps.length) requestAnimationFrame(tick);
      else { running = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
    }
    var GOLD = '#FFD48A', EMBER = '#FF9A5C';
    return {
      burst: function (x, y, o) {
        if (!setup()) return;
        o = o || {};
        for (var i = 0, n = o.count || 28; i < n; i++) {
          var a = Math.random() * 6.283, v = (o.speed || 220) * (0.35 + Math.random() * 0.75);
          add(x, y, Math.cos(a) * v, Math.sin(a) * v, (o.life || 1.1) * (0.6 + Math.random() * 0.6),
            (o.size || 22) * (0.4 + Math.random() * 0.8), o.ember ? EMBER : GOLD, 30);
        }
      },
      dust: function (x, y, o) {
        if (!setup()) return;
        o = o || {};
        var j = o.jitter || 10, dx = o.dx || 0, dy = o.dy || 0;
        for (var i = 0, n = o.count || 2; i < n; i++) {
          add(x + (Math.random() - 0.5) * 2 * j, y + (Math.random() - 0.5) * 2 * (o.jitterY || j),
            dx + (Math.random() - 0.5) * 40, dy + (Math.random() - 0.5) * 40,
            (o.life || 1.3) * (0.6 + Math.random() * 0.7), (o.size || 16) * (0.35 + Math.random() * 0.85), GOLD, 18);
        }
      }
    };
  })();

  /* ---------------------------------------------------------- the stamp */
  /* The one Dailies stamp: a white perforated edge round the lining's navy,
     an old-gold frame and the gold closing quote mark (sealed.js paintStamp,
     the app's _StampFace). */
  var STAMP_MARK = 'M0.1722 0.9272L0.0828 0.8609Q0.1192 0.8146 0.1589 0.7285Q0.1987 0.6424 0.2235 0.5381Q0.2483 0.4338 0.2351 0.3344Q0.2119 0.3444 0.1921 0.3493Q0.1722 0.3543 0.1523 0.3543Q0.0894 0.3543 0.0447 0.3079Q0.0000 0.2616 0.0000 0.1921Q0.0000 0.0993 0.0546 0.0497Q0.1093 0.0000 0.1821 0.0000Q0.2980 0.0000 0.3576 0.0877Q0.4172 0.1755 0.4172 0.3013Q0.4172 0.3841 0.3858 0.5033Q0.3543 0.6225 0.2997 0.7368Q0.2450 0.8510 0.1722 0.9272ZM0.7550 0.9272L0.6656 0.8609Q0.7020 0.8146 0.7417 0.7285Q0.7815 0.6424 0.8063 0.5381Q0.8311 0.4338 0.8179 0.3344Q0.7947 0.3444 0.7748 0.3493Q0.7550 0.3543 0.7351 0.3543Q0.6722 0.3543 0.6275 0.3079Q0.5828 0.2616 0.5828 0.1921Q0.5828 0.0993 0.6374 0.0497Q0.6921 0.0000 0.7649 0.0000Q0.8808 0.0000 0.9404 0.0877Q1.0000 0.1755 1.0000 0.3013Q1.0000 0.3841 0.9685 0.5033Q0.9371 0.6225 0.8825 0.7368Q0.8278 0.8510 0.7550 0.9272Z';
  var stamps = 0;
  function paintStamp(box) {
    var W = 100, H = 122, R = 4.5, id = 'ea-perf' + (++stamps);
    box.textContent = '';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' }, box);
    var mask = svgEl('mask', { id: id }, svgEl('defs', {}, svg));
    svgEl('rect', { width: W, height: H, fill: '#fff' }, mask);
    var nx = Math.round(W / (R * 2.6)), ny = Math.round(H / (R * 2.6)), i;
    for (i = 0; i < nx; i++) {
      var x = ((i + 0.5) * W / nx).toFixed(2);
      svgEl('circle', { cx: x, cy: 0, r: R, fill: '#000' }, mask);
      svgEl('circle', { cx: x, cy: H, r: R, fill: '#000' }, mask);
    }
    for (i = 0; i < ny; i++) {
      var y = ((i + 0.5) * H / ny).toFixed(2);
      svgEl('circle', { cx: 0, cy: y, r: R, fill: '#000' }, mask);
      svgEl('circle', { cx: W, cy: y, r: R, fill: '#000' }, mask);
    }
    svgEl('rect', { width: W, height: H, fill: '#fff', mask: 'url(#' + id + ')' }, svg);
    var ix = 10, iy = 10, iw = W - 20, ih = H - 20;
    svgEl('rect', { x: ix, y: iy, width: iw, height: ih, fill: '#1E2942' }, svg);
    var inset = iw * 0.07, sw = iw * 0.025;
    svgEl('rect', { x: ix + inset, y: iy + inset, width: iw - 2 * inset, height: ih - 2 * inset,
      fill: 'none', stroke: '#C4A062', 'stroke-opacity': 0.85, 'stroke-width': sw }, svg);
    var mw = iw * 0.46, mh = mw * 0.9272;
    svgEl('path', { d: STAMP_MARK, fill: '#C4A062',
      transform: 'translate(' + (ix + (iw - mw) / 2).toFixed(2) + ' ' + (iy + (ih - mh) / 2 - ih * 0.02).toFixed(2) + ') scale(' + mw.toFixed(3) + ')' }, svg);
  }

  /* ------------------------------------------------------- the envelope */

  /* mode 'compose': open, the letter standing in it, the wax waiting.
     mode 'sealed':  closed, the wax on the flap. */
  function build(mode, opts) {
    opts = opts || {};
    var el = h('div', 'ea ea-' + mode);
    el.appendChild(h('div', 'ea-back'));
    var flap = h('div', 'ea-flap');
    flap.appendChild(h('div', 'ea-flap-out'));
    flap.appendChild(h('div', 'ea-flap-in'));
    el.appendChild(flap);
    var glow = h('div', 'ea-glow');
    el.appendChild(glow);
    var inside = h('div', 'ea-inside');
    var letter = h('div', 'ea-letter');
    inside.appendChild(letter);
    el.appendChild(inside);
    el.appendChild(h('div', 'ea-pocket'));
    var front = h('div', 'ea-front');
    var stamp = h('div', 'ea-stamp');
    paintStamp(stamp);
    front.appendChild(stamp);
    var name = h('p', 'ea-for');
    name.setAttribute('dir', 'auto');
    front.appendChild(name);
    el.appendChild(front);
    var parts = { el: el, flap: flap, glow: glow, inside: inside, letter: letter, name: name, stamp: stamp };

    if (mode === 'compose') {
      var ghost = h('span', 'ea-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      el.appendChild(ghost);
      var lab = svgEl('svg', { 'class': 'ea-label', viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false' }, el);
      var pid = 'ea-arc' + (++stamps);
      svgEl('path', { id: pid, d: 'M39.7,100 A60.3,60.3 0 0,0 160.3,100' }, svgEl('defs', {}, lab));
      svgEl('circle', { 'class': 'ea-ripple', cx: 100, cy: 100, r: 38.7 }, lab);
      svgEl('circle', { 'class': 'ea-ripple r2', cx: 100, cy: 100, r: 38.7 }, lab);
      svgEl('circle', { 'class': 'ea-track', cx: 100, cy: 100, r: 44.7 }, lab);
      var arc = svgEl('circle', { 'class': 'ea-arc', cx: 100, cy: 100, r: 44.7, pathLength: 100 }, lab);
      var tx = svgEl('text', {}, lab);
      var tp = svgEl('textPath', { href: '#' + pid, startOffset: '50%', 'text-anchor': 'middle' }, tx);
      parts.ghost = ghost; parts.arc = arc; parts.holdText = tp;
    }
    var seal = h('span', 'ea-seal');
    seal.setAttribute('aria-hidden', 'true');
    var body = h('span', 'ea-seal-body');
    ['l', 'r'].forEach(function (side) {
      var half = h('span', 'ea-half ' + side);
      var img = document.createElement('img');
      img.src = '/img/envelope/seal.webp';
      img.alt = '';
      img.draggable = false;
      half.appendChild(img);
      body.appendChild(half);
    });
    seal.appendChild(body);
    el.appendChild(seal);
    parts.seal = seal;
    if (mode === 'compose') {
      parts.impact = h('span', 'ea-impact');
      parts.sheen = h('span', 'ea-sheen');
      el.appendChild(parts.impact);
      el.appendChild(parts.sheen);
      var hit = h('button', 'ea-hit');
      hit.type = 'button';
      if (opts.holdLabel) hit.setAttribute('aria-label', opts.holdLabel);
      el.appendChild(hit);
      parts.hit = hit;
    }
    return parts;
  }

  /* "For Dana" in the hand, shrunk for a long name so it stays on the
     paper (and ellipsized past that). */
  function paintName(el, text, placeholder) {
    el.textContent = text;
    el.classList.toggle('is-placeholder', !!placeholder);
    // A kana or kanji is about two Latin letters wide in the hand.
    var n = 0;
    Array.from(String(text || '')).forEach(function (c) { n += /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(c) ? 1.8 : 1; });
    var size = Math.max(5.5, Math.min(9.5, 84 / (0.37 * Math.max(1, n))));
    el.style.setProperty('--nfs', size.toFixed(2) + 'cqw');
  }

  /* "Hold to seal" round the lower edge of the wax, never more than about
     two thirds of the way round. */
  function paintHoldText(parts, label) {
    var t = parts.holdText;
    t.textContent = String(label).toUpperCase();
    try {
      var most = Math.PI * 60.3 * 1.15;
      var len = t.getComputedTextLength();
      if (len > most) {
        var k = most / len;
        t.parentNode.style.fontSize = (13 * k).toFixed(2) + 'px';
        t.parentNode.style.letterSpacing = (2 * k).toFixed(2) + 'px';
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------ the composer */
  /* opts: holdLabel, onSeal(how) once the wax has landed (how: hold | key),
     onHold(p) every frame of a hold, onRelease(p) a hold let go early. */
  function composer(parts, opts) {
    var el = parts.el;
    var hit = parts.hit;
    var SEAL_MS = 1000; // the app's hold
    var st = { ready: false, sealed: false, swapping: false };
    if (opts.holdLabel) paintHoldText(parts, opts.holdLabel);

    function setReady(ok) {
      var was = st.ready;
      st.ready = !!ok;
      el.classList.toggle('is-ready', st.ready);
      hit.disabled = !st.ready;
      // The wax arriving, with a glint.
      if (st.ready && !was && !st.sealed) {
        setTimeout(function () {
          if (!st.ready || st.sealed) return;
          var g = centerOf(parts.ghost);
          if (g.r.width) sparkles.burst(g.x, g.y, { count: 12, speed: 100, size: 14, life: 0.9 });
        }, 260);
      }
    }

    function progress(p) {
      if (st.sealed) return;
      el.classList.toggle('is-holding', p > 0);
      var fold = ease(clamp01((p - 0.3) / 0.7));
      el.style.setProperty('--down', ease(clamp01(p / 0.45)).toFixed(4));
      el.style.setProperty('--fold', fold.toFixed(4));
      el.style.setProperty('--press', p.toFixed(4));
      el.classList.toggle('is-past', fold > 0.5);
      parts.arc.style.strokeDashoffset = String(100 - p * 100);
      parts.holdText.parentNode.style.opacity = String(1 - clamp01(p * 4));
      // Heat coming off the wax while it is held.
      if (p > 0.05 && Math.random() < 0.3 + 0.4 * p) {
        var g = centerOf(parts.ghost);
        var a = Math.random() * 6.283, r = g.r.width * 0.42;
        sparkles.dust(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r, { count: 1, jitter: 2, dy: -40, size: 10 + 8 * p, life: 0.8 });
      }
    }

    function clearHold() {
      el.classList.remove('is-holding', 'is-past');
      el.style.removeProperty('--down');
      el.style.removeProperty('--fold');
      el.style.removeProperty('--press');
      parts.arc.style.strokeDashoffset = '100';
      parts.holdText.parentNode.style.opacity = '';
    }

    function released(p) {
      if (st.sealed) return;
      if (p > 0 && p < 1) {
        if (opts.onRelease) opts.onRelease(p);
        el.classList.add('is-spring');
        setTimeout(function () { el.classList.remove('is-spring'); }, 450);
      }
      clearHold();
    }

    /* The wax lands. After a hold the letter is already in and the flap
       already over, so it lands at once; from the keyboard the envelope
       closes first. */
    function seal(how) {
      if (st.sealed || !st.ready) { released(0); return; }
      st.sealed = true;
      var held = how === 'hold';
      try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
      el.classList.toggle('is-held', held);
      clearHold();
      el.classList.add('is-sealed');
      var delay = held ? 0 : 640;
      setTimeout(function () {
        var mc = centerOf(parts.seal);
        sparkles.burst(mc.x, mc.y, { count: 40, speed: 260, size: 26, life: 1.3 });
        sparkles.burst(mc.x, mc.y, { count: 12, speed: 110, size: 12, life: 0.8, ember: true });
        if (reduce) return;
        anim(parts.impact, [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: 'translate(-50%,-50%) scale(3.6)', opacity: 0 }
        ], { duration: 820, easing: 'cubic-bezier(.2,.7,.3,1)' });
        anim(parts.sheen, [
          { opacity: 1, transform: 'translateX(-100%)' },
          { opacity: 1, transform: 'translateX(100%)' }
        ], { duration: 900, delay: 280, easing: 'ease-in-out' });
      }, delay);
      if (!reduce) {
        anim(parts.seal, held ? [
          { transform: 'translate(-50%,-50%) scale(1.45)', opacity: 0 },
          { transform: 'translate(-50%,-50%) scale(.95)', opacity: 1, offset: 0.35 },
          { transform: 'translate(-50%,-50%) scale(1.02)', opacity: 1, offset: 0.7 },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }
        ] : [
          { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0 },
          { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0, offset: 0.45 },
          { transform: 'translate(-50%,-50%) scale(.9)', opacity: 1, offset: 0.8 },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }
        ], { duration: held ? 520 : 820, easing: 'cubic-bezier(.3,0,.3,1)' });
      }
      // The stamp is on by ~1.2s; then the ways to send it.
      setTimeout(function () { if (opts.onSeal) opts.onSeal(how); }, reduce ? 0 : delay + 1250);
    }

    /* Back open, the letter rising out again with a little dust. */
    function unseal() {
      if (!st.sealed) return;
      st.sealed = false;
      el.classList.remove('is-sealed', 'is-held');
      if (!reduce) {
        setTimeout(function () {
          var m = el.getBoundingClientRect();
          sparkles.dust(m.left + m.width / 2, m.top + 4, { count: 10, jitter: m.width * 0.3, jitterY: 4, dy: -70, size: 14, life: 1.2 });
        }, 500);
      }
    }

    /* The letter goes down into the envelope, change() swaps its words,
       and it comes back up with a little dust. */
    function swap(change) {
      var card = parts.letter.firstElementChild;
      if (st.sealed) return;
      if (reduce || !card || !card.animate || st.swapping) { change(); return; }
      st.swapping = true;
      // The words change when the letter is down, or in any case after
      // 300ms: a page whose animations are held back (a background tab)
      // still gets the new line.
      var changed = false;
      function doChange() { if (!changed) { changed = true; change(); } }
      setTimeout(doChange, 300);
      setTimeout(function () { st.swapping = false; }, 900);
      anim(card, [{ transform: 'translateY(0)' }, { transform: 'translateY(96%)' }],
        { duration: 200, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).then(function () {
        doChange();
        var m = el.getBoundingClientRect();
        sparkles.dust(m.left + m.width / 2, m.top + 4, { count: 10, jitter: m.width * 0.3, jitterY: 4, dy: -70, size: 14, life: 1.2 });
        return anim(card, [
          { transform: 'translateY(96%)' },
          { transform: 'translateY(-3%)', offset: 0.75 },
          { transform: 'translateY(0)' }
        ], { duration: 420, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'forwards' });
      }).then(function () {
        try { card.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
        st.swapping = false;
      });
    }

    holdable(hit, SEAL_MS, seal, progress, released);
    return { setReady: setReady, seal: seal, unseal: unseal, swap: swap, state: st };
  }

  /* A press and hold: progress(p) every frame, done('hold') at the end,
     release(p) when let go early. Enter or Space on the button seals at
     once ('key'). */
  function holdable(btn, ms, done, progress, release) {
    var raf = 0, start = 0, active = false, last = 0;
    function paint(p) { last = p; progress(p); }
    function stop() {
      active = false;
      cancelAnimationFrame(raf);
      var got = last;
      last = 0;
      release(got);
    }
    function frame(now) {
      if (!active) return;
      var p = Math.min(1, (now - start) / ms);
      paint(p);
      if (p >= 1) { active = false; last = 0; done('hold'); return; }
      raf = requestAnimationFrame(frame);
    }
    btn.addEventListener('pointerdown', function (e) {
      if (btn.disabled || (e.button !== undefined && e.button > 0)) return;
      e.preventDefault();
      // A name still being typed: let the keyboard go, so the envelope is
      // in full view while it closes.
      var ae = document.activeElement;
      if (ae && ae !== btn && ae.blur && /INPUT|TEXTAREA/.test(ae.tagName)) ae.blur();
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      active = true;
      start = performance.now();
      raf = requestAnimationFrame(frame);
    });
    function up() { if (active) stop(); }
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (e.detail === 0) done('key'); // keyboard
    });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* --------------------------------------------------------- the opening */
  /* parts: a 'sealed' envelope; stage: what holds it (it drops away);
     chrome: things round it that step back first; showCard(): puts the
     opened card on the page and returns it, measured where it will rest.
     Resolves once the card has settled. */
  function open(parts, stage, chrome, showCard) {
    var el = parts.el;
    if (reduce || !el.animate) {
      showCard();
      return Promise.resolve();
    }
    stage.classList.remove('is-idle');
    var halves = Array.prototype.slice.call(parts.seal.querySelectorAll('.ea-half'));
    var body = Array.prototype.slice.call(el.querySelectorAll('.ea-back, .ea-pocket, .ea-front'));
    var flapIn = parts.flap.querySelector('.ea-flap-in');

    (chrome || []).forEach(function (c) {
      anim(c, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }],
        { duration: 260, easing: 'ease-in', fill: 'forwards' });
    });

    // 1. The seal cracks and falls away, in a flash of gold.
    var sc = centerOf(parts.seal);
    sparkles.burst(sc.x, sc.y, { count: 44, speed: 300, size: 30, life: 1.3 });
    sparkles.burst(sc.x, sc.y, { count: 12, speed: 120, size: 14, life: 0.8, ember: true });
    anim(halves[0], [
      { transform: 'none', opacity: 1 },
      { transform: 'translate(-5%, 1%) rotate(-7deg)', opacity: 1, offset: 0.22 },
      { transform: 'translate(-38%, 160%) rotate(-38deg)', opacity: 0 }
    ], { duration: 620, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
    anim(halves[1], [
      { transform: 'none', opacity: 1 },
      { transform: 'translate(5%, 0) rotate(6deg)', opacity: 1, offset: 0.22 },
      { transform: 'translate(34%, 150%) rotate(32deg)', opacity: 0 }
    ], { duration: 620, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });

    return wait(200).then(function () {
      // 2. The flap lifts; its outside turns into its inside as it passes
      //    upright.
      anim(flapIn, [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }],
        { duration: 420, fill: 'forwards' });
      return anim(parts.flap, [
        { transform: 'perspective(900px) rotateX(0deg)' },
        { transform: 'perspective(900px) rotateX(180deg)' }
      ], { duration: 420, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
    }).then(function () {
      parts.flap.style.zIndex = 2;
      // 3. The letter rises in light, dust coming up with it; the envelope
      //    drops away underneath.
      anim(parts.glow, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: 1100, easing: 'ease-out' });
      var ec = centerOf(el);
      sparkles.dust(ec.x, ec.r.top + 6, { count: 26, jitter: ec.r.width * 0.32, jitterY: 6, dy: -90, size: 20, life: 1.7 });
      anim(parts.letter, [{ transform: 'translateY(0)' }, { transform: 'translateY(-46%)' }],
        { duration: 560, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
      return wait(140).then(function () {
        return Promise.all([
          anim(parts.flap, [
            { transform: 'perspective(900px) rotateX(180deg)', opacity: 1 },
            { transform: 'perspective(900px) rotateX(180deg) translateY(-40px)', opacity: 0 }
          ], { duration: 480, easing: 'ease-in', fill: 'forwards' })
        ].concat(body.map(function (b) {
          return anim(b, [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(90px)', opacity: 0 }
          ], { duration: 480, easing: 'ease-in', fill: 'forwards' });
        })));
      });
    }).then(function () {
      // 4. The letter becomes the card: measure both, swap, and glide.
      parts.inside.style.clipPath = 'none';
      var from = parts.letter.getBoundingClientRect();
      var card = showCard();
      var to = card.getBoundingClientRect();
      var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
      var dy = (from.top + from.height / 2) - (to.top + to.height / 2);
      var s = from.width / to.width;
      return anim(card, [
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')' },
        { transform: 'none' }
      ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' }).then(function () { return card; });
    }).then(function (card) {
      // 5. A twinkle as the card settles.
      var cr = card.getBoundingClientRect();
      sparkles.dust(cr.left + cr.width / 2, cr.top + cr.height * 0.45,
        { count: 20, jitter: cr.width * 0.45, jitterY: cr.height * 0.45, size: 18, life: 1.4 });
    });
  }

  window.DailiesEnvelopeArt = {
    build: build, composer: composer, open: open, paintName: paintName,
    textSize: textSize, chars: chars, sparkles: sparkles, reduce: reduce
  };
})();
