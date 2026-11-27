import React from 'react';
import { View } from 'react-native';
import { QrCodeView } from '../../adapters/qrAdapter';

interface QrCodeSvgProps {
  payload: string;
  size?: number;
  className?: string;
}

export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({
  payload,
  size = 200,
  className = '',
}) => {
  return (
    <View className={`items-center justify-center ${className}`}>
      <QrCodeView value={payload} size={size} />
    </View>
  );
};
