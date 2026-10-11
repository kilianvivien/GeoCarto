import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportCancelledError, WORKER_MIN_BYTES, parseInBackground } from './importJob';
import { ImportParseError } from './parse';
import type { ImportWorkerResponse } from './importWorker';

const POINT = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [2, 48] } };
const blob = (value: unknown) => new Blob([JSON.stringify(value)]);
/** Padded past the size where decoding moves to a worker (JSON ignores the trailing spaces). */
const largeBlob = (value: unknown) => new Blob([JSON.stringify(value), ' '.repeat(WORKER_MIN_BYTES)]);

/** Stand-in for the real worker: the test decides when and how it replies. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<ImportWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(response: ImportWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<ImportWorkerResponse>);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
});

describe('parseInBackground', () => {
  it('decodes on the main thread when workers are unavailable', async () => {
    const [{ data }] = await parseInBackground('geojson', blob(POINT));
    expect(data.features).toHaveLength(1);
  });

  it('decodes small files in place without starting a worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const [{ data }] = await parseInBackground('geojson', blob(POINT));
    expect(data.features).toHaveLength(1);
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('hands a large file to a worker and resolves with its collections', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const file = largeBlob(POINT);
    const job = parseInBackground('geojson', file);
    const [worker] = FakeWorker.instances;
    expect(worker.posted).toEqual([{ format: 'geojson', file }]);

    const collections = [{ data: { type: 'FeatureCollection' as const, features: [] } }];
    worker.reply({ ok: true, collections });

    await expect(job).resolves.toBe(collections);
    expect(worker.terminated).toBe(true);
  });

  it('rejects with the decoder error code the worker reports', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const job = parseInBackground('shapefile', largeBlob(''));
    FakeWorker.instances[0].reply({ ok: false, code: 'shapefileRead', detail: 'bad zip' });

    const error = await job.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImportParseError);
    expect(error).toMatchObject({ code: 'shapefileRead', detail: 'bad zip' });
  });

  it('terminates the worker and rejects when cancelled mid-parse', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const controller = new AbortController();
    const job = parseInBackground('geojson', largeBlob(POINT), controller.signal);

    controller.abort();

    await expect(job).rejects.toBeInstanceOf(ImportCancelledError);
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });

  it('never starts a worker for an already-cancelled import', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const controller = new AbortController();
    controller.abort();

    await expect(parseInBackground('geojson', largeBlob(POINT), controller.signal)).rejects.toBeInstanceOf(
      ImportCancelledError,
    );
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('falls back to the main thread when the worker script fails to start', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const job = parseInBackground('geojson', largeBlob(POINT));
    const [worker] = FakeWorker.instances;
    worker.onerror?.({ preventDefault: () => {} } as ErrorEvent);

    const [{ data }] = await job;
    expect(data.features).toHaveLength(1);
    expect(worker.terminated).toBe(true);
  });
});
