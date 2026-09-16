/* Compartir: exporta cada gráfico como tarjeta PNG 1200x675 */
(function () {
  'use strict';

  const W = 1200, H = 675;
  const BG = '#0d1522';
  const FG = '#e8eef7';
  const MUTED = '#94a6bd';
  const ACCENT = '#4f8dff';

  // Logo de Binary Data: se intenta una sola vez; si no hay CORS, se usa texto.
  let logoPromise = null;
  function loadLogo() {
    if (logoPromise) return logoPromise;
    logoPromise = new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'https://bin-dat.com/img/logobinarydata-horizontal.png';
      setTimeout(() => resolve(null), 4000);
    });
    return logoPromise;
  }

  function wrapText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return [text];
    let t = text;
    while (t.length > 3 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return [t + '…'];
  }

  async function buildCard(title, subtitle, chartCanvas) {
    const logo = await loadLogo();

    const cv = document.createElement('canvas');
    cv.width = W * 2;
    cv.height = H * 2;
    const ctx = cv.getContext('2d');
    ctx.scale(2, 2);

    // fondo
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    // borde sutil
    ctx.strokeStyle = '#243349';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    const M = 40;

    // título
    ctx.fillStyle = FG;
    ctx.font = '600 30px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    const titleLines = wrapText(ctx, title, W - M * 2);
    ctx.fillText(titleLines[0], M, 58);

    // subtítulo (período / descripción)
    let chartTop = 84;
    if (subtitle) {
      ctx.fillStyle = MUTED;
      ctx.font = '18px "Segoe UI", system-ui, sans-serif';
      const subLines = wrapText(ctx, subtitle, W - M * 2);
      ctx.fillText(subLines[0], M, 88);
      chartTop = 110;
    }

    // área del gráfico
    const footerTop = H - 44;
    const availW = W - M * 2;
    const availH = footerTop - chartTop - 8;
    const scale = Math.min(availW / chartCanvas.width, availH / chartCanvas.height);
    const dw = chartCanvas.width * scale;
    const dh = chartCanvas.height * scale;
    const dx = (W - dw) / 2;
    const dy = chartTop + (availH - dh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(chartCanvas, dx, dy, dw, dh);

    // marca de agua
    ctx.save();
    ctx.globalAlpha = 0.55;
    if (logo) {
      const lh = 26;
      const lw = lh * (logo.width / logo.height);
      ctx.drawImage(logo, W - M - lw, H - 22 - 26, lw, lh); // sobre el área del gráfico, borde inf. der.
      ctx.globalAlpha = 0.10;
      ctx.drawImage(logo, W * 0.28, H * 0.42, W * 0.44, (W * 0.44) * (logo.height / logo.width));
    } else {
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = ACCENT;
      ctx.font = '700 64px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BINARY DATA', W / 2, H * 0.55);
      ctx.globalAlpha = 0.7;
      ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Binary Data', W - M, H - 46);
      ctx.textAlign = 'left';
    }
    ctx.restore();

    // footer
    ctx.fillStyle = MUTED;
    ctx.font = '18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Extraido de Bin-Dat.com', M, H - 22);

    return cv;
  }

  function downloadPNG(canvas, filename) {
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  async function shareCanvas(canvas, title) {
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    if (!blob) return downloadPNG(canvas, title + '.png');
    const file = new File([blob], title + '.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // usuario canceló
      }
    }
    downloadPNG(canvas, title + '.png');
  }

  function slugify(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  // Convierte un SVG inline a canvas (para el mapa)
  function svgToCanvas(svg, bg) {
    return new Promise((resolve, reject) => {
      const xml = new XMLSerializer().serializeToString(svg);
      const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
      const img = new Image();
      img.onload = () => {
        const ratio = svg.viewBox.baseVal.height / svg.viewBox.baseVal.width;
        const w = 900, h = Math.round(w * ratio);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.fillStyle = bg;
        x.fillRect(0, 0, w, h);
        x.drawImage(img, 0, 0, w, h);
        resolve(c);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // Ranking provincial a canvas (columna derecha de la tarjeta del mapa)
  function rankingToCanvas(W, H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = BG;
    x.fillRect(0, 0, W, H);
    const rows = Array.from(document.querySelectorAll('#mapa-ranking .rank-row'));
    if (!rows.length) return c;
    const pad = 14;
    x.textBaseline = 'alphabetic';
    x.textAlign = 'left';
    x.fillStyle = MUTED;
    x.font = '700 18px "Segoe UI", system-ui, sans-serif';
    x.fillText('RANKING PROVINCIAL', pad, 26);
    const rowH = Math.floor((H - 44) / rows.length);
    rows.forEach((r, i) => {
      const num = r.querySelector('.rank-num').textContent;
      const nom = r.querySelector('.rank-nom').textContent;
      const val = r.querySelector('.rank-val').textContent;
      const bar = r.querySelector('.rank-bar');
      const bw = parseFloat(bar.style.width) || 0;
      const barColor = bar.style.background || MUTED;
      const y = 44 + i * rowH;
      if (i) { x.strokeStyle = '#1c2a3f'; x.lineWidth = 1; x.beginPath(); x.moveTo(pad, y); x.lineTo(W - pad, y); x.stroke(); }
      x.fillStyle = MUTED;
      x.font = '600 13px "Segoe UI", system-ui, sans-serif';
      x.fillText(num, pad, y + 15);
      x.fillStyle = FG;
      x.font = '14px "Segoe UI", system-ui, sans-serif';
      x.fillText(nom, pad + 18, y + 15);
      x.fillStyle = '#0b1520';
      x.fillRect(pad, y + 19, W - pad * 2, 6);
      x.fillStyle = barColor;
      x.fillRect(pad, y + 19, Math.max(2, (W - pad * 2) * bw / 100), 6);
      x.fillStyle = FG;
      x.font = '600 13px "Segoe UI", system-ui, sans-serif';
      x.textAlign = 'right';
      x.fillText(val, W - pad, y + 15);
      x.textAlign = 'left';
    });
    return c;
  }

  // Tarjeta compuesta: mapa a la izquierda + ranking provincial a la derecha
  function buildMapCard(svg) {
    return new Promise((resolve, reject) => {
      const xml = new XMLSerializer().serializeToString(svg);
      const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
      const img = new Image();
      img.onload = () => {
        const ratio = svg.viewBox.baseVal.height / svg.viewBox.baseVal.width;
        const H = 800;
        const MAP_SHARE = 0.35;
        const W = Math.round(H / (MAP_SHARE * ratio));
        const mapW = Math.round(W * MAP_SHARE);
        const RANK_W = W - mapW;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        x.fillStyle = BG;
        x.fillRect(0, 0, W, H);
        x.drawImage(img, 0, 0, mapW, H);
        const rank = rankingToCanvas(RANK_W, H);
        x.drawImage(rank, mapW, 0);
        resolve(c);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // Insertar botones en cada tarjeta que tenga canvas o el mapa SVG
  document.querySelectorAll('.card').forEach(card => {
    let canvas = card.querySelector('canvas');
    const svgMap = card.querySelector('#map-geo-svg');
    const h2 = card.querySelector('h2');
    const note = card.querySelector('.note');
    if ((!canvas && !svgMap) || !h2) return;

    const btn = document.createElement('button');
    btn.className = 'share-btn';
    btn.type = 'button';
    btn.title = 'Compartir este gráfico como imagen';
    btn.innerHTML = '⤴ Compartir';
    h2.classList.add('con-boton');
    h2.appendChild(btn);

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const original = btn.innerHTML;
      btn.innerHTML = '…';
      try {
        const title = h2.childNodes[0].textContent.trim();
        const subtitle = note ? note.textContent.trim() : '';
        let src;
        if (canvas) src = canvas;
        else if (svgMap && document.querySelector('#mapa-ranking .rank-row')) src = await buildMapCard(svgMap);
        else if (svgMap) src = await svgToCanvas(svgMap, '#0d1522');
        const card = await buildCard(title, subtitle, src);
        await shareCanvas(card, slugify(title));
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  });
})();
