import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MonoCounterProps {
  value: string | number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
}

const SIZE_STYLES = {
  sm: { fontSize: 14, lineHeight: 18 },
  md: { fontSize: 20, lineHeight: 24 },
  lg: { fontSize: 28, lineHeight: 32 },
  xl: { fontSize: 34, lineHeight: 38 },
};

export const MonoCounter: React.FC<MonoCounterProps> = ({
  value,
  unit,
  size = 'lg',
  className = '',
  color = '#0F172A',
}) => {
  const sizeStyle = SIZE_STYLES[size];

  return (
    <View className={`flex-row items-baseline gap-1 ${className}`}>
      <Text
        style={[
          styles.monoText,
          sizeStyle,
          { color },
        ]}
      >
        {String(value)}
      </Text>
      {unit ? (
        <Text
          style={[styles.unitText, { color }]}
          className="text-[13px] font-sans font-semibold opacity-80"
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  monoText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  unitText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
