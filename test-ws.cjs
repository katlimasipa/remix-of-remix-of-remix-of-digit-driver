const WebSocket = require('ws');

const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=33CVw800TTYMR0RcYLNfx');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ ping: 1 }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
  ws.close();
});
