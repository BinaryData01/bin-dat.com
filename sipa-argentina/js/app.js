/* Dashboard SIPA — v2 con filtro por período presidencial */
(function () {
  'use strict';

  const D = SIPA_DATA;
  const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const label = k => {
    const [y, m] = k.split('-');
    return `${MESES_ES[+m - 1]}-${y.slice(2)}`;
  };

  const fmtMiles = v => v.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const fmtPct = v => (v > 0 ? '+' : '') + v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

  const PALETTE = [
    '#4f8dff', '#38c3ea', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#94a3b8', '#f472b6'
  ];

  Chart.defaults.font.family = '"Segoe UI", system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#94a6bd';
  Chart.defaults.borderColor = '#243349';
  Chart.defaults.plugins.legend.labels.boxWidth = 14;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10,18,32,.95)';
  Chart.defaults.plugins.tooltip.borderColor = '#334155';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = '#e8eef7';
  Chart.defaults.plugins.tooltip.bodyColor = '#c9d6e8';
  Chart.defaults.plugins.tooltip.padding = 10;

  const fmtTick = (v, suffix) => v.toLocaleString('es-AR', { maximumFractionDigits: 1 }) + (suffix || '');
  const baseTooltip = suffix => ({
    callbacks: {
      label: c => {
        const v = (typeof c.parsed === 'object')
          ? (c.chart.options.indexAxis === 'y' ? c.parsed.x : c.parsed.y) : c.parsed;
        return ` ${c.dataset.label}: ${fmtTick(v, suffix)}`;
      }
    }
  });

  const lineOpts = (extra) => Object.assign({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: { x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } }, y: {} }
  }, extra || {});

  const series = (obj, field) => Object.keys(obj).map(k => obj[k][field]);
  const keys = obj => Object.keys(obj);

  // Personas: las series vienen en miles -> se muestran en millones
  const toMill = v => v == null ? null : Math.round((v / 1000) * 1000) / 1000;
  const toMillArr = arr => arr.map(toMill);
  const tooltipMill = {
    callbacks: {
      label: c => {
        const v = (typeof c.parsed === 'object')
          ? (c.chart.options.indexAxis === 'y' ? c.parsed.x : c.parsed.y) : c.parsed;
        return ` ${c.dataset.label}: ${v.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} millones`;
      }
    }
  };
  const AXIS_MILL = { title: { display: true, text: 'Millones de personas' } };

  const MOD_DEFS = [
    ['privados', 'Asalariados privados', PALETTE[0]],
    ['publicos', 'Asalariados públicos', PALETTE[1]],
    ['casas_particulares', 'Casas particulares', PALETTE[6]],
    ['monotributistas', 'Monotributistas', PALETTE[2]],
    ['autonomos', 'Autónomos', PALETTE[3]],
    ['monotributo_social', 'Monotributo social', PALETTE[4]],
  ];

  /* ============ Filtro por período presidencial ============ */
  const PERIODOS = {
    historico: { from: null, to: null, nombre: 'Histórico' },
    milei:     { from: '2023-12', to: null, nombre: 'Milei' },
    fernandez: { from: '2019-12', to: '2023-12', nombre: 'A. Fernández' },
    macri:     { from: '2015-12', to: '2019-12', nombre: 'Macri' },
    cfk:       { from: '2007-12', to: '2015-12', nombre: 'C. F. de Kirchner' },
  };
  let periodo = PERIODOS.historico;

  const inRange = k => (!periodo.from || k >= periodo.from) && (!periodo.to || k <= periodo.to);
  const filtrar = keysAll => keysAll.filter(inRange);
  const lastIn = keysAll => { const f = filtrar(keysAll); return f[f.length - 1]; };

  // charts vivos para destruir al recambiar
  let charts = [];
  function mk(id, cfg) {
    const el = document.getElementById(id);
    if (!el) return null;
    const ch = new Chart(el, cfg);
    charts.push(ch);
    return ch;
  }

  /* ============ KPIs ============ */
  function renderKPIs() {
    const last = lastIn(keys(D.total));
    if (!last) return;
    const t = D.total[last];
    const lastP = lastIn(keys(D.privado));
    const p = D.privado[lastP];
    const mods = D.modalidades;
    let mAct = mods[last] || mods[Object.keys(mods).filter(inRange).pop()];
    if (!mAct) mAct = { publicos: null, monotributistas: null };
    const lastModKey = Object.keys(mods).filter(inRange).pop();
    mAct = mods[lastModKey];
    const mPrev = mods[`${+lastModKey.slice(0, 4) - 1}${lastModKey.slice(4)}`];
    const lastRem = lastIn(keys(D.rem_media));
    const remM = D.rem_media[lastRem];

    const fmtMill = miles => miles == null ? '—'
      : (miles / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' millones';
    const viaMod = slug => {
      const a = mAct && mAct[slug], b = mPrev && mPrev[slug];
      return (a && b) ? Math.round(((a / b) - 1) * 1000) / 10 : null;
    };
    const viaPub = viaMod('publicos');
    const viaMono = viaMod('monotributistas');
    const clsOf = v => v == null ? '' : (v >= 0 ? 'pos' : 'neg');

    const cards = [
      { label: `Trabajadores Registrados (${label(last)})`, value: fmtMill(t.o),
        delta: `mensual ${fmtPct(t.vm)} · interanual ${fmtPct(t.va)}`, cls: clsOf(t.va) },
      { label: `Asalariados Privados (${label(lastP)})`, value: fmtMill(p.o),
        delta: `interanual ${fmtPct(p.va)}`, cls: clsOf(p.va) },
      { label: 'Asalariados Públicos', value: fmtMill(mAct && mAct.publicos),
        delta: viaPub !== null ? `interanual ${fmtPct(viaPub)}` : 'sin dato interanual', cls: clsOf(viaPub) },
      { label: 'Monotributistas', value: fmtMill(mAct && mAct.monotributistas),
        delta: viaMono !== null ? `interanual ${fmtPct(viaMono)}` : 'trabajo independiente', cls: clsOf(viaMono) },
      { label: `Remuneración Media Privada (${label(lastRem)})`, value: remM ? '$' + fmtMiles(Math.round(remM.v)) : '—',
        delta: remM && remM.va != null ? `interanual ${fmtPct(remM.va)}` : '', cls: clsOf(remM && remM.va) },
    ];
    document.getElementById('kpis').innerHTML = cards.map(c => `
      <div class="kpi">
        <div class="label">${c.label}</div>
        <div class="value">${c.value}</div>
        <div class="delta ${c.cls}">${c.delta}</div>
      </div>`).join('');
  }

  /* ============ Gráficos principales ============ */
  function renderCharts() {
    const tKeys = filtrar(keys(D.total));

    mk('chTotal', {
      type: 'line',
      data: {
        labels: tKeys.map(label),
        datasets: [
          { label: 'Serie original', data: toMillArr(tKeys.map(k => D.total[k].o)), borderColor: PALETTE[0], backgroundColor: 'rgba(79,141,255,.12)', fill: true, tension: .25, pointRadius: 0, borderWidth: 2 },
          { label: 'Desestacionalizada', data: toMillArr(tKeys.map(k => D.total[k].d)), borderColor: PALETTE[1], borderDash: [5, 4], tension: .25, pointRadius: 0, borderWidth: 2 },
        ]
      },
      options: Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill },
        scales: { x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } }, y: Object.assign({ grace: '5%' }, AXIS_MILL) }
      })
    });

    // Variaciones: en modo histórico solo desde ene-2021 para legibilidad
    const varKeys = tKeys.filter(k => periodo.from ? true : k >= '2021-01');
    mk('chVarM', {
      type: 'bar',
      data: {
        labels: varKeys.map(label),
        datasets: [{
          label: 'Var. mensual desest.', data: varKeys.map(k => D.total[k].vm),
          backgroundColor: varKeys.map(k => D.total[k].vm >= 0 ? '#4f8dff' : '#f87171'),
          borderRadius: 2
        }]
      },
      options: Object.assign(lineOpts(), {
        plugins: { tooltip: baseTooltip('%'), legend: { display: false } },
        scales: { x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } }, y: { ticks: { callback: v => v + '%' }, grace: '15%' } }
      })
    });

    mk('chVarA', {
      type: 'line',
      data: {
        labels: varKeys.map(label),
        datasets: [
          { label: 'Total registrados', data: varKeys.map(k => D.total[k].va), borderColor: PALETTE[0], tension: .25, pointRadius: 0, borderWidth: 2 },
          { label: 'Asalariados privados', data: varKeys.map(k => D.privado[k] ? D.privado[k].va : null), borderColor: PALETTE[3], tension: .25, pointRadius: 0, borderWidth: 2 },
        ]
      },
      options: Object.assign(lineOpts(), {
        plugins: { tooltip: baseTooltip('%') },
        scales: { x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } }, y: { ticks: { callback: v => v + '%' }, grace: '15%' } }
      })
    });

    const pKeys = filtrar(keys(D.privado));
    mk('chPriv', {
      type: 'line',
      data: {
        labels: pKeys.map(label),
        datasets: [
          { label: 'Serie original', data: toMillArr(pKeys.map(k => D.privado[k].o)), borderColor: PALETTE[4], backgroundColor: 'rgba(248,113,113,.08)', fill: true, tension: .25, pointRadius: 0, borderWidth: 2 },
          { label: 'Desestacionalizada', data: toMillArr(pKeys.map(k => D.privado[k].d)), borderColor: PALETTE[3], borderDash: [5, 4], tension: .25, pointRadius: 0, borderWidth: 2 },
        ]
      },
      options: Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill },
        scales: { x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } }, y: Object.assign({ grace: '5%' }, AXIS_MILL) }
      })
    });

    const modKeys = filtrar(keys(D.modalidades));
    mk('chMod', {
      type: 'line',
      data: {
        labels: modKeys.map(label),
        datasets: MOD_DEFS.map(([slug, name, color]) => ({
          label: name, data: toMillArr(modKeys.map(k => D.modalidades[k][slug])),
          borderColor: color, tension: .25, pointRadius: 0, borderWidth: 2
        }))
      },
      options: Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill },
        scales: { x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } }, y: Object.assign({ grace: '5%' }, AXIS_MILL) }
      })
    });

    mk('chIndep', {
      type: 'line',
      data: {
        labels: modKeys.map(label),
        datasets: MOD_DEFS.slice(3).map(([slug, name, color]) => ({
          label: name, data: toMillArr(modKeys.map(k => D.modalidades[k][slug])),
          borderColor: color, tension: .25, pointRadius: 0, borderWidth: 2
        }))
      },
      options: Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill },
        scales: { x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } }, y: Object.assign({ grace: '8%' }, AXIS_MILL) }
      })
    });

    // Composicion al final del período filtrado
    const lastModKey = modKeys[modKeys.length - 1];
    const lastMod = D.modalidades[lastModKey] || {};
    mk('chComp', {
      type: 'doughnut',
      data: {
        labels: MOD_DEFS.map(d => d[1]),
        datasets: [{
          data: MOD_DEFS.map(([slug]) => toMill(lastMod[slug] || 0)),
          backgroundColor: MOD_DEFS.map(d => d[2]),
          borderWidth: 2, borderColor: '#16202f'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '55%',
        plugins: {
          legend: { position: 'right' },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} millones` } }
        }
      }
    });

    // Remuneraciones
    const remKeys = filtrar(keys(D.rem_media));
    mk('chRem', {
      type: 'line',
      data: {
        labels: remKeys.map(label),
        datasets: [
          { label: 'Media', data: remKeys.map(k => D.rem_media[k].v), borderColor: PALETTE[0], tension: .25, pointRadius: 0, borderWidth: 2 },
          { label: 'Mediana', data: remKeys.map(k => D.rem_mediana[k] ? D.rem_mediana[k].v : null), borderColor: PALETTE[2], tension: .25, pointRadius: 0, borderWidth: 2 },
        ]
      },
      options: Object.assign(lineOpts(), {
        plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: $${c.parsed.y == null ? '—' : c.parsed.y.toLocaleString('es-AR')}` } } },
        scales: {
          x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } },
          y: { type: 'logarithmic', ticks: { callback: v => '$' + Number(v).toLocaleString('es-AR') } }
        }
      })
    });

    mk('chRemVa', {
      type: 'line',
      data: {
        labels: remKeys.map(label),
        datasets: [
          { label: 'Media', data: remKeys.map(k => D.rem_media[k].va), borderColor: PALETTE[0], tension: .25, pointRadius: 0, borderWidth: 2 },
          { label: 'Mediana', data: remKeys.map(k => D.rem_mediana[k] ? D.rem_mediana[k].va : null), borderColor: PALETTE[2], tension: .25, pointRadius: 0, borderWidth: 2 },
        ]
      },
      options: Object.assign(lineOpts(), {
        plugins: { tooltip: baseTooltip('%') },
        scales: { x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } }, y: { ticks: { callback: v => v + '%' } } }
      })
    });
  }

  /* ============ Ramas / Provincias: snapshot al final del período ============ */
  let ramasMode = 'n', provMode = 'n';
  let chRamas = null, chProv = null;

  function snapshotFrom(hist, fechas) {
    // último mes disponible dentro del rango para la serie histórica
    const f = fechas.filter(inRange);
    const end = f[f.length - 1];
    const endIdx = fechas.indexOf(end);
    const antIdx = endIdx - 12;
    const rows = [];
    for (const n of hist.names) {
      if (n === 'Total' || n === 'Sin especificar') continue;
      const act = endIdx >= 0 ? hist.data[n][endIdx] : null;
      const ant = antIdx >= 0 ? hist.data[n][antIdx] : null;
      rows.push({
        nombre: n, n_act: act, n_ant: ant,
        via: (act && ant) ? Math.round((act / ant - 1) * 1000) / 10 : null,
        end
      });
    }
    return { rows: rows.filter(r => r.n_act != null), end };
  }

  function renderRamas() {
    if (chRamas) { chRamas.destroy(); chRamas = null; }
    const { rows: base, end } = snapshotFrom(D.ramas_hist, D.ramas_hist.fechas);
    const isVar = ramasMode === 'v';
    const rows = isVar ? base.slice().sort((a, b) => (b.via ?? -99) - (a.via ?? -99))
                       : base.slice().sort((a, b) => b.n_act - a.n_act);
    const prevK = `${+end.slice(0, 4) - 1}${end.slice(4)}`;
    chRamas = new Chart(document.getElementById('chRamas'), {
      type: 'bar',
      data: {
        labels: rows.map(r => r.nombre),
        datasets: isVar ? [{
          label: `Var. interanual (%) a ${label(end)}`, data: rows.map(r => r.via),
          backgroundColor: rows.map(r => (r.via ?? 0) >= 0 ? '#34d399' : '#f87171'), borderRadius: 3
        }] : [
          { label: label(end), data: rows.map(r => toMill(r.n_act)), backgroundColor: PALETTE[0], borderRadius: 3 },
          { label: label(prevK), data: rows.map(r => toMill(r.n_ant)), backgroundColor: '#33507e', borderRadius: 3 },
        ]
      },
      options: Object.assign(lineOpts(), {
        indexAxis: 'y',
        plugins: { tooltip: isVar ? baseTooltip('%') : tooltipMill },
        scales: { x: Object.assign({ ticks: { callback: v => isVar ? v + '%' : v }, grace: '8%' }, isVar ? {} : { title: { display: true, text: 'Millones de personas' } }) }
      })
    });
    charts.push(chRamas);
  }

  function renderProv() {
    if (chProv) { chProv.destroy(); chProv = null; }
    const { rows: base, end } = snapshotFrom(D.prov_hist, D.prov_hist.fechas);
    const isVar = provMode === 'v';
    const rows = isVar ? base.slice().sort((a, b) => (b.via ?? -99) - (a.via ?? -99))
                       : base.slice().sort((a, b) => b.n_act - a.n_act);
    chProv = new Chart(document.getElementById('chProv'), {
      type: 'bar',
      data: {
        labels: rows.map(r => r.nombre),
        datasets: isVar ? [{
          label: `Var. interanual (%) a ${label(end)}`, data: rows.map(r => r.via),
          backgroundColor: rows.map(r => (r.via ?? 0) >= 0 ? '#34d399' : '#f87171'), borderRadius: 3
        }] : [{
          label: `${label(end)} (millones)`, data: rows.map(r => toMill(r.n_act)),
          backgroundColor: PALETTE[1], borderRadius: 3
        }]
      },
      options: Object.assign(lineOpts(), {
        indexAxis: 'y',
        plugins: { tooltip: isVar ? baseTooltip('%') : tooltipMill },
        scales: { x: Object.assign({ ticks: { callback: v => isVar ? v + '%' : v }, grace: '8%' }, isVar ? {} : { title: { display: true, text: 'Millones de personas' } }) }
      })
    });
    charts.push(chProv);
  }

  /* ============ Series históricas por rama / provincia ============ */
  function histChart(canvasId, hist, topN) {
    const fechas = hist.fechas;
    const fIdx = fechas.map((f, i) => i).filter(i => inRange(fechas[i]));
    const labelsF = fIdx.map(i => fechas[i]);
    const ranked = hist.names
      .filter(n => n !== 'Total' && n !== 'Sin especificar')
      .map(n => {
        const arr = hist.data[n];
        const vals = fIdx.map(i => arr[i]);
        const lastV = [...vals].reverse().find(v => v != null) || 0;
        return { n, lastV, vals };
      })
      .sort((a, b) => b.lastV - a.lastV);
    const short = n => n.length > 38 ? n.slice(0, 36) + '…' : n;
    mk(canvasId, {
      type: 'line',
      data: {
        labels: labelsF.map(label),
        datasets: ranked.map((r, i) => ({
          label: short(r.n),
          data: toMillArr(r.vals),
          borderColor: PALETTE[i % PALETTE.length],
          tension: .25, pointRadius: 0, borderWidth: 1.8,
          hidden: i >= topN
        }))
      },
      options: Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill, legend: { labels: { boxWidth: 12 } } },
        scales: { x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } }, y: Object.assign({ grace: '5%' }, AXIS_MILL) }
      })
    });
  }

  /* ============ Tabla ============ */
  function renderTable() {
    const tks = filtrar(keys(D.total)).slice().reverse();
    let html = '<thead><tr><th>Mes</th><th>Serie original</th><th>Desestacionalizada</th><th>Var. mensual</th><th>Var. interanual (miles)</th><th>Var. interanual (%)</th></tr></thead><tbody>';
    for (const k of tks) {
      const r = D.total[k];
      const cls = v => v < 0 ? 'neg' : 'pos';
      html += `<tr><td>${label(k)}</td><td>${(r.o / 1000).toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>` +
        `<td>${(r.d / 1000).toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>` +
        `<td class="${cls(r.vm)}">${r.vm == null ? '—' : fmtPct(r.vm)}</td>` +
        `<td class="${cls(r.va_abs)}">${r.va_abs == null ? '—' : r.va_abs.toLocaleString('es-AR')}</td>` +
        `<td class="${cls(r.va)}">${r.va == null ? '—' : fmtPct(r.va)}</td></tr>`;
    }
    document.getElementById('tblData').innerHTML = html + '</tbody>';
  }

  /* ============ Balance del período presidencial ============ */
  function renderBalance() {
    const card = document.getElementById('balance-card');
    if (!card) return;
    if (!periodo.from) { card.hidden = true; return; }
    card.hidden = false;

    const tKeys = keys(D.total);
    const end = lastIn(tKeys);
    // si el período arranca antes que la serie, usar el primer mes disponible
    const firstGe = (keysArr) => keysArr.find(k => k >= periodo.from && k <= end) || null;
    const startTotal = firstGe(tKeys);
    const startPriv = firstGe(keys(D.privado));
    const startMod = firstGe(keys(D.modalidades));
    const hayMod = startMod != null;

    const fmtMil = v => (v > 0 ? '+' : '') + v.toLocaleString('es-AR', { maximumFractionDigits: 0 }) + ' mil';
    const fmtVal = v => (v / 1000).toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' M';
    const cls = v => v < 0 ? 'neg' : 'pos';

    const filas = [];
    const add = (nombre, ini, fin) => {
      if (ini == null || fin == null) return;
      filas.push({ nombre, ini, fin, abs: fin - ini, pct: Math.round((fin / ini - 1) * 1000) / 10 });
    };

    if (startTotal) add('Trabajadores registrados (total)', D.total[startTotal].o, D.total[end].o);
    if (startPriv && D.privado[end]) add('Asalariados privados', D.privado[startPriv].o, D.privado[end].o);
    if (hayMod && D.modalidades[end]) {
      const i = D.modalidades[startMod], f = D.modalidades[end];
      add('Asalariados públicos', i.publicos, f.publicos);
      add('Casas particulares', i.casas_particulares, f.casas_particulares);
      add('Monotributistas', i.monotributistas, f.monotributistas);
      add('Autónomos', i.autonomos, f.autonomos);
      add('Monotributo social', i.monotributo_social, f.monotributo_social);
    }

    const iniRef = startTotal || periodo.from;
    let html = '<thead><tr><th>Variable</th><th>' + label(iniRef) + '</th><th>' + label(end) + '</th><th>Variación absoluta</th><th>Variación %</th></tr></thead><tbody>';
    for (const r of filas) {
      html += `<tr><td>${r.nombre}</td><td>${fmtVal(r.ini)}</td><td>${fmtVal(r.fin)}</td>` +
        `<td class="${cls(r.abs)}">${fmtMil(r.abs)}</td><td class="${cls(r.pct)}">${fmtPct(r.pct)}</td></tr>`;
    }
    document.getElementById('balance-tabla').innerHTML = html + '</tbody>';
    document.getElementById('balance-titulo').textContent = `Balance del período — ${periodo.nombre}`;
    document.getElementById('balance-nota').textContent =
      `De ${label(iniRef)} a ${label(end)}. Variaciones absolutas en miles de personas.` +
      (hayMod ? (startMod !== iniRef ? ` Modalidades desde ${label(startMod)}.` : '')
              : ' Sin desglose por modalidad en este período.');
  }

  /* ============ Notas dinámicas por período ============ */
  const noteBases = {};
  function setNote(id, suffix) {
    const el = document.querySelector(`[data-note="${id}"]`);
    if (!el) return;
    if (!noteBases[id]) noteBases[id] = el.textContent.trim();
    el.textContent = `${noteBases[id]} ${suffix}`;
  }
  function rangoTxt(keysAll) {
    const f = filtrar(keysAll);
    if (!f.length) return '';
    return `Período: ${label(f[0])} a ${label(f[f.length - 1])}.`;
  }
  function updateNotes() {
    const tKeys = keys(D.total);
    const pKeys = keys(D.privado);
    const mKeys = keys(D.modalidades);
    const rKeys = keys(D.rem_media);

    setNote('total', rangoTxt(tKeys));
    // las variaciones en modo histórico arrancan en 2021-01 por legibilidad
    const varKeysAll = tKeys.filter(k => periodo.from ? true : k >= '2021-01');
    setNote('varm', rangoTxt(varKeysAll));
    setNote('vara', rangoTxt(varKeysAll));
    setNote('priv', rangoTxt(pKeys));
    setNote('mod', rangoTxt(mKeys));
    setNote('indep', rangoTxt(mKeys));
    const mF = filtrar(mKeys);
    setNote('comp', `Período: composición a ${label(mF[mF.length - 1])}.`);
    setNote('rem', rangoTxt(rKeys));
    setNote('remva', rangoTxt(rKeys));
    const hF = filtrar(D.ramas_hist.fechas);
    const hEnd = hF[hF.length - 1];
    const hPrev = `${+hEnd.slice(0, 4) - 1}${hEnd.slice(4)}`;
    setNote('ramas', `Período: datos a ${label(hEnd)} (variación interanual vs ${label(hPrev)}).`);
    setNote('prov', `Período: datos a ${label(hEnd)} (variación interanual vs ${label(hPrev)}).`);
    setNote('ramashist', rangoTxt(D.ramas_hist.fechas));
    setNote('provhist', rangoTxt(D.prov_hist.fechas));
    setNote('tabla', rangoTxt(tKeys));
  }

  /* ============ Render general ============ */
  function renderAll() {
    charts.forEach(c => c.destroy());
    charts = [];
    chRamas = chProv = null;
    renderKPIs();
    renderBalance();
    renderCharts();
    renderRamas();
    renderProv();
    histChart('chRamasHist', D.ramas_hist, 6);
    histChart('chProvHist', D.prov_hist, 8);
    renderTable();
    updateNotes();

    // notas dinámicas
    const nota = document.getElementById('periodo-nota');
    if (nota) {
      nota.textContent = periodo.from
        ? `Período: ${label(lastIn(keys(D.total)) && periodo.from)} a ${label(lastIn(keys(D.total)))} — ${periodo.nombre}`
        : 'Serie completa disponible (ene-2009 a jun-2026 según variable).';
    }
  }

  /* ============ Toggles rama/provincia ============ */
  function toggle(btnOn, btnOff, cb) {
    document.getElementById(btnOn).addEventListener('click', function () {
      this.classList.add('active');
      document.getElementById(btnOff).classList.remove('active');
      cb();
    });
  }
  toggle('btnRamasN', 'btnRamasV', () => { ramasMode = 'n'; renderRamas(); });
  toggle('btnRamasV', 'btnRamasN', () => { ramasMode = 'v'; renderRamas(); });
  toggle('btnProvN', 'btnProvV', () => { provMode = 'n'; renderProv(); });
  toggle('btnProvV', 'btnProvN', () => { provMode = 'v'; renderProv(); });

  /* ============ Selector de período ============ */
  document.querySelectorAll('#periodo-bar [data-periodo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#periodo-bar .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      periodo = PERIODOS[btn.dataset.periodo];
      renderAll();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  renderAll();
})();
