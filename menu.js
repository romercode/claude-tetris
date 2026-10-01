'use strict';

/* Menu de pausa.

   Esta es la base que aporta el refactor: el boton de reanudar.
   Lo que falta es todo lo demas del menu (controles plegables, selector de nivel,
   bloqueo de input y tecla Escape), asi que de momento solo se puede reanudar. */

document.getElementById('btn-resume').addEventListener('click', () => Tetris.resume());
