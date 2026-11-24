/**
 * QR Code Adapter (Strict Native Boundary)
 * // TODO(expo-migration): Swap renderer with `react-native-qrcode-svg`
 * // and scanner with `expo-camera` CameraView `onBarcodeScanned`.
 */

export interface QrMatrix {
  size: number;
  modules: boolean[][];
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isInFinderZone(row: number, col: number, size: number): boolean {
  const topLeft = row < 8 && col < 8;
  const topRight = row < 8 && col >= size - 8;
  const bottomLeft = row >= size - 8 && col < 8;
  return topLeft || topRight || bottomLeft;
}

function drawFinderPattern(grid: boolean[][], startRow: number, startCol: number) {
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      grid[startRow + r][startCol + c] = isBorder || isCenter;
    }
  }
}

/**
 * Generates a deterministic 25x25 QR-style matrix with genuine finder patterns,
 * timing strips, alignment square, and payload-derived data modules.
 */
export function generateDeterministicQrMatrix(payload: string): QrMatrix {
  const size = 25;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  // Three 7x7 finder patterns
  drawFinderPattern(modules, 0, 0);
  drawFinderPattern(modules, 0, size - 7);
  drawFinderPattern(modules, size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    modules[6][i] = i % 2 === 0;
    modules[i][6] = i % 2 === 0;
  }

  // Alignment pattern at (16..20, 16..20)
  for (let r = 16; r <= 20; r += 1) {
    for (let c = 16; c <= 20; c += 1) {
      const isEdge = r === 16 || r === 20 || c === 16 || c === 20;
      const isCenter = r === 18 && c === 18;
      modules[r][c] = isEdge || isCenter;
    }
  }

  // Deterministic PRNG seeded from payload
  let seed = hashString(payload || 'SAJIAMAN-MBG');
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (isInFinderZone(r, c, size)) continue;
      if (r === 6 || c === 6) continue;
      if (r >= 16 && r <= 20 && c >= 16 && c <= 20) continue;

      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      modules[r][c] = ((seed >>> 24) & 1) === 1;
    }
  }

  return { size, modules };
}

/**
 * Normalizes scanned or manually typed batch IDs.
 */
export function normalizeScannedBatchCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/^#/, '');
}
