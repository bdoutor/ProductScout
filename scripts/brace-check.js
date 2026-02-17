const fs = require('fs');
const path = process.argv[2];
const text = fs.readFileSync(path, 'utf8');
let count = 0;
let line = 1, col = 0;
let firstNeg = null;
for (let i = 0; i < text.length; i++) {
  const ch = text[i];
  if (ch === '{') count++;
  if (ch === '}') count--;
  if (ch === '\n') { line++; col = 0; } else { col++; }
  if (count < 0 && !firstNeg) firstNeg = { line, col };
}
console.log('balance=', count, ' firstNeg=', firstNeg);
