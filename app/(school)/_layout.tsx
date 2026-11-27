import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSajiAman } from '../../src/context/SajiAmanContext';

export default function SchoolLayout() {
  const { isHydrated, dataSource, role, userProfile } = useSajiAman();

  if (isHydrated) {
    if (!role || (dataSource === 'supabase' && !userProfile)) {
      return <Redirect href="/(auth)/login" />;
    }
    if (role === 'admin') {
      return <Redirect href={'/(admin)' as any} />;
    }
    if (role !== 'school') {
      return <Redirect href={'/(kitchen)' as any} />;
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="scan/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="batch/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="report-waste/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
    </Stack>
  );
}
