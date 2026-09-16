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

  // Tooltip fijo en el vértice superior izquierdo del área del gráfico,
// mostrando únicamente el punto seleccionado.
  const fixedBinds = new WeakMap();
  // Índice (categoría) bajo el cursor; síncrono y sin depender del hover de Chart.js
  const pickIndex = (c, e) => {
    const horizontal = c.options && c.options.indexAxis === 'y';
    if (c.config && c.config.type === 'doughnut') return pickArcIndex(c, e);
    const idxS = horizontal ? c.scales.y : c.scales.x;
    if (!idxS) return null;
    let idx = Math.round(idxS.getValueForPixel(horizontal ? e.offsetY : e.offsetX));
    const n = (c.data.labels || []).length;
    if (!n) return null;
    if (idx < 0) idx = 0;
    if (idx >= n) idx = n - 1;
    return idx;
  };
  const pickArcIndex = (c, e) => {
    const arcs = c.getDatasetMeta(0).data;
    const cent = arcs.filter(a => a && isFinite(a.x) && isFinite(a.y))[0];
    if (!cent) return null;
    let ang = Math.atan2(e.offsetY - cent.y, e.offsetX - cent.x);
    if (ang < 0) ang += 2 * Math.PI;
    const norm = a => (a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    for (let i = 0; i < arcs.length; i++) {
      const a = arcs[i];
      if (a == null || !isFinite(a.x)) continue;
      let s = norm(a.startAngle), en = norm(a.endAngle);
      if (en < s) en += 2 * Math.PI;
      if (ang >= s && ang <= en) return i;
    }
    return null;
  };
  function bindFixedTip(chart, pos) {
    const canvas = chart.canvas;
    const prev = fixedBinds.get(canvas);
    if (prev) { prev.chart = chart; prev.pos = pos || 'tl'; if (prev.div) prev.div.style.opacity = 0; return; }
    const state = { div: null, chart, pos: pos || 'tl' };
    fixedBinds.set(canvas, state);
    const ensure = () => {
      if (state.div) return state.div;
      const wrap = state.chart.canvas.parentElement;
      let d = wrap.querySelector('.chart-fixed-tip');
      if (!d) {
        d = document.createElement('div');
        d.className = 'chart-fixed-tip';
        if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
        wrap.appendChild(d);
      }
      state.div = d;
      return d;
    };
    const update = e => {
      const c = state.chart;
      if (!c.chartArea || !c.scales) { if (state.div) state.div.style.opacity = 0; return; }
      const idx = pickIndex(c, e);
      if (idx == null) { if (state.div) state.div.style.opacity = 0; return; }
      const isArc = (c.config && c.config.type === 'doughnut');
      const rows = [];
      let cab;
      if (isArc) {
        const ds = c.data.datasets[0];
        const lab = c.data.labels && c.data.labels[idx];
        const rawV = ds.data && ds.data[idx];
        cab = lab == null ? '' : lab;
        rows.push({ col: ds.borderColor || '#4f8dff', txt: fmtVal(c, ds, 0, idx, rawV, true) });
      } else {
        cab = (c.data.labels && c.data.labels[idx]) == null ? '' : c.data.labels[idx];
        for (let i = 0; i < c.data.datasets.length; i++) {
          if (!c.isDatasetVisible(i)) continue;
          const ds = c.data.datasets[i];
          const v = ds.data && ds.data[idx];
          if (v == null || !isFinite(v)) continue;
          rows.push({ col: ds.borderColor || '#4f8dff', txt: fmtVal(c, ds, i, idx, v, false) });
        }
      }
      if (!rows.length) { if (state.div) state.div.style.opacity = 0; return; }
      const div = ensure();
      const ca = c.chartArea;
      div.innerHTML =
        `<div class="cft-t">${cab}</div>` +
        rows.map(r =>
          `<div class="cft-row"><span class="cft-dot" style="background:${r.col}"></span><span class="cft-lbl">${r.txt}</span></div>`
        ).join('');
      const w = div.offsetWidth, h = div.offsetHeight;
      const m = 8, p = state.pos;
      if (p === 'bl') {
        div.style.left = Math.max(0, ca.left + m) + 'px';
        div.style.top = Math.max(ca.top + m, ca.bottom - h - m) + 'px';
      } else if (p === 'br') {
        div.style.left = Math.max(ca.left + m, ca.right - w - m) + 'px';
        div.style.top = Math.max(ca.top + m, ca.bottom - h - m) + 'px';
      } else {
        div.style.left = Math.max(0, ca.left + m) + 'px';
        div.style.top = Math.max(0, ca.top + m) + 'px';
      }
      div.style.opacity = 1;
    };
    const fmtVal = (c, ds, dsIdx, idx, v, isArc) => {
      const cb = c.options.plugins.tooltip &&
        c.options.plugins.tooltip.callbacks && c.options.plugins.tooltip.callbacks.label;
      if (typeof cb === 'function') {
        try {
          const lab = c.data.labels && c.data.labels[idx];
          return String(cb({ chart: c, dataset: ds, datasetIndex: dsIdx, dataIndex: idx,
                             label: lab, raw: v, parsed: isArc ? v : { x: lab, y: v } }));
        } catch (e) { /* fallthrough */ }
      }
      return ds.label && ds.label + ': ' + v.toLocaleString('es-AR');
    };
    const hide = () => { if (state.div) state.div.style.opacity = 0; };
    ['pointermove', 'mousemove'].forEach(t => canvas.addEventListener(t, update));
    ['pointerleave', 'mouseleave'].forEach(t => canvas.addEventListener(t, hide));
  }

  const withFixedTip = opts => {
    opts.interaction = { mode: 'nearest', intersect: false };
    opts.plugins = opts.plugins || {};
    opts.plugins.tooltip = Object.assign(
      { mode: 'nearest', intersect: false, enabled: false, external: () => {} },
      opts.plugins.tooltip || {}
    );
    return opts;
  };
  const hoverPunto = color => ({
    pointRadius: 0, pointHitRadius: 20,
    pointHoverRadius: 3.5, pointHoverBorderWidth: 2,
    pointHoverBackgroundColor: '#ffffff', pointHoverBorderColor: color
  });

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
  let sparkGid = 0;
  function sparkSVG(serie, color) {
    const pts = serie.filter(v => v != null && isFinite(v));
    if (!pts.length) return '';
    let min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    if (max === min) { max = min + 1; min = min - 1; }
    const W = 100, H = 30, pad = 1.5;
    const x = i => pts.length === 1 ? W / 2 : pad + (W - 2 * pad) * i / (pts.length - 1);
    const y = v => H - pad - (H - 2 * pad) * (v - min) / (max - min);
    const coords = pts.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const id = 'sg' + (++sparkGid);
    const poly = pts.length > 1
      ? `<polygon points="0,${H} ${coords} ${W},${H}" fill="url(#${id})"/>` : '';
    const line = pts.length > 1
      ? `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>` : '';
    const lx = x(pts.length - 1).toFixed(2), ly = y(pts[pts.length - 1]).toFixed(2);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".32"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>${poly}${line}<circle cx="${lx}" cy="${ly}" r="2" fill="${color}"/>
    </svg>`;
  }

  function renderKPIs() {
    const lastP = lastIn(keys(D.privado));
    if (!lastP) return;
    const p = D.privado[lastP];
    const mods = D.modalidades;
    const lastModKey = Object.keys(mods).filter(inRange).pop();
    const mAct = mods[lastModKey] || { publicos: null, monotributistas: null, monotributo_social: null };
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
    const monoSum = m => (m && m.monotributistas != null && m.monotributo_social != null)
      ? m.monotributistas + m.monotributo_social : null;
    const mActMono = mAct ? monoSum(mAct) : null;
    const mPrevMono = mPrev ? monoSum(mPrev) : null;
    const viaMono = (mActMono != null && mPrevMono != null)
      ? Math.round(((mActMono / mPrevMono) - 1) * 1000) / 10 : null;
    const clsOf = v => v == null ? '' : (v >= 0 ? 'pos' : 'neg');

    const privSer = keys(D.privado).filter(inRange).map(k => D.privado[k].o);
    const pubSer = keys(mods).filter(inRange).map(k => mods[k].publicos);
    const monoSer = keys(mods).filter(inRange).map(k => monoSum(mods[k]));
    const remSer = keys(D.rem_media).filter(inRange).map(k => D.rem_media[k].v);

    const AZUL = PALETTE[0];
    const cards = [
      { label: `Asalariados Privados (${label(lastP)})`, value: fmtMill(p.o),
        delta: `interanual ${fmtPct(p.va)}`, cls: clsOf(p.va), spark: sparkSVG(privSer, AZUL) },
      { label: 'Asalariados Públicos', value: fmtMill(mAct && mAct.publicos),
        delta: viaPub !== null ? `interanual ${fmtPct(viaPub)}` : 'sin dato interanual', cls: clsOf(viaPub), spark: sparkSVG(pubSer, AZUL) },
      { label: 'Monotributistas', value: fmtMill(mActMono),
        delta: viaMono !== null ? `interanual ${fmtPct(viaMono)}` : 'trabajo independiente', cls: clsOf(viaMono), spark: sparkSVG(monoSer, AZUL) },
      { label: 'Remuneración Media Privada', value: remM ? '$' + fmtMiles(Math.round(remM.v)) : '—',
        delta: remM && remM.va != null ? `interanual ${fmtPct(remM.va)}` : '', cls: clsOf(remM && remM.va), spark: sparkSVG(remSer, AZUL) },
    ];
    document.getElementById('kpis').innerHTML = cards.map(c => `
      <div class="kpi">
        <div class="label">${c.label}</div>
        <div class="value">${c.value}</div>
        <div class="delta ${c.cls}">${c.delta}</div>
        <div class="kpi-spark">${c.spark}</div>
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
          { label: 'Serie original', data: toMillArr(tKeys.map(k => D.total[k].o)), borderColor: PALETTE[0], backgroundColor: 'rgba(79,141,255,.12)', fill: true, tension: .25, borderWidth: 2, ...hoverPunto(PALETTE[0]) },
          { label: 'Desestacionalizada', data: toMillArr(tKeys.map(k => D.total[k].d)), borderColor: PALETTE[1], borderDash: [5, 4], tension: .25, borderWidth: 2, ...hoverPunto(PALETTE[1]) },
        ]
      },
      options: withFixedTip(Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill },
        scales: { x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } }, y: Object.assign({ grace: '5%' }, AXIS_MILL) }
      }))
    });

    // Variaciones: en modo histórico solo desde ene-2021 para legibilidad
    const varKeys = tKeys.filter(k => periodo.from ? true : k >= '2021-01');
    mk('chVarM', {
      type: 'bar',
      data: {
        labels: varKeys.map(label),
        datasets: [{
          label: 'Var. mensual desest.', data: varKeys.map(k => D.total[k].vm),
          backgroundColor: varKeys.map(k => (D.total[k].vm ?? 0) >= 0 ? '#34d399' : '#f87171'),
          borderRadius: 2
        }]
      },
      options: withFixedTip(Object.assign(lineOpts(), {
        plugins: { tooltip: baseTooltip('%'), legend: { display: false } },
        scales: { x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } }, y: { ticks: { callback: v => v + '%' }, grace: '15%', min: -3 } }
      }))
    });

    mk('chVarA', {
      type: 'line',
      data: {
        labels: varKeys.map(label),
        datasets: [
          { label: 'Total registrados', data: varKeys.map(k => D.total[k].va), borderColor: PALETTE[0], tension: .25, pointRadius: 0, borderWidth: 2, ...hoverPunto(PALETTE[0]) },
          { label: 'Asalariados privados', data: varKeys.map(k => D.privado[k] ? D.privado[k].va : null), borderColor: PALETTE[1], tension: .25, pointRadius: 0, borderWidth: 2, ...hoverPunto(PALETTE[1]) },
        ]
      },
      options: withFixedTip(Object.assign(lineOpts(), {
        plugins: { tooltip: baseTooltip('%') },
        scales: { x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } }, y: { ticks: { callback: v => v + '%' }, grace: '15%', min: -6, max: 6 } }
      }))
    });

    const pKeys = filtrar(keys(D.privado));
    mk('chPriv', {
      type: 'line',
      data: {
        labels: pKeys.map(label),
        datasets: [
          { label: 'Serie original', data: toMillArr(pKeys.map(k => D.privado[k].o)), borderColor: PALETTE[4], backgroundColor: 'rgba(248,113,113,.08)', fill: true, tension: .25, borderWidth: 2, ...hoverPunto(PALETTE[4]) },
          { label: 'Desestacionalizada', data: toMillArr(pKeys.map(k => D.privado[k].d)), borderColor: PALETTE[3], borderDash: [5, 4], tension: .25, borderWidth: 2, ...hoverPunto(PALETTE[3]) },
        ]
      },
      options: withFixedTip(Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill },
        scales: { x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } }, y: Object.assign({ grace: '5%' }, AXIS_MILL) }
      }))
    });

    const modKeys = filtrar(keys(D.modalidades));
    mk('chMod', {
      type: 'line',
      data: {
        labels: modKeys.map(label),
        datasets: MOD_DEFS.map(([slug, name, color]) => ({
          label: name, data: toMillArr(modKeys.map(k => D.modalidades[k][slug])),
          borderColor: color, tension: .25, pointRadius: 0, borderWidth: 2, ...hoverPunto(color)
        }))
      },
      options: withFixedTip(Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill },
        scales: { x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } }, y: Object.assign({ grace: '5%' }, AXIS_MILL) }
      }))
    });

    mk('chIndep', {
      type: 'line',
      data: {
        labels: modKeys.map(label),
        datasets: MOD_DEFS.slice(3).map(([slug, name, color]) => ({
          label: name, data: toMillArr(modKeys.map(k => D.modalidades[k][slug])),
          borderColor: color, tension: .25, pointRadius: 0, borderWidth: 2, ...hoverPunto(color)
        }))
      },
      options: withFixedTip(Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill },
        scales: { x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } }, y: Object.assign({ grace: '8%' }, AXIS_MILL) }
      }))
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
          { label: 'Media', data: remKeys.map(k => D.rem_media[k].v), borderColor: PALETTE[0], tension: .25, borderWidth: 2, ...hoverPunto(PALETTE[0]) },
          { label: 'Mediana', data: remKeys.map(k => D.rem_mediana[k] ? D.rem_mediana[k].v : null), borderColor: PALETTE[1], tension: .25, borderWidth: 2, ...hoverPunto(PALETTE[1]) },
        ]
      },
      options: withFixedTip(Object.assign(lineOpts(), {
        plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: $${c.parsed.y == null ? '—' : c.parsed.y.toLocaleString('es-AR')}` } } },
        scales: {
          x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } },
          y: { type: 'logarithmic', ticks: { callback: v => '$' + Number(v).toLocaleString('es-AR') } }
        }
      }))
    });

    mk('chRemVa', {
      type: 'line',
      data: {
        labels: remKeys.map(label),
        datasets: [
          { label: 'Media', data: remKeys.map(k => D.rem_media[k].va), borderColor: PALETTE[0], tension: .25, borderWidth: 2, ...hoverPunto(PALETTE[0]) },
          { label: 'Mediana', data: remKeys.map(k => D.rem_mediana[k] ? D.rem_mediana[k].va : null), borderColor: PALETTE[1], tension: .25, borderWidth: 2, ...hoverPunto(PALETTE[1]) },
        ]
      },
      options: withFixedTip(Object.assign(lineOpts(), {
        plugins: { tooltip: baseTooltip('%') },
        scales: { x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } }, y: { ticks: { callback: v => v + '%' } } }
      }))
    });

    [['chTotal', 'tl'], ['chPriv', 'tl'], ['chRem', 'tl'], ['chRemVa', 'tl'],
     ['chMod', 'tl'], ['chIndep', 'tl'], ['chVarM', 'bl'], ['chVarA', 'bl']].forEach(([id, pos]) => {
      const c = Chart.getChart(id);
      if (c) bindFixedTip(c, pos);
    });
  }

  /* ============ Ramas: snapshot al mes seleccionado ============ */
  let ramasMode = 'n';
  let chRamas = null;
  const RAM_FECHAS = D.ramas_hist.fechas;
  let ramasMes = null; // YYYY-MM; null = último del período
  let ramasNoAnim = false;

  function snapshotAt(hist, fechas, k) {
    const endIdx = fechas.indexOf(k);
    const antIdx = endIdx - 12;
    const rows = [];
    for (const n of hist.names) {
      if (n === 'Total' || n === 'Sin especificar') continue;
      const act = endIdx >= 0 ? hist.data[n][endIdx] : null;
      const ant = antIdx >= 0 ? hist.data[n][antIdx] : null;
      rows.push({
        nombre: n, n_act: act, n_ant: ant,
        via: (act && ant) ? Math.round((act / ant - 1) * 1000) / 10 : null,
        end: k
      });
    }
    return { rows: rows.filter(r => r.n_act != null), end: k };
  }

  function renderRamas() {
    if (chRamas) { chRamas.destroy(); chRamas = null; }
    const end = ramasMes || lastIn(RAM_FECHAS);
    const { rows: base } = snapshotAt(D.ramas_hist, RAM_FECHAS, end);
    const isVar = ramasMode === 'v';
    const rows = isVar ? base.slice().sort((a, b) => (b.via ?? -99) - (a.via ?? -99))
                       : base.slice().sort((a, b) => b.n_act - a.n_act);
    const prevK = `${+end.slice(0, 4) - 1}${end.slice(4)}`;
    const opts = withFixedTip(Object.assign(lineOpts(), {
      indexAxis: 'y',
      plugins: { tooltip: isVar ? baseTooltip('%') : tooltipMill },
      scales: { x: Object.assign(
        { ticks: { callback: v => isVar ? v + '%' : v } },
        isVar ? { grace: '8%' } : { max: 1.4, title: { display: true, text: 'Millones de personas' } }
      ) }
    }));
    if (ramasNoAnim) opts.animation = false;
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
      options: opts
    });
    ramasNoAnim = false;
    charts.push(chRamas);
    bindFixedTip(chRamas, 'br');
    setNote('ramas', `Período: datos a ${label(end)} (variación interanual vs ${label(prevK)}).`);
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
    const ch = mk(canvasId, {
      type: 'line',
      data: {
        labels: labelsF.map(label),
        datasets: ranked.map((r, i) => ({
          label: short(r.n),
          data: toMillArr(r.vals),
          borderColor: PALETTE[i % PALETTE.length],
          tension: .25, pointRadius: 0, borderWidth: 1.8,
          hidden: i >= topN,
          ...hoverPunto(PALETTE[i % PALETTE.length])
        }))
      },
      options: withFixedTip(Object.assign(lineOpts(), {
        plugins: { tooltip: tooltipMill, legend: { labels: { boxWidth: 12 } } },
        scales: { x: { ticks: { maxTicksLimit: 14, maxRotation: 0 } }, y: Object.assign({ grace: '5%' }, AXIS_MILL) }
      }))
    });
    if (ch) bindFixedTip(ch);
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
    const hEnd = ramasMes || hF[hF.length - 1];
    const hPrev = `${+hEnd.slice(0, 4) - 1}${hEnd.slice(4)}`;
    setNote('ramas', `Período: datos a ${label(hEnd)} (variación interanual vs ${label(hPrev)}).`);
    setNote('ramashist', rangoTxt(D.ramas_hist.fechas));
    setNote('provhist', rangoTxt(D.prov_hist.fechas));
    setNote('tabla', rangoTxt(tKeys));
  }

  /* ============ Render general ============ */
  function renderAll() {
    charts.forEach(c => c.destroy());
    charts = [];
    chRamas = null;
    renderKPIs();
    renderBalance();
    renderCharts();
    renderRamas();
    histChart('chRamasHist', D.ramas_hist, 6);
    histChart('chProvHist', D.prov_hist, 8);
    renderTable();
    updateNotes();

    // hook para módulos externos (mapa provincial, etc.)
    if (typeof window.SIPA_ON_PERIOD_CHANGE === 'function') {
      try { window.SIPA_ON_PERIOD_CHANGE(periodo.from, periodo.to); } catch (e) { /* no-op */ }
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

  /* ============ Slider temporal de ramas ============ */
  const ramSlider = document.getElementById('ramSlider');
  const ramActual = document.getElementById('ramActual');
  const ramPeriodo = document.getElementById('ramPeriodo');
  const btnRamPlay = document.getElementById('btnRamPlay');
  let ramasPlaying = false;
  let ramasPlayTimer = null;
  const RAM_IDX_MIN = RAM_FECHAS.indexOf('2010-01'); // variación interanual requiere 12 meses previos

  function ramasRange() {
    const { from, to } = periodo;
    let lo = from ? RAM_FECHAS.findIndex(f => f >= from) : 0;
    if (lo < 0) lo = 0;
    if (lo < RAM_IDX_MIN) lo = RAM_IDX_MIN;
    let hi = RAM_FECHAS.length - 1;
    if (to) {
      const exact = RAM_FECHAS.lastIndexOf(to);
      if (exact >= 0) hi = exact;
      else { const j = RAM_FECHAS.findIndex(f => f > to); if (j >= 0) hi = j - 1; }
    }
    return [lo, hi];
  }

  function ramasPeriodoDe(k) {
    if (k >= '2023-12') return 'J. Milei';
    if (k >= '2019-12') return 'A. Fernández';
    if (k >= '2015-12') return 'M. Macri';
    return 'CFK';
  }

  function ramasSetMes(m) {
    ramasMes = m;
    ramSlider.value = RAM_FECHAS.indexOf(ramasMes);
    ramActual.textContent = label(ramasMes);
    ramPeriodo.textContent = ramasPeriodoDe(ramasMes);
    renderRamas();
  }

  function pauseRamas() {
    if (ramasPlayTimer) { clearInterval(ramasPlayTimer); ramasPlayTimer = null; }
    ramasPlaying = false;
    btnRamPlay.textContent = '▶';
    btnRamPlay.title = 'Reproducir';
  }

  function playRamas() {
    const hi = +ramSlider.max;
    let idx = ramasMes ? RAM_FECHAS.indexOf(ramasMes) : +ramSlider.value;
    if (idx >= hi) idx = +ramSlider.min - 1;
    pauseRamas();
    ramasPlaying = true;
    btnRamPlay.textContent = '⏸';
    btnRamPlay.title = 'Pausar';
    ramasPlayTimer = setInterval(() => {
      idx++;
      if (idx > hi) { ramasSetMes(RAM_FECHAS[hi]); pauseRamas(); return; }
      ramasSetMes(RAM_FECHAS[idx]);
    }, 250);
  }

  function applyRamasRango() {
    const [lo, hi] = ramasRange();
    let idx = ramasMes ? RAM_FECHAS.indexOf(ramasMes) : hi;
    if (!ramasMes || idx < lo || idx > hi) { idx = hi; ramasMes = RAM_FECHAS[hi]; }
    ramSlider.min = lo;
    ramSlider.max = hi;
    ramSlider.value = idx;
    ramActual.textContent = label(ramasMes);
    ramPeriodo.textContent = ramasPeriodoDe(ramasMes);
    pauseRamas();
  }

  ramSlider.addEventListener('input', () => { ramasNoAnim = true; pauseRamas(); ramasSetMes(RAM_FECHAS[+ramSlider.value]); });
  document.getElementById('btnRamAnt').addEventListener('click', () => {
    pauseRamas();
    const base = ramasMes || lastIn(RAM_FECHAS);
    const idx = RAM_FECHAS.indexOf(base);
    ramasSetMes(RAM_FECHAS[Math.max(+ramSlider.min, idx - 1)]);
  });
  document.getElementById('btnRamSig').addEventListener('click', () => {
    pauseRamas();
    const base = ramasMes || lastIn(RAM_FECHAS);
    const idx = RAM_FECHAS.indexOf(base);
    ramasSetMes(RAM_FECHAS[Math.min(+ramSlider.max, idx + 1)]);
  });
  btnRamPlay.addEventListener('click', () => { ramasPlaying ? pauseRamas() : playRamas(); });

  /* ============ Selector de período ============ */
  document.querySelectorAll('#periodo-bar [data-periodo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#periodo-bar .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      periodo = PERIODOS[btn.dataset.periodo];
      applyRamasRango();
      renderAll();
    });
  });

  applyRamasRango();
  renderAll();
})();
