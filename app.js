var botones = document.querySelectorAll('nav button');
var vistas = document.querySelectorAll('.vista');
botones.forEach(function (b) {
  b.addEventListener('click', function () {
    botones.forEach(function (x) { x.classList.remove('activo'); });
    vistas.forEach(function (v) { v.classList.remove('activa'); });
    b.classList.add('activo');
    document.getElementById(b.dataset.vista).classList.add('activa');
    document.querySelector('main').scrollTop = 0;
    if (b.dataset.vista === 'calendario') pintarCalendario();
  });
});

var TIPOS = {
  confirmada: { texto: 'Confirmada', clase: '' },
  rumor: { texto: 'Rumor', clase: 'rumor' },
  opinion: { texto: 'Opinión', clase: 'opinion' }
};

var TODAS = [];
var seccionActiva = 'Todas';
var CAL = [];
var compActiva = 'Todas';
var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

var DIAS_VIGENCIA = 5;

// Una noticia se oculta cuando han pasado DIAS_VIGENCIA dias desde su fecha.
// "fija": true la mantiene siempre; "dias": N cambia su duracion.
// Sin fecha valida (dd/mm/aaaa) nunca caduca.
function vigente(n) {
  if (!n || n.fija === true) return true;
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(n.fecha || ''));
  if (!m) return true;
  var f = new Date(+m[3], +m[2] - 1, +m[1]);
  if (isNaN(f.getTime())) return true;
  var dias = parseInt(n.dias, 10);
  if (!(dias > 0)) dias = DIAS_VIGENCIA;
  var hoy = new Date();
  hoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  var edad = Math.round((hoy - f) / 86400000);
  return edad < dias;
}

function crear(tag, clase, texto) {
  var el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;
  return el;
}

// Estilo del boton Compartir (va aqui para no tocar index.html)
(function () {
  var estilo = document.createElement('style');
  estilo.textContent =
    '.compartir{margin-top:10px;padding:6px 14px;font-size:.85rem;' +
    'background:transparent;color:inherit;cursor:pointer;' +
    'border:1px solid rgba(128,128,128,.55);border-radius:999px;}';
  document.head.appendChild(estilo);
})();

function compartirNoticia(n) {
  var url = (n.enlace && String(n.enlace).indexOf('https://') === 0)
    ? n.enlace
    : 'https://tienecohone-bit.github.io/lobo-blanco/';
  var datos = {
    title: n.titulo || 'LOBO BLANCO',
    text: (n.titulo || '') + ' - LOBO BLANCO',
    url: url
  };
  if (navigator.share) {
    navigator.share(datos).catch(function () {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(datos.text + ' ' + url)
      .then(function () { alert('Enlace copiado'); })
      .catch(function () {});
  }
}

function crearTarjeta(n) {
  var t = crear('article', 'tarjeta');
  if (n.imagen) {
    var img = crear('img');
    img.src = n.imagen;
    img.alt = n.titulo || '';
    img.loading = 'lazy';
    t.appendChild(img);
  }
  var c = crear('div', 'cuerpo');
  var et = crear('div', 'etiquetas');
  var tipo = TIPOS[n.tipo] || TIPOS.confirmada;
  et.appendChild(crear('span', 'etiqueta ' + tipo.clase, tipo.texto));
  if (n.seccion) et.appendChild(crear('span', 'etiqueta', n.seccion));
  c.appendChild(et);
  c.appendChild(crear('h3', '', n.titulo || ''));
  c.appendChild(crear('p', '', n.resumen || ''));

  if (n.texto) {
    var completo = crear('div', 'texto');
    String(n.texto).split('\n').forEach(function (parrafo) {
      if (parrafo.trim()) completo.appendChild(crear('p', '', parrafo));
    });
    c.appendChild(completo);
    var leer = crear('div', 'leer', 'Leer más ▾');
    c.appendChild(leer);
    t.classList.add('conTexto');
    t.addEventListener('click', function () {
      var abierta = t.classList.toggle('abierta');
      leer.textContent = abierta ? 'Cerrar ▴' : 'Leer más ▾';
    });
  }

  if (n.enlace && String(n.enlace).indexOf('https://') === 0) {
    var a = crear('a', 'enlace', 'Ver contenido →');
    a.href = n.enlace;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.addEventListener('click', function (e) { e.stopPropagation(); });
    c.appendChild(a);
  }

  var comp = crear('button', 'compartir', 'Compartir ↗');
  comp.type = 'button';
  comp.addEventListener('click', function (e) {
    e.stopPropagation();
    compartirNoticia(n);
  });
  c.appendChild(comp);

  var meta = [];
  if (n.fecha) meta.push(n.fecha);
  if (n.fuente) meta.push('Fuente: ' + n.fuente);
  if (meta.length) c.appendChild(crear('div', 'meta', meta.join(' · ')));
  t.appendChild(c);
  return t;
}

function pintarFiltros() {
  var cont = document.getElementById('filtros');
  cont.innerHTML = '';
  var secciones = ['Todas'];
  TODAS.forEach(function (n) {
    if (n.seccion && secciones.indexOf(n.seccion) === -1) secciones.push(n.seccion);
  });
  if (secciones.length < 2) return;
  secciones.forEach(function (s) {
    var b = crear('button', s === seccionActiva ? 'activo' : '', s);
    b.addEventListener('click', function () {
      seccionActiva = s;
      pintarFiltros();
      pintarNoticias();
    });
    cont.appendChild(b);
  });
}

function pintarNoticias() {
  var cont = document.getElementById('noticias');
  var aviso = document.getElementById('aviso-portada');
  cont.innerHTML = '';
  var lista = TODAS.filter(function (n) {
    return seccionActiva === 'Todas' || n.seccion === seccionActiva;
  });
  if (lista.length === 0) {
    aviso.textContent = 'En construcción. Todavía no hay noticias publicadas.';
    aviso.style.display = 'block';
    return;
  }
  aviso.style.display = 'none';
  lista.forEach(function (n) { cont.appendChild(crearTarjeta(n)); });
}

function pintarSeccion(nombre, idLista, idAviso) {
  var cont = document.getElementById(idLista);
  var aviso = document.getElementById(idAviso);
  cont.innerHTML = '';
  var lista = TODAS.filter(function (n) { return n.seccion === nombre; });
  if (lista.length === 0) {
    aviso.style.display = 'block';
    return;
  }
  aviso.style.display = 'none';
  lista.forEach(function (n) { cont.appendChild(crearTarjeta(n)); });
}

function pintarEnlaces(datos) {
  var cont = document.getElementById('enlaces-interes');
  var titulo = document.getElementById('bloque-enlaces');
  cont.innerHTML = '';
  var validos = (Array.isArray(datos) ? datos : []).filter(function (e) {
    return e && e.nombre && e.enlace && String(e.enlace).indexOf('https://') === 0;
  });
  if (validos.length === 0) {
    titulo.style.display = 'none';
    return;
  }
  titulo.style.display = 'block';

  var categorias = [];
  validos.forEach(function (e) {
    var cat = e.categoria || 'Otros';
    if (categorias.indexOf(cat) === -1) categorias.push(cat);
  });

  categorias.forEach(function (cat) {
    cont.appendChild(crear('div', 'cat', cat));
    var ul = crear('ul', 'lista');
    validos.filter(function (e) { return (e.categoria || 'Otros') === cat; })
      .forEach(function (e) {
        var li = crear('li');
        var a = crear('a');
        a.href = e.enlace;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        var info = crear('span', 'info');
        var nombre = e.nombre + (e.plataforma ? ' · ' + e.plataforma : '');
        info.appendChild(crear('span', '', nombre));
        if (e.descripcion) info.appendChild(crear('span', 'desc', e.descripcion));
        a.appendChild(info);
        a.appendChild(crear('span', 'ir', 'Abrir →'));
        li.appendChild(a);
        ul.appendChild(li);
      });
    cont.appendChild(ul);
  });
}

function pad(n) { return (n < 10 ? '0' : '') + n; }

function hoyISO() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function fechaObj(iso) {
  var p = iso.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

function diasHasta(iso) {
  return Math.round((fechaObj(iso) - fechaObj(hoyISO())) / 86400000);
}

function textoDias(n) {
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  return 'En ' + n + ' días';
}

function textoFecha(iso) {
  var d = fechaObj(iso);
  return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
}

function enlaceCalendario(e) {
  var p = e.fecha.split('-');
  var ymd = p[0] + p[1] + p[2];
  var fechas;
  if (e.hora && /^\d{2}:\d{2}$/.test(e.hora)) {
    var h = e.hora.split(':');
    var hf = parseInt(h[0], 10) + 2;
    var fin = hf < 24 ? pad(hf) + h[1] + '00' : '235900';
    fechas = ymd + 'T' + h[0] + h[1] + '00/' + ymd + 'T' + fin;
  } else {
    var d = fechaObj(e.fecha);
    d.setDate(d.getDate() + 1);
    fechas = ymd + '/' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }
  var detalle = (e.detalle ? e.detalle + ' ' : '') + 'Horario peninsular; puede cambiar. Fuente: LOBO BLANCO.';
  var titulo = e.titulo + (e.competicion ? ' (' + e.competicion + ')' : '');
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(titulo) +
    '&dates=' + fechas +
    '&ctz=' + encodeURIComponent('Europe/Madrid') +
    '&details=' + encodeURIComponent(detalle) +
    (e.lugar ? '&location=' + encodeURIComponent(e.lugar) : '');
}

function botonAnadir(e) {
  var a = crear('a', 'cal-add', 'Añadir a mi calendario');
  a.href = enlaceCalendario(e);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function pintarCalendario() {
  var proxCont = document.getElementById('cal-proximo');
  var filtros = document.getElementById('cal-filtros');
  var lista = document.getElementById('cal-lista');
  var aviso = document.getElementById('aviso-calendario');
  proxCont.innerHTML = '';
  filtros.innerHTML = '';
  lista.innerHTML = '';

  var hoy = hoyISO();
  var futuros = CAL.filter(function (e) {
    return e && e.titulo && /^\d{4}-\d{2}-\d{2}$/.test(String(e.fecha)) && e.fecha >= hoy;
  }).sort(function (a, b) {
    var ka = a.fecha + ' ' + (a.hora || '00:00');
    var kb = b.fecha + ' ' + (b.hora || '00:00');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  if (futuros.length === 0) {
    aviso.textContent = 'No hay fechas próximas en el calendario.';
    aviso.style.display = 'block';
    return;
  }
  aviso.style.display = 'none';

  var prox = futuros.filter(function (e) { return e.tipo === 'partido'; })[0];
  if (prox) {
    var c = crear('div', 'cal-prox');
    c.appendChild(crear('div', 'etq', 'Próximo partido'));
    c.appendChild(crear('h3', '', prox.titulo));
    var cuando = [textoFecha(prox.fecha)];
    if (prox.hora) cuando.push(prox.hora + ' h');
    if (prox.competicion) cuando.push(prox.competicion);
    if (prox.sede) cuando.push(prox.sede);
    c.appendChild(crear('div', 'cuando', cuando.join(' · ')));
    c.appendChild(crear('div', 'cuenta', textoDias(diasHasta(prox.fecha))));
    c.appendChild(botonAnadir(prox));
    proxCont.appendChild(c);
  }

  var comps = ['Todas'];
  futuros.forEach(function (e) {
    if (e.competicion && comps.indexOf(e.competicion) === -1) comps.push(e.competicion);
  });
  if (comps.indexOf(compActiva) === -1) compActiva = 'Todas';
  if (comps.length > 1) {
    comps.forEach(function (cp) {
      var b = crear('button', cp === compActiva ? 'activo' : '', cp);
      b.addEventListener('click', function () {
        compActiva = cp;
        pintarCalendario();
      });
      filtros.appendChild(b);
    });
  }

  var visibles = futuros.filter(function (e) {
    return compActiva === 'Todas' || e.competicion === compActiva;
  });

  var mesActual = '';
  visibles.forEach(function (e) {
    var mes = e.fecha.slice(0, 7);
    if (mes !== mesActual) {
      mesActual = mes;
      var m = mes.split('-');
      lista.appendChild(crear('div', 'cal-mes', MESES[parseInt(m[1], 10) - 1] + ' ' + m[0]));
    }
    var it = crear('div', 'cal-item');
    var f = fechaObj(e.fecha);
    var dia = crear('div', 'cal-dia');
    dia.appendChild(crear('div', 'num', String(f.getDate())));
    dia.appendChild(crear('div', 'sem', DIAS[f.getDay()]));
    var info = crear('div', 'cal-info');
    info.appendChild(crear('h4', '', e.titulo));
    var meta = [];
    if (e.competicion) meta.push(e.competicion);
    if (e.hora) meta.push(e.hora + ' h');
    if (e.sede) meta.push(e.sede);
    if (e.lugar) meta.push(e.lugar);
    if (meta.length) info.appendChild(crear('div', 'cal-meta', meta.join(' · ')));
    if (e.detalle) {
      info.appendChild(crear('div', /confirmar/i.test(e.detalle) ? 'cal-nota' : 'cal-meta', e.detalle));
    }
    info.appendChild(crear('span', 'cal-tag', textoDias(diasHasta(e.fecha))));
    info.appendChild(botonAnadir(e));
    it.appendChild(dia);
    it.appendChild(info);
    lista.appendChild(it);
  });
}

fetch('noticias.json', { cache: 'no-cache' })
  .then(function (r) { return r.json(); })
  .then(function (datos) {
    TODAS = (Array.isArray(datos) ? datos : []).filter(vigente);
    pintarFiltros();
    pintarNoticias();
    pintarSeccion('Real Madrid', 'noticias-madrid', 'aviso-madrid');
    pintarSeccion('Análisis', 'noticias-analisis', 'aviso-analisis');
    pintarSeccion('Multimedia', 'noticias-multimedia', 'aviso-multimedia');
  })
  .catch(function () {
    var aviso = document.getElementById('aviso-portada');
    aviso.textContent = 'No se han podido cargar las noticias. Comprueba tu conexión.';
  });

fetch('enlaces.json', { cache: 'no-cache' })
  .then(function (r) { return r.json(); })
  .then(pintarEnlaces)
  .catch(function () {});

fetch('calendario.json', { cache: 'no-cache' })
  .then(function (r) { return r.json(); })
  .then(function (datos) {
    CAL = Array.isArray(datos) ? datos : [];
    pintarCalendario();
  })
  .catch(function () {
    var aviso = document.getElementById('aviso-calendario');
    aviso.textContent = 'No se ha podido cargar el calendario. Comprueba tu conexión.';
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js');
  });
}
