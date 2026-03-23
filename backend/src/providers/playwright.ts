// Simple singleton to reuse a single Chromium instance across requests
// Reduces cold-start overhead and speeds up consecutive searches

let browserInstance: any | null = null;

export async function getBrowser() {
  // Lazy import to avoid hard dependency during build
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('playwright');
  if (!browserInstance) {
    const cdpUrl = String(process.env.PLAYWRIGHT_CDP_URL || '').trim();
    const cdpRequired =
      process.env.PLAYWRIGHT_CDP_REQUIRED === '1' ||
      process.env.PLAYWRIGHT_CDP_REQUIRED === 'true';

    if (cdpUrl) {
      try {
        browserInstance = await chromium.connectOverCDP(cdpUrl);
        return browserInstance;
      } catch (err) {
        if (cdpRequired) {
          throw err;
        }
      }
    }

    const headless = !(
      process.env.PLAYWRIGHT_HEADLESS === '0' ||
      process.env.PLAYWRIGHT_HEADLESS === 'false'
    );
    const preferredChannel = String(process.env.PLAYWRIGHT_BROWSER_CHANNEL || '').trim();
    const launchOptions: any = {
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1366,860',
      ],
    };

    if (preferredChannel) {
      launchOptions.channel = preferredChannel;
    }

    try {
      browserInstance = await chromium.launch(launchOptions);
    } catch (err: any) {
      // Fallback to bundled Chromium if preferred channel (e.g., chrome/msedge) is unavailable.
      if (preferredChannel) {
        delete launchOptions.channel;
        browserInstance = await chromium.launch(launchOptions);
      } else {
        throw err;
      }
    }
  }
  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    try { await browserInstance.close(); } catch {}
    browserInstance = null;
  }
}
