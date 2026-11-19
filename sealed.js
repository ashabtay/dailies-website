/* ============================================================================
   The receiving end of a Dailies envelope - mydailies.app/sealed/#<payload>

   Somebody sealed a quote for a friend in the app and sent it as a text
   message. This file opens it: decodes the link, shows the sealed envelope,
   plays the opening, shows the quote, and offers the way back - "Send one
   back", which hands off to the app when it is installed and falls back to a
   small composer on this page when it is not.

   ---------------------------------------------------------------------------
   The link
   ---------------------------------------------------------------------------
   https://mydailies.app/sealed/#<base64url(JSON)>, padding stripped. Everything is
   in the fragment, and a browser never sends the fragment to a server, so no
   server - ours included - ever sees the names or the quote. The fields:

     v     1                      (anything else: invalid, reason `version`)
     to    receiver name          1-40 characters
     from  sender name            1-40 characters
     t     the quote as read      1-600 characters, may hold newlines
     a     author or null
     q     corpus quote id or null
     o     true when the sender wrote the line themselves
     p     optional: the line with a {name} token, so it can be passed on
     n     optional: this envelope's place in the back-and-forth (1 = first)
     w     optional: "open when" key - hard, doubt, night, win, friend.
           Older links only: neither the app nor the web composer below
           sends it any more, but a link that carries it still shows it.
     l     optional: the sender's app language, en or es
     b     optional: the sender's background, by the app's id
           (mtn_peak_dawn), when it is one of the bundled photographs
     c     optional: the sender's background when it is a flat color, #rrggbb

   A malformed b or c is dropped, not fatal: the envelope still opens on the
   house photograph. The background shows on the letter, the opened card and
   the postage stamp; only ids in BACKGROUNDS below are ever requested.

   ---------------------------------------------------------------------------
   Rules this file keeps
   ---------------------------------------------------------------------------
   - Every name and every quote goes into the page with textContent, never
     innerHTML, on an element with dir="auto" so a Hebrew or Arabic name reads
     the right way round inside English copy.
   - No event is named here. Measurement goes through
     window.dailiesAnalytics.envelope(), which lives in analytics.js with the
     rest of the site's events and never accepts a name or a line of text.
   - The cookie banner waits for the envelope. consent.js holds it back on a
     page whose body says data-consent="deferred", and this file releases it
     with a `dailies:consent-ready` event once the opening has finished.

   The pure functions (decode, encode, validate, textSize, personalize,
   ordinal, lookFor, messageFor) are exposed on window.DailiesEnvelope for
   /sealed/test.html.
   ========================================================================= */
(function () {
  'use strict';

  // Where every App Store badge goes, with this page's own campaign token
  // so its installs read apart from /e/'s `web-envelope`.
  var APP_URL = 'https://apps.apple.com/us/app/dailies-motivational-quotes/id6804210416?pt=129347926&ct=web-app-envelope&mt=8';

  var MAX_NAME = 40;
  var MAX_TEXT = 600;
  var WHEN_KEYS = ['hard', 'doubt', 'night', 'win', 'friend'];

  /* The app's backgrounds this site also carries, at
     /img/wallpapers/bg/<id with hyphens>.jpg. A `b` outside this list (a
     newer photo, the sender's own picture) gets the house photograph. */
  var BACKGROUNDS = [
    'desert_dusk', 'field_valley_dawn', 'forest_crossing', 'forest_fog_canopy',
    'mtn_blue_ridges', 'mtn_fjord', 'mtn_peak_dawn', 'night_aurora',
    'night_lake', 'night_milky_way', 'night_starlit_peaks', 'night_stars_over_pines',
    'sea_sunset_surf', 'sky_cloud_line', 'sky_storm_front', 'zen_misty_pier'
  ];
  var HOUSE = '/sealed/house.jpg';
  var BG_ID = /^[a-z0-9_]{1,40}$/;
  var HEX = /^#[0-9a-fA-F]{6}$/;

  /* ------------------------------------------------------------ the lines */
  /* The house lines the web composer offers. Each has a personalized form;
     ids are the corpus ids, so an envelope sealed on the web is the same
     quote the app would have sent. */

  var LINES = [
    ['03944f7f-93c1-4d96-bba1-47761e9c72be', 'You showed up, {name}. That is not nothing. That is most of it.', 'Te presentaste, {name}. Eso no es poca cosa. Eso es casi todo.'],
    ['0a18924d-9789-4a5a-a2d7-c6b2562f2029', 'You did what you could with the day you had, {name}.', 'Hiciste lo que pudiste con el día que tenías, {name}.'],
    ['26024202-a121-44cc-95a7-649d06a80b30', 'You will not see it, {name}. Other people will, before you do.', 'Tú no lo vas a ver, {name}. Otros sí, antes que tú.'],
    ['2610a697-225e-4578-b44a-62a081a331c0', 'You were wanted before you were useful, {name}.', 'Te quisieron antes de que fueras útil, {name}.'],
    ['5e8505ab-f839-4354-8db0-f501d48b115e', 'You have already changed enormously and hardly noticed, {name}.', 'Ya cambiaste muchísimo y casi no lo notaste, {name}.'],
    ['61c9fdaa-797b-47a0-a284-ece0fd0cfc31', 'You are allowed to rest, {name}.', 'Tienes permiso de descansar, {name}.'],
    ['6bc02a4d-3126-4fa9-beeb-2788d07cc098', 'You are not alone in this, {name}.', 'No estás en esto por tu cuenta, {name}.'],
    ['78c819d8-b29f-4e14-9e9d-c01f8aacaa82', '{name}, you are early, not late.', 'Vas temprano, no tarde, {name}.'],
    ['b43fe8bd-f189-4dc7-811b-b7dd5c8cf660', 'You are on your own timeline and there is no other one, {name}.', 'Vas en tu propia línea de tiempo y no hay otra, {name}.'],
    ['c3f5df9d-cd41-4d81-9ee6-8ae50daeb9ec', 'You are further along than you feel, {name}.', 'Vas más adelante de lo que sientes, {name}.'],
    ['c8e3d4bf-4ed0-4306-80c6-93e341be6f14', 'You are not behind, {name}.', 'No te has quedado atrás, {name}.'],
    ['d193ee19-f84e-43a0-9c37-459db8c21ec2', 'You have solved problems you no longer remember having, {name}.', 'Has resuelto problemas que ya ni recuerdas haber tenido, {name}.'],
    ['d3b6119c-cf07-42a8-9a65-d3d073ee6a2a', 'You are doing better than you think, {name}.', 'Lo estás haciendo mejor de lo que crees, {name}.'],
    ['e2665eba-bd1c-4549-ba25-e33421c28cc5', 'You are not required to be all right, {name}. Only to be here.', 'No se te exige estar bien, {name}. Solo estar aquí.']
  ];

  /* -------------------------------------------------------------- strings */
  /* {to} and {from} are names and are never interpolated as text: fill()
     splits the string around them and drops each name into its own
     dir="auto" span. */

  var STRINGS = {
    en: {
      title: 'An envelope for you',
      label: 'Someone thought of you',
      forName: 'For {to}',
      sealedBy: 'Sealed by {from}',
      sealedA11y: 'An envelope for {to}, sealed by {from}',
      openIt: 'Open it',
      openNote: 'No app needed. It takes a second.',
      sealAria: 'Press and hold the seal to break it',
      when: {
        hard: 'Open when it’s a hard day',
        doubt: 'Open when you doubt yourself',
        night: 'Open when you can’t sleep',
        win: 'Open when something goes right',
        friend: 'Open when you need a friend'
      },
      postmark: 'No. {n}',
      picked: '{from} picked this one for you.',
      thread: 'Your {ord} envelope with {from}',
      threadNo: 'Envelope No. {n} with {from}',
      ordinals: ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'],
      sendBack: 'Send one back to {from}',
      badgeAlt: 'Download on the App Store',
      getNote: 'Once Dailies is installed, come back to this envelope and tap Send one back.',
      privacy: 'Privacy',
      cookies: 'Cookie settings',
      badTitle: 'This envelope didn’t survive the trip.',
      badBody: 'Ask whoever sent it to send it again, or get the app and seal one yourself.',
      noscript: 'This envelope needs JavaScript to open.',
      // composer
      backTitle: 'Send one back',
      close: 'Close',
      toLabel: 'To',
      theirName: 'Their name',
      noteLabel: 'A short line',
      noteHint: 'Optional, under their name',
      yourName: 'Your name',
      someone: 'someone',
      changeLine: 'Change line',
      writeOwn: 'Write your own',
      useLine: 'Use a line',
      ownHint: 'Write your own words',
      holdToSeal: 'Hold to seal',
      sealHint: 'Press and hold the wax to seal it.',
      needNames: 'Add both names, then hold the wax to seal it.',
      sealedTitle: 'Sealed. Now send it.',
      share: 'Share',
      whatsapp: 'WhatsApp',
      messages: 'Messages',
      copy: 'Copy',
      copied: 'Copied',
      edit: 'Change something',
      sent: 'Sent',
      nudge: 'Dailies can put a line like this on your Lock Screen every day, some with your name in them.',
      done: 'Done',
      // The text message the link rides in: the words /e/ sends (play.js
      // msgRead), so neither envelope says "envelope" before it is opened.
      message: '{to}, I thought of you when I read this.'
    },
    es: {
      title: 'Un sobre para ti',
      label: 'Alguien pensó en ti',
      forName: 'Para {to}',
      sealedBy: 'Sellado por {from}',
      sealedA11y: 'Un sobre para {to}, sellado por {from}',
      openIt: 'Ábrelo',
      openNote: 'No necesitas la app. Toma un segundo.',
      sealAria: 'Mantén presionado el sello para romperlo',
      when: {
        hard: 'Ábrelo en un día difícil',
        doubt: 'Ábrelo cuando dudes de ti',
        night: 'Ábrelo cuando no puedas dormir',
        win: 'Ábrelo cuando algo salga bien',
        friend: 'Ábrelo cuando necesites compañía'
      },
      postmark: 'N.º {n}',
      picked: '{from} eligió esta frase para ti.',
      thread: 'Tu {ord} sobre con {from}',
      threadNo: 'Sobre n.º {n} con {from}',
      ordinals: ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'],
      sendBack: 'Mándale uno a {from}',
      badgeAlt: 'Descárgalo en el App Store',
      getNote: 'Cuando tengas Dailies, vuelve a este sobre y toca Mándale uno.',
      privacy: 'Privacidad',
      cookies: 'Cookies',
      badTitle: 'Este sobre no sobrevivió el viaje.',
      badBody: 'Pídele a quien te lo mandó que lo envíe de nuevo, o descarga la app y sella uno tú.',
      noscript: 'Este sobre necesita JavaScript para abrirse.',
      backTitle: 'Mándale uno',
      close: 'Cerrar',
      toLabel: 'Para',
      theirName: 'Su nombre',
      noteLabel: 'Una frase corta',
      noteHint: 'Opcional, bajo su nombre',
      yourName: 'Tu nombre',
      someone: 'alguien',
      changeLine: 'Cambiar frase',
      writeOwn: 'Escribe la tuya',
      useLine: 'Usar una frase',
      ownHint: 'Escribe tus propias palabras',
      holdToSeal: 'Mantén presionado para sellar',
      sealHint: 'Mantén presionada la cera para sellarlo.',
      needNames: 'Escribe los dos nombres y mantén presionada la cera para sellarlo.',
      sealedTitle: 'Listo, está sellado. Ahora envíalo.',
      share: 'Compartir',
      whatsapp: 'WhatsApp',
      messages: 'Mensajes',
      copy: 'Copiar',
      copied: 'Copiado',
      edit: 'Cambiar algo',
      sent: 'Enviado',
      nudge: 'Dailies puede poner una frase así en tu pantalla bloqueada cada día, algunas con tu nombre.',
      done: 'Listo',
      message: '{to}, pensé en ti cuando leí esto.'
    }
  };

  /* ====================================================== pure functions */

  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error('alphabet');
    var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // fatal: a link cut short in the middle of a multi-byte name is broken,
    // not something to render with replacement characters.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  // Length the way a reader counts it: an emoji or a Hebrew letter is one.
  function chars(s) { return Array.from(s).length; }

  var CONTROL = /[\u0000-\u001f\u007f]/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function validName(s) {
    if (typeof s !== 'string') return null;
    var t = s.trim();
    var n = chars(t);
    if (n < 1 || n > MAX_NAME || CONTROL.test(t)) return null;
    return t;
  }

  /* Checks a decoded object and returns the envelope, or {error: reason}. */
  function validate(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: 'field' };
    if (obj.v !== 1) return { error: 'version' };

    var to = validName(obj.to);
    var from = validName(obj.from);
    if (!to || !from) return { error: 'field' };

    if (typeof obj.t !== 'string') return { error: 'field' };
    var t = obj.t.replace(/\r\n?/g, '\n');
    if (!t.trim() || chars(t) > MAX_TEXT) return { error: 'field' };

    var a = obj.a === undefined ? null : obj.a;
    if (a !== null) {
      if (typeof a !== 'string') return { error: 'field' };
      a = a.trim();
      if (chars(a) > 200) return { error: 'field' };
      if (!a) a = null;
    }

    var q = obj.q === undefined ? null : obj.q;
    if (q !== null && (typeof q !== 'string' || !UUID.test(q))) return { error: 'field' };

    var o = obj.o === undefined ? false : obj.o;
    if (typeof o !== 'boolean') return { error: 'field' };

    var env = { v: 1, to: to, from: from, t: t, a: a, q: q ? q.toLowerCase() : null, o: o };

    // Prototype additions. Absent in older links; checked when present.
    if (obj.p !== undefined && obj.p !== null) {
      if (typeof obj.p !== 'string' || !obj.p.trim() || chars(obj.p) > MAX_TEXT) return { error: 'field' };
      env.p = obj.p.replace(/\r\n?/g, '\n');
    }
    if (obj.n !== undefined && obj.n !== null) {
      if (typeof obj.n !== 'number' || !Number.isInteger(obj.n) || obj.n < 1 || obj.n > 99999) return { error: 'field' };
      env.n = obj.n;
    }
    // An unknown "open when" key is ignored rather than fatal: a newer app
    // may know a key this page does not yet.
    if (typeof obj.w === 'string' && WHEN_KEYS.indexOf(obj.w) !== -1) env.w = obj.w;
    if (obj.l !== undefined && obj.l !== null) {
      if (typeof obj.l !== 'string') return { error: 'field' };
      if (obj.l === 'en' || obj.l === 'es') env.l = obj.l;
    }
    // The sender's look. Decoration, so a bad value drops the field and
    // never the envelope.
    if (typeof obj.b === 'string' && BG_ID.test(obj.b)) env.b = obj.b;
    if (typeof obj.c === 'string' && HEX.test(obj.c)) env.c = obj.c;
    var m = cleanNote(obj.m);
    if (m) env.m = m;
    return env;
  }

  /* A short line written under the name: one line, at most MAX_NOTE
     characters, or nothing. Decoration, so a bad one is dropped, never the
     envelope. The app's EnvelopePayload.cleanNote does the same. */
  var MAX_NOTE = 60;
  function cleanNote(raw) {
    if (typeof raw !== 'string') return null;
    var s = raw.replace(/\s+/g, ' ').trim();
    if (!s || chars(s) > MAX_NOTE) return null;
    return s;
  }

  /* The fragment (without the #) to an envelope, or {error: reason}. */
  function decode(fragment) {
    var s = (fragment || '').replace(/^#/, '').replace(/\s+/g, '').replace(/=+$/, '');
    if (!s) return { error: 'empty' };
    if (s.length > 8000) return { error: 'decode' };
    var json, obj;
    try { json = b64urlDecode(s); } catch (e) { return { error: 'decode' }; }
    try { obj = JSON.parse(json); } catch (e) { return { error: 'decode' }; }
    return validate(obj);
  }

  /* An envelope object to the payload string that follows the #. */
  function encode(env) {
    return b64urlEncode(JSON.stringify(env));
  }

  /* Quote size in px on a 402px-wide card; the card scales it with its
     width. The same steps the app's share card uses. */
  function textSize(len) {
    if (len <= 80) return 33;
    if (len <= 160) return 27;
    if (len <= 260) return 22;
    return 18;
  }

  function personalize(template, name) {
    return String(template).split('{name}').join(name);
  }

  /* 3 -> "third" (or "tercer"); past ten, "No. 14". */
  function ordinal(n, lang) {
    var S = STRINGS[lang] || STRINGS.en;
    if (n >= 1 && n <= 10) return S.ordinals[n - 1];
    return S.postmark.replace('{n}', String(n));
  }

  /* What the letter, the card and the stamp are printed with: the sender's
     photograph when the site has it, else their flat color, else the house
     photograph. {src} for a picture, {color} for a flat color. */
  function lookFor(env) {
    if (env && env.b && BACKGROUNDS.indexOf(env.b) !== -1) {
      return { src: '/img/wallpapers/bg/' + env.b.replace(/_/g, '-') + '.jpg', color: null };
    }
    if (env && env.c && HEX.test(env.c)) return { src: null, color: env.c };
    return { src: HOUSE, color: null };
  }

  /* The text message a link sealed on this page travels in. split/join, not
     replace, so a name like "$&" stays a name. */
  function messageFor(to, link, lang) {
    var S = STRINGS[lang] || STRINGS.en;
    return S.message.split('{to}').join(to) + '\n' + link;
  }

  function platformGuess() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  window.DailiesEnvelope = {
    decode: decode,
    encode: encode,
    validate: validate,
    textSize: textSize,
    personalize: personalize,
    ordinal: ordinal,
    lookFor: lookFor,
    messageFor: messageFor,
    BACKGROUNDS: BACKGROUNDS,
    LINES: LINES,
    STRINGS: STRINGS
  };

  /* ========================================================== the page */

  var root = document.getElementById('envelope-page');
  if (!root) return; // loaded by the test page: pure functions only

  var params = new URLSearchParams(location.search);
  var AUTO = params.get('auto'); // debug: 1 opens, compose opens the composer
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PLATFORM = platformGuess();
  var RAW = location.hash.replace(/^#/, '');
  var ENV = decode(RAW);
  var LANG = (ENV && ENV.l) || ((navigator.language || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'en');
  var S = STRINGS[LANG];
  var shownAt = Date.now();

  document.documentElement.lang = LANG;
  document.title = S.title;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function text(el, s) { if (el) el.textContent = s; return el; }

  /* Writes a template into el, each {var} as its own dir="auto" span. */
  function fill(el, template, vars) {
    if (!el) return;
    el.textContent = '';
    var parts = template.split(/(\{[a-z]+\})/);
    parts.forEach(function (p) {
      var m = /^\{([a-z]+)\}$/.exec(p);
      if (m && vars[m[1]] !== undefined) {
        var span = document.createElement('span');
        span.className = 'nm';
        span.setAttribute('dir', 'auto');
        span.textContent = vars[m[1]];
        el.appendChild(span);
      } else if (p) {
        el.appendChild(document.createTextNode(p));
      }
    });
  }

  function track(kind, props) {
    try {
      if (window.dailiesAnalytics && window.dailiesAnalytics.envelope) window.dailiesAnalytics.envelope(kind, props);
    } catch (e) {}
  }

  function baseProps() {
    return {
      own: !!ENV.o,
      has_author: !!ENV.a,
      text_length: chars(ENV.t),
      quote_id: ENV.q || null,
      thread_n: ENV.n || null,
      open_when: ENV.w || null
    };
  }

  function cta(action, extra) {
    var p = { action: action, platform_guess: PLATFORM };
    if (extra) for (var k in extra) p[k] = extra[k];
    track('cta', p);
  }

  /* Lets consent.js show its banner. Not while the composer is open - the
     banner is a modal and would land on top of somebody mid-sentence - and
     never on a ?auto= debug view, which then loads nothing at all. */
  var consentReleased = false, consentWanted = false;
  function releaseConsent() {
    consentWanted = true;
    if (consentReleased || AUTO) return;
    if (sheetIsOpen()) return; // closeComposer() calls back in
    consentReleased = true;
    document.dispatchEvent(new CustomEvent('dailies:consent-ready'));
  }
  function sheetIsOpen() {
    var sh = document.getElementById('sheet');
    return !!(sh && !sh.hidden);
  }

  // Static chrome.
  $all('[data-s]').forEach(function (el) { text(el, S[el.getAttribute('data-s')]); });
  $all('[data-s-aria]').forEach(function (el) { el.setAttribute('aria-label', S[el.getAttribute('data-s-aria')]); });
  $all('[data-s-placeholder]').forEach(function (el) { el.setAttribute('placeholder', S[el.getAttribute('data-s-placeholder')]); });

  // Apple's badge, in the page's language, as play.js draws it elsewhere.
  function wireGetApp(a) {
    a.href = APP_URL;
    var img = $('img', a);
    if (img) {
      img.src = '/img/app-store-badge' + (LANG === 'en' ? '' : '-' + LANG) + '.svg';
      img.alt = S.badgeAlt;
    }
    a.addEventListener('click', function () {
      cta('get_app');
      $all('.get-note').forEach(function (n) { n.hidden = false; });
    });
  }
  $all('[data-get-app]').forEach(wireGetApp);

  /* ------------------------------------------------------------- invalid */

  if (ENV.error) {
    $('#invalid').hidden = false;
    root.setAttribute('data-state', 'invalid');
    track('invalid', { reason: ENV.error });
    setTimeout(releaseConsent, 1400);
    return;
  }

  /* ------------------------------------------------------------- the card */

  function buildCard(card, line, author, lang) {
    var q = $('.qc-text', card);
    var fs = textSize(chars(line));
    text(q, line);
    q.style.setProperty('--fs', fs);
    card.setAttribute('data-fs', String(fs));
    var by = $('.qc-by', card);
    if (author) { text(by, '- ' + author); by.hidden = false; }
    else { by.textContent = ''; by.hidden = true; }
  }

  /* ------------------------------------------------------ the envelope */

  /* The sender's background on a quote card: a photograph, or a flat color
     under the same scrim (the words are always white). */
  function paintLook(card, look) {
    var img = $('.qc-img', card);
    if (look.color) {
      card.classList.add('flat');
      card.style.backgroundColor = look.color;
      img.removeAttribute('src');
    } else {
      card.classList.remove('flat');
      card.style.backgroundColor = '';
      img.src = look.src;
    }
  }

  /* The postage stamp: a white perforated edge round the same background.
     Built here because each needs its own mask id. */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var stamps = 0;
  function svgEl(name, attrs, parent) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function paintStamp(box, look) {
    var W = 100, H = 122, R = 4.5, id = 'perf' + (++stamps);
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
    var inner = { x: 10, y: 10, width: W - 20, height: H - 20 };
    if (look.color) {
      inner.fill = look.color;
      svgEl('rect', inner, svg);
    } else {
      inner.href = look.src;
      inner.preserveAspectRatio = 'xMidYMid slice';
      svgEl('image', inner, svg);
    }
    box.hidden = false;
  }

  /* "For Dana", in the hand, shrunk for a long name so it stays on the
     paper (and ellipsized past that). */
  function paintName(el, to) {
    fill(el, S.forName, { to: to });
    var n = chars(S.forName.replace('{to}', '').trim()) + 1 + chars(to);
    var size = Math.max(5.5, Math.min(9.5, 84 / (0.37 * n)));
    el.style.setProperty('--nfs', size.toFixed(2) + 'cqw');
  }

  /* The short line under the name, shrunk the same way. */
  function paintNote(el, note) {
    if (!note) { el.hidden = true; return; }
    text(el, note);
    var size = Math.max(3.6, Math.min(6, 84 / (0.37 * chars(note))));
    el.style.setProperty('--mfs', size.toFixed(2) + 'cqw');
    el.hidden = false;
  }

  function paintPostmark(pm, n) {
    if (n >= 2) {
      text($('.pm-n', pm), S.postmark.replace('{n}', String(n)));
      pm.hidden = false;
    } else pm.hidden = true;
  }

  /* --------------------------------------------------------------- sealed */

  var env = $('#env');
  var sealed = $('#sealed');
  var opened = $('#opened');

  root.setAttribute('data-state', 'sealed');
  sealed.hidden = false;

  var LOOK = lookFor(ENV);

  fill($('#sealedBy'), S.sealedBy, { from: ENV.from });
  fill($('#sealedA11y'), S.sealedA11y, { to: ENV.to, from: ENV.from });
  $('#seal').setAttribute('aria-label', S.sealAria);

  paintName($('.env-for', env), ENV.to);
  // The sender's own line, or, on an older link, its "open when".
  paintNote($('.env-note', env), ENV.m || (ENV.w ? S.when[ENV.w] : null));
  paintStamp($('.stamp', env), LOOK);
  paintPostmark($('.postmark', env), ENV.n || 1);

  buildCard($('#letterCard'), ENV.t, ENV.a);
  buildCard($('#card'), ENV.t, ENV.a);
  paintLook($('#letterCard'), LOOK);
  paintLook($('#card'), LOOK);

  fill($('#picked'), S.picked, { from: ENV.from });
  if (ENV.n && ENV.n >= 2) {
    var th = $('#thread');
    if (ENV.n <= 10) fill(th, S.thread.replace('{ord}', ordinal(ENV.n, LANG)), { from: ENV.from });
    else fill(th, S.threadNo.replace('{n}', String(ENV.n)), { from: ENV.from });
    th.hidden = false;
  }
  fill($('#sendBackLabel'), S.sendBack, { from: ENV.from });

  track('viewed', baseProps());

  /* ---------------------------------------------------- hold on the seal */
  /* A tap anywhere on the envelope opens it. Holding the seal fills a ring
     over ~600ms and then cracks it, which is the same opening with a little
     ceremony first. A hold released early is somebody changing their mind,
     so it does nothing. */

  var HOLD_MS = 600;

  /* opts (all optional): ms, how long the hold takes; progress(p), called
     every frame of a hold with 0..1; release(p), a hold let go before the
     end, with how far it got. */
  function holdable(sealEl, onDone, onTap, opts) {
    opts = opts || {};
    var ms = opts.ms || HOLD_MS;
    var ring = $('.seal-ring', sealEl);
    var arc = ring && $('.ring-arc', ring);
    var raf = 0, start = 0, active = false, pid = null, last = 0;

    function paint(p) {
      last = p;
      if (arc) arc.style.strokeDashoffset = String(100 - p * 100);
      if (opts.progress) opts.progress(p);
    }
    function stop() {
      active = false;
      cancelAnimationFrame(raf);
      sealEl.classList.remove('holding');
      var got = last;
      paint(0);
      if (opts.release) opts.release(got);
    }
    function frame(now) {
      if (!active) return;
      var p = Math.min(1, (now - start) / ms);
      paint(p);
      if (p >= 1) {
        active = false;
        sealEl.classList.remove('holding');
        sealEl.classList.add('held');
        try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
        onDone('hold');
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    sealEl.addEventListener('pointerdown', function (e) {
      if (sealEl.disabled || (e.button !== undefined && e.button > 0)) return;
      e.preventDefault();
      // A name still being typed: let the keyboard go, so the envelope is
      // in full view while it closes.
      var ae = document.activeElement;
      if (ae && ae !== sealEl && ae.blur && /INPUT|TEXTAREA/.test(ae.tagName)) ae.blur();
      pid = e.pointerId;
      try { sealEl.setPointerCapture(pid); } catch (err) {}
      active = true;
      start = performance.now();
      sealEl.classList.add('holding');
      raf = requestAnimationFrame(frame);
    });
    function up(e) {
      if (!active) return;
      var took = performance.now() - start;
      stop();
      if (e.type === 'pointerup' && took < 220 && onTap) onTap();
    }
    sealEl.addEventListener('pointerup', up);
    sealEl.addEventListener('pointercancel', up);
    sealEl.addEventListener('lostpointercapture', function (e) { if (active) up({ type: 'cancel' }); });
    // The pointer handlers own the seal; a click reaching the envelope from
    // it would open a second time.
    sealEl.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.detail === 0) onDone('key'); // keyboard
    });
    sealEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ------------------------------------------------------------ sparkles */
  /* The app's star flare (img/envelope/sparkle.webp), thrown and drifted on
     a canvas over the page: a burst when the seal breaks, dust as the
     letter rises, a twinkle when it lands. The same motion as the app's
     widgets/sparkles.dart. Nothing at all under reduced motion. */
  var sparkles = (function () {
    var none = { burst: function () {}, dust: function () {} };
    if (!window.requestAnimationFrame || !document.createElement('canvas').getContext) return none;
    var img = new Image();
    img.src = '/img/envelope/sparkle.webp';
    var cv = null, ctx = null, dpr = 1, ps = [], running = false, last = 0, tints = {};
    function setup() {
      if (cv) return true;
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
        if (reduceMotion || !setup()) return;
        o = o || {};
        for (var i = 0, n = o.count || 28; i < n; i++) {
          var a = Math.random() * 6.283, v = (o.speed || 220) * (0.35 + Math.random() * 0.75);
          add(x, y, Math.cos(a) * v, Math.sin(a) * v, (o.life || 1.1) * (0.6 + Math.random() * 0.6),
            (o.size || 22) * (0.4 + Math.random() * 0.8), o.ember ? EMBER : GOLD, 30);
        }
      },
      dust: function (x, y, o) {
        if (reduceMotion || !setup()) return;
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

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r };
  }

  /* --------------------------------------------------------- the opening */

  var isOpen = false;

  function anim(el, frames, opts) {
    if (!el || !el.animate) return Promise.resolve();
    var a = el.animate(frames, opts);
    return a.finished ? a.finished.catch(function () {}) : new Promise(function (r) { a.onfinish = r; });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function showOpenedInstant() {
    sealed.hidden = true;
    opened.classList.add('arrived');
    opened.hidden = false;
    root.setAttribute('data-state', 'opened');
  }

  function openEnvelope(how) {
    if (isOpen) return;
    isOpen = true;
    var ms = Date.now() - shownAt;
    var p = baseProps();
    p.ms_to_open = ms;
    track('opened', p);
    env.classList.remove('idle');

    if (reduceMotion || !env.animate) {
      showOpenedInstant();
      afterOpen();
      return;
    }

    var seal = $('#seal');
    var halves = $all('.seal-half', seal);
    var flap = $('.env-flap', env);
    var flapIn = $('.flap-in', env);
    var body = $all('.env-back, .env-pocket, .env-front', env);
    var letter = $('.letter', env);
    var inside = $('.env-inside', env);
    var chrome = $all('.sealed-copy', sealed);

    root.setAttribute('data-state', 'opening');
    seal.disabled = true;

    // Sealed-state copy steps back first.
    chrome.forEach(function (c) {
      anim(c, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }],
        { duration: 260, easing: 'ease-in', fill: 'forwards' });
    });

    // 1. The seal cracks and falls away, in a flash of gold.
    var ease = 'cubic-bezier(.2,.7,.2,1)';
    var sc = centerOf(seal);
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
      // 2. The flap lifts. Its outside turns into its inside as it passes
      //    upright, then it drops behind the letter.
      anim(flapIn, [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }],
        { duration: 420, fill: 'forwards' });
      return anim(flap, [
        { transform: 'perspective(900px) rotateX(0deg)' },
        { transform: 'perspective(900px) rotateX(180deg)' }
      ], { duration: 420, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
    }).then(function () {
      flap.style.zIndex = 2;
      // 3. The letter rises in light from inside, with dust coming up with
      //    it; the envelope drops away underneath it.
      var glow = $('.env-glow', env);
      if (glow) anim(glow, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: 1100, easing: 'ease-out' });
      var ec = centerOf(env);
      sparkles.dust(ec.x, ec.r.top + 6, { count: 26, jitter: ec.r.width * 0.32, jitterY: 6, dy: -90, size: 20, life: 1.7 });
      anim(letter, [{ transform: 'translateY(0)' }, { transform: 'translateY(-46%)' }],
        { duration: 560, easing: ease, fill: 'forwards' });
      return wait(140).then(function () {
        return Promise.all([
          anim(flap, [
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
      inside.style.clipPath = 'none';
      var from = letter.getBoundingClientRect();
      opened.hidden = false;
      opened.classList.add('arriving');
      var card = $('#card');
      var to = card.getBoundingClientRect();
      sealed.classList.add('gone');
      var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
      var dy = (from.top + from.height / 2) - (to.top + to.height / 2);
      var s = from.width / to.width;
      return anim(card, [
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')' },
        { transform: 'none' }
      ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }).then(function () {
      // 5. A twinkle as the card settles.
      var cr = $('#card').getBoundingClientRect();
      sparkles.dust(cr.left + cr.width / 2, cr.top + cr.height * 0.45,
        { count: 20, jitter: cr.width * 0.45, jitterY: cr.height * 0.45, size: 18, life: 1.4 });
      sealed.hidden = true;
      root.setAttribute('data-state', 'opened');
      opened.classList.remove('arriving');
      opened.classList.add('arrived');
      return wait(650);
    }).then(afterOpen);
  }

  function afterOpen() {
    // A beat to read the line before anything else asks for attention.
    setTimeout(releaseConsent, reduceMotion ? 1200 : 1600);
    if (AUTO === 'compose') openComposer('back');
  }

  // The whole envelope is a tap target for pointers; keyboard and screen
  // reader users have the Open it button and the seal, both real buttons.
  env.addEventListener('click', function () { openEnvelope('tap'); });
  $('#openBtn').addEventListener('click', function () { openEnvelope('button'); });
  holdable($('#seal'), function () { openEnvelope('hold'); }, function () { openEnvelope('tap'); });

  /* ------------------------------------------------------ send one back */

  var PAYLOAD_RE = /^[A-Za-z0-9_-]+$/;

  /* On iPhone and iPad the app gets the first chance. dailies:// makes
     Safari ask "Open in Dailies?" when the app is installed, and show an
     "address is invalid" alert when it is not. Both leave the page visible
     behind them, so visibility alone cannot tell a prompt from a miss: while
     either is up the page loses focus, and that is what this watches.

       blur                    a prompt is up: hold the fallback
       pagehide / hidden       the app took over: stand down for good
       focus, still visible    Cancel, or the alert dismissed: after ~600ms
                               open the web composer
       nothing at all          the plain 1.2s timer opens it

     Only one attempt runs at a time, and none while the composer is open. */

  var handoff = null;

  function endHandoff() {
    if (!handoff) return;
    clearTimeout(handoff.timer);
    clearTimeout(handoff.refocus);
    window.removeEventListener('blur', onHandoffBlur);
    window.removeEventListener('focus', onHandoffFocus);
    window.removeEventListener('pagehide', onHandoffVisibility);
    document.removeEventListener('visibilitychange', onHandoffVisibility);
    handoff = null;
  }
  function handoffFallback() {
    if (!handoff || document.visibilityState !== 'visible') return;
    endHandoff();
    cta('handoff_web');
    openComposer('back');
  }
  function onHandoffBlur() {
    if (!handoff) return;
    handoff.blurred = true;
    clearTimeout(handoff.timer);
    clearTimeout(handoff.refocus);
  }
  function onHandoffFocus() {
    if (!handoff || !handoff.blurred) return;
    clearTimeout(handoff.refocus);
    handoff.refocus = setTimeout(handoffFallback, 600);
  }
  function onHandoffVisibility() {
    if (document.visibilityState !== 'hidden' || !handoff) return;
    // The app took over. Sent as the page hides, so a slow network can
    // lose a few of these: read handoff_web as the firmer number.
    cta('handoff_app');
    endHandoff();
  }

  $('#sendBack').addEventListener('click', function () {
    if (handoff || sheetIsOpen()) return;
    cta('send_back');
    if (PLATFORM === 'ios' && PAYLOAD_RE.test(RAW)) {
      // The app only opens: it puts the line on the Home Screen widget for
      // a day and shows nothing. If it is not there, the page's own
      // composer takes over.
      handoff = { blurred: false, refocus: 0, timer: setTimeout(handoffFallback, 1200) };
      window.addEventListener('blur', onHandoffBlur);
      window.addEventListener('focus', onHandoffFocus);
      window.addEventListener('pagehide', onHandoffVisibility);
      document.addEventListener('visibilitychange', onHandoffVisibility);
      location.href = 'dailies://envelope?v=1&e=' + RAW;
      return;
    }
    openComposer('back');
  });

  /* ============================================================ composer */
  /* The app's composer, small: the letter stands in an open envelope, the
     names are typed under it, and the wax on the flap's tip is the one way
     to seal - press and hold, and the letter goes in and the flap comes
     over as the ring fills (lib/screens/envelope_screen.dart). The letter is
     one of the house lines, or the writer's own words. */

  var sheet = $('#sheet');
  var scrim = $('#scrim');
  var mini = $('#miniEnv');
  var miniCard = $('#miniCard');
  var miniSeal = $('#miniSeal');
  var ownInput = $('#ownInput');
  var toInput = $('#toInput');
  var toStatic = $('#toStatic');
  var fromInput = $('#fromInput');
  var noteInput = $('#noteInput');
  var holdArc = $('.hold-arc', mini);
  var holdText = $('#holdText');
  var C = null; // the composer's state
  var SEAL_MS = 1000; // the app's hold

  // An envelope sealed here carries no look of its own - the person writing
  // it has none - so the small one is printed with the house photograph,
  // which is what its reader will see. Painted on first open, so a page
  // showing the sender's photo never fetches the house one for nothing.
  var miniPainted = false;
  function paintMini() {
    if (miniPainted) return;
    miniPainted = true;
    var house = { src: HOUSE, color: null };
    paintLook(miniCard, house);
    paintStamp($('.stamp', mini), house);
    fitHoldText();
  }

  /* "Hold to seal" round the lower edge of the wax, never more than about
     two thirds of the way round, as the app sets it. */
  function fitHoldText() {
    text(holdText, S.holdToSeal.toUpperCase());
    try {
      var most = Math.PI * 60.3 * 1.15;
      var len = holdText.getComputedTextLength();
      if (len > most) {
        var k = most / len;
        holdText.parentNode.style.fontSize = (13 * k).toFixed(2) + 'px';
        holdText.parentNode.style.letterSpacing = (2 * k).toFixed(2) + 'px';
      }
    } catch (e) {}
  }

  function currentTo() { return C.mode === 'back' ? ENV.from : toInput.value.trim(); }
  function currentFrom() { return fromInput.value.trim(); }
  function ownText() { return ownInput.value.replace(/\s+/g, ' ').trim(); }

  function currentLine() {
    if (C.own) return { id: null, p: null, a: null, text: ownText(), own: true };
    var line = C.lines[C.idx];
    // No name typed yet: the line shows a gap where it will go.
    var to = validName(currentTo()) || '___';
    return {
      id: line.id,
      p: line.p,
      a: line.a,
      text: line.p ? personalize(line.p, to) : line.t,
      own: false
    };
  }

  function houseLines() {
    var col = LANG === 'es' ? 2 : 1;
    return LINES.map(function (l) { return { id: l[0], p: l[col], t: null, a: null }; });
  }

  function openComposer(mode) {
    paintMini();
    var lines = houseLines();
    // Start somewhere fresh, never on the line that just arrived.
    lines = lines.filter(function (l) { return l.id !== ENV.q; });
    var start = Math.floor(Math.random() * lines.length);
    lines = lines.slice(start).concat(lines.slice(0, start));
    C = { mode: mode, lines: lines, idx: 0, sealed: false, own: false, swapping: false, step: 'compose', sent: false };

    text($('#sheetTitle'), S.backTitle);
    if (mode === 'back') {
      toInput.hidden = true;
      toStatic.hidden = false;
      text(toStatic, ENV.from);
    } else {
      toInput.hidden = false;
      toStatic.hidden = true;
      toInput.value = '';
    }
    fromInput.value = ENV.to;
    noteInput.value = '';
    ownInput.value = '';
    miniCard.classList.remove('writing');

    sheet.setAttribute('data-step', 'compose');
    mini.classList.remove('is-sealed', 'held', 'past', 'holding', 'spring');
    mini.classList.add('is-open');
    $('#copyBtn .lbl').textContent = S.copy;
    paintComposer();
    cta('composer_opened', { mode: mode });

    scrim.hidden = false;
    sheet.hidden = false;
    document.documentElement.classList.add('sheet-open');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        scrim.classList.add('on');
        sheet.classList.add('on');
      });
    });
    lastFocus = document.activeElement;
    setTimeout(function () {
      var f = $('#changeLine');
      try { f.focus({ preventScroll: true }); } catch (e) {}
    }, reduceMotion ? 0 : 380);
  }

  var lastFocus = null;
  function closeComposer() {
    if (sheet.hidden) return;
    if (C && !C.closed) {
      C.closed = true;
      cta('composer_closed', { step: C.sent ? 'sent' : C.step, mode: C.own ? 'own' : 'line' });
    }
    sheet.classList.remove('on');
    scrim.classList.remove('on');
    document.documentElement.classList.remove('sheet-open');
    setTimeout(function () {
      sheet.hidden = true;
      scrim.hidden = true;
      if (consentWanted) releaseConsent();
    }, reduceMotion ? 0 : 320);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  $('#sheetClose').addEventListener('click', closeComposer);
  $('#doneBtn').addEventListener('click', closeComposer);
  scrim.addEventListener('click', closeComposer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !sheet.hidden) closeComposer();
  });

  function ready() {
    var line = currentLine();
    return !!(validName(currentTo()) && validName(currentFrom()) && line.text);
  }

  function paintComposer() {
    if (!C) return;
    var to = validName(currentTo());
    paintName($('.env-for', mini), to || S.someone);
    $('.env-for', mini).classList.toggle('placeholder', !to);
    paintNote($('.env-note', mini), cleanNote(noteInput.value));
    paintPostmark($('.postmark', mini), C.mode === 'back' ? (ENV.n || 1) + 1 : 1);

    var line = currentLine();
    if (C.own) sizeOwn();
    else buildCard(miniCard, line.text, line.a);

    $('#changeLine').hidden = C.own;
    text($('#ownToggleLabel'), C.own ? S.useLine : S.writeOwn);

    var ok = ready();
    var was = mini.classList.contains('ready');
    mini.classList.toggle('ready', ok);
    miniSeal.disabled = !ok;
    var say = $('#sealHint');
    text(say, ok ? S.sealHint : C.own && !line.text ? S.ownHint : S.needNames);
    say.classList.toggle('ready', ok);
    // The wax arriving, with a glint.
    if (ok && !was && !C.sealed) {
      setTimeout(function () {
        if (!C || !mini.classList.contains('ready')) return;
        var g = centerOf($('.seal-ghost', mini));
        sparkles.burst(g.x, g.y, { count: 12, speed: 100, size: 14, life: 0.9 });
      }, 260);
    }
  }

  /* The own words set the size the letter would set them at, and the box
     grows with them. */
  function sizeOwn() {
    var n = chars(ownText()) || chars(S.ownHint);
    miniCard.style.setProperty('--fs', textSize(n));
    ownInput.style.height = 'auto';
    ownInput.style.height = ownInput.scrollHeight + 'px';
  }

  toInput.addEventListener('input', paintComposer);
  fromInput.addEventListener('input', paintComposer);
  noteInput.addEventListener('input', paintComposer);
  ownInput.addEventListener('input', paintComposer);
  // A line, not a letter: return moves on.
  ownInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var next = C && C.mode !== 'back' && !toInput.value.trim() ? toInput : fromInput;
      try { next.focus(); } catch (err) {}
    }
  });

  /* The letter goes down into the envelope, [swap] changes it, and it comes
     back up with a little dust - the app's letter rising out of its pocket.
     Taps while it is moving are ignored. */
  function swapLetter(swap, then) {
    if (!C || C.sealed || C.swapping) return;
    if (reduceMotion || !miniCard.animate) { swap(); paintComposer(); if (then) then(); return; }
    C.swapping = true;
    anim(miniCard, [{ transform: 'translateY(0)' }, { transform: 'translateY(96%)' }],
      { duration: 230, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).then(function () {
      swap();
      paintComposer();
      var m = mini.getBoundingClientRect();
      sparkles.dust(m.left + m.width / 2, m.top + 4, { count: 10, jitter: m.width * 0.3, jitterY: 4, dy: -70, size: 14, life: 1.2 });
      return anim(miniCard, [
        { transform: 'translateY(96%)' },
        { transform: 'translateY(-3%)', offset: 0.75 },
        { transform: 'translateY(0)' }
      ], { duration: 460, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'forwards' });
    }).then(function () {
      try { miniCard.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
      if (C) C.swapping = false;
      if (then) then();
    });
  }

  $('#changeLine').addEventListener('click', function () {
    if (!C || C.sealed || C.swapping) return;
    cta('change_line');
    swapLetter(function () { C.idx = (C.idx + 1) % C.lines.length; });
  });

  $('#ownToggle').addEventListener('click', function () {
    if (!C || C.sealed || C.swapping) return;
    var toOwn = !C.own;
    cta(toOwn ? 'write_own' : 'use_line');
    swapLetter(function () {
      C.own = toOwn;
      miniCard.classList.toggle('writing', toOwn);
      if (!toOwn) miniCard.style.removeProperty('--fs');
    }, function () {
      if (toOwn) try { ownInput.focus({ preventScroll: true }); } catch (e) {}
    });
  });

  /* The new envelope, exactly as the app would build it. */
  function buildLink() {
    var line = currentLine();
    var from = validName(currentFrom());
    var to = validName(currentTo());
    var obj = {
      v: 1,
      to: to,
      from: from,
      t: line.text,
      a: line.a || null,
      q: line.id || null,
      o: !!line.own
    };
    if (line.p) obj.p = line.p;
    obj.n = C.mode === 'back' ? (ENV.n || 1) + 1 : 1;
    obj.l = LANG;
    var note = cleanNote(noteInput.value);
    if (note) obj.m = note;
    var check = validate(obj);
    if (check.error) return null;
    var link = location.origin + '/sealed/#' + encode(obj);
    return { link: link, message: messageFor(to, link, LANG), to: to };
  }

  /* -------------------------------------------------- the hold on the wax */

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp01(t) { return Math.max(0, Math.min(1, t)); }

  function holdProgress(p) {
    if (!C || C.sealed) return;
    mini.classList.toggle('holding', p > 0);
    // Holding draws the letter down into the pocket and then folds the
    // flap over it, as in the app.
    var fold = ease(clamp01((p - 0.3) / 0.7));
    mini.style.setProperty('--down', ease(clamp01(p / 0.45)).toFixed(4));
    mini.style.setProperty('--fold', fold.toFixed(4));
    mini.style.setProperty('--press', p.toFixed(4));
    mini.classList.toggle('past', fold > 0.5);
    holdArc.style.strokeDashoffset = String(100 - p * 100);
    holdText.parentNode.style.opacity = String(1 - clamp01(p * 4));
    // Heat coming off the wax while it is held.
    if (p > 0.05 && !reduceMotion && Math.random() < 0.3 + 0.4 * p) {
      var g = centerOf($('.seal-ghost', mini));
      var a = Math.random() * 6.283, r = g.r.width * 0.42;
      sparkles.dust(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r, { count: 1, jitter: 2, dy: -40, size: 10 + 8 * p, life: 0.8 });
    }
  }

  function holdReleased(p) {
    if (!C || C.sealed) return;
    if (p > 0 && p < 1) {
      cta('hold_released', { progress: Math.round(p * 100) / 100 });
      // Let go too soon: the paper springs back open.
      mini.classList.add('spring');
      setTimeout(function () { mini.classList.remove('spring'); }, 450);
    }
    mini.classList.remove('holding', 'past');
    mini.style.removeProperty('--down');
    mini.style.removeProperty('--fold');
    mini.style.removeProperty('--press');
    holdArc.style.strokeDashoffset = '100';
    holdText.parentNode.style.opacity = '';
  }

  function sealIt(how) {
    if (!C || C.sealed) return;
    var built = buildLink();
    if (!built) { holdReleased(0); paintComposer(); return; }
    C.sealed = true;
    C.built = built;
    C.step = 'sealed';
    cta('web_sealed', { mode: C.own ? 'own' : 'line', how: how === 'hold' ? 'hold' : 'key' });
    try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}

    var wa = $('#waBtn');
    wa.href = 'https://wa.me/?text=' + encodeURIComponent(built.message);
    var sms = $('#smsBtn');
    sms.href = (PLATFORM === 'android' ? 'sms:?body=' : 'sms:&body=') + encodeURIComponent(built.message);
    sms.hidden = !(PLATFORM === 'ios' || PLATFORM === 'android' || /Macintosh/.test(navigator.userAgent));
    $('#shareBtn').hidden = !navigator.share;
    $('#sentBlock').hidden = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    var held = how === 'hold';
    // After a hold the letter is already in and the flap already over, so
    // the wax lands at once; from the keyboard the envelope closes first.
    mini.classList.toggle('held', held);
    mini.classList.remove('is-open', 'holding', 'past');
    mini.classList.add('is-sealed');
    mini.style.removeProperty('--down');
    mini.style.removeProperty('--fold');
    mini.style.removeProperty('--press');
    holdArc.style.strokeDashoffset = '100';
    holdText.parentNode.style.opacity = '';
    sheet.setAttribute('data-step', 'sealed');

    var delay = held ? 0 : 640;
    var ms = $('.seal', mini);
    setTimeout(function () {
      var mc = centerOf(ms);
      sparkles.burst(mc.x, mc.y, { count: 40, speed: 260, size: 26, life: 1.3 });
      sparkles.burst(mc.x, mc.y, { count: 12, speed: 110, size: 12, life: 0.8, ember: true });
      if (reduceMotion) return;
      anim($('.impact', mini), [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: 'translate(-50%,-50%) scale(3.6)', opacity: 0 }
      ], { duration: 820, easing: 'cubic-bezier(.2,.7,.3,1)' });
      anim($('.sheen', mini), [
        { opacity: 1, transform: 'translateX(-100%)' },
        { opacity: 1, transform: 'translateX(100%)' }
      ], { duration: 900, delay: 280, easing: 'ease-in-out' });
    }, delay);
    if (!reduceMotion && ms.animate) {
      // The app's wax: in large, pressed down, a small elastic settle.
      anim(ms, held ? [
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
  }
  holdable(miniSeal, sealIt, null, { ms: SEAL_MS, progress: holdProgress, release: holdReleased });

  $('#editBtn').addEventListener('click', function () {
    if (!C) return;
    cta('edit');
    C.sealed = false;
    C.step = 'compose';
    sheet.setAttribute('data-step', 'compose');
    mini.classList.remove('is-sealed', 'held');
    mini.classList.add('is-open');
    paintComposer();
  });

  function markSent(dest) {
    if (C) C.sent = true;
    cta('web_sent', { destination: dest, mode: C && C.own ? 'own' : 'line' });
    var sb = $('#sentBlock');
    if (sb.hidden) {
      sb.hidden = false;
      if (!reduceMotion && sb.animate) {
        anim(sb, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
          { duration: 360, easing: 'ease-out' });
      }
    }
  }

  $('#shareBtn').addEventListener('click', function () {
    if (!C || !C.built || !navigator.share) return;
    navigator.share({ text: C.built.message }).then(function () { markSent('share'); }, function () {});
  });
  $('#waBtn').addEventListener('click', function () { markSent('whatsapp'); });
  $('#smsBtn').addEventListener('click', function () { markSent('messages'); });
  $('#copyBtn').addEventListener('click', function () {
    if (!C || !C.built) return;
    var msg = C.built.message;
    function done() {
      $('#copyBtn .lbl').textContent = S.copied;
      markSent('copy');
      setTimeout(function () { $('#copyBtn .lbl').textContent = S.copy; }, 2200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(done, function () { legacyCopy(msg) && done(); });
    } else if (legacyCopy(msg)) done();
  });

  function legacyCopy(s) {
    var ta = document.createElement('textarea');
    ta.value = s;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }

  /* ----------------------------------------------------------------- go */

  if (AUTO === 'opened' || AUTO === 'compose') {
    reduceMotion = true;
    openEnvelope('debug');
  } else if (AUTO === '1') {
    setTimeout(function () { openEnvelope('debug'); }, 400);
  } else {
    env.classList.add('idle');
  }
})();
