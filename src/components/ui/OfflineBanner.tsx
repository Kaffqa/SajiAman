/**
 * SajiAman Offline Status Banner
 * Slim, non-intrusive civic alert that renders at the top of screens
 * when network connection is severed.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  if (isOnline) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { top: Math.max(insets.top + 6, 10) }]}
    >
      <View style={styles.content}>
        <WifiOff size={13} color="#B45309" strokeWidth={2.2} />
        <Text numberOfLines={1} style={styles.text}>
          Mode Offline • Cache Lokal
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 45,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#92400E',
    letterSpacing: 0.1,
  },
});
