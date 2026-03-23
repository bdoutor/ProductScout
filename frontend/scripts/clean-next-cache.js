const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const nextDir = path.join(__dirname, '..', '.next');

function removeWithCmd() {
  if (process.platform !== 'win32') return;
  // cmd rmdir is more resilient on some OneDrive paths than Node fs.rm.
  spawnSync('cmd.exe', ['/d', '/s', '/c', 'if exist ".next" rmdir /s /q ".next"'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
  });
}

function removeWithFs() {
  if (!fs.existsSync(nextDir)) return;
  fs.rmSync(nextDir, { recursive: true, force: true });
}

try {
  removeWithCmd();
  removeWithFs();
  console.log('[clean-next-cache] .next cache cleaned');
} catch (err) {
  console.warn('[clean-next-cache] Failed to fully clean .next:', err && err.message ? err.message : err);
}

