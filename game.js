'use strict';

/* Nucleo del juego: estado, colisiones, loop y contrato `window.Tetris`.
   No dibuja ni toca el DOM de menus: de eso se ocupan skins.js, records.js y menu.js.
   Ver AGENTS.md para el detalle de cada fichero. */

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const LINE_SCORES = [0, 100, 300, 500, 800];
const LEVEL_LINE_STEP = 10;
const BASE_DROP_INTERVAL = 1000;
const MIN_DROP_INTERVAL = 100;
const DROP_INTERVAL_STEP = 90;
const MAX_INITIAL_LEVEL = 20;

const STORAGE = {
  level: 'tetris-level',
  name: 'tetris-player-name',
  skin: 'tetris-skin',
  theme: 'tetris-theme',
  records: 'tetris-records',
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca hueca
  [[9]],                                       // B - bomba
];

const BOMB_PIECE = 9;

const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyX', 'Space',
]);

/* ---- DOM del nucleo ---- */
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const overlayEl = document.getElementById('overlay');

const SCREENS = {
  start: document.getElementById('screen-start'),
  pause: document.getElementById('screen-pause'),
  over: document.getElementById('screen-over'),
};

/* ---- Estado de la partida ---- */
const state = {
  score: 0,
  lines: 0,
  level: 1,
  initialLevel: 1,
  combo: 0,
  bestCombo: 0,
  maxLines: 0,
  paused: false,
  gameOver: false,
  started: false,
};

let board;
let current;
let next;
let effects = [];
let dropAccum = 0;
let dropInterval = BASE_DROP_INTERVAL;
let lastTime = 0;
let animId = null;
let booted = false;

/* ---- Contrato: eventos, renderer e input blockers ---- */
const listeners = Object.create(null);
const inputBlockers = [];

let renderer = {
  draw() {},
  drawGrid() {},
  drawBlock() {},
  drawNext() {},
  accents: () => ['#ffd54f', '#ff5722'],
};
let rendererInjected = false;

function on(evt, fn) {
  (listeners[evt] || (listeners[evt] = [])).push(fn);
}

function emit(evt, payload) {
  const handlers = listeners[evt];
  if (!handlers) return;
  for (const fn of handlers) fn(payload);
}

function setRenderer(nextRenderer) {
  renderer = Object.assign({}, renderer, nextRenderer);
  rendererInjected = true;
}

function addInputBlocker(fn) {
  inputBlockers.push(fn);
  return () => {
    const i = inputBlockers.indexOf(fn);
    if (i >= 0) inputBlockers.splice(i, 1);
  };
}

function inputBlocked(e) {
  return inputBlockers.some(fn => fn(e));
}

/* ---- localStorage tolerante a fallos (modo privado, quota, etc.) ---- */
function readStore(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

function readInitialLevel() {
  const parsed = parseInt(readStore(STORAGE.level, '1'), 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), MAX_INITIAL_LEVEL);
}

function dropIntervalFor(level) {
  return Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (level - 1) * DROP_INTERVAL_STEP);
}

/* ---- Logica ---- */
function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 9) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (!cleared) return 0;
  state.lines += cleared;
  state.score += (LINE_SCORES[cleared] || 0) * state.level;
  state.level = state.initialLevel + Math.floor(state.lines / LEVEL_LINE_STEP);
  dropInterval = dropIntervalFor(state.level);
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  state.score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    state.score += 1;
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.type === BOMB_PIECE) {
    explode(current.x, current.y);
  } else {
    merge();
  }

  const cleared = clearLines();
  if (cleared) {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.maxLines = Math.max(state.maxLines, cleared);
  } else {
    state.combo = 0;
  }

  updateHUD();
  emit('lineclear', { cleared, combo: state.combo, bestCombo: state.bestCombo, maxLines: state.maxLines });
  spawn();
}

function explode(cx, cy) {
  let destroyed = 0;
  for (let r = cy - 1; r <= cy + 1; r++) {
    for (let c = cx - 1; c <= cx + 1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (board[r][c]) {
        board[r][c] = 0;
        destroyed++;
      }
    }
  }
  if (destroyed) {
    state.score += destroyed * 5;
    updateHUD();
  }

  const accents = renderer.accents();
  const px = (cx + 0.5) * BLOCK;
  const py = (cy + 0.5) * BLOCK;
  const particles = [];
  const count = 16;
  for (let i = 0; i < count; i++) {
    particles.push({
      angle: (Math.PI * 2 * i) / count + Math.random() * 0.6,
      speed: 80 + Math.random() * 160,
      life: 350 + Math.random() * 250,
      size: 3 + Math.random() * 4,
      color: accents[Math.floor(Math.random() * accents.length)],
    });
  }
  effects.push({ x: px, y: py, start: performance.now(), particles });
}

function drawEffects() {
  if (!effects.length) return;
  const now = performance.now();
  const accents = renderer.accents();
  for (const fx of effects) {
    const elapsed = now - fx.start;
    const progress = elapsed / 750;
    if (progress >= 1) continue;

    ctx.globalAlpha = 1 - progress;
    ctx.lineWidth = 4 * (1 - progress) + 1;
    ctx.strokeStyle = accents[0];
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 8 + progress * BLOCK * 2.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = accents[0];
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, Math.max(0, 6 * (1 - progress)), 0, Math.PI * 2);
    ctx.fill();

    for (const p of fx.particles) {
      const pt = elapsed / p.life;
      if (pt >= 1) continue;
      ctx.globalAlpha = 1 - pt;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(fx.x + Math.cos(p.angle) * p.speed * pt, fx.y + Math.sin(p.angle) * p.speed * pt, p.size * (1 - pt), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  renderer.drawNext();
}

function updateHUD() {
  scoreEl.textContent = state.score.toLocaleString();
  linesEl.textContent = state.lines;
  levelEl.textContent = state.level;
  comboEl.textContent = state.combo;
}

/* ---- Pantallas del overlay ---- */
function showScreen(name) {
  overlayEl.classList.toggle('hidden', !name);
  for (const [key, el] of Object.entries(SCREENS)) {
    el.classList.toggle('hidden', key !== name);
  }
}

/* ---- Ciclo de vida ---- */
function resetGame() {
  cancelAnimationFrame(animId);
  animId = null;

  board = createBoard();
  effects = [];
  state.score = 0;
  state.lines = 0;
  state.initialLevel = readInitialLevel();
  state.level = state.initialLevel;
  state.combo = 0;
  state.bestCombo = 0;
  state.maxLines = 0;
  state.paused = false;
  state.gameOver = false;
  state.started = false;
  dropAccum = 0;
  dropInterval = dropIntervalFor(state.level);

  next = randomPiece();
  spawn();
  updateHUD();
  renderer.draw();
  emit('init');
}

function start() {
  cancelAnimationFrame(animId);
  state.paused = false;
  state.gameOver = false;
  state.started = true;
  showScreen(null);
  lastTime = performance.now();
  dropAccum = 0;
  animId = requestAnimationFrame(loop);
  emit('pause', false);
}

function restart() {
  emit('restart');
  resetGame();
  start();
}

function toMenu() {
  resetGame();
  showScreen('start');
}

function pause() {
  if (!state.started || state.paused || state.gameOver) return;
  state.paused = true;
  cancelAnimationFrame(animId);
  animId = null;
  showScreen('pause');
  emit('pause', true);
}

function resume() {
  if (!state.paused) return;
  state.paused = false;
  showScreen(null);
  lastTime = performance.now();
  emit('pause', false);
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (state.paused) resume();
  else pause();
}

function endGame() {
  state.gameOver = true;
  state.paused = false;
  cancelAnimationFrame(animId);
  animId = null;
  updateHUD();
  showScreen('over');
  emit('gameover', {
    score: state.score,
    lines: state.lines,
    level: state.level,
    combo: state.combo,
    bestCombo: state.bestCombo,
    maxLines: state.maxLines,
  });
}

function setInitialLevel(level) {
  const clamped = Math.min(Math.max(parseInt(level, 10) || 1, 1), MAX_INITIAL_LEVEL);
  writeStore(STORAGE.level, String(clamped));
  state.initialLevel = clamped;
  return clamped;
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  renderer.draw();
  drawEffects();
  effects = effects.filter(fx => performance.now() - fx.start < 750);
  if (state.gameOver || state.paused) return;
  animId = requestAnimationFrame(loop);
}

function boot() {
  if (booted) return;
  booted = true;
  if (!rendererInjected) {
    console.warn('[tetris] skins.js no se cargo: el tablero se quedara en negro.');
  }
  bindChrome();
  resetGame();
  showScreen('start');
}

/* ---- Botones de flujo que pertenecen al nucleo ---- */
function bindChrome() {
  document.getElementById('btn-play').addEventListener('click', start);
  document.getElementById('btn-restart').addEventListener('click', restart);
  document.getElementById('btn-restart-over').addEventListener('click', restart);
  document.getElementById('btn-menu').addEventListener('click', toMenu);
}

/* ---- Input ---- */
document.addEventListener('keydown', e => {
  if (inputBlocked(e)) return;

  const isGameKey = GAME_KEYS.has(e.code);
  if (isGameKey) e.preventDefault();

  if (state.gameOver || state.paused || !state.started) return;

  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      hardDrop();
      break;
  }
  updateHUD();
});

window.Tetris = {
  // nucleo
  COLS,
  ROWS,
  BLOCK,
  STORAGE,
  MAX_INITIAL_LEVEL,
  state,
  get board() { return board; },
  get current() { return current; },
  get next() { return next; },

  // contrato
  on,
  emit,
  setRenderer,
  addInputBlocker,
  readStore,
  writeStore,
  showScreen,

  // flujo
  boot,
  start,
  restart,
  toMenu,
  pause,
  resume,
  togglePause,
  setInitialLevel,
  readInitialLevel,

  // nucleo reutilizable
  collide,
};
