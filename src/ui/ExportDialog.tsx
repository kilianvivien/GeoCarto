import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { ExportBackground } from '@/export/raster';
import type { PageBackground } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { ColorPickerPopover } from './ColorPickerPopover';
import { useNotices } from './notices';
import { useLocale } from '@/i18n/useLocale';
import { useModalFocusTrap } from './useModalFocusTrap';

// Defer each exporter (they pull maplibre-gl / jsPDF into the bundle) until the
// user actually exports — keeps them out of the initial chunk.
async function loadRaster() {
  return import('@/export/raster');
}

/** Dialog-level format, including the vector targets added in M15. */
type DialogFormat = 'png' | 'jpeg' | 'svg' | 'pdf';

type ScalePreset = '1x' | '2x' | 'custom';

const TRANSITION_MS = 220;

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useLocale((s) => s.t);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(open, dialogRef, onClose);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two rAFs guarantee the closed style is committed before flipping
      // to the open state — without this, the browser may batch both
      // and skip the entry transition.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [open]);
  const project = useDocumentStore((s) => s.project);
  const { setExportFrameBackground, setExportFrameDpiScale } = useDocumentStore.getState();
  const push = useNotices((s) => s.push);

  const [format, setFormat] = useState<DialogFormat>('png');
  const [svgIncludeBasemap, setSvgIncludeBasemap] = useState(true);
  const projectScale = project.exportFrame.dpiScale ?? 1;
  const initialPreset: ScalePreset = projectScale === 1 ? '1x' : projectScale === 2 ? '2x' : 'custom';
  const scalePreset: ScalePreset = initialPreset;
  const background = project.exportFrame.background ?? 'white';
  const customBgRef = useRef<HTMLButtonElement>(null);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [quality, setQuality] = useState(0.92);
  const [busy, setBusy] = useState(false);

  const scale = Math.max(0.25, Math.min(8, projectScale));
  const exportBackground: ExportBackground = format === 'jpeg' && background === 'transparent' ? 'white' : background;
  const customBgValue = background === 'white' || background === 'transparent' ? '#cccccc' : background;
  const bgMode: 'white' | 'transparent' | 'custom' =
    background === 'white' ? 'white' : background === 'transparent' ? 'transparent' : 'custom';

  const outW = Math.round(project.exportFrame.width * scale);
  const outH = Math.round(project.exportFrame.height * scale);
  const margin = project.exportFrame.margin ?? 0;

  const handleExport = async () => {
    setBusy(true);
    try {
      const { downloadBlob } = await loadRaster();
      let result;
      if (format === 'svg') {
        const { exportSvg } = await import('@/export/svg');
        result = await exportSvg(project, { includeBasemap: svgIncludeBasemap });
      } else if (format === 'pdf') {
        const { exportPdf } = await import('@/export/pdf');
        result = await exportPdf(project, { scale });
      } else {
        const { exportRaster } = await loadRaster();
        result = await exportRaster(project, { format, scale, background: exportBackground, quality });
      }
      const saved = await downloadBlob(result.blob, result.fileName);
      if (!saved) return; // Desktop save dialog cancelled — keep the dialog open.
      push(t('export.exported', { name: result.fileName, width: result.width, height: result.height }));
      onClose();
    } catch (error) {
      push(error instanceof Error ? error.message : t('export.failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('export.dialog')}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`glass w-[420px] rounded-[var(--radius-md)] bg-[var(--surface-modal)] p-5 text-[var(--text)] shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-[220ms] ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-1'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[14px] font-semibold">{t('export.dialog')}</div>
            <div className="mt-0.5 text-[11.5px] text-[var(--text-2)]">
              {t('export.subtitle')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('export.close')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>

        <Field label={t('export.format')}>
          <Segmented
            value={format}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPEG' },
              { value: 'svg', label: 'SVG' },
              { value: 'pdf', label: 'PDF' },
            ]}
            onChange={setFormat}
          />
        </Field>

        {format !== 'svg' && (
        <Field label={t('export.scale')}>
          <Segmented
            value={scalePreset}
            options={[
              { value: '1x', label: '1×' },
              { value: '2x', label: '2×' },
              { value: 'custom', label: t('export.custom') },
            ]}
            onChange={(value) => {
              if (value === '1x') setExportFrameDpiScale(1);
              else if (value === '2x') setExportFrameDpiScale(2);
              else setExportFrameDpiScale(scalePreset === 'custom' ? scale : 1.5);
            }}
          />
          {scalePreset === 'custom' && (
            <input
              type="number"
              min={0.25}
              max={8}
              step={0.25}
              value={scale}
              onChange={(e) => setExportFrameDpiScale(parseFloat(e.target.value) || 1)}
              className="mt-2 w-24 rounded-[7px] border border-[var(--divider)] bg-[var(--hover)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          )}
        </Field>
        )}

        {format === 'svg' && (
          <>
            <Field label={t('export.basemap')}>
              <label className="flex items-center gap-2 text-[12px] text-[var(--text-2)]">
                <input
                  type="checkbox"
                  checked={svgIncludeBasemap}
                  onChange={(e) => setSvgIncludeBasemap(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                {t('export.embedBasemap')}
              </label>
            </Field>
            <div className="mt-3 rounded-[8px] border border-[var(--divider)] bg-[var(--glass-thin)] px-3 py-2 text-[11.5px] text-[var(--text-2)]">
              {t('export.svgNote')}
            </div>
          </>
        )}

        {format === 'png' && (
          <Field label={t('export.background')}>
            <div className="flex flex-wrap items-center gap-1">
              {(['white', 'transparent'] as const).map((mode) => {
                const active = bgMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setExportFrameBackground(mode)}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-colors ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                        : 'border border-[var(--divider)] bg-[var(--hover)] text-[var(--text-2)] hover:text-[var(--text)]'
                    }`}
                  >
                    {mode === 'white' ? t('export.white') : t('export.transparent')}
                  </button>
                );
              })}
              <button
                ref={customBgRef}
                type="button"
                onClick={() => setBgPickerOpen((prev) => !prev)}
                aria-haspopup="dialog"
                aria-expanded={bgPickerOpen}
                aria-label={t('export.customBackground')}
                className={`h-7 w-7 rounded-full border transition-transform hover:scale-105 ${
                  bgMode === 'custom'
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent-ring)]'
                    : 'border-[var(--divider)]'
                }`}
                style={{
                  background:
                    bgMode === 'custom'
                      ? customBgValue
                      : 'conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #5ac8fa, #007aff, #5856d6, #af52de, #ff2d55, #ff3b30)',
                }}
              />
              <ColorPickerPopover
                open={bgPickerOpen}
                anchorRef={customBgRef}
                value={customBgValue}
                onChange={(hex) => setExportFrameBackground(hex as PageBackground)}
                onClose={() => setBgPickerOpen(false)}
              />
            </div>
          </Field>
        )}

        {format === 'jpeg' && background === 'transparent' && (
          <div className="mt-3 rounded-[8px] border border-[var(--divider)] bg-[var(--glass-thin)] px-3 py-2 text-[11.5px] text-[var(--text-2)]">
            {t('export.jpegTransparency')}
          </div>
        )}

        {format === 'jpeg' && (
          <Field label={t('export.quality', { percent: Math.round(quality * 100) })}>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
        )}

        <div className="mt-4 flex items-center justify-between rounded-[9px] bg-[var(--hover)] px-3 py-2 text-[11.5px] text-[var(--text-2)]">
          <div className="flex flex-col gap-1">
            <span>{t('export.frame', { width: project.exportFrame.width, height: project.exportFrame.height })}</span>
            <span>{t('export.marginBackground', { margin, background })}</span>
          </div>
          <span data-testid="export-output-size" className="mono shrink-0 font-semibold text-[var(--text)]">
            {outW} × {outH}
          </span>
        </div>

        <div className="mt-3 rounded-[9px] border border-[var(--divider)] bg-[var(--glass-thin)] p-3">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            {t('export.fidelity')}
          </div>
          <div className="grid gap-2 text-[11.5px] leading-snug text-[var(--text-2)]">
            <div>
              <span className="font-semibold text-[var(--text)]">PNG/JPEG/PDF:</span>{' '}
              {t('export.fidelityRaster')}
            </div>
            <div>
              <span className="font-semibold text-[var(--text)]">SVG:</span>{' '}
              {t('export.fidelitySvg')}
            </div>
            <div>
              <span className="font-semibold text-[var(--text)]">GeoJSON:</span>{' '}
              {t('export.fidelityGeoJson')}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {t('export.cancel')}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-on-accent)] transition-[filter] hover:brightness-105 disabled:opacity-60"
          >
            <Download size={13} />
            {busy ? t('export.exporting') : t('title.export')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        {label}
      </div>
      {children}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-[var(--divider)] bg-[var(--hover)] p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              active
                ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                : 'text-[var(--text-2)] hover:text-[var(--text)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
