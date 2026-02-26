// Earth map data (64x64 RGB888) - procedural generation
// Simplified continent outlines with realistic Earth colors
// Can be regenerated from a real image with: scripts/generate-daynight-map.ts

const WIDTH = 64;
const HEIGHT = 64;

// Simplified continent mask: 1 = land, 0 = ocean
// Each row is a hex string where each hex digit represents 4 pixels
// Row 0 = top (90°N), Row 63 = bottom (90°S)
// Col 0 = left (180°W), Col 63 = right (180°E)
const LAND_ROWS: string[] = [
  // Row 0-7: Arctic region
  '0000000000000000', // 0
  '0000000000000000', // 1
  '00000C0F80FF0000', // 2 - bits of northern Canada/Greenland/Russia
  '0000FE3FE1FF8000', // 3
  '003CFFFFE3FFC000', // 4
  '007EFFFFC7FFE000', // 5
  '00FFFFFFCFFFE000', // 6
  '01FFFFFFDFFFE000', // 7
  // Row 8-15: Northern land masses
  '01FFFFFFDFFFE000', // 8
  '01FFFFFFDFFFC000', // 9
  '00FFFFFFF7FFC000', // 10
  '00FFFFFFFFFFF000', // 11
  '007FFFFFE7FFE000', // 12
  '003FFFFFE3FFC000', // 13
  '003FFFFFC3FFC000', // 14
  '001FFFFF83FF8000', // 15
  // Row 16-23: Mid latitudes
  '001FFFFF03FF0000', // 16
  '000FFFFE03FE0000', // 17
  '000FFFFC01FC0000', // 18
  '0007FFF800F80000', // 19
  '0003FFF000700000', // 20
  '0001FFE000200000', // 21
  '0000FFC000000000', // 22
  '00007F8000000000', // 23
  // Row 24-31: Tropics (Africa, South America, SE Asia)
  '00003F0000000000', // 24
  '00001E0000006000', // 25
  '00000E000000E000', // 26
  '00000E000001E000', // 27
  '00000F000001C000', // 28
  '00000F000001C000', // 29
  '000007800001C000', // 30
  '000007800001C000', // 31
  // Row 32-39: South tropics
  '000003C00000C000', // 32
  '000003C000008000', // 33
  '000001E000008000', // 34
  '000001E000000000', // 35
  '000000F000000000', // 36
  '000000F000000000', // 37
  '0000007000000000', // 38
  '0000003000000000', // 39
  // Row 40-47: Southern mid-latitudes + Australia
  '0000002000000000', // 40
  '0000000000003C00', // 41 - Australia starts
  '0000000000007E00', // 42
  '000000000000FE00', // 43
  '000000000000FE00', // 44
  '000000000000FC00', // 45
  '0000000000007800', // 46
  '0000000000003000', // 47
  // Row 48-55: Southern oceans + southern tips
  '0000000000000000', // 48
  '0000000000000000', // 49
  '0000000000000000', // 50
  '0000000000000000', // 51
  '0000000000000000', // 52
  '0000000000000000', // 53
  '0000000000000000', // 54
  '0000000000000000', // 55
  // Row 56-63: Antarctica
  '0000000000000000', // 56
  '0000000000000000', // 57
  'E00000000000000F', // 58
  'FC000000000003FF', // 59
  'FFF00000000FFFFF', // 60
  'FFFFFFFFFEFFFFFF', // 61
  'FFFFFFFFFFFFFFFF', // 62
  'FFFFFFFFFFFFFFFF', // 63
];

function isLand(x: number, y: number): boolean {
  if (y < 0 || y >= HEIGHT || x < 0 || x >= WIDTH) return false;
  const row = LAND_ROWS[y];
  if (!row) return false;
  // Each hex char = 4 bits, 16 hex chars = 64 bits
  const hexIdx = Math.floor(x / 4);
  const bitIdx = 3 - (x % 4);
  const nibble = parseInt(row[hexIdx], 16);
  return ((nibble >> bitIdx) & 1) === 1;
}

// Ocean colors with latitude-based variation
function getOceanColor(lat: number): [number, number, number] {
  const absLat = Math.abs(lat);
  if (absLat > 70) return [20, 30, 60];   // Dark cold polar
  if (absLat > 50) return [15, 35, 90];   // Cool ocean
  if (absLat > 30) return [10, 40, 110];  // Temperate ocean
  return [8, 50, 130];                     // Warm tropical blue
}

// Land colors with latitude-based biome variation
function getLandColor(lat: number): [number, number, number] {
  const absLat = Math.abs(lat);
  if (absLat > 75) return [220, 225, 230]; // Ice/snow
  if (absLat > 65) return [140, 155, 130]; // Tundra
  if (absLat > 50) return [50, 100, 40];   // Boreal forest
  if (absLat > 35) return [60, 120, 45];   // Temperate forest
  if (absLat > 20) return [160, 140, 80];  // Desert/steppe
  if (absLat > 5)  return [40, 110, 35];   // Tropical forest
  return [30, 95, 30];                      // Equatorial rainforest
}

let cachedBuffer: Buffer | null = null;

export function getEarthMapBuffer(): Buffer {
  if (cachedBuffer) return cachedBuffer;

  const buf = Buffer.alloc(WIDTH * HEIGHT * 3);

  for (let y = 0; y < HEIGHT; y++) {
    const lat = 90 - (y / (HEIGHT - 1)) * 180;
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 3;
      let r: number, g: number, b: number;

      if (isLand(x, y)) {
        [r, g, b] = getLandColor(lat);
      } else {
        [r, g, b] = getOceanColor(lat);
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
    }
  }

  cachedBuffer = buf;
  return buf;
}
