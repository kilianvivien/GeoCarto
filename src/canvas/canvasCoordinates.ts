type Point = { x: number; y: number };
type SurfaceOffset = { x: number; y: number };

export function canvasAnchorFromClientPoint(
  client: Point,
  canvasRect: Pick<DOMRect, 'left' | 'top'>,
  surface: SurfaceOffset,
): Point {
  return {
    x: client.x - canvasRect.left - surface.x,
    y: client.y - canvasRect.top - surface.y,
  };
}
