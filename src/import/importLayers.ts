import { useDocumentStore } from '@/state/documentStore';
import { useNotices } from '@/ui/notices';
import { translate } from '@/i18n/useLocale';
import { GeoJsonImportError } from './geojson';
import { IMPORT_ACCEPT, formatForFile, importFileToLayers } from './formats';

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
    if (!formatForFile(file)) {
      push(translate('import.unsupportedFormat', { file: file.name }), 'error');
      continue;
    }
    try {
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
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = IMPORT_ACCEPT;
  input.multiple = true;
  input.addEventListener('change', () => {
    if (input.files) void importDataFiles([...input.files]);
  });
  input.click();
}
