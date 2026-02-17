const http = require('http');
const data = JSON.stringify({ query: 'filtro' });
const opts = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(opts, (res) => {
  let body = '';
  res.on('data', (c) => body += c);
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log(body.slice(0, 2000));
  });
});
req.on('error', (e) => console.error(e));
req.write(data);
req.end();
