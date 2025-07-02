// Node ≥18 já tem fetch; para Node 16: npm i node-fetch@3
const fetch = global.fetch || (await import('node-fetch')).default;

(async () => {
  const {
    CHESS_USER,           // ex.: "getsomewolf"
    TICKTICK_TOKEN,       // Open-API token copiado no TickTick
    USER_EMAIL = 'bot@example.com',
    ACTION_MODE = 'UPDATE',       // UPDATE a cada 30 min | FINAL às 23h55 UTC
    TASK_TITLE = 'Daily chess'    // título da tarefa recorrente
  } = process.env;

  /* ---------- 1. Pega partidas de hoje ---------- */
  const now   = new Date();
  const y     = now.getUTCFullYear();
  const m     = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dTag  = `${y}.${m}.${String(now.getUTCDate()).padStart(2, '0')}`;

  const chessURL = `https://api.chess.com/pub/player/${CHESS_USER}/games/${y}/${m}`;
  const cRes     = await fetch(chessURL, { headers:{ 'User-Agent': `gh-chess-bot (${USER_EMAIL})` }});
  const { games } = await cRes.json();

  let w = 0, l = 0, dr = 0;
  games.filter(g => g.pgn?.includes(`[Date "${dTag}"]`))
       .forEach(g => {
          const me = g.white.username.toLowerCase() === CHESS_USER ? g.white : g.black;
          if (me.result === 'win') w++;
          else if (['resigned','checkmated','timeout','loss'].includes(me.result)) l++;
          else dr++;
       });
  const total = w + l + dr;

  /* ---------- 2. Localiza a tarefa "Daily chess" de hoje ---------- */
  const api  = 'https://api.ticktick.com/open/v1';
  const hdr  = { 'Authorization': `Bearer ${TICKTICK_TOKEN}` };

  // só instâncias ativas (status 0)
  const tasks = await fetch(`${api}/task?status=0`, { headers: hdr }).then(r => r.json());

  const todayTask = tasks.find(t => {
    const due = t.dueDate ? new Date(t.dueDate).toISOString().slice(0,10)
                          : null;
    return t.title === TASK_TITLE && due === now.toISOString().slice(0,10);
  });

  if (!todayTask) {
    console.error(`⚠️  Instância de hoje com título "${TASK_TITLE}" não encontrada.`);
    process.exit(1);
  }

  /* ---------- 3. Decide status ---------- */
  let newStatus = todayTask.status;         // 0 = ativa
  if (total >= 10)                  newStatus = 2; // concluída
  else if (ACTION_MODE === 'FINAL') newStatus = 3; // “não farei”

  /* ---------- 4. Atualiza tarefa ---------- */
  await fetch(`${api}/task/${todayTask.id}`, {
    method: 'PUT',
    headers: { ...hdr, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status:  newStatus,
      content: `Jogos hoje: ${total}  (${w}W ${dr}D ${l}L)`
    })
  });

  console.log(`[${ACTION_MODE}] ${total} jogos - ${w}W ${dr}D ${l}L - status→${newStatus}`);
})();
