// Day/Night world map face generator
// Renders a 64x64 Earth map with real-time day/night illumination

import { getEarthMapBuffer } from './daynight-map';

const WIDTH = 64;
const HEIGHT = 64;
const DEG_TO_RAD = Math.PI / 180;

const NIGHT_BRIGHTNESS = 0.08;
const TWILIGHT_LOW = -0.1;   // cosZenith below this = full night
const TWILIGHT_HIGH = 0.1;   // cosZenith above this = full day

export async function generateDayNightImage(): Promise<Buffer> {
  const now = new Date();
  const earthMap = getEarthMapBuffer();
  const output = Buffer.alloc(WIDTH * HEIGHT * 3);

  // Day of year (1-365)
  const start = new Date(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Solar declination (angle of sun above/below equator)
  const declination = -23.44 * Math.cos(DEG_TO_RAD * (360 / 365) * (dayOfYear + 10));
  const decRad = declination * DEG_TO_RAD;
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);

  // Subsolar point longitude (where the sun is directly overhead)
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const subsolarLon = -(utcHours / 24 * 360 - 180);
  const subsolarLonRad = subsolarLon * DEG_TO_RAD;

  for (let py = 0; py < HEIGHT; py++) {
    // Latitude: top row = +90° (North Pole), bottom row = -90° (South Pole)
    const lat = 90 - (py / (HEIGHT - 1)) * 180;
    const latRad = lat * DEG_TO_RAD;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);

    for (let px = 0; px < WIDTH; px++) {
      // Longitude: left = -180°, right = +180°
      const lon = (px / (WIDTH - 1)) * 360 - 180;
      const lonRad = lon * DEG_TO_RAD;

      // Solar zenith angle cosine
      const cosZenith = sinLat * sinDec + cosLat * cosDec * Math.cos(lonRad - subsolarLonRad);

      // Brightness factor with smooth twilight transition
      let factor: number;
      if (cosZenith >= TWILIGHT_HIGH) {
        factor = 1.0;
      } else if (cosZenith <= TWILIGHT_LOW) {
        factor = NIGHT_BRIGHTNESS;
      } else {
        // Smooth interpolation in twilight zone
        const t = (cosZenith - TWILIGHT_LOW) / (TWILIGHT_HIGH - TWILIGHT_LOW);
        factor = NIGHT_BRIGHTNESS + t * (1.0 - NIGHT_BRIGHTNESS);
      }

      const srcIdx = (py * WIDTH + px) * 3;
      const dstIdx = srcIdx;
      output[dstIdx] = Math.round(earthMap[srcIdx] * factor);
      output[dstIdx + 1] = Math.round(earthMap[srcIdx + 1] * factor);
      output[dstIdx + 2] = Math.round(earthMap[srcIdx + 2] * factor);
    }
  }

  return output;
}
