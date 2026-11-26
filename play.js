/* ============================================================================
   Envelopes: the shared part, for /words-of-encouragement/ (every language),
   /motivational-wallpapers/ and /e/

   A visitor picks a line, types a friend's name (and, if they like, their
   own), and seals it. The friend gets a link to /e/, where an envelope with
   their name on it opens to the line. From there they can send one back,
   pass it on, make it a wallpaper, or read more lines like it, and every one
   of those ends on the App Store badge (campaign token web-envelope, with
   -es, -pt, -fr, -de, -ja, -it, -ko, -zh-hant), so App Store Connect shows what envelopes send.

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
  var LANGS = ['en', 'es', 'pt', 'fr', 'de', 'ja', 'it', 'ko', 'zh-hant'];
  var MAX_NAME = 40;

  function bgUrl(k) { return '/img/wallpapers/bg/' + D.bg[k]; }

  /* -------------------------------------------------------------- strings */
  /* {to} and {from} are names. fill() splits the string around them and drops
     each name into its own dir="auto" span; they are never parsed as HTML. */

  var STRINGS = {
    en: {
      getApp: 'Get Dailies',
      holdToSeal: 'Hold to seal', sealHint: 'Press and hold the wax to seal it.',
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
      getApp: 'Descarga Dailies',
      holdToSeal: 'Mantén presionado para sellar', sealHint: 'Mantén presionada la cera para sellarlo.',
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
      getApp: 'Baixe o Dailies',
      holdToSeal: 'Segure para selar', sealHint: 'Segure a cera para selar.',
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
      getApp: 'Télécharger Dailies',
      holdToSeal: 'Maintiens pour sceller', sealHint: 'Maintiens la cire pour sceller.',
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
      getApp: 'Dailies laden',
      holdToSeal: 'Zum Versiegeln gedrückt halten', sealHint: 'Halte das Wachs gedrückt, um zu versiegeln.',
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
      getApp: 'Dailies を入手',
      holdToSeal: '長押しで封をする', sealHint: '封蝋を長押しして封をしましょう。',
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
    },
    it: {
      getApp: 'Scarica Dailies',
      holdToSeal: 'Tieni premuto per sigillare', sealHint: 'Tieni premuta la ceralacca per sigillare.',
      msgRead: '{to}, ho pensato a te leggendo questa frase.', msgReadNone: 'Ho pensato a te leggendo questa frase.', msgOwn: '{to}, ho scritto una cosa per te.', msgOwnNone: 'Ho scritto una cosa per te.', subject: 'Ho pensato a te',
      message: 'Messaggio', wrote: '{from} ha scritto questo per te.', wroteNoName: 'Qualcuno ha scritto questo per te.',
      makeWall: 'Trasformala in uno sfondo',
      close: 'Chiudi',
      sealTitle: 'Sigillala per qualcuno',
      sealed: 'Sigillata. Ora inviala.', share: 'Invia',
      email: 'Email',
      bridgeSent: 'Vuoi una frase così per te ogni mattina? Dailies la mette sulla tua schermata di blocco.',
      eTitle: 'Una busta per te', forName: 'Per {to}', forYou: 'Per te',
      fromName: 'da {from}', openIt: 'Aprila', openNote: 'Non serve l\'app.',
      picked: '{from} ha scelto questa frase per te.', pickedNoName: 'Qualcuno ha scelto questa frase per te.',
      sendBack: 'Mandane una a {from}', sendBackNoName: 'Mandane una in risposta',
      readMore: 'Altre parole di incoraggiamento',
      bridgeTitle: 'Una frase così, ogni mattina',
      bridgeBody: 'Dailies ne mette una nuova sulla tua schermata di blocco ogni giorno, scelta in base a ciò che ti sta a cuore.',
      badTitle: 'Questa busta non è arrivata intera.',
      badBody: 'Al link manca qualcosa. Chiedi a chi te l\'ha mandato di inviarlo di nuovo.',
      goHome: 'Vai su mydailies.app',
      badgeAlt: 'Scarica su App Store', privacy: 'Privacy', cookies: 'Impostazioni cookie'
    },
    ko: {
      getApp: 'Dailies 받기',
      holdToSeal: '길게 눌러 봉하기', sealHint: '밀랍을 길게 눌러 봉하세요.',
      msgRead: '{to}님, 이 글을 읽다가 생각이 났어요.', msgReadNone: '이 글을 읽다가 당신 생각이 났어요.', msgOwn: '{to}님께 쓴 글이 있어요.', msgOwnNone: '당신에게 쓴 글이 있어요.', subject: '생각이 나서요',
      message: '메시지', wrote: '{from}님이 직접 쓴 글이에요.', wroteNoName: '누군가 직접 쓴 글이에요.',
      makeWall: '배경화면으로 만들기',
      close: '닫기',
      sealTitle: '누군가를 위해 봉하기',
      sealed: '봉했어요. 이제 보내세요.', share: '보내기',
      email: '이메일',
      bridgeSent: '이런 글귀를 매일 아침 나에게도 보내고 싶다면? Dailies가 잠금 화면에 보여 줘요.',
      eTitle: '봉투가 도착했어요', forName: '{to}님께', forYou: '당신에게',
      fromName: '보낸 사람: {from}님', openIt: '열기', openNote: '앱은 필요 없어요.',
      picked: '{from}님이 이 글귀를 골랐어요.', pickedNoName: '누군가 이 글귀를 골랐어요.',
      sendBack: '{from}님께 답장 보내기', sendBackNoName: '답장 보내기',
      readMore: '격려의 말 더 보기',
      bridgeTitle: '이런 글귀를 매일 아침',
      bridgeBody: 'Dailies는 소중히 여기는 것에 맞춰 고른 새로운 글귀를 매일 잠금 화면에 보여 줘요.',
      badTitle: '이 봉투가 제대로 도착하지 않았어요.',
      badBody: '링크 일부가 빠져 있어요. 보낸 사람에게 다시 보내 달라고 해 주세요.',
      goHome: 'mydailies.app으로 가기',
      badgeAlt: 'App Store에서 다운로드하기', privacy: '개인정보 처리방침', cookies: '쿠키 설정'
    },
    'zh-hant': {
      getApp: '下載 Dailies',
      holdToSeal: '按住封口', sealHint: '按住火漆封口。',
      msgRead: '{to}，讀到這句話時我想到了你。', msgReadNone: '讀到這句話時我想到了你。', msgOwn: '{to}，我寫了點東西給你。', msgOwnNone: '我寫了點東西給你。', subject: '我想到了你',
      message: '訊息', wrote: '這是{from}為你寫的。', wroteNoName: '這是有人為你寫的。',
      makeWall: '做成背景圖片',
      close: '關閉',
      sealTitle: '為某人封好',
      sealed: '封好了。現在寄出吧。', share: '寄出',
      email: '電子郵件',
      bridgeSent: '想每天早上也給自己一句這樣的話嗎？Dailies 會放在你的鎖定畫面上。',
      eTitle: '有一封給你的信', forName: '給{to}', forYou: '給你',
      fromName: '來自{from}', openIt: '打開', openNote: '不需要 App。',
      picked: '{from}為你選了這一句。', pickedNoName: '有人為你選了這一句。',
      sendBack: '回寄一封給{from}', sendBackNoName: '回寄一封',
      readMore: '更多鼓勵的話',
      bridgeTitle: '這樣的一句話，每天早上',
      bridgeBody: 'Dailies 會依照你在乎的事，每天在鎖定畫面放上新的一句。',
      badTitle: '這封信沒有完整送達。',
      badBody: '連結好像不完整。請寄給你的人再寄一次。',
      goHome: '前往 mydailies.app',
      badgeAlt: '在 App Store 下載', privacy: '隱私權政策', cookies: 'Cookie 設定'
    }
  };
  var lang = pickLang(document.documentElement.getAttribute('lang'));
  /* A language tag (zh-Hant-TW, it-IT, ko) to one of LANGS. Chinese is
     Traditional only when the tag says so (Hant, or Taiwan, Hong Kong or
     Macau): the site has no Simplified pages, so Simplified falls to English. */
  function pickLang(tag) {
    var t = String(tag || '').toLowerCase(), c = t.slice(0, 2);
    if (c === 'zh') return /hant|-tw|-hk|-mo/.test(t) ? 'zh-hant' : 'en';
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
    img.width = { fr: 164, ja: 142, ko: 169, 'zh-hant': 142 }[lang] || 156;
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

  function sheet(titleText, cls, onClose) {
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
    open = { scrim: scrim, box: box, body: body, title: title, back: document.activeElement, onClose: onClose };
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
    if (o.onClose) o.onClose();
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
     email. onClose, if given, runs when the sheet closes (the composer
     opens its envelope again). */
  function sent(o, env, mode, onClose) {
    var s = S();
    if (!o) o = sheet(s.sealTitle, 'pl-compose', onClose);
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
    // A plain button, as in the site's header, not the App Store badge:
    // the same App Store link and campaign token.
    var get = h('a', 'btn btn-primary pl-get', s.getApp);
    get.href = storeUrl('web-envelope');
    get.setAttribute('data-download', 'envelope-sent');
    bridge.appendChild(get);
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
