// 64x64 RGB888 pixel buffer renderer for generating face images

import { getGlyph, measureText } from './PicopixelFont';

const WIDTH = 64;
const HEIGHT = 64;
const BYTES_PER_PIXEL = 3; // RGB888

export class PixelRenderer {
  private buffer: Buffer;

  constructor() {
    this.buffer = Buffer.alloc(WIDTH * HEIGHT * BYTES_PER_PIXEL, 0);
  }

  drawPixel(x: number, y: number, r: number, g: number, b: number): void {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const idx = (y * WIDTH + x) * BYTES_PER_PIXEL;
    this.buffer[idx] = r;
    this.buffer[idx + 1] = g;
    this.buffer[idx + 2] = b;
  }

  drawText(text: string, x: number, y: number, r: number, g: number, b: number): void {
    let cx = x;
    const cy = y;

    for (const ch of text) {
      const gl = getGlyph(ch);
      if (!gl) {
        cx += 2;
        continue;
      }

      const startX = cx + gl.xOffset;
      const startY = cy + gl.yOffset;

      let bitIndex = 0;
      for (let row = 0; row < gl.height; row++) {
        for (let col = 0; col < gl.width; col++) {
          const byteIdx = Math.floor(bitIndex / 8);
          const bitIdx = 7 - (bitIndex % 8);
          const on = (gl.bitmap[byteIdx] >> bitIdx) & 1;
          if (on) {
            this.drawPixel(startX + col, startY + row, r, g, b);
          }
          bitIndex++;
        }
      }

      cx += gl.xAdvance;
    }
  }

  drawDot(x: number, y: number, r: number, g: number, b: number): void {
    this.drawPixel(x, y, r, g, b);
  }

  fillColumn(x: number, y1: number, y2: number, r: number, g: number, b: number): void {
    const minY = Math.max(0, Math.min(y1, y2));
    const maxY = Math.min(HEIGHT - 1, Math.max(y1, y2));
    for (let y = minY; y <= maxY; y++) {
      this.drawPixel(x, y, r, g, b);
    }
  }

  getTextWidth(text: string): number {
    return measureText(text).width;
  }

  getBuffer(): Buffer {
    return this.buffer;
  }
}
