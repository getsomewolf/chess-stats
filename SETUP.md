# Chess Daily Bot Setup

## Local Development

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Set up environment variables:**

    Create a `.env` file in the root of the project.

3. **Get your TickTick API Credentials:**

    - Go to the [TickTick Developer Console](https://developer.ticktick.com/manage) and create a new app.
    - Set the "Redirect URI" in your TickTick app settings to `http://localhost:3000/callback`.
    - Add your `TICKTICK_CLIENT_ID` and `TICKTICK_CLIENT_SECRET` to your `.env` file:

      ```
      TICKTICK_CLIENT_ID=your_client_id
      TICKTICK_CLIENT_SECRET=your_client_secret
      ```

4. **Generate your Access Token:**

    - Run the `get-refresh-token.js` script:

      ```bash
      node scripts/get-refresh-token.js
      ```

    - Follow the instructions in the terminal: open the URL in your browser, authorize the app, and you will be redirected.
    - The script will print your `access_token`. Copy it.

5. **Complete your `.env` file:**

    Add the following variables to your `.env` file:
    - `CHESS_USER`: Your Chess.com username.
    - `TICKTICK_ACCESS_TOKEN`: The token you just generated.
    - `TICKTICK_PROJECT_ID`: The ID of the TickTick project you want to update.
    - `TIMEZONE` (optional): Your local timezone for accurate date calculations (e.g., `America/Sao_Paulo`, `America/New_York`, `Europe/London`). Defaults to `UTC`.

6. **Run the bot:**

    ```bash
    node scripts/chess-daily-bot.js
    ```

## GitHub Actions (Production)

For GitHub Actions, the script will automatically use repository secrets instead of the `.env` file.

Set up the following repository secrets in GitHub:

- `CHESS_USER`
- `TICKTICK_ACCESS_TOKEN`
- `TICKTICK_PROJECT_ID`
- `USER_EMAIL` (optional)
- `ACTION_MODE` (optional)
- `TASK_TITLE` (optional)
- `TIMEZONE` (optional): Your local timezone for accurate date calculations (e.g., `America/Sao_Paulo`, `America/New_York`, `Europe/London`). Defaults to `UTC`.

The script automatically detects when it's running in GitHub Actions (`GITHUB_ACTIONS` environment variable) and skips loading the `.env` file.

## How it works

- **Local development**: Loads variables from `.env` file.
- **GitHub Actions**: Uses repository secrets directly.
- **Production**: Set `NODE_ENV=production` to skip `.env` loading.

The `.env` file is gitignored and won't be committed to the repository.
