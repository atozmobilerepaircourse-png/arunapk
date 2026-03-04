/**
 * Bunny Stream — Direct TUS resumable upload from device to Bunny CDN.
 * The server only creates the video slot; video bytes never pass through it.
 *
 * Flow:
 *  1. POST /api/bunny/create-video  → get videoId + apiKey
 *  2. TUS upload directly to video.bunnycdn.com/tusupload
 *  3. Poll GET /api/bunny/video-status/:videoId until encoded
 *  4. Use playbackUrl (iframe embed) or directUrl (HLS m3u8)
 */

import { Platform } from 'react-native';
import { apiRequest } from '@/lib/query-client';

export interface BunnyVideoSlot {
  videoId: string;
  libraryId: string;
  signature: string;
  expires: number;
  uploadUrl: string;
  playbackUrl: string;
  directUrl: string;
}

export interface UploadProgress {
  percent: number;
  message: string;
}

export type ProgressCallback = (p: UploadProgress) => void;

/**
 * Create a video slot in Bunny Stream (server-side).
 */
export async function createBunnyVideoSlot(title: string): Promise<BunnyVideoSlot> {
  const res = await apiRequest('POST', '/api/bunny/create-video', { title });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to create video slot');
  return data as BunnyVideoSlot;
}

/**
 * Upload a video file directly to Bunny Stream via TUS resumable upload.
 * Works on iOS, Android, and Web.
 *
 * @param uri       Local file URI (file:// on native, blob: / http: on web)
 * @param slot      Result from createBunnyVideoSlot
 * @param onProgress  Called repeatedly with upload progress
 */
export async function uploadToBunnyStream(
  uri: string,
  slot: BunnyVideoSlot,
  onProgress?: ProgressCallback
): Promise<string> {
  const { Upload } = await import('tus-js-client');

  let file: File | Blob;

  if (Platform.OS === 'web') {
    // On web, uri is a blob: or http: URL
    const r = await fetch(uri);
    file = await r.blob();
  } else {
    // On native, uri is a file:// path. Fetch it as blob via expo fetch
    const { fetch: expoFetch } = await import('expo/fetch');
    const r = await expoFetch(uri);
    file = await r.blob();
  }

  return new Promise<string>((resolve, reject) => {
    const upload = new Upload(file as any, {
      endpoint: slot.uploadUrl || 'https://video.bunnycdn.com/tusupload',
      retryDelays: [0, 3000, 5000, 10000, 20000],
      // Disable resume so stale/expired signatures are never reused
      storeFingerprintForResuming: false,
      headers: {
        AuthorizationSignature: slot.signature,
        AuthorizationExpire: String(slot.expires),
        VideoId: slot.videoId,
        LibraryId: slot.libraryId,
      },
      metadata: {
        filetype: (file as Blob).type || 'video/mp4',
        videoId: slot.videoId,
        libraryId: slot.libraryId,
      },
      chunkSize: 5 * 1024 * 1024,
      onError(error) {
        console.error('[BunnyStream] TUS upload error:', error);
        reject(new Error(`Upload failed: ${error.message || error}`));
      },
      onProgress(bytesUploaded, bytesTotal) {
        const percent = bytesTotal > 0
          ? Math.round((bytesUploaded / bytesTotal) * 100)
          : 0;
        onProgress?.({ percent, message: `Uploading... ${percent}%` });
      },
      onSuccess() {
        console.log('[BunnyStream] TUS upload complete:', slot.videoId);
        onProgress?.({ percent: 100, message: 'Upload complete — encoding...' });
        resolve(slot.playbackUrl);
      },
    });

    upload.start();
  });
}

/**
 * Poll until Bunny finishes encoding the video.
 * Returns the final playback URL.
 *
 * Bunny status codes: 0=queued, 1=processing, 2=encoding, 3=finished, 4=error
 */
export async function waitForBunnyEncoding(
  videoId: string,
  onProgress?: ProgressCallback,
  timeoutMs = 10 * 60 * 1000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const res = await apiRequest('GET', `/api/bunny/video-status/${videoId}`);
      const data = await res.json();
      if (!data.success) continue;

      const pct = data.encodeProgress ?? 0;
      if (data.status === 3) {
        onProgress?.({ percent: 100, message: 'Encoding complete!' });
        return data.playbackUrl;
      } else if (data.status === 4) {
        throw new Error('Bunny encoding failed');
      } else {
        const statusLabel = ['Queued', 'Processing', 'Encoding'][data.status] ?? 'Encoding';
        onProgress?.({ percent: pct, message: `${statusLabel}... ${pct}%` });
      }
    } catch (e: any) {
      if (e?.message?.startsWith('Bunny encoding failed')) throw e;
    }
  }
  throw new Error('Encoding timed out');
}

/**
 * All-in-one: create slot → upload → (optionally) wait for encoding.
 * Returns the iframe embed URL for playback.
 */
export async function uploadVideoToBunnyStream(
  uri: string,
  title: string,
  onProgress?: ProgressCallback,
  waitForEncoding = false
): Promise<{ videoId: string; playbackUrl: string; directUrl: string }> {
  onProgress?.({ percent: 0, message: 'Creating video slot...' });
  const slot = await createBunnyVideoSlot(title);

  onProgress?.({ percent: 1, message: 'Starting upload...' });
  await uploadToBunnyStream(uri, slot, p =>
    onProgress?.({ percent: Math.round(1 + p.percent * 0.9), message: p.message })
  );

  if (waitForEncoding) {
    const finalUrl = await waitForBunnyEncoding(slot.videoId, p =>
      onProgress?.({ percent: 91 + Math.round(p.percent * 0.09), message: p.message })
    );
    return { videoId: slot.videoId, playbackUrl: finalUrl, directUrl: slot.directUrl };
  }

  return { videoId: slot.videoId, playbackUrl: slot.playbackUrl, directUrl: slot.directUrl };
}
