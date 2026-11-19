/* ============================================================================
   /e/ - where a friend opens an envelope somebody sealed on the
   words-of-encouragement page

   Reads the link (see play.js for its fields), shows the sealed envelope with
   the friend's name on it, opens it (the seal lifts, the flap folds back, the
   letter rises out with the line on it), and then shows the line on one of
   the app's backgrounds, with the ways onward:

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

  var P = window.DailiesPlay;
  var root = document.getElementById('env');
  if (!P || !root) return;
  var h = P.h;

  var HOMES = { en: '/', es: '/es/', pt: '/pt/', fr: '/fr/', de: '/de/', ja: '/ja/' };
  var res = P.decode(location.hash);
  var env = res.env;
  var lang = env ? env.l : P.pickLang(navigator.language);
  P.setLang(lang);
  var s = P.strings();
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    var envl = h('button', 'env-envelope');
    envl.type = 'button';
    envl.setAttribute('aria-label', s.openIt);
    envl.appendChild(h('span', 'env-back'));
    var letter = h('span', 'env-letter');
    var words = h('span', 'env-letter-in', P.envText(env, lang));
    words.setAttribute('dir', 'auto');
    letter.appendChild(words);
    envl.appendChild(letter);
    envl.appendChild(h('span', 'env-pocket'));
    envl.appendChild(h('span', 'env-flap'));
    var seal = h('span', 'env-seal', 'D');
    seal.setAttribute('aria-hidden', 'true');
    envl.appendChild(seal);
    box.appendChild(envl);

    var forLine = h('h1', 'env-for');
    if (env.to) P.fill(forLine, s.forName, { to: env.to });
    else forLine.textContent = s.forYou;
    box.appendChild(forLine);
    if (env.f) box.appendChild(P.fill(h('p', 'env-from'), s.fromName, { from: env.f }));

    var openBtn = h('button', 'pl-primary env-openbtn', s.openIt);
    openBtn.type = 'button';
    box.appendChild(openBtn);
    box.appendChild(h('p', 'env-note', s.openNote));
    root.appendChild(box);

    P.ev('envelope_viewed', { has_to: !!env.to, has_from: !!env.f });

    var done = false;
    function openIt() {
      if (done) return;
      done = true;
      P.ev('envelope_opened', { ms_to_open: Date.now() - t0 });
      // The seal lifts, the flap folds back, the letter rises (doc.css,
      // .is-opening); then the scene fades and the open card takes over.
      box.classList.add('is-opening');
      setTimeout(function () { box.classList.add('is-leaving'); }, reduce ? 0 : 1550);
      setTimeout(function () {
        root.textContent = '';
        opened();
        window.scrollTo(0, 0);
        // The cookie question comes once the line has had a moment to be
        // read, not on top of it the instant it appears.
        setTimeout(function () {
          document.dispatchEvent(new CustomEvent('dailies:consent-ready'));
        }, 2500);
      }, reduce ? 0 : 1850);
    }
    envl.addEventListener('click', openIt);
    openBtn.addEventListener('click', openIt);
  }

  /* ------------------------------------------------------------- opened */

  function opened() {
    var box = h('section', 'env-opened');
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
})();
