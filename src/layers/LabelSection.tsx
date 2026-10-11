import { useMemo } from 'react';
import type { GeoJsonLayer, LabelStyle } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { hintHistoryLabel } from '@/state/historyStore';
import { listAllAttributes } from '@/style/classify';
import { DEFAULT_LABEL_STYLE } from '@/style/labels';
import { Swatches } from '@/ui/Swatches';
import { useLocale } from '@/i18n/useLocale';

const inputClass =
  'min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]';

/** A name-like attribute makes the most useful default label. */
function defaultLabelAttribute(attributes: string[]): string {
  return (
    attributes.find((attribute) => /^(name|nom|label|libell?e|title|titre)$/i.test(attribute)) ??
    attributes.find((attribute) => /name|nom|label|libell/i.test(attribute) && !attribute.startsWith('@')) ??
    attributes.find((attribute) => !attribute.startsWith('@')) ??
    attributes[0]
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** "Labels" — write an attribute (and optionally a value) on each feature of a layer. */
export function LabelSection({ layer }: { layer: GeoJsonLayer }) {
  const t = useLocale((s) => s.t);
  const updateLayerStyle = useDocumentStore((s) => s.updateLayerStyle);
  const attributes = useMemo(() => listAllAttributes(layer.data.features), [layer.data.features]);
  const labels = layer.style.labels;
  const disabled = layer.locked || layer.renderStrategy === 'heatmap' || attributes.length === 0;

  const setLabels = (next: LabelStyle | undefined) => {
    hintHistoryLabel('Labels');
    updateLayerStyle(layer.id, { labels: next });
  };
  const patch = (change: Partial<LabelStyle>) => labels && setLabels({ ...labels, ...change });

  return (
    <div className={`flex flex-col gap-2 ${disabled ? 'opacity-65' : ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
        {t('labels.title')}
      </div>
      <label className="flex items-center justify-between gap-3 text-[11.5px] text-[var(--text-2)] pointer-coarse:py-1.5">
        <span>{t('labels.show')}</span>
        <input
          type="checkbox"
          disabled={disabled}
          checked={Boolean(labels)}
          onChange={(event) =>
            setLabels(
              event.target.checked
                ? { ...DEFAULT_LABEL_STYLE, attribute: defaultLabelAttribute(attributes) }
                : undefined,
            )
          }
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
      </label>
      {attributes.length === 0 && <div className="text-[11px] text-[var(--text-3)]">{t('labels.noAttributes')}</div>}
      {labels && (
        <>
          <Field label={t('labels.attribute')}>
            <select
              disabled={disabled}
              value={labels.attribute}
              onChange={(event) => patch({ attribute: event.target.value })}
              className={inputClass}
            >
              {[...new Set([labels.attribute, ...attributes])].map((attribute) => (
                <option key={attribute} value={attribute}>
                  {attribute}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('labels.valueAttribute')}>
            <select
              disabled={disabled}
              value={labels.valueAttribute ?? ''}
              onChange={(event) => patch({ valueAttribute: event.target.value || undefined })}
              className={inputClass}
            >
              <option value="">{t('labels.none')}</option>
              {attributes.map((attribute) => (
                <option key={attribute} value={attribute}>
                  {attribute}
                </option>
              ))}
            </select>
          </Field>
          {labels.valueAttribute && (
            <Field label={t('labels.suffix')}>
              <input
                type="text"
                disabled={disabled}
                value={labels.valueSuffix ?? ''}
                placeholder={t('labels.suffixPlaceholder')}
                onChange={(event) => patch({ valueSuffix: event.target.value || undefined })}
                className={inputClass}
              />
            </Field>
          )}
          <Field label={t('labels.size')}>
            <input
              type="number"
              min={6}
              max={48}
              disabled={disabled}
              value={labels.size}
              onChange={(event) => patch({ size: Math.max(6, Math.min(48, Number(event.target.value) || 12)) })}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('labels.color')}
            <Swatches value={labels.color} disabled={disabled} onChange={(color) => patch({ color })} />
          </div>
          <label className="flex items-center justify-between gap-3 text-[11.5px] text-[var(--text-3)] pointer-coarse:py-1.5">
            <span>{t('labels.halo')}</span>
            <input
              type="checkbox"
              disabled={disabled}
              checked={labels.halo}
              onChange={(event) => patch({ halo: event.target.checked })}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
          </label>
          <div className="text-[11px] leading-snug text-[var(--text-3)]">{t('labels.exportNote')}</div>
        </>
      )}
    </div>
  );
}
