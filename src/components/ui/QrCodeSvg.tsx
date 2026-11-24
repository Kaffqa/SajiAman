import React, { useMemo } from 'react';
import { generateDeterministicQrMatrix } from '../../adapters/qrAdapter';

interface QrCodeSvgProps {
  value: string;
  size?: number;
}

/**
 * Deterministic monochrome SVG QR code component.
 * // TODO(expo-migration): Swap with `react-native-qrcode-svg`.
 */
export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({ value, size = 184 }) => {
  const matrix = useMemo(() => generateDeterministicQrMatrix(value), [value]);
  const cellSize = size / (matrix.size + 2); // 1-module quiet zone

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Kode QR Batch ${value}`}
      className="block"
    >
      <rect width={size} height={size} fill="#FFFFFF" />
      {matrix.modules.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={(c + 1) * cellSize}
              y={(r + 1) * cellSize}
              width={cellSize + 0.25}
              height={cellSize + 0.25}
              fill="#0F172A"
            />
          ) : null
        )
      )}
    </svg>
  );
};
