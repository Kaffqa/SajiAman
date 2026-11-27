import React from 'react';
import { View } from 'react-native';
import type { SafetyStatus } from '../../types/sajiaman';

interface SafetyProgressBarProps {
  remainingMs: number;
  holdingHours: number;
  status: SafetyStatus;
  height?: number;
}

/**
 * Proportional visual bar showing remaining safe consumption window
 * relative to the batch's total holding duration.
 */
export const SafetyProgressBar: React.FC<SafetyProgressBarProps> = ({
  remainingMs,
  holdingHours,
  status,
  height = 5,
}) => {
  const totalMs = Math.max(holdingHours * 3600 * 1000, 1);
  const ratio = status === 'RED' ? 0 : Math.max(0, Math.min(1, remainingMs / totalMs));
  const widthPct = status === 'RED' ? 100 : Math.max(6, Math.round(ratio * 100));

  const trackBg =
    status === 'GREEN'
      ? '#DCFCE7'
      : status === 'YELLOW'
        ? '#FEF3C7'
        : '#FEE2E2';

  const fillColor =
    status === 'GREEN'
      ? '#15803D'
      : status === 'YELLOW'
        ? '#D97706'
        : '#DC2626';

  return (
    <View
      className="w-full rounded-full overflow-hidden"
      style={{ height, backgroundColor: trackBg }}
    >
      <View
        className="h-full rounded-full"
        style={{
          width: `${widthPct}%`,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
};
