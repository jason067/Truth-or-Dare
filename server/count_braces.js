const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');
let openCount = 0;
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') openCount++;
    if (line[j] === '}') openCount--;
  }
}
console.log('Final openCount:', openCount);
