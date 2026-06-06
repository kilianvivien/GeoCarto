import type { FeatureCollection } from 'geojson';
import type { GeoJsonLayer } from '@/project/cartoproj';
import { isTauri } from '@/app/platform';

/**
 * Export a vector data layer back to a `.geojson` file. A layer's `data` is
 * already the canonical `FeatureCollection` (CLAUDE.md invariant), so export is
 * just serialize-and-download — the inverse of `featureCollectionToLayer`. Each
 * feature keeps its stable `id` and `properties` (including the `@id` fill key),
 * so an import → edit → export → re-import round-trip is lossless.
 */

/** Filesystem-safe filename from a layer name, always ending in `.geojson`. */
export function geojsonFileName(name: string): string {
  const base = name.trim().replace(/[/\\?%*:|"<>]+/g, '-').replace(/\.geo?json$/i, '') || 'layer';
  return `${base}.geojson`;
}

/** Serialize a layer's canonical FeatureCollection to pretty-printed GeoJSON. */
export function serializeLayerGeoJson(layer: GeoJsonLayer): string {
  return JSON.stringify(layer.data, null, 2);
}

/**
 * Write GeoJSON text to disk. Under Tauri a native save dialog is used (parity
 * with project save); on the web it triggers a browser download. Returns false
 * when the user cancels the desktop dialog.
 */
async function saveGeoJson(contents: string, fileName: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: 'GeoJSON', extensions: ['geojson', 'json'] }],
    });
    if (!path) return false;
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, contents);
    return true;
  }

  const blob = new Blob([contents], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Defer revocation so the download has time to start in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Save a single data layer as a `.geojson` file. */
export function exportLayerGeoJson(layer: GeoJsonLayer): Promise<boolean> {
  return saveGeoJson(serializeLayerGeoJson(layer), geojsonFileName(layer.name));
}

export interface BundleExportResult {
  saved: boolean;
  layers: number;
  features: number;
}

/**
 * Export every data layer into one combined `.geojson` file. Features are kept
 * verbatim (ids + properties preserved), so re-importing is lossless per
 * feature — but GeoJSON has no multi-layer container, so the result re-imports
 * as a *single* merged layer. Returns null when there are no features to export;
 * `saved` is false when the user cancels the desktop dialog.
 */
export async function exportAllLayersGeoJson(
  layers: GeoJsonLayer[],
  baseName: string,
): Promise<BundleExportResult | null> {
  const withFeatures = layers.filter((layer) => layer.data.features.length > 0);
  const features = withFeatures.flatMap((layer) => layer.data.features);
  if (features.length === 0) return null;

  const collection: FeatureCollection = { type: 'FeatureCollection', features };
  const fileName = geojsonFileName(`${baseName.trim() || 'layers'}-all`);
  const saved = await saveGeoJson(JSON.stringify(collection, null, 2), fileName);
  return { saved, layers: withFeatures.length, features: features.length };
}
