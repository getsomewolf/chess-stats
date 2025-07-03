# Chess Daily Stats to TickTick Bot

This project contains a Node.js script that automates updating a [TickTick](https://ticktick.com) task with your daily game statistics from [Chess.com](https://chess.com).

## Objective

The main goal is to fetch the number of chess games played on the current day and update a specific task in TickTick. This is useful for tracking daily goals, such as playing a certain number of games.

The bot will:

1. Fetch your daily games from the Chess.com public API.
2. Count the number of wins, losses, and draws.
3. Find a specific task in your TickTick account (e.g., "Daily Chess").
4. Update the task's status and add the game results to its content.

## Setup and Configuration

For detailed instructions on how to set up and run the bot for local development or as a GitHub Action, please refer to the **[Setup Guide](SETUP.md)**.
