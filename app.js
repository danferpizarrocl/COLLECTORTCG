(function () {
'use strict';

/* ============ Configuración ============ */
var API = 'https://api.tcgdex.net/v2/';
var LANGS = [
  { c: 'en', n: 'Inglés', s: 'EN', base: true },
  { c: 'ja', n: 'Japonés', s: 'JP', base: true },
  { c: 'es', n: 'Español', s: 'ES' },
  { c: 'fr', n: 'Francés', s: 'FR' },
  { c: 'de', n: 'Alemán', s: 'DE' },
  { c: 'it', n: 'Italiano', s: 'IT' },
  { c: 'pt-br', n: 'Portugués (Brasil)', s: 'PT-BR' },
  { c: 'pt-pt', n: 'Portugués (Portugal)', s: 'PT-PT' },
  { c: 'ko', n: 'Coreano', s: 'KO' },
  { c: 'zh-tw', n: 'Chino tradicional', s: 'ZH-TW' },
  { c: 'zh-cn', n: 'Chino simplificado', s: 'ZH-CN' },
  { c: 'th', n: 'Tailandés', s: 'TH' },
  { c: 'id', n: 'Indonesio', s: 'ID' },
  { c: 'nl', n: 'Neerlandés', s: 'NL' },
  { c: 'pl', n: 'Polaco', s: 'PL' },
  { c: 'ru', n: 'Ruso', s: 'RU' }
];
var POKE = { Riolu: { en: 'Riolu', ja: 'リオル' }, Lucario: { en: 'Lucario', ja: 'ルカリオ' } };
var KEY = 'myctcg.estado.v1';

var ICON = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  save: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  card: '<rect x="6" y="3" width="12" height="18" rx="2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  img: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-9 7"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"/>'
};
function svg(name, size, sw) {
  return '<svg aria-hidden="true" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>';
}
function cardTitle(icon, text) {
  return '<div class="card-title">' + svg(icon, 18) + '<h2>' + esc(text) + '</h2></div>';
}

/* ============ Utilidades ============ */
function $(s, r) { return (r || document).querySelector(s); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function langOf(c) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i].c === c) return LANGS[i]; return { c: c, n: c, s: c.toUpperCase() }; }
function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ============ Estado guardado en el teléfono ============ */
function load() {
  try {
    var s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Array.isArray(s.cards)) return s;
  } catch (e) {}
  return { cards: [], pk: 'Riolu', filter: 'all', sort: 'added', setDates: {} };
}
var S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function findCard(id) { for (var i = 0; i < S.cards.length; i++) if (S.cards[i].uid === id) return S.cards[i]; return null; }

/* ============ Fotos propias (IndexedDB) ============ */
var dbp = null;
function db() {
  if (!dbp) dbp = new Promise(function (res, rej) {
    try {
      var r = indexedDB.open('myctcg', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('fotos'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    } catch (e) { rej(e); }
  });
  return dbp;
}
function tx(mode, fn) {
  return db().then(function (d) {
    return new Promise(function (res, rej) {
      var t = d.transaction('fotos', mode);
      var out = fn(t.objectStore('fotos'));
      t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
      t.onerror = function () { rej(t.error); };
    });
  });
}
function fotoPut(k, blob) { return tx('readwrite', function (s) { return s.put(blob, k); }); }
function fotoGet(k) { return tx('readonly', function (s) { return s.get(k); }); }
function fotoDel(k) { return tx('readwrite', function (s) { return s.delete(k); }); }
function fotoKeys() { return tx('readonly', function (s) { return s.getAllKeys(); }); }
function resizeImage(file) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      var max = 1100, w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { b ? res(b) : rej(new Error('No se pudo leer la foto')); }, 'image/jpeg', 0.86);
    };
    im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la foto')); };
    im.src = url;
  });
}
function blobToDataURL(b) {
  return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(b); });
}
function dataURLToBlob(u) {
  var p = u.split(','), mime = (p[0].match(/:(.*?);/) || [])[1] || 'image/jpeg', bin = atob(p[1]), a = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: mime });
}
var urlCache = {};
function fotoUrl(k) {
  if (urlCache[k]) return Promise.resolve(urlCache[k]);
  return fotoGet(k).then(function (b) {
    if (!b) return null;
    urlCache[k] = URL.createObjectURL(b);
    return urlCache[k];
  }).catch(function () { return null; });
}
function fotoClearUrl(k) { if (urlCache[k]) { URL.revokeObjectURL(urlCache[k]); delete urlCache[k]; } }

/* ============ TCGdex ============ */
function fetchJSON(url) {
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
  return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
    if (timer) clearTimeout(timer);
    if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }, function (err) {
    if (timer) clearTimeout(timer);
    var e = new Error(err && err.name === 'AbortError' ? 'Tardó demasiado' : 'Sin conexión con TCGdex');
    e.network = true;
    throw e;
  });
}
function apiSearch(lang, name) { return fetchJSON(API + lang + '/cards?name=' + encodeURIComponent(name)); }
function apiCard(lang, id) { return fetchJSON(API + lang + '/cards/' + encodeURIComponent(id)); }
function imgSrc(base, size) { return base ? base + '/' + (size || 'low') + '.webp' : null; }

/* ============ Fecha de lanzamiento (para ordenar) ============ */
function setIdOf(id) { var i = String(id).lastIndexOf('-'); return i > 0 ? String(id).slice(0, i) : null; }
var dateBusy = false;
function ensureDates() {
  S.setDates = S.setDates || {};
  if (dateBusy) return;
  var todo = [];
  S.cards.forEach(function (c) {
    if (c.date || c.dateMiss || !c.ids) return;
    var lang = c.ids.en ? 'en' : (c.ids.ja ? 'ja' : null);
    var sid = lang ? setIdOf(c.ids[lang]) : null;
    if (sid) todo.push({ c: c, lang: lang, sid: sid, key: lang + '|' + sid });
  });
  if (!todo.length) return;
  dateBusy = true;
  var i = 0, changed = false, offline = false;
  function apply(c, dt) { if (dt) c.date = dt; else c.dateMiss = true; changed = true; }
  function finish() {
    dateBusy = false;
    if (changed) { save(); if (view.name === 'home') render(); }
  }
  function next() {
    if (i >= todo.length || offline) return finish();
    var j = todo[i++], known = S.setDates[j.key];
    if (known !== undefined) { apply(j.c, known); return next(); }
    fetchJSON(API + j.lang + '/sets/' + encodeURIComponent(j.sid)).then(function (d) {
      var dt = d && d.releaseDate ? String(d.releaseDate).slice(0, 10) : '';
      S.setDates[j.key] = dt; apply(j.c, dt);
    }).catch(function (e) {
      if (e && e.network) offline = true;
      else { S.setDates[j.key] = ''; apply(j.c, ''); }
    }).then(next);
  }
  next();
}
function sortedCards(list) {
  var m = S.sort || 'added';
  if (m === 'added') return list;
  var dir = m === 'old' ? 1 : -1;
  return list.map(function (c, i) { return { c: c, i: i }; }).sort(function (a, b) {
    var da = a.c.date || '', db = b.c.date || '';
    if (!da && !db) return a.i - b.i;
    if (!da) return 1;
    if (!db) return -1;
    if (da === db) return a.i - b.i;
    return da < db ? -dir : dir;
  }).map(function (x) { return x.c; });
}

/* ============ Navegación ============ */
var view = { name: 'home' };
var SV = { pk: 'Riolu', lang: 'en', extra: '', q: 'Riolu', auto: true, results: null, status: '', err: false, shown: 0, link: null, busy: false };
var COV = { rows: null, busy: false, all: false };
var AV = { pk: 'Riolu', langs: { en: true, ja: true }, photos: {}, name: '', set: '', num: '', msg: '' };
var observer = null;

function go(name, params) {
  view = { name: name };
  if (params) for (var k in params) view[k] = params[k];
  render();
  window.scrollTo(0, 0);
  try { history.replaceState(null, '', '#' + name); } catch (e) {}
}

var rr = null;
function rerenderSoon() {
  if (rr) return;
  rr = setTimeout(function () { rr = null; render(); }, 250);
}

/* ============ Vistas ============ */
function visibleLangs(c) {
  var out = [];
  LANGS.forEach(function (l) {
    if (l.base || c.unlocked || (c.have && c.have[l.c]) || (c.photos && c.photos[l.c])) out.push(l.c);
  });
  return out;
}
function cardThumbSrc(c) {
  var order = ['en', 'ja'].concat(LANGS.map(function (l) { return l.c; }));
  for (var i = 0; i < order.length; i++) {
    if (c.photos && c.photos[order[i]]) return { photo: c.uid + '|' + order[i] };
    if (c.imgs && c.imgs[order[i]]) return { url: imgSrc(c.imgs[order[i]], 'low') };
  }
  return {};
}
function artHtml(src, alt) {
  if (src.url) return '<div class="art"><div class="ph">sin imagen</div><img loading="lazy" src="' + esc(src.url) + '" alt="' + esc(alt) + '" onerror="this.remove()"></div>';
  if (src.photo) return '<div class="art"><div class="ph">mi foto</div><img data-foto="' + esc(src.photo) + '" alt="' + esc(alt) + '"></div>';
  return '<div class="art"><div class="ph">sin imagen</div></div>';
}
function badgesHtml(c) {
  return LANGS.filter(function (l) {
    return l.base || (c.have && c.have[l.c]) || (c.photos && c.photos[l.c]);
  }).map(function (l) { return l.c; }).map(function (code) {
    var l = langOf(code), on = c.have && c.have[code];
    return '<span class="badge' + (on ? ' have' + (code === 'ja' ? ' ja' : (code === 'en' ? '' : ' x')) : '') + '">' + l.s + '</span>';
  }).join('');
}

function vHome() {
  var f = S.filter || 'all';
  var list = S.cards.filter(function (c) {
    if (f === 'all') return true;
    if (f === 'Otro') return c.pokemon !== 'Riolu' && c.pokemon !== 'Lucario';
    return c.pokemon === f;
  });
  var chips = [['all', 'Todos'], ['Riolu', 'Riolu'], ['Lucario', 'Lucario'], ['Otro', 'Otros']].map(function (x) {
    return '<button class="chip' + (f === x[0] ? ' on' : '') + '" data-act="filter" data-v="' + x[0] + '">' + x[1] + '</button>';
  }).join('');
  list = sortedCards(list);
  var sortBy = S.sort || 'added';
  var sorts = [['added', 'Como las agregué'], ['old', 'Más vieja → más nueva'], ['new', 'Más nueva → más vieja']].map(function (x) {
    return '<button class="chip' + (sortBy === x[0] ? ' on' : '') + '" data-act="sort" data-v="' + x[0] + '">' + x[1] + '</button>';
  }).join('');
  var body;
  if (!S.cards.length) {
    body = '<div class="card empty"><p>Aún no tienes cartas. Busca una en TCGdex o agrégala a mano con tu foto.</p>' +
      '<div class="row" style="justify-content:center"><button class="btn primary" data-act="nav" data-v="search">' + svg('search') + 'Buscar cartas</button>' +
      '<button class="btn" data-act="nav" data-v="add">' + svg('plus') + 'Agregar a mano</button></div></div>';
  } else if (!list.length) {
    body = '<div class="card empty"><p>No hay cartas en este filtro.</p></div>';
  } else {
    body = '<div class="grid">' + list.map(function (c) {
      return '<button class="tile" data-act="open" data-id="' + c.uid + '">' + artHtml(cardThumbSrc(c), c.name) +
        '<div class="tname">' + esc(c.name) + (c.number ? ' <span>' + esc(c.number) + '</span>' : '') + '</div>' +
        '<div class="badges">' + badgesHtml(c) + '</div>' +
        (sortBy !== 'added' && !c.date ? '<div class="muted" style="font-size:11px">sin fecha</div>' : '') + '</button>';
    }).join('') + '</div>';
  }
  return '<div class="top"><div><small>' + esc(APP_NAME) + '</small><h1>Mi colección</h1></div><span class="count">' + S.cards.length + (S.cards.length === 1 ? ' carta' : ' cartas') + '</span></div>' +
    '<div class="chips">' + chips + '</div>' +
    '<div class="muted" style="margin:0 0 6px">Ordenar</div><div class="chips">' + sorts + '</div>' + body;
}

function pkChips(sel, act) {
  return ['Riolu', 'Lucario', 'Otro'].map(function (p) {
    return '<button class="chip' + (sel === p ? ' on' : '') + '" data-act="' + act + '" data-v="' + p + '">' + p + '</button>';
  }).join('');
}

function vSearch() {
  var linkBanner = '';
  if (SV.link) {
    var lc = findCard(SV.link.uid);
    linkBanner = '<div class="banner">Vinculando <b>' + esc(langOf(SV.link.lang).n) + '</b> a <b>' + esc(lc ? lc.name : '') + '</b>. Elige la carta correcta de la lista.' +
      ' <button class="btn small" data-act="linkcancel" style="margin-left:8px">Cancelar</button></div>';
  }
  var langChips = '<button class="chip' + (SV.lang === 'en' ? ' on' : '') + '" data-act="slang" data-v="en">Inglés</button>' +
    '<button class="chip' + (SV.lang === 'ja' ? ' on' : '') + '" data-act="slang" data-v="ja">Japonés</button>' +
    '<select class="in" id="sextra" style="width:auto;min-width:160px" aria-label="Otro idioma"><option value="">Otro idioma…</option>' +
    LANGS.filter(function (l) { return !l.base; }).map(function (l) { return '<option value="' + l.c + '"' + (SV.extra === l.c && SV.lang === l.c ? ' selected' : '') + '>' + l.n + '</option>'; }).join('') + '</select>';
  var res = '';
  if (SV.busy) res = '<p class="status">Buscando…</p>';
  else if (SV.status) res = '<p class="status' + (SV.err ? ' err' : '') + '">' + esc(SV.status) + '</p>';
  if (SV.results && SV.results.length) {
    var part = SV.results.slice(0, SV.shown);
    res += '<div class="grid">' + part.map(function (r, i) {
      var exists = !SV.link && S.cards.some(function (c) { return c.ids && c.ids[SV.lang] === r.id; });
      return '<div class="tile">' + artHtml(r.image ? { url: imgSrc(r.image, 'low') } : {}, r.name) +
        '<div class="tname">' + esc(r.name) + '</div><div class="hint" style="word-break:break-all">' + esc(r.id) + '</div>' +
        (exists ? '<span class="badge have">Ya está</span>' : '<button class="btn small gold-line" data-act="pick" data-i="' + i + '">' + (SV.link ? 'Es esta' : 'Agregar') + '</button>') + '</div>';
    }).join('') + '</div>';
    if (SV.shown < SV.results.length) res += '<div class="sentinel" id="sentinel"></div>';
  }
  return '<div class="top"><div><small>TCGdex</small><h1>Buscar cartas</h1></div></div>' + linkBanner +
    '<div class="card">' + cardTitle('search', 'Buscar en TCGdex') +
    '<div class="chips">' + pkChips(SV.pk, 'spk') + '</div>' +
    '<div class="chips">' + langChips + '</div>' +
    '<label class="f" for="sq">Nombre de la carta</label>' +
    '<div class="row"><input class="in" id="sq" value="' + esc(SV.q) + '" style="flex:1;min-width:0" autocomplete="off">' +
    '<button class="btn primary" data-act="dosearch">Buscar</button></div>' +
    '<p class="note">Para el japonés escribe el nombre en japonés (ya viene puesto para Riolu y Lucario).</p></div>' + res;
}

var DL = {};
function frameHtml(c, code, single) {
  var l = langOf(code), has = c.have && c.have[code];
  var src = '';
  if (c.photos && c.photos[code]) src = { photo: c.uid + '|' + code };
  else if (c.imgs && c.imgs[code]) src = { url: imgSrc(c.imgs[code], 'high') };
  else src = {};
  var art = artHtml(src, c.name + ' ' + l.n);
  var msg = '';
  if (!(c.photos && c.photos[code]) && !(c.imgs && c.imgs[code])) {
    if (c.ids && c.ids[code]) msg = 'La carta existe en TCGdex pero no trae imagen. Puedes subir tu foto.';
    else if (c.miss && c.miss[code]) msg = 'No encontré esta carta en ' + l.n + ' con el mismo código. Búscala en ese idioma o sube tu foto.';
    else if (c.loading && c.loading[code]) msg = 'Buscando en TCGdex…';
    else msg = 'Todavía no tengo esta carta en ' + l.n + '. Búscala o sube tu foto.';
  }
  var acts = '<button class="btn small" data-act="upload" data-id="' + c.uid + '" data-lang="' + code + '">' + svg('img', 18) + (c.photos && c.photos[code] ? 'Cambiar mi foto' : 'Subir mi foto') + '</button>' +
    '<button class="btn small" data-act="linkstart" data-id="' + c.uid + '" data-lang="' + code + '">' + svg('search', 18) + 'Buscar en ' + esc(l.n) + '</button>' +
    (c.photos && c.photos[code] ? '<button class="btn small danger" data-act="rmfoto" data-id="' + c.uid + '" data-lang="' + code + '">Quitar foto</button>' : '');
  var toggle = single ? '' : '<button class="toggle' + (has ? ' on' : '') + '" data-act="have" data-id="' + c.uid + '" data-lang="' + code + '" aria-pressed="' + (has ? 'true' : 'false') + '"><span class="box">' + (has ? svg('check', 16, 3) : '') + '</span>La tengo</button>';
  return '<section' + (single ? ' id="bigframe"' : '') + ' class="frame' + (has ? ' has' : '') + '"><div class="frame-head"><b>' + esc(l.n) + '</b>' + toggle + '</div>' +
    '<div class="big">' + art + '</div>' +
    (msg ? '<p class="status">' + esc(msg) + '</p>' : '') +
    '<div class="row" style="justify-content:center">' + acts + '</div></section>';
}

function langListHtml(c, sel) {
  return '<div class="card">' + cardTitle('globe', 'Marca los idiomas que tienes') + '<div class="langlist">' +
    visibleLangs(c).map(function (code) {
      var l = langOf(code), has = c.have && c.have[code];
      var tags = ((c.photos && c.photos[code]) ? '<span class="tag">' + svg('img', 14) + 'mi foto</span>' : '') +
        ((c.imgs && c.imgs[code]) ? '<span class="tag">' + svg('card', 14) + 'imagen</span>' : '');
      return '<div class="lrow' + (sel === code ? ' sel' : '') + '">' +
        '<button class="lname" data-act="sel" data-id="' + c.uid + '" data-lang="' + code + '" aria-label="Ver la carta en ' + esc(l.n) + '"><b>' + esc(l.n) + '</b><span class="tags">' + tags + '</span></button>' +
        '<button class="toggle' + (has ? ' on' : '') + '" data-act="have" data-id="' + c.uid + '" data-lang="' + code + '" aria-pressed="' + (has ? 'true' : 'false') + '"><span class="box">' + (has ? svg('check', 16, 3) : '') + '</span>La tengo</button></div>';
    }).join('') + '</div></div>';
}

function vDetail() {
  var c = findCard(view.id);
  if (!c) return '<div class="card empty"><p>No encontré esa carta.</p><button class="btn" data-act="nav" data-v="home">Volver</button></div>';
  var m = c.meta || {};
  var head = '<div class="row" style="margin:8px 0 14px;flex-wrap:nowrap"><button class="back" data-act="nav" data-v="home" aria-label="Volver a mi colección">' + svg('back', 22) + '</button>' +
    '<div style="min-width:0"><small class="muted">' + esc(c.pokemon) + '</small><h1 style="margin:0;font-size:24px;letter-spacing:-.5px">' + esc(c.name) + '</h1></div></div>';
  var info = '<div class="card">' + cardTitle('card', 'Datos de la carta') + '<div class="meta">' +
    (m.logo ? '<img class="logo" src="' + esc(m.logo) + '" alt="Logo de la edición" onerror="this.remove()">' : '') +
    '<div><div class="sets">' + esc(c.setName || m.setName || 'Edición sin datos') + '</div>' +
    '<div class="muted">' + (c.number ? 'N.º ' + esc(c.number) : '') + (m.total ? ' / ' + esc(m.total) : '') + (m.rarity ? ' · ' + esc(m.rarity) : '') + '</div></div></div></div>';
  var frames;
  if (c.unlocked) {
    var sel = DL[c.uid];
    if (visibleLangs(c).indexOf(sel) < 0) sel = 'en';
    frames = frameHtml(c, sel, true) + langListHtml(c, sel);
  } else {
    frames = visibleLangs(c).map(function (code) { return frameHtml(c, code); }).join('');
  }
  var lockBtn = c.unlocked
    ? '<button class="btn block" data-act="lock" data-id="' + c.uid + '">' + svg('lock') + 'Volver a inglés y japonés</button>'
    : '<button class="btn block gold-line" data-act="unlock" data-id="' + c.uid + '">' + svg('unlock') + 'Desbloquear todos los idiomas</button>';
  return head + info + '<div class="card">' + cardTitle('globe', 'Idiomas de esta carta') +
    '<p class="note" style="margin:0 0 12px">Por defecto: inglés y japonés. Si coleccionas esta carta en todos los idiomas, desbloquéala.</p>' + lockBtn + '</div>' + frames +
    '<button class="btn danger block" data-act="delcard" data-id="' + c.uid + '">Quitar esta carta de mi colección</button>' +
    '<input type="file" id="filein" accept="image/*" hidden>';
}

function vAdd() {
  var langChips = LANGS.map(function (l) {
    return '<button class="chip' + (AV.langs[l.c] ? ' on' : '') + '" data-act="alang" data-v="' + l.c + '">' + l.s + '</button>';
  }).join('');
  var photoRows = LANGS.filter(function (l) { return AV.langs[l.c]; }).map(function (l) {
    return '<div class="row" style="margin-top:8px"><span style="min-width:120px;font-weight:700">' + l.n + '</span>' +
      '<button class="btn small" data-act="apick" data-lang="' + l.c + '">' + svg('img', 18) + (AV.photos[l.c] ? 'Cambiar foto' : 'Elegir foto') + '</button>' +
      (AV.photos[l.c] ? '<span class="ok">' + svg('check', 16, 3) + ' lista</span>' : '') + '</div>';
  }).join('');
  return '<div class="top"><div><small>A mano</small><h1>Agregar carta</h1></div></div>' +
    '<div class="card">' + cardTitle('plus', 'Carta que no está en la base') +
    '<div class="chips">' + pkChips(AV.pk, 'apk') + '</div>' +
    '<label class="f" for="an">Nombre de la carta</label><input class="in" id="an" value="' + esc(AV.name) + '" autocomplete="off">' +
    '<label class="f" for="as">Edición o promo</label><input class="in" id="as" value="' + esc(AV.set) + '" autocomplete="off" placeholder="Ej.: nombre de la edición">' +
    '<label class="f" for="anum">Número</label><input class="in" id="anum" value="' + esc(AV.num) + '" autocomplete="off" placeholder="Ej.: 013/198">' +
    '<label class="f">Idiomas en que la tengo</label><div class="chips">' + langChips + '</div>' +
    '<label class="f">Foto de la carta</label>' + (photoRows || '<p class="muted">Elige al menos un idioma.</p>') +
    (AV.msg ? '<p class="status err" style="margin-top:12px">' + esc(AV.msg) + '</p>' : '') +
    '<div style="margin-top:16px"><button class="btn primary block" data-act="asave">Guardar carta</button></div>' +
    '<p class="note">La foto se guarda en este teléfono (y va en el respaldo). Si me la mandas a mí, la dejo en el repositorio y no se pierde.</p></div>' +
    '<input type="file" id="filein" accept="image/*" hidden>';
}

function covCell(r) {
  if (!r) return '<td>—</td>';
  if (r.err) return '<td class="bad">' + esc(r.err) + '</td>';
  return '<td><span class="ok">' + r.n + '</span> cartas<br><span class="muted">' + r.img + ' con imagen</span></td>';
}
function vCov() {
  var langs = COV.all ? LANGS.map(function (l) { return l.c; }) : ['en', 'ja'];
  var table = '';
  if (COV.rows) {
    table = '<table class="tbl"><thead><tr><th>Idioma</th><th>Riolu</th><th>Lucario</th></tr></thead><tbody>' +
      langs.map(function (c) {
        var r = COV.rows[c] || {};
        return '<tr><td><b>' + esc(langOf(c).n) + '</b></td>' + covCell(r.Riolu) + covCell(r.Lucario) + '</tr>';
      }).join('') + '</tbody></table>';
  }
  return '<div class="top"><div><small>TCGdex</small><h1>Prueba de cobertura</h1></div></div>' +
    '<div class="card">' + cardTitle('chart', 'Qué tiene TCGdex de Riolu y Lucario') +
    '<p class="note" style="margin:0 0 12px">Cuenta cuántas cartas encuentra por idioma y cuántas traen imagen. Sirve para saber en qué idiomas conviene buscar y en cuáles subirás tu foto.</p>' +
    '<div class="chips"><button class="chip' + (COV.all ? ' on' : '') + '" data-act="covall">Probar todos los idiomas</button></div>' +
    '<button class="btn primary block" data-act="covrun"' + (COV.busy ? ' disabled' : '') + '>' + (COV.busy ? 'Probando…' : 'Probar ahora') + '</button>' +
    (table ? '<div style="margin-top:14px;overflow-x:auto">' + table + '</div>' : '') + '</div>';
}

function vBackup() {
  return '<div class="top"><div><small>Tu colección</small><h1>Respaldo</h1></div></div>' +
    '<div class="card">' + cardTitle('save', 'Guardar y recuperar') +
    '<p class="note" style="margin:0 0 12px">Todo lo tuyo (cartas, idiomas que tienes y tus fotos) está en este teléfono. Descarga un archivo de respaldo de vez en cuando.</p>' +
    '<div class="row"><button class="btn primary" data-act="export">' + svg('save', 18) + 'Descargar respaldo</button>' +
    '<button class="btn" data-act="import">Recuperar desde archivo</button></div>' +
    '<p class="status" id="bkmsg" style="margin-top:12px"></p>' +
    '<input type="file" id="bkin" accept="application/json,.json" hidden></div>' +
    '<div class="card">' + cardTitle('layers', 'Acerca de') + '<p class="note" style="margin:0">' + esc(APP_NAME) + ' · versión ' + esc(APP_VERSION) + '<br>Las cartas e imágenes vienen de TCGdex.</p></div>';
}

function nav() {
  var items = [['home', 'Colección', 'home'], ['search', 'Buscar', 'search'], ['add', 'Agregar', 'plus'], ['cov', 'Cobertura', 'chart'], ['backup', 'Respaldo', 'save']];
  var cur = view.name === 'detail' ? 'home' : view.name;
  return '<nav class="tabs" aria-label="Navegación"><div class="in-nav">' + items.map(function (i) {
    return '<button class="' + (cur === i[0] ? 'on' : '') + '" data-act="nav" data-v="' + i[0] + '">' + svg(i[2], 22) + i[1] + '</button>';
  }).join('') + '</div></nav>';
}

function render() {
  var html;
  switch (view.name) {
    case 'search': html = vSearch(); break;
    case 'detail': html = vDetail(); break;
    case 'add': html = vAdd(); break;
    case 'cov': html = vCov(); break;
    case 'backup': html = vBackup(); break;
    default: html = vHome();
  }
  $('#app').innerHTML = html + nav();
  fillPhotos();
  setupSentinel();
  if (view.name === 'detail') resolveDetail();
}

function fillPhotos() {
  var els = document.querySelectorAll('img[data-foto]');
  Array.prototype.forEach.call(els, function (im) {
    fotoUrl(im.getAttribute('data-foto')).then(function (u) { if (u) im.src = u; });
  });
}
function setupSentinel() {
  if (observer) { observer.disconnect(); observer = null; }
  var s = $('#sentinel');
  if (!s || typeof IntersectionObserver === 'undefined') return;
  observer = new IntersectionObserver(function (es) {
    if (es[0].isIntersecting && SV.results && SV.shown < SV.results.length) {
      SV.shown = Math.min(SV.results.length, SV.shown + 24);
      render();
    }
  }, { rootMargin: '600px' });
  observer.observe(s);
}

/* ============ Detalle: buscar la carta en los demás idiomas ============ */
var resolving = {};
function resolveDetail() {
  var c = findCard(view.id);
  if (!c) return;
  /* datos de la edición (logo, nombre, rareza) */
  if (!c.meta && !resolving[c.uid + '|meta']) {
    var lang0 = c.ids && c.ids.en ? 'en' : (c.ids && c.ids.ja ? 'ja' : null);
    if (lang0) {
      resolving[c.uid + '|meta'] = true;
      apiCard(lang0, c.ids[lang0]).then(function (d) {
        c.meta = {
          setName: d.set && d.set.name, logo: d.set && d.set.logo ? d.set.logo + '.png' : null,
          rarity: d.rarity, total: d.set && d.set.cardCount && (d.set.cardCount.official || d.set.cardCount.total)
        };
        if (!c.setName && c.meta.setName) c.setName = c.meta.setName;
        if (!c.number && d.localId) c.number = String(d.localId);
        if (d.image && !c.imgs[lang0]) c.imgs[lang0] = d.image;
        save(); rerenderIfDetail(c.uid);
      }).catch(function () { c.meta = {}; save(); }).then(function () { delete resolving[c.uid + '|meta']; });
    }
  }
  /* imágenes en los demás idiomas: se prueba con el mismo código que en inglés */
  if (c.unlocked && c.ids && c.ids.en) {
    LANGS.forEach(function (l) {
      if (l.base) return;
      var k = c.uid + '|' + l.c;
      if ((c.ids && c.ids[l.c]) || (c.miss && c.miss[l.c]) || resolving[k]) return;
      resolving[k] = true;
      c.loading = c.loading || {}; c.loading[l.c] = true;
      apiCard(l.c, c.ids.en).then(function (d) {
        c.ids[l.c] = d.id || c.ids.en;
        if (d.image) c.imgs[l.c] = d.image;
      }).catch(function (e) {
        if (e && e.status === 404) { c.miss = c.miss || {}; c.miss[l.c] = true; }
        else if (e && e.status && e.status >= 400) { c.miss = c.miss || {}; c.miss[l.c] = true; }
      }).then(function () {
        delete resolving[k]; if (c.loading) delete c.loading[l.c];
        save(); rerenderIfDetail(c.uid);
      });
    });
  }
}
function rerenderIfDetail(id) { if (view.name === 'detail' && view.id === id) rerenderSoon(); }

/* ============ Acciones ============ */
var pendingUpload = null;

function addFromResult(r) {
  var lang = SV.lang;
  if (SV.link) {
    var lc = findCard(SV.link.uid);
    if (lc) {
      lc.ids = lc.ids || {}; lc.imgs = lc.imgs || {};
      lc.ids[SV.link.lang] = r.id;
      if (r.image) lc.imgs[SV.link.lang] = r.image;
      if (lc.miss) delete lc.miss[SV.link.lang];
      save(); ensureDates();
      var back = lc.uid; SV.link = null;
      go('detail', { id: back });
    }
    return;
  }
  var card = {
    uid: uid(), pokemon: SV.pk, name: r.name, number: String(r.localId || ''), setName: '',
    ids: {}, imgs: {}, have: {}, photos: {}, unlocked: false, manual: false
  };
  card.ids[lang] = r.id;
  if (r.image) card.imgs[lang] = r.image;
  S.cards.unshift(card);
  save(); ensureDates();
  render();
}

function doSearch() {
  var q = ($('#sq') && $('#sq').value || '').trim();
  SV.q = q; SV.auto = false;
  if (!q) { SV.status = 'Escribe un nombre.'; SV.err = true; SV.results = null; render(); return; }
  SV.busy = true; SV.status = ''; SV.results = null; render();
  apiSearch(SV.lang, q).then(function (list) {
    SV.busy = false; SV.err = false;
    list = Array.isArray(list) ? list : [];
    SV.results = list; SV.shown = Math.min(24, list.length);
    var withImg = list.filter(function (x) { return x.image; }).length;
    SV.status = list.length ? (list.length + ' cartas encontradas (' + withImg + ' con imagen).') : 'No encontré cartas con ese nombre en ' + langOf(SV.lang).n + '.';
    render();
  }).catch(function (e) {
    SV.busy = false; SV.err = true; SV.results = null;
    SV.status = e.network ? 'No pude conectar con TCGdex. Revisa tu internet e inténtalo de nuevo.' : ('TCGdex respondió con un error (' + e.message + ').');
    render();
  });
}

function autoName() {
  if (!SV.auto) return;
  var p = POKE[SV.pk];
  if (p) SV.q = SV.lang === 'ja' ? p.ja : p.en;
}

function runCoverage() {
  COV.busy = true; COV.rows = {}; render();
  var langs = COV.all ? LANGS.map(function (l) { return l.c; }) : ['en', 'ja'];
  var jobs = [];
  langs.forEach(function (l) { ['Riolu', 'Lucario'].forEach(function (p) { jobs.push({ l: l, p: p }); }); });
  var i = 0;
  function next() {
    if (i >= jobs.length) { COV.busy = false; render(); return Promise.resolve(); }
    var j = jobs[i++];
    var name = j.l === 'ja' ? POKE[j.p].ja : POKE[j.p].en;
    return apiSearch(j.l, name).then(function (list) {
      list = Array.isArray(list) ? list : [];
      COV.rows[j.l] = COV.rows[j.l] || {};
      COV.rows[j.l][j.p] = { n: list.length, img: list.filter(function (x) { return x.image; }).length };
    }).catch(function (e) {
      COV.rows[j.l] = COV.rows[j.l] || {};
      COV.rows[j.l][j.p] = { err: e.network ? 'Sin conexión' : (e.status === 404 ? 'No disponible' : e.message) };
    }).then(function () { if (view.name === 'cov') render(); return next(); });
  }
  next();
}

function saveManual() {
  var name = ($('#an').value || '').trim();
  AV.name = name; AV.set = ($('#as').value || '').trim(); AV.num = ($('#anum').value || '').trim();
  var langs = LANGS.filter(function (l) { return AV.langs[l.c]; }).map(function (l) { return l.c; });
  if (!name) { AV.msg = 'Falta el nombre de la carta.'; render(); return; }
  if (!langs.length) { AV.msg = 'Elige al menos un idioma.'; render(); return; }
  var c = { uid: uid(), pokemon: AV.pk, name: name, number: AV.num, setName: AV.set, ids: {}, imgs: {}, have: {}, photos: {}, unlocked: false, manual: true };
  var jobs = langs.map(function (l) {
    c.have[l] = true;
    if (AV.photos[l]) { c.photos[l] = true; return fotoPut(c.uid + '|' + l, AV.photos[l]); }
    return Promise.resolve();
  });
  Promise.all(jobs).then(function () {
    var extras = langs.some(function (l) { return !langOf(l).base; });
    if (extras) c.unlocked = true;
    S.cards.unshift(c); save();
    AV = { pk: AV.pk, langs: { en: true, ja: true }, photos: {}, name: '', set: '', num: '', msg: '' };
    go('detail', { id: c.uid });
  }).catch(function () { AV.msg = 'No pude guardar las fotos en el teléfono.'; render(); });
}

function exportBackup() {
  var msg = $('#bkmsg'); msg.textContent = 'Preparando respaldo…';
  fotoKeys().then(function (keys) {
    keys = keys || [];
    var out = { app: APP_NAME, version: APP_VERSION, fecha: new Date().toISOString(), estado: S, fotos: {} };
    return Promise.all(keys.map(function (k) {
      return fotoGet(k).then(function (b) { return b ? blobToDataURL(b).then(function (u) { out.fotos[k] = u; }) : null; });
    })).then(function () { return out; });
  }).then(function (out) {
    var blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'myctcg-respaldo-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    msg.textContent = 'Respaldo descargado.';
  }).catch(function () { msg.textContent = 'No pude armar el respaldo.'; msg.className = 'status err'; });
}
function importBackup(file) {
  var msg = $('#bkmsg'); msg.textContent = 'Leyendo archivo…';
  var r = new FileReader();
  r.onload = function () {
    try {
      var d = JSON.parse(r.result);
      if (!d || !d.estado || !Array.isArray(d.estado.cards)) throw new Error('x');
      if (!confirm('Esto reemplaza la colección de este teléfono por la del archivo. ¿Seguir?')) { msg.textContent = ''; return; }
      var keys = Object.keys(d.fotos || {});
      Promise.all(keys.map(function (k) { return fotoPut(k, dataURLToBlob(d.fotos[k])); })).then(function () {
        S = d.estado; urlCache = {}; save(); ensureDates(); msg.textContent = 'Colección recuperada.'; setTimeout(function () { go('home'); }, 600);
      });
    } catch (e) { msg.textContent = 'Ese archivo no es un respaldo de ' + APP_NAME + '.'; msg.className = 'status err'; }
  };
  r.readAsText(file);
}

/* ============ Eventos ============ */
document.addEventListener('click', function (ev) {
  var t = ev.target.closest('[data-act]');
  if (!t) return;
  var act = t.getAttribute('data-act'), v = t.getAttribute('data-v'), id = t.getAttribute('data-id'), lang = t.getAttribute('data-lang');
  var c = id ? findCard(id) : null;
  switch (act) {
    case 'nav': go(v); break;
    case 'filter': S.filter = v; save(); render(); break;
    case 'open': go('detail', { id: id }); break;
    case 'spk': SV.pk = v; autoName(); render(); break;
    case 'slang': SV.lang = v; SV.extra = ''; autoName(); render(); break;
    case 'dosearch': doSearch(); break;
    case 'pick': addFromResult(SV.results[+t.getAttribute('data-i')]); break;
    case 'linkstart':
      SV.link = { uid: id, lang: lang }; SV.lang = lang; SV.pk = c ? (c.pokemon === 'Riolu' || c.pokemon === 'Lucario' ? c.pokemon : 'Otro') : 'Riolu';
      SV.auto = true; SV.q = ''; autoName(); if (!SV.q && c) SV.q = c.name; SV.results = null; SV.status = '';
      go('search'); break;
    case 'linkcancel': var back = SV.link && SV.link.uid; SV.link = null; back ? go('detail', { id: back }) : go('search'); break;
    case 'sel':
      if (c) { DL[c.uid] = lang; render(); var bf = $('#bigframe'); if (bf && bf.scrollIntoView) bf.scrollIntoView({ block: 'start' }); } break;
    case 'sort': S.sort = v; save(); render(); break;
    case 'have': if (c) { c.have = c.have || {}; c.have[lang] = !c.have[lang]; save(); render(); } break;
    case 'unlock': if (c) { c.unlocked = true; if (c.miss) c.miss = {}; save(); render(); } break;
    case 'lock': if (c) { c.unlocked = false; save(); render(); } break;
    case 'delcard':
      if (c && confirm('¿Quitar esta carta de tu colección? Sus fotos propias también se borran.')) {
        Object.keys(c.photos || {}).forEach(function (l) { fotoClearUrl(c.uid + '|' + l); fotoDel(c.uid + '|' + l); });
        S.cards = S.cards.filter(function (x) { return x.uid !== c.uid; }); save(); go('home');
      } break;
    case 'upload': pendingUpload = { mode: 'card', uid: id, lang: lang }; $('#filein').click(); break;
    case 'rmfoto':
      if (c) { fotoClearUrl(c.uid + '|' + lang); fotoDel(c.uid + '|' + lang); delete c.photos[lang]; save(); render(); } break;
    case 'apk': AV.pk = v; render(); break;
    case 'alang': AV.langs[v] = !AV.langs[v]; syncAdd(); render(); break;
    case 'apick': syncAdd(); pendingUpload = { mode: 'add', lang: lang }; $('#filein').click(); break;
    case 'asave': saveManual(); break;
    case 'covall': COV.all = !COV.all; render(); break;
    case 'covrun': runCoverage(); break;
    case 'export': exportBackup(); break;
    case 'import': $('#bkin').click(); break;
  }
});
function syncAdd() {
  if (view.name !== 'add') return;
  var n = $('#an'), s = $('#as'), m = $('#anum');
  if (n) AV.name = n.value; if (s) AV.set = s.value; if (m) AV.num = m.value;
}
document.addEventListener('change', function (ev) {
  var t = ev.target;
  if (t.id === 'sextra') {
    if (t.value) { SV.lang = t.value; SV.extra = t.value; autoName(); render(); }
  } else if (t.id === 'filein' && t.files && t.files[0] && pendingUpload) {
    var p = pendingUpload; pendingUpload = null;
    resizeImage(t.files[0]).then(function (blob) {
      if (p.mode === 'card') {
        var c = findCard(p.uid); if (!c) return;
        var k = c.uid + '|' + p.lang;
        return fotoPut(k, blob).then(function () { fotoClearUrl(k); c.photos = c.photos || {}; c.photos[p.lang] = true; save(); render(); });
      }
      AV.photos[p.lang] = blob; render();
    }).catch(function (e) { alert(e.message || 'No pude guardar la foto'); });
  } else if (t.id === 'bkin' && t.files && t.files[0]) {
    importBackup(t.files[0]);
  }
});
document.addEventListener('input', function (ev) {
  if (ev.target.id === 'sq') { SV.q = ev.target.value; SV.auto = false; }
});
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Enter' && ev.target.id === 'sq') doSearch();
});

/* ============ Inicio ============ */
function start() {
  document.title = APP_NAME;
  $('#splash-name').textContent = APP_NAME;
  $('#splash-version').textContent = 'Versión ' + APP_VERSION;
  var h = (location.hash || '').replace('#', '');
  if (['home', 'search', 'add', 'cov', 'backup'].indexOf(h) >= 0) view = { name: h };
  render();
  ensureDates();
  setTimeout(function () { $('#splash').classList.add('hide'); }, 1100);
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      var reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (reloaded) return; reloaded = true;
        if (navigator.serviceWorker.controller) location.reload();
      });
      if (reg.update) reg.update();
    }).catch(function () {});
  }
}
autoName();
start();
window.__myctcg = { S: function () { return S; }, go: go, render: render };
})();
