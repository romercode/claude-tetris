'use strict';

/* Pause menu: P/Escape toggle, game input blocking, collapsible controls and the
   initial level select.

   The core owns the overlay screens: Tetris.pause()/Tetris.resume() call
   showScreen() themselves and bindChrome() already wires #btn-restart, so nothing
   here touches them. The initial level only applies to the NEXT game: state.level
   and the drop speed are left alone. */

const menuOverlay = document.getElementById('overlay')
const btnResume = document.getElementById('btn-resume')
const btnPauseControls = document.getElementById('btn-pause-controls')
const pauseControlsList = document.getElementById('pause-controls-list')

/* Matched by e.code, like the core does, so the layout stays consistent. */
const TOGGLE_KEYS = new Set(['KeyP', 'Escape'])

/* The core game keys plus the pause keys: while the menu is open nothing must
   reach the game, otherwise a key still held when the menu closes fires late and
   moves the piece all at once. */
const MENU_BLOCKED_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyX', 'Space',
  'KeyP', 'Escape',
])

/* The core only calls preventDefault() when no blocker aborts the event, so the
   page scroll under the overlay has to be stopped here instead. */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown', 'Home', 'End'])

const FIELD_SELECTOR = 'input, select, textarea'

/* ---- Foco ---- */

/* True when the focus sits on one of the menu's own fields. Only the fields
   inside the overlay count: the theme switch lives in the header and must not
   stop P/Escape from working. */
function menuFieldFocused() {
  const el = document.activeElement
  return !!el && el.matches(FIELD_SELECTOR) && menuOverlay.contains(el)
}

/* Drop the focus when the menu closes. A still focused button would swallow the
   next Space: the browser re-activates it instead of doing the hard drop, so the
   player gets a ghost move right after resuming. The click already ran its
   handler before we get here, so blurring does not break the mouse flow. */
function releaseFocus() {
  const el = document.activeElement
  if (el && el !== document.body && typeof el.blur === 'function') el.blur()
}

/* ---- Bloqueo de input ---- */

function blockGameInput(e) {
  if (!Tetris.state.paused || Tetris.state.gameOver) return false
  /* The menu keeps its own keyboard behaviour: arrows and Space on a <select>,
     typing in the name field. Space inside a text field is deliberately left
     alone too: the only text input lives on the game over screen, which is never
     paused, and blocking it would also break the theme switch checkbox. */
  if (menuFieldFocused()) return false
  if (!MENU_BLOCKED_KEYS.has(e.code)) return false
  if (SCROLL_KEYS.has(e.code)) e.preventDefault()
  return true
}

Tetris.addInputBlocker(blockGameInput)

/* ---- Pausa con teclado ---- */

/* Registered after the core listener, which handles neither P nor Escape, so
   there is no double toggle. */
document.addEventListener('keydown', e => {
  if (!TOGGLE_KEYS.has(e.code)) return
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
  if (menuFieldFocused()) return
  /* P is not a game key, so the core never cancels it: without this Escape would
     also do whatever the browser wants while the menu is open. */
  e.preventDefault()
  Tetris.togglePause()
})

/* ---- Controles plegables ---- */

let controlsVisible = false

function setControlsVisible(visible) {
  controlsVisible = visible
  /* The class is the one that works: .controls-list { display: flex } beats the
     user agent rule for the hidden attribute, so both are kept in sync. */
  pauseControlsList.classList.toggle('hidden', !visible)
  pauseControlsList.hidden = !visible
  btnPauseControls.textContent = visible ? 'Ocultar controles' : 'Ver controles'
  btnPauseControls.setAttribute('aria-expanded', visible ? 'true' : 'false')
}

/* ---- Nivel inicial (proxima partida) ---- */

function syncLevelSelects(level) {
  for (const select of document.querySelectorAll('[data-level-select]')) {
    select.value = String(level)
  }
}

function fillLevelSelects() {
  for (const select of document.querySelectorAll('[data-level-select]')) {
    select.textContent = ''
    for (let level = 1; level <= Tetris.MAX_INITIAL_LEVEL; level++) {
      const option = document.createElement('option')
      option.value = String(level)
      option.textContent = String(level)
      select.appendChild(option)
    }
    select.value = String(Tetris.readInitialLevel())
    select.addEventListener('change', () => {
      /* setInitialLevel() returns the clamped value: reuse it to update the
         select on the other screen, otherwise the two drift apart. */
      syncLevelSelects(Tetris.setInitialLevel(select.value))
    })
  }
}

/* ---- Botones ---- */

btnResume.addEventListener('click', () => Tetris.resume())
btnPauseControls.addEventListener('click', () => setControlsVisible(!controlsVisible))

/* The core emits 'restart' inside restart(), so this covers the pause menu and
   the game over button without rebinding #btn-restart. */
Tetris.on('restart', releaseFocus)

Tetris.on('pause', paused => {
  if (paused) {
    /* Opening: the level may have been changed on the other screen. */
    syncLevelSelects(Tetris.readInitialLevel())
    return
  }
  /* Closing (resume or start): drop the focus so the next game key is not eaten
     by a still focused button. */
  releaseFocus()
})

/* ---- Arranque ---- */

setControlsVisible(false)
fillLevelSelects()
