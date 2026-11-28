/* ============================================================================
   Site events for mydailies.app

   The website's counterpart to the app's lib/services/analytics_service.dart,
   and the same rule applies: this is the only file that names an event. A page
   that wants to report something grows a `data-` attribute one of the handlers
   below already watches, rather than reaching for PostHog itself.

   ---------------------------------------------------------------------------
   Consent is the load, not a check
   ---------------------------------------------------------------------------
   Nothing in this file decides whether tracking is allowed. consent.js injects
   the PostHog snippet only once the visitor has agreed, so on a page where
   analytics was refused `window.posthog` simply does not exist and every
   track() below returns having done nothing. One gate, in one file: a second
   check here could drift out of step with the first and quietly resurrect
   tracking that somebody switched off.

   ---------------------------------------------------------------------------
   Why so few events
   ---------------------------------------------------------------------------
   posthog-js autocaptures clicks, so every link and button on the site is
   already in the data as `$autocapture` and can be dug out after the fact. The
   handful of named events below are the ones worth building a chart on, where
   a stable name that survives a copy rewrite is worth more than being able to
   find it later.

   ---------------------------------------------------------------------------
   platform
   ---------------------------------------------------------------------------
   Registered in consent.js rather than here, because it has to be in place
   before the first `$pageview` goes out. Every event from this site carries
   `platform: 'web'` and every event from the app carries `ios`. The site and
   the app report to separate PostHog projects. Nothing links a visitor here
   to the person they become in the app, so one project bought no funnel, and
   the property is kept so either stream still names itself if the two are
   ever put side by side. See docs/analytics.md in the app repo.

   ---------------------------------------------------------------------------
   What is deliberately not sent
   ---------------------------------------------------------------------------
   Text the visitor typed. `help_searched` carries how many results the search
   found and how long the term was, never the term itself; the privacy policy
   describes the site as recording "which pages are read, and where people give
   up", and a search box is the one control here that could capture something
   somebody wrote. Widening that is a policy edit first and a code edit second.
   ========================================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ send */

  function track(event, props) {
    var ph = window.posthog;
    // Absent when analytics was refused, and while the banner is still
    // unanswered. Both are cases where nothing should be sent.
    if (!ph || !ph.capture) return;
    try {
      ph.capture(event, props || {});
    } catch (e) {
      // Analytics must never be the reason a page misbehaves.
    }
  }

  /* A visible label reduced to a stable-ish slug, the same way Analytics.slug
     does it in the app: "Do I have to open the app?" becomes
     `do_i_have_to_open_the_app`. Second best, and for the same reason (the
     event renames itself if the copy is rewritten), so anything whose chart
     really matters should get an explicit data- attribute instead. */
  function slug(text) {
    var s = (text || '')
      .toLowerCase()
      // Accents off first, so "¿Cómo...?" on /es/ slugs to `como` and not `c_mo`.
      // Then composed again, so the kana keep their voicing marks (が stays が).
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
      // Kana, hanzi/kanji, Hangul and Arabic letters are kept: a /ja/,
      // /zh-hant/, /ko/ or /ar/ question has no Latin letters, and without
      // them every one of them would be `unnamed`. (Dutch and Swedish lose
      // only their accents, like the other Latin languages: ä to a.)
      .replace(/[^a-z0-9\u0621-\u0669\u066e-\u06d3\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!s) return 'unnamed';
    // Long enough for any question on the site, short enough that a stray
    // paragraph cannot turn into a property nothing can group by.
    return s.length > 60 ? s.slice(0, 60).replace(/_+$/, '') : s;
  }

  function closest(el, sel) {
    return el && el.closest ? el.closest(sel) : null;
  }

  /* --------------------------------------------------------------- the CTA */
  /* The one event on this site that resembles a conversion. `location` says
     which of the identical download buttons was pressed, which is
     the question the page layout actually raises: does anybody reach the one
     at the bottom, or is the hero doing all the work.

     `href` rides along so that if the buttons ever point somewhere other than
     the App Store listing, the data says when. The buttons on the document
     pages all report `location: page`; the page itself is already on the
     event's URL. */

  /* `store` says which badge: every download spot carries both stores' badges
     (a phone sees only its own, by the script in <head>), and both
     share the spot's data-download, so the href is what tells them apart. */

  function onDownload(a) {
    var href = a.getAttribute('href') || '';
    track('download_clicked', {
      location: a.getAttribute('data-download') || 'unknown',
      store: /^https:\/\/play\.google\.com\//.test(href) ? 'google_play' : 'app_store',
      href: href
    });
    // The same press is the conversion the ad platforms are buying. It goes to
    // consent.js, which owns every tag and reports it to whichever pixels the
    // visitor allowed. The two counts sit on separate consent switches and will
    // not agree with each other; that is the switches working, not a bug.
    if (window.dailiesTags) window.dailiesTags.downloadClicked();
  }

  /* ------------------------------------------------------------ the picker */
  /* index.html's taste picker: chips across the top, "Another one" underneath.
     Read off the DOM rather than wired into the picker's own code, so the two
     stay independent: the picker does not know it is measured.

     A chip that is already pressed cycles to the next quote instead of
     selecting, which is the picker's own behaviour; `action` tells the two
     apart because they mean different things. Selecting is someone saying what
     they came for. Cycling is someone enjoying it enough to ask for more. */

  /* `set` is the chip's data-set, the English slug, when it has one: the
     translated home pages label the same chips Confianza and Confiança, and
     those are the same tap. */
  function setName(chip) {
    return chip.getAttribute('data-set') || slug(chip.textContent);
  }

  function onChip(chip) {
    var pressed = chip.getAttribute('aria-pressed') === 'true';
    track('taste_used', {
      action: pressed ? 'another' : 'select',
      set: setName(chip),
      source: 'chip'
    });
  }

  function onAgain() {
    var active = document.querySelector('#chips .chip[aria-pressed="true"]');
    track('taste_used', {
      action: 'another',
      set: active ? setName(active) : 'unknown',
      source: 'button'
    });
  }

  /* --------------------------------------------------------------- the FAQ */
  /* Bound to a click on the summary, never to the `toggle` event, and that is
     load-bearing rather than a style choice. The help page opens and closes
     accordions itself (the search box filters by opening every match, and a
     #hash link opens the section it lands on), and `toggle` cannot tell those
     apart from a visitor deciding to read something. One search would send a
     dozen `faq_opened` events per keystroke.

     A click on a summary that is currently closed is a person opening it, and
     nothing else does that. */

  function onSummary(summary) {
    var details = closest(summary, 'details');
    // Still closed at click time: this click is the one that opens it. Closing
    // an answer again is not worth an event.
    if (!details || details.hasAttribute('open')) return;
    track('faq_opened', {
      question: slug(summary.textContent),
      page: location.pathname
    });
  }

  /* ------------------------------------------------------------ help search */
  /* What people cannot find is the most useful thing a help page can tell you,
     and `results: 0` is the whole signal: a term that found nothing is a gap
     in the page. Sent on a pause in typing rather than per keystroke, so
     "notifications" is one event and not fourteen.

     The term itself is not sent; see the note at the top of this file. */

  var searchTimer = null;

  function watchHelpSearch() {
    var box = document.getElementById('q');
    if (!box) return;
    box.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var term = box.value.trim();
        // Matches the threshold the help page's own filter uses: below two
        // characters it has not searched for anything yet.
        if (term.length < 2) return;
        var hits = document.querySelectorAll(
          '.faq details:not([style*="none"])'
        ).length;
        track('help_searched', { term_length: term.length, results: hits });
      }, 900);
    });
  }

  /* ------------------------------------------------------------ delegation */
  /* One listener on the document for the lot. Every page on the site loads
     this same file, so anything bound to an element that only exists on one of
     them would have to be guarded page by page; a delegated handler simply
     never matches.

     Registered on the **capture** phase, which is not a detail. The picker
     binds its own handler to each chip, and that handler sets `aria-pressed`
     the moment the chip is clicked; so a bubbling listener arrives to find
     every chip already pressed and reports a first-time selection as a repeat.
     Capturing runs before the element's own handler, while the DOM still says
     what it said when the visitor decided to click. The same holds for
     `<details>`: it is still closed either way, because the browser toggles it
     as the default action after dispatch, so nothing else here changes. */

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var download = closest(t, '[data-download]');
    if (download) {
      onDownload(download);
      return;
    }

    var chip = closest(t, '#chips .chip');
    if (chip) {
      onChip(chip);
      return;
    }

    if (closest(t, '#again')) {
      onAgain();
      return;
    }

    var summary = closest(t, 'summary');
    if (summary) onSummary(summary);
  }, true);

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(watchHelpSearch);

  /* --------------------------------------------- envelopes and wallpapers */
  /* play.js, envelope.js, encourage.js and wallpaper.js report through
     dailiesAnalytics.play(). The names live here, with every other event on
     the site:

       envelope_picked   a line chosen on the words-of-encouragement page;
                         `from` is occasion (a chip), own (Write your own),
                         list (Send this one) or blog (Send it in an envelope
                         under a quote on a blog post or author page)
       envelope_sealed   somebody sealed a line; `mode` is page (a line
                         from the encouragement page), blog (a quote from a
                         blog post or author page) or own (their own words)
       envelope_shared   ...and sent it; `method` is share, message, whatsapp or email
       envelope_viewed   /e/ showed a sealed envelope
       envelope_opened   ...and it was opened; `ms_to_open` is how long they looked first
       envelope_cta      a button on an opened envelope: `action` is send_back,
                         wallpaper or read_more
       envelope_invalid  the link did not decode; `reason` is empty, decode or field
       wallpaper_changed the maker: `change` is mood, line, bg or own (the first
                         three of each per page)
       wallpaper_picked  a gallery picture or a listed line opened in the
                         maker; `from` is gallery or list
       wallpaper_saved   the picture was handed over: `method` is share, download
                         or hold (pressed and held on an iPhone), `mood` the mood it came from (or none),
                         `from` maker, gallery, list, envelope or blog (Make it
                         a wallpaper under a quote on a blog post or author page)

     An envelope carries two names, and the composer shows them on screen.
     They are never sent: only the keys below get through, and a string value
     has to look like a slug, so a name cannot ride along by mistake. On /e/
     the link's #fragment, which holds them, is cut off every URL PostHog
     records (data-analytics="private" in consent.js).

     The banner on /e/ is only asked once the envelope is open, so the first
     events there happen before anybody has said yes. They are held here in
     memory, never stored, sent if the visitor then allows analytics and
     dropped with the page otherwise. The same holds on any page whose banner
     is still unanswered. */

  var PLAY_EVENTS = {
    envelope_picked: 1, envelope_sealed: 1, envelope_shared: 1, envelope_viewed: 1,
    envelope_opened: 1, envelope_cta: 1, envelope_invalid: 1,
    wallpaper_changed: 1, wallpaper_picked: 1, wallpaper_saved: 1
  };
  var PLAY_KEYS = ['mode', 'method', 'action', 'reason', 'from', 'change', 'mood', 'ms_to_open',
    'has_to', 'has_from'];
  var SAFE_STRING = /^[a-z0-9_-]{1,40}$/i;
  var held = [];

  function play(event, props) {
    if (!PLAY_EVENTS[event]) return;
    var clean = {};
    PLAY_KEYS.forEach(function (k) {
      if (!props || !(k in props)) return;
      var v = props[k];
      if (v === null || typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) clean[k] = v;
      else if (typeof v === 'string' && SAFE_STRING.test(v)) clean[k] = v;
    });
    if (window.posthog && window.posthog.capture) track(event, clean);
    else if (held.length < 20) held.push([event, clean]);
  }

  /* ------------------------------------------- envelopes sealed in the app */
  /* /sealed/ is where a friend opens a line somebody sealed for them in the
     app, and sealed.js reports through dailiesAnalytics.envelope(). These are
     kept apart from the envelope_* events above, which are the
     words-of-encouragement page's own funnel on /e/: the two envelopes start
     in different places and are read as two numbers.

       app_envelope_viewed   the sealed envelope was shown
       app_envelope_opened   ...and opened; `ms_to_open` is how long they looked first
       app_envelope_cta      something done with it; `action` is one of
                               send_back        Send one back tapped
                               handoff_app      ...and the app took over (iPhone)
                               handoff_web      ...or it did not, and the
                                                page's own composer opened
                               get_app          the Get Dailies link tapped;
                                                `store` app_store, google_play
                                                or get_page (a computer, sent
                                                to /get/)
                               composer_opened  the page's composer, `mode`
                                                back (a reply) or new
                               change_line      the next house line
                               write_own        own words on the letter
                               use_line         back to the house lines
                               hold_released    the wax let go early;
                                                `progress` 0 to 1
                               web_sealed       sealed; `mode` own or line,
                                                `how` hold or key
                               edit             Change something, after sealing
                               web_sent         sent; `destination` share,
                                                whatsapp, messages or copy,
                                                `mode` own or line,
                                                `sent_short`
                               composer_closed  the composer closed; `step`
                                                compose, sealed or sent
       app_envelope_invalid  the link did not decode; `reason` is empty,
                             decode, version or field, and for a short link
                             missing (no such id), fetch (the store did not
                             answer) or decrypt (the key does not open it)

     Every app_envelope_* event carries `short`: true when the link that was
     opened was a short one (#<id>.<key>), fetched from the envelope store.
     web_sent also carries `sent_short`: the reply went out as a short link.
     app_envelope_viewed and app_envelope_opened carry `photo` when the
     envelope names the sender's own photo: shown, or failed (the house
     photograph stood in), and `seal`: initial when the sender's initial is
     pressed into the wax, mark when it is the quote mark.

     Same rules as above: names and words never get through, only these keys
     with slug-like or numeric values, and events from before the banner is
     answered are held in memory and sent only if analytics is then allowed. */

  var APP_ENVELOPE_EVENTS = {
    viewed: 'app_envelope_viewed',
    opened: 'app_envelope_opened',
    cta: 'app_envelope_cta',
    invalid: 'app_envelope_invalid'
  };
  var APP_ENVELOPE_KEYS = ['own', 'has_author', 'text_length', 'quote_id', 'thread_n', 'open_when',
    'ms_to_open', 'action', 'platform_guess', 'destination', 'store', 'reason', 'mode', 'how', 'step', 'progress', 'short', 'sent_short', 'photo', 'seal'];

  function envelope(kind, props) {
    var event = APP_ENVELOPE_EVENTS[kind];
    if (!event) return;
    var clean = {};
    APP_ENVELOPE_KEYS.forEach(function (k) {
      if (!props || !(k in props)) return;
      var v = props[k];
      if (v === null || typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) clean[k] = v;
      else if (typeof v === 'string' && SAFE_STRING.test(v)) clean[k] = v;
    });
    if (window.posthog && window.posthog.capture) track(event, clean);
    else if (held.length < 20) held.push([event, clean]);
  }

  function releaseHeld(state) {
    var list = held;
    held = [];
    if (!state || !state.analytics) return;
    list.forEach(function (e) { track(e[0], e[1]); });
  }

  /* ---------------------------------------------------------------- public */
  /* consent.js calls this the moment a decision is saved. It only ever
     arrives when analytics was allowed (a refusal loads no PostHog for it to
     reach), so read the result as "of the people who said yes to something,
     how many also said yes to ads", never as an accept rate. The share of
     visitors who refuse outright is not knowable, by design, and no amount of
     instrumenting will make it so. */

  window.dailiesAnalytics = {
    track: track,
    play: play,
    envelope: envelope,
    consentDecided: function (state, choice) {
      track('consent_decided', {
        choice: choice,
        analytics: !!(state && state.analytics),
        marketing: !!(state && state.marketing)
      });
      releaseHeld(state);
    }
  };
})();
