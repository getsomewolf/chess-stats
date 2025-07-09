// Node ≥18 já tem fetch; para Node 16: npm i node-fetch@3
const axios = require('axios');



(async () => {
  // Load environment variables from .env file when running locally
  if (process.env.NODE_ENV !== 'production' && !process.env.GITHUB_ACTIONS) {
    // Suppress dotenv's new tip message
    process.env.DOTENV_CONFIG_SUPPRESS = 'true';
    try {
      const dotenv = await import('dotenv');
      dotenv.config({ debug: process.env.NODE_ENV === 'debug' });
      console.log('📄 Loaded .env file for local development');
    } catch (err) {
      console.log('⚠️  No .env file found or dotenv not installed');
    }
  }

  // Disable debug logs unless NODE_ENV='debug' is set
  if (process.env.NODE_ENV !== 'debug') {
    console.debug = () => { };
  }

  const {
    CHESS_USER,
    DAILY_LIMIT = 10,
    TICKTICK_ACCESS_TOKEN,
    TICKTICK_PROJECT_ID,
    USER_EMAIL = 'bot@example.com',
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

  // Create a formatter to get time in the target timezone
  const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Get today's date string (YYYY-MM-DD) in the target timezone
  const todayDateString = timezoneFormatter.format(now);
  const [y, m] = todayDateString.split('-');

  // Get yesterday's date string
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDateString = timezoneFormatter.format(yesterday);

  // Next day's date string (for reference, not used in logic)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDateString = timezoneFormatter.format(tomorrow);

  // Determine if it's "final time" (after 23:00 in user's timezone)
  const currentTime = timeFormatter.format(now);
  const [hour, minute] = currentTime.split(':').map(Number);
  const isFinalTime = hour >= 23;

  console.debug(`📅 Today in ${TIMEZONE}: ${todayDateString}`);
  console.debug(`📅 Yesterday in ${TIMEZONE}: ${yesterdayDateString}`);
  console.debug(`🕐 Current time in ${TIMEZONE}: ${currentTime} (Final time: ${isFinalTime})`);

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

    //console.debug(`🔍 Processing game: ${g.url} (${g.end_time})`);

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

    //console.debug(`Game date in ${TIMEZONE}: ${gameDateString}`);

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
    'Accept': 'application/json',
    'Content-Type': 'application/json'
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

  // TickTick status constants
  const TICKTICK_STATUS_TODO = 0; // Not started
  const TICKTICK_STATUS_COMPLETED = 2;
  const TICKTICK_STATUS_WONT_DO = -1;

  // Helper function to find task by date
  const findTaskByDate = (dateString) => {
    return tickTickData.tasks.find(t => {
      if (!t.startDate) return false;
      // TickTick's startDate is like "2025-07-03T18:00:00.000+0000"
      // We just need the date part, which is already in UTC.
      const taskStartDate = t.startDate.slice(0, 10);
      return t.title === TASK_TITLE && taskStartDate === dateString;
    });
  };

  // Helper function to extract game count from task content
  const extractGameCountFromContent = (content) => {
    if (!content) return 0;
    const match = content.match(/Jogos\s+(?:hoje|ontem):\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Helper function to check if task was completed by reaching daily limit
  const wasCompletedByLimit = (task) => {
    if (!task) return false;
    const gameCount = extractGameCountFromContent(task.content);
    console.debug(`🔍 Checking if task "${task.title}" was completed by reaching daily limit: ${gameCount} games`);
    return gameCount >= DAILY_LIMIT;
  };

  // Helper function to complete a task using the /complete endpoint
  const completeTask = async (taskId, taskDescription = 'task') => {
    try {
      console.log(`🔄 Completing ${taskDescription}...`);
      await axios.post(`${api}/project/${TICKTICK_PROJECT_ID}/task/${taskId}/complete`, {}, {
        headers: { ...hdr }
      });
      console.log(`✅ ${taskDescription} completed successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to complete ${taskDescription}:`, error.response ? error.response.data : error.message);
      return false;
    }
  };

  // Helper function to update task content and status
  const updateTask = async (taskId, updates, taskDescription = 'task') => {
    try {
      await axios.post(`${api}/task/${taskId}`, {
        projectId: TICKTICK_PROJECT_ID,
        id: taskId,
        isAllDay: true,
        ...updates
      }, {
        headers: { ...hdr }
      });
      console.log(`✅ ${taskDescription} updated successfully`);
      console.debug(`   Updates: ${JSON.stringify(updates)}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update ${taskDescription}:`, error.response ? error.response.data : error.message);
      return false;
    }
  };

  const createTask = async (title, content, dateString) => {
    try {
      const taskData = {
        projectId: TICKTICK_PROJECT_ID,
        title: title,
        content: content,
        startDate: `${dateString}T00:00:00.000+0000`,
        dueDate: `${dateString}T23:59:59.999+0000`, // TickTick expects dueDate in this format
        isAllDay: true,
        status: TICKTICK_STATUS_TODO,
        priority: 3,
        timeZone: TIMEZONE
        // repeatFlag: "RRULE:FREQ=DAILY;INTERVAL=1",
      }
      console.log(`🔄 Creating task for ${dateString}...`);
      await axios.post(`${api}/task`, taskData, {
        headers: { ...hdr }
      });
      console.log(`✅ Task for ${dateString} created successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to create task for ${dateString}:`, error.response ? error.response.data : error.message);
      return false;
    }
  };

  // First, try to find today's task
  let todayTask = findTaskByDate(todayDateString);

  if (!todayTask) {
    console.log(`⚠️  Task with title "${TASK_TITLE}" for today not found. Checking yesterday...`);

    // Look for yesterday's task
    const yesterdayTask = findTaskByDate(yesterdayDateString);

    if (yesterdayTask) {
      console.log(`📅 Found yesterday's task "${yesterdayTask.title}" with ID ${yesterdayTask.id}, status: ${yesterdayTask.status}.`);
      const wasCompleted = wasCompletedByLimit(yesterdayTask);
      // Check if yesterday's task was already completed by reaching the daily limit
      if (wasCompleted && yesterdayTask.status === TICKTICK_STATUS_COMPLETED) {
        console.log('✅ Yesterday\'s task was already completed by reaching the daily limit. No need to complete it again.');
      } else if (yesterdayTask.status === TICKTICK_STATUS_WONT_DO) {
        console.log('✅ Yesterday\'s task is already marked as "Won\'t Do". No action needed.');
      } else if (yesterdayTask.status === TICKTICK_STATUS_TODO) {
        console.log('✅ Yesterday\'s task is marked as "To Do". Completing it now...');
        if (wasCompleted) {
          console.log('✅ Yesterday\'s task is already completed by limit, but not checked as properly.');
          // Complete yesterday's task only if it wasn't completed by reaching the limit
          const completed = await completeTask(yesterdayTask.id, "yesterday's task");
          if (!completed) {
            console.log('⚠️  Could not complete yesterday\'s task, but continuing...');
          }
        } else {
          console.log('✅ Yesterday\'s task is not completed || failed.');
          const updated = await updateTask(yesterdayTask.id, {
            status: TICKTICK_STATUS_WONT_DO
          }, "yesterday's task");
          if (!updated) {
            console.log('⚠️  Could not update yesterday\'s task, but continuing...');
            process.exit(1);
          }

          console.log('✅ Yesterday\'s task marked as "Won\'t Do".');

        }
        // Now try to create today's task
        const created = await createTask(TASK_TITLE, `Jogos hoje: ${total} (${stats.w}W ${stats.dr}D ${stats.l}L)`, todayDateString);
        if (!created) {
          console.error('❌ Failed to create today\'s task after processing yesterday\'s task.');
          process.exit(1);
        }
      }
      // Wait a bit for TickTick to potentially create today's task
      console.log('⏳ Waiting for TickTick to create today\'s task...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Re-fetch tasks to get the updated list
      const updatedTasksResponse = await axios.get(`${api}/project/${TICKTICK_PROJECT_ID}/data`, { headers: hdr });
      tickTickData = updatedTasksResponse.data;

      // Try to find today's task again
      todayTask = findTaskByDate(todayDateString);

      if (!todayTask) {
        console.log(`⚠️  Today's task still not found after processing yesterday's task. This is expected if TickTick doesn't auto-create recurring tasks.`);
      }
    } else {
      console.log(`⚠️  No task found for yesterday either. This might be the first run or task doesn't exist.`);
    }
  }

  if (!todayTask) {
    console.error(`⚠️  Task with title "${TASK_TITLE}" for today not found after all attempts.`);
    process.exit(1);
  }

  console.log(`📅 Found task "${todayTask.title}" for today with ID ${todayTask.id}.`);

  /* ---------- 4. Decide status ---------- */
  let newStatus = todayTask.status;
  if (total >= DAILY_LIMIT && isFinalTime) newStatus = TICKTICK_STATUS_COMPLETED; // completed
  else if (isFinalTime) newStatus = TICKTICK_STATUS_WONT_DO; // won't do

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

    /* ---------- 6. Update task ---------- */
    // If we're marking the task as completed (status 2), use the /complete endpoint
    if (newStatus === TICKTICK_STATUS_COMPLETED && statusChanged) {      
      // Update content separately if needed
      if (contentChanged) {
        const updated = await updateTask(todayTask.id, { content: newContent }, "today's task content");
        if (!updated) {
          process.exit(1);
        }
      }

      // Complete the task using the /complete endpoint
      const completed = await completeTask(todayTask.id, "today's task");
      if (!completed) {
        process.exit(1);
      }
    } else {
      // For other status changes or content-only updates, use the regular endpoint
      const updated = await updateTask(todayTask.id, {
        status: newStatus,
        content: newContent
      }, "today's task");
      if (!updated) {
        process.exit(1);
      }
    }

    if (statusChanged) {
      // Now try to create tomorrow's task
      const created = await createTask(TASK_TITLE, `Jogos hoje: ${total} (${stats.w}W ${stats.dr}D ${stats.l}L)`, tomorrowDateString);
      if (!created) {
        console.error('❌ Failed to create tomorrow\'s task after processing today\'s task.');
        process.exit(1);
      }
    }
  }

  const actionMode = isFinalTime ? 'FINAL' : 'UPDATE';
  console.log(`[${actionMode}] ${total} jogos - ${stats.w}W ${stats.dr}D ${stats.l}L - status→${newStatus}`);
})();