import { useDocumentStore } from '@/state/documentStore';

/** Visual underlay for image/PDF basemaps. Static sources are not georeferenced in this pass. */
export function StaticBasemapOverlay() {
  const basemap = useDocumentStore((s) => s.project.basemap);
  if (basemap.kind !== 'static') return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-[var(--bg-2)]">
      <div
        className="h-[78%] max-h-[78%] w-auto max-w-[86%] overflow-hidden rounded-[var(--radius-sm)] bg-white/5"
        style={{ aspectRatio: '4 / 3' }}
      >
        {basemap.mediaType === 'image' ? (
          <img src={basemap.dataUrl} alt={basemap.name} className="h-full w-full object-contain" />
        ) : (
          <object
            data={basemap.dataUrl}
            type={basemap.mimeType}
            aria-label={basemap.name}
            className="h-full w-full bg-white"
          />
        )}
      </div>
    </div>
  );
}
