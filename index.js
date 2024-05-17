require('dotenv').config();
const fs = require('fs');
const next = require('next')
const https = require('https');
const axios = require('axios');
const express = require('express');
const querystring = require('querystring');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: './my-app' });
const handle = app.getRequestHandler();

const port = 8443;

const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.prepare().then(() => {
  const server = express();

  server.use(express.json());

  server.get('/callback', (req, res) => {
    const code = req.query.code || null;
    console.log(`${code}`);
  
    axios({
      method: 'post',
      url: 'https://api.login.yahoo.com/oauth2/get_token',
      data: querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      },
    })
      .then(response => {
        if (response.status === 200) {
          const { access_token, refresh_token, expires_in, token_type } = response.data;

          const queryParams = querystring.stringify({
            access_token,
            refresh_token,
            expires_in,
            token_type
          });

          const leagueKey = 'nhl.l.34621';

          axios.get(`https://localhost:${port}/refresh_token?refresh_token=${refresh_token}`, {
            httpsAgent: new https.Agent({
              rejectUnauthorized: false
            })
          })
          .then(response => {
            res.send(`<pre>${JSON.stringify(response.data, null, 2)}</pre>`);
          })
          .catch(error => {
            res.send(error);
          });

          // Uncomment and use the code below to make a direct API call to Yahoo
          // axios.get(`https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}`, {
          //   headers: {
          //     'Authorization': `Bearer ${access_token}`,
          //     'Accept': 'application/json'
          //   }
          // })
          // .then(apiResponse => {
          //   res.send(`<pre>${JSON.stringify(apiResponse.data, null, 2)}</pre>`);
          // })
          // .catch(error => {
          //   res.send(error);
          // });
        } else {
          res.send(response);
        }
      })
      .catch(error => {
        res.send(error);
      });
  });

  server.get('/refresh_token', (req, res) => {
    const { refresh_token } = req.query;

    axios({
      method: 'post',
      url: 'https://api.login.yahoo.com/oauth2/get_token',
      data: querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      },
    })
    .then(response => {
      console.log('this is coming from the refresh route');
      res.send(response.data);
    })
    .catch(error => {
      res.send(error);
    });
  });

  const generateRandomString = length => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };
  
  const stateKey = 'yahoo_auth_state';

  server.get('/login', (req, res) => {
    const state = generateRandomString(16);
    res.cookie(stateKey, state);
    const queryParams = querystring.stringify({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      state: state,
    });

    res.redirect(`https://api.login.yahoo.com/oauth2/request_auth?${queryParams}`);
  });

  // Use the Next.js request handler for all other routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  const httpsServer = https.createServer(credentials, server);
  httpsServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${port}`);
  });
});


