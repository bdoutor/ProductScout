// Simple singleton to reuse a single Chromium instance across requests
// Reduces cold-start overhead and speeds up consecutive searches

let browserInstance: any | null = null;

export async function getBrowser() {
  // Lazy import to avoid hard dependency during build
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('playwright');
  if (!browserInstance) {
    const headless = !(
      process.env.PLAYWRIGHT_HEADLESS === '0' ||
      process.env.PLAYWRIGHT_HEADLESS === 'false'
    );
    browserInstance = await chromium.launch({
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1366,860',
      ],
    });
  }
  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    try { await browserInstance.close(); } catch {}
    browserInstance = null;
  }
}
