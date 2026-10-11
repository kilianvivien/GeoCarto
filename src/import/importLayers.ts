import { useDocumentStore } from '@/state/documentStore';
import { useNotices } from '@/ui/notices';
import { translate } from '@/i18n/useLocale';
import { basename, isTauri } from '@/app/platform';
import { GeoJsonImportError } from './geojson';
import { ImportCancelledError } from './importJob';
import { useImportProgress } from './importProgress';
import { IMPORT_ACCEPT, formatForFile, importFileToLayers } from './formats';

const IMPORT_SIZE_GUARDRAIL_MB = 75;
const IMPORT_SIZE_GUARDRAIL_BYTES = IMPORT_SIZE_GUARDRAIL_MB * 1024 * 1024;

export async function nativePathsToFiles(paths: string[]): Promise<File[]> {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const files: File[] = [];
  for (const path of paths) {
    const data = await readFile(path);
    files.push(new File([data], basename(path)));
  }
  return files;
}

/**
 * Import one or more dropped/picked files as map layers, decoding GeoJSON,
 * TopoJSON, KML, GPX, or zipped Shapefiles (Milestone 14). Results are added to
 * the document and the outcome is reported via toast notices. While a batch
 * runs, `useImportProgress` exposes the current file and a cancel action;
 * cancelling stops the file in flight and skips the rest, keeping the layers
 * already added.
 */
export async function importDataFiles(files: File[]): Promise<void> {
  const addLayer = useDocumentStore.getState().addLayer;
  const push = useNotices.getState().push;

  const controller = new AbortController();
  let addedLayers = 0;
  for (const [index, file] of files.entries()) {
    if (controller.signal.aborted) break;
    if (file.size > IMPORT_SIZE_GUARDRAIL_BYTES) {
      push(
        translate('import.tooLarge', { file: file.name, limit: IMPORT_SIZE_GUARDRAIL_MB }),
        'error',
      );
      continue;
    }
    if (!formatForFile(file)) {
      push(translate('import.unsupportedFormat', { file: file.name }), 'error');
      continue;
    }
    try {
      const current = { file: file.name, index: index + 1, total: files.length };
      useImportProgress.setState({ current, cancel: () => controller.abort() });
      const layers = await importFileToLayers(file, {
        signal: controller.signal,
        onNote: (message) => push(message),
        onGeocodeProgress: (done, total) =>
          useImportProgress.setState({ current: { ...current, geocoding: { done, total } } }),
      });
      for (const layer of layers) {
        addLayer(layer);
        addedLayers += 1;
        push(translate('import.imported', { layer: layer.name, count: layer.featureCount }));
      }
    } catch (error) {
      if (error instanceof ImportCancelledError) {
        push(translate('import.cancelled'));
        break;
      }
      const message =
        error instanceof GeoJsonImportError
          ? error.message
          : translate('import.couldNotImport', { file: file.name });
      push(message, 'error');
    }
  }
  useImportProgress.setState({ current: null, cancel: null });

  if (addedLayers > 1) push(translate('import.layersImported', { n: addedLayers }));
}

/** Backwards-compatible alias retained for existing call sites. */
export const importGeoJsonFiles = importDataFiles;

/** Open the OS file picker and import the chosen files. */
export function pickAndImportGeoJson(): void {
  if (isTauri()) {
    void (async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const paths = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: 'GeoCarto data',
            extensions: ['geojson', 'json', 'topojson', 'kml', 'gpx', 'zip', 'shp', 'csv', 'tsv'],
          },
        ],
      });
      const selected = Array.isArray(paths) ? paths : typeof paths === 'string' ? [paths] : [];
      if (selected.length === 0) return;
      await importDataFiles(await nativePathsToFiles(selected));
    })().catch((error) => {
      useNotices
        .getState()
        .push(error instanceof Error ? error.message : translate('import.couldNotImport', { file: 'file' }), 'error');
    });
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = IMPORT_ACCEPT;
  input.multiple = true;
  input.addEventListener('change', () => {
    if (input.files) void importDataFiles([...input.files]);
  });
  input.click();
}
