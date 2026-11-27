import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RealtimeConnectionState } from '../../types/sajiaman';

interface RealtimeStatusPillProps {
  status: RealtimeConnectionState;
  className?: string;
}

export const RealtimeStatusPill: React.FC<RealtimeStatusPillProps> = ({
  status,
  className = '',
}) => {
  const isSubscribed = status === 'SUBSCRIBED';
  const isConnecting = status === 'CONNECTING';

  const dotColor = isSubscribed
    ? '#16A34A'
    : isConnecting
    ? '#D97706'
    : '#DC2626';

  const textColor = isSubscribed
    ? '#166534'
    : isConnecting
    ? '#92400E'
    : '#991B1B';

  const badgeBg = isSubscribed
    ? 'bg-[#DCFCE7] border-[#86EFAC]'
    : isConnecting
    ? 'bg-[#FEF3C7] border-[#FCD34D]'
    : 'bg-[#FEE2E2] border-[#FCA5A5]';

  const label = isSubscribed
    ? 'REALTIME AKTIF'
    : isConnecting
    ? 'SINKRONISASI...'
    : 'OFFLINE';

  return (
    <View
      className={`flex-row items-center gap-1.5 px-2 py-0.5 rounded-[5px] border ${badgeBg} ${className}`}
    >
      <View
        style={[styles.dot, { backgroundColor: dotColor }]}
      />
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
