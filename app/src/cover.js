// Vice Sunset cover engine: draws a multi-panel GTA-style poster cover onto a 2D canvas.
// One large hero panel plus two side panels split by diagonal gutters, a warm sunset grade
// (orange -> magenta -> purple), vignette, grain and halftone dots, and bold outlined caption
// lettering on a gradient band. Everything is drawn with the canvas API and system fonts only,
// so the cover renders identically in the live preview and in the exported PNG.

/** The three caption colour themes: fill, outline and glow for the lettering. */
export const CAPTION_THEMES = {
  white: { fill: '#ffffff', outline: '#1c0b2e', glow: 'rgba(255, 120, 60, 0.55)' },
  neon: { fill: '#ff5ec4', outline: '#14042a', glow: 'rgba(255, 94, 196, 0.7)' },
  gold: { fill: '#ffd23e', outline: '#1c0b2e', glow: 'rgba(255, 170, 40, 0.6)' },
};

/** A small deterministic PRNG so the grain looks the same in preview and export. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The three panel polygons for a cover of width w and height h. In landscape and square
 * covers the hero sits left with a slanted right edge and the two side panels stack on the
 * right; in portrait the hero sits on top with a slanted bottom edge and the two side panels
 * sit side by side below it. Each polygon is an array of [x, y] points.
 */
export function panelLayout(w, h) {
  if (w >= h) {
    const top = 0.62 * w;
    const bottom = 0.68 * w;
    const mid = 0.5 * h;
    return [
      [[0, 0], [top, 0], [bottom, h], [0, h]],
      [[top, 0], [w, 0], [w, mid], [top + (bottom - top) * 0.5, mid]],
      [[top + (bottom - top) * 0.5, mid], [w, mid], [w, h], [bottom, h]],
    ];
  }
  const left = 0.58 * h;
  const right = 0.52 * h;
  const mid = 0.5 * w;
  return [
    [[0, 0], [w, 0], [w, right], [0, left]],
    [[0, left], [mid, right + (left - right) * 0.5], [mid, h], [0, h]],
    [[mid, right + (left - right) * 0.5], [w, right], [w, h], [mid, h]],
  ];
}

/** The shared seams between the panels, as [x1, y1, x2, y2] lines to stroke as gutters. */
export function panelSeams(w, h) {
  if (w >= h) {
    return [
      [0.62 * w, 0, 0.68 * w, h],
      [0.65 * w, 0.5 * h, w, 0.5 * h],
    ];
  }
  return [
    [0, 0.58 * h, w, 0.52 * h],
    [0.5 * w, 0.55 * h, 0.5 * w, h],
  ];
}

/** Draws one photo into a panel polygon, cover-fitting it with a zoom and a pan offset. */
export function drawPanelPhoto(ctx, photo, polygon, zoom, panX, panY) {
  if (!photo) return;
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const pw = x1 - x0;
  const ph = y1 - y0;
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const base = Math.max(pw / iw, ph / ih) * zoom;
  const dw = iw * base;
  const dh = ih * base;
  const dx = x0 + (pw - dw) / 2 + panX * pw;
  const dy = y0 + (ph - dh) / 2 + panY * ph;
  ctx.save();
  ctx.beginPath();
  polygon.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();
}

/** Washes one panel with the warm sunset grade: orange at the top, magenta, purple at the foot. */
export function applySunsetGrade(ctx, polygon, w, h) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  ctx.save();
  ctx.beginPath();
  polygon.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  const grade = ctx.createLinearGradient(0, y0, 0, y1);
  grade.addColorStop(0, 'rgba(255, 150, 60, 0.16)');
  grade.addColorStop(0.45, 'rgba(255, 70, 130, 0.10)');
  grade.addColorStop(1, 'rgba(110, 30, 160, 0.28)');
  ctx.fillStyle = grade;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const vig = ctx.createRadialGradient(
    (x0 + x1) / 2, (y0 + y1) / 2, Math.min(x1 - x0, y1 - y0) * 0.35,
    (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) * 0.75,
  );
  vig.addColorStop(0, 'rgba(20, 5, 40, 0)');
  vig.addColorStop(1, 'rgba(20, 5, 40, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

/** Scatters deterministic film grain across the whole cover. */
export function drawGrain(ctx, w, h) {
  const rand = mulberry32(20261121);
  const dots = Math.floor((w * h) / 900);
  ctx.save();
  for (let i = 0; i < dots; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.05)' : 'rgba(10, 0, 25, 0.06)';
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();
}

/** Rows of halftone dots fading across a band, for the caption area. */
export function drawHalftone(ctx, x, y, w, rows, maxR) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.11)';
  for (let r = 0; r < rows; r++) {
    const cy = y + r * maxR * 2.4;
    for (let i = 0; i < Math.floor(w / (maxR * 2.4)); i++) {
      const cx = x + i * maxR * 2.4 + (r % 2 ? maxR * 1.2 : 0);
      const fade = 0.4 + 0.6 * Math.abs(Math.sin((cx / w) * Math.PI * 2 + r));
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * fade, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Draws the caption lettering: bold uppercase words, a thick dark outline, a coloured fill
 * and a warm drop shadow, auto-shrunk to fit the band. Returns the font size used.
 */
export function drawCaptionLettering(ctx, text, w, h, band, theme, sizeScale) {
  const clean = text.trim().toUpperCase();
  if (!clean) return 0;
  const bandH = band.y1 - band.y0;
  let size = bandH * 0.62 * sizeScale;
  const font = (s) => `900 ${s}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font(size);
  while (ctx.measureText(clean).width > w * 0.92 && size > 10) {
    size -= 2;
    ctx.font = font(size);
  }
  const cy = band.y0 + bandH * 0.58;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = size * 0.35;
  ctx.shadowOffsetY = size * 0.08;
  ctx.strokeStyle = theme.outline;
  ctx.lineWidth = Math.max(4, size * 0.16);
  ctx.strokeText(clean, w / 2, cy);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = theme.fill;
  ctx.fillText(clean, w / 2, cy);
  return size;
}

/**
 * Draws the whole cover onto ctx at the canvas's own size.
 * state: { photos: [img|null x3], panels: [{zoom, panX, panY} x3], onePhoto, caption,
 *          captionSize, theme, captionPos }.
 */
export function drawViceSunsetCover(ctx, w, h, state) {
  ctx.fillStyle = '#160a26';
  ctx.fillRect(0, 0, w, h);
  const polygons = panelLayout(w, h);
  const photos = state.onePhoto
    ? [state.photos[0], state.photos[0], state.photos[0]]
    : state.photos;
  polygons.forEach((polygon, i) => {
    const panel = state.panels[i];
    drawPanelPhoto(ctx, photos[i], polygon, panel.zoom, panel.panX, panel.panY);
    applySunsetGrade(ctx, polygon, w, h);
  });

  // White gutters along the diagonal seams, the comic-panel look.
  ctx.save();
  ctx.strokeStyle = '#fdf6ff';
  ctx.lineWidth = Math.max(4, w * 0.008);
  ctx.lineCap = 'round';
  panelSeams(w, h).forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  ctx.restore();

  // Caption band: a dark gradient strip at the top or the foot, with halftone dots.
  const bandH = h * 0.21;
  const band = state.captionPos === 'top'
    ? { y0: 0, y1: bandH }
    : { y0: h - bandH, y1: h };
  const bandGrad = state.captionPos === 'top'
    ? ctx.createLinearGradient(0, band.y0, 0, band.y1)
    : ctx.createLinearGradient(0, band.y1, 0, band.y0);
  bandGrad.addColorStop(0, 'rgba(18, 4, 34, 0.92)');
  bandGrad.addColorStop(0.7, 'rgba(40, 8, 60, 0.55)');
  bandGrad.addColorStop(1, 'rgba(40, 8, 60, 0)');
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, band.y0, w, bandH);
  // Halftone dots along the dark edge of the caption band, clear of the lettering.
  const dotY = state.captionPos === 'top' ? band.y0 + h * 0.012 : band.y1 - h * 0.028;
  drawHalftone(ctx, w * 0.03, dotY, w * 0.94, 1, Math.max(2, h * 0.004));

  // Small eyebrow line above the caption, then the big lettering.
  const theme = CAPTION_THEMES[state.theme] ?? CAPTION_THEMES.white;
  const eyebrow = '★ VICE SUNSET ★';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const browSize = Math.max(11, h * 0.018);
  ctx.font = `700 ${browSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = '#ffd23e';
  const browY = state.captionPos === 'top' ? band.y0 + browSize * 1.7 : band.y0 + browSize * 1.7;
  ctx.fillText(eyebrow.split('').join(' '), w / 2, browY);
  ctx.restore();
  const letterBand = {
    y0: band.y0 + bandH * 0.2,
    y1: band.y1 - bandH * 0.04,
  };
  drawCaptionLettering(ctx, state.caption, w, h, letterBand, theme, state.captionSize);

  drawGrain(ctx, w, h);
}
