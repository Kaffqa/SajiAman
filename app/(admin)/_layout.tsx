import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSajiAman } from '../../src/context/SajiAmanContext';

export default function AdminLayout() {
  const { isHydrated, dataSource, role, userProfile } = useSajiAman();

  if (isHydrated) {
    if (!role || (dataSource === 'supabase' && !userProfile)) {
      return <Redirect href="/(auth)/login" />;
    }
    if (role !== 'admin') {
      return <Redirect href={(role === 'kitchen' ? '/(kitchen)' : '/(school)') as any} />;
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
    </Stack>
  );
}
