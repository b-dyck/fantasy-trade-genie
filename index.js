require('dotenv').config();
const fs = require('fs');
const https = require('https');
const axios = require('axios');
const express = require('express');
const app = express();
const port = 8443;
const querystring = require('querystring');

const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.get('/', (req, res) => {
  res.send('Fantasy trade app');
})

//callback not using callback due to ngrok restictions
app.get('/callback', (req, res) => {
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
          const {access_token, refresh_token, expires_in, token_type} = response.data;

          const queryParams = querystring.stringify({
            access_token,
            refresh_token,
            expires_in,
            token_type
          })

          leagueKey = 'nhl.l.34621';

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

app.get('/refresh_token', (req, res) => {
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

app.get('/login', (req, res) => {
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


const httpsServer = https.createServer(credentials, app);
httpsServer.listen(port, () => {
    console.log('Express app listening at https://localhost:8443');
});

