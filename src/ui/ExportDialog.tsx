import { useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { ExportBackground, ExportFormat } from '@/export/raster';
import { useDocumentStore } from '@/state/documentStore';
import { useNotices } from './notices';

// Defer the raster export module (pulls maplibre-gl into the bundle) until the
// user actually clicks Export — keeps it out of the initial chunk.
async function loadRaster() {
  return import('@/export/raster');
}

type ScalePreset = '1x' | '2x' | 'custom';

const TRANSITION_MS = 220;

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

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
  const push = useNotices((s) => s.push);

  const [format, setFormat] = useState<ExportFormat>('png');
  const projectScale = project.exportFrame.dpiScale ?? 1;
  const initialPreset: ScalePreset = projectScale === 1 ? '1x' : projectScale === 2 ? '2x' : 'custom';
  const [scalePreset, setScalePreset] = useState<ScalePreset>(initialPreset);
  const [customScale, setCustomScale] = useState(projectScale);
  const projectBg = project.exportFrame.background;
  const initialBackground: ExportBackground = projectBg === 'transparent' ? 'transparent' : 'white';
  const [background, setBackground] = useState<ExportBackground>(initialBackground);
  const [quality, setQuality] = useState(0.92);
  const [busy, setBusy] = useState(false);

  const scale = useMemo(() => {
    if (scalePreset === '1x') return 1;
    if (scalePreset === '2x') return 2;
    return Math.max(0.25, Math.min(8, customScale));
  }, [scalePreset, customScale]);

  const outW = Math.round(project.exportFrame.width * scale);
  const outH = Math.round(project.exportFrame.height * scale);

  const handleExport = async () => {
    setBusy(true);
    try {
      const { exportRaster, downloadBlob } = await loadRaster();
      const result = await exportRaster(project, { format, scale, background, quality });
      downloadBlob(result.blob, result.fileName);
      push(`Exported ${result.fileName} (${result.width}×${result.height})`);
      onClose();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Export failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export image"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className={`glass w-[420px] rounded-[var(--radius-md)] bg-[var(--surface-modal)] p-5 text-[var(--text)] shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-[220ms] ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-1'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[14px] font-semibold">Export image</div>
            <div className="mt-0.5 text-[11.5px] text-[var(--text-2)]">
              Renders the locked composition area as PNG or JPEG.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>

        <Field label="Format">
          <Segmented
            value={format}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPEG' },
            ]}
            onChange={setFormat}
          />
        </Field>

        <Field label="Scale">
          <Segmented
            value={scalePreset}
            options={[
              { value: '1x', label: '1×' },
              { value: '2x', label: '2×' },
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={setScalePreset}
          />
          {scalePreset === 'custom' && (
            <input
              type="number"
              min={0.25}
              max={8}
              step={0.25}
              value={customScale}
              onChange={(e) => setCustomScale(parseFloat(e.target.value) || 1)}
              className="mt-2 w-24 rounded-[7px] border border-[var(--divider)] bg-[var(--hover)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          )}
        </Field>

        {format === 'png' && (
          <Field label="Background">
            <Segmented
              value={background}
              options={[
                { value: 'white', label: 'White' },
                { value: 'transparent', label: 'Transparent' },
              ]}
              onChange={setBackground}
            />
          </Field>
        )}

        {format === 'jpeg' && (
          <Field label={`Quality (${Math.round(quality * 100)}%)`}>
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
          <span>Output</span>
          <span data-testid="export-output-size" className="mono font-semibold text-[var(--text)]">
            {outW} × {outH} px
          </span>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-on-accent)] transition-[filter] hover:brightness-105 disabled:opacity-60"
          >
            <Download size={13} />
            {busy ? 'Exporting…' : 'Export'}
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
