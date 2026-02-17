import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const CACHE_DIR = path.join(__dirname, '..', '..', '.session-cache');
const SESSION_MAX_AGE = 1000 * 60 * 60; // 1 hour

interface SessionCache {
    timestamp: number;
    cookies: any[];
}

function ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

function sanitizeKey(key: string): string {
    return key.replace(/[^a-z0-9_-]/gi, '_');
}

function getCacheFile(key: string): string {
    ensureCacheDir();
    return path.join(CACHE_DIR, `${sanitizeKey(key)}.json`);
}

export function loadSessionCache(key: string): any[] | null {
    try {
        const cacheFile = getCacheFile(key);
        if (fs.existsSync(cacheFile)) {
            const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as SessionCache;
            if (Date.now() - cache.timestamp < SESSION_MAX_AGE) {
                logger.debug('[session-cache] using cached session for %s from %s', key, new Date(cache.timestamp).toISOString());
                return cache.cookies;
            }
            logger.debug('[session-cache] cache expired for %s (created at %s)', key, new Date(cache.timestamp).toISOString());
        }
    } catch (err) {
        logger.warn('[session-cache] failed to load cache for %s: %s', key, err instanceof Error ? err.message : String(err));
    }
    return null;
}

export function saveSessionCache(key: string, cookies: any[]): void {
    try {
        const cacheFile = getCacheFile(key);
        const cache: SessionCache = {
            timestamp: Date.now(),
            cookies
        };
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
        logger.debug('[session-cache] cache saved for %s at %s', key, new Date(cache.timestamp).toISOString());
    } catch (err) {
        logger.warn('[session-cache] failed to save cache for %s: %s', key, err instanceof Error ? err.message : String(err));
    }
}

export function clearSessionCache(key: string): void {
    try {
        const cacheFile = getCacheFile(key);
        if (fs.existsSync(cacheFile)) {
            fs.unlinkSync(cacheFile);
            logger.debug('[session-cache] cache cleared for %s', key);
        }
    } catch (err) {
        logger.warn('[session-cache] failed to clear cache for %s: %s', key, err instanceof Error ? err.message : String(err));
    }
}
