import React from 'react';
import { Tabs } from 'expo-router';
import { ClipboardList, PackageCheck, Recycle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSajiAman } from '../../../src/context/SajiAmanContext';

export default function KitchenTabsLayout() {
  const { pendingMaggotCount } = useSajiAman();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F4C81',
        tabBarInactiveTintColor: '#64748B',
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
          title: 'Produksi',
          tabBarIcon: ({ color }) => (
            <ClipboardList size={22} color={color} strokeWidth={1.85} />
          ),
        }}
      />
      <Tabs.Screen
        name="ompreng"
        options={{
          title: 'Ompreng',
          tabBarIcon: ({ color }) => (
            <PackageCheck size={22} color={color} strokeWidth={1.85} />
          ),
        }}
      />
      <Tabs.Screen
        name="maggot"
        options={{
          title: 'Maggot',
          tabBarBadge: pendingMaggotCount > 0 ? pendingMaggotCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#B45309',
            fontFamily: 'JetBrainsMono_700Bold',
            fontSize: 10,
          },
          tabBarIcon: ({ color }) => (
            <Recycle size={22} color={color} strokeWidth={1.85} />
          ),
        }}
      />
    </Tabs>
  );
}
