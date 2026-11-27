import React from 'react';
import { useRouter } from 'expo-router';
import { ProfileSettingsScreen } from '../../src/screens/shared/ProfileSettingsScreen';

export default function KitchenProfileRoute() {
  const router = useRouter();
  return (
    <ProfileSettingsScreen
      currentRole="kitchen"
      onBack={() => router.back()}
    />
  );
}
