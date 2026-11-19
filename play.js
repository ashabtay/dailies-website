/* ============================================================================
   Envelopes: the shared part, for /words-of-encouragement/ (every language),
   /motivational-wallpapers/ and /e/

   A visitor picks a line, types a friend's name (and, if they like, their
   own), and seals it. The friend gets a link to /e/, where an envelope with
   their name on it opens to the line. From there they can send one back,
   pass it on, make it a wallpaper, or read more lines like it, and every one
   of those ends on the App Store badge (campaign token web-envelope, with
   -es, -pt, -fr, -de, -ja), so App Store Connect shows what envelopes send.

   The lines live in play-lines.js (window.DailiesLines), written by
   tools/play_pages.py from the app's own quotes.db. This file needs it.

   ---------------------------------------------------------------------------
   The envelope link
   ---------------------------------------------------------------------------
   https://mydailies.app/e/#<base64url(JSON)>, padding stripped. Everything is
   in the fragment, and a browser never sends the fragment to a server, so no
   server, ours included, ever sees the names. The fields:

     v   2
     q   the line's short id, a key of DailiesLines.lines, for one of the
         site's own lines; or
     t   the sender's own words, 1-200 characters, when they wrote their own.
         /e/ shows these as the sender's ("Amit wrote this for you"), never as
         a line of the app's, on a noindex page
     p   the page it was sealed on (a key of DailiesLines.sets), so Send one
         back and the More link lead back to the same kind of lines
     to  the friend's name, 0-40 characters (needed for a line with {name})
     f   the sender's name, 0-40 characters
     l   the language it was sealed in: en es pt fr de ja
     k   which background the card wears (an index into DailiesLines.bg)

   ---------------------------------------------------------------------------
   Rules this file keeps
   ---------------------------------------------------------------------------
   - Names go into the page with textContent, never innerHTML, on elements
     with dir="auto", so a Hebrew or Arabic name reads the right way round.
   - No event is named here. Measurement goes through
     window.dailiesAnalytics.play(), which lives in analytics.js with the rest
     of the site's events and never accepts a name.
   - Every sheet that shows a name carries `ph-no-capture`.
   - Nothing is stored. The Cookie Policy says the consent answer is the only
     thing this site keeps, and that stays true.
   ========================================================================= */
(function () {
  'use strict';

  var D = window.DailiesLines;
  if (!D) return;
  var LANGS = ['en', 'es', 'pt', 'fr', 'de', 'ja'];
  var MAX_NAME = 40;

  function bgUrl(k) { return '/img/wallpapers/bg/' + D.bg[k]; }

  /* -------------------------------------------------------------- strings */
  /* {to} and {from} are names. fill() splits the string around them and drops
     each name into its own dir="auto" span; they are never parsed as HTML. */

  var STRINGS = {
    en: {
      msgRead: '{to}, I thought of you when I read this.', msgReadNone: 'I thought of you when I read this.', msgOwn: '{to}, I wrote something for you.', msgOwnNone: 'I wrote something for you.', subject: 'I thought of you',
      message: 'Message', wrote: '{from} wrote this for you.', wroteNoName: 'Someone wrote this for you.',
      makeWall: 'Make it a wallpaper',
      close: 'Close',
      sealTitle: 'Seal it for someone',
      sealed: 'Sealed. Now send it.', share: 'Send',
      email: 'Email',
      bridgeSent: 'Want a line like this for yourself every morning? Dailies puts one on your Lock Screen.',
      eTitle: 'An envelope for you', forName: 'For {to}', forYou: 'For you',
      fromName: 'from {from}', openIt: 'Open it', openNote: 'No app needed.',
      picked: '{from} picked this line for you.', pickedNoName: 'Someone picked this line for you.',
      sendBack: 'Send one back to {from}', sendBackNoName: 'Send one back',
      readMore: 'More words of encouragement',
      bridgeTitle: 'A line like this, every morning',
      bridgeBody: 'Dailies puts a new one on your Lock Screen each day, chosen for what you care about.',
      badTitle: 'This envelope didn’t make it.',
      badBody: 'The link looks incomplete. Ask whoever sent it to send it again.',
      goHome: 'Go to mydailies.app',
      badgeAlt: 'Download on the App Store', privacy: 'Privacy', cookies: 'Cookie settings'
    },
    es: {
      msgRead: '{to}, pensé en ti cuando leí esto.', msgReadNone: 'Pensé en ti cuando leí esto.', msgOwn: '{to}, escribí algo para ti.', msgOwnNone: 'Escribí algo para ti.', subject: 'Pensé en ti',
      message: 'Mensaje', wrote: '{from} escribió esto para ti.', wroteNoName: 'Alguien escribió esto para ti.',
      makeWall: 'Hazla fondo de pantalla',
      close: 'Cerrar',
      sealTitle: 'Séllala para alguien',
      sealed: 'Está sellado. Ahora envíalo.', share: 'Enviar',
      email: 'Correo',
      bridgeSent: '¿Quieres una frase así para ti cada mañana? Dailies la pone en tu pantalla de bloqueo.',
      eTitle: 'Un sobre para ti', forName: 'Para {to}', forYou: 'Para ti',
      fromName: 'de {from}', openIt: 'Ábrelo', openNote: 'No necesitas la app.',
      picked: '{from} eligió esta frase para ti.', pickedNoName: 'Alguien eligió esta frase para ti.',
      sendBack: 'Mándale uno a {from}', sendBackNoName: 'Manda uno de vuelta',
      readMore: 'Más palabras de aliento',
      bridgeTitle: 'Una frase así, cada mañana',
      bridgeBody: 'Dailies pone una nueva en tu pantalla de bloqueo cada día, elegida según lo que te importa.',
      badTitle: 'Este sobre no llegó completo.',
      badBody: 'Al enlace le falta algo. Pídele a quien te lo mandó que lo envíe de nuevo.',
      goHome: 'Ir a mydailies.app',
      badgeAlt: 'Descárgalo en el App Store', privacy: 'Privacidad', cookies: 'Configuración de cookies'
    },
    pt: {
      msgRead: '{to}, pensei em você quando li isto.', msgReadNone: 'Pensei em você quando li isto.', msgOwn: '{to}, escrevi uma coisa para você.', msgOwnNone: 'Escrevi uma coisa para você.', subject: 'Pensei em você',
      message: 'Mensagem', wrote: '{from} escreveu isto para você.', wroteNoName: 'Alguém escreveu isto para você.',
      makeWall: 'Transformar em papel de parede',
      close: 'Fechar',
      sealTitle: 'Sele para alguém',
      sealed: 'Envelope selado. Agora é só enviar.', share: 'Enviar',
      email: 'E-mail',
      bridgeSent: 'Quer uma frase assim para você toda manhã? O Dailies coloca uma na sua Tela Bloqueada.',
      eTitle: 'Um envelope para você', forName: 'Para {to}', forYou: 'Para você',
      fromName: 'de {from}', openIt: 'Abrir', openNote: 'Não precisa de app.',
      picked: '{from} escolheu esta frase para você.', pickedNoName: 'Alguém escolheu esta frase para você.',
      sendBack: 'Mande um de volta para {from}', sendBackNoName: 'Mande um de volta',
      readMore: 'Mais palavras de incentivo',
      bridgeTitle: 'Uma frase assim, toda manhã',
      bridgeBody: 'O Dailies coloca uma nova na sua Tela Bloqueada todo dia, escolhida pelo que importa para você.',
      badTitle: 'Este envelope não chegou inteiro.',
      badBody: 'Falta alguma coisa no link. Peça para quem enviou mandar de novo.',
      goHome: 'Ir para mydailies.app',
      badgeAlt: 'Baixar na App Store', privacy: 'Privacidade', cookies: 'Configurações de cookies'
    },
    fr: {
      msgRead: '{to}, j’ai pensé à toi en lisant ceci.', msgReadNone: 'J’ai pensé à toi en lisant ceci.', msgOwn: '{to}, j’ai écrit quelque chose pour toi.', msgOwnNone: 'J’ai écrit quelque chose pour toi.', subject: 'J’ai pensé à toi',
      message: 'Message', wrote: '{from} a écrit ceci pour toi.', wroteNoName: 'Quelqu’un a écrit ceci pour toi.',
      makeWall: 'En faire un fond d’écran',
      close: 'Fermer',
      sealTitle: 'Scelle-la pour quelqu’un',
      sealed: 'C’est scellé. Il ne reste qu’à l’envoyer.', share: 'Envoyer',
      email: 'E-mail',
      bridgeSent: 'Envie d’une citation comme celle-ci chaque matin ? Dailies en met une sur ton écran verrouillé.',
      eTitle: 'Une enveloppe pour toi', forName: 'Pour {to}', forYou: 'Pour toi',
      fromName: 'de la part de {from}', openIt: 'L’ouvrir', openNote: 'Pas besoin d’app.',
      picked: '{from} a choisi cette citation pour toi.', pickedNoName: 'Quelqu’un a choisi cette citation pour toi.',
      sendBack: 'En renvoyer une à {from}', sendBackNoName: 'En renvoyer une',
      readMore: 'D’autres mots d’encouragement',
      bridgeTitle: 'Une citation comme celle-ci, chaque matin',
      bridgeBody: 'Dailies en met une nouvelle sur ton écran verrouillé chaque jour, choisie selon ce qui compte pour toi.',
      badTitle: 'Cette enveloppe n’est pas arrivée entière.',
      badBody: 'Il manque quelque chose au lien. Demande à la personne qui l’a envoyée de recommencer.',
      goHome: 'Aller sur mydailies.app',
      badgeAlt: 'Télécharger dans l’App Store', privacy: 'Confidentialité', cookies: 'Paramètres des cookies'
    },
    de: {
      msgRead: '{to}, ich musste an dich denken, als ich das gelesen habe.', msgReadNone: 'Ich musste an dich denken, als ich das gelesen habe.', msgOwn: '{to}, ich habe dir etwas geschrieben.', msgOwnNone: 'Ich habe dir etwas geschrieben.', subject: 'Ich habe an dich gedacht',
      message: 'Nachricht', wrote: '{from} hat das für dich geschrieben.', wroteNoName: 'Jemand hat das für dich geschrieben.',
      makeWall: 'Als Hintergrundbild',
      close: 'Schließen',
      sealTitle: 'Für jemanden versiegeln',
      sealed: 'Versiegelt. Jetzt nur noch verschicken.', share: 'Senden',
      email: 'E-Mail',
      bridgeSent: 'Lust auf so ein Zitat, jeden Morgen? Dailies zeigt es dir auf dem Sperrbildschirm.',
      eTitle: 'Ein Umschlag für dich', forName: 'Für {to}', forYou: 'Für dich',
      fromName: 'von {from}', openIt: 'Öffnen', openNote: 'Keine App nötig.',
      picked: '{from} hat dieses Zitat für dich ausgesucht.', pickedNoName: 'Jemand hat dieses Zitat für dich ausgesucht.',
      sendBack: '{from} einen zurückschicken', sendBackNoName: 'Einen zurückschicken',
      readMore: 'Mehr aufmunternde Worte',
      bridgeTitle: 'So ein Zitat, jeden Morgen',
      bridgeBody: 'Dailies zeigt dir jeden Tag ein neues auf dem Sperrbildschirm, ausgewählt nach dem, was dir wichtig ist.',
      badTitle: 'Dieser Umschlag ist nicht ganz angekommen.',
      badBody: 'Dem Link fehlt etwas. Bitte die Person, die ihn geschickt hat, ihn noch einmal zu senden.',
      goHome: 'Zu mydailies.app',
      badgeAlt: 'Laden im App Store', privacy: 'Datenschutz', cookies: 'Cookie-Einstellungen'
    },
    ja: {
      msgRead: '{to}さん、これを読んで、あなたのことを思い出しました。', msgReadNone: 'これを読んで、あなたのことを思い出しました。', msgOwn: '{to}さん、あなたに書いたものがあります。', msgOwnNone: 'あなたに書いたものがあります。', subject: 'あなたのことを思い出して',
      message: 'メッセージ', wrote: '{from}さんが、あなたのために書きました。', wroteNoName: '誰かが、あなたのために書きました。',
      makeWall: '壁紙にする',
      close: '閉じる',
      sealTitle: '誰かのために封をする',
      sealed: '封をしました。あとは送るだけです。', share: '送る',
      email: 'メール',
      bridgeSent: 'こんな言葉を毎朝、自分にも。Dailies がロック画面に届けます。',
      eTitle: '封筒が届いています', forName: '{to}さんへ', forYou: 'あなたへ',
      fromName: '{from}さんより', openIt: '開ける', openNote: 'アプリは要りません。',
      picked: '{from}さんがこの言葉を選びました。', pickedNoName: '誰かがこの言葉を選びました。',
      sendBack: '{from}さんに送り返す', sendBackNoName: '送り返す',
      readMore: 'ほかの励ましの言葉',
      bridgeTitle: 'こんな言葉を、毎朝',
      bridgeBody: 'Dailies は、大切にしていることに合わせて選んだ新しい言葉を、毎日ロック画面に届けます。',
      badTitle: 'この封筒はうまく届きませんでした。',
      badBody: 'リンクの一部が欠けています。送ってくれた人に、もう一度送ってもらってください。',
      goHome: 'mydailies.app へ',
      badgeAlt: 'App Store からダウンロード', privacy: 'プライバシーポリシー', cookies: 'Cookie 設定'
    }
  };
  var lang = pickLang(document.documentElement.getAttribute('lang'));
  function pickLang(tag) {
    var c = String(tag || '').slice(0, 2).toLowerCase();
    return LANGS.indexOf(c) === -1 ? 'en' : c;
  }
  function S() { return STRINGS[lang] || STRINGS.en; }

  /* --------------------------------------------------------------- lines */

  function line(q) { return D.lines[q] || null; }
  function isNamed(q) { var o = line(q); return !!(o && o.n); }

  /* The line in a language, with a name written into a {name} line. */
  function lineText(q, l, name) {
    var o = line(q);
    if (!o) return '';
    var t = o.t[l] || o.t.en;
    return o.n ? t.replace('{name}', name || '') : t;
  }
  function lineAuthor(q, l) {
    var o = line(q);
    return o && o.a ? (o.a[l] || o.a.en || '') : '';
  }

  /* ------------------------------------------------------------- helpers */

  function ev(name, props) {
    try {
      if (window.dailiesAnalytics && window.dailiesAnalytics.play) window.dailiesAnalytics.play(name, props || {});
    } catch (e) {}
  }

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function nameSpan(name) {
    var s = h('span', 'pl-name', name);
    s.setAttribute('dir', 'auto');
    return s;
  }

  function fill(el, str, names) {
    el.textContent = '';
    str.split(/(\{to\}|\{from\})/).forEach(function (p) {
      if (p === '{to}') el.appendChild(nameSpan(names.to || ''));
      else if (p === '{from}') el.appendChild(nameSpan(names.from || ''));
      else if (p) el.appendChild(document.createTextNode(p));
    });
    return el;
  }

  function fillText(str, names) {
    return str.replace('{to}', names.to || '').replace('{from}', names.from || '');
  }

  function ct(base) { return lang === 'en' ? base : base + '-' + lang; }

  function storeUrl(base) {
    return 'https://apps.apple.com/us/app/dailies-motivational-quotes/id6804210416?pt=129347926&ct=' +
      ct(base) + '&mt=8';
  }

  /* Apple's badge in the page's language, the same artwork and sizes the
     pages' own badges use. `where` becomes data-download, which analytics.js
     reports as download_clicked. */
  function badge(base, where) {
    var a = h('a', 'store-badge');
    a.href = storeUrl(base);
    a.setAttribute('data-download', where);
    var img = document.createElement('img');
    img.src = '/img/app-store-badge' + (lang === 'en' ? '' : '-' + lang) + '.svg';
    img.width = lang === 'fr' ? 164 : lang === 'ja' ? 142 : 156;
    img.height = 52;
    img.alt = S().badgeAlt;
    a.appendChild(img);
    return a;
  }

  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  /* -------------------------------------------------------------- the link */

  function toB64Url(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromB64Url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  function clean(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  var MAX_OWN = 200;

  function encode(env) {
    var o = { v: 2, to: env.to || '', f: env.f || '', l: env.l, k: env.k, p: env.p || 'encouragement' };
    if (env.t) o.t = clean(env.t, MAX_OWN); else o.q = env.q;
    return toB64Url(JSON.stringify(o));
  }

  /* Returns { env } or { reason }. Anything malformed is refused whole rather
     than half-shown, and a line the site does not have is refused too. */
  function decode(hash) {
    var raw = String(hash || '').replace(/^#/, '');
    if (!raw) return { reason: 'empty' };
    var o;
    try { o = JSON.parse(fromB64Url(raw)); } catch (e) { return { reason: 'decode' }; }
    if (!o || o.v !== 2) return { reason: 'field' };
    var own = typeof o.t === 'string' ? clean(o.t, MAX_OWN) : '';
    var q = typeof o.q === 'string' && line(o.q) ? o.q : '';
    if (!own && !q) return { reason: 'field' };
    var to = clean(o.to, MAX_NAME);
    if (q && isNamed(q) && !to) return { reason: 'field' };
    var k = (typeof o.k === 'number' && o.k >= 0 && o.k < D.bg.length) ? Math.floor(o.k) : 0;
    return {
      env: { q: own ? '' : q, t: own, to: to, f: clean(o.f, MAX_NAME), l: LANGS.indexOf(o.l) === -1 ? 'en' : o.l, k: k,
        p: typeof o.p === 'string' && D.sets[o.p] && D.sets[o.p].kind === 'enc' ? o.p : 'encouragement' }
    };
  }

  function linkFor(env) { return location.origin + '/e/#' + encode(env); }

  /* What goes with the link: a person's words, not the feature's name.
     "I thought of you when I read this" for a line, "I wrote something for
     you" for their own words, with the friend's name in front when there is
     one. The link goes on its own line so every app makes it tappable. */
  function message(env) {
    var s = S();
    var key = (env.t ? 'msgOwn' : 'msgRead') + (env.to ? '' : 'None');
    return fillText(s[key], { to: env.to });
  }

  /* The page an envelope came from, in a language, and what its link is
     called. */
  function moreLink(env, l) {
    var set = D.sets[env.p] || D.sets.encouragement;
    return { href: set.url[l] || set.url.en, label: set.more[l] || set.more.en };
  }

  /* What an envelope says: the sender's own words, or the line. */
  function envText(env, l) { return env.t || lineText(env.q, l, env.to); }
  function envAuthor(env, l) { return env.t ? '' : lineAuthor(env.q, l); }

  /* The wallpaper maker in a language, opened on an envelope's words. A
     {name} line takes the friend's name with it. */
  function wallLink(env, l) {
    var u = D.wallUrl[l] || D.wallUrl.en;
    var f = env.t ? 't=' + encodeURIComponent(env.t) : 'q=' + encodeURIComponent(env.q);
    f += '&k=' + env.k;
    if (!env.t && isNamed(env.q) && env.to) f += '&n=' + encodeURIComponent(env.to);
    return u + '#' + f;
  }

  /* The encouragement page, ready to answer: the names swapped round. */
  function replyLink(env, l) {
    var set = D.sets[env.p] || D.sets.encouragement;
    var u = set.url[l] || set.url.en;
    var f = [];
    if (env.f) f.push('to=' + encodeURIComponent(env.f));
    if (env.to) f.push('from=' + encodeURIComponent(env.to));
    return u + (f.length ? '#' + f.join('&') : '');
  }

  var ua = navigator.userAgent;
  var IOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var ANDROID = /Android/.test(ua);

  /* --------------------------------------------------------------- sheets */
  /* One sheet at a time, over a scrim. Escape, the close button or a tap on
     the scrim closes it, and focus goes back to the button that opened it. */

  var open = null;

  function sheet(titleText, cls) {
    closeSheet();
    var scrim = h('div', 'pl-scrim');
    var box = h('div', 'pl-sheet ph-no-capture' + (cls ? ' ' + cls : ''));
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    var head = h('div', 'pl-head');
    var title = h('h2', 'pl-title', titleText);
    title.id = 'pl-title-' + Date.now();
    box.setAttribute('aria-labelledby', title.id);
    var x = h('button', 'pl-x');
    x.type = 'button';
    x.setAttribute('aria-label', S().close);
    x.innerHTML = CLOSE;
    x.addEventListener('click', closeSheet);
    head.appendChild(title);
    head.appendChild(x);
    box.appendChild(head);
    var body = h('div', 'pl-body');
    box.appendChild(body);
    scrim.appendChild(box);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) closeSheet(); });
    document.body.appendChild(scrim);
    document.documentElement.classList.add('pl-locked');
    open = { scrim: scrim, box: box, body: body, title: title, back: document.activeElement };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(function () { scrim.classList.add('is-in'); });
    setTimeout(function () { x.focus(); }, 30);
    return open;
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.key !== 'Tab') return;
    var f = open.box.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function closeSheet() {
    if (!open) return;
    var o = open;
    open = null;
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('pl-locked');
    o.scrim.remove();
    if (o.back && o.back.focus) o.back.focus();
  }

  /* ----------------------------------------------------------- the card */
  /* The line on one of the app's backgrounds: the composer's preview, and
     the card a friend sees once the envelope is open. */

  function card(text, author, k) {
    var c = h('figure', 'pl-card');
    var img = document.createElement('img');
    img.src = bgUrl(k);
    img.alt = '';
    img.width = 1080;
    img.height = 1920;
    c.appendChild(img);
    var q = h('blockquote', 'pl-card-q');
    var p = h('p', null, text);
    p.setAttribute('dir', 'auto');
    q.appendChild(p);
    if (author) q.appendChild(h('cite', null, author));
    c.appendChild(q);
    sizeText(p, text.length);
    return c;
  }

  function sizeText(el, n) {
    el.classList.remove('is-long', 'is-longer');
    if (n > 150) el.classList.add('is-longer');
    else if (n > 80) el.classList.add('is-long');
  }

  /* After sealing: the ways to send it, then the one line about the app.
     `o` is an open sheet; with none, one is opened. The phone's own share
     sheet first where there is one, then Message (phones only), WhatsApp and
     email. */
  function sent(o, env, mode) {
    var s = S();
    if (!o) o = sheet(s.sealTitle, 'pl-compose');
    var url = linkFor(env);
    var msg = message(env);
    var body = msg + '\n' + url;
    o.title.textContent = s.sealed;
    o.body.textContent = '';
    var c = card(envText(env, lang), envAuthor(env, lang), env.k);
    c.classList.add('pl-card-small');
    o.body.appendChild(c);

    var row = h('div', 'pl-send');
    var first = true;
    function cls() { var c = first ? 'pl-primary' : 'pl-btn'; first = false; return c; }
    if (navigator.share) {
      var share = h('button', cls(), s.share);
      share.type = 'button';
      share.addEventListener('click', function () {
        navigator.share({ text: msg, url: url }).then(function () {
          ev('envelope_shared', { method: 'share', mode: mode });
        }).catch(function () {});
      });
      row.appendChild(share);
    }
    if (IOS || ANDROID) {
      var sms = h('a', cls(), s.message);
      // iOS reads the body after "&", Android after "?".
      sms.href = 'sms:' + (IOS ? '&' : '?') + 'body=' + encodeURIComponent(body);
      sms.addEventListener('click', function () { ev('envelope_shared', { method: 'message', mode: mode }); });
      row.appendChild(sms);
    }
    var wa = h('a', cls(), 'WhatsApp');
    wa.href = 'https://wa.me/?text=' + encodeURIComponent(body);
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.addEventListener('click', function () { ev('envelope_shared', { method: 'whatsapp', mode: mode }); });
    row.appendChild(wa);
    var mail = h('a', cls(), s.email);
    mail.href = 'mailto:?subject=' + encodeURIComponent(s.subject) + '&body=' + encodeURIComponent(msg + '\n\n' + url);
    mail.addEventListener('click', function () { ev('envelope_shared', { method: 'email', mode: mode }); });
    row.appendChild(mail);
    o.body.appendChild(row);

    var bridge = h('div', 'pl-bridge');
    bridge.appendChild(h('p', null, s.bridgeSent));
    bridge.appendChild(badge('web-envelope', 'envelope-sent'));
    o.body.appendChild(bridge);
  }

  /* ---------------------------------------------------------------- public */

  window.DailiesPlay = {
    lang: lang,
    strings: S,
    setLang: function (l) { lang = pickLang(l); },
    pickLang: pickLang,
    fill: fill, h: h, badge: badge, card: card, sizeText: sizeText, ev: ev, clean: clean,
    MAX_NAME: MAX_NAME,
    sheet: sheet, closeSheet: closeSheet,
    sent: sent, IOS: IOS, ANDROID: ANDROID, MAX_OWN: MAX_OWN,
    decode: decode, encode: encode, wallLink: wallLink, replyLink: replyLink,
    envText: envText, envAuthor: envAuthor, moreLink: moreLink,
    line: line, isNamed: isNamed, lineText: lineText, lineAuthor: lineAuthor, bgUrl: bgUrl,
    data: D
  };
})();
