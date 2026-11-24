/**
 * Local Storage Adapter (Strict Native Boundary)
 * // TODO(expo-migration): Swap with `react-native-mmkv` for offline-first cache
 * // and `@supabase/supabase-js` for remote persistence.
 */

const NAMESPACE = 'sajiaman_mbg_v1_';

export const storageAdapter = {
  getItem<T>(key: string): T | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(`${NAMESPACE}${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  setItem<T>(key: string, value: T): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(`${NAMESPACE}${key}`, JSON.stringify(value));
    } catch {
      // Ignore quota errors in restricted iframe sandboxes
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(`${NAMESPACE}${key}`);
    } catch {
      // Ignore storage errors
    }
  },
};
