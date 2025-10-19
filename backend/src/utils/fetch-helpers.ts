/**
 * Detect if HTML content looks like it's blocking robots/bots
 * More comprehensive than the basic isBlockedByRobot check
 */
export function looksLikeRobotBlock(html: string): boolean {
  const needles = [
    'captcha',
    'are you human',
    'access denied',
    'deny access',
    'temporarily blocked',
    'bot detected',
    'blocked by',
    'cf-chl-',
    'akamai bot manager',
    'request unsuccessful',
    'verify you are human',
    'cloudflare',
    'ray id',
    'checking your browser',
    'please enable javascript',
    'enable cookies',
    'security check',
    'unusual traffic',
    'automated requests'
  ];

  const lower = html.toLowerCase();
  return needles.some(n => lower.includes(n));
}

/**
 * Check if HTML looks like an empty or error page
 */
export function looksLikeEmptyPage(html: string): boolean {
  if (!html || html.length < 500) return true;

  const lower = html.toLowerCase();

  // Common error page indicators
  const errorIndicators = [
    '404',
    'not found',
    'page not found',
    'no results',
    'nenhum resultado',
    'sem resultados'
  ];

  return errorIndicators.some(indicator => lower.includes(indicator));
}
