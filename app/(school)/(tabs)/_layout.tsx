import React from 'react';
import { Tabs } from 'expo-router';
import { ClipboardList, History, QrCode } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SchoolTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F4C81',
        tabBarInactiveTintColor: '#64748B',
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          height: 58 + bottomPad,
          backgroundColor: '#FFFFFF',
          borderTopColor: '#D8E2EC',
          borderTopWidth: 1,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_600SemiBold',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Antrian',
          tabBarIcon: ({ color }) => (
            <ClipboardList size={21} color={color} strokeWidth={1.85} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan-qr"
        options={{
          title: 'Pindai QR',
          tabBarIcon: ({ color }) => (
            <QrCode size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Riwayat',
          tabBarIcon: ({ color }) => (
            <History size={21} color={color} strokeWidth={1.85} />
          ),
        }}
      />
    </Tabs>
  );
}
