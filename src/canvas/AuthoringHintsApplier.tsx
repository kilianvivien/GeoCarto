import { useEffect } from 'react';
import { useDocumentStore } from '@/state/documentStore';
import { useAuthoringHints, type AuthoringHints } from '@/project/authoringHints';
import { useMapInstance } from './mapInstance';

/** Space kept between a corner-placed annotation and the frame edge, in canvas pixels. */
const CORNER_MARGIN = 24;

function cornerPosition(
  placement: AuthoringHints['placements'][number],
  surface: { width: number; height: number },
): { x: number; y: number } {
  const right = placement.corner.endsWith('right');
  const bottom = placement.corner.startsWith('bottom');
  return {
    x: right ? Math.max(CORNER_MARGIN, surface.width - placement.width - CORNER_MARGIN) : CORNER_MARGIN,
    y: bottom ? Math.max(CORNER_MARGIN, surface.height - placement.height - CORNER_MARGIN) : CORNER_MARGIN,
  };
}

/**
 * Headless: resolves the layout hints of a freshly opened authored project
 * ("fit these bounds", "legend in the top-right corner") against the live map
 * surface, writes the result into the document as ordinary viewport and
 * position values, and clears the hints. Runs once per opened file.
 */
export function AuthoringHintsApplier() {
  const hints = useAuthoringHints((s) => s.hints);
  const map = useMapInstance((s) => s.map);
  const containerSize = useMapInstance((s) => s.containerSize);
  const engine = useDocumentStore((s) => s.project.engine);

  useEffect(() => {
    if (!hints) return;
    // The projected engine has no MapLibre map; it publishes its surface size instead.
    if (engine === 'projected' ? !containerSize : !map) return;

    // Two frames: the surface is re-laid out for the new document's frame
    // aspect before its size (and the camera fit that depends on it) is read.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        useAuthoringHints.setState({ hints: null });
        const store = useDocumentStore.getState();
        const container = map?.getContainer();
        const surface = container
          ? { width: container.clientWidth, height: container.clientHeight }
          : containerSize;
        if (!surface || surface.width === 0) return;

        if (hints.bounds && map && store.project.mode === 'editing') {
          const [west, south, east, north] = hints.bounds;
          map.resize();
          map.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            { animate: false, padding: 0 },
          );
          const center = map.getCenter();
          store.lockMapArea({ center: [center.lng, center.lat], zoom: map.getZoom(), bearing: 0, pitch: 0 });
        }
        for (const placement of hints.placements) {
          store.updateAnnotation(placement.id, { position: cornerPosition(placement, surface) });
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [hints, map, containerSize, engine]);

  return null;
}
