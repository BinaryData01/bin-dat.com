/* Mapa coroplético de asalariados privados por provincia.
   Render SVG propio (sin dependencias). Se integra con el filtro presidencial. */
(function () {
  'use strict';
  if (typeof AR_GEO === 'undefined' || typeof SIPA_DATA === 'undefined') return;

  const D = SIPA_DATA;
  const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const label = k => { const [y, m] = k.split('-'); return `${MESES_ES[+m - 1]}-${y.slice(2)}`; };

  const box = document.getElementById('mapa-svg-box');
  const rankBox = document.getElementById('mapa-ranking');
  const legend = document.getElementById('mapa-leyenda');
  const slider = document.getElementById('fechSlider');
  const lblFec = document.getElementById('fechaActual');
  const btnFecAnt = document.getElementById('btnFecAnt');
  const btnFecSig = document.getElementById('btnFecSig');
  const btnFecPlay = document.getElementById('btnFecPlay');
  const fecPeriodo = document.getElementById('fecPeriodo');
  const btnN = document.getElementById('btnMapN');
  const btnV = document.getElementById('btnMapV');
  const noteEl = document.querySelector('[data-note="mapa"]');
  const noteBase = noteEl ? noteEl.textContent.trim() : '';
  if (!box || !rankBox || !slider || !lblFec) return;

  /* ---------- Geometría ---------- */
  const LON0 = -73.57, LON1 = -53.64, LAT0 = -55.06, LAT1 = -21.78;
  const SY = 20;                      // px por grado de latitud
  const SX = SY * Math.cos(35 * Math.PI / 180); // compensa la proyección
  const W = (LON1 - LON0) * SX;
  const H = (LAT1 - LAT0) * SY;
  const px = lon => (lon - LON0) * SX;
  const py = lat => (LAT1 - lat) * SY;

  function ringPath(ring) {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
      d += (i ? ' L' : 'M') + px(ring[i][0]).toFixed(2) + ',' + py(ring[i][1]).toFixed(2);
    }
    return d + ' Z';
  }
  function featurePath(f) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    return polys.map(poly => poly.map(ringPath).join(' ')).join(' ');
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `-2 -2 ${W + 4} ${H + 4}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('id', 'map-geo-svg');

  function splitTierraDelFuego(feature) {
    // Separa el archipiélago de las Islas Malvinas (sin datos, simbólicas)
    // del resto de la provincia de Tierra del Fuego.
    const g = feature.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const main = [], malv = [];
    for (const poly of polys) {
      let maxLon = -Infinity;
      for (const ring of poly) for (const c of ring) if (c[0] > maxLon) maxLon = c[0];
      (maxLon > -63.0 ? malv : main).push(poly);
    }
    const wrap = arr => ({ type: 'MultiPolygon', coordinates: arr });
    return { main: wrap(main), malv: wrap(malv) };
  }

  const pathByName = {};
  for (const f of AR_GEO.features) {
    const name = f.properties.name;
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', featurePath(f));
    p.setAttribute('class', 'prov-path');
    p.dataset.prov = name;
    svg.appendChild(p);
    pathByName[name] = p;

    if (name === 'Tierra del Fuego') {
      const { main, malv } = splitTierraDelFuego(f);
      p.setAttribute('d', featurePath({ geometry: main }));
      // Islas Malvinas: símbolo fijo gris, sin datos ni interacción
      const pm = document.createElementNS(SVGNS, 'path');
      pm.setAttribute('d', featurePath({ geometry: malv }));
      pm.setAttribute('class', 'prov-malvinas');
      pm.setAttribute('fill', '#3a4a63');
      pm.setAttribute('stroke', '#0d1522');
      pm.setAttribute('stroke-width', '1.2');
      pm.setAttribute('pointer-events', 'none');
      const t = document.createElementNS(SVGNS, 'title');
      t.textContent = 'Islas Malvinas';
      pm.appendChild(t);
      svg.appendChild(pm);
    }
  }
  box.appendChild(svg);

  /* ---------- Estado ---------- */
  let modo = 'n';
  const fechas = D.prov_hist.fechas;
  let mes = fechas[fechas.length - 1];
  lblFec.textContent = label(mes);

  /* ---------- Colores ---------- */
  const lerp = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
  const hex = rgb => '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
  const CELESTE = [125, 211, 252];   // menor (nivel)
  const AZUL_OSC = [11, 45, 92];     // mayor (nivel)

  // bins nivel, en miles de personas
  const binsNivel = [
    { min: 2000, t: 1.00, txt: 'Más de 2,0 M' },
    { min: 1000, t: 0.80, txt: '1,0–2,0 M' },
    { min: 500,  t: 0.60, txt: '500 mil – 1 M' },
    { min: 250,  t: 0.40, txt: '250–500 mil' },
    { min: 100,  t: 0.22, txt: '100–250 mil' },
    { min: -Infinity, t: 0.08, txt: 'Menos de 100 mil' },
  ];
  const colorNivel = miles => hex(lerp(CELESTE, AZUL_OSC, binsNivel.find(b => miles >= b.min).t));

  // bins variación interanual (%)
  const binsVar = [
    { min: 3, rgb: [16, 122, 74], txt: '≥ +3%' },
    { min: 0, rgb: [52, 211, 153], txt: '0 a +3%' },
    { min: -3, rgb: [248, 113, 113], txt: '−3 a 0%' },
    { min: -Infinity, rgb: [153, 27, 27], txt: '≤ −3%' },
  ];
  const colorVar = v => (v == null) ? '#3a4a63' : hex(binsVar.find(b => v >= b.min).rgb);

  /* ---------- Render ---------- */
  const fmtM = v => v == null ? '—' : (v / 1000).toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' M';
  const fmtP = v => v == null ? '—' : (v > 0 ? '+' : '') + v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

  function datosActuales() {
    const idx = fechas.indexOf(mes);
    const idxAnt = idx - 12;
    const rows = [];
    for (const n of D.prov_hist.names) {
      const act = D.prov_hist.data[n][idx];
      const ant = idxAnt >= 0 ? D.prov_hist.data[n][idxAnt] : null;
      const via = (act != null && ant) ? (act / ant - 1) * 100 : null;
      rows.push({ n, act, via });
    }
    return rows;
  }

  let highlight = null;
  function setHL(name) {
    if (highlight === name) return;
    highlight = name;
    Object.values(pathByName).forEach(p => p.classList.remove('hl'));
    rankBox.querySelectorAll('.rank-row').forEach(r => r.classList.remove('hl'));
    if (name) {
      pathByName[name] && pathByName[name].classList.add('hl');
      const r = rankBox.querySelector(`[data-prov="${CSS.escape(name)}"]`);
      r && r.classList.add('hl');
      svg.removeChild(pathByName[name]); // subir el path para que el borde no quede tapado
      svg.appendChild(pathByName[name]);
    }
  }

  function render() {
    const rows = datosActuales();
    const isVar = modo === 'v';
    const getVal = r => isVar ? r.via : r.act;
    rows.sort((a, b) => (getVal(b) ?? -Infinity) - (getVal(a) ?? -Infinity));

    // colores mapa + tooltip
    for (const r of rows) {
      const p = pathByName[r.n];
      if (!p) continue;
      const col = isVar ? colorVar(r.via) : colorNivel(r.act ?? 0);
      p.setAttribute('fill', col);
      p.innerHTML = '';
      const t = document.createElementNS(SVGNS, 'title');
      t.textContent = `${r.n}: ${isVar ? fmtP(r.via) : fmtM(r.act)} (${label(mes)})`;
      p.appendChild(t);
    }

    // leyenda
    legend.innerHTML = (isVar ? binsVar : binsNivel).map(b =>
      `<span class="leyenda-item"><span class="leyenda-swatch" style="background:${isVar ? hex(b.rgb) : hex(lerp(CELESTE, AZUL_OSC, b.t))}"></span>${b.txt}</span>`
    ).join('');

    // ranking
    const maxAbs = Math.max(1e-9, ...rows.map(r => Math.abs(getVal(r) ?? 0)));
    rankBox.innerHTML = '';
    rows.forEach((r, i) => {
      const v = getVal(r);
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.dataset.prov = r.n;
      const w = v == null ? 0 : Math.max(2, Math.abs(v) / maxAbs * 100);
      const color = isVar ? colorVar(r.via) : colorNivel(r.act ?? 0);
      row.innerHTML =
        `<span class="rank-num">${i + 1}</span>` +
        `<span class="rank-nom">${r.n}</span>` +
        `<span class="rank-bar-bg"><span class="rank-bar" style="display:block;width:${w.toFixed(1)}%;background:${color}"></span></span>` +
        `<span class="rank-val">${isVar ? fmtP(v) : fmtM(v)}</span>`;
      row.addEventListener('mouseenter', () => setHL(r.n));
      row.addEventListener('mouseleave', () => setHL(null));
      rankBox.appendChild(row);
    });

    // nota
    if (noteEl) {
      noteEl.textContent = `${noteBase.replace(/\s*Período:.*$/, '')} Período: ${label(mes)}` +
        (isVar ? ' (variación interanual).' : '.');
    }
  }

  /* ---------- Reproducción temporal ---------- */
  let playing = false;
  let playTimer = null;
  const PLAY_MS = 250;
  const IDX_MIN = fechas.indexOf('2010-01'); // la variación interanual requiere 12 meses previos

  function bMinMax(per) {
    const rangos = {
      milei: ['2023-12', null],
      fernandez: ['2019-12', '2023-12'],
      macri: ['2015-12', '2019-12'],
      cfk: ['2007-12', '2015-12'],
      historico: [null, null],
    };
    const [from, to] = rangos[per] || [null, null];
    let lo = from ? fechas.findIndex(f => f >= from) : 0;
    if (lo < 0) lo = 0;
    if (lo < IDX_MIN) lo = IDX_MIN;
    let hi = fechas.length - 1;
    if (to) {
      const exact = fechas.lastIndexOf(to);
      if (exact >= 0) hi = exact;
      else { const j = fechas.findIndex(f => f > to); if (j >= 0) hi = j - 1; }
    }
    return [lo, hi];
  }

  function applyRango(per) {
    const [lo, hi] = bMinMax(per);
    const idx = fechas.indexOf(mes);
    const cur = idx >= lo && idx <= hi ? idx : hi;
    mes = fechas[cur];
    slider.min = lo;
    slider.max = hi;
    slider.value = cur;
    lblFec.textContent = label(mes);
    updatePeriodo();
    pause();
    render();
  }

  function setMes(m) {
    mes = m;
    slider.value = fechas.indexOf(mes);
    lblFec.textContent = label(mes);
    updatePeriodo();
    render();
  }

  function periodoDe(k) {
    if (k >= '2023-12') return 'J. Milei';
    if (k >= '2019-12') return 'A. Fernández';
    if (k >= '2015-12') return 'M. Macri';
    return 'CFK';
  }

  function updatePeriodo() {
    if (fecPeriodo) fecPeriodo.textContent = periodoDe(mes);
  }

  function pause() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    playing = false;
    btnFecPlay.textContent = '▶';
    btnFecPlay.title = 'Reproducir';
  }

  function play() {
    const hi = +slider.max;
    let idx = fechas.indexOf(mes);
    if (idx >= hi) idx = +slider.min - 1; // en el final: reinicia desde el inicio del rango
    pause();
    playing = true;
    btnFecPlay.textContent = '⏸';
    btnFecPlay.title = 'Pausar';
    playTimer = setInterval(() => {
      idx++;
      if (idx > hi) { setMes(fechas[hi]); pause(); return; }
      setMes(fechas[idx]);
    }, PLAY_MS);
  }

  /* ---------- Eventos ---------- */
  svg.addEventListener('mousemove', e => {
    const t = e.target;
    setHL(t && t.dataset && t.dataset.prov ? t.dataset.prov : null);
  });
  svg.addEventListener('mouseleave', () => setHL(null));

  btnN.addEventListener('click', () => { modo = 'n'; btnN.classList.add('active'); btnV.classList.remove('active'); render(); });
  btnV.addEventListener('click', () => { modo = 'v'; btnV.classList.add('active'); btnN.classList.remove('active'); render(); });
  slider.addEventListener('input', () => { pause(); setMes(fechas[+slider.value]); });
  btnFecAnt.addEventListener('click', () => {
    pause();
    const idx = fechas.indexOf(mes);
    setMes(fechas[Math.max(+slider.min, idx - 1)]);
  });
  btnFecSig.addEventListener('click', () => {
    pause();
    const idx = fechas.indexOf(mes);
    setMes(fechas[Math.min(+slider.max, idx + 1)]);
  });
  btnFecPlay.addEventListener('click', () => { playing ? pause() : play(); });

  // sync con filtro presidencial (app.js corre primero porque se carga antes)
  document.querySelectorAll('#periodo-bar [data-periodo]').forEach(btn => {
    btn.addEventListener('click', () => applyRango(btn.dataset.periodo));
  });

  applyRango('historico');
})();
