import { useState } from 'react';
import { Check, ChevronDown, FileImage, Globe2, Grid3x3, Link2, LockKeyhole, Map, Square } from 'lucide-react';
import type { BasemapConfig, BuiltInBasemapPreset, ProjectionId } from '@/project/cartoproj';
import { DEFAULT_BASEMAP_SUBLAYERS, DEFAULT_PROJECTION_CONFIG } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { useViewportStore } from '@/state/viewportStore';
import { BasemapSublayerToggles } from '@/basemap/BasemapSublayerToggles';
import { useNotices } from '@/ui/notices';
import { useLocale } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';
import { useMapInstance } from './mapInstance';
import { frameZoomDelta } from './compositionFrame';
import { basename, isTauri } from '@/app/platform';
import { Tooltip } from '@/ui/Tooltip';

const ASPECT_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '4:3', width: 1600, height: 1200 },
  { label: '3:2', width: 1800, height: 1200 },
  { label: '16:9', width: 1920, height: 1080 },
  { label: '1:1', width: 1500, height: 1500 },
  { label: '3:4', width: 1200, height: 1600 },
];

const PROJECTIONS: { id: ProjectionId; labelKey: TranslationKey }[] = [
  { id: 'equal-earth', labelKey: 'setup.projectionEqualEarth' },
  { id: 'robinson', labelKey: 'setup.projectionRobinson' },
  { id: 'winkel3', labelKey: 'setup.projectionWinkel3' },
  { id: 'bonne', labelKey: 'setup.projectionBonne' },
  { id: 'natural-earth-1', labelKey: 'setup.projectionNaturalEarth1' },
];

const BUILT_INS: { preset: BuiltInBasemapPreset; labelKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  {
    preset: 'editorial-light',
    labelKey: 'basemap.editorialLight',
    descriptionKey: 'basemap.editorialLightDescription',
  },
  {
    preset: 'editorial-dark',
    labelKey: 'basemap.editorialDark',
    descriptionKey: 'basemap.editorialDarkDescription',
  },
  {
    preset: 'minimal-grey',
    labelKey: 'basemap.minimalGrey',
    descriptionKey: 'basemap.minimalGreyDescription',
  },
  {
    preset: 'print-bw',
    labelKey: 'basemap.printBw',
    descriptionKey: 'basemap.printBwDescription',
  },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function builtinConfig(preset: BuiltInBasemapPreset, name: string): BasemapConfig {
  return {
    kind: 'builtin',
    preset,
    name,
    attribution: 'Protomaps © OpenStreetMap',
    sublayers: { ...DEFAULT_BASEMAP_SUBLAYERS },
  };
}

const cardBase =
  'rounded-[10px] border border-[var(--divider)] bg-[var(--hover)] transition-colors hover:bg-[var(--active)]';
const cardActive = 'rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)] transition-colors';
const sourceCard = 'grid min-h-[126px] grid-rows-[36px_1fr_auto] p-3 text-left';
const sourceUrlCard = `${sourceCard} md:focus-within:col-span-2 focus-within:z-10 focus-within:border-[var(--accent)] focus-within:bg-[var(--accent-soft)]`;
const sourceUrlInput =
  'h-8 min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--hover)] px-2 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]';
const linkButton = 'text-left text-[12px] font-semibold leading-tight text-[var(--accent)] transition-colors hover:opacity-80';

/** Required first-run composition setup before annotation editing is enabled. */
export function MapSetupPanel() {
  const t = useLocale((s) => s.t);
  const mode = useDocumentStore((s) => s.project.mode);
  const basemap = useDocumentStore((s) => s.project.basemap);
  const exportFrame = useDocumentStore((s) => s.project.exportFrame);
  const engine = useDocumentStore((s) => s.project.engine);
  const projection = useDocumentStore((s) => s.project.projection);
  const { setBasemap, setExportFrame, lockMapArea, setEngine, setProjectionConfig } = useDocumentStore.getState();
  const viewport = useViewportStore((s) => s.viewport);
  const push = useNotices((s) => s.push);
  const [styleUrl, setStyleUrl] = useState('');
  const [pmtilesUrl, setPmtilesUrl] = useState('');
  const desktopShell = isTauri();
  // Start collapsed so a concurrently-visible RecoveryPrompt has the top
  // bar to itself; the user expands the panel when they want to set up.
  const [collapsed, setCollapsed] = useState(true);

  if (mode !== 'mapSetup') return null;

  /** Apply a basemap and drop into the framing step with an unobstructed canvas. */
  const chooseBasemap = (config: BasemapConfig, notice: string) => {
    setBasemap(config);
    push(notice);
    setCollapsed(true);
  };

  const selectStaticFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');
      if (isPdf) {
        push(t('setup.pdfBasemapPlanned'), 'error');
        return;
      }
      if (!isImage) {
        push(t('setup.chooseImageBasemap'), 'error');
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      chooseBasemap(
        {
          kind: 'static',
          name: file.name,
          mediaType: isPdf ? 'pdf' : 'image',
          mimeType: file.type || (isPdf ? 'application/pdf' : 'image/png'),
          dataUrl,
          attribution: file.name,
        },
        t('setup.staticBasemapSelected', { name: file.name }),
      );
    });
    input.click();
  };

  const selectLocalPmtiles = () => {
    if (!desktopShell) {
      push(t('setup.localPmtilesWebOnly'), 'error');
      return;
    }
    void (async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'PMTiles', extensions: ['pmtiles'] }],
      });
      if (typeof path !== 'string') return;
      const name = basename(path);
      chooseBasemap(
        {
          kind: 'pmtiles-file',
          name,
          path,
          preset: 'editorial-light',
          attribution: name,
          sublayers: { ...DEFAULT_BASEMAP_SUBLAYERS },
        },
        t('setup.localPmtilesSelected', { name }),
      );
    })().catch((error) => {
      push(error instanceof Error ? error.message : t('basemap.localUnavailable'), 'error');
    });
  };

  const applyStyleUrl = () => {
    const url = styleUrl.trim();
    if (!url) return;
    chooseBasemap(
      { kind: 'style-url', name: t('setup.customStyleName'), url, attribution: t('style.customAttribution') },
      t('setup.customStyleSelected'),
    );
  };

  const applyPmtilesUrl = () => {
    const url = pmtilesUrl.trim();
    if (!url) return;
    chooseBasemap(
      {
        kind: 'pmtiles-url',
        name: t('setup.customPmtilesName'),
        url,
        preset: 'editorial-light',
        attribution: 'Custom PMTiles',
        sublayers: { ...DEFAULT_BASEMAP_SUBLAYERS },
      },
      t('setup.customPmtilesSelected'),
    );
  };

  const applyEmptyCanvas = () => {
    chooseBasemap(
      { kind: 'empty', name: t('setup.emptyCanvas'), attribution: '' },
      t('setup.emptyCanvasSelected'),
    );
  };

  /** Pick a projection and fit its initial scale/center to the current export frame. */
  const pickProjection = (id: ProjectionId) => {
    void (async () => {
      const [{ buildD3Projection }, { fitProjectionToFrame }] = await Promise.all([
        import('@/projection/projections'),
        import('@/projection/fitToFrame'),
      ]);
      const config = { ...DEFAULT_PROJECTION_CONFIG[id] };
      const d3proj = buildD3Projection(config);
      const fit = fitProjectionToFrame(d3proj, { width: exportFrame.width, height: exportFrame.height });
      setProjectionConfig({ id, scale: fit.scale, center: fit.center, rotateLambda: 0, parallel: config.parallel });
      push(t('setup.projectionSelected', { name: t(PROJECTIONS.find((p) => p.id === id)?.labelKey ?? 'setup.projectionEqualEarth') }));
    })();
  };

  /** Zoom the map so the composition box fills the canvas, then lock that view. */
  const handleLock = () => {
    const map = useMapInstance.getState().map;
    let locked = viewport;
    const container = map?.getContainer();
    if (map && container && container.clientWidth > 0 && container.clientHeight > 0) {
      const delta = frameZoomDelta(
        container.clientWidth,
        container.clientHeight,
        exportFrame.width / exportFrame.height,
      );
      locked = { ...viewport, zoom: viewport.zoom + delta };
      map.jumpTo({ center: locked.center, zoom: locked.zoom, bearing: locked.bearing, pitch: locked.pitch });
    }
    lockMapArea(locked);
  };

  const lockButton = (
    <button
      type="button"
      onClick={handleLock}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 text-[12px] font-semibold text-[var(--text-on-accent)] shadow-[0_4px_14px_var(--accent-soft)] transition-transform hover:scale-[1.03] active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <LockKeyhole size={14} />
      {t('setup.lockMapArea')}
    </button>
  );

  const transition =
    'transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none';
  const collapsedBasemapName =
    basemap.kind === 'builtin'
      ? t(BUILT_INS.find((item) => item.preset === basemap.preset)?.labelKey ?? 'basemap.editorialLight')
      : basemap.kind === 'empty'
        ? t('setup.emptyCanvas')
        : basemap.name;

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-30">
      {/* Full panel — fades/scales out when collapsed. */}
      <div
        inert={collapsed}
        aria-hidden={collapsed}
        className={`flex justify-center ${transition} ${
          collapsed ? 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0' : 'opacity-100'
        }`}
      >
        <div className="glass pointer-events-auto flex max-h-[calc(100vh-7rem)] w-[min(820px,100%)] flex-col gap-3.5 overflow-y-auto bg-[var(--glass-strong)] p-4 text-[var(--text)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--hover)]">
                <Map size={15} className="text-[var(--accent)]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold">{t('setup.title')}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-2)]">
                  {t('setup.description')}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {lockButton}
              <Tooltip label={t('setup.minimize')} placement="bottom">
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  data-testid="map-setup-minimize"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
                  aria-label={t('setup.minimizeAria')}
                >
                  <ChevronDown size={16} />
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            {t('setup.engine')}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setEngine('mercator')}
              className={`${engine === 'mercator' ? cardActive : cardBase} grid min-h-[76px] grid-rows-[24px_1fr] p-3 text-left`}
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold leading-tight">
                {engine === 'mercator' ? <Check size={14} className="text-[var(--accent)]" /> : <Globe2 size={14} />}
                {t('setup.engineMercator')}
              </div>
              <div className="text-[11px] leading-snug text-[var(--text-2)]">{t('setup.engineMercatorDescription')}</div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (engine === 'projected') return;
                setEngine('projected');
                // `setEngine` seeds an unfit default (frame-agnostic scale/center) —
                // immediately fit it to the current export frame, same as picking a
                // projection card explicitly, so the initial view isn't tiny/off-center.
                pickProjection('equal-earth');
              }}
              className={`${engine === 'projected' ? cardActive : cardBase} grid min-h-[76px] grid-rows-[24px_1fr] p-3 text-left`}
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold leading-tight">
                {engine === 'projected' ? <Check size={14} className="text-[var(--accent)]" /> : <Grid3x3 size={14} />}
                {t('setup.engineProjected')}
              </div>
              <div className="text-[11px] leading-snug text-[var(--text-2)]">{t('setup.engineProjectedDescription')}</div>
            </button>
          </div>

          {engine === 'projected' && projection && (
            <>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                {t('setup.projection')}
              </div>
              <div className="grid gap-2 md:grid-cols-5">
                {PROJECTIONS.map((item) => {
                  const active = projection.id === item.id;
                  const name = t(item.labelKey);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => pickProjection(item.id)}
                      className={`${active ? cardActive : cardBase} grid min-h-[72px] grid-rows-[20px_1fr] p-3 text-left`}
                    >
                      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold leading-tight">
                        {active && <Check size={13} className="text-[var(--accent)]" />}
                        {name}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] text-[var(--text-2)]">
                  {t('setup.centerLongitude')}
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    value={projection.rotateLambda}
                    onChange={(e) => setProjectionConfig({ rotateLambda: Number(e.target.value) })}
                    className={sourceUrlInput}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-[var(--text-2)]">
                  {t('setup.projectionScale')}
                  <input
                    type="number"
                    min={1}
                    value={Math.round(projection.scale)}
                    onChange={(e) => setProjectionConfig({ scale: Math.max(1, Number(e.target.value)) })}
                    className={sourceUrlInput}
                  />
                </label>
              </div>
              <div className="rounded-[8px] border border-[var(--divider)] bg-[var(--glass-thin)] px-3 py-2 text-[11.5px] text-[var(--text-2)]">
                {t('setup.projectedBasemapNote')}
              </div>
            </>
          )}

          {engine === 'mercator' && (
          <>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            {t('setup.builtInBasemaps')}
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            {BUILT_INS.map((item) => {
              const active = basemap.kind === 'builtin' && basemap.preset === item.preset;
              const name = t(item.labelKey);
              return (
                <button
                  key={item.preset}
                  type="button"
                  onClick={() => chooseBasemap(builtinConfig(item.preset, name), t('setup.basemapSelected', { name }))}
                  className={`${active ? cardActive : cardBase} grid min-h-[104px] grid-rows-[28px_1fr] p-3 text-left`}
                >
                  <div className="flex items-start gap-2 text-[12px] font-semibold leading-tight">
                    {active ? <Check size={14} className="text-[var(--accent)]" /> : <Globe2 size={14} />}
                    {name}
                  </div>
                  <div className="text-[11px] leading-snug text-[var(--text-2)]">{t(item.descriptionKey)}</div>
                </button>
              );
            })}
          </div>

          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            {t('setup.customSource')}
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <div className={`${cardBase} ${sourceUrlCard}`}>
              <div className="flex items-start gap-2 text-[12px] font-semibold leading-tight">
                <Link2 size={14} />
                {t('setup.styleJsonUrl')}
              </div>
              <input
                value={styleUrl}
                onChange={(e) => setStyleUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyStyleUrl()}
                placeholder="https://…/style.json"
                className={sourceUrlInput}
              />
              <button type="button" onClick={applyStyleUrl} className={linkButton}>
                {t('setup.useStyleUrl')}
              </button>
            </div>

            <button
              type="button"
              onClick={selectLocalPmtiles}
              className={`${basemap.kind === 'pmtiles-file' ? cardActive : cardBase} ${sourceCard}`}
            >
              <div className="flex items-start gap-2 text-[12px] font-semibold leading-tight">
                <FileImage size={14} />
                {t('setup.localPmtiles')}
              </div>
              <div className="text-[11px] leading-snug text-[var(--text-2)]">
                {desktopShell ? t('setup.localPmtilesDescription') : t('setup.localPmtilesWebOnly')}
              </div>
              <span className={linkButton}>{t('setup.chooseLocalPmtiles')}</span>
            </button>

            <div className={`${cardBase} ${sourceUrlCard}`}>
              <div className="flex items-start gap-2 text-[12px] font-semibold leading-tight">
                <Globe2 size={14} />
                {t('setup.pmtilesUrl')}
              </div>
              <input
                value={pmtilesUrl}
                onChange={(e) => setPmtilesUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyPmtilesUrl()}
                placeholder="https://…/region.pmtiles"
                className={sourceUrlInput}
              />
              <button type="button" onClick={applyPmtilesUrl} className={linkButton}>
                {t('setup.usePmtiles')}
              </button>
            </div>

            <button
              type="button"
              onClick={selectStaticFile}
              className={`${basemap.kind === 'static' ? cardActive : cardBase} ${sourceCard}`}
            >
              <div className="flex items-start gap-2 text-[12px] font-semibold leading-tight">
                <FileImage size={14} />
                {t('setup.imageBasemap')}
              </div>
              <div className="text-[11px] leading-snug text-[var(--text-2)]">
                {t('setup.staticBasemapDescription')}
              </div>
              <span aria-hidden />
            </button>

            <button
              type="button"
              onClick={applyEmptyCanvas}
              className={`${basemap.kind === 'empty' ? cardActive : cardBase} ${sourceCard}`}
            >
              <div className="flex items-start gap-2 text-[12px] font-semibold leading-tight">
                <Square size={14} />
                {t('setup.emptyCanvas')}
              </div>
              <div className="text-[11px] leading-snug text-[var(--text-2)]">
                {t('setup.emptyCanvasDescription')}
              </div>
              <span aria-hidden />
            </button>
          </div>

          {(basemap.kind === 'builtin' || basemap.kind === 'pmtiles-url' || basemap.kind === 'pmtiles-file') && (
            <>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                {t('setup.basemapSublayers')}
              </div>
              <BasemapSublayerToggles />
            </>
          )}
          </>
          )}

          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            {t('setup.compositionFrame')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_PRESETS.map((preset) => {
              const active = exportFrame.width === preset.width && exportFrame.height === preset.height;
              const ratio = preset.width / preset.height;
              const glyphW = ratio >= 1 ? 13 : 13 * ratio;
              const glyphH = ratio >= 1 ? 13 / ratio : 13;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setExportFrame({ width: preset.width, height: preset.height })}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]'
                      : 'border-[var(--divider)] bg-[var(--hover)] text-[var(--text-2)] hover:bg-[var(--active)]'
                  }`}
                >
                  <span
                    className="flex h-[14px] w-[14px] items-center justify-center"
                    aria-hidden="true"
                  >
                    <span
                      className="rounded-[2px] border border-current"
                      style={{ width: glyphW, height: glyphH }}
                    />
                  </span>
                  {preset.label}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Collapsed pill — fades/scales in when collapsed. */}
      <div
        inert={!collapsed}
        aria-hidden={!collapsed}
        className={`absolute inset-x-0 top-0 flex justify-center ${transition} ${
          collapsed ? 'opacity-100' : 'pointer-events-none translate-y-1 scale-[0.98] opacity-0'
        }`}
      >
        <div className="glass pointer-events-auto flex items-center gap-2.5 rounded-full bg-[var(--glass-strong)] py-1.5 pl-3 pr-1.5 text-[var(--text)]">
          <Tooltip label={t('setup.expand')} placement="bottom">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              data-testid="map-setup-expand"
              className="flex items-center gap-2 rounded-full px-1 text-left transition-colors hover:text-[var(--accent)]"
            >
              <Map size={14} className="text-[var(--text-3)]" />
              <span className="max-w-[180px] truncate text-[12px] font-semibold">{collapsedBasemapName}</span>
              <ChevronDown size={14} className="-rotate-90 text-[var(--text-3)]" />
            </button>
          </Tooltip>
          <span className="hidden text-[11px] text-[var(--text-3)] sm:inline">{t('setup.frameThenLock')}</span>
          {lockButton}
        </div>
      </div>
    </div>
  );
}
