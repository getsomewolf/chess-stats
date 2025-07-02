const http = require('http');
const url = require('url');
const { URLSearchParams } = require('url');

// Using dynamic import for fetch to support both CommonJS and ESM environments
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => global.fetch(...args));

// Load .env file for local development
try {
  require('dotenv').config();
} catch (err) {
  console.log('⚠️  dotenv not installed, expecting environment variables to be set manually.');
}

const {
  TICKTICK_CLIENT_ID,
  TICKTICK_CLIENT_SECRET
} = process.env;

const REDIRECT_URI = 'http://localhost:3000/callback'; // Make sure this matches the one in your TickTick app settings
const PORT = 3000;

if (!TICKTICK_CLIENT_ID || !TICKTICK_CLIENT_SECRET) {
  console.error('❌ Error: TICKTICK_CLIENT_ID and TICKTICK_CLIENT_SECRET must be set in your .env file.');
  console.log('Please go to https://developer.ticktick.com/manage to create an app and get your credentials.');
  console.log('Also, make sure to set the Redirect URI in your TickTick app to:', REDIRECT_URI);
  process.exit(1);
}

const main = async () => {
  const server = http.createServer();

  const serverPromise = new Promise((resolve, reject) => {
    server.on('request', async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true);
        if (parsedUrl.pathname === '/callback') {
          const authCode = parsedUrl.query.code;
          if (!authCode) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Error: No authorization code received.');
            reject(new Error('No authorization code received.'));
            return;
          }

          console.log('✅ Authorization code received. Exchanging for refresh token...');

          const tokenUrl = 'https://ticktick.com/oauth/token';
          const params = new URLSearchParams();
          params.append('client_id', TICKTICK_CLIENT_ID);
          params.append('client_secret', TICKTICK_CLIENT_SECRET);
          params.append('code', authCode);
          params.append('grant_type', 'authorization_code');
          params.append('redirect_uri', REDIRECT_URI);

          const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
          });

          const tokenData = await tokenResponse.json();

          if (tokenData.error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Error fetching token: ${tokenData.error_description}`);
            reject(new Error(`Token API Error: ${tokenData.error_description}`));
            return;
          }

          const accessToken = tokenData.access_token;

          console.log('🎉 Success! Here is your Refresh Token:');
          console.log(JSON.stringify(tokenData, null, 2));
          console.log('================================================================');
          console.log(accessToken);
          console.log('================================================================');
          console.log('📋 Copy this token and save it as TICKTICK_ACCESS_TOKEN in your .env file or GitHub secrets.');

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Successful!</h1><p>You can close this window now.</p>');
          resolve(accessToken);
        }
      } catch (error) {
        reject(error);
      }
    });

    server.listen(PORT, (err) => {
      if (err) {
        return reject(err);
      }
      const scope = 'tasks:write tasks:read';
      const authUrl = `https://ticktick.com/oauth/authorize?scope=${scope}&client_id=${TICKTICK_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;

      console.log('****************************************************************');
      console.log('** TickTick OAuth 2.0 Access Token Generator **');
      console.log('****************************************************************');
      console.log('1. Open the following URL in your browser:');
      console.log(authUrl);
      console.log('2. Log in to TickTick and authorize the application.');
      console.log(`3. You will be redirected back to your computer (localhost).`);
      console.log(`Listening on http://localhost:${PORT}...`);
    });
  });

  try {
    await serverPromise;
  } catch (error) {
    console.error('❌ An error occurred:', error.message);
  } finally {
    console.log('Shutting down server.');
    server.close();
  }
};

main();