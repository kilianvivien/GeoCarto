import { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '@/state/documentStore';
import { useLocale } from '@/i18n/useLocale';
import { computeFrameBox } from './compositionFrame';

/**
 * Setup-only composition frame. Once the user locks the map area, the frame is
 * hidden so the locked map itself becomes the editing surface. Its aspect ratio
 * follows `project.exportFrame`, and the locked view is zoomed to match it.
 */
export function ExportFrame() {
  const t = useLocale((s) => s.t);
  const exportFrame = useDocumentStore((s) => s.project.exportFrame);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const aspect = exportFrame.width / exportFrame.height;
  const box = computeFrameBox(size.width, size.height, aspect);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {size.width > 0 && (
        <div
          className="relative rounded-[var(--radius-sm)] outline outline-[1.5px] outline-white"
          style={{
            width: box.width,
            height: box.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.32), 0 0 0 3px rgba(0,122,255,0.85)',
          }}
        >
          <span className="mono absolute -top-[22px] left-0 rounded-full bg-black/75 px-2 py-0.5 text-[10px] tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
            {t('frame.compositionArea')}
          </span>
        </div>
      )}
    </div>
  );
}
