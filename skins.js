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
function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin()];
  const variant = skinVariant(skin);
  const color = variant.colors[colorIndex];

  context.globalAlpha = alpha ?? 1;

  if (colorIndex === BOMB_PIECE) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x * size + size / 2, y * size + size / 2, size / 2 - 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = variant.blockHighlight;
    context.beginPath();
    context.arc(x * size + size / 2 - size / 5, y * size + size / 2 - size / 5, size / 6, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    return;
  }

  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = variant.blockHighlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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
        drawBlock(ctx, piece.x + c, piece.y + r, piece.shape[r][c], BLOCK);
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
      drawBlock(nextCtx, offX + c, offY + r, piece.shape[r][c], NEXT_BLOCK);
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
