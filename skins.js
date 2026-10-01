'use strict';

/* Apariencia del juego. Es el unico fichero que decide como se ve un bloque.

   Dos conceptos distintos conviven aqui:
     - theme  (`data-theme` / `tetris-theme`)   -> claro u oscuro, afecta al chrome CSS.
     - skin   (`data-skin`  / `tetris-skin`)    -> estilo de bloque: retro, neon, pastel, pixel.

   Un skin puede declarar `respectsTheme: true` para tener dos paletas y seguir al
   toggle claro/oscuro (lo hacen retro y pixel); si lo omite usa una unica paleta fija.

   Para pintar, game.js llama a Tetris.setRenderer({ draw, drawGrid, drawBlock, drawNext, accents }). */

const SKINS = {
  retro: {
    label: 'Retro',
    respectsTheme: true,
    colors: {
      dark: [
        null,
        '#4dd0e1', // I - cyan
        '#ffd54f', // O - yellow
        '#ba68c8', // T - purple
        '#81c784', // S - green
        '#e57373', // Z - red
        '#90caf9', // J - pale blue
        '#ffb74d', // L - orange
        '#b0bec5', // N - steel white
        '#ff5722', // B - bomb deep orange
      ],
      light: [
        null,
        '#007a8c', // I - cyan profundo
        '#d8a000', // O - yellow oscuro
        '#7b1fa2', // T - purple de alto contraste
        '#2e7d32', // S - green oscuro
        '#c62828', // Z - red oscuro
        '#1565c0', // J - azul oscuro
        '#e65100', // L - orange oscuro
        '#546e7a', // N - steel oscuro
        '#bf360c', // B - bomb deep orange oscuro
      ],
    },
    grid: {
      dark: '#22222e',
      light: '#d6dae8',
    },
    blockHighlight: {
      dark: 'rgba(255,255,255,0.12)',
      light: 'rgba(255,255,255,0.55)',
    },
    accents: {
      dark: ['#ffd54f', '#ff5722'],
      light: ['#d8a000', '#bf360c'],
    },
  },

  /* Fixed palette: neon always paints on black, so it does not follow the theme. */
  neon: {
    label: 'Neon',
    colors: [
      null,
      '#00f0ff', // I - electric cyan
      '#ffe600', // O - electric yellow
      '#c34cff', // T - violet
      '#39ff14', // S - acid green
      '#ff2d6f', // Z - hot pink
      '#2f7bff', // J - electric blue
      '#ff9500', // L - amber
      '#d8fbff', // N - ice white
      '#ff4d00', // B - bomb orange-red
    ],
    grid: '#0d2b1c',
    blockHighlight: 'rgba(255,255,255,0.65)',
    accents: ['#39ff14', '#ff2d6f'],
  },

  /* Fixed palette: soft colours work the same on both themes. */
  pastel: {
    label: 'Pastel',
    colors: [
      null,
      '#a8d8ea', // I - soft sky
      '#f7d9a0', // O - cream
      '#cbb2e0', // T - lilac
      '#b8e0c0', // S - mint
      '#f2b8b8', // Z - rose
      '#b8c8ea', // J - periwinkle
      '#f2d0b0', // L - peach
      '#ded9e6', // N - soft grey
      '#eeaeae', // B - dusty red
    ],
    grid: '#e6d7dd',
    blockHighlight: 'rgba(255,255,255,0.7)',
    accents: ['#f4a6b8', '#b8a6e0'],
  },

  /* Follows the theme: the console look needs darker tones on a dark board and
     saturated ones on a light board. */
  pixel: {
    label: 'Pixel',
    respectsTheme: true,
    colors: {
      dark: [
        null,
        '#4cc9f0', // I - cyan
        '#ffd166', // O - yellow
        '#c77dff', // T - purple
        '#57cc99', // S - green
        '#ef476f', // Z - red
        '#4361ee', // J - blue
        '#f78c6b', // L - orange
        '#c0c0d0', // N - steel
        '#ff6b35', // B - bomb
      ],
      light: [
        null,
        '#0b6e8f', // I - cyan oscuro
        '#b57b00', // O - yellow oscuro
        '#6f2f9e', // T - purple oscuro
        '#17794f', // S - green oscuro
        '#b32344', // Z - red oscuro
        '#1d3fae', // J - blue oscuro
        '#b04a1d', // L - orange oscuro
        '#565666', // N - steel oscuro
        '#c23c00', // B - bomb oscuro
      ],
    },
    grid: {
      dark: '#161a22',
      light: '#cdd0d8',
    },
    blockHighlight: {
      dark: 'rgba(255,255,255,0.32)',
      light: 'rgba(255,255,255,0.6)',
    },
    accents: {
      dark: ['#ff4fa3', '#33ccff'],
      light: ['#b0246b', '#0a6d8a'],
    },
  },
};

/* ---- Theme (claro/oscuro) ---- */
function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.checked = theme === 'light';
  Tetris.writeStore(Tetris.STORAGE.theme, theme);
  redraw();
}

function restoreTheme() {
  const saved = Tetris.readStore(Tetris.STORAGE.theme, 'dark');
  document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.checked = document.documentElement.dataset.theme === 'light';
}

/* ---- Skin ---- */
function currentSkin() {
  const id = document.documentElement.dataset.skin;
  return SKINS[id] ? id : 'retro';
}

/* Resuelve la paleta de un skin segun el theme activo y devuelve una forma plana:
   { colors: string[], grid: string, blockHighlight: string, accents: string[] }.
   Asi `drawBlock` no necesita saber si el skin sigue al toggle o es fijo. */
function skinVariant(skin) {
  if (!skin.respectsTheme) return skin;
  const theme = currentTheme();
  return {
    colors: skin.colors[theme],
    grid: skin.grid[theme],
    blockHighlight: skin.blockHighlight[theme],
    accents: skin.accents[theme],
  };
}

function applySkin(id) {
  const skinId = SKINS[id] ? id : 'retro';
  document.documentElement.dataset.skin = skinId;
  Tetris.writeStore(Tetris.STORAGE.skin, skinId);
  for (const select of document.querySelectorAll('[data-skin-select]')) {
    select.value = skinId;
  }
  redraw();
}

function restoreSkin() {
  const saved = Tetris.readStore(Tetris.STORAGE.skin, 'retro');
  document.documentElement.dataset.skin = SKINS[saved] ? saved : 'retro';
}

function skinSelects() {
  for (const select of document.querySelectorAll('[data-skin-select]')) {
    select.textContent = '';
    for (const [id, skin] of Object.entries(SKINS)) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = skin.label;
      select.appendChild(option);
    }
    select.value = currentSkin();
    select.addEventListener('change', () => applySkin(select.value));
  }
}

/* ---- Pintado ---- */

/* shadowBlur is the expensive part of the neon look, so it lives in one constant
   and is only spent on the few blocks that are worth glowing. */
const NEON_GLOW = 12;

/* Cada skin tiene su propia funcion de bloque y su radio de glow para la bomba
   (0 = sin glow). El bomb siempre se pinta como circulo. */
const PAINTERS = {
  retro: { block: paintRetro, bombBlur: 0 },
  neon: { block: paintNeon, bombBlur: NEON_GLOW },
  pastel: { block: paintPastel, bombBlur: 0 },
  pixel: { block: paintPixel, bombBlur: 0 },
};

/* drawBlock se llama una vez por celda del tablero (~200 por frame): resolver skin
   y theme en cada llamada es gasto inutil, asi que se cachea la pareja painter+variant. */
let paintCache = { key: '', painter: null, variant: null };

function refreshPaint() {
  const id = currentSkin();
  const skin = SKINS[id];
  const key = id + '|' + (skin.respectsTheme ? currentTheme() : 'fixed');
  if (key === paintCache.key) return paintCache;
  paintCache = {
    key,
    painter: PAINTERS[id] || PAINTERS.retro,
    variant: skinVariant(skin),
  };
  return paintCache;
}

function paintRetro(context, variant, x, y, colorIndex, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = variant.colors[colorIndex];
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = variant.blockHighlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function paintNeon(context, variant, x, y, colorIndex, size, alpha, glow) {
  const color = variant.colors[colorIndex];
  const px = x * size;
  const py = y * size;
  const op = alpha ?? 1;
  context.globalAlpha = op;

  if (glow) {
    /* Blur only on the active piece (and on the next preview): a board of ~200
       glowing blocks would drop the frame rate. */
    context.shadowColor = color;
    context.shadowBlur = NEON_GLOW;
    context.fillStyle = color;
    context.fillRect(px + 3, py + 3, size - 6, size - 6);
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
  } else {
    /* Cheap halo for the settled board: solid core plus a stroked ring. */
    context.fillStyle = color;
    context.fillRect(px + 4, py + 4, size - 8, size - 8);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.strokeRect(px + 3, py + 3, size - 6, size - 6);
    context.globalAlpha = 0.18 + op * 0.32;
    context.lineWidth = 1;
    context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    context.globalAlpha = op;
  }

  context.fillStyle = variant.blockHighlight;
  context.fillRect(px + 4, py + 4, size - 8, Math.max(2, Math.round(size / 12)));
  context.globalAlpha = 1;
  context.lineWidth = 1;
}

/* ctx.roundRect is missing on older browsers and this repo has no build step to
   polyfill it, so the rounded path is built by hand when it is not available. */
function roundRectPath(context, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, radius);
    return;
  }
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.arcTo(x + w, y, x + w, y + radius, radius);
  context.lineTo(x + w, y + h - radius);
  context.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  context.lineTo(x + radius, y + h);
  context.arcTo(x, y + h, x, y + h - radius, radius);
  context.lineTo(x, y + radius);
  context.arcTo(x, y, x + radius, y, radius);
  context.closePath();
}

function paintPastel(context, variant, x, y, colorIndex, size, alpha) {
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const radius = Math.max(2, Math.round(size * 0.24));
  context.globalAlpha = alpha ?? 1;

  roundRectPath(context, px, py, w, w, radius);
  context.fillStyle = variant.colors[colorIndex];
  context.fill();

  context.fillStyle = variant.blockHighlight;
  roundRectPath(context, px + 2, py + 2, w - 4, Math.max(2, Math.round(size * 0.24)), Math.max(1, radius - 2));
  context.fill();

  context.globalAlpha = 1;
}

/* The texture has to be deterministic or it would flicker on every frame, so it is
   derived from a hash of (x, y, colorIndex) instead of Math.random(). */
function pixelHash(x, y, colorIndex) {
  let h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(colorIndex, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

const PIXEL_SUBCELLS = 3;

function paintPixel(context, variant, x, y, colorIndex, size, alpha) {
  const px = x * size;
  const py = y * size;
  const inner = size - 6;
  const sub = inner / PIXEL_SUBCELLS;
  context.globalAlpha = alpha ?? 1;

  /* Dark sprite border plus the flat colour of the cell. */
  context.fillStyle = 'rgba(0,0,0,0.5)';
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = variant.colors[colorIndex];
  context.fillRect(px + 3, py + 3, inner, inner);

  /* Two bits of the hash per sub-cell pick which pixels are lit and how. */
  const hash = pixelHash(x, y, colorIndex);
  for (let i = 0; i < PIXEL_SUBCELLS * PIXEL_SUBCELLS; i++) {
    if (((hash >>> (i * 2)) & 3) !== 0) continue;
    context.fillStyle = (hash >>> (i * 2 + 1)) & 1 ? variant.blockHighlight : 'rgba(0,0,0,0.28)';
    context.fillRect(
      Math.floor(px + 3 + (i % PIXEL_SUBCELLS) * sub),
      Math.floor(py + 3 + Math.floor(i / PIXEL_SUBCELLS) * sub),
      Math.ceil(sub),
      Math.ceil(sub),
    );
  }

  context.globalAlpha = 1;
}

function paintBomb(context, variant, x, y, size, alpha, glowBlur) {
  const cx = x * size + size / 2;
  const cy = y * size + size / 2;
  context.globalAlpha = alpha ?? 1;

  if (glowBlur > 0) {
    context.shadowColor = variant.colors[BOMB_PIECE];
    context.shadowBlur = glowBlur;
  }
  context.fillStyle = variant.colors[BOMB_PIECE];
  context.beginPath();
  context.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';

  context.fillStyle = variant.blockHighlight;
  context.beginPath();
  context.arc(cx - size / 5, cy - size / 5, size / 6, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawBlock(context, x, y, colorIndex, size, alpha, glow) {
  if (!colorIndex) return;
  const paint = refreshPaint();
  if (colorIndex === BOMB_PIECE) {
    paintBomb(context, paint.variant, x, y, size, alpha, paint.painter.bombBlur);
    return;
  }
  paint.painter.block(context, paint.variant, x, y, colorIndex, size, alpha, glow);
}

function drawGrid() {
  const variant = skinVariant(SKINS[currentSkin()]);
  ctx.strokeStyle = variant.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  const cells = Tetris.board;
  const piece = Tetris.current;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!cells) return;
  drawGrid();

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, cells[r][c], BLOCK);

  if (Tetris.state.gameOver || !piece) return;

  let ghost = piece.y;
  while (!collideFor(piece.shape, piece.x, ghost + 1)) ghost++;

  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        drawBlock(ctx, piece.x + c, ghost + r, piece.shape[r][c], BLOCK, 0.2);

  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        drawBlock(ctx, piece.x + c, piece.y + r, piece.shape[r][c], BLOCK, 1, true);
}

/* El nucleo no expone collide(); el skin necesita la misma prueba para el ghost. */
function collideFor(shape, ox, oy) {
  const cells = Tetris.board;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && cells[ny][nx]) return true;
    }
  }
  return false;
}

const NEXT_BLOCK = 30;

function drawNext() {
  const piece = Tetris.next;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!piece) return;
  const offX = Math.floor((4 - piece.shape[0].length) / 2);
  const offY = Math.floor((4 - piece.shape.length) / 2);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, piece.shape[r][c], NEXT_BLOCK, 1, true);
}

function accents() {
  return skinVariant(SKINS[currentSkin()]).accents;
}

function redraw() {
  draw();
  drawNext();
}

/* ---- Arranque ---- */
function initSkins() {
  restoreTheme();
  restoreSkin();
  skinSelects();

  Tetris.setRenderer({ draw, drawGrid, drawBlock, drawNext, accents });

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('change', () => applyTheme(toggle.checked ? 'light' : 'dark'));
  }

  redraw();
}

initSkins();
