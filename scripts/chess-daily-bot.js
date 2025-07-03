// Node ≥18 já tem fetch; para Node 16: npm i node-fetch@3
const axios = require('axios');

(async () => {
  // Load environment variables from .env file when running locally
  if (process.env.NODE_ENV !== 'production' && !process.env.GITHUB_ACTIONS) {
    try {
      const dotenv = await import('dotenv');
      dotenv.config();
      console.log('📄 Loaded .env file for local development');
    } catch (err) {
      console.log('⚠️  No .env file found or dotenv not installed');
    }
  }

  const {
    CHESS_USER,
    DAILY_LIMIT = 10,
    TICKTICK_ACCESS_TOKEN,
    TICKTICK_PROJECT_ID,
    USER_EMAIL = 'bot@example.com',
    ACTION_MODE = 'UPDATE',
    TASK_TITLE = 'Daily chess'
  } = process.env;

  if (!TICKTICK_ACCESS_TOKEN) {
    console.error('❌ Error: TICKTICK_ACCESS_TOKEN must be set.');
    console.log('Please run "node scripts/get-refresh-token.js" to get your access token and set it in your environment.');
    process.exit(1);
  }

  /* ---------- 1. Pega partidas de hoje ---------- */
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dTag = `${y}.${m}.${String(now.getUTCDate()).padStart(2, '0')}`;

  const chessURL = `https://api.chess.com/pub/player/${CHESS_USER}/games/${y}/${m}`;
  const cRes = await axios.get(chessURL, { headers: { 'User-Agent': `gh-chess-bot (${USER_EMAIL})` } });
  const { games } = cRes.data;

  let w = 0, l = 0, dr = 0;
  games.filter(g => g.pgn?.includes(`[Date "${dTag}"]`))
    .forEach(g => {
      const me = g.white.username.toLowerCase() === CHESS_USER ? g.white : g.black;
      if (me.result === 'win') w++;
      else if (['resigned', 'checkmated', 'timeout', 'loss'].includes(me.result)) l++;
      else dr++;
    });
  const total = w + l + dr;

  /* ---------- 2. Localiza a tarefa "Daily chess" de hoje ---------- */
  const api = 'https://api.ticktick.com/open/v1';
  const hdr = {
    'Authorization': `Bearer ${TICKTICK_ACCESS_TOKEN}`,
    'Accept': 'application/json'
  };

  console.log('🔍 Fetching tasks from TickTick project...');
  let tickTickData;
  try {
    const tasksResponse = await axios.get(`${api}/project/${TICKTICK_PROJECT_ID}/data`, { headers: hdr });
    tickTickData = tasksResponse.data;
  } catch (error) {
    console.error('❌ TickTick API Error:', error.response ? error.response.data : error.message);
    process.exit(1);
  }

  const todayTask = tickTickData.tasks.find(t => {
    const dueDate = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : null;
    return t.title === TASK_TITLE && dueDate === now.toISOString().slice(0, 10);
  });

  if (!todayTask) {
    console.error(`⚠️  Task with title "${TASK_TITLE}" for today not found.`);
    process.exit(1);
  }

  console.log(`📅 Found task "${todayTask.title}" for today with ID ${todayTask.id}. Here's the raw data: ${todayTask}`);

  /* ---------- 3. Decide status ---------- */
  let newStatus = todayTask.status;
  if (total >= DAILY_LIMIT) newStatus = 2; // completed
  else if (ACTION_MODE === 'FINAL') newStatus = 3; // won't do

  const newContent = `Jogos hoje: ${total}  (${w}W ${dr}D ${l}L)`;

  /* ---------- 4. Check if update is needed ---------- */
  const statusChanged = newStatus !== todayTask.status;
  const contentChanged = newContent !== todayTask.content;

  if (!statusChanged && !contentChanged) {
    console.log(`✅ No changes needed. Status: ${newStatus}, Content: "${newContent}"`);
  } else {
    console.log(`🔄 Updating task - Status changed: ${statusChanged}, Content changed: ${contentChanged}`);
    console.log(`   Status: ${todayTask.status} → ${newStatus}`);
    console.log(`   Content: "${todayTask.content}" → "${newContent}"`);

    /* ---------- 5. Atualiza tarefa ---------- */
    try {
      await axios.post(`${api}/task/${todayTask.id}`, {
        projectId: TICKTICK_PROJECT_ID,
        id: todayTask.id,
        status: newStatus,
        content: newContent
      }, {
        headers: { ...hdr, 'Content-Type': 'application/json' }
      });
      console.log('✅ Task updated successfully');
    } catch (error) {
      console.error('❌ Failed to update TickTick task:', error.response ? error.response.data : error.message);
      process.exit(1);
    }
  }

  console.log(`[${ACTION_MODE}] ${total} jogos - ${w}W ${dr}D ${l}L - status→${newStatus}`);
})();