const https = require('https');
const data = JSON.stringify({ taskId: 'task-46', toColumn: 'in-progress' });
const req = https.request('https://arc-forge-rho.vercel.app/api/board/move', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer QMNTd7ujHSYvjK7LFBcgXaENz5jh9Ut9', 'Content-Type': 'application/json', 'Content-Length': data.length }
}, res => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>console.log(b)); });
req.write(data);
req.end();
