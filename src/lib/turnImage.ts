// A photo turned and mirrored as Crop and rotate shows it (the editor's preview and the handler's full-size output).
import type { Rotation } from '@/tools/scan';

/** The photo turned `rotation` and mirrored when `flip`, at `scale` of its size (shared with the handler). */
export function drawTurned(img: ImageBitmap | HTMLCanvasElement, rotation: Rotation, flip: boolean, scale = 1): HTMLCanvasElement {
  const turned = rotation % 180 !== 0;
  const w = Math.round((turned ? img.height : img.width) * scale);
  const h = Math.round((turned ? img.width : img.height) * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.translate(w / 2, h / 2);
  if (flip) g.scale(-1, 1);
  g.rotate((rotation * Math.PI) / 180);
  g.drawImage(img, (-img.width * scale) / 2, (-img.height * scale) / 2, img.width * scale, img.height * scale);
  return c;
}
