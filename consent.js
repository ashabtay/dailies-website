/* ============================================================================
   Cookie consent + tag loading for mydailies.app

   Loaded by every page. Nothing that tracks is allowed to load itself: the
   Google and Meta pixels and the PostHog snippet all live inside this file,
   behind a stored decision, so that "no non-essential cookie is set until you
   agree" is enforced by the code rather than promised by the policy.

   Two categories the visitor can decide on:

     analytics  - PostHog. How the site is used, in aggregate.
     marketing  - Google + Meta pixels. Which ad brought someone here.

   Necessary is not offered as a choice because there is nothing in it: the
   site has no login and no basket, and the only thing stored is the consent
   decision itself, which is exempt.

   ---------------------------------------------------------------------------
   BEFORE THIS DOES ANYTHING, FILL IN THE IDS IN `CONFIG` BELOW.
   While an id is left empty its tag is skipped, so the banner works and the
   site stays clean until you are ready.
   ---------------------------------------------------------------------------
   ========================================================================= */
(function () {
  'use strict';

  var CONFIG = {
    posthogKey:  'phc_m4yo9P5TgvkQTvfy6rM5WnU3Kar7L7fjb5PJB9yKoLq9',                        // e.g. 'phc_xxxxxxxxxxxxxxxxxxxx'
    posthogHost: 'https://eu.i.posthog.com', // EU host keeps data in the EU
    googleId:    '',                        // e.g. 'AW-123456789' or 'G-XXXXXXX'
    metaPixelId: ''                         // e.g. '1234567890123456'
  };

  var STORE = 'dailies_consent';
  var VERSION = 1;               // bump to re-ask everyone after a material change
  var MAX_AGE_DAYS = 365;        // re-ask once a year

  /* --------------------------------------------------------------- signals */

  /* A browser-level opt-out. Global Privacy Control is a real legal signal —
     California treats it as a valid opt-out a business must honour, and it is
     a clear expression of objection anywhere else. Do Not Track has no legal
     force and Safari dropped it, but a visitor who switched it on has said the
     same thing, so it is treated the same way here.

     Read fresh on every load and never persisted: someone who turns the signal
     off should stop being opted out, and a stored copy would outlive it. */
  function privacySignal() {
    try {
      if (navigator.globalPrivacyControl === true) return 'gpc';
      var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
      if (dnt === '1' || dnt === 'yes') return 'dnt';
    } catch (e) {}
    return null;
  }

  var SIGNAL = privacySignal();

  /* ---------------------------------------------------------------- state */

  function read() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || v.v !== VERSION) return null;
      if (Date.now() - v.ts > MAX_AGE_DAYS * 864e5) return null;
      return v;
    } catch (e) {
      // Private browsing, or storage disabled. Treat as "not asked yet" and
      // simply do not track — never fall through to loading the tags.
      return null;
    }
  }

  /* [override] marks a choice made *while* a browser signal was active — the
     visitor was told it was on and switched something on anyway. Only that
     beats the signal on the next load; an ordinary stored decision does not,
     because it may predate the signal being turned on. */
  function write(analytics, marketing, override) {
    var v = { v: VERSION, ts: Date.now(), analytics: !!analytics, marketing: !!marketing };
    if (override) v.override = true;
    try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) {}
    return v;
  }

  /* ------------------------------------------------------------ the tags */
  /* Each loader is idempotent: reopening the panel and pressing Save again
     must not inject a second copy of a script. */

  var loaded = { analytics: false, marketing: false };

  function loadAnalytics() {
    if (loaded.analytics || !CONFIG.posthogKey) return;
    loaded.analytics = true;

    !function (t, e) {
      var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) {
        function g(t, e) { var o = e.split('.'); 2 == o.length && (t = t[o[0]], e = o[1]);
          t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; }
        (p = t.createElement('script')).type = 'text/javascript'; p.async = !0;
        p.src = s.api_host + '/static/array.js';
        (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r);
        var u = e; for (void 0 !== a ? u = e[a] = [] : a = 'posthog', u.people = u.people || [],
          u.toString = function (t) { var e = 'posthog'; return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e; },
          u.people.toString = function () { return u.toString(1) + '.people (stub)'; },
          o = 'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep'.split(' '),
          n = 0; n < o.length; n++) g(u, o[n]);
        e._i.push([i, s, a]);
      }, e.__SV = 1);
    }(document, window.posthog || []);

    window.posthog.init(CONFIG.posthogKey, {
      api_host: CONFIG.posthogHost,
      persistence: 'localStorage+cookie',
      // The policy says approximate location only, and that no recording of
      // the screen takes place. This is the line that makes the second true.
      disable_session_recording: true,
      // Off so that the pageview can be sent by hand below, *after* the
      // platform super property is registered. Left on, PostHog sends it from
      // inside init() — before any register() call can reach it — and the
      // single most important event on this site would be the one event
      // without `platform` on it, missing from exactly the charts that
      // property exists to make possible. Nothing is given up: this is a
      // static multi-page site, so one pageview per load is all the automatic
      // capture would have sent anyway.
      capture_pageview: false
    });

    // Which platform, on every event this site sends. The app reports to this
    // same PostHog project — the free plan allows one — so without this the
    // website's pageviews and the app's events are one undifferentiated
    // stream and neither can be asked about alone. The app registers the
    // matching `ios` in lib/services/analytics_service.dart.
    window.posthog.register({ platform: 'web' });

    // The page that was open when consent was granted. On a return visit this
    // runs at parse time and reports the load as normal; on the visit where
    // the banner was just accepted it reports the page they accepted on,
    // which is the same page they arrived at.
    window.posthog.capture('$pageview');
  }

  function loadMarketing() {
    if (loaded.marketing) return;
    loaded.marketing = true;

    if (CONFIG.googleId) {
      var gs = document.createElement('script');
      gs.async = true;
      gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.googleId);
      document.head.appendChild(gs);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', CONFIG.googleId, { anonymize_ip: true });
    }

    if (CONFIG.metaPixelId) {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CONFIG.metaPixelId);
      window.fbq('track', 'PageView');
    }
  }

  function apply(state) {
    if (!state) return;
    if (state.analytics) loadAnalytics();
    if (state.marketing) loadMarketing();
    // Nothing is "unloaded" on withdrawal — a script already in the page cannot
    // be recalled. Withdrawing stops it firing again from the next page load,
    // and the panel says so rather than implying otherwise.
    if (window.posthog && window.posthog.set_config && !state.analytics) {
      try { window.posthog.opt_out_capturing(); } catch (e) {}
    }
  }

  /* ---------------------------------------------------------------- markup */

  var CSS = [
    '.cc-scrim{position:fixed;inset:0;z-index:998;background:rgba(8,10,9,.45);backdrop-filter:blur(2px)}',
    '.cc{position:fixed;z-index:999;left:50%;translate:-50% 0;bottom:18px;width:min(100% - 28px,560px);',
      'background:var(--panel,#202523);color:var(--text,#f0e6d2);border:1px solid var(--rule,rgba(240,230,210,.13));',
      'border-radius:18px;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.45);',
      'font-family:var(--f-body,ui-sans-serif,-apple-system,"Segoe UI",sans-serif);font-size:15px;line-height:1.55}',
    '.cc h2{font-family:var(--f-display,Georgia,serif);font-weight:400;font-size:21px;line-height:1.2;margin:0 0 9px}',
    '.cc p{margin:0 0 14px;color:var(--text-dim,#aeaa9c);font-size:14.5px}',
    '.cc a{color:var(--accent,#9db081)}',
    '.cc-row{display:flex;gap:9px;flex-wrap:wrap}',
    '.cc-btn{font:600 14px/1 var(--f-body,sans-serif);padding:12px 18px;border-radius:999px;border:1px solid var(--rule,rgba(240,230,210,.13));',
      'background:none;color:var(--text,#f0e6d2);cursor:pointer;transition:border-color .2s,color .2s}',
    '.cc-btn:hover{border-color:var(--accent-dim,#7d8f63);color:var(--accent,#9db081)}',
    '.cc-btn.primary{background:var(--text,#f0e6d2);color:var(--ground,#191c1d);border-color:transparent}',
    '.cc-btn.primary:hover{color:var(--ground,#191c1d);opacity:.9}',
    '.cc-btn.link{border:0;padding:12px 6px;font-weight:500;color:var(--text-dim,#aeaa9c);text-decoration:underline}',
    '.cc-signal{background:var(--chip-on,rgba(157,176,129,.14));border:1px solid var(--accent-dim,#7d8f63);',
      'border-radius:11px;padding:12px 14px;margin:0 0 15px;font-size:13.5px;line-height:1.5;color:var(--text,#f0e6d2)}',
    '.cc-opts{display:flex;flex-direction:column;gap:2px;margin:0 0 16px}',
    '.cc-opt{display:flex;gap:13px;align-items:flex-start;padding:13px 0;border-top:1px solid var(--rule-soft,rgba(240,230,210,.07))}',
    '.cc-opt input{margin:3px 0 0;width:17px;height:17px;accent-color:var(--accent,#9db081);flex:none}',
    '.cc-opt label{font-weight:600;font-size:14.5px;cursor:pointer;display:block}',
    '.cc-opt span{display:block;color:var(--text-dim,#aeaa9c);font-size:13.5px;margin-top:3px}',
    '.cc-opt.fixed input{opacity:.5;cursor:not-allowed}',
    '@media (max-width:520px){.cc{padding:19px}.cc-row{flex-direction:column}.cc-btn{width:100%}}',
    '@media (prefers-reduced-motion:reduce){.cc,.cc-scrim{animation:none!important}}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('cc-css')) return;
    var s = document.createElement('style');
    s.id = 'cc-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  var el = null, scrim = null, lastFocus = null;

  function close() {
    if (el) { el.remove(); el = null; }
    if (scrim) { scrim.remove(); scrim = null; }
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (e.key !== 'Tab' || !el) return;
    // Trap focus: the panel is a decision, and tabbing off into the page
    // behind it loses people who navigate by keyboard.
    var f = el.querySelectorAll('button,input,a[href]');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open(showDetail) {
    injectCSS();
    close();
    lastFocus = document.activeElement;

    scrim = document.createElement('div');
    scrim.className = 'cc-scrim';
    document.body.appendChild(scrim);

    el = document.createElement('div');
    el.className = 'cc';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'cc-title');

    var cur = read() || { analytics: false, marketing: false };

    if (!showDetail) {
      el.innerHTML =
        '<h2 id="cc-title">A quick word about cookies</h2>' +
        '<p>This site would like to measure how it is used, and which advert brought you here. ' +
        'Nothing is set unless you say yes, and the app itself is a separate question — both are ' +
        'explained in the <a href="/cookies/">Cookie Policy</a>.</p>' +
        '<div class="cc-row">' +
          '<button class="cc-btn primary" data-act="all">Accept all</button>' +
          '<button class="cc-btn" data-act="none">Reject all</button>' +
          '<button class="cc-btn link" data-act="detail">Choose</button>' +
        '</div>';
    } else {
      el.innerHTML =
        '<h2 id="cc-title">Choose what you allow</h2>' +
        '<p>You can change this whenever you like from the <strong>Cookie settings</strong> link in the footer.</p>' +
        (SIGNAL
          ? '<div class="cc-signal"><strong>Your browser is asking sites not to track you</strong>' +
            ' \u2014 ' + (SIGNAL === 'gpc' ? 'Global Privacy Control' : 'Do Not Track') + ' is switched on and is being' +
            ' honoured: everything below is off, and nothing has been loaded. Ticking a box overrides that for this site only.</div>'
          : '') +
        '<div class="cc-opts">' +
          '<div class="cc-opt fixed">' +
            '<input type="checkbox" id="cc-nec" checked disabled>' +
            '<div><label for="cc-nec">Strictly necessary</label>' +
            '<span>Only your answer to this question. It cannot be switched off, and it is the sole thing stored without consent.</span></div>' +
          '</div>' +
          '<div class="cc-opt">' +
            '<input type="checkbox" id="cc-ana"' + (cur.analytics ? ' checked' : '') + '>' +
            '<div><label for="cc-ana">Analytics</label>' +
            '<span>PostHog. Which pages are read and how people move through the site, so it can be improved.</span></div>' +
          '</div>' +
          '<div class="cc-opt">' +
            '<input type="checkbox" id="cc-mkt"' + (cur.marketing ? ' checked' : '') + '>' +
            '<div><label for="cc-mkt">Advertising</label>' +
            '<span>Google and Meta pixels. Measures which advert led to a download, and lets those platforms show you ads.</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="cc-row">' +
          '<button class="cc-btn primary" data-act="save">Save choices</button>' +
          '<button class="cc-btn" data-act="none">Reject all</button>' +
        '</div>';
    }

    document.body.appendChild(el);

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'detail') { open(true); return; }
      var state, ana, mkt;
      if (act === 'all') { ana = true; mkt = true; }
      else if (act === 'none') { ana = false; mkt = false; }
      else {
        ana = el.querySelector('#cc-ana').checked;
        mkt = el.querySelector('#cc-mkt').checked;
      }
      // Only switching something *on* overrides the signal. Agreeing with it
      // needs no override, and recording one would quietly outlive the signal.
      state = write(ana, mkt, SIGNAL && (ana || mkt));
      close();
      apply(state);
      // After apply(), so that on an acceptance PostHog is already loading and
      // the event has somewhere to land. On a refusal it goes nowhere at all,
      // which is the point — see the note on consentDecided in analytics.js.
      if (window.dailiesAnalytics) window.dailiesAnalytics.consentDecided(state, act);
    });

    document.addEventListener('keydown', onKey);
    var focusFirst = el.querySelector('button');
    if (focusFirst) focusFirst.focus();
  }

  /* ------------------------------------------------------------------ boot */

  var saved = read();

  /* The signal is an answer. Honouring it means neither loading anything nor
     showing the banner: asking again would be asking someone to repeat
     themselves, and popping a dialog at a visitor who has already opted out at
     browser level is precisely the pattern the signal exists to end.

     An explicit override survives it; anything else is overruled. */
  if (SIGNAL && !(saved && saved.override)) {
    saved = { v: VERSION, ts: Date.now(), analytics: false, marketing: false, signal: SIGNAL };
  }

  if (saved) apply(saved);

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    // A "Cookie settings" control anywhere on the page reopens the panel. This
    // is the withdrawal route the policy promises, so every page carries one.
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-cookie-settings]');
      if (!t) return;
      e.preventDefault();
      open(true);
    });
    if (!saved) open(false);
  });

  // Small public surface, so a page can check state without reading storage.
  window.dailiesConsent = {
    signal: SIGNAL,
    get: read,
    open: function () { open(true); }
  };
})();
