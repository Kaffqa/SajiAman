/**
 * SajiAman OS-Level Safety Alarms Adapter
 * Uses native expo-notifications to trigger heads-up background alerts
 * when a batch enters the yellow warning window or hits the red hard-lock expiry.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WARNING_THRESHOLD_MINUTES,
  WARNING_THRESHOLD_MS,
  formatWibTime,
} from '../domain/weakestLinkEngine';
import type { BatchRecord } from '../types/sajiaman';

export const SAFETY_CHANNEL_ID = 'sajiaman-safety-alerts';
const NOTIF_PREFIX = '@sajiaman_notif_ids_';

// Configure foreground presentation behavior
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Initializes Android notification channel with MAX importance for safety alerts.
 */
export async function initializeNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(SAFETY_CHANNEL_ID, {
        name: 'Peringatan Keamanan Pangan MBG',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#B91C1C',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    } catch (err) {
      console.warn('[notificationsAdapter] Channel init notice:', err);
    }
  }
}

/**
 * Requests OS notification permissions gracefully.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      granted = requested.granted;
    }

    if (granted) {
      await initializeNotificationChannel();
    }
    return granted;
  } catch (err) {
    console.warn('[notificationsAdapter] Permission request error:', err);
    return false;
  }
}

/**
 * Checks current notification permission status.
 */
export async function checkNotificationPermissionStatus(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/**
 * Schedules OS-level background safety alarms for a received/verified batch:
 * 1. Warning Yellow Window alarm (expiresAt - WARNING_THRESHOLD_MS)
 * 2. Hard-Lock Red Expiry alarm (expiresAt)
 */
export async function scheduleBatchSafetyAlarms(
  batch: BatchRecord,
  serverClockDriftMs: number = 0
): Promise<string[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  try {
    const hasPermission = await checkNotificationPermissionStatus();
    if (!hasPermission) {
      const granted = await requestNotificationPermissions();
      if (!granted) return [];
    }

    await cancelBatchSafetyAlarms(batch.id);

    const nowEffectiveMs = Date.now() + serverClockDriftMs;
    const warningTimeMs = batch.expiresAt - WARNING_THRESHOLD_MS;
    const expiryTimeMs = batch.expiresAt;

    const scheduledIds: string[] = [];
    const formattedExpiry = formatWibTime(batch.expiresAt);

    // 1. Warning Alarm (Yellow Window: dynamically read from weakestLinkEngine)
    const warningDelayMs = warningTimeMs - nowEffectiveMs;
    if (warningDelayMs > 0) {
      const warningDelaySeconds = Math.max(1, Math.round(warningDelayMs / 1000));
      const warningId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `⚠️ PERINGATAN MBG: ${WARNING_THRESHOLD_MINUTES} Menit Batas Konsumsi (${batch.id})`,
          body: `Boks ${batch.id} untuk ${batch.schoolName} harus segera dibagikan ke siswa sebelum pukul ${formattedExpiry} WIB!`,
          data: { batchId: batch.id, type: 'warning' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: warningDelaySeconds,
          channelId: SAFETY_CHANNEL_ID,
        },
      });
      scheduledIds.push(warningId);
    }

    // 2. Hard-Lock Expiry Alarm (Red Window)
    const expiryDelayMs = expiryTimeMs - nowEffectiveMs;
    if (expiryDelayMs > 0) {
      const expiryDelaySeconds = Math.max(1, Math.round(expiryDelayMs / 1000));
      const expiryId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🚨 HARD-LOCK MBG: Batas Waktu Aman Habis (${batch.id})`,
          body: `Batas aman boks ${batch.id} telah berakhir. DILARANG membagikan makanan ke siswa! Alihkan ke pakan maggot.`,
          data: { batchId: batch.id, type: 'expired' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: expiryDelaySeconds,
          channelId: SAFETY_CHANNEL_ID,
        },
      });
      scheduledIds.push(expiryId);
    }

    if (scheduledIds.length > 0) {
      await AsyncStorage.setItem(
        `${NOTIF_PREFIX}${batch.id}`,
        JSON.stringify(scheduledIds)
      );
    }

    return scheduledIds;
  } catch (err) {
    console.warn('[notificationsAdapter] scheduleBatchSafetyAlarms notice:', err);
    return [];
  }
}

/**
 * Cancels all scheduled safety alarms for a given batch (e.g. on void, rejection, or waste handover).
 */
export async function cancelBatchSafetyAlarms(batchId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const raw = await AsyncStorage.getItem(`${NOTIF_PREFIX}${batchId}`);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      }
      await AsyncStorage.removeItem(`${NOTIF_PREFIX}${batchId}`);
    }
  } catch (err) {
    console.warn('[notificationsAdapter] cancelBatchSafetyAlarms notice:', err);
  }
}
