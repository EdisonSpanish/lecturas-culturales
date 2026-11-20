/* Lecturas culturales — plantilla de lectura (vanilla JS, sin dependencias).
   Uso: /<carpeta>/  (página estática) o index.html?l=<carpeta>  →  lecturas/<carpeta>/<carpeta>.json
   Sin parámetro en la raíz: muestra el catálogo de lecturas/indice.json.
   Si el catálogo o la lectura ya vienen en el HTML, no se vuelve a pintar el texto. */
(function () {
  'use strict';

  var main = document.getElementById('contenido');
  var pop = document.getElementById('glosa-pop');
  var anuncio = document.getElementById('anuncio');

  /* ---------- utilidades ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function decir(t) { anuncio.textContent = ''; setTimeout(function () { anuncio.textContent = t; }, 30); }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return r.json();
    });
  }
  // normaliza: minúsculas, sin puntuación, espacios simples
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[¡!¿?.,;:«»"“”'’()]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function sinTildes(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // barajado determinista (mismo orden en cada carga, para pruebas reproducibles)
  function semilla(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function barajar(arr, clave) {
    var a = arr.slice(), s = semilla(clave) || 1;
    function rnd() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function imagen(base, img, cls) {
    var pic = el('picture');
    if (img.webp) pic.appendChild(el('source', { srcset: base + img.webp, type: 'image/webp' }));
    pic.appendChild(el('img', { src: base + img.archivo, alt: img.alt || '', width: img.ancho, height: img.alto, loading: cls === 'portada' ? 'eager' : 'lazy', decoding: 'async' }));
    return pic;
  }

  /* ---------- arranque ---------- */
  function esPaginaLectura() {
    return /\/(lectura[a-z0-9_-]+)\/?(?:index\.html)?$/i.test(location.pathname);
  }
  function lecturaId() {
    var q = new URLSearchParams(location.search).get('l');
    if (q) return q;
    var attr = main && main.getAttribute('data-lectura');
    if (attr) return attr;
    var m = location.pathname.match(/\/(lectura[a-z0-9_-]+)\/?(?:index\.html)?$/i);
    return m ? m[1] : null;
  }
  var param = lecturaId();
  var raiz = esPaginaLectura() ? '../' : '';
  if (!param) return catalogo();
  if (!/^[a-z0-9_-]{1,60}$/i.test(param)) return error('El nombre de la lectura no es válido.');
  var base = raiz + 'lecturas/' + param + '/';
  var estatica = !!(main && main.getAttribute('data-lectura') === param);
  getJSON(base + param + '.json').then(function (L) {
    var ej = Array.isArray(L.ejercicios) ? Promise.resolve({ ejercicios: L.ejercicios })
      : L.ejercicios_archivo ? getJSON(base + L.ejercicios_archivo).catch(function () { return null; })
      : Promise.resolve(null);
    return ej.then(function (E) { (estatica ? mejorar : render)(L, E); });
  }).catch(function (e) { error('No encontramos esta lectura (' + param + ').'); });

  function error(msg) {
    main.innerHTML = '';
    main.appendChild(el('div', { class: 'bloque' }, [el('h1', { text: 'Ups' }), el('p', { text: msg }), el('p', {}, [el('a', { href: raiz || './', text: 'Ver todas las lecturas' })])]));
  }

  // Catálogo: lecturas/indice.json agrupado por nivel (portada, título, nivel, país). Enlaces: <carpeta>/
  function catalogo() {
    // Si el HTML ya trae el catálogo (generado por _build_seo), no lo volvemos a pintar.
    if (main.querySelector('.catalogo li')) return;
    var NIVELES = { A1: 'Acceso', A2: 'Plataforma', B1: 'Umbral', B2: 'Avanzado', C1: 'Dominio', C2: 'Maestría' };
    getJSON(raiz + 'lecturas/indice.json').then(function (I) {
      var serie = I.serie || 'Lecturas culturales';
      document.title = serie + ' · Edison Spanish';
      main.innerHTML = '';
      var grupos = {}, orden = [];
      (I.lecturas || []).forEach(function (x) {
        var n = x.nivel || 'Otros';
        if (!grupos[n]) { grupos[n] = []; orden.push(n); }
        grupos[n].push(x);
      });
      var claves = Object.keys(NIVELES);
      orden.sort(function (a, b) { var i = claves.indexOf(a), j = claves.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
      var cab = el('section', { class: 'bloque catalogo-cab' }, [
        el('h1', { text: serie }),
        el('p', { class: 'entradilla', text: 'Historias cortas sobre costumbres del mundo hispano. Elige tu nivel y una lectura.' }),
        el('nav', { class: 'niveles-nav', 'aria-label': 'Niveles' }, [el('ul', {}, orden.map(function (n) {
          return el('li', {}, [el('a', { href: '#nivel-' + n, class: 'nivel-salto' }, [el('b', { text: n }), ' ' + (NIVELES[n] || '') + ' · ' + grupos[n].length])]);
        }))])
      ]);
      main.appendChild(cab);
      orden.forEach(function (n) {
        var ul = el('ul', { class: 'catalogo' });
        grupos[n].forEach(function (x) {
          var dir = 'lecturas/' + x.carpeta + '/';
          var pic = null;
          if (x.miniatura) {
            var webp = /\.webp$/i.test(x.miniatura);
            pic = el('picture', {}, [
              webp && x.respaldo ? el('source', { srcset: dir + x.miniatura, type: 'image/webp' }) : null,
              el('img', { src: dir + (webp && x.respaldo ? x.respaldo : x.miniatura), alt: x.titulo || '', loading: 'lazy', decoding: 'async', width: 1152, height: 768 })
            ]);
          }
          ul.appendChild(el('li', { 'data-carpeta': x.carpeta }, [el('a', { href: x.carpeta + '/' }, [
            pic,
            el('div', { class: 'info' }, [
              el('p', { class: 'meta' }, [el('span', { class: 'nivel', text: x.nivel }), x.pais ? el('span', { class: 'pais', text: x.pais }) : null]),
              el('strong', { text: x.titulo }),
              x.etiqueta ? el('span', { class: 'tema', text: x.etiqueta }) : null
            ])
          ])]));
        });
        main.appendChild(el('section', { class: 'bloque nivel-grupo', id: 'nivel-' + n, 'aria-labelledby': 'hn-' + n }, [
          el('h2', { id: 'hn-' + n }, [el('span', { class: 'nivel-insignia', text: n }), ' ' + (NIVELES[n] || n)]), ul]));
      });
    }).catch(function () { error('No se pudo cargar la lista de lecturas.'); });
  }

  /* ---------- página de lectura ---------- */
  function render(L, E) {
    document.title = L.titulo + ' · ' + (L.nivel || '') + ' · Lecturas culturales · Edison Spanish';
    main.innerHTML = '';
    var imgs = L.imagenes || [];
    var portada = imgs.filter(function (i) { return i.tipo === 'portada'; })[0];

    if (portada) main.appendChild(el('section', { class: 'portada' }, [el('figure', {}, [imagen(base, portada, 'portada')])]));
    main.appendChild(el('header', { class: 'cabecera' }, [el('div', { class: 'cabecera-caja' }, [
      el('ul', { class: 'etiquetas', 'aria-label': 'Nivel y tema' }, [
        el('li', { class: 'nivel', title: 'Nivel del MCER', text: L.nivel }),
        L.etiqueta ? el('li', { class: 'tema', text: L.etiqueta }) : null]),
      el('h1', { text: L.titulo }),
      L.entradilla ? el('p', { class: 'entradilla', text: L.entradilla }) : null
    ])]));

    main.appendChild(bloqueAudio(L));
    main.appendChild(bloqueTexto(L, imgs));
    if (hayGrafico(L.grafico)) main.appendChild(bloqueGrafico(L.grafico));
    if (L.glosario && L.glosario.length) main.appendChild(bloqueGlosario(L.glosario));
    if (E && E.ejercicios && E.ejercicios.length) main.appendChild(bloqueEjercicios(L, E.ejercicios, E.mas_practica_titulo));
  }

  // Página estática: se conserva portada y cabecera ya presentes en el HTML;
  // el reproductor, las glosas, el gráfico, el glosario y los ejercicios se añaden aquí.
  function mejorar(L, E) {
    document.title = L.titulo + ' · ' + (L.nivel || '') + ' · Lecturas culturales · Edison Spanish';
    var imgs = L.imagenes || [];
    var keep = [main.querySelector('.portada'), main.querySelector('.cabecera')].filter(Boolean);
    main.innerHTML = '';
    keep.forEach(function (n) { main.appendChild(n); });
    main.appendChild(bloqueAudio(L));
    main.appendChild(bloqueTexto(L, imgs));
    if (hayGrafico(L.grafico)) main.appendChild(bloqueGrafico(L.grafico));
    if (L.glosario && L.glosario.length) main.appendChild(bloqueGlosario(L.glosario));
    if (E && E.ejercicios && E.ejercicios.length) main.appendChild(bloqueEjercicios(L, E.ejercicios, E.mas_practica_titulo));
  }

  // Corta en frases solo fuera de las comillas «…» y antes de mayúscula (o ¿ ¡ «).
  function frases(t) {
    var out = [], ini = 0, dentro = 0;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (c === '«') dentro++;
      else if (c === '»') dentro = Math.max(0, dentro - 1);
      if (dentro === 0 && /[.!?…»]/.test(c) && t[i + 1] === ' ' && /[A-ZÁÉÍÓÚÑ¿¡«]/.test(t[i + 2] || '') && (c !== '»' || /[.!?…]/.test(t[i - 1]))) {
        out.push(t.slice(ini, i + 1).trim()); ini = i + 2;
      }
    }
    if (ini < t.length) out.push(t.slice(ini).trim());
    return out.filter(Boolean);
  }
  function bloqueAudio(L) {
    var caja = el('div', { class: 'audio' });
    var sec = el('section', { class: 'bloque', 'aria-labelledby': 'h-audio' }, [el('h2', { id: 'h-audio' }, [el('span', { class: 'ico', 'aria-hidden': 'true', text: '🎧' }), 'Escucha la lectura']), caja]);
    // Solo voz del navegador (sin MP3): se lee párrafo por párrafo.
    // Frase por frase (Chrome corta los enunciados largos); pausa más larga entre párrafos.
    var partes = [];
    [L.titulo].concat(L.texto_parrafos || []).filter(Boolean).forEach(function (p) {
      var fr = frases(String(p).replace(/\s+/g, ' ').trim());
      fr.map(function (f) { return f.trim(); }).filter(Boolean).forEach(function (f, k, a) { partes.push({ t: f, pausa: k === a.length - 1 ? 700 : 150 }); });
    });
    var bPlay = el('button', { type: 'button', class: 'btn', text: '▶ Escuchar la lectura' });
    var bLento = el('button', { type: 'button', class: 'btn sec', text: '🐢 Más despacio' });
    var bPausa = el('button', { type: 'button', class: 'btn sec', hidden: true, text: '⏸ Pausa' });
    var bStop = el('button', { type: 'button', class: 'btn sec', hidden: true, text: '⏹ Detener' });
    var estado = el('p', { class: 'pronto' });
    [bPlay, bLento, bPausa, bStop, estado].forEach(function (n) { caja.appendChild(n); });
    var turno = 0, pausado = false;
    function reiniciar() { bPausa.hidden = true; bStop.hidden = true; bPausa.textContent = '⏸ Pausa'; pausado = false; }
    function leer(rate) {
      if (!Voz.soporte || !Voz.voz) { estado.textContent = 'Tu navegador no tiene una voz en español. Puedes leer el texto y usar la traducción.'; return; }
      window.speechSynthesis.cancel();
      var mio = ++turno, i = 0;
      bPausa.hidden = false; bStop.hidden = false; pausado = false; bPausa.textContent = '⏸ Pausa';
      function sig() {
        if (mio !== turno) return;
        if (i >= partes.length) { reiniciar(); return; }
        var parte = partes[i++];
        var u = new SpeechSynthesisUtterance(parte.t);
        u.voice = Voz.voz; u.lang = Voz.voz.lang; u.rate = rate;
        u.onend = function () { setTimeout(sig, parte.pausa); };
        u.onerror = function () { if (mio === turno) reiniciar(); };
        window.speechSynthesis.speak(u);
      }
      sig();
    }
    bPlay.addEventListener('click', function () { leer(0.9); });
    bLento.addEventListener('click', function () { leer(0.7); });
    bPausa.addEventListener('click', function () {
      if (!pausado) { window.speechSynthesis.pause(); pausado = true; bPausa.textContent = '▶ Seguir'; }
      else { window.speechSynthesis.resume(); pausado = false; bPausa.textContent = '⏸ Pausa'; }
    });
    bStop.addEventListener('click', function () { turno++; window.speechSynthesis.cancel(); reiniciar(); });
    window.addEventListener('pagehide', function () { try { window.speechSynthesis.cancel(); } catch (e) {} });
    Voz.cargar().then(function (v) {
      if (!Voz.soporte || !v) { bPlay.disabled = true; bLento.disabled = true; estado.textContent = 'Tu navegador no tiene una voz en español. Puedes leer el texto y usar la traducción.'; return; }
      var l = String(v.lang || '').replace('_', '-').toLowerCase();
      estado.textContent = (l === 'es-es' || l === 'es') ? 'Tu dispositivo solo tiene una voz de España; la pronunciación puede variar un poco.' : 'Voz de tu dispositivo.';
    });
    return sec;
  }

  /* --- glosario dentro del texto --- */
  function indiceGlosario(G) {
    var mapa = {}, terms = [];
    G.forEach(function (g) {
      var formas = (g.formas && g.formas.length) ? g.formas : [g.palabra];
      formas.forEach(function (f) { var k = f.toLowerCase(); if (!mapa[k]) { mapa[k] = g; terms.push(f); } });
    });
    terms.sort(function (a, b) { return b.length - a.length; });
    if (!terms.length) return null;
    var re = new RegExp('(?<![\\p{L}\\p{N}])(' + terms.map(escRe).join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
    return { re: re, mapa: mapa };
  }
  var nGlosa = 0;
  function conGlosas(texto, idx) {
    var frag = document.createDocumentFragment();
    if (!idx) { frag.appendChild(document.createTextNode(texto)); return frag; }
    var last = 0, m;
    idx.re.lastIndex = 0;
    while ((m = idx.re.exec(texto))) {
      if (m.index > last) frag.appendChild(document.createTextNode(texto.slice(last, m.index)));
      var g = idx.mapa[m[1].toLowerCase()];
      frag.appendChild(el('button', { type: 'button', class: 'glosa', 'data-en': g.traduccion_en, 'aria-expanded': 'false', 'aria-controls': 'glosa-pop', id: 'gl' + (++nGlosa), text: m[1] }));
      last = m.index + m[1].length;
    }
    if (last < texto.length) frag.appendChild(document.createTextNode(texto.slice(last)));
    return frag;
  }

  function bloqueTexto(L, imgs) {
    var idx = L.glosario ? indiceGlosario(L.glosario) : null;
    var T = L.traduccion_parrafos || [];
    var cont = el('div', { class: 'texto' });
    var todos = el('button', { type: 'button', class: 'btn sec peq', 'aria-pressed': 'false', id: 'trad-todo' }, ['Mostrar traducción']);
    var tools = el('div', { class: 'herramientas' }, [T.length ? todos : null, idx ? el('p', { class: 'pista', text: 'Toca las palabras subrayadas para ver su significado en inglés.' }) : null]);
    var botones = [];
    function poner(btn, abierto) {
      var en = document.getElementById(btn.getAttribute('aria-controls'));
      en.hidden = !abierto; btn.setAttribute('aria-expanded', String(abierto));
      btn.textContent = abierto ? 'Ocultar traducción' : 'Ver traducción';
    }
    (L.texto_parrafos || []).forEach(function (p, i) {
      var d = el('div', { class: 'parrafo' }, [el('p', { class: 'es' }, [conGlosas(p, idx)])]);
      if (T[i]) {
        var b = el('button', { type: 'button', class: 'ver-trad', 'aria-expanded': 'false', 'aria-controls': 'trad' + i, text: 'Ver traducción' });
        b.addEventListener('click', function () { poner(b, b.getAttribute('aria-expanded') !== 'true'); sincTodo(); });
        botones.push(b);
        d.appendChild(b);
        d.appendChild(el('p', { class: 'en', id: 'trad' + i, lang: 'en', hidden: true, text: T[i] }));
      }
      cont.appendChild(d);
      imgs.forEach(function (im) {
        if (im.tipo !== 'portada' && (im.despues_parrafo === i + 1)) cont.appendChild(figura(im));
      });
    });
    // imágenes sin posición: al final del texto
    imgs.forEach(function (im) { if (im.tipo !== 'portada' && !im.despues_parrafo) cont.appendChild(figura(im)); });
    function sincTodo() {
      var abiertos = botones.filter(function (b) { return b.getAttribute('aria-expanded') === 'true'; }).length;
      var all = abiertos === botones.length;
      todos.setAttribute('aria-pressed', String(all));
      todos.textContent = all ? 'Ocultar traducción' : 'Mostrar traducción';
    }
    todos.addEventListener('click', function () {
      var abrir = todos.getAttribute('aria-pressed') !== 'true';
      botones.forEach(function (b) { poner(b, abrir); }); sincTodo();
      decir(abrir ? 'Traducción visible' : 'Traducción oculta');
    });
    return el('section', { class: 'bloque', 'aria-labelledby': 'h-texto' }, [el('h2', { id: 'h-texto', class: 'sr', text: 'Texto' }), tools, cont]);
  }
  function figura(im) {
    return el('figure', { class: 'fig' }, [imagen(base, im), im.pie ? el('figcaption', { text: im.pie }) : null]);
  }

  // el bloque del gráfico solo aparece si hay imagen o datos (null, {}, "" → no se muestra)
  function hayGrafico(G) { return !!(G && typeof G === 'object' && (G.archivo || (Array.isArray(G.datos) && G.datos.length))); }
  function bloqueGrafico(G) {
    // ícono del título: genérico 📊; se cambia con "grafico.icono" en el JSON ("" = sin ícono)
    var ico = (typeof G.icono === 'string') ? G.icono : '📊';
    var sec = el('section', { class: 'bloque', 'aria-labelledby': 'h-graf' }, [el('h2', { id: 'h-graf' }, [ico ? el('span', { class: 'ico', 'aria-hidden': 'true', text: ico }) : null, G.titulo || 'Gráfico'])]);
    if (G.archivo) sec.appendChild(el('figure', { class: 'fig' }, [imagen(base, { archivo: G.archivo, webp: G.webp, alt: G.alt || G.titulo, ancho: G.ancho, alto: G.alto }), G.nota ? el('figcaption', { text: G.nota }) : null]));
    if (G.datos && G.datos.length) {
      var cols = Object.keys(G.datos[0]);
      var nombres = G.columnas || {};
      var tabla = el('table', {}, [
        el('caption', { class: 'sr', text: G.titulo }),
        el('thead', {}, [el('tr', {}, cols.map(function (c) { return el('th', { scope: 'col', text: nombres[c] || (c.charAt(0).toUpperCase() + c.slice(1)) }); }))]),
        el('tbody', {}, G.datos.map(function (r) { return el('tr', {}, cols.map(function (c, i) { return el(i ? 'td' : 'th', i ? {} : { scope: 'row' }, [String(r[c])]); })); }))
      ]);
      var estrecho = window.matchMedia && matchMedia('(max-width: 40rem)').matches;
      sec.appendChild(el('details', { open: estrecho }, [el('summary', { text: 'Ver los datos en una tabla' }), tabla]));
    }
    return sec;
  }

  function bloqueGlosario(G) {
    var dl = el('dl');
    G.forEach(function (g) { dl.appendChild(el('dt', { text: g.palabra })); dl.appendChild(el('dd', { lang: 'en', text: g.traduccion_en })); });
    return el('section', { class: 'bloque glosario', 'aria-label': 'Glosario' }, [el('details', {}, [el('summary', { text: '📖 Glosario (' + G.length + ' palabras)' }), dl])]);
  }

  /* --- popover del glosario --- */
  var actual = null, fijo = false;
  function mostrar(btn) {
    if (actual && actual !== btn) actual.setAttribute('aria-expanded', 'false');
    actual = btn;
    btn.setAttribute('aria-expanded', 'true');
    pop.firstChild.textContent = btn.getAttribute('data-en');
    pop.hidden = false;
    btn.setAttribute('aria-describedby', 'glosa-pop');
    var r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var cx = r.left + r.width / 2;
    var left = Math.max(8, Math.min(vw - pw - 8, cx - pw / 2));
    var arriba = r.top > ph + 16;
    var top = arriba ? r.top - ph - 10 : r.bottom + 10;
    pop.dataset.lado = arriba ? 'arriba' : 'abajo';
    pop.style.left = (left + window.scrollX) + 'px';
    pop.style.top = (top + window.scrollY) + 'px';
    pop.style.setProperty('--flecha', Math.max(12, Math.min(pw - 12, cx - left)) + 'px');
  }
  function ocultar() {
    if (actual) { actual.setAttribute('aria-expanded', 'false'); actual.removeAttribute('aria-describedby'); }
    actual = null; fijo = false; pop.hidden = true;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.glosa');
    if (b) {
      if (actual === b && fijo) { ocultar(); return; }
      mostrar(b); fijo = true; decir(b.textContent + ': ' + b.getAttribute('data-en'));
      return;
    }
    if (actual) ocultar();
  });
  var hoverOK = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (hoverOK) {
    document.addEventListener('mouseover', function (e) { var b = e.target.closest && e.target.closest('.glosa'); if (b && !fijo) mostrar(b); });
    document.addEventListener('mouseout', function (e) { var b = e.target.closest && e.target.closest('.glosa'); if (b && !fijo && b === actual) ocultar(); });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && actual) { var b = actual; ocultar(); b.focus(); } });
  document.addEventListener('focusout', function (e) { if (actual && e.target === actual) setTimeout(function () { if (actual && document.activeElement !== actual) ocultar(); }, 0); });
  window.addEventListener('resize', function () { if (actual) mostrar(actual); });

  /* ---------- ejercicios ---------- */

  /* --- sonido (opcional, Web Audio, sin archivos) --- */
  var ctxAudio = null;
  function sonidoActivo() { try { return localStorage.getItem('lecturas:sonido') !== 'off'; } catch (e) { return true; } }
  function sonido(ok) {
    if (!sonidoActivo()) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctxAudio = ctxAudio || new AC();
      var t = ctxAudio.currentTime;
      (ok ? [660, 880] : [220]).forEach(function (f, i) {
        var o = ctxAudio.createOscillator(), g = ctxAudio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.18);
        o.connect(g); g.connect(ctxAudio.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.2);
      });
    } catch (e) {}
  }
  function animar(n, cls) { if (!n) return; n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls); }

  /* --- voz: speechSynthesis (hasta que haya MP3) --- */
  var Voz = {
    soporte: 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function',
    voz: null, promesa: null,
    elegir: function () {
      var vs = window.speechSynthesis.getVoices() || [];
      // Voz de América (criterios_lengua.md): es-US, es-MX, es-419 y otras es-* de América; nunca es-ES.
      var america = vs.filter(function (v) { var l = String(v.lang || '').replace('_', '-').toLowerCase(); return l.indexOf('es') === 0 && l !== 'es-es' && l !== 'es'; });
      function de2(pref) { return america.filter(function (v) { return String(v.lang).replace('_', '-').toLowerCase().indexOf(pref) === 0; })[0]; }
      // último recurso: cualquier voz en español, incluida es-ES (con nota)
      var cualquiera = vs.filter(function (v) { return String(v.lang || '').toLowerCase().indexOf('es') === 0; });
      return de2('es-us') || de2('es-mx') || de2('es-419') || america[0] || cualquiera[0] || null;
    },
    cargar: function () {
      if (!Voz.soporte) return Promise.resolve(null);
      if (Voz.promesa) return Voz.promesa;
      Voz.promesa = new Promise(function (ok) {
        var v = Voz.elegir();
        if (v) return ok(Voz.voz = v);
        var hecho = false;
        function fin() { if (hecho) return; hecho = true; ok(Voz.voz = Voz.elegir()); }
        try { window.speechSynthesis.addEventListener('voiceschanged', fin); } catch (e) {}
        setTimeout(fin, 1500);
      });
      return Voz.promesa;
    },
    decir: function (texto, rate) {
      if (!Voz.soporte || !Voz.voz) return false;
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(texto);
        u.voice = Voz.voz; u.lang = Voz.voz.lang; u.rate = rate || 0.9;
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    }
  };
  var Reconocer = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  // botones Escuchar / Más despacio (+ «Ver la frase» si no hay voz)
  function botonesVoz(texto) {
    var frase = el('p', { class: 'frase-oculta', hidden: true, text: '«' + texto + '»' });
    var b1 = el('button', { type: 'button', class: 'btn peq voz', text: '▶ Escuchar' });
    var b2 = el('button', { type: 'button', class: 'btn sec peq voz', text: '🐢 Más despacio' });
    var ver = el('button', { type: 'button', class: 'btn sec peq ver-frase', hidden: true, text: '👁 Ver la frase' });
    b1.addEventListener('click', function () { if (Voz.decir(texto, 0.9)) animar(b1, 'pulso'); else { ver.hidden = false; } });
    b2.addEventListener('click', function () { if (Voz.decir(texto, 0.7)) animar(b2, 'pulso'); else { ver.hidden = false; } });
    ver.addEventListener('click', function () { frase.hidden = false; ver.hidden = true; });
    var fila = el('div', { class: 'fila-voz' }, [b1, b2, ver]);
    return { fila: fila, frase: frase, ver: ver };
  }
  function avisoVoz(caja, botones) {
    Voz.cargar().then(function (v) {
      if (caja.querySelector('.aviso-voz')) return;
      var donde = caja.querySelector('.consigna').nextSibling;
      if (v) {
        if (/^es[-_]es$/i.test(String(v.lang || ''))) caja.insertBefore(el('p', { class: 'fb nota aviso-voz voz-espana', text: 'Tu dispositivo solo tiene una voz de España; la pronunciación puede variar un poco.' }), donde);
        return;
      }
      caja.insertBefore(el('p', { class: 'fb nota aviso-voz sin-voz', text: 'Tu navegador no tiene una voz en español. Puedes leer la frase con «Ver la frase» (prueba en Chrome, Edge o Safari para escucharla).' }), donde);
      botones.forEach(function (b) { b.ver.hidden = false; });
    });
  }

  /* --- estructura: principal + «Más práctica» y progreso --- */
  var ETIQ = { Leer: '📖', Escuchar: '🎧', Escribir: '✏️', Hablar: '🎤', Cultura: '🌎' };
  function bloqueEjercicios(L, todos, extraTitulo) {
    var visibles = todos.filter(function (e) { return TIPOS[e.tipo] && !(e.requiere === 'reconocimiento_voz' && !Reconocer); });
    var lista = visibles.filter(function (e) { return e.seccion !== 'mas_practica'; });
    var mas = visibles.filter(function (e) { return e.seccion === 'mas_practica'; });
    var hechos = {}, mejores = {};
    var barra = el('i');
    var txtProg = el('span', { class: 'txt-prog', text: '0 de ' + lista.length });
    var bSon = el('button', { type: 'button', class: 'son', 'aria-pressed': String(sonidoActivo()), 'aria-label': 'Sonidos', text: sonidoActivo() ? '🔊' : '🔇' });
    bSon.addEventListener('click', function () {
      var on = !sonidoActivo();
      try { localStorage.setItem('lecturas:sonido', on ? 'on' : 'off'); } catch (e) {}
      bSon.setAttribute('aria-pressed', String(on)); bSon.textContent = on ? '🔊' : '🔇';
    });
    var sec = el('section', { class: 'bloque', 'aria-labelledby': 'h-ej', id: 'ejercicios' }, [
      el('h2', { id: 'h-ej' }, [el('span', { class: 'ico', 'aria-hidden': 'true', text: '✏️' }), 'Ahora, practica']),
      el('div', { class: 'progreso' }, [el('div', { class: 'barra-prog', 'aria-hidden': 'true' }, [barra]), txtProg, bSon])
    ]);
    function puntos(id, n) {
      if (!(n <= (mejores[id] || 0))) mejores[id] = n;
    }
    function hecho(id, esExtra) {
      if (esExtra) return;
      hechos[id] = true; var n = Object.keys(hechos).length;
      barra.style.width = (100 * n / lista.length) + '%';
      txtProg.textContent = n + ' de ' + lista.length + (n === lista.length ? ' · completado' : '');
    }
    function pintar(ej, num, esExtra) {
      var id = ej.id || ('e' + num);
      var caja = el('section', { class: 'ejercicio', id: 'ej-' + id, 'data-tipo': ej.tipo, 'aria-labelledby': 'ejh-' + id }, [
        el('div', { class: 'habilidades' }, (ej.habilidades || []).map(function (h) { return el('span', { class: 'hab', 'data-h': h, text: (ETIQ[h] ? ETIQ[h] + ' ' : '') + h }); })),
        el('h3', { id: 'ejh-' + id }, [el('span', { class: 'num', text: num + '.' }), ej.titulo || '']),
        el('p', { class: 'consigna', text: ej.consigna || '' })
      ]);
      var api = {
        listo: function () { hecho(id, esExtra); },
        puntos: function (n) { puntos(id, n); },
        reiniciar: function () { var nueva = pintar(ej, num, esExtra); caja.replaceWith(nueva); var h = nueva.querySelector('h3'); h.setAttribute('tabindex', '-1'); h.focus(); }
      };
      TIPOS[ej.tipo](caja, ej, L, api);
      return caja;
    }
    lista.forEach(function (ej, i) { sec.appendChild(pintar(ej, i + 1, false)); });
    if (mas.length) {
      var det = el('details', { class: 'mas-practica', id: 'mas-practica' }, [el('summary', { text: '➕ ' + (extraTitulo || 'Más práctica') + ' (' + mas.length + (mas.length === 1 ? ' ejercicio' : ' ejercicios') + ')' })]);
      mas.forEach(function (ej, k) { det.appendChild(pintar(ej, lista.length + k + 1, true)); });
      sec.appendChild(det);
    }
    return sec;
  }

  /* --- piezas comunes --- */
  function fb(tipo, texto) { return el('p', { class: 'fb ' + tipo, text: texto }); }
  function limpiar(caja) { caja.querySelectorAll('.fb:not(.aviso-voz)').forEach(function (n) { n.remove(); }); caja.querySelectorAll('.ok,.mal').forEach(function (n) { n.classList.remove('ok', 'mal'); }); }
  function nota(bien, total) {
    var r = bien + ' de ' + total;
    if (bien === total) return r + ' · Todo correcto.';
    if (bien >= total - 1) return r + ' · Casi todo. Mira las explicaciones.';
    return r + ' · Vuelve al texto y prueba otra vez.';
  }
  function acciones(caja, comprobar) {
    var res = el('p', { class: 'resultado', role: 'status' });
    var b = el('button', { type: 'button', class: 'btn comprobar', text: 'Comprobar' });
    b.addEventListener('click', comprobar);
    caja.appendChild(el('div', { class: 'acciones' }, [b, res]));
    return res;
  }
  function pieInstantaneo(caja, api) {
    var res = el('p', { class: 'resultado', role: 'status' });
    var otra = el('button', { type: 'button', class: 'btn sec peq otra', hidden: true, text: '↻ Otra vez' });
    otra.addEventListener('click', api.reiniciar);
    caja.appendChild(el('div', { class: 'acciones' }, [res, otra]));
    return { res: res, otra: otra };
  }
  function faltan(res, n) { res.textContent = n === 1 ? 'Te falta 1 respuesta.' : 'Te faltan ' + n + ' respuestas.'; }
  // compara un texto escrito con las respuestas: 'ok' | {casi, motivo} | null
  function comparar(valor, respuestas) {
    var v = norm(valor);
    if (respuestas.some(function (r) { return norm(r) === v; })) return 'ok';
    var r = respuestas.filter(function (x) { return sinTildes(norm(x)) === sinTildes(v); })[0];
    if (!r) return null;
    var motivo = /ñ/i.test(r) && !/ñ/i.test(valor) ? 'con ñ' : (sinTildes(r) === r && sinTildes(valor) !== valor ? 'sin tilde' : 'con tilde');
    return { casi: r, motivo: motivo };
  }

  // grupo de opciones con corrección instantánea (un intento por ítem)
  var nGrupo = 0;
  function eleccion(item, opciones, correcta, explicacionOK, explicacionMal, alResponder, conImagen) {
    var nombre = 'g' + (++nGrupo);
    var cont = el('div', { class: 'opciones' + (conImagen ? ' tarjetas' : (opciones.every(function (o) { return String(o).length < 22; }) ? ' fila' : '')) });
    opciones.forEach(function (o, k) {
      var contenido = conImagen
        ? el('span', {}, [imagen(base, { archivo: o.respaldo || o.imagen, webp: o.respaldo ? o.imagen : null, alt: o.alt || '' }), el('b', { text: o.texto })])
        : el('span', { text: o });
      cont.appendChild(el('label', { class: 'chip' }, [el('input', { type: 'radio', name: nombre, value: String(k) }), contenido]));
    });
    cont.addEventListener('change', function (e) {
      if (item.dataset.respondido) return;
      item.dataset.respondido = '1';
      var v = +e.target.value, ok = v === correcta;
      cont.querySelectorAll('input').forEach(function (x) { x.disabled = true; });
      cont.children[correcta].classList.add('es-correcta');
      if (!ok) cont.children[v].classList.add('es-mal');
      item.classList.add(ok ? 'ok' : 'mal');
      item.appendChild(fb(ok ? 'ok' : 'mal', ok ? explicacionOK : explicacionMal));
      animar(ok ? cont.children[v] : item, ok ? 'pop' : 'shake');
      sonido(ok);
      alResponder(ok);
    });
    return cont;
  }
  // ejercicio de ítems instantáneos: crea ítems con fabricar(item, i, responder)
  function instantaneo(caja, ej, api, fabricar) {
    var bien = 0, hechos = 0, total = ej.items.length;
    var pie;
    ej.items.forEach(function (it, i) {
      var nodo = fabricar(it, i, function (ok) {
        hechos++; if (ok) bien++;
        api.puntos(bien);
        if (hechos === total) { pie.res.textContent = nota(bien, total); pie.otra.hidden = false; api.listo(); }
        else pie.res.textContent = bien + ' de ' + hechos + ' · sigue…';
      });
      nodo.setAttribute('data-i', i);
      caja.appendChild(nodo);
    });
    pie = pieInstantaneo(caja, api);
  }
  function opcionTexto(it) { return '«' + String(it.opciones[it.correcta]).replace(/^«|»$/g, '') + '»'; }

  var TIPOS = {
    opcion_multiple: function (caja, ej, L, api) {
      instantaneo(caja, ej, api, function (it, i, responder) {
        var fs = el('fieldset', { class: 'item' }, [el('legend', { text: it.pregunta })]);
        fs.appendChild(eleccion(fs, it.opciones, it.correcta, '¡Bien! ' + it.explicacion, 'No exactamente. La respuesta es ' + opcionTexto(it) + '. ' + it.explicacion, responder));
        return fs;
      });
    },

    situaciones: function (caja, ej, L, api) {
      instantaneo(caja, ej, api, function (it, i, responder) {
        var fs = el('fieldset', { class: 'item situacion' }, [el('legend', {}, [it.icono ? el('span', { class: 'icono', 'aria-hidden': 'true', text: it.icono }) : null, it.situacion])]);
        fs.appendChild(eleccion(fs, it.opciones, it.correcta, '¡Bien! ' + it.explicacion, 'Mejor: ' + opcionTexto(it) + '. ' + it.explicacion, responder));
        return fs;
      });
    },

    verdadero_falso: function (caja, ej, L, api) {
      instantaneo(caja, ej, api, function (it, i, responder) {
        var fs = el('fieldset', { class: 'item' }, [el('legend', { text: it.afirmacion })]);
        var c = it.correcta ? 0 : 1, que = it.correcta ? 'verdadero. ' : 'falso. ';
        fs.appendChild(eleccion(fs, ['Verdadero', 'Falso'], c, '¡Bien! Es ' + que + 'El texto dice: ' + it.justificacion, 'Mira otra vez: es ' + que + 'El texto dice: ' + it.justificacion, responder));
        return fs;
      });
    },

    clasificar: function (caja, ej, L, api) {
      instantaneo(caja, ej, api, function (it, i, responder) {
        var fs = el('fieldset', { class: 'item' }, [el('legend', { text: it.texto })]);
        fs.appendChild(eleccion(fs, ej.categorias, ej.categorias.indexOf(it.categoria), '¡Bien! ' + it.explicacion, 'Es ' + it.categoria + '. ' + it.explicacion, responder));
        return fs;
      });
    },

    escuchar_elegir: function (caja, ej, L, api) {
      var bots = [];
      instantaneo(caja, ej, api, function (it, i, responder) {
        var bv = botonesVoz(it.decir); bots.push(bv);
        var fs = el('fieldset', { class: 'item escucha' }, [el('legend', { text: (i + 1) + '. ' + it.pregunta }), bv.fila, bv.frase]);
        fs.appendChild(eleccion(fs, it.opciones, it.correcta, '¡Bien! Oíste: «' + it.decir + '» ' + it.explicacion, 'La respuesta es ' + opcionTexto(it) + '. Oíste: «' + it.decir + '» ' + it.explicacion, responder));
        return fs;
      });
      avisoVoz(caja, bots);
    },

    escuchar_imagen: function (caja, ej, L, api) {
      var bots = [];
      instantaneo(caja, ej, api, function (it, i, responder) {
        var bv = botonesVoz(it.decir); bots.push(bv);
        var correctaTxt = ej.opciones[it.correcta].texto;
        var fs = el('fieldset', { class: 'item escucha' }, [el('legend', { text: 'Frase ' + (i + 1) }), bv.fila, bv.frase]);
        fs.appendChild(eleccion(fs, ej.opciones, it.correcta, '¡Bien! «' + it.decir + '» ' + it.explicacion, 'Es «' + correctaTxt + '». «' + it.decir + '» ' + it.explicacion, responder, true));
        return fs;
      });
      avisoVoz(caja, bots);
    },

    dictado: function (caja, ej, L, api) {
      var bots = [], inputs = [];
      ej.items.forEach(function (it, i) {
        var bv = botonesVoz(it.decir); bots.push(bv);
        var inp = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Dictado ' + (i + 1) });
        inputs.push(inp);
        caja.appendChild(el('div', { class: 'item dictado', 'data-i': i }, [bv.fila, bv.frase, el('p', { class: 'hueco' }, [it.antes + (/[«(¿¡]$/.test(it.antes) ? '' : ' '), inp, (/^[.,;:!?»)]/.test(it.despues) ? '' : ' ') + it.despues])]));
      });
      avisoVoz(caja, bots);
      var res = acciones(caja, function () {
        limpiar(caja);
        var sin = inputs.filter(function (x) { return !x.value.trim(); }).length;
        if (sin) return faltan(res, sin);
        var bien = 0;
        ej.items.forEach(function (it, i) {
          var d = caja.querySelector('.dictado[data-i="' + i + '"]'), c = comparar(inputs[i].value, it.respuesta);
          if (c) bien++;
          d.classList.add(c ? 'ok' : 'mal');
          d.appendChild(c && c !== 'ok' ? fb('nota', '¡Correcto! Un detalle: se escribe «' + c.casi + '», ' + c.motivo + '. ' + it.explicacion)
            : fb(c ? 'ok' : 'mal', (c ? '¡Bien! ' : 'Es «' + it.respuesta[0] + '». ') + it.explicacion));
        });
        sonido(bien === ej.items.length);
        res.textContent = nota(bien, ej.items.length); api.puntos(bien); api.listo();
      });
    },

    hablar: function (caja, ej, L, api) {
      if (!Reconocer) { caja.hidden = true; return; }
      var logrados = {};
      var idioma = (ej.idioma && !/^es-es$/i.test(ej.idioma)) ? ej.idioma : 'es-US';
      function logrado(i) { logrados[i] = true; var n = Object.keys(logrados).length; api.puntos(n); if (n === ej.items.length) api.listo(); }
      // Respuesta libre: cualquier respuesta razonable (unas palabras) vale; después se muestra un modelo.
      function libre(it, i) {
        var min = it.minimo_palabras || 3;
        var mic = el('button', { type: 'button', class: 'btn mic', text: '🎤 Responder' });
        var estado = el('p', { class: 'estado-mic', 'aria-live': 'polite' });
        var bvm = botonesVoz(it.modelo);
        var caja2 = el('div', { class: 'modelo-libre', hidden: true }, [el('p', { class: 'nota-modelo' }, ['Una respuesta posible: ', el('strong', { text: it.modelo })]), el('div', { class: 'fila-voz' }, [bvm.fila.children[0], bvm.fila.children[1]])]);
        var d = el('div', { class: 'item hablar libre', 'data-i': i }, [el('p', { class: 'preg' }, [el('span', { class: 'etq-libre', text: 'Responde con tus palabras. ' }), it.pregunta]), el('div', { class: 'fila-voz' }, [mic]), estado, caja2]);
        mic.addEventListener('click', function () {
          var r;
          try { r = new Reconocer(); } catch (e) { estado.textContent = 'El micrófono no está disponible en este navegador.'; return; }
          r.lang = idioma; r.interimResults = false; r.maxAlternatives = 3;
          mic.disabled = true; estado.textContent = 'Te escucho…';
          r.onresult = function (e) {
            var alts = [], res0 = e.results[0];
            for (var k = 0; k < res0.length; k++) alts.push(String(res0[k].transcript || '').trim());
            var mejor = alts.sort(function (x, y) { return norm(y).split(' ').length - norm(x).split(' ').length; })[0] || '';
            var n = norm(mejor) ? norm(mejor).split(' ').length : 0;
            limpiar(d);
            if (n >= min) {
              d.classList.add('ok');
              caja2.before(fb('ok', 'Gracias. Oí: «' + mejor + '». No hay una sola respuesta correcta; compara con este modelo.'));
              caja2.hidden = false; sonido(true); logrado(i);
            } else {
              d.classList.add('mal');
              caja2.before(fb('mal', (n ? 'Oí: «' + mejor + '». ' : 'No te oí bien. ') + 'Intenta decir una oración completa, de ' + min + ' palabras o más.'));
              sonido(false);
            }
          };
          r.onerror = function (e) {
            estado.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Necesito permiso para usar el micrófono.' : e.error === 'no-speech' ? 'No te oí. Prueba otra vez.' : 'No se pudo usar el micrófono.';
          };
          r.onend = function () { mic.disabled = false; if (estado.textContent === 'Te escucho…') estado.textContent = ''; };
          try { r.start(); } catch (e) { mic.disabled = false; estado.textContent = 'No se pudo usar el micrófono.'; }
        });
        return d;
      }
      ej.items.forEach(function (it, i) {
        if (it.libre) { caja.appendChild(libre(it, i)); return; }
        var bv = botonesVoz(it.frase);
        var mic = el('button', { type: 'button', class: 'btn mic', text: '🎤 Dilo' });
        var estado = el('p', { class: 'estado-mic', 'aria-live': 'polite' });
        var d = el('div', { class: 'item hablar', 'data-i': i }, [el('p', { class: 'preg' }, [it.contexto + ' ', el('strong', { text: it.frase })]), el('div', { class: 'fila-voz' }, [bv.fila.children[0], bv.fila.children[1], mic]), estado]);
        mic.addEventListener('click', function () {
          var r;
          try { r = new Reconocer(); } catch (e) { estado.textContent = 'El micrófono no está disponible en este navegador.'; return; }
          r.lang = idioma; r.interimResults = false; r.maxAlternatives = 3;
          mic.disabled = true; estado.textContent = 'Te escucho…';
          r.onresult = function (e) {
            var alts = [], res0 = e.results[0];
            for (var k = 0; k < res0.length; k++) alts.push(res0[k].transcript);
            var mejor = alts.map(function (a) { return { a: a, s: parecido(a, it.frase) }; }).sort(function (x, y) { return y.s - x.s; })[0];
            limpiar(d);
            var ok = mejor && mejor.s >= 0.75 && parecidoPalabras(mejor.a, it.frase) >= 0.8;
            d.classList.add(ok ? 'ok' : 'mal');
            var exacto = ok && sinTildes(norm(mejor.a)) === sinTildes(norm(it.frase));
            d.appendChild(fb(ok ? 'ok' : 'mal', ok ? (exacto ? '¡Muy bien! Oí: «' + mejor.a + '».' : '¡Bien! Se dice: «' + it.frase.replace(/[.]$/, '') + '».') : 'Casi. Oí: «' + (mejor ? mejor.a : '…') + '». Escucha el modelo y prueba otra vez.'));
            animar(d, ok ? 'pop' : 'shake'); sonido(ok);
            if (ok) logrado(i);
          };
          r.onerror = function (e) {
            estado.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Necesito permiso para usar el micrófono.' : e.error === 'no-speech' ? 'No te oí. Prueba otra vez.' : 'No se pudo usar el micrófono.';
          };
          r.onend = function () { mic.disabled = false; if (estado.textContent === 'Te escucho…') estado.textContent = ''; };
          try { r.start(); } catch (e) { mic.disabled = false; estado.textContent = 'No se pudo usar el micrófono.'; }
        });
        caja.appendChild(d);
      });
      caja.appendChild(el('p', { class: 'contador', text: 'El reconocimiento de voz lo hace tu navegador. No se guarda nada en esta página.' }));
    },

    arrastrar: function (caja, ej, L, api) {
      var fig = el('div', { class: 'lamina' }, [imagen(base, { archivo: ej.respaldo || ej.imagen, webp: ej.respaldo ? ej.imagen : null, alt: ej.alt || '', ancho: ej.ancho, alto: ej.alto })]);
      var salida = el('div', { class: 'salida', 'aria-live': 'polite' });
      var pie = el('p', { class: 'resultado', role: 'status' });
      var palabras = ej.zonas.map(function (z) { return { palabra: z.palabra, explicacion: z.explicacion }; }).concat(ej.distractores || []);
      var bandeja = el('div', { class: 'bandeja', role: 'group', 'aria-label': 'Palabras' });
      var seleccion = null, intentos = {}, bien = 0, hechas = 0;
      ej.zonas.forEach(function (z, i) {
        var b = el('button', { type: 'button', class: 'zona', 'data-i': i, style: 'left:' + z.x + '%;top:' + z.y + '%', 'aria-label': 'Lugar ' + (i + 1) + ' en la imagen' }, [el('span', { class: 'n', text: String(i + 1) })]);
        alTocar(b, function () { if (seleccion) colocar(seleccion, b); });
        fig.appendChild(b);
      });
      function elegir(chip) {
        if (seleccion) seleccion.setAttribute('aria-pressed', 'false');
        seleccion = (seleccion === chip) ? null : chip;
        if (seleccion) { seleccion.setAttribute('aria-pressed', 'true'); decir('Elegiste «' + chip.textContent + '». Ahora toca un lugar en la imagen.'); }
        fig.classList.toggle('esperando', !!seleccion);
      }
      function colocar(chip, zonaBtn) {
        var z = ej.zonas[+zonaBtn.dataset.i];
        if (zonaBtn.classList.contains('ok')) return;
        var w = chip.textContent;
        salida.innerHTML = '';
        intentos[zonaBtn.dataset.i] = (intentos[zonaBtn.dataset.i] || 0) + 1;
        if (norm(w) === norm(z.palabra)) {
          zonaBtn.classList.add('ok');
          zonaBtn.innerHTML = ''; zonaBtn.appendChild(el('span', { class: 'etq', text: z.palabra }));
          zonaBtn.setAttribute('aria-label', 'Lugar ' + (+zonaBtn.dataset.i + 1) + ': ' + z.palabra + ', correcto');
          chip.remove(); seleccion = null; fig.classList.remove('esperando');
          if (intentos[zonaBtn.dataset.i] === 1) bien++;
          hechas++;
          salida.appendChild(fb('ok', '¡Bien! «' + z.palabra + '». ' + z.explicacion));
          leyenda.hidden = false;
          leyenda.appendChild(el('li', {}, [el('b', { text: (+zonaBtn.dataset.i + 1) + ' ' }), z.palabra + ' ✓']));
          animar(zonaBtn, 'pop'); sonido(true); api.puntos(bien);
          if (hechas === ej.zonas.length) {
            pie.textContent = 'Al primer intento: ' + nota(bien, ej.zonas.length);
            bandeja.querySelectorAll('.palabra').forEach(function (c) { c.disabled = true; });
            otra.hidden = false; api.listo();
          }
        } else {
          var p = palabras.filter(function (x) { return x.palabra === w; })[0];
          var esDistractor = (ej.distractores || []).some(function (d) { return d.palabra === w; });
          salida.appendChild(fb('mal', esDistractor ? 'No. ' + p.explicacion : 'Ahí no está «' + w + '». Pista: ' + p.explicacion));
          animar(zonaBtn, 'shake'); animar(chip, 'shake'); sonido(false);
          if (seleccion) { seleccion.setAttribute('aria-pressed', 'false'); seleccion = null; fig.classList.remove('esperando'); }
        }
      }
      barajar(palabras, ej.id).forEach(function (p) {
        var chip = el('button', { type: 'button', class: 'palabra', 'aria-pressed': 'false', text: p.palabra });
        var ini = null, arrastrando = false, fantasma = null, ultimo = 0;
        chip.addEventListener('pointerdown', function (e) {
          if (e.button > 0 || chip.disabled) return;
          ini = { x: e.clientX, y: e.clientY, id: e.pointerId }; arrastrando = false;
          try { chip.setPointerCapture(e.pointerId); } catch (x) {}
        });
        chip.addEventListener('pointermove', function (e) {
          if (!ini || e.pointerId !== ini.id) return;
          if (!arrastrando && Math.abs(e.clientX - ini.x) + Math.abs(e.clientY - ini.y) > 8) {
            arrastrando = true;
            fantasma = el('span', { class: 'palabra fantasma', 'aria-hidden': 'true', text: p.palabra });
            document.body.appendChild(fantasma); chip.classList.add('levantada');
          }
          if (arrastrando) {
            fantasma.style.left = e.clientX + 'px'; fantasma.style.top = e.clientY + 'px';
            fig.querySelectorAll('.zona').forEach(function (zb) { zb.classList.remove('encima'); });
            var deb = zonaEn(e.clientX, e.clientY); if (deb) deb.classList.add('encima');
          }
        });
        function terminar(e, soltar) {
          if (!ini) return;
          if (arrastrando) {
            fantasma.remove(); fantasma = null; chip.classList.remove('levantada');
            fig.querySelectorAll('.zona').forEach(function (zb) { zb.classList.remove('encima'); });
            ultimo = Date.now();
            var destino = soltar ? zonaEn(e.clientX, e.clientY) : null;
            if (destino) colocar(chip, destino);
          }
          else if (soltar && e.pointerType && e.pointerType !== 'mouse') { ultimo = Date.now(); elegir(chip); }
          ini = null; arrastrando = false;
        }
        chip.addEventListener('pointerup', function (e) { terminar(e, true); });
        chip.addEventListener('pointercancel', function (e) { terminar(e, false); });
        chip.addEventListener('click', function () { if (Date.now() - ultimo < 700) return; elegir(chip); });
        bandeja.appendChild(chip);
      });
      function zonaEn(x, y) {
        var r = null;
        fig.querySelectorAll('.zona:not(.ok)').forEach(function (zb) {
          var b = zb.getBoundingClientRect(), m = 14;
          if (x >= b.left - m && x <= b.right + m && y >= b.top - m && y <= b.bottom + m) r = zb;
        });
        return r;
      }
      var otra = el('button', { type: 'button', class: 'btn sec peq otra', hidden: true, text: '↻ Otra vez' });
      otra.addEventListener('click', api.reiniciar);
      var leyenda = el('ul', { class: 'leyenda', hidden: true, 'aria-label': 'Palabras colocadas' });
      caja.appendChild(fig); caja.appendChild(leyenda); caja.appendChild(bandeja); caja.appendChild(salida);
      caja.appendChild(el('div', { class: 'acciones' }, [pie, otra]));
    },

    relacionar: function (caja, ej, L, api) {
      var derechas = barajar(ej.pares.map(function (p) { return p.derecha; }), ej.id);
      ej.pares.forEach(function (p, i) {
        var id = ej.id + '-s' + i;
        var sel = el('select', { id: id, 'data-i': i }, [el('option', { value: '', text: 'Elige…' })].concat(derechas.map(function (d) { return el('option', { value: d, text: d }); })));
        caja.appendChild(el('div', { class: 'par item', 'data-i': i }, [el('label', { class: 'lado preg', for: id, text: p.izquierda }), sel]));
      });
      function unicos() {
        var ss = [].slice.call(caja.querySelectorAll('select'));
        ss.forEach(function (s) {
          var usados = ss.filter(function (o) { return o !== s && o.value; }).map(function (o) { return o.value; });
          [].forEach.call(s.options, function (op) { if (op.value) op.disabled = usados.indexOf(op.value) >= 0; });
        });
      }
      caja.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') unicos(); });
      var res = acciones(caja, function () {
        limpiar(caja);
        var sels = caja.querySelectorAll('select');
        var sin = [].filter.call(sels, function (s) { return !s.value; }).length;
        if (sin) return faltan(res, sin);
        var bien = 0;
        ej.pares.forEach(function (p, i) {
          var row = caja.querySelector('.par[data-i="' + i + '"]'), ok = sels[i].value === p.derecha;
          if (ok) bien++;
          row.classList.add(ok ? 'ok' : 'mal');
          row.appendChild(fb(ok ? 'ok' : 'mal', (ok ? '¡Bien! ' : 'Va con «' + p.derecha + '». ') + p.explicacion));
        });
        sonido(bien === ej.pares.length);
        res.textContent = nota(bien, ej.pares.length); api.puntos(bien); api.listo();
      });
    },

    ordenar: function (caja, ej, L, api) {
      var orden = barajar(ej.pasos.map(function (_, i) { return i; }), ej.id);
      if (orden.every(function (v, i) { return v === i; })) orden.reverse();
      var ol = el('ol', { class: 'orden', 'aria-label': 'Pasos para ordenar' });
      function pintar(foco) {
        ol.innerHTML = '';
        orden.forEach(function (k, pos) {
          var t = ej.pasos[k];
          var up = el('button', { type: 'button', class: 'flecha', 'aria-label': 'Subir: ' + t, disabled: pos === 0, text: '↑' });
          var dn = el('button', { type: 'button', class: 'flecha', 'aria-label': 'Bajar: ' + t, disabled: pos === orden.length - 1, text: '↓' });
          up.addEventListener('click', function () { mover(pos, -1, 'up'); });
          dn.addEventListener('click', function () { mover(pos, 1, 'dn'); });
          ol.appendChild(el('li', { 'data-k': k }, [el('span', { class: 'txt', text: t }), up, dn]));
        });
        if (foco) {
          var li = ol.children[foco.pos], b = li && li.querySelectorAll('.flecha')[foco.dir === 'up' ? 0 : 1];
          if (b && b.disabled) b = li.querySelectorAll('.flecha')[foco.dir === 'up' ? 1 : 0];
          if (b) b.focus();
        }
      }
      function mover(pos, d, dir) {
        var np = pos + d; if (np < 0 || np >= orden.length) return;
        var t = orden[pos]; orden[pos] = orden[np]; orden[np] = t;
        limpiar(caja); res.textContent = '';
        pintar({ pos: np, dir: dir });
        decir(ej.pasos[orden[np]] + ': posición ' + (np + 1));
      }
      caja.appendChild(ol);
      pintar();
      var res = acciones(caja, function () {
        limpiar(caja);
        var bien = 0;
        [].forEach.call(ol.children, function (li, pos) {
          var ok = +li.getAttribute('data-k') === pos; if (ok) bien++;
          li.classList.add(ok ? 'ok' : 'mal');
        });
        var todo = bien === orden.length;
        caja.querySelector('.acciones').before(fb(todo ? 'ok' : 'mal', todo ? '¡Bien! ' + ej.explicacion : 'Hay ' + (orden.length - bien) + ' pasos en otro lugar (marcados en rojo). ' + (ej.pista || 'Vuelve al texto y prueba otra vez.')));
        sonido(todo);
        res.textContent = nota(bien, orden.length); api.puntos(bien); api.listo();
      });
    },

    completar: function (caja, ej, L, api) {
      var ultimo = null;
      var inputs = [];
      if (ej.banco && ej.banco.length) {
        caja.appendChild(el('div', { class: 'banco', role: 'group', 'aria-label': 'Palabras para usar' }, barajar(ej.banco, ej.id).map(function (w) {
          return el('button', { type: 'button', text: w, 'aria-label': 'Escribir «' + w + '»', onclick: function () {
            var dest = (ultimo && !ultimo.value) ? ultimo : inputs.filter(function (x) { return !x.value; })[0] || ultimo;
            if (dest) { dest.value = w; dest.focus(); }
          } });
        })));
      }
      ej.items.forEach(function (it, i) {
        var inp = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Hueco ' + (i + 1) + ': ' + it.antes + ' … ' + it.despues });
        inp.addEventListener('focus', function () { ultimo = inp; });
        inputs.push(inp);
        caja.appendChild(el('p', { class: 'hueco item', 'data-i': i }, [it.antes + (/[«(¿¡]$/.test(it.antes) ? '' : ' '), inp, (/^[.,;:!?»)]/.test(it.despues) ? '' : ' ') + it.despues]));
      });
      var res = acciones(caja, function () {
        limpiar(caja);
        var sin = inputs.filter(function (x) { return !x.value.trim(); }).length;
        if (sin) return faltan(res, sin);
        var bien = 0;
        ej.items.forEach(function (it, i) {
          var p = caja.querySelector('.hueco[data-i="' + i + '"]'), c = comparar(inputs[i].value, it.respuesta);
          if (c) bien++;
          p.classList.add(c ? 'ok' : 'mal');
          p.appendChild(c && c !== 'ok' ? fb('nota', '¡Correcto! Un detalle: se escribe «' + c.casi + '», ' + c.motivo + '. ' + it.explicacion)
            : fb(c ? 'ok' : 'mal', (c ? '¡Bien! ' : 'La palabra es «' + it.respuesta[0] + '». ') + it.explicacion));
        });
        sonido(bien === ej.items.length);
        res.textContent = nota(bien, ej.items.length); api.puntos(bien); api.listo();
      });
    },

    reflexion: function (caja, ej, L, api) {
      var clave = 'lecturas:' + (L.id || param) + ':' + (ej.id || 'reflexion');
      var min = ej.minimo_caracteres || 20;
      var guardado = '';
      try { guardado = localStorage.getItem(clave) || ''; } catch (e) {}
      var idT = 'ta-' + (ej.id || 'r');
      caja.appendChild(el('label', { for: idT, class: 'preg', style: 'display:block;font-weight:600;margin-bottom:.4rem', text: ej.pregunta }));
      if (ej.ayuda) caja.appendChild(el('ul', { class: 'ayudas', 'aria-label': 'Frases que te pueden ayudar' }, ej.ayuda.map(function (a) { return el('li', { text: a }); })));
      var ta = el('textarea', { id: idT, 'aria-describedby': idT + '-c' });
      ta.value = guardado;
      var cont = el('p', { class: 'contador', id: idT + '-c' });
      var btn = el('button', { type: 'button', class: 'btn', text: 'Ver una respuesta modelo' });
      var modelo = el('div', { class: 'modelo', hidden: true, tabindex: '-1' }, [
        el('p', {}, [el('strong', { text: 'Una respuesta posible:' })]), el('p', { text: ej.modelo }), ej.guia ? el('p', { class: 'contador', text: ej.guia }) : null]);
      function act() {
        var n = ta.value.trim().length;
        btn.disabled = n < min;
        cont.textContent = n < min ? 'Escribe un poco más para ver la respuesta modelo (' + n + '/' + min + ').' : 'Tu respuesta se guarda solo en este dispositivo.';
        try { localStorage.setItem(clave, ta.value); } catch (e) {}
      }
      ta.addEventListener('input', act);
      btn.addEventListener('click', function () { modelo.hidden = false; api.puntos(1); api.listo(); sonido(true); modelo.focus(); });
      caja.appendChild(ta); caja.appendChild(cont);
      caja.appendChild(el('div', { class: 'acciones' }, [btn]));
      caja.appendChild(modelo);
      act();
    }
  };

  // toque fiable en pantallas táctiles (pointerup) sin perder el clic de ratón/teclado
  function alTocar(n, fn) {
    var t = 0, ini = null;
    n.addEventListener('pointerdown', function (e) { ini = (e.pointerType !== 'mouse') ? { x: e.clientX, y: e.clientY } : null; });
    n.addEventListener('pointerup', function (e) {
      if (!ini) return;
      var lejos = Math.abs(e.clientX - ini.x) + Math.abs(e.clientY - ini.y) > 10; ini = null;
      if (!lejos) { t = Date.now(); fn(); }
    });
    n.addEventListener('click', function () { if (Date.now() - t < 700) return; fn(); });
  }
  // parecido entre palabras (cada palabra del modelo debe aparecer, con pequeñas diferencias)
  function parecidoPalabras(oido, modelo) {
    var o = sinTildes(norm(oido)).split(' '), m = sinTildes(norm(modelo)).split(' ');
    var hits = m.filter(function (w) { return o.some(function (x) { return parecido(x, w) >= 0.75; }); }).length;
    return hits / m.length;
  }
  // parecido entre dos frases (0–1), sin tildes ni puntuación
  function parecido(a, b) {
    a = sinTildes(norm(a)); b = sinTildes(norm(b));
    if (!a || !b) return 0;
    if (a === b) return 1;
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[m][n] / Math.max(m, n);
  }
})();
