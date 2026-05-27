import type { AnnotationStyle, FillPattern } from '@/project/cartoproj';

export function strokeDash(style: Pick<AnnotationStyle, 'strokePattern' | 'strokeWidth'>): number[] | undefined {
  if (style.strokePattern === 'dotted') return [1, Math.max(4, style.strokeWidth * 2.4)];
  if (style.strokePattern === 'dashed') return [Math.max(8, style.strokeWidth * 4), Math.max(5, style.strokeWidth * 2.5)];
  return undefined;
}

export interface HatchLine {
  points: number[];
}

export function hatchLines(
  width: number,
  height: number,
  pattern: FillPattern,
  spacing = 10,
): HatchLine[] {
  if (pattern === 'none') return [];
  if (pattern === 'dots') return dotLines(width, height, spacing);
  if (pattern === 'horizontal') return range(0, height, spacing).map((y) => ({ points: [0, y, width, y] }));
  if (pattern === 'vertical') return range(0, width, spacing).map((x) => ({ points: [x, 0, x, height] }));

  const diagonal = diagonalDownLines(width, height, spacing);
  if (pattern === 'diagonal') return diagonal;
  const reverse = diagonalUpLines(width, height, spacing);
  return [...diagonal, ...reverse];
}

function range(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += step) values.push(value);
  return values;
}

function dotLines(width: number, height: number, spacing: number): HatchLine[] {
  const points: HatchLine[] = [];
  for (let y = 4; y <= height; y += spacing) {
    for (let x = 4; x <= width; x += spacing) {
      points.push({ points: [x, y, x + 0.01, y + 0.01] });
    }
  }
  return points;
}

function diagonalDownLines(width: number, height: number, spacing: number): HatchLine[] {
  const lines: HatchLine[] = [];
  for (const sum of range(0, width + height, spacing)) {
    const points = uniquePoints([
      [sum, 0],
      [sum - height, height],
      [0, sum],
      [width, sum - width],
    ], width, height);
    if (points.length >= 2) lines.push({ points: [points[0][0], points[0][1], points[1][0], points[1][1]] });
  }
  return lines;
}

function diagonalUpLines(width: number, height: number, spacing: number): HatchLine[] {
  const lines: HatchLine[] = [];
  for (const offset of range(-height, width, spacing)) {
    const points = uniquePoints([
      [offset, 0],
      [offset + height, height],
      [0, -offset],
      [width, width - offset],
    ], width, height);
    if (points.length >= 2) lines.push({ points: [points[0][0], points[0][1], points[1][0], points[1][1]] });
  }
  return lines;
}

function uniquePoints(points: number[][], width: number, height: number): [number, number][] {
  const seen = new Set<string>();
  const output: [number, number][] = [];
  for (const [x, y] of points) {
    if (x < -0.001 || x > width + 0.001 || y < -0.001 || y > height + 0.001) continue;
    const clamped: [number, number] = [
      Math.min(width, Math.max(0, x)),
      Math.min(height, Math.max(0, y)),
    ];
    const key = `${clamped[0].toFixed(3)},${clamped[1].toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(clamped);
  }
  return output;
}

export function patternCanvas(style: Pick<AnnotationStyle, 'fillColor' | 'fillPattern' | 'strokeColor'>): HTMLImageElement | undefined {
  if (style.fillPattern === 'none') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = style.fillColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = style.strokeColor;
  ctx.fillStyle = style.strokeColor;
  ctx.lineWidth = 1.5;

  drawPattern(ctx, style.fillPattern);
  return canvas as unknown as HTMLImageElement;
}

function drawPattern(ctx: CanvasRenderingContext2D, pattern: FillPattern): void {
  switch (pattern) {
    case 'diagonal':
      drawDiagonal(ctx);
      break;
    case 'crosshatch':
      drawDiagonal(ctx);
      ctx.save();
      ctx.translate(16, 0);
      ctx.scale(-1, 1);
      drawDiagonal(ctx);
      ctx.restore();
      break;
    case 'horizontal':
      for (let y = 3; y < 16; y += 6) drawLine(ctx, 0, y, 16, y);
      break;
    case 'vertical':
      for (let x = 3; x < 16; x += 6) drawLine(ctx, x, 0, x, 16);
      break;
    case 'dots':
      for (let y = 4; y < 16; y += 8) {
        for (let x = 4; x < 16; x += 8) {
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case 'none':
      break;
  }
}

function drawDiagonal(ctx: CanvasRenderingContext2D): void {
  for (let x = -16; x <= 16; x += 6) drawLine(ctx, x, 16, x + 16, 0);
}

function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
