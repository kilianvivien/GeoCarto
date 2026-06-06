import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Feature } from 'geojson';
import type { GeoJsonLayer } from '@/project/cartoproj';
import { FEATURE_FILL_PROPERTY, labelForFeature } from '@/layers/geojsonFeatureStyle';
import { useDocumentStore } from '@/state/documentStore';
import { hintHistoryLabel } from '@/state/historyStore';
import { useLocale } from '@/i18n/useLocale';

interface Row {
  key: string;
  value: string;
}

function rowsFromProperties(properties: Feature['properties']): Row[] {
  return Object.entries(properties ?? {})
    // `@id` is an internal stable identity / fill key — never shown or edited.
    .filter(([key]) => key !== FEATURE_FILL_PROPERTY)
    .map(([key, value]) => ({
      key,
      value: value === null || value === undefined ? '' : String(value),
    }));
}

/** Coerce a typed-in string back to a number/boolean where it reads as one. */
function coerceValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return value;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
      {children}
    </div>
  );
}

/**
 * Editable attribute table shown while a feature is selected in the vector editor.
 * Each commit writes the whole properties object back to the document via
 * `updateFeatureProperties` — geometry is untouched, so the editor is not rebuilt.
 */
export function EditAttributePanel({
  layer,
  feature,
}: {
  layer: GeoJsonLayer;
  feature: Feature | null;
}) {
  const t = useLocale((s) => s.t);
  const featureId = feature?.id;
  const [rows, setRows] = useState<Row[]>(() => rowsFromProperties(feature?.properties ?? null));

  // Re-seed the draft when the selected feature changes (derived-from-props).
  const lastIdRef = useRef(featureId);
  if (lastIdRef.current !== featureId) {
    lastIdRef.current = featureId;
    setRows(rowsFromProperties(feature?.properties ?? null));
  }

  if (!feature || featureId === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <Eyebrow>{t('attributes.editing')}</Eyebrow>
          <div className="mt-1 text-[13px] font-semibold text-[var(--text)]">{layer.name}</div>
        </div>
        <div className="text-[12px] text-[var(--text-3)]">
          {t('attributes.selectFeatureHelp')}
        </div>
      </div>
    );
  }

  const commit = (next: Row[]) => {
    setRows(next);
    const properties: Record<string, unknown> = {};
    // Preserve the internal fill key (hidden from the editable rows).
    const fillKey = feature.properties?.[FEATURE_FILL_PROPERTY];
    if (fillKey !== undefined && fillKey !== null) properties[FEATURE_FILL_PROPERTY] = fillKey;
    for (const { key, value } of next) {
      const trimmed = key.trim();
      if (trimmed && trimmed !== FEATURE_FILL_PROPERTY) properties[trimmed] = coerceValue(value);
    }
    hintHistoryLabel('Edit feature attributes');
    useDocumentStore.getState().updateFeatureProperties(layer.id, featureId, properties);
  };
  const featureLabel = labelForFeature(feature.properties ?? {});

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow>{t('attributes.feature')}</Eyebrow>
        <div className="mt-1 text-[13px] font-semibold text-[var(--text)]">
          {featureLabel === 'Selected feature' ? t('attributes.selectedFeature') : featureLabel}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-[var(--text-3)]">{layer.name}</div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Eyebrow>{t('attributes.attributes')}</Eyebrow>
        <p className="text-[11px] leading-snug text-[var(--text-3)]">
          {t('attributes.help')}
        </p>
        {rows.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-[var(--divider)] px-2 py-3 text-center text-[11px] text-[var(--text-3)]">
            {t('attributes.noneYet')}
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_1fr_auto] gap-1 px-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">
            <span>{t('attributes.field')}</span>
            <span>{t('attributes.value')}</span>
            <span className="w-7" />
          </div>
        )}
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-1">
            <input
              aria-label={`${t('attributes.field')} ${index + 1}`}
              value={row.key}
              placeholder={t('attributes.namePlaceholder')}
              onChange={(e) =>
                commit(rows.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)))
              }
              className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
            />
            <input
              aria-label={`${t('attributes.value')} ${index + 1}`}
              value={row.value}
              placeholder={t('attributes.valuePlaceholder')}
              onChange={(e) =>
                commit(rows.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))
              }
              className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
            />
            <button
              type="button"
              aria-label={`${t('attributes.delete')} ${row.key || index + 1}`}
              title={t('attributes.delete')}
              onClick={() => commit(rows.filter((_, i) => i !== index))}
              className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--text-3)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => commit([...rows, { key: '', value: '' }])}
          className="mt-1 flex items-center gap-1.5 self-start rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1 text-[11.5px] text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
        >
          <Plus size={13} />
          {t('attributes.addField')}
        </button>
      </div>
    </div>
  );
}
