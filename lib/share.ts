import { Chess } from 'chess.js';
import type { Attempt } from './contracts';
import { appPath } from './site';
export const shareText = (attempt: Attempt, number: number) =>
  `Solved ${attempt.day === new Date(attempt.updatedAt).toISOString().slice(0, 10) ? "today's" : 'my'} Chesscape within ${((attempt.elapsedMs ?? 0) / 1000).toFixed(2)} seconds. ♟\nChesscape No. ${String(number).padStart(3, '0')} · ${attempt.day}\nFind your escape → https://lowkey.tools/chesscape`;
export async function createShareImage(
  attempt: Attempt,
  number: number,
): Promise<Blob> {
  // Wait for the page's self-hosted font before baking text into the PNG.
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1260;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image export is not supported in this browser.');
  ctx.fillStyle = '#f7f8f2';
  ctx.fillRect(0, 0, 1000, 1260);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#41643c';
  ctx.font = '22px "Play", Arial, sans-serif';
  ctx.fillText('CHESSCAPE  /  THE DAILY ESCAPE', 500, 75);
  ctx.fillStyle = '#273b2b';
  ctx.font = '64px "Play", Arial, sans-serif';
  ctx.fillText('Found my way out.', 500, 160);
  ctx.font = '112px "Play", Arial, sans-serif';
  ctx.fillText(((attempt.elapsedMs ?? 0) / 1000).toFixed(2) + 's', 500, 290);
  ctx.font = '21px "Play", Arial, sans-serif';
  ctx.fillStyle = '#728168';
  ctx.fillText(
    `No. ${String(number).padStart(3, '0')}  ·  ${attempt.day}  ·  KING SAFE`,
    500,
    340,
  );
  const board = new Chess(attempt.fen).board().flat();
  const flipped = new Chess(attempt.fen).turn() === 'w';
  const squares = flipped ? [...board].reverse() : board;
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    [
      ...new Set(
        squares.filter(Boolean).map((p) => p!.color + p!.type.toUpperCase()),
      ),
    ].map(async (key) => {
      const img = new Image();
      img.src = appPath(`/pieces/${key}.svg`);
      await img.decode();
      images.set(key, img);
    }),
  );
  const cell = 94,
    originX = 124,
    originY = 394;
  ctx.fillStyle = '#d8e0ce';
  ctx.fillRect(originX - 10, originY - 10, cell * 8 + 20, cell * 8 + 20);
  squares.forEach((piece, i) => {
    const r = Math.floor(i / 8),
      c = i % 8,
      x = originX + c * cell,
      y = originY + r * cell;
    ctx.fillStyle = (r + c) % 2 ? '#8ba578' : '#e8eddd';
    ctx.fillRect(x, y, cell, cell);
    if (piece)
      ctx.drawImage(
        images.get(piece.color + piece.type.toUpperCase())!,
        x + 7,
        y + 7,
        80,
        80,
      );
  });
  ctx.fillStyle = '#56734a';
  ctx.font = '24px "Play", Arial, sans-serif';
  ctx.fillText('One position. Thirty seconds. Your move.', 500, 1192);
  ctx.fillStyle = '#849078';
  ctx.font = '18px "Play", Arial, sans-serif';
  ctx.fillText('lowkey.tools/chesscape', 500, 1230);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Could not create your image.')),
      'image/png',
    ),
  );
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
