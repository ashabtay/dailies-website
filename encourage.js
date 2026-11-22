/* ============================================================================
   The envelope composer, on /words-of-encouragement/ and its translations

   Like the wallpaper page, the page stands without this file: every line is
   in the HTML under its occasion's heading. This wires up the composer at the
   top (the occasion chips, Back and Next line, "Write your own", the two
   names) and the "Send this one" button beside every line below, which opens
   that line in the composer.

   The preview is the app's envelope (envelope-art.js): the line stands in it
   as a letter, their name is written on the front, and holding the wax seals
   it, as in the app. Once the wax has landed, play.js shows the ways to send
   the link and the App Store badge; closing that opens the envelope again.

   An opened envelope's "Send one back" arrives here as #to=<name>&from=<name>
   (the names swapped round), fills them in, and clears them from the address.
   ========================================================================= */
(function () {
  'use strict';

  var P = window.DailiesPlay;
  var A = window.DailiesEnvelopeArt;
  var form = document.getElementById('composer');
  var stringsEl = document.getElementById('play-strings');
  if (!P || !A || !form || !stringsEl) return;
  var D = P.data;
  var S = JSON.parse(stringsEl.textContent);
  var lang = form.getAttribute('data-lang') || 'en';
  // This page's lines by occasion: each envelope page (encouragement,
  // friends, love, good morning) has its own set in play-lines.js.
  var pageKey = D.sets[form.getAttribute('data-page')] ? form.getAttribute('data-page') : 'encouragement';
  var G = D.sets[pageKey].groups;

  var state = { occ: Object.keys(G)[0], i: 0, q: form.getAttribute('data-q'), k: +form.getAttribute('data-k') || 0 };
  var PS = P.strings();
  // The envelope takes the place of the plain card the page is written with.
  var stage = form.querySelector('.en-stage');
  var parts = A.build('compose', { holdLabel: PS.holdToSeal });
  var room = P.h('div', 'ea-room');
  room.appendChild(parts.el);
  stage.textContent = '';
  stage.appendChild(room);
  var card = P.h('figure', 'ea-card');
  card.setAttribute('aria-hidden', 'true');
  var cardImg = document.createElement('img');
  cardImg.alt = '';
  card.appendChild(cardImg);
  var cardQ = P.h('blockquote');
  var cardP = P.h('p');
  cardP.setAttribute('dir', 'auto');
  cardQ.appendChild(cardP);
  card.appendChild(cardQ);
  parts.letter.appendChild(card);
  var env = A.composer(parts, {
    holdLabel: PS.holdToSeal,
    onSeal: send
  });
  var own = form.querySelector('.pl-own');
  var nav = form.querySelector('.pl-linenav');
  var to = form.querySelector('input[name="to"]');
  var from = form.querySelector('input[name="from"]');
  var hint = form.querySelector('.pl-hint');
  var chips = Array.prototype.slice.call(form.querySelectorAll('.pl-chip'));

  function locate(q) {
    for (var o in G) {
      for (var i = 0; i < G[o].length; i++) {
        if (G[o][i][0] === q) { state.occ = o; state.i = i; return; }
      }
    }
  }
  locate(state.q);
  readHash();

  function readHash() {
    var raw = location.hash.slice(1);
    if (!raw || raw.indexOf('=') === -1) return;
    raw.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 1) return;
      var v = '';
      try { v = P.clean(decodeURIComponent(kv.slice(i + 1)), P.MAX_NAME); } catch (e) {}
      if (kv.slice(0, i) === 'to') to.value = v;
      if (kv.slice(0, i) === 'from') from.value = v;
    });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  function isOwn() { return state.occ === 'own'; }
  function ownText() { return P.clean(own.value, P.MAX_OWN); }

  function draw() {
    var name = P.clean(to.value, P.MAX_NAME);
    var mine = isOwn();
    own.hidden = !mine;
    nav.hidden = mine;
    card.classList.toggle('is-own', mine);
    cardImg.src = P.bgUrl(state.k);
    cardP.textContent = '';
    var t, a = '';
    if (mine) {
      t = ownText() || S.ownEmpty;
      cardP.textContent = t;
      cardP.classList.toggle('is-placeholder', !ownText());
    } else {
      cardP.classList.remove('is-placeholder');
      t = P.lineText(state.q, lang, name || S.nameph);
      a = P.lineAuthor(state.q, lang);
      if (P.isNamed(state.q) && !name) {
        // The placeholder shows where their name goes until there is one.
        var raw = P.lineText(state.q, lang, '\u0000').split('\u0000');
        cardP.appendChild(document.createTextNode(raw[0]));
        cardP.appendChild(P.h('span', 'en-name', S.nameph));
        cardP.appendChild(document.createTextNode(raw[1] || ''));
      } else cardP.textContent = t;
    }
    card.style.setProperty('--fs', A.textSize(A.chars(t)));
    if (name) A.paintName(parts.name, fillName(name), false);
    else A.paintName(parts.name, PS.forYou, false);
    var cite = cardQ.querySelector('cite');
    if (a) {
      if (!cite) { cite = P.h('cite'); cardQ.appendChild(cite); }
      cite.textContent = a;
    } else if (cite) cite.remove();
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-occ') === state.occ)); });
    var ok = mine ? !!ownText() : (!P.isNamed(state.q) || !!name);
    env.setReady(ok);
    hint.textContent = ok ? PS.sealHint : mine ? '' : S.need;
    hint.classList.toggle('is-ready', ok);
  }

  // "For Dana", as /e/ will show it.
  function fillName(name) { return PS.forName.split('{to}').join(name); }

  // A new line: the letter drops into the envelope and comes back up with
  // it. Typing (a name, your own words) just redraws.
  function redraw() { env.swap(draw); }

  function set(entry) { state.q = entry[0]; state.k = entry[1]; }

  var counts = 0;
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      state.occ = c.getAttribute('data-occ');
      state.i = 0;
      if (!isOwn()) set(G[state.occ][0]);
      if (++counts <= 3) P.ev('envelope_picked', { from: isOwn() ? 'own' : 'occasion' });
      redraw();
      if (isOwn()) own.focus();
    });
  });

  Array.prototype.forEach.call(form.querySelectorAll('[data-step]'), function (b) {
    b.addEventListener('click', function () {
      var list = G[state.occ];
      state.i = (state.i + (+b.getAttribute('data-step')) + list.length) % list.length;
      set(list[state.i]);
      redraw();
    });
  });

  to.addEventListener('input', draw);
  own.addEventListener('input', draw);

  Array.prototype.forEach.call(document.querySelectorAll('.en-send'), function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      state.q = b.getAttribute('data-q');
      state.k = +b.getAttribute('data-k');
      locate(state.q);
      P.ev('envelope_picked', { from: 'list' });
      draw();
      if (env.state.sealed) env.unseal();
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      setTimeout(function () { to.focus({ preventScroll: true }); }, reduce ? 0 : 450);
    });
  });

  // Return in a name field seals it the way the keyboard does on the wax:
  // the envelope closes, then the wax lands. (The form has no submit
  // button; the wax is the one way to seal.)
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  [to, from].forEach(function (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      if (env.state.sealed) return;
      if (!env.state.ready) { (isOwn() ? own : to).focus(); return; }
      env.seal('key');
    });
  });

  // The wax has landed: the link, and the ways to send it.
  function send() {
    var e = { to: P.clean(to.value, P.MAX_NAME), f: P.clean(from.value, P.MAX_NAME), l: lang, k: state.k, p: pageKey };
    if (isOwn()) e.t = ownText(); else e.q = state.q;
    P.ev('envelope_sealed', { mode: isOwn() ? 'own' : 'page', has_to: !!e.to, has_from: !!e.f });
    P.sent(null, e, isOwn() ? 'own' : 'page', function () { env.unseal(); });
  }

  draw();
})();
