// Vice Sunset editor: wires the controls to the cover engine, pre-loads the two sample photos
// so the first paint already shows a cover, and exports the cover as a PNG in the chosen
// post size. Drag on the preview to pan the photo in a panel; click a panel to select it,
// then use the zoom slider to crop it. Photos are read on this machine and never uploaded.
import { drawViceSunsetCover, panelLayout } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const captionInput = document.getElementById('caption');
const statusLine = document.getElementById('status');
const zoomSlider = document.getElementById('zoom');
const zoomValue = document.getElementById('zoom-value');
const sizeRadios = [...document.querySelectorAll('input[name="size"]')];
const themeRadios = [...document.querySelectorAll('input[name="theme"]')];
const posButtons = [...document.querySelectorAll('[data-pos]')];
const panelButtons = [...document.querySelectorAll('[data-panel]')];

export const POST_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const state = {
  photos: [null, null, null],
  panels: [
    { zoom: 1.0, panX: 0, panY: 0 },
    { zoom: 1.0, panX: 0, panY: 0 },
    { zoom: 1.0, panX: 0, panY: 0 },
  ],
  onePhoto: false,
  caption: 'Sunset Heist',
  captionSize: 1,
  theme: 'white',
  captionPos: 'bottom',
  size: 'square',
  selected: 0,
};

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Redraws the preview at the chosen post size and marks the selected panel. */
export function redraw() {
  const size = POST_SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawViceSunsetCover(ctx, canvas.width, canvas.height, state);
  if (!document.body.classList.contains('shot-cover')) {
    const polygon = panelLayout(canvas.width, canvas.height)[state.selected];
    ctx.save();
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = Math.max(3, canvas.width * 0.006);
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    polygon.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

/** Which panel, if any, contains the point (x, y) in canvas pixels. */
export function panelAt(x, y) {
  const polygons = panelLayout(canvas.width, canvas.height);
  for (let i = 0; i < polygons.length; i++) {
    ctx.save();
    ctx.beginPath();
    polygons[i].forEach(([px, py], j) => (j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    const hit = ctx.isPointInPath(x, y);
    ctx.restore();
    if (hit) return i;
  }
  return -1;
}

function selectPanel(i) {
  state.selected = i;
  panelButtons.forEach((b) => b.classList.toggle('active', Number(b.dataset.panel) === i));
  const panel = state.panels[i];
  zoomSlider.value = panel.zoom;
  zoomValue.textContent = `${Math.round(panel.zoom * 100)}%`;
  redraw();
}

function setStatus(text) {
  statusLine.textContent = text;
}

// --- photo slots -------------------------------------------------------------
function readFileAsImage(file) {
  return loadImage(URL.createObjectURL(file));
}

async function setPhoto(slot, file) {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    state.photos[slot] = await readFileAsImage(file);
    state.panels[slot] = { zoom: 1.0, panX: 0, panY: 0 };
    selectPanel(slot);
    setStatus(`Photo ${slot + 1} loaded — drag the preview to position it.`);
  } catch {
    setStatus('That file could not be read as a photo.');
  }
}

[0, 1, 2].forEach((slot) => {
  document.getElementById(`photo-${slot}`).addEventListener('change', (e) => {
    setPhoto(slot, e.target.files[0]);
  });
});

document.getElementById('one-photo').addEventListener('change', (e) => {
  state.onePhoto = e.target.checked;
  redraw();
  setStatus(state.onePhoto ? 'One photo fills all three panels.' : 'Each panel uses its own photo.');
});

document.getElementById('samples').addEventListener('click', async () => {
  state.photos[0] = await loadImage('samples/boulevard.jpg');
  state.photos[1] = await loadImage('samples/pier.jpg');
  state.photos[2] = await loadImage('samples/boulevard.jpg');
  state.panels = [
    { zoom: 1.0, panX: 0, panY: 0 },
    { zoom: 1.0, panX: 0, panY: 0 },
    { zoom: 1.15, panX: 0.05, panY: -0.05 },
  ];
  selectPanel(0);
  setStatus('Sample photos loaded.');
});

// --- drag to pan, click to select --------------------------------------------
let drag = null;

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return [
    ((e.clientX - rect.left) / rect.width) * canvas.width,
    ((e.clientY - rect.top) / rect.height) * canvas.height,
  ];
}

canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = canvasPoint(e);
  const hit = panelAt(x, y);
  if (hit < 0) return;
  selectPanel(hit);
  drag = { panel: hit, x, y, moved: false };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const [x, y] = canvasPoint(e);
  const dx = x - drag.x;
  const dy = y - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const polygon = panelLayout(canvas.width, canvas.height)[drag.panel];
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const panel = state.panels[drag.panel];
  panel.panX += dx / (Math.max(...xs) - Math.min(...xs));
  panel.panY += dy / (Math.max(...ys) - Math.min(...ys));
  panel.panX = Math.max(-0.6, Math.min(0.6, panel.panX));
  panel.panY = Math.max(-0.6, Math.min(0.6, panel.panY));
  drag.x = x;
  drag.y = y;
  redraw();
});

canvas.addEventListener('pointerup', () => {
  if (drag?.moved) setStatus('Photo repositioned — export when it looks right.');
  drag = null;
});

// Drag-and-drop: drop a photo onto a panel to fill that panel with it.
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const [x, y] = canvasPoint(e);
  const hit = panelAt(x, y);
  setPhoto(hit < 0 ? state.selected : hit, e.dataTransfer.files[0]);
});

// --- caption -----------------------------------------------------------------
captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});

document.getElementById('caption-size').addEventListener('input', (e) => {
  state.captionSize = Number(e.target.value) / 100;
  document.getElementById('caption-size-value').textContent = `${e.target.value}%`;
  redraw();
});

themeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    state.theme = radio.value;
    redraw();
  });
});

posButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.captionPos = button.dataset.pos;
    posButtons.forEach((b) => b.classList.toggle('active', b === button));
    redraw();
  });
});

// --- crop controls -----------------------------------------------------------
panelButtons.forEach((button) => {
  button.addEventListener('click', () => selectPanel(Number(button.dataset.panel)));
});

zoomSlider.addEventListener('input', () => {
  const panel = state.panels[state.selected];
  panel.zoom = Number(zoomSlider.value);
  zoomValue.textContent = `${Math.round(panel.zoom * 100)}%`;
  redraw();
});

document.getElementById('reset-crop').addEventListener('click', () => {
  state.panels[state.selected] = { zoom: 1.0, panX: 0, panY: 0 };
  selectPanel(state.selected);
  setStatus('Crop reset for the selected panel.');
});

// --- export ------------------------------------------------------------------
sizeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    state.size = radio.value;
    redraw();
  });
});

document.getElementById('export').addEventListener('click', () => {
  exportCover();
});

/** Renders the cover at the chosen post size and downloads it as a PNG. */
export function exportCover() {
  const size = POST_SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawViceSunsetCover(off.getContext('2d'), size.w, size.h, state);
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — try again.');
      return;
    }
    const name = `vice-sunset-cover-${size.w}x${size.h}.png`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setStatus(`Saved ${name} (${size.label}).`);
  }, 'image/png');
}

// --- shots -------------------------------------------------------------------
const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, {
    loadImage,
    setCaption(text) {
      state.caption = text;
      captionInput.value = text;
    },
    setPhotos(hero, sideTop, sideBottom) {
      state.photos = [hero, sideTop, sideBottom];
    },
    setSize(name) {
      state.size = name;
      const radio = sizeRadios.find((r) => r.value === name);
      if (radio) radio.checked = true;
    },
    redraw,
  });
} else {
  (async () => {
    try {
      state.photos[0] = await loadImage('samples/boulevard.jpg');
      state.photos[1] = await loadImage('samples/pier.jpg');
      state.photos[2] = await loadImage('samples/boulevard.jpg');
      state.panels[2] = { zoom: 1.15, panX: 0.05, panY: -0.05 };
    } catch {
      setStatus('Sample photos could not be loaded — add your own photo to begin.');
    }
    selectPanel(0);
  })();
}
