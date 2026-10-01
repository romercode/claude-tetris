# AGENTS.md

Tetris en JavaScript Vanilla (ES6+) usando HTML5 Canvas. Sin build, sin dependencias, sin package.json, sin tests, sin linter.

## Ejecutar

Abre `index.html` directamente en el navegador, o sirve los archivos estáticamente:

```bash
python -m http.server 8000
# luego abre http://localhost:8000
```

## Verificación

Solo manualmente — juega en el navegador. No hay comandos de test, lint ni typecheck. Para un chequeo rápido de sintaxis, `node --check <fichero>` funciona en los cuatro scripts.

## Estructura

Cuatro scripts clásicos cargados en este orden desde `index.html`. **El orden importa**: comparten el ámbito global, así que `game.js` debe ir primero y `Tetris.boot()` se llama al final, en una etiqueta `<script>` aparte, cuando los demás ya se han registrado.

| Fichero | Se ocupa de |
|---|---|
| `game.js` | Núcleo: estado, colisiones, rotación, líneas, combo, loop, input, pantallas del overlay. Expone `window.Tetris`. No dibuja. |
| `skins.js` | Apariencia: tabla `SKINS`, el dibujado de bloques, el toggle claro/oscuro. |
| `records.js` | Top 5 de puntuaciones en localStorage y sus tablas. |
| `menu.js` | Menú de pausa: teclas, bloqueo de input, controles plegables, nivel inicial. |

### El contrato `window.Tetris`

Las tres features se hicieron en paralelo sobre esta base, y se comunican **solo** por este contrato. No importan nada entre sí ni editan el fichero de otra.

- `Tetris.on(evt, fn)` / `emit` — eventos `init`, `lineclear`, `gameover`, `pause`, `restart`.
- `Tetris.setRenderer({ draw, drawGrid, drawBlock, drawNext, accents })` — `skins.js` inyecta el dibujado.
- `Tetris.addInputBlocker(fn)` — `fn(evento) => true` aborta el input de juego. Varios pueden coexistir.
- `Tetris.start/restart/toMenu/pause/resume/togglePause/showScreen`.
- `Tetris.setInitialLevel(n)` / `readInitialLevel()` — persistido, acotado a 1..20.
- `Tetris.state` — `score`, `lines`, `level`, `initialLevel`, `combo`, `bestCombo`, `maxLines`, `paused`, `gameOver`, `started`.
- `Tetris.readStore/writeStore` — acceso a localStorage tolerante a fallos.
- `Tetris.collide`, `Tetris.board/current/next`, `Tetris.COLS/ROWS/BLOCK/STORAGE`.

Si añades algo al núcleo, expónlo por aquí en vez de tocar los otros ficheros.

## Puntos importantes

- Las constantes `COLS`, `ROWS` y `BLOCK` al inicio de `game.js` deben mantenerse sincronizadas con el `width`/`height` del canvas `#board` en `index.html` (`COLS × BLOCK` × `ROWS × BLOCK`). Cambiar una sin la otra rompe el renderizado silenciosamente.
- `level` se recalcula en `clearLines()` como `initialLevel + floor(lines / 10)`. El offset es lo que permite que el nivel inicial elegido sobreviva a la primera línea borrada.
- Los skins y el tema claro/oscuro son conceptos distintos: `data-skin`/`tetris-skin` para el estilo de bloque, `data-theme`/`tetris-theme` para el chrome. Un skin con `respectsTheme: true` tiene dos paletas y sigue al toggle; sin ese flag usa una paleta plana fija.
- **Los colores de los bloques viven solo en `skins.js`.** `style.css` no los toca, salvo el chrome de página que `[data-skin='neon']` y `[data-skin='pastel']` redefinen.
- `shadowBlur` en canvas es carísimo: solo se usa en la pieza activa y en la bomba del skin neon. No lo extiendas al tablero completo.
- La clase `.hidden` **y** el atributo `hidden` se usan para ocultar cosas; `style.css` fuerza ambos con `!important` porque varias reglas usan `display: flex`.
- El texto de la interfaz está en español (los comentarios del código están en inglés); si modificas el HUD, mantén etiquetas como "Puntuación"/"Reiniciar" coherentes.

## Cómo trabajar en features grandes

Si dos features van a tocar el mismo fichero, no las lances en paralelo: o las separas en ficheros (una feature, un fichero), o primero escribes el markup y el CSS en `index.html`/`style.css` y luego las implementas en JS sin tocar esos dos ficheros. Fue lo que se hizo aquí para el menú de pausa, los records y los skins, y por eso las tres ramas mergearon sin conflictos.
