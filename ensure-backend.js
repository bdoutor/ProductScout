// Lightweight helper to ensure backend is running before starting the frontend
// Uses only built-in Node modules

const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');

const PORT = process.env.BACKEND_PORT || 3001;
const HEALTH_URL = `http://localhost:${PORT}/health`;

function pingHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      const ok = res.statusCode === 200;
      res.resume();
      resolve(ok);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForBackend(maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await pingHealth();
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  const alreadyUp = await pingHealth();
  if (alreadyUp) {
    console.log(`[ensure-backend] Backend already running on ${HEALTH_URL}`);
    return;
  }

  // If port is busy but health is not OK, try to free it (Windows only)
  if (process.platform === 'win32') {
    try {
      const out = execSync('netstat -ano | findstr ":3001" | findstr LISTENING', { stdio: ['ignore', 'pipe', 'ignore'], shell: true }).toString();
      const match = out.match(/\s(\d+)\s*$/m);
      if (match) {
        const pid = match[1];
        console.warn(`[ensure-backend] Port 3001 busy (PID ${pid}). Terminating process...`);
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', shell: true });
      }
    } catch {}
  }

  console.log('[ensure-backend] Backend not running, starting dev server...');
  const backendCwd = path.join(__dirname, 'backend');
  let started = false;
  try {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe') : 'npm';
    const args = isWin ? ['/d', '/s', '/c', 'npm run dev'] : ['run', 'dev'];

    const child = spawn(cmd, args, {
      cwd: backendCwd,
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
    child.on('error', (err) => {
      console.warn('[ensure-backend] Failed to spawn backend process:', err.message);
    });
    child.unref();
    started = true;
  } catch (err) {
    console.warn('[ensure-backend] Failed to start backend process:', err.message);
  }

  if (!started) {
    console.warn('[ensure-backend] Backend process did not start. Frontend will still start.');
    return;
  }

  const ready = await waitForBackend(45000);
  if (ready) {
    console.log('[ensure-backend] Backend is up.');
  } else {
    console.warn('[ensure-backend] Backend did not become healthy in time. Frontend will still start.');
  }
}

main().catch((err) => {
  console.error('[ensure-backend] Unexpected error:', err);
});
