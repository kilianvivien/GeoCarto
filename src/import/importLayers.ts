import { useDocumentStore } from '@/state/documentStore';
import { useNotices } from '@/ui/notices';
import { translate } from '@/i18n/useLocale';
import { basename, isTauri } from '@/app/platform';
import { GeoJsonImportError } from './geojson';
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
 * the document and the outcome is reported via toast notices.
 */
export async function importDataFiles(files: File[]): Promise<void> {
  const addLayer = useDocumentStore.getState().addLayer;
  const push = useNotices.getState().push;

  let addedLayers = 0;
  for (const file of files) {
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
      push(translate('import.status', { file: file.name }));
      const layers = await importFileToLayers(file);
      for (const layer of layers) {
        addLayer(layer);
        addedLayers += 1;
        push(translate('import.imported', { layer: layer.name, count: layer.featureCount }));
      }
    } catch (error) {
      const message =
        error instanceof GeoJsonImportError
          ? error.message
          : translate('import.couldNotImport', { file: file.name });
      push(message, 'error');
    }
  }

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
            extensions: ['geojson', 'json', 'topojson', 'kml', 'gpx', 'zip', 'shp'],
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
