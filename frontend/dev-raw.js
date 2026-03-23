const { spawn } = require('child_process');
const path = require('path');

function nextBin() {
  const binBase = path.join(__dirname, 'node_modules', '.bin');
  const ext = process.platform === 'win32' ? '.cmd' : '';
  return path.join(binBase, `next${ext}`);
}

const args = ['dev'];
const PORT = process.env.PORT || '3000';
const HOST = process.env.HOST || 'localhost';
if (/^\d+$/.test(String(PORT))) {
  args.push('-p', String(PORT));
}
if (HOST) {
  args.push('-H', HOST);
}

let cmd = nextBin();
let cmdArgs = args;
let options = { stdio: 'inherit' };

if (process.platform === 'win32') {
  cmd = 'cmd';
  cmdArgs = ['/c', nextBin(), ...args];
}

const child = spawn(cmd, cmdArgs, options);
child.on('exit', (code) => process.exit(code || 0));
