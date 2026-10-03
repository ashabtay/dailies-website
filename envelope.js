/* ============================================================================
   The receiving end of a Dailies envelope - mydailies.app/e/#<payload>

   Somebody sealed a quote for a friend in the app and sent it as a text
   message. This file opens it: decodes the link, shows the sealed envelope,
   plays the opening, shows the quote, and offers the way back - "Send one
   back", which hands off to the app when it is installed and falls back to a
   small composer on this page when it is not.

   ---------------------------------------------------------------------------
   The link
   ---------------------------------------------------------------------------
   https://mydailies.app/e/#<base64url(JSON)>, padding stripped. Everything is
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
     w     optional: "open when" key - hard, doubt, night, win, friend
     l     optional: the sender's app language, en or es

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
   ordinal) are exposed on window.DailiesEnvelope for /e/test.html.
   ========================================================================= */
(function () {
  'use strict';

  // Where every "Get Dailies" goes. On release day this becomes the App Store
  // URL (kAppStoreUrl in lib/app_config.dart in the app repo).
  var APP_URL = 'https://mydailies.app/';

  // The address the site's help and about pages use.
  var SUPPORT = 'help@mydailies.app';

  var MAX_NAME = 40;
  var MAX_TEXT = 600;
  var WHEN_KEYS = ['hard', 'doubt', 'night', 'win', 'friend'];

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
      sealedBy: 'sealed by {from}',
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
      passOn: 'Pass it on',
      getApp: 'Get Dailies',
      getNote: 'Once Dailies is installed, come back to this envelope and tap Send one back.',
      report: 'Something wrong with this envelope?',
      reportSubject: 'Something wrong with an envelope',
      reportBody: 'This envelope did not look right:',
      privacy: 'Privacy',
      cookies: 'Cookie settings',
      badTitle: 'This envelope didn’t survive the trip.',
      badBody: 'Ask whoever sent it to send it again, or get the app and seal one yourself.',
      noscript: 'This envelope needs JavaScript to open.',
      // composer
      backTitle: 'Send one back',
      passTitle: 'Pass it on',
      close: 'Close',
      toLabel: 'To',
      theirName: 'Their name',
      yourName: 'Your name',
      someone: 'someone',
      changeLine: 'Change line',
      whenLabel: 'Open when',
      chips: { none: 'Anytime', hard: 'A hard day', doubt: 'Self-doubt', night: 'Can’t sleep', win: 'Good news', friend: 'Need a friend' },
      sealIt: 'Seal it',
      sealHint: 'Or press and hold the seal',
      needNames: 'Add both names to seal it',
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
      message: '{to}, there’s an envelope for you from {from}.'
    },
    es: {
      title: 'Un sobre para ti',
      label: 'Alguien pensó en ti',
      forName: 'Para {to}',
      sealedBy: 'sellado por {from}',
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
      passOn: 'Pásalo a alguien',
      getApp: 'Descarga Dailies',
      getNote: 'Cuando tengas Dailies, vuelve a este sobre y toca Mándale uno.',
      report: '¿Algo anda mal con este sobre?',
      reportSubject: 'Algo anda mal con un sobre',
      reportBody: 'Este sobre no se veía bien:',
      privacy: 'Privacidad',
      cookies: 'Cookies',
      badTitle: 'Este sobre no sobrevivió el viaje.',
      badBody: 'Pídele a quien te lo mandó que lo envíe de nuevo, o descarga la app y sella uno tú.',
      noscript: 'Este sobre necesita JavaScript para abrirse.',
      backTitle: 'Mándale uno',
      passTitle: 'Pásalo a alguien',
      close: 'Cerrar',
      toLabel: 'Para',
      theirName: 'Su nombre',
      yourName: 'Tu nombre',
      someone: 'alguien',
      changeLine: 'Cambiar frase',
      whenLabel: 'Para qué momento',
      chips: { none: 'Cuando sea', hard: 'Día difícil', doubt: 'Dudas', night: 'Insomnio', win: 'Buenas noticias', friend: 'Compañía' },
      sealIt: 'Sellar',
      sealHint: 'O mantén presionado el sello',
      needNames: 'Escribe los dos nombres para sellarlo',
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
      message: '{to}, hay un sobre para ti de parte de {from}.'
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
    return env;
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
    LINES: LINES,
    STRINGS: STRINGS
  };

  /* ========================================================== the page */

  var root = document.getElementById('envelope-page');
  if (!root) return; // loaded by the test page: pure functions only

  var params = new URLSearchParams(location.search);
  var AUTO = params.get('auto'); // debug: 1 opens, compose / pass open the composer
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

  function wireGetApp(a) {
    a.href = APP_URL;
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

  /* --------------------------------------------------------------- sealed */

  var env = $('#env');
  var sealed = $('#sealed');
  var opened = $('#opened');

  root.setAttribute('data-state', 'sealed');
  sealed.hidden = false;

  fill($('#forName'), S.forName, { to: ENV.to });
  fill($('#sealedBy'), S.sealedBy, { from: ENV.from });
  $('#seal').setAttribute('aria-label', S.sealAria);

  if (ENV.w) {
    var note = $('.env-note', env);
    text(note, S.when[ENV.w]);
    note.hidden = false;
  }
  if (ENV.n && ENV.n >= 2) {
    var pm = $('.postmark', env);
    text($('.pm-n', pm), S.postmark.replace('{n}', String(ENV.n)));
    pm.hidden = false;
  }

  buildCard($('#letterCard'), ENV.t, ENV.a);
  buildCard($('#card'), ENV.t, ENV.a);

  fill($('#picked'), S.picked, { from: ENV.from });
  if (ENV.n && ENV.n >= 2) {
    var th = $('#thread');
    if (ENV.n <= 10) fill(th, S.thread.replace('{ord}', ordinal(ENV.n, LANG)), { from: ENV.from });
    else fill(th, S.threadNo.replace('{n}', String(ENV.n)), { from: ENV.from });
    th.hidden = false;
  }
  fill($('#sendBackLabel'), S.sendBack, { from: ENV.from });

  var report = $('#report');
  report.href = 'mailto:' + SUPPORT +
    '?subject=' + encodeURIComponent(S.reportSubject) +
    '&body=' + encodeURIComponent(S.reportBody + '\n\n' + location.href + '\n');
  report.addEventListener('click', function () { cta('report'); });

  track('viewed', baseProps());

  /* ---------------------------------------------------- hold on the seal */
  /* A tap anywhere on the envelope opens it. Holding the seal fills a ring
     over ~600ms and then cracks it, which is the same opening with a little
     ceremony first. A hold released early is somebody changing their mind,
     so it does nothing. */

  var HOLD_MS = 600;

  function holdable(sealEl, onDone, onTap) {
    var ring = $('.seal-ring', sealEl);
    var arc = ring && $('.ring-arc', ring);
    var raf = 0, start = 0, active = false, pid = null;

    function paint(p) {
      if (arc) arc.style.strokeDashoffset = String(100 - p * 100);
    }
    function stop() {
      active = false;
      cancelAnimationFrame(raf);
      sealEl.classList.remove('holding');
      paint(0);
    }
    function frame(now) {
      if (!active) return;
      var p = Math.min(1, (now - start) / HOLD_MS);
      paint(p);
      if (p >= 1) {
        active = false;
        sealEl.classList.remove('holding');
        sealEl.classList.add('held');
        try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
        onDone();
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    sealEl.addEventListener('pointerdown', function (e) {
      if (sealEl.disabled || (e.button !== undefined && e.button > 0)) return;
      e.preventDefault();
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
      if (e.detail === 0) onDone(); // keyboard
    });
    sealEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
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
    var body = $all('.env-back, .env-pocket, .env-shadow', env);
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

    // 1. The seal cracks and falls away.
    var ease = 'cubic-bezier(.2,.7,.2,1)';
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
      // 3. The letter rises; the envelope drops away underneath it.
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
    if (AUTO === 'pass') openComposer('pass');
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
    window.removeEventListener('pagehide', endHandoff);
    document.removeEventListener('visibilitychange', onHandoffVisibility);
    handoff = null;
  }
  function handoffFallback() {
    if (!handoff || document.visibilityState !== 'visible') return;
    endHandoff();
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
    if (document.visibilityState === 'hidden') endHandoff();
  }

  $('#sendBack').addEventListener('click', function () {
    if (handoff || sheetIsOpen()) return;
    cta('send_back');
    if (PLATFORM === 'ios' && PAYLOAD_RE.test(RAW)) {
      // The app decodes `e` itself, records the envelope it received and
      // opens its own composer with the reply prefilled.
      handoff = { blurred: false, refocus: 0, timer: setTimeout(handoffFallback, 1200) };
      window.addEventListener('blur', onHandoffBlur);
      window.addEventListener('focus', onHandoffFocus);
      window.addEventListener('pagehide', endHandoff);
      document.addEventListener('visibilitychange', onHandoffVisibility);
      location.href = 'dailies://envelope?v=1&e=' + RAW;
      return;
    }
    openComposer('back');
  });
  $('#passOn').addEventListener('click', function () {
    cta('pass_on');
    openComposer('pass');
  });

  /* ============================================================ composer */

  var sheet = $('#sheet');
  var scrim = $('#scrim');
  var mini = $('#miniEnv');
  var miniCard = $('#miniCard');
  var toInput = $('#toInput');
  var toStatic = $('#toStatic');
  var fromInput = $('#fromInput');
  var sealBtn = $('#sealBtn');
  var bigSeal = $('#bigSeal');
  var C = null; // the composer's state

  // Chips.
  var chipBox = $('#whenChips');
  ['none'].concat(WHEN_KEYS).forEach(function (k) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'wchip';
    b.setAttribute('data-when', k);
    b.setAttribute('aria-pressed', k === 'none' ? 'true' : 'false');
    b.textContent = S.chips[k];
    chipBox.appendChild(b);
  });
  chipBox.addEventListener('click', function (e) {
    var b = e.target.closest('.wchip');
    if (!b || !C || C.sealed) return;
    C.w = b.getAttribute('data-when') === 'none' ? null : b.getAttribute('data-when');
    $all('.wchip', chipBox).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    paintComposer();
  });

  function currentTo() { return C.mode === 'back' ? ENV.from : toInput.value.trim(); }
  function currentFrom() { return fromInput.value.trim(); }

  function currentLine() {
    var line = C.lines[C.idx];
    // No name typed yet: the line shows a gap where it will go.
    var to = validName(currentTo()) || '___';
    return {
      id: line.id,
      p: line.p,
      a: line.a,
      text: line.p ? personalize(line.p, to) : line.t
    };
  }

  function houseLines() {
    var col = LANG === 'es' ? 2 : 1;
    return LINES.map(function (l) { return { id: l[0], p: l[col], t: null, a: null }; });
  }

  function openComposer(mode) {
    var lines = houseLines();
    // Start somewhere fresh, never on the line that just arrived.
    lines = lines.filter(function (l) { return l.id !== ENV.q; });
    var start = Math.floor(Math.random() * lines.length);
    lines = lines.slice(start).concat(lines.slice(0, start));
    if (mode === 'pass') {
      lines.unshift({ id: ENV.q, p: ENV.p || null, t: ENV.t, a: ENV.a });
    }
    C = { mode: mode, lines: lines, idx: 0, w: null, sealed: false };

    text($('#sheetTitle'), mode === 'back' ? S.backTitle : S.passTitle);
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
    $all('.wchip', chipBox).forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-when') === 'none' ? 'true' : 'false'); });

    sheet.setAttribute('data-step', 'compose');
    mini.classList.remove('is-sealed');
    mini.classList.add('is-open');
    $('.seal', mini).style.opacity = '';
    bigSeal.classList.remove('held');
    bigSeal.disabled = false;
    $('#copyBtn .lbl').textContent = S.copy;
    paintComposer();

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
      var f = mode === 'pass' ? toInput : $('#changeLine');
      try { f.focus({ preventScroll: true }); } catch (e) {}
    }, reduceMotion ? 0 : 380);
  }

  var lastFocus = null;
  function closeComposer() {
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

  function paintComposer() {
    if (!C) return;
    var to = validName(currentTo());
    fill($('.env-for', mini), S.forName, { to: to || S.someone });
    $('.env-for', mini).classList.toggle('placeholder', !to);
    var note = $('.env-note', mini);
    if (C.w) { text(note, S.when[C.w]); note.hidden = false; }
    else note.hidden = true;
    $('.env-for', mini).classList.toggle('with-note', !!C.w);
    var n = C.mode === 'back' ? (ENV.n || 1) + 1 : 1;
    var pm = $('.postmark', mini);
    if (n >= 2) { text($('.pm-n', pm), S.postmark.replace('{n}', String(n))); pm.hidden = false; }
    else pm.hidden = true;

    var line = currentLine();
    buildCard(miniCard, line.text, line.a);

    var ok = !!(to && validName(currentFrom()));
    sealBtn.disabled = !ok;
    bigSeal.disabled = !ok;
    bigSeal.classList.toggle('ready', ok);
    text($('#sealHint'), ok ? S.sealHint : S.needNames);
  }

  toInput.addEventListener('input', paintComposer);
  fromInput.addEventListener('input', paintComposer);

  $('#changeLine').addEventListener('click', function () {
    if (!C || C.sealed) return;
    C.idx = (C.idx + 1) % C.lines.length;
    var card = miniCard;
    if (!reduceMotion && card.animate) {
      anim(card, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(6px)' }],
        { duration: 140, easing: 'ease-in' }).then(function () {
        paintComposer();
        anim(card, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 220, easing: 'ease-out' });
      });
    } else paintComposer();
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
      o: false
    };
    if (line.p) obj.p = line.p;
    obj.n = C.mode === 'back' ? (ENV.n || 1) + 1 : 1;
    if (C.w) obj.w = C.w;
    obj.l = LANG;
    var check = validate(obj);
    if (check.error) return null;
    var link = location.origin + '/e/#' + encode(obj);
    var msg = S.message.replace('{to}', to).replace('{from}', from) + '\n' + link;
    return { link: link, message: msg, to: to };
  }

  function sealIt() {
    if (!C || C.sealed) return;
    var built = buildLink();
    if (!built) { paintComposer(); return; }
    C.sealed = true;
    C.built = built;
    cta('web_sealed');
    try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}

    var wa = $('#waBtn');
    wa.href = 'https://wa.me/?text=' + encodeURIComponent(built.message);
    var sms = $('#smsBtn');
    sms.href = (PLATFORM === 'android' ? 'sms:?body=' : 'sms:&body=') + encodeURIComponent(built.message);
    sms.hidden = !(PLATFORM === 'ios' || PLATFORM === 'android' || /Macintosh/.test(navigator.userAgent));
    $('#shareBtn').hidden = !navigator.share;
    $('#sentBlock').hidden = true;

    mini.classList.remove('is-open');
    mini.classList.add('is-sealed');
    bigSeal.classList.add('held');
    bigSeal.disabled = true;
    sheet.setAttribute('data-step', 'sealed');
    var ms = $('.seal', mini);
    if (!reduceMotion && ms.animate) {
      anim(ms, [
        { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0, offset: 0.45 },
        { transform: 'translate(-50%,-50%) scale(.9)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }
      ], { duration: 820, easing: 'cubic-bezier(.3,0,.3,1)' });
    }
  }
  sealBtn.addEventListener('click', sealIt);
  holdable(bigSeal, sealIt, null);

  $('#editBtn').addEventListener('click', function () {
    if (!C) return;
    C.sealed = false;
    sheet.setAttribute('data-step', 'compose');
    mini.classList.remove('is-sealed');
    mini.classList.add('is-open');
    bigSeal.classList.remove('held');
    paintComposer();
  });

  function markSent(dest) {
    cta('web_sent', { destination: dest });
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

  if (AUTO === 'opened' || AUTO === 'compose' || AUTO === 'pass') {
    reduceMotion = true;
    openEnvelope('debug');
  } else if (AUTO === '1') {
    setTimeout(function () { openEnvelope('debug'); }, 400);
  } else {
    env.classList.add('idle');
  }
})();
