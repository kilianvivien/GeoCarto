import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '@/state/documentStore';
import { useNotices } from '@/ui/notices';
import { ImportCancelledError } from './importJob';
import { useImportProgress } from './importProgress';

vi.mock('./formats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./formats')>()),
  importFileToLayers: vi.fn(),
}));

const file = (name: string) => new File(['{}'], name);

afterEach(() => {
  vi.clearAllMocks();
  useNotices.setState({ notices: [] });
});

describe('importDataFiles', () => {
  it('reports the file in flight and stops the batch when cancelled', async () => {
    const { importFileToLayers } = await import('./formats');
    const { importDataFiles } = await import('./importLayers');
    const addLayer = vi.spyOn(useDocumentStore.getState(), 'addLayer');
    // The first file hangs until its signal aborts, like a worker mid-parse.
    vi.mocked(importFileToLayers).mockImplementation(
      (_file, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new ImportCancelledError()));
        }),
    );

    const batch = importDataFiles([file('a.geojson'), file('b.geojson')]);
    await vi.waitFor(() => expect(useImportProgress.getState().current).toEqual({ file: 'a.geojson', index: 1, total: 2 }));

    useImportProgress.getState().cancel?.();
    await batch;

    expect(importFileToLayers).toHaveBeenCalledTimes(1);
    expect(addLayer).not.toHaveBeenCalled();
    expect(useImportProgress.getState()).toEqual({ current: null, cancel: null });
    expect(useNotices.getState().notices.map((n) => n.message)).toEqual(['Import cancelled.']);
  });
});
