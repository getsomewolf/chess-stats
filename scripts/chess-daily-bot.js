// Node ≥18 já tem fetch; para Node 16: npm i node-fetch@3
const axios = require('axios');

(async () => {
  // Load environment variables from .env file when running locally
  if (process.env.NODE_ENV !== 'production' && !process.env.GITHUB_ACTIONS) {
    // Suppress dotenv's new tip message
    process.env.DOTENV_CONFIG_SUPPRESS = 'true';
    try {
      const dotenv = await import('dotenv');
      dotenv.config({ debug: process.env.DEBUG === 'true' });
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
    TASK_TITLE = 'Daily chess',
    TIMEZONE = 'UTC'
  } = process.env;

  if (!TICKTICK_ACCESS_TOKEN) {
    console.error('❌ Error: TICKTICK_ACCESS_TOKEN must be set.');
    console.log('Please run "node scripts/get-refresh-token.js" to get your access token and set it in your environment.');
    process.exit(1);
  }

  /* ---------- 1. Set up Date & Timezone ---------- */
  const now = new Date();

  // Create a formatter to get date parts in the target timezone
  const timezoneFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Get today's date string (YYYY-MM-DD) in the target timezone
  const todayDateString = timezoneFormatter.format(now);
  const [y, m] = todayDateString.split('-');

  console.debug(`📅 Today in ${TIMEZONE}: ${todayDateString}`);

  /* ---------- 2. Fetch Chess.com Games ---------- */
  const fetchGamesForMonth = async (year, month) => {
    const url = `https://api.chess.com/pub/player/${CHESS_USER}/games/${year}/${month}`;
    try {
      const response = await axios.get(url, { headers: { 'User-Agent': `gh-chess-bot (${USER_EMAIL})` } });
      return response.data.games || [];
    } catch (error) {
      // A 404 is expected if there are no games for a month, so we don't log it as an error.
      if (error.response && error.response.status !== 404) {
        console.warn(`⚠️  Could not fetch games for ${year}-${month}: ${error.message}`);
      }
      return [];
    }
  };

  // Fetch games for the current month.
  let games = await fetchGamesForMonth(y, m);

  // Also fetch games for the previous month to handle timezone edge cases.
  const prevMonthDate = new Date(now);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthFormatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit' });
  const [prevY, prevM] = prevMonthFormatter.format(prevMonthDate).split('-');

  // Avoid re-fetching if the previous month is the same as the current one (e.g., timezone doesn't cross month boundary).
  if (`${y}-${m}` !== `${prevY}-${prevM}`) {
    const prevMonthGames = await fetchGamesForMonth(prevY, prevM);
    games = [...prevMonthGames, ...games];
  }

  console.log(`♟️  Found ${games.length} games for ${CHESS_USER} in the last two months. Filtering for ${TIMEZONE}...`);

  const initialStats = { w: 0, l: 0, dr: 0 };
  const stats = games.reduce((acc, g) => {
    // Ensure PGN data is available to parse
    if (!g.pgn) {
      return acc;
    }
    
    console.debug(`🔍 Processing game: ${g.url} (${g.end_time})`);

    // Extract UTC date and time from PGN
    const utcDateMatch = g.pgn.match(/\[UTCDate "(\d{4}\.\d{2}\.\d{2})"\]/);
    const utcTimeMatch = g.pgn.match(/\[UTCTime "(\d{2}:\d{2}:\d{2})"\]/);

    // Skip if the game doesn't have the required date/time tags
    if (!utcDateMatch || !utcTimeMatch) {
      return acc;
    }

    // Convert game's UTC date to the user's timezone and format as YYYY-MM-DD
    const gameUtcDate = new Date(`${utcDateMatch[1].replace(/\./g, '-')}T${utcTimeMatch[1]}Z`);
    const gameDateString = timezoneFormatter.format(gameUtcDate);

    console.debug(`Game date in ${TIMEZONE}: ${gameDateString}`);
    
    // If the game was played today (in the target timezone), count the result
    if (gameDateString === todayDateString) {
      const me = g.white.username.toLowerCase() === CHESS_USER.toLowerCase() ? g.white : g.black;
      if (me.result === 'win') acc.w++;
      else if (['resigned', 'checkmated', 'timeout', 'abandoned'].includes(me.result)) acc.l++;
      else acc.dr++;
    }

    return acc;
  }, initialStats);

  const total = stats.w + stats.l + stats.dr;

  /* ---------- 3. Find TickTick Task ---------- */
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
    if (!t.dueDate) return false;
    // TickTick's dueDate is like "2025-07-03T18:00:00.000+0000"
    // We just need the date part, which is already in UTC.
    const taskDueDate = t.dueDate.slice(0, 10);
    return t.title === TASK_TITLE && taskDueDate === todayDateString;
  });

  if (!todayTask) {
    console.error(`⚠️  Task with title "${TASK_TITLE}" for today not found.`);
    process.exit(1);
  }

  console.log(`📅 Found task "${todayTask.title}" for today with ID ${todayTask.id}. Here's the raw data: ${JSON.stringify(todayTask)}`);

  /* ---------- 4. Decide status ---------- */
  let newStatus = todayTask.status;
  if (total >= DAILY_LIMIT) newStatus = 2; // completed
  else if (ACTION_MODE === 'FINAL') newStatus = 3; // won't do

  const newContent = `Jogos hoje: ${total}  (${stats.w}W ${stats.dr}D ${stats.l}L)`;

  /* ---------- 5. Check if update is needed ---------- */
  const statusChanged = newStatus !== todayTask.status;
  const contentChanged = newContent !== todayTask.content;

  if (!statusChanged && !contentChanged) {
    console.log(`✅ No changes needed. Status: ${newStatus}, Content: "${newContent}"`);
  } else {
    console.log(`🔄 Updating task - Status changed: ${statusChanged}, Content changed: ${contentChanged}`);
    console.log(`   Status: ${todayTask.status} → ${newStatus}`);
    console.log(`   Content: "${todayTask.content}" → "${newContent}"`);

    /* ---------- 6. Atualiza tarefa ---------- */
    try {
      await axios.post(`${api}/task/${todayTask.id}`, {
        projectId: TICKTICK_PROJECT_ID,
        id: todayTask.id,
        status: newStatus,
        content: newContent,
        isAllDay: true
      }, {
        headers: { ...hdr, 'Content-Type': 'application/json' }
      });
      console.log('✅ Task updated successfully');
    } catch (error) {
      console.error('❌ Failed to update TickTick task:', error.response ? error.response.data : error.message);
      process.exit(1);
    }
  }

  console.log(`[${ACTION_MODE}] ${total} jogos - ${stats.w}W ${stats.dr}D ${stats.l}L - status→${newStatus}`);
})();