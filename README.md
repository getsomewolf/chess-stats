# Chess Daily Stats to TickTick Bot

This project contains a Node.js script that automates updating a [TickTick](https://ticktick.com) task with your daily game statistics from [Chess.com](https://chess.com).

## Objective

The main goal is to fetch the number of chess games played on the current day and update a specific task in TickTick. This is useful for tracking daily goals, such as playing a certain number of games.

The bot will:

1. Fetch your daily games from the Chess.com public API.
2. Count the number of wins, losses, and draws.
3. Find a specific task in your TickTick account (e.g., "Daily Chess").
4. Update the task's status and add the game results to its content.

## Key Features

- **Enhanced Task Content**: Rich, emoji-enhanced task descriptions with detailed chess statistics including points gained, percentages, and total play time.
- **Configurable Detail Levels**: Choose between brief mode (enhanced summary) or detailed mode (individual game listings with time, duration, opponent details).
- **Points System**: Automatic calculation of points gained (+1 win, +0.5 draw, 0 loss) with visual indicators.
- **Comprehensive Statistics**: Win/loss/draw percentages alongside quantities for better performance insights.
- **Time Tracking**: Total daily play time calculated from individual game durations.
- **Intelligent Task Management**: The bot automatically handles task transitions between days by completing previous day's tasks when needed.
- **Time-Zone Aware**: Uses your configured timezone to determine when it's the "final" time of day to mark uncompleted tasks.
- **Automatic Task Creation**: Works with TickTick's recurring task feature - when a previous day's task is completed, TickTick automatically creates the next day's task.
- **Flexible Scheduling**: Runs on a single 30-minute interval but intelligently determines its behavior based on time of day.
- **Backward Compatibility**: Maintains compatibility with existing task content formats.

## Task Content Examples

### Brief Mode (Default)
Enhanced summary with emojis, points, percentages, and total play time:

```
♟️ Daily Chess: 8 Games (5W 1D 2L) | +5.5 Pts 🟢 | 63%W 13%D 25%L | Total Play Time: 1h 20min
```

### Detailed Mode
Same as brief mode plus individual game listings with match details:

```
♟️ Daily Chess: 8 Games (5W 1D 2L) | +5.5 Pts 🟢 | 63%W 13%D 25%L | Total Play Time: 1h 20min

Today's Matches:
09:15 | 10min | vs. ChessMaster: Win by checkmate 🏆
10:30 | 15min | vs. Knight2024: Win by resignation 🏆
11:45 | 20min | vs. PawnStorm: Loss by timeout 💔
14:20 | 7min | vs. QueenGambit: Win by checkmate 🏆
15:35 | 12min | vs. RookEndgame: Draw by agreement 🤝
16:50 | 5min | vs. BishopPair: Loss by checkmate 💔
18:10 | 9min | vs. KingHunter: Win by resignation 🏆
19:25 | 8min | vs. TacticMaster: Win by timeout 🏆
```

Set `DETAILED_TASK_CONTENT=true` in your environment to enable detailed mode.

## Setup and Configuration

For detailed instructions on how to set up and run the bot for local development or as a GitHub Action, please refer to the **[Setup Guide](SETUP.md)**.
