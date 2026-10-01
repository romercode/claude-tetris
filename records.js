'use strict';

/* Tabla de records locales. Top 5 en `tetris-records` (JSON).

   Esta es la base que aporta el refactor: leer, guardar y pintar la tabla.
   Lo que falta es la integracion con el game over, asi que de momento la tabla
   siempre sale vacia. */

const RECORDS_KEY = Tetris.STORAGE.records;
const MAX_RECORDS = 5;

/* Cada entrada: { name, score, lines, level, maxLines, bestCombo } */

function loadRecords() {
  try {
    const parsed = JSON.parse(Tetris.readStore(RECORDS_KEY, '[]'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(entry => entry && typeof entry.score === 'number').slice(0, MAX_RECORDS);
  } catch (e) {
    return [];
  }
}

function saveRecords(records) {
  Tetris.writeStore(RECORDS_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
}

function render() {
  const records = loadRecords();

  for (const body of document.querySelectorAll('[data-records-body]')) {
    body.textContent = '';
    records.forEach((entry, index) => {
      const row = document.createElement('tr');
      for (const value of [
        index + 1,
        entry.name || 'Jugador',
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

Tetris.on('init', render);
render();
