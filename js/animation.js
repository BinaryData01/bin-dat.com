console.clear();

const svgEl = document.querySelector('svg');
const allPaths = Array.from(document.querySelectorAll('path'));
const defs = document.querySelector('defs');
const xmlns = "http://www.w3.org/2000/svg";

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

if (prefersReducedMotion) {
  // No animamos nada: el usuario pidió reducir el movimiento
  svgEl.style.opacity = 1;
} else {
  // En mobile, styles.css ya oculta 1 de cada 2 líneas con display:none
  // (svg > path:nth-of-type(2n)) antes de este script correr, así el
  // navegador nunca llega a layoutearlas/pintarlas. Acá las sacamos del DOM
  // directamente en vez de dejarlas ocultas pero presentes.
  const targets = isMobile
    ? allPaths.filter((p, i) => {
        const keep = i % 2 === 0;
        if (!keep) p.remove();
        return keep;
      })
    : allPaths;

  if (isMobile) gsap.ticker.fps(30);

  // Fase 1 (solo lectura): getTotalLength() fuerza un reflow del layout.
  // Hacemos todas las lecturas juntas, antes de tocar el DOM.
  const lengths = targets.map(p => p.getTotalLength());

  // Fase 2 (solo escritura): clones, masks y tweens, sin intercalar lecturas.
  // Esto evita el "layout thrashing" (lectura-escritura-lectura-escritura)
  // que antes se repetía ~4 veces por línea y era el principal responsable
  // de la lentitud en navegadores de celulares.
  targets.forEach((p, idx) => {
    const len = lengths[idx];

    const clone = p.cloneNode();
    clone.removeAttribute('stroke-dasharray');

    const mask = document.createElementNS(xmlns, 'mask');
    mask.setAttribute('id', `id-${idx}`);
    mask.appendChild(clone);
    defs.appendChild(mask);
    p.setAttribute('mask', `url(#id-${idx})`);

    gsap.set(clone, { strokeDasharray: len, strokeDashoffset: len });

    gsap.to(clone, {
      duration: 10,
      delay: idx * 0.1,
      repeat: -1,
      strokeDashoffset: len * 3,
      ease: 'power1.inOut'
    });

    gsap.to(p, {
      duration: 10,
      repeat: -1,
      strokeDashoffset: len * 0.4,
      ease: 'none'
    });
  });

  // Pausa los tweens cuando la pestaña no está visible: ahorra CPU/batería
  // y evita que el navegador "acumule" frames pendientes al volver.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) gsap.globalTimeline.pause();
    else gsap.globalTimeline.resume();
  });

  svgEl.style.opacity = 1;
}
