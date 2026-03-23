import { supabase } from '../utils/supabase';
import { logger } from '../utils/logger';
import { SearchRun } from '../types';

/**
 * Persist a SearchRun to Supabase and mutate the object in-place with the
 * generated id and created_at returned by the database.
 */
export async function persistSearchRun(searchRun: SearchRun): Promise<void> {
  if (!supabase) return;

  const { data: insertedRun, error: dbError } = await supabase
    .from('search_runs')
    .insert(searchRun)
    .select()
    .single();

  if (dbError) {
    logger.error('Failed to insert search_run: %s', dbError.message);
  } else {
    searchRun.id = insertedRun?.id;
    searchRun.created_at = insertedRun?.created_at;
  }
}

/**
 * Upload an HTML debug snapshot to Supabase Storage and return a signed URL.
 * Passwords, auth tokens and cookies are redacted before upload.
 * Returns null if Supabase is not configured or the upload fails.
 */
export async function storeDebugSnapshot(runId: string, html: string): Promise<string | null> {
  if (!supabase) return null;

  try {
    const fileName = `search-runs/${runId}/results.html`;
    const sanitizedHtml = html
      .replace(/(<input[^>]*type=["']password["'][^>]*value=["'])[^"']*(["'][^>]*>)/gi, '$1[redacted]$2')
      .replace(/(authorization["']?\s*[:=]\s*["'])[^"']+(["'])/gi, '$1[redacted]$2')
      .replace(/(cookie["']?\s*[:=]\s*["'])[^"']+(["'])/gi, '$1[redacted]$2');

    const { error: uploadError } = await supabase.storage
      .from('debug-snapshots')
      .upload(fileName, sanitizedHtml, { contentType: 'text/html', upsert: true });

    if (uploadError) {
      logger.error('Failed to upload debug snapshot: %s', uploadError.message);
      return null;
    }

    const expiresIn = Math.max(300, Number(process.env.DEBUG_SNAPSHOT_SIGNED_URL_TTL_S || '3600'));
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('debug-snapshots')
      .createSignedUrl(fileName, expiresIn);

    if (signedUrlError) {
      logger.error('Failed to create debug snapshot signed URL: %s', signedUrlError.message);
      return null;
    }

    return signedUrlData.signedUrl;
  } catch (err: any) {
    logger.error('Error storing debug snapshot: %s', err?.message || err);
    return null;
  }
}

/**
 * Attach a debug snapshot URL to an existing search_run row.
 */
export async function updateDebugSnapshotUrl(runId: string, snapshotUrl: string): Promise<void> {
  if (!supabase) return;

  await supabase
    .from('search_runs')
    .update({ debug_snapshot_url: snapshotUrl })
    .eq('id', runId);
}
