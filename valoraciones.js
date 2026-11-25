// Valoraciones de noticias (estrellas 1-5) con Firebase Firestore.
// Se carga despues de app.js y anade las estrellas a cada tarjeta de noticia.
(function () {
  var CONFIG = {
    apiKey: "AIzaSyDI_fNA9XnoAUk9azXan8BytplNB53WWJE",
    authDomain: "lobo-blanco-7a1e9.firebaseapp.com",
    projectId: "lobo-blanco-7a1e9",
    storageBucket: "lobo-blanco-7a1e9.firebasestorage.app",
    messagingSenderId: "135757931953",
    appId: "1:135757931953:web:36f487b97c83689a864990"
  };
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var COLECCION = 'valoraciones';
  var CLAVE_LOCAL = 'lb_votos';

  if (typeof crearTarjeta !== 'function') return;

  var css =
    '.lb-val{margin-top:12px;border-top:1px solid #2a2a2a;padding-top:10px}' +
    '.lb-estrellas{display:flex;gap:4px}' +
    '.lb-estrellas button{background:none;border:none;font-size:1.7rem;line-height:1;color:#555;padding:2px 3px;cursor:pointer}' +
    '.lb-estrellas button.on{color:#d4af37}' +
    '.lb-info{color:#999;font-size:0.8rem;margin-top:6px;line-height:1.4}';
  var estilo = document.createElement('style');
  estilo.textContent = css;
  document.head.appendChild(estilo);

  var fbPromesa = null;
  function firebase() {
    if (fbPromesa) return fbPromesa;
    fbPromesa = Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js')
    ]).then(function (m) {
      var app = m[0].initializeApp(CONFIG);
      var auth = m[1].getAuth(app);
      var db = m[2].getFirestore(app);
      return new Promise(function (resolve, reject) {
        var llamado = false;
        var off = null;
        off = m[1].onAuthStateChanged(auth, function (u) {
          if (llamado) return;
          llamado = true;
          if (off) off();
          if (u) {
            resolve({ db: db, uid: u.uid, f: m[2] });
          } else {
            m[1].signInAnonymously(auth).then(function (c) {
              resolve({ db: db, uid: c.user.uid, f: m[2] });
            }, reject);
          }
        });
      });
    });
    fbPromesa.catch(function () { fbPromesa = null; });
    return fbPromesa;
  }

  function leerVotos() {
    try { return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '{}') || {}; } catch (e) { return {}; }
  }
  function guardarVoto(id, v) {
    try {
      var o = leerVotos();
      o[id] = v;
      localStorage.setItem(CLAVE_LOCAL, JSON.stringify(o));
    } catch (e) {}
  }

  // Identificador estable de cada noticia: el campo "id" si existe; si no, titulo + fecha.
  function idNoticia(n) {
    var base = n && n.id ? String(n.id) : String((n && n.titulo) || '') + '|' + String((n && n.fecha) || '');
    var slug = base.toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
    var h = 5381;
    for (var i = 0; i < base.length; i++) {
      h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
    }
    return (slug || 'noticia') + '-' + h.toString(36);
  }

  var cache = {};
  function stats(id) {
    var c = cache[id];
    if (c && Date.now() - c.t < 60000) return c.p;
    var p = firebase().then(function (fb) {
      var f = fb.f;
      var q = f.query(f.collection(fb.db, COLECCION), f.where('noticia', '==', id));
      return f.getAggregateFromServer(q, { n: f.count(), suma: f.sum('valor') })
        .then(function (s) {
          var d = s.data();
          return { n: d.n || 0, suma: d.suma || 0 };
        })
        .catch(function () {
          // Si el indice aun no esta listo, se cuentan los votos uno a uno.
          return f.getDocs(q).then(function (s) {
            var n = 0, suma = 0;
            s.forEach(function (d) {
              var v = d.data().valor;
              if (typeof v === 'number') { n++; suma += v; }
            });
            return { n: n, suma: suma };
          });
        });
    });
    cache[id] = { t: Date.now(), p: p };
    p.catch(function () { delete cache[id]; });
    return p;
  }

  function crearValoracion(n) {
    var id = idNoticia(n);
    var caja = document.createElement('div');
    caja.className = 'lb-val';
    var fila = document.createElement('div');
    fila.className = 'lb-estrellas';
    var info = document.createElement('div');
    info.className = 'lb-info';
    var miVoto = leerVotos()[id] || 0;
    var botones = [];

    function pintar() {
      botones.forEach(function (b, i) { b.className = i < miVoto ? 'on' : ''; });
    }

    function cargar() {
      stats(id).then(function (s) {
        var t = s.n
          ? 'Media ' + (s.suma / s.n).toFixed(1).replace('.', ',') + ' · ' + s.n + (s.n === 1 ? ' voto' : ' votos')
          : 'Sé el primero en puntuar';
        if (miVoto) t += ' · Tu voto: ' + miVoto;
        info.textContent = t;
      }).catch(function () {
        info.textContent = 'Valoraciones no disponibles ahora';
      });
    }

    function votar(v) {
      info.textContent = 'Guardando tu voto...';
      firebase().then(function (fb) {
        return fb.f.setDoc(fb.f.doc(fb.db, COLECCION, id + '__' + fb.uid), { noticia: id, uid: fb.uid, valor: v });
      }).then(function () {
        miVoto = v;
        guardarVoto(id, v);
        pintar();
        delete cache[id];
        cargar();
      }).catch(function () {
        info.textContent = 'No se pudo guardar tu voto. Inténtalo más tarde.';
      });
    }

    for (var i = 1; i <= 5; i++) {
      (function (v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = '★';
        b.setAttribute('aria-label', 'Puntuar con ' + v + (v === 1 ? ' estrella' : ' estrellas'));
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          votar(v);
        });
        fila.appendChild(b);
        botones.push(b);
      })(i);
    }
    pintar();
    info.textContent = 'Cargando valoraciones...';
    cargar();
    caja.appendChild(fila);
    caja.appendChild(info);
    caja.addEventListener('click', function (e) { e.stopPropagation(); });
    return caja;
  }

  var tarjetaOriginal = crearTarjeta;
  crearTarjeta = function (n) {
    var t = tarjetaOriginal(n);
    try {
      var c = t.querySelector('.cuerpo');
      if (c) c.appendChild(crearValoracion(n));
    } catch (e) {}
    return t;
  };
})();
