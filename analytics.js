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
   `platform: 'web'` and every event from the app carries `ios`. They report to
   one PostHog project — the free plan allows exactly one — so that property is
   the only thing holding the two streams apart. See docs/analytics.md in the
   app repo.

   ---------------------------------------------------------------------------
   What is deliberately not sent
   ---------------------------------------------------------------------------
   Text the visitor typed. `help_searched` carries how many results the search
   found and how long the term was, never the term itself — the privacy policy
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
     `do_i_have_to_open_the_app`. Second best, and for the same reason — the
     event renames itself if the copy is rewritten — so anything whose chart
     really matters should get an explicit data- attribute instead. */
  function slug(text) {
    var s = (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
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
     which of the identical "Download for iPhone" buttons was pressed, which is
     the question the page layout actually raises: does anybody reach the one
     at the bottom, or is the hero doing all the work.

     `href` rides along because the button does not point at the App Store yet
     — it points back at this site — so the day that changes, the data says
     when. */

  function onDownload(a) {
    track('download_clicked', {
      location: a.getAttribute('data-download') || 'unknown',
      href: a.getAttribute('href') || ''
    });
  }

  /* ------------------------------------------------------------ the picker */
  /* index.html's taste picker: chips across the top, "Another one" underneath.
     Read off the DOM rather than wired into the picker's own code, so the two
     stay independent — the picker does not know it is measured.

     A chip that is already pressed cycles to the next quote instead of
     selecting, which is the picker's own behaviour; `action` tells the two
     apart because they mean different things. Selecting is someone saying what
     they came for. Cycling is someone enjoying it enough to ask for more. */

  function onChip(chip) {
    var pressed = chip.getAttribute('aria-pressed') === 'true';
    track('taste_used', {
      action: pressed ? 'another' : 'select',
      set: slug(chip.textContent),
      source: 'chip'
    });
  }

  function onAgain() {
    var active = document.querySelector('#chips .chip[aria-pressed="true"]');
    track('taste_used', {
      action: 'another',
      set: active ? slug(active.textContent) : 'unknown',
      source: 'button'
    });
  }

  /* --------------------------------------------------------------- the FAQ */
  /* Bound to a click on the summary, never to the `toggle` event, and that is
     load-bearing rather than a style choice. The help page opens and closes
     accordions itself — the search box filters by opening every match, and a
     #hash link opens the section it lands on — and `toggle` cannot tell those
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
     and `results: 0` is the whole signal — a term that found nothing is a gap
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
     the moment the chip is clicked — so a bubbling listener arrives to find
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

  /* ---------------------------------------------------------------- public */
  /* consent.js calls this the moment a decision is saved. It only ever
     arrives when analytics was allowed — a refusal loads no PostHog for it to
     reach — so read the result as "of the people who said yes to something,
     how many also said yes to ads", never as an accept rate. The share of
     visitors who refuse outright is not knowable, by design, and no amount of
     instrumenting will make it so. */

  window.dailiesAnalytics = {
    track: track,
    consentDecided: function (state, choice) {
      track('consent_decided', {
        choice: choice,
        analytics: !!(state && state.analytics),
        marketing: !!(state && state.marketing)
      });
    }
  };
})();
