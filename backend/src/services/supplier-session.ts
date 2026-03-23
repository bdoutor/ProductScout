import { supabase } from '../utils/supabase';
import { decryptPassword } from '../utils/secrets';
import { GsmartProvider } from '../providers/gsmart';
import { closeBrowser, getBrowser } from '../providers/playwright';
import { loadSessionCache, saveSessionCache } from '../utils/session-cache';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { getSupplierSessionCacheKey } from '../utils/supplier-utils';

export interface ManualSessionInitResult {
  supplier_name: string;
  cache_key: string;
  cached_cookies: number;
  elapsed_ms: number;
}

function resolveBrowserMode(mode?: string): 'launch' | 'cdp' | 'cdp_prefer' {
  const value = String(mode || '').trim().toLowerCase();
  if (value === 'cdp_prefer') return 'cdp_prefer';
  return value === 'cdp' ? 'cdp' : 'launch';
}

function resolveBrowserChannel(preference?: string): string {
  const value = String(preference || '').trim().toLowerCase();
  if (value === 'msedge' || value === 'edge') return 'msedge';
  if (value === 'chrome') return 'chrome';
  return '';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function resolveCdpUrls(preference?: string): string[] {
  const channel = resolveBrowserChannel(preference);
  const candidates =
    channel === 'msedge'
      ? [
          String(process.env.PLAYWRIGHT_CDP_URL_MSEDGE || ''),
          String(process.env.PLAYWRIGHT_CDP_URL || ''),
          'http://127.0.0.1:9223',
          'http://127.0.0.1:9334'
        ]
      : [
          String(process.env.PLAYWRIGHT_CDP_URL_CHROME || ''),
          String(process.env.PLAYWRIGHT_CDP_URL || ''),
          'http://127.0.0.1:9222',
          'http://127.0.0.1:9333'
        ];

  return unique(
    candidates
      .map((url) => String(url || '').trim().replace(/\/$/, ''))
      .filter(Boolean)
  );
}

function resolveExecutableCandidates(channel: string): string[] {
  if (process.platform !== 'win32') return [];

  const isEdge = channel === 'msedge';
  const exe = isEdge ? 'msedge.exe' : 'chrome.exe';
  const vendor = isEdge ? 'Microsoft' : 'Google';
  const product = isEdge ? 'Edge' : 'Chrome';

  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env.LOCALAPPDATA || '';

  const paths = [
    `${programFiles}\\${vendor}\\${product}\\Application\\${exe}`,
    `${programFilesX86}\\${vendor}\\${product}\\Application\\${exe}`,
  ];

  if (localAppData) {
    paths.push(`${localAppData}\\${vendor}\\${product}\\Application\\${exe}`);
  }

  return unique(paths.filter((candidate) => existsSync(candidate)));
}

function resolveLocalCdpPort(cdpUrl: string): number | null {
  try {
    const parsed = new URL(cdpUrl);
    const host = String(parsed.hostname || '').toLowerCase();
    if (host !== '127.0.0.1' && host !== 'localhost') {
      return null;
    }
    const port = Number(parsed.port);
    if (!Number.isFinite(port) || port <= 0) return null;
    return port;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isCdpReachable(cdpUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutRef = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`${cdpUrl}/json/version`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutRef);
  }
}

async function tryStartLocalCdpBrowser(preference: string | undefined, cdpUrls: string[]): Promise<boolean> {
  const channel = resolveBrowserChannel(preference) || 'chrome';
  const executable = resolveExecutableCandidates(channel)[0];
  if (!executable) return false;

  const preferredUrl =
    cdpUrls[0] ||
    (channel === 'msedge' ? 'http://127.0.0.1:9223' : 'http://127.0.0.1:9222');
  const port = resolveLocalCdpPort(preferredUrl);
  if (!port) return false;

  const tempRoot = process.env.TEMP || process.env.TMP || 'C:\\Temp';
  const profileName = channel === 'msedge' ? 'msedge-gsmart-cdp' : 'chrome-gsmart-cdp';
  const userDataDir = `${tempRoot}\\${profileName}`;

  try {
    const child = spawn(
      executable,
      [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--new-window',
        'about:blank'
      ],
      {
        detached: true,
        stdio: 'ignore'
      }
    );
    child.unref();
  } catch {
    return false;
  }

  for (let i = 0; i < 8; i += 1) {
    await sleep(500);
    for (const url of cdpUrls) {
      if (await isCdpReachable(url)) {
        return true;
      }
    }
  }

  return false;
}

function buildCdpHelp(preference?: string, cdpUrl?: string, checkedUrls: string[] = []): string {
  const channel = resolveBrowserChannel(preference) || 'chrome';
  const port = channel === 'msedge' ? '9223' : '9222';
  const targetUrl = cdpUrl || `http://127.0.0.1:${port}`;
  const executable =
    channel === 'msedge'
      ? 'msedge.exe'
      : 'chrome.exe';
  const checked = checkedUrls.length > 0 ? ` Checked endpoints: ${checkedUrls.join(', ')}` : '';
  return `CDP_NOT_AVAILABLE: open ${channel} with remote debugging first (example: "${executable} --remote-debugging-port=${port}"), then retry. Expected endpoint: ${targetUrl}.${checked}`;
}

async function ensureCdpEndpointAvailable(preference?: string): Promise<string> {
  const cdpUrls = resolveCdpUrls(preference);
  const fallbackCdpUrl =
    cdpUrls[0] ||
    (resolveBrowserChannel(preference) === 'msedge' ? 'http://127.0.0.1:9223' : 'http://127.0.0.1:9222');

  for (const cdpUrl of cdpUrls) {
    if (await isCdpReachable(cdpUrl)) {
      return cdpUrl;
    }
  }

  const started = await tryStartLocalCdpBrowser(preference, cdpUrls);
  if (started) {
    for (const cdpUrl of cdpUrls) {
      if (await isCdpReachable(cdpUrl)) {
        return cdpUrl;
      }
    }
  }

  throw new Error(buildCdpHelp(preference, fallbackCdpUrl, cdpUrls));
}

function resolveGsmartLoginUrl(supplier: any, credential: any): string {
  const base = String(supplier?.base_url || 'https://eurocomp.gsmart.eu').replace(/\/$/, '');
  const loginCandidate = String(supplier?.login_url || credential?.url || '').trim();
  if (loginCandidate) {
    try {
      if (/^https?:\/\//i.test(loginCandidate)) return loginCandidate;
      return new URL(loginCandidate, base).href;
    } catch {}
  }
  return `${base}/usuarios/login`;
}

async function initializeGsmartSessionViaManualCdp(
  supplier: any,
  credential: any,
  cacheKey: string,
  browserPreference?: string
): Promise<void> {
  const cdpUrl = await ensureCdpEndpointAvailable(browserPreference);
  process.env.PLAYWRIGHT_CDP_URL = cdpUrl;
  process.env.PLAYWRIGHT_CDP_REQUIRED = 'true';
  process.env.PLAYWRIGHT_HEADLESS = 'false';
  delete process.env.PLAYWRIGHT_BROWSER_CHANNEL;

  await closeBrowser().catch(() => {});
  const browser = await getBrowser();
  const contexts = browser.contexts?.() || [];
  const context = contexts[0];
  if (!context) {
    throw new Error('CDP_CONNECTED_BUT_NO_CONTEXT: open at least one tab in Chrome and retry.');
  }

  const page = await context.newPage();
  const loginUrl = resolveGsmartLoginUrl(supplier, credential);
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Let the user complete captcha + login manually in the real browser.
  const manualTimeoutMs = Math.max(120000, Number(process.env.GSMART_MANUAL_LOGIN_TIMEOUT_MS || '300000'));
  await page.waitForFunction(() => {
    const loginForm = document.querySelector('#UsuarioLoginForm, form[action*="usuarios/login"], input[name="data[Usuario][password]"]');
    if (loginForm) return false;
    const searchBox = document.querySelector('#producto-busqueda-js, input[name="buscar_codigo"], input[name="codigo"], input[name="q"]');
    const logoutHint = document.querySelector('a[href*="logout"], a[href*="usuarios/salir"], a[href*="usuarios/logout"]');
    return Boolean(searchBox || logoutHint);
  }, { timeout: manualTimeoutMs });

  const cookies = await context.cookies();
  if (!cookies || cookies.length === 0) {
    throw new Error('MANUAL_LOGIN_DONE_BUT_NO_COOKIES: no session cookies were found.');
  }
  saveSessionCache(cacheKey, cookies);

  await page.close().catch(() => {});
}

async function initializeGsmartSession(
  query: string,
  browserPreference?: string,
  browserMode?: string
): Promise<ManualSessionInitResult> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data: supplier, error: supplierError } = await supabase
    .from('suppliers')
    .select('*')
    .eq('name', 'GSMART')
    .single();

  if (supplierError || !supplier) {
    throw new Error(`Failed to load GSMART supplier: ${supplierError?.message || 'not found'}`);
  }

  const { data: credential, error: credError } = await supabase
    .from('supplier_credentials')
    .select('*')
    .eq('name', 'GSMART')
    .eq('active', true)
    .single();

  if (credError || !credential) {
    throw new Error(`Failed to load GSMART credentials: ${credError?.message || 'not found'}`);
  }

  let password = '';
  try {
    password = decryptPassword(String(credential.password || ''));
  } catch {
    password = process.env.GSMART_PASSWORD_FALLBACK || String(credential.password || '');
  }

  const rawTemplate = String(supplier.search_url_template || '').trim();
  const fallbackSearch = `${String(supplier.base_url || 'https://eurocomp.gsmart.eu').replace(/\/$/, '')}/search?q={query}`;
  const searchTemplate = rawTemplate || fallbackSearch;
  const searchUrl = searchTemplate.includes('{query}')
    ? searchTemplate.replace('{query}', encodeURIComponent(query))
    : searchTemplate;

  const provider = new GsmartProvider();
  const runtimeCred = { ...credential, password };
  const cacheKey = getSupplierSessionCacheKey(supplier as any);

  const previousHeadless = process.env.PLAYWRIGHT_HEADLESS;
  const previousChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  const previousCdpUrl = process.env.PLAYWRIGHT_CDP_URL;
  const previousCdpRequired = process.env.PLAYWRIGHT_CDP_REQUIRED;
  process.env.PLAYWRIGHT_HEADLESS = 'false';
  const startedAt = Date.now();

  try {
    const mode = resolveBrowserMode(browserMode);
    if (mode === 'cdp') {
      // Strict CDP mode: no automated typing/clicking, user performs manual captcha/login.
      await initializeGsmartSessionViaManualCdp(supplier, credential, cacheKey, browserPreference);
      const cookies = loadSessionCache(cacheKey);
      const cachedCount = Array.isArray(cookies) ? cookies.length : 0;
      if (cachedCount === 0) {
        throw new Error('Session initialized but no cookies were cached.');
      }
      return {
        supplier_name: 'GSMART',
        cache_key: cacheKey,
        cached_cookies: cachedCount,
        elapsed_ms: Date.now() - startedAt,
      };
    }

    if (mode === 'cdp_prefer') {
      try {
        const cdpUrl = await ensureCdpEndpointAvailable(browserPreference);
        process.env.PLAYWRIGHT_CDP_URL = cdpUrl;
        process.env.PLAYWRIGHT_CDP_REQUIRED = 'true';
        delete process.env.PLAYWRIGHT_BROWSER_CHANNEL;
      } catch {
        // cdp_prefer: fallback to local launch mode.
        const channel = resolveBrowserChannel(browserPreference);
        if (channel) {
          process.env.PLAYWRIGHT_BROWSER_CHANNEL = channel;
        } else {
          delete process.env.PLAYWRIGHT_BROWSER_CHANNEL;
        }
        delete process.env.PLAYWRIGHT_CDP_URL;
        delete process.env.PLAYWRIGHT_CDP_REQUIRED;
      }
    } else {
      const channel = resolveBrowserChannel(browserPreference);
      if (channel) {
        process.env.PLAYWRIGHT_BROWSER_CHANNEL = channel;
      } else {
        delete process.env.PLAYWRIGHT_BROWSER_CHANNEL;
      }
      delete process.env.PLAYWRIGHT_CDP_URL;
      delete process.env.PLAYWRIGHT_CDP_REQUIRED;
    }

    // Ensure a previous headless singleton does not get reused.
    await closeBrowser().catch(() => {});
    const result = await provider.loginAndFetch(supplier as any, runtimeCred as any, searchUrl, 90000);
    if (result.error) {
      throw result.error;
    }

    const cookies = loadSessionCache(cacheKey);
    const cachedCount = Array.isArray(cookies) ? cookies.length : 0;
    if (cachedCount === 0) {
      throw new Error('Session initialized but no cookies were cached.');
    }

    return {
      supplier_name: 'GSMART',
      cache_key: cacheKey,
      cached_cookies: cachedCount,
      elapsed_ms: Date.now() - startedAt,
    };
  } finally {
    if (previousHeadless === undefined) {
      delete process.env.PLAYWRIGHT_HEADLESS;
    } else {
      process.env.PLAYWRIGHT_HEADLESS = previousHeadless;
    }
    if (previousChannel === undefined) {
      delete process.env.PLAYWRIGHT_BROWSER_CHANNEL;
    } else {
      process.env.PLAYWRIGHT_BROWSER_CHANNEL = previousChannel;
    }
    if (previousCdpUrl === undefined) {
      delete process.env.PLAYWRIGHT_CDP_URL;
    } else {
      process.env.PLAYWRIGHT_CDP_URL = previousCdpUrl;
    }
    if (previousCdpRequired === undefined) {
      delete process.env.PLAYWRIGHT_CDP_REQUIRED;
    } else {
      process.env.PLAYWRIGHT_CDP_REQUIRED = previousCdpRequired;
    }
    await closeBrowser().catch(() => {});
  }
}

export async function initializeManualSupplierSession(
  supplierName: string,
  query = '364624',
  browserPreference?: string,
  browserMode?: string
): Promise<ManualSessionInitResult> {
  const normalized = String(supplierName || '').trim().toUpperCase();
  if (!normalized) {
    throw new Error('supplier_name is required');
  }

  if (normalized === 'GSMART') {
    return initializeGsmartSession(query, browserPreference, browserMode);
  }

  throw new Error(`Manual session initialization is not supported for ${normalized}`);
}
