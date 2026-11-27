/**
 * SajiAman Haptics Adapter (Expo Haptics)
 * Maps physical tactile feedback across the Swiss-Utilitarian Civic Instrument:
 * - Light impact on tactile chips, steppers, and buttons
 * - Notification Success on sealing a batch or confirming ompreng
 * - Notification Warning on yellow scan (<45m remaining)
 * - Notification Error on red expired hard-lock scan
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function safeHaptic(fn: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  try {
    Promise.resolve(fn()).catch(() => {
      // Graceful fallback
    });
  } catch {
    // Graceful fallback
  }
}

export const hapticsAdapter = {
  selection(): void {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  lightImpact(): void {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  mediumImpact(): void {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },

  heavyImpact(): void {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },

  notification(): void {
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },

  success(): void {
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },

  warning(): void {
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },

  error(): void {
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};
