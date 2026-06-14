const fs = require('fs');
const code = fs.readFileSync('./server.js', 'utf8');
try {
  new Function(code);
  console.log('No syntax error found by Function constructor.');
} catch (e) {
  console.log(e);
}
