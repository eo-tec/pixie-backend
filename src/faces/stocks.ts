// Stock face image generator - renders stock chart as 64x64 RGB888

import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { PixelRenderer } from './renderer';

interface TimeframeConfig {
  daysBack: number;
  interval: string;
}

const TIMEFRAME_MAP: Record<string, TimeframeConfig> = {
  '1D': { daysBack: 1, interval: '5m' },
  '1W': { daysBack: 5, interval: '30m' },
  '1M': { daysBack: 30, interval: '1d' },
};

export async function generateStocksImage(ticker: string, timeframe: string): Promise<Buffer> {
  const tf = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP['1D'];

  const now = new Date();
  const period1 = new Date(now.getTime() - tf.daysBack * 24 * 60 * 60 * 1000);

  // Fetch chart data from Yahoo Finance
  const result = await yahooFinance.chart(ticker, {
    period1,
    interval: tf.interval as any,
  });

  const quotes = result.quotes.filter(q => q.close != null);
  if (quotes.length === 0) {
    throw new Error(`No data for ${ticker}`);
  }

  const renderer = new PixelRenderer();

  // Colors
  const amber = { r: 0xFF, g: 0xBF, b: 0x00 };
  const white = { r: 0xFF, g: 0xFF, b: 0xFF };
  const green = { r: 0x00, g: 0xFF, b: 0x64 };
  const red = { r: 0xFF, g: 0x3C, b: 0x3C };

  // Current price and change
  const currentPrice = quotes[quotes.length - 1].close!;
  const openPrice = quotes[0].open ?? quotes[0].close ?? currentPrice;
  const change = ((currentPrice - openPrice) / openPrice) * 100;
  const isPositive = change >= 0;
  const changeColor = isPositive ? green : red;

  // Format price based on magnitude
  let priceStr: string;
  if (currentPrice >= 10000) {
    priceStr = `$${Math.round(currentPrice)}`;
  } else if (currentPrice >= 1000) {
    priceStr = `$${currentPrice.toFixed(1)}`;
  } else if (currentPrice >= 1) {
    priceStr = `$${currentPrice.toFixed(2)}`;
  } else {
    priceStr = `$${currentPrice.toFixed(4)}`;
  }

  const changeStr = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;

  // Row ~6: Ticker (amber) left + timeframe (white) right
  renderer.drawText(ticker.toUpperCase(), 1, 6, amber.r, amber.g, amber.b);
  const tfWidth = renderer.getTextWidth(timeframe);
  renderer.drawText(timeframe, 63 - tfWidth, 6, white.r, white.g, white.b);

  // Row ~14: Price (white)
  renderer.drawText(priceStr, 1, 14, white.r, white.g, white.b);

  // Row ~22: % change (green/red)
  renderer.drawText(changeStr, 1, 22, changeColor.r, changeColor.g, changeColor.b);

  // Chart area: rows 26-63, full width
  const chartTop = 28;
  const chartBottom = 63;
  const chartLeft = 0;
  const chartRight = 63;
  const chartWidth = chartRight - chartLeft + 1;
  const chartHeight = chartBottom - chartTop;

  // Get min/max for scaling
  const closes = quotes.map(q => q.close!);
  const minPrice = Math.min(...closes);
  const maxPrice = Math.max(...closes);
  const priceRange = maxPrice - minPrice || 1;

  // Map data points to chart pixels
  const dataPoints = closes.length;
  const openY = chartBottom - Math.round(((openPrice - minPrice) / priceRange) * chartHeight);

  // Build chart grid: 0=black, 1=dim, 2=bright line
  const gridH = chartBottom - chartTop + 1;
  const grid: number[][] = Array.from({ length: gridH }, () => new Array(chartWidth).fill(0));
  // Track whether each cell is green or red
  const gridAbove: boolean[][] = Array.from({ length: gridH }, () => new Array(chartWidth).fill(true));

  let prevDotY: number | null = null;

  for (let px = 0; px < chartWidth; px++) {
    const dataIdx = Math.min(
      Math.floor((px / chartWidth) * dataPoints),
      dataPoints - 1
    );
    const price = closes[dataIdx];
    const dotY = chartBottom - Math.round(((price - minPrice) / priceRange) * chartHeight);
    const aboveOpen = price >= openPrice;

    // Dim fill between dotY and openY
    if (dotY <= openY) {
      for (let y = dotY + 1; y <= openY; y++) {
        const gy = y - chartTop;
        if (gy >= 0 && gy < gridH) { grid[gy][px] = 1; gridAbove[gy][px] = true; }
      }
    } else {
      for (let y = openY + 1; y <= dotY - 1; y++) {
        const gy = y - chartTop;
        if (gy >= 0 && gy < gridH) { grid[gy][px] = 1; gridAbove[gy][px] = false; }
      }
    }

    // Bright line: connect prevDotY to dotY
    if (prevDotY !== null && prevDotY !== dotY) {
      const minLY = Math.min(prevDotY, dotY);
      const maxLY = Math.max(prevDotY, dotY);
      for (let y = minLY; y <= maxLY; y++) {
        const gy = y - chartTop;
        if (gy >= 0 && gy < gridH) { grid[gy][px] = 2; gridAbove[gy][px] = y <= openY; }
      }
    } else {
      const gy = dotY - chartTop;
      if (gy >= 0 && gy < gridH) { grid[gy][px] = 2; gridAbove[gy][px] = aboveOpen; }
    }

    prevDotY = dotY;
  }

  // Post-process: bright pixels that don't touch black or a color boundary become dim
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < chartWidth; gx++) {
      if (grid[gy][gx] !== 2) continue;
      const above = gridAbove[gy][gx];
      const touchesBlack =
        (gy > 0 && grid[gy - 1][gx] === 0) ||
        (gy < gridH - 1 && grid[gy + 1][gx] === 0) ||
        (gx > 0 && grid[gy][gx - 1] === 0) ||
        (gx < chartWidth - 1 && grid[gy][gx + 1] === 0) ||
        gy === 0 || gy === gridH - 1 || gx === 0 || gx === chartWidth - 1;
      // Also keep bright if neighbor has a different color (green/red boundary)
      const touchesColorBoundary =
        (gy > 0 && grid[gy - 1][gx] !== 0 && gridAbove[gy - 1][gx] !== above) ||
        (gy < gridH - 1 && grid[gy + 1][gx] !== 0 && gridAbove[gy + 1][gx] !== above) ||
        (gx > 0 && grid[gy][gx - 1] !== 0 && gridAbove[gy][gx - 1] !== above) ||
        (gx < chartWidth - 1 && grid[gy][gx + 1] !== 0 && gridAbove[gy][gx + 1] !== above);
      if (!touchesBlack && !touchesColorBoundary) {
        grid[gy][gx] = 1; // downgrade to dim
      }
    }
  }

  // Render grid to pixel buffer
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < chartWidth; gx++) {
      if (grid[gy][gx] === 0) continue;
      const x = chartLeft + gx;
      const y = chartTop + gy;
      const above = gridAbove[gy][gx];
      const baseColor = above ? green : red;
      if (grid[gy][gx] === 2) {
        renderer.drawDot(x, y, baseColor.r, baseColor.g, baseColor.b);
      } else {
        renderer.drawDot(x, y, Math.floor(baseColor.r * 0.15), Math.floor(baseColor.g * 0.15), Math.floor(baseColor.b * 0.15));
      }
    }
  }

  return renderer.getBuffer();
}
