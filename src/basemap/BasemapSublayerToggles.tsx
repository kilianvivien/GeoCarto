import type { BasemapSublayerKey } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { useLocale } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';

const SUBLAYER_ORDER: { key: BasemapSublayerKey; labelKey: TranslationKey }[] = [
  { key: 'earth', labelKey: 'sublayer.earth' },
  { key: 'roads', labelKey: 'sublayer.roads' },
  { key: 'places', labelKey: 'sublayer.places' },
  { key: 'pois', labelKey: 'sublayer.pois' },
  { key: 'water', labelKey: 'sublayer.water' },
  { key: 'landcover', labelKey: 'sublayer.landcover' },
  { key: 'landuse', labelKey: 'sublayer.landuse' },
  { key: 'buildings', labelKey: 'sublayer.buildings' },
  { key: 'boundaries', labelKey: 'sublayer.boundaries' },
];

/**
 * Editorial sub-layer visibility chips. Only renders when the active basemap
 * is Protomaps-derived (built-in, pmtiles-url, or pmtiles-file) — `style-url` and `static`
 * sources are opaque, so per-layer filtering would be misleading.
 */
export function BasemapSublayerToggles({ compact = false }: { compact?: boolean }) {
  const t = useLocale((s) => s.t);
  const basemap = useDocumentStore((s) => s.project.basemap);
  const setBasemapSublayer = useDocumentStore((s) => s.setBasemapSublayer);

  if (
    basemap.kind !== 'builtin' &&
    basemap.kind !== 'pmtiles-url' &&
    basemap.kind !== 'pmtiles-file'
  ) {
    return null;
  }
  const sublayers = basemap.sublayers;

  return (
    <div
      role="group"
      aria-label={t('status.basemapSublayers')}
      data-testid="basemap-sublayers"
      className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}
    >
      {SUBLAYER_ORDER.map(({ key, labelKey }) => {
        const on = sublayers[key];
        const label = t(labelKey);
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
