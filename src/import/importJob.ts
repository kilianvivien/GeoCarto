import { ImportParseError, parseFile, type ParsedCollection, type WorkerFormat } from './parse';
import type { ImportWorkerRequest, ImportWorkerResponse } from './importWorker';

/** Raised when the user cancels a running import. */
export class ImportCancelledError extends Error {
  constructor() {
    super('Import cancelled');
    this.name = 'ImportCancelledError';
  }
}

/**
 * Below this size a file decodes faster than a worker starts, and far too fast
 * to freeze anything, so it is decoded in place.
 */
export const WORKER_MIN_BYTES = 512 * 1024;

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

/**
 * Decode a data file off the main thread so a large import never freezes the
 * canvas, and so it can be cancelled: aborting `signal` terminates the worker
 * mid-parse. Small files, and environments where workers are unavailable or
 * the worker script fails to start, decode in place.
 */
export function parseInBackground(
  format: WorkerFormat,
  file: Blob,
  signal?: AbortSignal,
): Promise<ParsedCollection[]> {
  if (signal?.aborted) return Promise.reject(new ImportCancelledError());
  const worker = file.size >= WORKER_MIN_BYTES ? createWorker() : null;
  if (!worker) return parseFile(format, file);

  return new Promise<ParsedCollection[]>((resolve, reject) => {
    const finish = (settle: () => void) => {
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      settle();
    };
    const onAbort = () => finish(() => reject(new ImportCancelledError()));
    signal?.addEventListener('abort', onAbort);

    worker.onmessage = (event: MessageEvent<ImportWorkerResponse>) => {
      const response = event.data;
      finish(() => {
        if (response.ok) resolve(response.collections);
        else if (response.code) reject(new ImportParseError(response.code, response.detail));
        else reject(new Error(response.detail));
      });
    };
    // The worker script itself failed to load or crashed: decode here instead.
    worker.onerror = (event) => {
      event.preventDefault();
      finish(() => parseFile(format, file).then(resolve, reject));
    };
    worker.postMessage({ format, file } satisfies ImportWorkerRequest);
  });
}
