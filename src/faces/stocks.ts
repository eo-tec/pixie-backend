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
  const previousClose = (result.meta as any).previousClose ?? (result.meta as any).chartPreviousClose;
  const openPrice = previousClose ?? quotes[0].open ?? quotes[0].close ?? currentPrice;
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

  // Row 5: Ticker (amber) left + timeframe (white) right
  renderer.drawText(ticker.toUpperCase(), 1, 5, amber.r, amber.g, amber.b);
  const tfWidth = renderer.getTextWidth(timeframe);
  renderer.drawText(timeframe, 63 - tfWidth, 5, white.r, white.g, white.b);

  // Row 13: Price (white)
  renderer.drawText(priceStr, 1, 13, white.r, white.g, white.b);

  // Row 21: % change (green/red)
  renderer.drawText(changeStr, 1, 21, changeColor.r, changeColor.g, changeColor.b);

  // Chart area: rows 26-63, full width
  const chartTop = 28;
  const chartBottom = 63;
  const chartLeft = 0;
  const chartRight = 63;
  const chartWidth = chartRight - chartLeft + 1;
  const chartHeight = chartBottom - chartTop;

  // Get min/max for scaling (include openPrice so reference line is always visible)
  const closes = quotes.map(q => q.close!);
  const minPrice = Math.min(...closes, openPrice);
  const maxPrice = Math.max(...closes, openPrice);
  const priceRange = maxPrice - minPrice || 1;

  // Aggregate data points per pixel column (average all points that map to each column)
  const dataPoints = closes.length;
  const rawColumnPrices: number[] = [];
  for (let px = 0; px < chartWidth; px++) {
    const startIdx = Math.floor((px / chartWidth) * dataPoints);
    const endIdx = Math.floor(((px + 1) / chartWidth) * dataPoints);
    const slice = closes.slice(startIdx, Math.max(endIdx, startIdx + 1));
    rawColumnPrices.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }

  // Smooth with a weighted moving average (radius=2) to reduce jaggedness
  const columnPrices: number[] = [];
  for (let i = 0; i < chartWidth; i++) {
    let sum = 0, weight = 0;
    for (let d = -2; d <= 2; d++) {
      const j = Math.max(0, Math.min(chartWidth - 1, i + d));
      const w = 3 - Math.abs(d); // weights: 1, 2, 3, 2, 1
      sum += rawColumnPrices[j] * w;
      weight += w;
    }
    columnPrices.push(sum / weight);
  }

  const openY = chartBottom - Math.round(((openPrice - minPrice) / priceRange) * chartHeight);

  let prevDotY: number | null = null;

  for (let px = 0; px < chartWidth; px++) {
    const price = columnPrices[px];
    const dotY = chartBottom - Math.round(((price - minPrice) / priceRange) * chartHeight);
    const aboveOpen = price >= openPrice;

    // Draw bright line connecting prevDotY to dotY (single color per column)
    const color = aboveOpen ? green : red;
    if (prevDotY !== null && prevDotY !== dotY) {
      const minLY = Math.min(prevDotY, dotY);
      const maxLY = Math.max(prevDotY, dotY);
      for (let y = minLY; y <= maxLY; y++) {
        renderer.drawDot(chartLeft + px, y, color.r, color.g, color.b);
      }
    } else {
      renderer.drawDot(chartLeft + px, dotY, color.r, color.g, color.b);
    }

    prevDotY = dotY;
  }

  return renderer.getBuffer();
}
