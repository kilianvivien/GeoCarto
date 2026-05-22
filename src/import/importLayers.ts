import { useDocumentStore } from '@/state/documentStore';
import { useNotices } from '@/ui/notices';
import { GeoJsonImportError, importGeoJsonFile } from './geojson';

/**
 * Import one or more dropped/picked files as GeoJSON layers, adding them to the
 * document and reporting the outcome via toast notices.
 */
export async function importGeoJsonFiles(files: File[]): Promise<void> {
  const addLayer = useDocumentStore.getState().addLayer;
  const push = useNotices.getState().push;

  let added = 0;
  for (const file of files) {
    try {
      const layer = await importGeoJsonFile(file);
      addLayer(layer);
      added += 1;
      push(`Imported "${layer.name}" — ${layer.featureCount} features`);
    } catch (error) {
      const message =
        error instanceof GeoJsonImportError
          ? error.message
          : `Could not import "${file.name}".`;
      push(message, 'error');
    }
  }

  if (added > 1) push(`${added} layers imported`);
}

/** Open the OS file picker and import the chosen GeoJSON files. */
export function pickAndImportGeoJson(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.geojson,.json,application/geo+json,application/json';
  input.multiple = true;
  input.addEventListener('change', () => {
    if (input.files) void importGeoJsonFiles([...input.files]);
  });
  input.click();
}
