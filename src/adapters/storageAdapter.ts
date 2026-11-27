/**
 * SajiAman Local Storage Adapter (Native Expo AsyncStorage)
 * Implements persistent key-value store using @react-native-async-storage/async-storage.
 * Fully compatible with Expo Go and production builds.
 *
 * // TODO(future-optimization): Swap @react-native-async-storage/async-storage with
 * // react-native-mmkv when moving to a custom Dev Client for 10x faster synchronous storage access.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const NAMESPACE = '@sajiaman_mbg_v1_';

export const storageAdapter = {
  async getItem<T>(key: string): Promise<T | null> {
    if (typeof window === 'undefined') return null;
    try {
      const raw = await AsyncStorage.getItem(`${NAMESPACE}${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn(`[storageAdapter] Error reading key "${key}":`, error);
      return null;
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await AsyncStorage.setItem(`${NAMESPACE}${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn(`[storageAdapter] Error writing key "${key}":`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await AsyncStorage.removeItem(`${NAMESPACE}${key}`);
    } catch (error) {
      console.warn(`[storageAdapter] Error removing key "${key}":`, error);
    }
  },

  async clear(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const sajiamanKeys = allKeys.filter((k) => k.startsWith(NAMESPACE));
      if (sajiamanKeys.length > 0) {
        await AsyncStorage.multiRemove(sajiamanKeys);
      }
    } catch (error) {
      console.warn('[storageAdapter] Error clearing keys:', error);
    }
  },
};
