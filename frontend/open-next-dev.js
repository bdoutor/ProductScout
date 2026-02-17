const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3000;
const url = `http://localhost:${PORT}`;

function openBrowser(targetUrl) {
  const platform = process.platform;
  if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', targetUrl], { stdio: 'ignore', detached: true }).unref();
  } else if (platform === 'darwin') {
    spawn('open', [targetUrl], { stdio: 'ignore', detached: true }).unref();
  } else {
    spawn('xdg-open', [targetUrl], { stdio: 'ignore', detached: true }).unref();
  }
}

function nextBin() {
  const binBase = path.join(__dirname, 'node_modules', '.bin');
  const ext = process.platform === 'win32' ? '.cmd' : '';
  return path.join(binBase, `next${ext}`);
}

// Optionally ensure backend unless explicitly skipped (used by VS Code compound)
async function ensureBackendIfNeeded() {
  if (process.env.SKIP_ENSURE_BACKEND === '1') return;
  await new Promise((resolve) => {
    const child = spawn('node', ['..\\ensure-backend.js'], { shell: true, cwd: __dirname, stdio: 'inherit' });
    child.on('exit', () => resolve());
  });
}

let opened = false;

(async () => {
  await ensureBackendIfNeeded();
  // Use npm to run next dev so .cmd works reliably on Windows
  const child = spawn('npm', ['run', 'dev:raw'], { stdio: ['ignore', 'pipe', 'pipe'], shell: true, cwd: __dirname });

function scanOutput(data) {
  const text = data.toString();
  process.stdout.write(text);
  if (!opened && /http:\/\/localhost:3000\b/.test(text)) {
    opened = true;
    openBrowser(url);
  }
}

  child.stdout.on('data', scanOutput);
  child.stderr.on('data', scanOutput);

  child.on('error', (err) => {
    console.error('[open-next-dev] Failed to start Next dev:', err.message);
  });

  child.on('exit', (code) => {
    console.log('[open-next-dev] Next dev exited with code', code);
    process.exit(code || 0);
  });
})();
