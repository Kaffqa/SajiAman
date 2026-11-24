/**
 * Haptics Adapter (Strict Native Boundary)
 * // TODO(expo-migration): Swap with `expo-haptics` (impactAsync / notificationAsync).
 */

export const hapticsAdapter = {
  selection(): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(10);
      } catch {
        // No-op on unsupported environments
      }
    }
  },

  success(): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([15, 30, 20]);
      } catch {
        // No-op
      }
    }
  },

  warning(): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([30, 40, 30]);
      } catch {
        // No-op
      }
    }
  },
};
