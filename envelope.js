/* ============================================================================
   /e/ - where a friend opens an envelope somebody sealed on the
   words-of-encouragement page

   Reads the link (see play.js for its fields), shows the sealed envelope with
   the friend's name on it - the app's own envelope, as on /sealed/
   (envelope-art.js) - and opens it the way /sealed/ does: the seal cracks in
   a burst of gold, the flap lifts, the letter rises out in light and becomes
   the card, the line on one of the app's backgrounds. Then the ways onward:

     Send one back       - the encouragement page, the names already swapped
                           round, so they pick a line (or write their own) for
                           the sender
     Make it a wallpaper - the wallpaper maker, in this language, on this line
     More words of encouragement - the same page, without the names
     the App Store badge (web-envelope)

   The cookie banner waits until the envelope is open (data-consent="deferred"
   on <body>), and PostHog runs here without autocapture and with the link's
   fragment cut off every URL (data-analytics="private"); see consent.js.
   ========================================================================= */
(function () {
  'use strict';

  // A blog line named in the address loads first (play.js, ready()); the
  // rest of this file runs once it is in.
  if (window.DailiesPlay) window.DailiesPlay.ready(start);

  function start() {

  var P = window.DailiesPlay;
  var A = window.DailiesEnvelopeArt;
  var root = document.getElementById('env');
  if (!P || !A || !root) return;
  var h = P.h;

  var HOMES = { en: '/', es: '/es/', pt: '/pt/', fr: '/fr/', de: '/de/', ja: '/ja/',
                it: '/it/', ko: '/ko/', 'zh-hant': '/zh-hant/', nl: '/nl/', sv: '/sv/', ar: '/ar/' };
  var res = P.decode(location.hash);
  var env = res.env;
  var lang = env ? env.l : P.pickLang(navigator.language);
  P.setLang(lang);
  // An Arabic envelope reads right to left (doc.css mirrors the rest).
  // e/index.html already set this for a sealed one; this covers a broken
  // link opened on an Arabic phone, which falls back to that language.
  if (lang === 'ar') document.documentElement.dir = 'rtl';
  var s = P.strings();

  document.title = s.eTitle + ' | Dailies';
  var home = document.getElementById('env-home');
  if (home) home.href = HOMES[lang];
  relabelFooter();

  if (!env) { invalid(res.reason); return; }
  sealed();

  /* ------------------------------------------------------------- sealed */

  function sealed() {
    var t0 = Date.now();
    var box = h('section', 'env-sealed');

    // The envelope, floating, with their name on the front and the line
    // already inside it on the letter.
    var stage = h('div', 'ea-stage is-idle');
    stage.appendChild(h('div', 'ea-ground'));
    var float = h('div', 'ea-float');
    var parts = A.build('sealed');
    parts.el.setAttribute('aria-hidden', 'true');
    A.paintName(parts.name, env.to ? s.forName.split('{to}').join(env.to) : s.forYou, false);
    parts.letter.appendChild(letterCard());
    // The sender's initial pressed into the wax (the quote mark without a
    // name, or when the name does not start with a letter).
    if (window.DailiesSeal) window.DailiesSeal.apply(parts.el, env.f);
    float.appendChild(parts.el);
    stage.appendChild(float);
    box.appendChild(stage);

    var title = h('h1', 'env-for', s.eTitle);
    box.appendChild(title);
    var chrome = [title];
    if (env.f) {
      var by = P.fill(h('p', 'env-from'), s.fromName, { from: env.f });
      box.appendChild(by);
      chrome.push(by);
    }

    var openBtn = h('button', 'pl-primary env-openbtn', s.openIt);
    openBtn.type = 'button';
    box.appendChild(openBtn);
    var note = h('p', 'env-note', s.openNote);
    box.appendChild(note);
    chrome.push(openBtn, note);
    root.appendChild(box);

    P.ev('envelope_viewed', { has_to: !!env.to, has_from: !!env.f });

    var done = false;
    function openIt() {
      if (done) return;
      done = true;
      openBtn.disabled = true;
      P.ev('envelope_opened', { ms_to_open: Date.now() - t0 });
      A.open(parts, stage, chrome, function () {
        // The letter is measured; now the open card takes its place.
        box.remove();
        window.scrollTo(0, 0);
        return opened(!A.reduce);
      }).then(function () {
        // The cookie question comes once the line has had a moment to be
        // read, not on top of it the instant it appears.
        setTimeout(function () {
          document.dispatchEvent(new CustomEvent('dailies:consent-ready'));
        }, 2500);
      });
    }
    parts.el.addEventListener('click', openIt);
    openBtn.addEventListener('click', openIt);
  }

  /* The letter in the envelope: the card the friend will see once it is
     open, the same shape, so it can become that card. */
  function letterCard() {
    var t = P.envText(env, lang), a = P.envAuthor(env, lang);
    var c = h('figure', 'ea-card is-tall');
    var img = document.createElement('img');
    img.src = P.bgUrl(env.k);
    img.alt = '';
    c.appendChild(img);
    var q = h('blockquote');
    var p = h('p', null, t);
    p.setAttribute('dir', 'auto');
    q.appendChild(p);
    if (a) q.appendChild(h('cite', null, a));
    c.appendChild(q);
    c.style.setProperty('--fs', A.textSize(A.chars(t)));
    return c;
  }

  /* ------------------------------------------------------------- opened */

  /* arriving: the card is about to glide in from the letter, so it shows at
     once and only the rest rises in. Returns the card. */
  function opened(arriving) {
    var box = h('section', 'env-opened' + (arriving ? ' is-arriving' : ''));
    var c = P.card(P.envText(env, lang), P.envAuthor(env, lang), env.k);
    c.classList.add('env-card');
    box.appendChild(c);

    var picked = h('p', 'env-picked');
    var key = env.t ? (env.f ? 'wrote' : 'wroteNoName') : (env.f ? 'picked' : 'pickedNoName');
    if (env.f) P.fill(picked, s[key], { from: env.f });
    else picked.textContent = s[key];
    box.appendChild(picked);

    var row = h('div', 'env-actions');
    var back = h('a', 'pl-primary');
    back.href = P.replyLink(env, lang);
    if (env.f) back.appendChild(P.fill(h('span'), s.sendBack, { from: env.f }));
    else back.textContent = s.sendBackNoName;
    back.addEventListener('click', function () { P.ev('envelope_cta', { action: 'send_back' }); });
    row.appendChild(back);

    var wall = h('a', 'pl-btn', s.makeWall);
    wall.href = P.wallLink(env, lang);
    wall.addEventListener('click', function () { P.ev('envelope_cta', { action: 'wallpaper' }); });
    row.appendChild(wall);
    box.appendChild(row);

    var ml = P.moreLink(env, lang);
    var more = h('a', 'env-more', ml.label);
    more.href = ml.href;
    more.addEventListener('click', function () { P.ev('envelope_cta', { action: 'read_more' }); });
    box.appendChild(more);

    var bridge = h('div', 'env-bridge');
    bridge.appendChild(h('h2', null, s.bridgeTitle));
    bridge.appendChild(h('p', null, s.bridgeBody));
    bridge.appendChild(P.badge('web-envelope', 'envelope'));
    box.appendChild(bridge);

    root.appendChild(box);
    return c;
  }

  /* ------------------------------------------------------------ invalid */

  function invalid(reason) {
    var box = h('section', 'env-bad');
    box.appendChild(h('h1', null, s.badTitle));
    box.appendChild(h('p', null, s.badBody));
    var a = h('a', 'env-more', s.goHome);
    a.href = HOMES[lang];
    box.appendChild(a);
    var bridge = h('div', 'env-bridge');
    bridge.appendChild(h('h2', null, s.bridgeTitle));
    bridge.appendChild(h('p', null, s.bridgeBody));
    bridge.appendChild(P.badge('web-envelope', 'envelope'));
    box.appendChild(bridge);
    root.appendChild(box);
    P.ev('envelope_invalid', { reason: reason || 'field' });
    document.dispatchEvent(new CustomEvent('dailies:consent-ready'));
  }

  function relabelFooter() {
    var f = document.querySelector('footer nav');
    if (!f) return;
    var a = f.querySelectorAll('a');
    if (a[0]) { a[0].textContent = s.privacy; if (lang !== 'en') a[0].setAttribute('hreflang', 'en'); }
    if (a[1]) a[1].textContent = s.cookies;
  }
  }
})();
