import React from 'react';
import { View, ViewStyle } from 'react-native';

interface HairlineCardProps {
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle;
  padded?: boolean;
}

export const HairlineCard: React.FC<HairlineCardProps> = ({
  children,
  className = '',
  style,
  padded = true,
}) => {
  return (
    <View
      style={style}
      className={`rounded-[12px] border border-[#D8E2EC] bg-white ${padded ? 'p-3.5' : ''} ${className}`}
    >
      {children}
    </View>
  );
};
