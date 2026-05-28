import type { BasemapSublayerKey } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';

const SUBLAYER_ORDER: { key: BasemapSublayerKey; label: string }[] = [
  { key: 'roads', label: 'Roads' },
  { key: 'labels', label: 'Labels' },
  { key: 'water', label: 'Water' },
  { key: 'landuse', label: 'Landuse' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'boundaries', label: 'Boundaries' },
];

/**
 * Editorial sub-layer visibility chips. Only renders when the active basemap
 * is Protomaps-derived (built-in or pmtiles-url) — `style-url` and `static`
 * sources are opaque, so per-layer filtering would be misleading.
 */
export function BasemapSublayerToggles({ compact = false }: { compact?: boolean }) {
  const basemap = useDocumentStore((s) => s.project.basemap);
  const setBasemapSublayer = useDocumentStore((s) => s.setBasemapSublayer);

  if (basemap.kind !== 'builtin' && basemap.kind !== 'pmtiles-url') return null;
  const sublayers = basemap.sublayers;

  return (
    <div
      role="group"
      aria-label="Basemap sub-layers"
      data-testid="basemap-sublayers"
      className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}
    >
      {SUBLAYER_ORDER.map(({ key, label }) => {
        const on = sublayers[key];
        return (
          <button
            key={key}
            type="button"
            role="switch"
            aria-checked={on}
            data-testid={`sublayer-${key}`}
            onClick={() => setBasemapSublayer(key, !on)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              on
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]'
                : 'border-[var(--divider)] bg-[var(--hover)] text-[var(--text-3)] line-through hover:text-[var(--text-2)]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
