'use strict';

/* Local high score table. Top 5 in `tetris-records` (JSON).

   Besides reading, writing and drawing the table, it fills the game over
   summary, prefills the player name and decides whether a score makes the cut. */

const RECORDS_KEY = Tetris.STORAGE.records;
const NAME_KEY = Tetris.STORAGE.name;
const MAX_RECORDS = 5;
const MAX_NAME_LENGTH = 12;
const DEFAULT_NAME = 'Jugador';

/* Every entry: { name, score, lines, level, maxLines, bestCombo } */

/* Result of the last finished game, while it can still be saved. */
let lastResult = null;

/* Row to highlight, consumed by the next render only. */
let pendingHighlight = -1;

/* ---- Storage ---- */

function sortRecords(records) {
  return records
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

function loadRecords() {
  try {
    const parsed = JSON.parse(Tetris.readStore(RECORDS_KEY, '[]'));
    if (!Array.isArray(parsed)) return [];
    return sortRecords(parsed.filter(entry => entry && typeof entry.score === 'number'));
  } catch (e) {
    return [];
  }
}

function saveRecords(records) {
  Tetris.writeStore(RECORDS_KEY, JSON.stringify(sortRecords(records)));
}

/* ---- Player name ---- */

function loadName() {
  return Tetris.readStore(NAME_KEY, '').trim();
}

function typedName() {
  const input = document.getElementById('player-name');
  return (input ? input.value : '').trim().slice(0, MAX_NAME_LENGTH);
}

function prefillName() {
  const input = document.getElementById('player-name');
  if (input) input.value = loadName();
}

/* ---- Status line, injected under the save button ---- */

function statusEl() {
  const existing = document.querySelector('[data-records-status]');
  if (existing) return existing;

  const button = document.getElementById('btn-save-score');
  if (!button) return null;

  const status = document.createElement('p');
  status.classList.add('screen__hint', 'hidden');
  status.setAttribute('data-records-status', '');
  button.insertAdjacentElement('afterend', status);
  return status;
}

function setStatus(message) {
  const status = statusEl();
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('hidden', !message);
}

/* ---- Draw ---- */

function render() {
  const records = loadRecords();
  const highlight = pendingHighlight;
  pendingHighlight = -1;

  for (const body of document.querySelectorAll('[data-records-body]')) {
    body.textContent = '';
    records.forEach((entry, index) => {
      const row = document.createElement('tr');
      if (index === highlight) row.classList.add('is-highlight');
      for (const value of [
        index + 1,
        entry.name || DEFAULT_NAME,
        entry.score.toLocaleString(),
        entry.lines ?? 0,
        entry.bestCombo ?? 0,
      ]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      body.appendChild(row);
    });
  }

  for (const empty of document.querySelectorAll('[data-records-empty]')) {
    empty.classList.toggle('hidden', records.length > 0);
  }
}

/* ---- Game over ---- */

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showFinalStats(result) {
  setText('final-score', result.score.toLocaleString());
  setText('final-level', result.level);
  setText('final-lines', result.lines);
  setText('final-combo', result.bestCombo);
  setText('final-max-lines', result.maxLines);
}

function onGameOver(result) {
  lastResult = {
    score: result.score,
    lines: result.lines,
    level: result.level,
    combo: result.combo,
    bestCombo: result.bestCombo,
    maxLines: result.maxLines,
  };
  showFinalStats(lastResult);
  prefillName();
  setStatus('');
  render();
}

/* A score makes the cut while the top has room, or if it beats the last one. */
function makesTop(records, score) {
  if (records.length < MAX_RECORDS) return true;
  return score > records[MAX_RECORDS - 1].score;
}

function saveCurrentScore() {
  if (!lastResult) {
    setStatus('Esta partida ya está guardada.');
    return;
  }

  const name = typedName() || DEFAULT_NAME;
  Tetris.writeStore(NAME_KEY, name);
  prefillName();

  const records = loadRecords();
  if (makesTop(records, lastResult.score)) {
    const entry = {
      name,
      score: lastResult.score,
      lines: lastResult.lines,
      level: lastResult.level,
      maxLines: lastResult.maxLines,
      bestCombo: lastResult.bestCombo,
    };
    records.push(entry);
    const sorted = sortRecords(records);
    saveRecords(sorted);
    pendingHighlight = sorted.indexOf(entry);
    lastResult = null;
    setStatus(`¡Record guardado! Puesto ${pendingHighlight + 1} de ${MAX_RECORDS}.`);
  } else {
    const fifth = records[MAX_RECORDS - 1].score.toLocaleString();
    setStatus(`No entra en el top ${MAX_RECORDS}: necesitas superar los ${fifth} puntos.`);
  }
  render();
}

function resetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los records guardados?')) return;
  saveRecords([]);
  pendingHighlight = -1;
  setStatus('');
  render();
}

/* ---- Wiring ---- */

function bindRecordsUi() {
  const saveButton = document.getElementById('btn-save-score');
  if (saveButton) saveButton.addEventListener('click', saveCurrentScore);

  for (const button of document.querySelectorAll('[data-records-reset]')) {
    button.addEventListener('click', resetRecords);
  }
}

Tetris.on('gameover', onGameOver);
Tetris.on('restart', () => {
  /* The finished game is gone, so its score can no longer be saved. */
  lastResult = null;
  pendingHighlight = -1;
  setStatus('');
});
Tetris.on('init', render);

bindRecordsUi();
prefillName();
render();
