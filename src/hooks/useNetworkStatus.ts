/**
 * SajiAman Network Guard Hook
 * Monitors network connectivity state using @react-native-community/netinfo.
 * Provides real-time online/offline status with graceful web fallback.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  connectionType: NetInfoStateType;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isConnected: true,
    isInternetReachable: true,
    connectionType: NetInfoStateType.unknown,
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      const updateWebOnline = () => {
        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        setStatus({
          isOnline: online,
          isConnected: online,
          isInternetReachable: online,
          connectionType: NetInfoStateType.other,
        });
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('online', updateWebOnline);
        window.addEventListener('offline', updateWebOnline);
        updateWebOnline();
        return () => {
          window.removeEventListener('online', updateWebOnline);
          window.removeEventListener('offline', updateWebOnline);
        };
      }
      return;
    }

    let active = true;

    // Native NetInfo listener
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (!active) return;
      const reachable = state.isInternetReachable ?? state.isConnected ?? true;
      setStatus({
        isOnline: Boolean(state.isConnected && reachable !== false),
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
      });
    });

    // Initial fetch
    NetInfo.fetch()
      .then((state) => {
        if (!active) return;
        const reachable = state.isInternetReachable ?? state.isConnected ?? true;
        setStatus({
          isOnline: Boolean(state.isConnected && reachable !== false),
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          connectionType: state.type,
        });
      })
      .catch(() => {
        // Ignore transient native NetInfo lookup failure on unmount/init
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return status;
}
