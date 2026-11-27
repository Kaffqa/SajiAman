import React from 'react';
import { useRouter } from 'expo-router';
import { ProfileSettingsScreen } from '../../src/screens/shared/ProfileSettingsScreen';

export default function AdminProfileScreen() {
  const router = useRouter();
  return <ProfileSettingsScreen currentRole="admin" onBack={() => router.back()} />;
}
