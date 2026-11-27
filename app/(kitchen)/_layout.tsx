import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSajiAman } from '../../src/context/SajiAmanContext';

export default function KitchenLayout() {
  const { isHydrated, dataSource, role, userProfile } = useSajiAman();

  if (isHydrated) {
    if (!role || (dataSource === 'supabase' && !userProfile)) {
      return <Redirect href="/(auth)/login" />;
    }
    if (role === 'admin') {
      return <Redirect href={'/(admin)' as any} />;
    }
    if (role !== 'kitchen') {
      return <Redirect href={'/(school)' as any} />;
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-batch" options={{ headerShown: false }} />
      <Stack.Screen name="batch/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="menu-catalog" options={{ headerShown: false }} />
      <Stack.Screen name="schools" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
    </Stack>
  );
}
