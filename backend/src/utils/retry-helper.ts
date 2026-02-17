import { logger } from './logger';

// Retry configuration
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 2000; // ms

export interface RetryOptions {
    maxRetries?: number;
    retryDelay?: number;
    context?: string;
}

/**
 * Helper function to retry operations with exponential backoff
 * @param operation Function to retry
 * @param options Configuration for retries
 * @returns Result of the operation
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    const retryDelay = options.retryDelay || DEFAULT_RETRY_DELAY;
    const context = options.context ? ` for ${options.context}` : '';

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await operation();
            if (attempt > 1) {
                logger.auger(`Succeeded on attempt ${attempt}${context}`);
            }
            return result;
        } catch (err) {
            lastError = err;
            logger.warn(`Attempt ${attempt}/${maxRetries} failed${context}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            if (attempt < maxRetries) {
                const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}