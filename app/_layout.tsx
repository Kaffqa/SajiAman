import '../global.css';
import { StyleSheet } from 'react-native-css-interop';

try {
  (StyleSheet as any).setFlag?.('darkMode', 'class');
} catch {}

import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { ToastBanner } from '../src/components/ui/ToastBanner';
import { OfflineBanner } from '../src/components/ui/OfflineBanner';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { SajiAmanProvider, useSajiAman } from '../src/context/SajiAmanContext';

function RootAppContent() {
  const { toast, dismissToast } = useSajiAman();
  const segments = useSegments() as string[];

  const isNavyHeaderRoute =
    segments.length === 0 ||
    (segments[0] === '(auth)' && (segments[1] === 'login' || !segments[1])) ||
    segments.includes('(tabs)') ||
    (segments[0] === '(admin)' && segments[1] !== 'profile');

  return (
    <View className="flex-1 bg-[#F4F7FA]">
      <StatusBar style={isNavyHeaderRoute ? 'light' : 'dark'} />
      <OfflineBanner />
      <ToastBanner toast={toast} onDismiss={dismissToast} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="(auth)/complete-profile" />
        <Stack.Screen name="(auth)/forgot-password" />
        <Stack.Screen name="(auth)/reset-password" />
        <Stack.Screen name="(kitchen)" />
        <Stack.Screen name="(school)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View className="flex-1 bg-[#0B2E59] items-center justify-center">
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SajiAmanProvider>
          <RootAppContent />
        </SajiAmanProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
