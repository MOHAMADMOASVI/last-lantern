/** Entry point: create the game on the page's canvas and start the loop. */
import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.run();

// Handy for debugging from the devtools console.
window.__game = game;
