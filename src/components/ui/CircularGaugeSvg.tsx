import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface CircularGaugeSvgProps {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  centerLabel?: string;
  centerTextColor?: string;
}

/**
 * Lightweight vector radial ring using react-native-svg for countdown & eco metrics.
 */
export const CircularGaugeSvg: React.FC<CircularGaugeSvgProps> = ({
  progress,
  size = 54,
  strokeWidth = 5,
  color,
  trackColor = 'rgba(255,255,255,0.22)',
  centerLabel,
  centerTextColor = '#FFFFFF',
}) => {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped);

  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center relative shrink-0"
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      {centerLabel ? (
        <View className="absolute inset-0 items-center justify-center">
          <Text
            style={{ color: centerTextColor }}
            className="font-mono text-[11px] font-bold"
          >
            {centerLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
