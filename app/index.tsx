import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSajiAman } from '../src/context/SajiAmanContext';

export default function Index() {
  const { isHydrated, dataSource, role, userProfile } = useSajiAman();

  if (!isHydrated) {
    return (
      <View className="flex-1 bg-[#0B2E59] items-center justify-center">
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!role || (dataSource === 'supabase' && !userProfile)) {
    return <Redirect href="/(auth)/login" />;
  }

  if (role === 'admin') {
    return <Redirect href={'/(admin)' as any} />;
  }

  if (role === 'kitchen') {
    return <Redirect href={'/(kitchen)' as any} />;
  }

  return <Redirect href={'/(school)' as any} />;
}
