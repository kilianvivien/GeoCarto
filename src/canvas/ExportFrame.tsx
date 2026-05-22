/**
 * Visible export frame overlay (design.md §4.3). DOM-positioned, so it stays
 * fixed on screen while the map pans and zooms beneath it. Fixed size for now —
 * Milestone 5 makes the composition frame configurable.
 */
export function ExportFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className="relative h-[78%] max-h-[78%] w-auto max-w-[86%] rounded-[var(--radius-sm)] outline outline-[1.5px] outline-[var(--accent)]"
        style={{ aspectRatio: '4 / 3', boxShadow: '0 0 0 9999px rgba(0,0,0,0.14)' }}
      >
        <span className="mono absolute -top-[18px] left-0 text-[10px] tracking-wide text-[var(--accent)]">
          Export frame
        </span>
      </div>
    </div>
  );
}
