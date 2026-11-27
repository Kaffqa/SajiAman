import React from 'react';
import { useRouter } from 'expo-router';
import { ProfileSettingsScreen } from '../../src/screens/shared/ProfileSettingsScreen';

export default function SchoolProfileRoute() {
  const router = useRouter();
  return (
    <ProfileSettingsScreen
      currentRole="school"
      onBack={() => router.back()}
    />
  );
}
