
// node >= 18: Fetch já incluso
import {format} from 'node:util';           // só para log elegante
import fs from 'node:fs/promises';

const USER = 'getsomewolf';
const limit = 10; // limite de jogos por dia
const email = 'lucaspsrrio@gmail.com'; // seu email aqui
const today = new Date();                   // atenção ao fuso: Chess.com usa UTC
const Y = today.getUTCFullYear();
const M = String(today.getUTCMonth() + 1).padStart(2, '0');
const D = String(today.getUTCDate()).padStart(2, '0');
const DATE_TAG = `${Y}.${M}.${D}`;          // ex.: 2024.06.02

const url = `https://api.chess.com/pub/player/${USER}/games/${Y}/${M}`;

const res = await fetch(url, {
  headers: {'User-Agent': `ChessBot/1.0 (${email})`},
});
if (!res.ok) throw new Error(`Erro ${res.status} na API`);

const {games} = await res.json();

let wins = 0, losses = 0, draws = 0;

games
  .filter(g => g.pgn?.includes(`[Date "${DATE_TAG}"]`))             // só o dia de hoje
  .forEach(g => {
     const side = (g.white.username.toLowerCase() === USER) ? 'white' : 'black';
     const result = g[side].result;
     if (result === 'win') wins++;
     else if (['resigned','checkmated','timeout','loss'].includes(result)) losses++;
     else draws++;                               // “agreed”, “stalemate”, etc.
  });

console.log(format(
  '%s ➜ %d jogos hoje: %d W / %d L / %d D',
  USER, wins + losses + draws, wins, losses, draws
));

