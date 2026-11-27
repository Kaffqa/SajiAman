/**
 * SajiAman QR Code Adapter
 * Renders scannable vector QR codes via react-native-qrcode-svg
 * and handles payload parsing for the 1-Scan School Verification flow.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export * from '../domain/qrCrypto';

export interface QrCodeProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  quietZone?: number;
}

export const QrCodeView: React.FC<QrCodeProps> = ({
  value,
  size = 200,
  color = '#0B2E59',
  backgroundColor = '#FFFFFF',
  quietZone = 8,
}) => {
  return (
    <View style={[styles.container, { padding: quietZone, backgroundColor }]}>
      <QRCode
        value={value || 'SAJIAMAN-EMPTY'}
        size={size}
        color={color}
        backgroundColor={backgroundColor}
        quietZone={0}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});
