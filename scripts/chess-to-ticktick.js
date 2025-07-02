// Node ≥18: fetch embutido
import fetch from 'node-fetch';

const {
  USER,              // ex.: "getsomewolf"
  TICKTICK_TOKEN,    // token OpenAPI
  TICKTICK_TASK_ID,  // ID da tarefa recorrente
  USER_EMAIL         // e-mail para User-Agent
} = process.env;

// Data UTC gravada pelo Chess.com
const now = new Date();
const Y  = now.getUTCFullYear();
const M  = String(now.getUTCMonth() + 1).padStart(2, '0');
const D  = String(now.getUTCDate()).padStart(2, '0');
const DATE_TAG = `${Y}.${M}.${D}`;

// Baixa jogos do mês
const url = `https://api.chess.com/pub/player/${USER}/games/${Y}/${M}`;
const res = await fetch(url, { headers: { 'User-Agent': `gh-chess-bot (${USER_EMAIL})` } });
const { games } = await res.json();

// Filtra partidas do dia atual
const today = games.filter(g => g.pgn?.includes(`[Date "${DATE_TAG}"]`));

// Placar
let wins = 0, losses = 0, draws = 0;
today.forEach(g => {
  const side   = (g.white.username.toLowerCase() === USER) ? 'white' : 'black';
  const result = g[side].result;
  if (result === 'win')                               wins++;
  else if (['resigned','checkmated','timeout','loss'].includes(result)) losses++;
  else                                                 draws++;
});

const total = wins + losses + draws;

// Atualiza descrição + fecha se ≥10
await fetch(`https://api.ticktick.com/open/v1/task/${TICKTICK_TASK_ID}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TICKTICK_TOKEN}`
  },
  body: JSON.stringify({
    status: total >= 10 ? 2 : 0,                         // 2 = concluído
    content: `Jogos hoje: ${total} (Vitórias: ${wins}, Derrotas: ${losses}, Empates: ${draws})`
  })
});

console.log(`TickTick atualizado → ${total}J / ${wins}W / ${losses}L / ${draws}D`);
