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
  if (openCount < 0) {
    console.log('Negative count at line:', i+1);
    break;
  }
}
console.log('Final openCount:', openCount);
if (openCount === 1) {
  // search backwards for large blocks
  console.log('Open blocks at end:');
  let count = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    for (let j = line.length - 1; j >= 0; j--) {
      if (line[j] === '}') count--;
      if (line[j] === '{') {
        count++;
        if (count > 0) {
          console.log('Unclosed at line:', i+1, line);
          count--; // reset
        }
      }
    }
  }
}
