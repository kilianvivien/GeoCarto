import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { useGeocode } from '@/geocode/useGeocode';
import { parseCoordinates } from '@/geocode/parseCoordinates';
import type { GeocodeResult } from '@/geocode/provider';
import { DEFAULT_ANNOTATION_STYLE } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { hintDiscreteHistoryLabel } from '@/state/historyStore';
import { useToolStore } from '@/state/toolStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { createAnnotation } from '@/tools/annotationFactory';
import { useMapInstance } from '@/canvas/mapInstance';
import { useLocale } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';
import { useModalFocusTrap } from './useModalFocusTrap';

const KIND_LABEL_KEYS: Record<string, TranslationKey> = {
  country: 'place.kindCountry',
  region: 'place.kindRegion',
  city: 'place.kindCity',
  street: 'place.kindStreet',
  boundary: 'place.kindBoundary',
  poi: 'place.kindPoi',
};

function flyToResult(result: GeocodeResult): void {
  const map = useMapInstance.getState().map;
  if (!map) {
    const { project, setProjectionConfig } = useDocumentStore.getState();
    if (project.engine === 'projected' && project.projection) {
      setProjectionConfig({ rotateLambda: -result.center[0] });
    }
    return;
  }
  if (result.bbox) {
    const [minLng, minLat, maxLng, maxLat] = result.bbox;
    const camera = map.cameraForBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 48, maxZoom: 15 },
    );
    if (camera) {
      map.flyTo({ center: camera.center, zoom: camera.zoom });
      return;
    }
  }
  map.flyTo({ center: result.center, zoom: 12 });
}

function addPinForResult(result: GeocodeResult): void {
  const map = useMapInstance.getState().map;
  const { defaultStyle } = useToolStore.getState();
  const position = map ? map.project(result.center) : { x: 0, y: 0 };
  const annotation = createAnnotation({
    kind: 'pin',
    anchorMode: 'map',
    position,
    geoAnchor: result.center,
    style: { ...DEFAULT_ANNOTATION_STYLE, ...defaultStyle },
  });
  if (annotation.kind !== 'pin') return;
  hintDiscreteHistoryLabel('Add pin');
  useDocumentStore.getState().addAnnotation({ ...annotation, label: result.label });
}

interface PlaceSearchProps {
  open: boolean;
  onClose: () => void;
}

/** Global place search — flies the map to a result or drops a labelled pin. */
export function PlaceSearch({ open, onClose }: PlaceSearchProps) {
  const t = useLocale((s) => s.t);
  const locale = useLocale((s) => s.locale);
  const mode = useDocumentStore((s) => s.project.mode);
  const onlineSearchEnabled = usePreferencesStore((s) => s.onlineSearchEnabled);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(open, containerRef, onClose);

  const { results, loading, error } = useGeocode(query, locale, open && onlineSearchEnabled);
  const coordinateMatch = parseCoordinates(query);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results, coordinateMatch]);

  if (!open) return null;

  const rowCount = (coordinateMatch ? 1 : 0) + results.length;

  const selectCoordinate = () => {
    if (!coordinateMatch) return;
    flyToResult({
      id: 'coordinates',
      label: query.trim(),
      kind: 'coordinates',
      center: coordinateMatch.center,
    });
    onClose();
  };

  const selectResult = (result: GeocodeResult) => {
    flyToResult(result);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(rowCount - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (coordinateMatch && activeIndex === 0) {
        selectCoordinate();
        return;
      }
      const resultIndex = activeIndex - (coordinateMatch ? 1 : 0);
      const result = results[resultIndex];
      if (result) selectResult(result);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('place.goToPlace')}
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="glass w-[min(480px,100%)] overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-modal)] text-[var(--text)] shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-2.5">
          <Search size={15} className="text-[var(--text-3)]" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('place.searchPlaceholder')}
            aria-label={t('place.goToPlace')}
            className="h-8 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
          />
          <button
            type="button"
            aria-label={t('settings.close')}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[48vh] overflow-y-auto p-2">
          {!onlineSearchEnabled && (
            <div className="px-3 py-2 text-[11.5px] text-[var(--text-3)]">{t('place.onlineSearchDisabled')}</div>
          )}

          {coordinateMatch && (
            <button
              type="button"
              onClick={selectCoordinate}
              className={`flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-[var(--hover)] ${
                activeIndex === 0 ? 'bg-[var(--hover)]' : ''
              }`}
            >
              <MapPin size={14} className="shrink-0 text-[var(--text-3)]" />
              <span className="flex-1 truncate">
                {t('place.coordinateEntry', {
                  lng: coordinateMatch.center[0].toFixed(4),
                  lat: coordinateMatch.center[1].toFixed(4),
                })}
              </span>
              {coordinateMatch.ambiguous && (
                <span className="text-[10.5px] text-[var(--text-3)]">{t('place.assumedLatLon')}</span>
              )}
            </button>
          )}

          {onlineSearchEnabled &&
            results.map((result, index) => {
              const rowIndex = index + (coordinateMatch ? 1 : 0);
              const kindKey = KIND_LABEL_KEYS[result.kind];
              const kindLabel = kindKey ? t(kindKey) : result.kind;
              return (
                <div
                  key={result.id}
                  className={`flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[12.5px] transition-colors ${
                    rowIndex === activeIndex ? 'bg-[var(--hover)]' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectResult(result)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span className="rounded-[5px] bg-[var(--glass-thin)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">
                      {kindLabel}
                    </span>
                    <span className="flex-1 truncate">
                      <span className="font-medium text-[var(--text)]">{result.label}</span>
                      {result.context && (
                        <span className="ml-1.5 text-[var(--text-3)]">{result.context}</span>
                      )}
                    </span>
                  </button>
                  {mode === 'editing' && (
                    <button
                      type="button"
                      aria-label={t('place.addPin')}
                      onClick={() => {
                        addPinForResult(result);
                        onClose();
                      }}
                      className="flex h-6 shrink-0 items-center gap-1 rounded-[6px] border border-[var(--divider)] px-1.5 text-[10.5px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
                    >
                      <MapPin size={11} />
                      {t('place.addPin')}
                    </button>
                  )}
                </div>
              );
            })}

          {onlineSearchEnabled && loading && (
            <div className="px-3 py-6 text-center text-[12px] text-[var(--text-2)]">{t('place.searching')}</div>
          )}
          {onlineSearchEnabled && error && (
            <div className="px-3 py-2 text-[11.5px] text-[var(--text-3)]">{t('place.searchUnavailable')}</div>
          )}
          {onlineSearchEnabled &&
            !loading &&
            !error &&
            !coordinateMatch &&
            results.length === 0 &&
            query.trim().length > 0 && (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--text-2)]">{t('place.noResults')}</div>
            )}
        </div>

        {onlineSearchEnabled && (
          <div className="border-t border-[var(--divider)] px-4 py-2 text-[10.5px] text-[var(--text-3)]">
            {t('place.attribution')}
          </div>
        )}
      </div>
    </div>
  );
}
