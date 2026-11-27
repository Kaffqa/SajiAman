import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticsAdapter } from '../adapters/hapticsAdapter';
import { storageAdapter } from '../adapters/storageAdapter';
import {
  cancelBatchSafetyAlarms,
  scheduleBatchSafetyAlarms,
} from '../adapters/notificationsAdapter';
import {
  createSeedSnapshot,
  DEFAULT_MORNING_ANCHOR_MS,
  KITCHEN_PROFILE,
  MENU_CATALOG,
  sajiamanRepository,
  SCHOOLS,
  WASTE_VOLUME_PRESETS,
} from '../data/mockRepository';
import { supabaseRepository } from '../data/supabaseRepository';
import {
  calculateWeakestLink,
  detectOfflineClockRollback,
  generateBatchId,
} from '../domain/weakestLinkEngine';
import { resolveServerQrVerification } from '../domain/qrCrypto';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  ActiveUserProfile,
  AppNotification,
  BatchRecord,
  KitchenProfile,
  MaggotReport,
  MenuItem,
  ProductionInputMode,
  RealtimeConnectionState,
  SajiAmanStateSnapshot,
  SchoolProfile,
  UserRole,
  WasteCategory,
  WasteVolumePreset,
} from '../types/sajiaman';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'warning';
}

export interface CreateBatchInput {
  schoolId: string;
  items: MenuItem[];
  omprengCount: number;
  inputMode: ProductionInputMode;
  samplePhotoUrl?: string;
  samplePhotoTimestamp?: string;
  aiDetectedWeakestMinutes?: number;
  aiVerifiedNutrition?: {
    karbohidrat: boolean;
    protein: boolean;
    sayur: boolean;
    buah: boolean;
  };
}

export interface CreateMaggotReportInput {
  batchId: string;
  category: WasteCategory;
  volumePresetId: WasteVolumePreset['id'];
  locationNote: string;
}

const ROLE_STORAGE_KEY = 'active_user_role';
const CACHE_BATCH_PREFIX = '@sajiaman_cached_batches_';
const CACHE_DRIFT_KEY = '@sajiaman_clock_drift';
const CACHE_LAST_SERVER_MS_KEY = '@sajiaman_last_server_ms';

function mapSchoolIdToUuid(schoolId: string): string {
  if (schoolId.includes('-') && schoolId.length === 36) return schoolId;
  const map: Record<string, string> = {
    'sdn-01-pendrikan': 'b0000000-0000-0000-0000-000000000001',
    'smpn-03-semarang': 'b0000000-0000-0000-0000-000000000002',
    'sdn-04-miroto': 'b0000000-0000-0000-0000-000000000003',
    'mi-al-hikmah': 'b0000000-0000-0000-0000-000000000004',
  };
  return map[schoolId] || schoolId;
}

export interface SajiAmanContextValue {
  isHydrated: boolean;
  dataSource: 'mock' | 'supabase';
  role: UserRole | null;
  userProfile: ActiveUserProfile | null;
  kitchenProfile: KitchenProfile;
  schools: SchoolProfile[];
  menuCatalog: MenuItem[];
  refreshUserProfile: () => Promise<ActiveUserProfile | null>;
  reloadAccountData: (overrideProfile?: ActiveUserProfile | null) => Promise<void>;
  refreshSchools: () => Promise<SchoolProfile[]>;
  refreshMenuCatalog: () => Promise<MenuItem[]>;
  refreshKitchenProfile: () => Promise<KitchenProfile | null>;
  verifyAndFetchBatchByCode: (
    batchCode: string,
    sig?: string | null,
    requireSig?: boolean,
    options?: { verificationMethod?: 'qr_scan' | 'manual_code'; manualReason?: string }
  ) => Promise<{ ok: boolean; batch?: BatchRecord; reason?: string }>;
  refreshBatchSamplePhoto: (batchId: string) => Promise<string | null>;
  verifiedBatchIds: string[];
  isBatchScanUnlocked: (batchId: string) => boolean;
  batches: BatchRecord[];
  maggotReports: MaggotReport[];
  notifications: AppNotification[];
  realtimeStatus: RealtimeConnectionState;
  simulatedNowMs: number;
  serverClockDriftMs: number;
  isClockTampered: boolean;
  clockOffsetMs: number;
  totalPlasticsSaved: number;
  totalOrganicDivertedKg: number;
  pendingMaggotCount: number;
  toast: ToastMessage | null;
  selectRole: (role: UserRole) => void;
  logoutToRoleSelect: () => Promise<void>;
  createBatch: (input: CreateBatchInput) => Promise<BatchRecord | null>;
  confirmOmprengReceived: (
    batchId: string,
    receivedCount?: number,
    discrepancyNote?: string
  ) => Promise<void>;
  confirmOmprengReturned: (batchId: string) => Promise<void>;
  rejectBatchSpoiled: (
    batchId: string,
    reason: string,
    photoPath?: string
  ) => Promise<boolean>;
  markOmprengReadyForPickup: (batchId: string) => Promise<boolean>;
  voidBatch: (batchId: string, reason: string) => Promise<boolean>;
  submitMaggotReport: (input: CreateMaggotReportInput) => Promise<MaggotReport | null>;
  dispatchBsfPartner: (reportId: string) => Promise<boolean>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  shiftClockByMs: (deltaMs: number) => void;
  resetClock: () => void;
  resetDemoData: () => void;
  showToast: (text: string, tone?: ToastMessage['tone']) => void;
  dismissToast: () => void;
  getBatchById: (id: string) => BatchRecord | undefined;
}

const SajiAmanContext = createContext<SajiAmanContextValue | null>(null);

export const SajiAmanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userProfile, setUserProfile] = useState<ActiveUserProfile | null>(null);
  const [kitchenProfile, setKitchenProfile] = useState<KitchenProfile>(KITCHEN_PROFILE);
  const [schools, setSchools] = useState<SchoolProfile[]>(SCHOOLS);
  const [menuCatalog, setMenuCatalog] = useState<MenuItem[]>(
    MENU_CATALOG.map((m) => ({ ...m, isActive: true }))
  );
  const [state, setState] = useState<SajiAmanStateSnapshot>(() => createSeedSnapshot());
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [elapsedRealMs, setElapsedRealMs] = useState<number>(0);
  const [verifiedBatchIds, setVerifiedBatchIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionState>('CONNECTING');
  const [realtimeReconnectTick, setRealtimeReconnectTick] = useState<number>(0);
  const [serverClockDriftMs, setServerClockDriftMs] = useState<number>(0);
  const [isClockTampered, setIsClockTampered] = useState<boolean>(false);
  const lastMonotonicRef = useRef<{ localWall: number; expectedServer: number }>({
    localWall: Date.now(),
    expectedServer: Date.now(),
  });

  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef<boolean>(isOnline);

  const rawEnvDataSource = process.env.EXPO_PUBLIC_DATA_SOURCE || 'mock';
  const isSupabaseActive = rawEnvDataSource === 'supabase' && isSupabaseConfigured;
  const activeDataSource: 'mock' | 'supabase' = isSupabaseActive ? 'supabase' : 'mock';

  const sessionStartWallRef = useRef<number>(Date.now());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userProfileRef = useRef<ActiveUserProfile | null>(null);
  userProfileRef.current = userProfile;

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), text, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3800);
  }, []);

  // Sync official server time to calculate NTP drift & detect clock tampering
  const syncServerClock = useCallback(async () => {
    if (!isSupabaseActive) return;
    try {
      const serverTime = await supabaseRepository.fetchServerTimeMs();
      if (serverTime === null) return;
      const localNow = Date.now();
      const drift = serverTime - localNow;

      if (lastMonotonicRef.current.localWall > 0) {
        const elapsedLocal = localNow - lastMonotonicRef.current.localWall;
        const expectedServer = lastMonotonicRef.current.expectedServer + elapsedLocal;
        const jumpAnomalyMs = Math.abs(serverTime - expectedServer);

        if (jumpAnomalyMs > 5 * 60 * 1000) {
          console.warn('[SajiAmanContext] Selisih lompatan jam perangkat dikoreksi via server:', jumpAnomalyMs, 'ms');
        }
      }

      lastMonotonicRef.current = {
        localWall: localNow,
        expectedServer: serverTime,
      };
      setIsClockTampered(false);
      setServerClockDriftMs(drift);
      AsyncStorage.setItem(CACHE_DRIFT_KEY, String(drift)).catch(() => {});
      AsyncStorage.setItem(CACHE_LAST_SERVER_MS_KEY, String(serverTime)).catch(() => {});
    } catch (err) {
      console.warn('[SajiAmanContext] syncServerClock error:', err);
    }
  }, [isSupabaseActive]);

  const fetchAndSetUserProfile = useCallback(
    async (userId?: string): Promise<ActiveUserProfile | null> => {
      if (!isSupabaseActive) return null;
      try {
        const { data: authUser } = await supabase.auth.getUser();
        const uid = userId || authUser.user?.id;
        if (!uid) {
          setUserProfile(null);
          return null;
        }

        let profile: any = null;
        let queryErr: any = null;

        const resWithActive = await supabase
          .from('profiles')
          .select(`
            id,
            role,
            full_name,
            phone_wa,
            kitchen_id,
            school_id,
            is_active,
            kitchen:kitchens(id, code, name, total_ompreng_inventory, is_active),
            school:schools(id, npsn, name, is_active)
          `)
          .eq('id', uid)
          .maybeSingle();

        if (resWithActive.error && resWithActive.error.message?.includes('is_active')) {
          const fallbackRes = await supabase
            .from('profiles')
            .select(`
              id,
              role,
              full_name,
              phone_wa,
              kitchen_id,
              school_id,
              kitchen:kitchens(id, code, name, total_ompreng_inventory),
              school:schools(id, npsn, name)
            `)
            .eq('id', uid)
            .maybeSingle();
          profile = fallbackRes.data;
          queryErr = fallbackRes.error;
        } else {
          profile = resWithActive.data;
          queryErr = resWithActive.error;
        }

        if (queryErr || !profile) {
          setUserProfile(null);
          return null;
        }

        const isUnitDisabled =
          profile.is_active === false ||
          (profile.role === 'kitchen' && (profile.kitchen as any)?.is_active === false) ||
          (profile.role === 'school' && (profile.school as any)?.is_active === false);

        if (isUnitDisabled) {
          setUserProfile(null);
          setRole(null);
          await storageAdapter.removeItem(ROLE_STORAGE_KEY);
          await supabase.auth.signOut().catch(() => {});
          showToast(
            'Akun atau unit instansi Anda sedang dinonaktifkan oleh Admin BGN.',
            'warning'
          );
          return null;
        }

        const activeProfile: ActiveUserProfile = {
          id: profile.id,
          email: authUser.user?.email || '',
          fullName: profile.full_name || 'Petugas Resmi',
          phoneWa: profile.phone_wa || '',
          role: profile.role,
          kitchenId: profile.kitchen_id,
          kitchenName: (profile.kitchen as any)?.name,
          kitchenCode: (profile.kitchen as any)?.code,
          schoolId: profile.school_id,
          schoolName: (profile.school as any)?.name,
          isActive: profile.is_active !== false,
        };
        setUserProfile(activeProfile);
        setRole(profile.role);
        await storageAdapter.setItem(ROLE_STORAGE_KEY, profile.role);
        return activeProfile;
      } catch (err) {
        console.warn('[SajiAmanContext] fetchAndSetUserProfile notice:', err);
      }
      return null;
    },
    [isSupabaseActive, showToast]
  );

  const persistUserBatchCache = useCallback(
    (profileId: string | undefined, batchesToSave: BatchRecord[]) => {
      if (!profileId) return;
      AsyncStorage.setItem(`${CACHE_BATCH_PREFIX}${profileId}`, JSON.stringify(batchesToSave)).catch(
        () => {}
      );
    },
    []
  );

  const reloadAccountData = useCallback(
    async (overrideProfile?: ActiveUserProfile | null) => {
      if (!isSupabaseActive) return;
      const activeProf = overrideProfile ?? userProfileRef.current;

      if (!activeProf) {
        setState(createSeedSnapshot());
        setSchools([]);
        return;
      }

      // Optimistically restore this specific user's cached batches first if state is empty
      try {
        const cachedRaw = await AsyncStorage.getItem(`${CACHE_BATCH_PREFIX}${activeProf.id}`);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (Array.isArray(parsed)) {
            setState((prev) =>
              prev.batches.length === 0 ? { ...prev, batches: parsed } : prev
            );
          }
        }
      } catch {}

      try {
        const [batches, maggotReports, notifs, dbMenuCatalog, dbSchools, dbKitchenProfile] =
          await Promise.all([
            supabaseRepository.fetchBatches(activeProf),
            supabaseRepository.fetchMaggotReports(activeProf),
            supabaseRepository.fetchNotifications(activeProf),
            supabaseRepository.fetchMenuCatalog(),
            activeProf.role === 'kitchen' && activeProf.kitchenId
              ? supabaseRepository.fetchSchools(activeProf.kitchenId)
              : Promise.resolve([]),
            activeProf.role === 'kitchen'
              ? supabaseRepository.fetchKitchenProfile(activeProf)
              : Promise.resolve(null),
          ]);

        setState((prev) => ({
          ...prev,
          batches,
          maggotReports,
          notifications: notifs,
        }));
        if (dbMenuCatalog.length > 0) {
          setMenuCatalog(dbMenuCatalog);
        }
        if (activeProf.role === 'kitchen') {
          setSchools(dbSchools);
          if (dbKitchenProfile) {
            setKitchenProfile(dbKitchenProfile);
          }
        }
        persistUserBatchCache(activeProf.id, batches);
      } catch (err) {
        console.warn('[SajiAmanContext] reloadAccountData notice:', err);
      }
    },
    [isSupabaseActive, persistUserBatchCache]
  );

  const refreshSchools = useCallback(async (): Promise<SchoolProfile[]> => {
    if (!isSupabaseActive) return schools;
    const activeProf = userProfileRef.current;
    if (activeProf?.role === 'kitchen' && activeProf.kitchenId) {
      const list = await supabaseRepository.fetchSchools(activeProf.kitchenId);
      setSchools(list);
      return list;
    }
    return [];
  }, [isSupabaseActive, schools]);

  const refreshMenuCatalog = useCallback(async (): Promise<MenuItem[]> => {
    if (!isSupabaseActive) return menuCatalog;
    const list = await supabaseRepository.fetchMenuCatalog();
    if (list.length > 0) {
      setMenuCatalog(list);
    }
    return list;
  }, [isSupabaseActive, menuCatalog]);

  const refreshKitchenProfile = useCallback(async (): Promise<KitchenProfile | null> => {
    if (!isSupabaseActive) return kitchenProfile;
    const activeProf = userProfileRef.current;
    const kp = await supabaseRepository.fetchKitchenProfile(activeProf);
    if (kp) {
      setKitchenProfile(kp);
    }
    return kp;
  }, [isSupabaseActive, kitchenProfile]);

  // Foreground app resume listener
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isSupabaseActive && userProfileRef.current) {
        syncServerClock();
      }
    });
    return () => sub.remove();
  }, [isSupabaseActive, syncServerClock]);

  // Network recovery sync listener
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (wasOffline && isOnline && isSupabaseActive && userProfileRef.current) {
      syncServerClock();
      reloadAccountData(userProfileRef.current);
      setRealtimeReconnectTick((t) => t + 1);
    }
  }, [isOnline, isSupabaseActive, syncServerClock, reloadAccountData]);

  // Initial App Launch Hydration (Session-Aware, Zero Cross-Account Leakage)
  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        // Restore cached clock drift & check offline clock rollback across force-close
        const [cachedDrift, cachedLastServerRaw] = await Promise.all([
          AsyncStorage.getItem(CACHE_DRIFT_KEY).catch(() => null),
          AsyncStorage.getItem(CACHE_LAST_SERVER_MS_KEY).catch(() => null),
        ]);
        const restoredDrift = cachedDrift ? parseInt(cachedDrift, 10) || 0 : 0;
        const lastServerMs = cachedLastServerRaw ? parseInt(cachedLastServerRaw, 10) || 0 : 0;
        if (active && cachedDrift) {
          setServerClockDriftMs(restoredDrift);
        }
        if (active && detectOfflineClockRollback(Date.now(), restoredDrift, lastServerMs)) {
          setIsClockTampered(true);
        }

        if (isSupabaseActive) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session?.user) {
            // No active session -> stay clean without loading stale data
            if (active) {
              setRole(null);
              setUserProfile(null);
              setState(createSeedSnapshot());
              await storageAdapter.removeItem(ROLE_STORAGE_KEY);
              setIsHydrated(true);
            }
            return;
          }

          await syncServerClock();
          const profile = await fetchAndSetUserProfile(sessionData.session.user.id);
          if (active && profile) {
            await reloadAccountData(profile);
          } else if (active) {
            setRole(null);
            setState(createSeedSnapshot());
          }
          if (active) setIsHydrated(true);
        } else {
          const savedRole = await storageAdapter.getItem<UserRole>(ROLE_STORAGE_KEY);
          if (active && (savedRole === 'kitchen' || savedRole === 'school' || savedRole === 'admin')) {
            setRole(savedRole);
          }
          const loadedState = await sajiamanRepository.loadState();
          if (active) {
            setState(loadedState);
            setIsHydrated(true);
          }
        }
      } catch (err) {
        console.warn('[SajiAmanContext] Hydration fallback error:', err);
        if (active) setIsHydrated(true);
      }
    }

    hydrate();

    // Clean auth session watcher
    let authSubscription: { unsubscribe: () => void } | undefined;
    if (isSupabaseActive) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!active) return;
        if (event === 'SIGNED_OUT' || !session?.user) {
          setRole(null);
          setUserProfile(null);
          setSchools([]);
          setState(createSeedSnapshot());
          storageAdapter.removeItem(ROLE_STORAGE_KEY).catch(() => {});
          return;
        }
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
          const currentId = userProfileRef.current?.id;
          if (currentId !== session.user.id) {
            setState(createSeedSnapshot());
            const prof = await fetchAndSetUserProfile(session.user.id);
            if (prof) {
              await reloadAccountData(prof);
            }
          }
        }
      });
      authSubscription = data.subscription;
    }

    return () => {
      active = false;
      authSubscription?.unsubscribe();
    };
  }, [isSupabaseActive, fetchAndSetUserProfile, reloadAccountData, syncServerClock]);

  // Scoped Realtime Subscriptions tied strictly to the signed-in unit
  useEffect(() => {
    if (!isSupabaseActive || !isHydrated || !userProfile) {
      setRealtimeStatus('OFFLINE');
      return;
    }

    const unsubscribe = supabaseRepository.subscribeToRealtimeChanges(
      userProfile,
      async () => {
        try {
          const freshBatches = await supabaseRepository.fetchBatches(userProfile);
          setState((prev) => ({ ...prev, batches: freshBatches }));
          persistUserBatchCache(userProfile.id, freshBatches);
        } catch (e) {
          console.warn('[SajiAmanContext] Realtime batch refresh notice:', e);
        }
      },
      async () => {
        try {
          const freshReports = await supabaseRepository.fetchMaggotReports(userProfile);
          setState((prev) => ({ ...prev, maggotReports: freshReports }));
        } catch (e) {
          console.warn('[SajiAmanContext] Realtime maggot refresh notice:', e);
        }
      },
      async (payload) => {
        try {
          const freshNotifs = await supabaseRepository.fetchNotifications(userProfile);
          setState((prev) => ({ ...prev, notifications: freshNotifs }));

          if (payload?.eventType === 'INSERT' && payload.new) {
            const notif = payload.new;
            if (notif.type === 'new_batch' && userProfile.role === 'school') {
              showToast(`${notif.title} — ${notif.message}`, 'info');
              hapticsAdapter.notification();
            } else if (notif.type === 'early_spoilage' && userProfile.role === 'kitchen') {
              showToast(`${notif.title}: ${notif.message}`, 'warning');
              hapticsAdapter.heavyImpact();
            }
          }
        } catch (e) {
          console.warn('[SajiAmanContext] Realtime notification refresh notice:', e);
        }
      },
      (connStatus) => {
        setRealtimeStatus(connStatus);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [
    isSupabaseActive,
    isHydrated,
    userProfile,
    realtimeReconnectTick,
    persistUserBatchCache,
    showToast,
  ]);

  // Persist mock mode state locally
  useEffect(() => {
    if (isHydrated && !isSupabaseActive) {
      sajiamanRepository.saveState(state);
    }
  }, [state, isHydrated, isSupabaseActive]);

  // Live 1-second ticker
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedRealMs(Date.now() - sessionStartWallRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const simulatedNowMs = isSupabaseActive
    ? Date.now() + serverClockDriftMs + clockOffsetMs
    : state.baseReferenceTimeMs + elapsedRealMs + clockOffsetMs;

  const selectRole = useCallback((nextRole: UserRole) => {
    hapticsAdapter.selection();
    setRole(nextRole);
    storageAdapter.setItem(ROLE_STORAGE_KEY, nextRole);
  }, []);

  // Complete clean logout purging all cross-account state & storage caches
  const logoutToRoleSelect = useCallback(async () => {
    hapticsAdapter.selection();
    const prevUid = userProfileRef.current?.id;
    setRole(null);
    setUserProfile(null);
    setSchools(isSupabaseActive ? [] : SCHOOLS);
    setKitchenProfile(KITCHEN_PROFILE);
    setState(createSeedSnapshot());
    setVerifiedBatchIds([]);
    setIsClockTampered(false);
    setClockOffsetMs(0);

    try {
      await storageAdapter.removeItem(ROLE_STORAGE_KEY);
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(
        (k) =>
          k.startsWith(CACHE_BATCH_PREFIX) ||
          k === CACHE_DRIFT_KEY ||
          k === CACHE_LAST_SERVER_MS_KEY ||
          (prevUid && k.includes(prevUid))
      );
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch {}

    if (isSupabaseActive) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[SajiAmanContext] Sign out notice:', e);
      }
    }
  }, [isSupabaseActive]);

  // Server-backed QR / Manual verification with Realtime-delay fallback
  const verifyAndFetchBatchByCode = useCallback(
    async (
      batchCode: string,
      sig?: string | null,
      requireSig: boolean = true,
      options?: { verificationMethod?: 'qr_scan' | 'manual_code'; manualReason?: string }
    ): Promise<{ ok: boolean; batch?: BatchRecord; reason?: string }> => {
      if (isClockTampered && !isOnline) {
        return {
          ok: false,
          reason:
            'Peringatan Keamanan Waktu: Jam perangkat terdeteksi dimundurkan saat offline. Sambungkan internet untuk sinkronisasi waktu server.',
        };
      }

      const cleanCode = batchCode.trim().toUpperCase();
      let found = state.batches.find((b) => b.id.toUpperCase() === cleanCode);
      const verificationMethod = options?.verificationMethod || (requireSig ? 'qr_scan' : 'manual_code');
      const manualReason = options?.manualReason?.trim() || undefined;

      if (isSupabaseActive) {
        const serverResult = isOnline
          ? await supabaseRepository.verifyBatchQrServer(
              cleanCode,
              sig,
              requireSig,
              verificationMethod,
              manualReason
            )
          : {
              valid: false,
              networkError: true,
              reason: 'Perangkat sedang offline.',
            };

        const evaluation = resolveServerQrVerification({
          serverResult,
          isOnline,
          isClockTampered,
          requireSig,
          scannedSig: sig,
          cachedBatch: found,
        });

        if (!evaluation.ok) {
          return {
            ok: false,
            reason:
              evaluation.reason ||
              'Kode boks tidak valid atau tidak dialokasikan untuk unit Anda.',
          };
        }

        if (evaluation.mode === 'server') {
          if (!found) {
            const directBatch = await supabaseRepository.fetchBatchByCode(cleanCode);
            if (directBatch) {
              found = {
                ...directBatch,
                verificationMethod,
                manualVerificationReason: manualReason ?? directBatch.manualVerificationReason,
              };
              setState((prev) => {
                if (prev.batches.some((b) => b.id.toUpperCase() === directBatch.id.toUpperCase())) {
                  return prev;
                }
                const next = [found!, ...prev.batches];
                persistUserBatchCache(userProfileRef.current?.id, next);
                return { ...prev, batches: next };
              });
            }
          } else {
            found = {
              ...found,
              verificationMethod,
              manualVerificationReason: manualReason ?? found.manualVerificationReason,
            };
            setState((prev) => ({
              ...prev,
              batches: prev.batches.map((b) =>
                b.id.toUpperCase() === cleanCode ? found! : b
              ),
            }));
          }
        } else if (found) {
          if (
            userProfile?.role === 'school' &&
            userProfile.schoolId &&
            found.schoolId !== userProfile.schoolId
          ) {
            return {
              ok: false,
              reason: 'DITOLAK: Boks ini dialokasikan untuk sekolah lain.',
            };
          }
          found = {
            ...found,
            verificationMethod,
            manualVerificationReason: manualReason ?? found.manualVerificationReason,
          };
        }
      }

      if (!found) {
        return {
          ok: false,
          reason: 'Kode boks tidak terdaftar dalam manifes Dapur SPPG hari ini.',
        };
      }

      if (userProfile?.role === 'school' && userProfile.schoolId && found.schoolId !== userProfile.schoolId) {
        return {
          ok: false,
          reason: 'DITOLAK: Boks ini dialokasikan untuk sekolah lain, bukan sekolah Anda.',
        };
      }

      const verifiedCode = found.id.toUpperCase();
      setVerifiedBatchIds((prev) => (prev.includes(verifiedCode) ? prev : [...prev, verifiedCode]));

      return { ok: true, batch: found };
    },
    [state.batches, isSupabaseActive, isOnline, isClockTampered, userProfile, persistUserBatchCache]
  );

  // Refreshes expiring 1-hour sample photo Signed URL on detail/history view
  const refreshBatchSamplePhoto = useCallback(
    async (batchId: string): Promise<string | null> => {
      if (!isSupabaseActive || !isOnline) return null;
      const target = state.batches.find((b) => b.id.toUpperCase() === batchId.toUpperCase());
      const pathOrUrl = target?.samplePhotoStoragePath || target?.samplePhotoUrl;
      if (!target || !pathOrUrl) return null;
      if (!pathOrUrl.includes('sample-photos') && pathOrUrl.startsWith('http')) {
        return target.samplePhotoUrl || null;
      }
      const freshUrl = await supabaseRepository.refreshSignedSampleUrl(pathOrUrl);
      if (freshUrl) {
        setState((prev) => ({
          ...prev,
          batches: prev.batches.map((b) =>
            b.id.toUpperCase() === batchId.toUpperCase()
              ? { ...b, samplePhotoUrl: freshUrl }
              : b
          ),
        }));
      }
      return freshUrl;
    },
    [isSupabaseActive, isOnline, state.batches]
  );

  // Create & Seal Production Batch without race condition
  const createBatch = useCallback(
    async (input: CreateBatchInput): Promise<BatchRecord | null> => {
      if (isClockTampered && !isOnline) {
        showToast(
          'Jam perangkat terdeteksi tidak sinkron. Sambungkan internet untuk sinkronisasi sebelum menyegel boks.',
          'warning'
        );
        return null;
      }
      const weakest = calculateWeakestLink(input.items);
      if (!weakest) return null;

      const school = schools.find((s) => s.id === input.schoolId) ?? (isSupabaseActive ? undefined : SCHOOLS[0]);
      if (!school) {
        showToast('Sekolah tujuan belum terdaftar di SPPG Anda. Hubungi Admin BGN.', 'warning');
        return null;
      }
      const nextSeq = state.batches.length + 1;
      const newBatchId = generateBatchId(nextSeq);
      const cookedAt = simulatedNowMs;
      const expiresAt = cookedAt + weakest.holdingMs;

      const kitchenId = userProfile?.kitchenId || kitchenProfile.id;
      const kitchenName = userProfile?.kitchenName || kitchenProfile.name;

      const optimisticBatch: BatchRecord = {
        id: newBatchId,
        kitchenId,
        kitchenCode: userProfile?.kitchenCode || kitchenProfile.code,
        kitchenName,
        schoolId: school.id,
        schoolName: school.name,
        createdBy: userProfile?.id,
        creatorName: userProfile?.fullName,
        boxNumber: `Boks #${String(nextSeq).padStart(2, '0')}`,
        items: input.items,
        weakestLinkItemId: weakest.triggerItem.id,
        weakestLinkItemName: weakest.triggerItem.name,
        weakestLinkRiskLabel: weakest.triggerItem.riskLabel,
        holdingHours: weakest.holdingHours,
        cookedAt,
        expiresAt,
        arrivedAt: cookedAt + 42 * 60 * 1000,
        kitchenTempC: 68,
        omprengCount: input.omprengCount,
        omprengStatus: 'dispatched',
        batchStatus: 'active',
        inputMode: input.inputMode,
        samplePhotoUrl: input.samplePhotoUrl,
        samplePhotoTimestamp: input.samplePhotoTimestamp,
        aiVerifiedNutrition: input.aiVerifiedNutrition,
      };

      const snapshotBefore = state;
      setState((prev) => ({
        ...prev,
        batches: [optimisticBatch, ...prev.batches],
      }));

      if (isSupabaseActive) {
        try {
          const catalogMenuIds = input.items
            .filter((i) => !i.id.startsWith('adhoc-'))
            .map((i) => i.id);
          const extraAdHocItems = input.items
            .filter((i) => i.id.startsWith('adhoc-'))
            .map((i) => ({
              name: i.name,
              category: i.category,
              holdingHours: i.holdingHours,
              isHighRisk: i.isHighRisk,
            }));

          const sealedResult = await supabaseRepository.sealProductionBatch({
            schoolId: mapSchoolIdToUuid(input.schoolId),
            menuItemIds: catalogMenuIds,
            extraItems: extraAdHocItems,
            omprengCount: input.omprengCount,
            inputMode: input.inputMode,
            samplePhotoPath: input.samplePhotoUrl,
            aiDetectedWeakestMinutes: input.aiDetectedWeakestMinutes,
          });

          const targetCode = sealedResult?.batch_code;
          const fresh = await supabaseRepository.fetchBatches(userProfile);
          let createdRecord = targetCode
            ? fresh.find((b) => b.id.toUpperCase() === String(targetCode).toUpperCase())
            : fresh[0];

          if (!createdRecord && targetCode) {
            const direct = await supabaseRepository.fetchBatchByCode(String(targetCode));
            if (direct) createdRecord = direct;
          }

          if (createdRecord) {
            const nextBatches = fresh.length > 0 ? fresh : [createdRecord, ...snapshotBefore.batches];
            setState((prev) => ({ ...prev, batches: nextBatches }));
            persistUserBatchCache(userProfile?.id, nextBatches);
            hapticsAdapter.success();
            showToast(`Boks ${createdRecord.id} berhasil disegel & terkunci waktu server`, 'success');
            return createdRecord;
          }
        } catch (err: any) {
          console.warn('[SajiAmanContext] sealBatch RPC error, rolling back:', err.message);
          setState(snapshotBefore);
          showToast(`Gagal menyegel batch: ${err.message}`, 'warning');
          return null;
        }
      }

      hapticsAdapter.success();
      showToast(`Boks ${optimisticBatch.id} berhasil disegel & terkunci waktu server`, 'success');
      return optimisticBatch;
    },
    [
      simulatedNowMs,
      state,
      schools,
      userProfile,
      kitchenProfile,
      showToast,
      isSupabaseActive,
      isOnline,
      isClockTampered,
      persistUserBatchCache,
    ]
  );

  // Confirm Ompreng Receipt
  const confirmOmprengReceived = useCallback(
    async (batchId: string, receivedCount?: number, discrepancyNote?: string) => {
      if (isClockTampered && !isOnline) {
        showToast(
          'Jam perangkat terdeteksi dimundurkan saat offline. Sambungkan internet untuk sinkronisasi waktu.',
          'warning'
        );
        return;
      }
      const snapshotBefore = state;
      const existing = state.batches.find((b) => b.id === batchId);
      const targetCount = receivedCount ?? existing?.omprengCount;

      setState((prev) => ({
        ...prev,
        batches: prev.batches.map((b) => {
          if (b.id !== batchId) return b;
          return {
            ...b,
            omprengStatus: 'received_school',
            omprengReceivedCount: targetCount,
            omprengDiscrepancyNote: discrepancyNote,
            omprengConfirmedBy: userProfile?.fullName ?? 'Koordinator Sekolah',
            omprengConfirmedAt: simulatedNowMs,
          };
        }),
      }));

      if (isSupabaseActive) {
        try {
          await supabaseRepository.confirmOmprengReceipt(
            batchId,
            targetCount,
            discrepancyNote,
            existing?.verificationMethod,
            existing?.manualVerificationReason
          );
          const fresh = await supabaseRepository.fetchBatches(userProfile);
          setState((prev) => ({ ...prev, batches: fresh }));
          persistUserBatchCache(userProfile?.id, fresh);
        } catch (err: any) {
          console.warn('[SajiAmanContext] confirmReceipt RPC error, rolling back:', err.message);
          setState(snapshotBefore);
          showToast(`Gagal konfirmasi penerimaan: ${err.message}`, 'warning');
          return;
        }
      }

      if (existing) {
        scheduleBatchSafetyAlarms(existing, serverClockDriftMs);
      }

      hapticsAdapter.success();
      showToast('Penerimaan ompreng stainless berhasil dikonfirmasi', 'success');
    },
    [
      simulatedNowMs,
      serverClockDriftMs,
      state,
      userProfile,
      showToast,
      isSupabaseActive,
      isOnline,
      isClockTampered,
      persistUserBatchCache,
    ]
  );

  // Confirm Ompreng Return
  const confirmOmprengReturned = useCallback(
    async (batchId: string) => {
      const snapshotBefore = state;
      let returnedCount = 0;

      setState((prev) => ({
        ...prev,
        batches: prev.batches.map((b) => {
          if (b.id !== batchId) return b;
          returnedCount = b.omprengReceivedCount ?? b.omprengCount;
          return {
            ...b,
            omprengStatus: 'returned_sterilized',
            omprengReturnedAt: simulatedNowMs,
          };
        }),
        plasticsSavedBaseline: prev.plasticsSavedBaseline + returnedCount,
      }));

      if (isSupabaseActive) {
        try {
          await supabaseRepository.confirmOmprengReturn(batchId);
          const fresh = await supabaseRepository.fetchBatches(userProfile);
          setState((prev) => ({ ...prev, batches: fresh }));
          persistUserBatchCache(userProfile?.id, fresh);
        } catch (err: any) {
          console.warn('[SajiAmanContext] confirmReturn RPC error, rolling back:', err.message);
          setState(snapshotBefore);
          showToast(`Gagal konfirmasi kembali ompreng: ${err.message}`, 'warning');
          return;
        }
      }

      hapticsAdapter.success();
      showToast(
        `${returnedCount} ompreng kembali & steril — statistik bebas plastik diperbarui`,
        'success'
      );
    },
    [simulatedNowMs, state, userProfile, showToast, isSupabaseActive, persistUserBatchCache]
  );

  // Reject Batch Spoiled (Force Red Override)
  const rejectBatchSpoiled = useCallback(
    async (batchId: string, reason: string, photoPath?: string): Promise<boolean> => {
      const snapshotBefore = state;

      setState((prev) => ({
        ...prev,
        batches: prev.batches.map((b) => {
          if (b.id !== batchId) return b;
          return {
            ...b,
            batchStatus: 'rejected_spoiled',
            rejectionReason: reason,
            rejectionPhotoPath: photoPath,
            rejectedAt: simulatedNowMs,
          };
        }),
      }));

      if (isSupabaseActive) {
        try {
          await supabaseRepository.rejectBatchSpoiled(batchId, reason, photoPath);
          const fresh = await supabaseRepository.fetchBatches(userProfile);
          setState((prev) => ({ ...prev, batches: fresh }));
          persistUserBatchCache(userProfile?.id, fresh);
        } catch (err: any) {
          console.warn('[SajiAmanContext] rejectBatchSpoiled error, rolling back:', err.message);
          setState(snapshotBefore);
          showToast(`Gagal melaporkan tolak boks: ${err.message}`, 'warning');
          return false;
        }
      }

      cancelBatchSafetyAlarms(batchId);
      hapticsAdapter.heavyImpact();
      showToast('Boks ditolak resmi — status DARURAT terkunci MERAH', 'warning');
      return true;
    },
    [simulatedNowMs, state, userProfile, showToast, isSupabaseActive, persistUserBatchCache]
  );

  // Mark Ompreng Ready for Pickup
  const markOmprengReadyForPickup = useCallback(
    async (batchId: string): Promise<boolean> => {
      const snapshotBefore = state;

      setState((prev) => ({
        ...prev,
        batches: prev.batches.map((b) => {
          if (b.id !== batchId) return b;
          return {
            ...b,
            omprengReadyForPickup: true,
            omprengReadyForPickupAt: simulatedNowMs,
          };
        }),
      }));

      if (isSupabaseActive) {
        try {
          await supabaseRepository.markOmprengReadyForPickup(batchId);
          const fresh = await supabaseRepository.fetchBatches(userProfile);
          setState((prev) => ({ ...prev, batches: fresh }));
          persistUserBatchCache(userProfile?.id, fresh);
        } catch (err: any) {
          console.warn('[SajiAmanContext] markOmprengReady error, rolling back:', err.message);
          setState(snapshotBefore);
          showToast(`Gagal menandai siap jemput: ${err.message}`, 'warning');
          return false;
        }
      }

      hapticsAdapter.success();
      showToast('Ompreng ditandai siap dijemput armada Dapur SPPG', 'success');
      return true;
    },
    [simulatedNowMs, state, userProfile, showToast, isSupabaseActive, persistUserBatchCache]
  );

  // Controlled Void Batch
  const voidBatch = useCallback(
    async (batchId: string, reason: string): Promise<boolean> => {
      const snapshotBefore = state;

      setState((prev) => ({
        ...prev,
        batches: prev.batches.map((b) => {
          if (b.id !== batchId) return b;
          return {
            ...b,
            batchStatus: 'voided',
            voidReason: reason,
            voidedAt: simulatedNowMs,
          };
        }),
      }));

      if (isSupabaseActive) {
        try {
          await supabaseRepository.voidProductionBatch(batchId, reason);
          const fresh = await supabaseRepository.fetchBatches(userProfile);
          setState((prev) => ({ ...prev, batches: fresh }));
          persistUserBatchCache(userProfile?.id, fresh);
        } catch (err: any) {
          console.warn('[SajiAmanContext] voidBatch error, rolling back:', err.message);
          setState(snapshotBefore);
          showToast(`Gagal membatalkan batch: ${err.message}`, 'warning');
          return false;
        }
      }

      cancelBatchSafetyAlarms(batchId);
      hapticsAdapter.selection();
      showToast(`Batch ${batchId} berhasil dibatalkan terkontrol`, 'info');
      return true;
    },
    [simulatedNowMs, state, userProfile, showToast, isSupabaseActive, persistUserBatchCache]
  );

  // Maggot Waste Report (Preserving Scope Lock behavior + awaited Supabase persistence)
  const submitMaggotReport = useCallback(
    async (input: CreateMaggotReportInput): Promise<MaggotReport | null> => {
      const batch = state.batches.find((b) => b.id === input.batchId);
      const preset = WASTE_VOLUME_PRESETS.find((p) => p.id === input.volumePresetId);
      if (!batch || !preset) return null;

      const tempId = `MGT-LOCAL-${Date.now()}`;
      const optimisticReport: MaggotReport = {
        id: isSupabaseActive
          ? tempId
          : `MGT-2411-${String(state.maggotReports.length + 1).padStart(2, '0')}`,
        batchId: batch.id,
        schoolId: batch.schoolId,
        schoolName: batch.schoolName,
        boxNumber: batch.boxNumber,
        category: input.category,
        volumePresetId: preset.id,
        volumeLabel: preset.unitLabel,
        estimatedKg: preset.estimatedKg,
        locationNote:
          input.locationNote.trim() || 'Ember tertutup siap di pos satpam sekolah',
        reportedBy: userProfile?.fullName ?? 'Koordinator Sekolah',
        reportedAt: simulatedNowMs,
        status: 'pending_pickup',
      };

      const previousReports = state.maggotReports;
      setState((prev) => ({
        ...prev,
        maggotReports: [optimisticReport, ...prev.maggotReports],
      }));

      let finalReport: MaggotReport = optimisticReport;
      if (isSupabaseActive) {
        try {
          const serverRow = await supabaseRepository.submitMaggotReport({
            batchId: input.batchId,
            category: input.category,
            volumePresetId: preset.id,
            estimatedKg: preset.estimatedKg,
            notes: input.locationNote,
          });
          const freshReports = await supabaseRepository.fetchMaggotReports(
            userProfileRef.current
          );
          const matched = freshReports.find(
            (r) =>
              (serverRow?.id && r.id === serverRow.id) || r.batchId === batch.id
          );
          if (matched) {
            finalReport = matched;
          }
          setState((prev) => ({
            ...prev,
            maggotReports: freshReports,
          }));
        } catch (err: any) {
          console.warn('[SajiAmanContext] Supabase submitMaggot error:', err?.message || err);
          setState((prev) => ({
            ...prev,
            maggotReports: previousReports,
          }));
          hapticsAdapter.error();
          showToast(
            err?.message || 'Gagal mengirim laporan maggot ke server. Silakan coba lagi.',
            'warning'
          );
          return null;
        }
      }

      cancelBatchSafetyAlarms(input.batchId);
      hapticsAdapter.success();
      showToast('Laporan sisa terkirim — status Siap Dijemput Mitra Maggot BSF', 'success');
      return finalReport;
    },
    [
      state.batches,
      state.maggotReports,
      simulatedNowMs,
      userProfile,
      showToast,
      isSupabaseActive,
    ]
  );

  const dispatchBsfPartner = useCallback(
    async (reportId: string): Promise<boolean> => {
      const previousReports = state.maggotReports;
      setState((prev) => ({
        ...prev,
        maggotReports: prev.maggotReports.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: 'dispatched_bsf',
                assignedPartner: kitchenProfile.partnerBsfName,
                dispatchedAt: simulatedNowMs,
              }
            : r
        ),
      }));

      if (isSupabaseActive) {
        try {
          await supabaseRepository.assignMaggotPartner(
            reportId,
            kitchenProfile.partnerBsfName
          );
          const freshReports = await supabaseRepository.fetchMaggotReports(
            userProfileRef.current
          );
          if (freshReports.length > 0) {
            setState((prev) => ({ ...prev, maggotReports: freshReports }));
          }
        } catch (err: any) {
          console.warn('[SajiAmanContext] dispatchBsfPartner error:', err?.message || err);
          setState((prev) => ({
            ...prev,
            maggotReports: previousReports,
          }));
          hapticsAdapter.error();
          showToast(
            err?.message || 'Gagal menugaskan mitra maggot BSF ke server.',
            'warning'
          );
          return false;
        }
      }

      hapticsAdapter.success();
      showToast(`Armada ${kitchenProfile.partnerBsfName} berhasil ditugaskan`, 'success');
      return true;
    },
    [
      state.maggotReports,
      simulatedNowMs,
      kitchenProfile.partnerBsfName,
      isSupabaseActive,
      showToast,
    ]
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      }));
      if (isSupabaseActive) {
        await supabaseRepository.markNotificationRead(id);
      }
    },
    [isSupabaseActive]
  );

  const markAllNotificationsRead = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
    }));
    if (isSupabaseActive) {
      await supabaseRepository.markAllNotificationsRead(userProfileRef.current);
    }
  }, [isSupabaseActive]);

  const shiftClockByMs = useCallback((deltaMs: number) => {
    setClockOffsetMs((prev) => prev + deltaMs);
  }, []);

  const resetClock = useCallback(() => {
    sessionStartWallRef.current = Date.now();
    setElapsedRealMs(0);
    setClockOffsetMs(0);
    showToast('Jam simulasi dikembalikan ke waktu normal', 'info');
  }, [showToast]);

  const resetDemoData = useCallback(() => {
    sessionStartWallRef.current = Date.now();
    setElapsedRealMs(0);
    setClockOffsetMs(0);
    sajiamanRepository.resetDemoState().then((fresh) => {
      setState({
        ...fresh,
        baseReferenceTimeMs: DEFAULT_MORNING_ANCHOR_MS,
      });
      showToast('Seluruh data demo SajiAman telah direset', 'info');
    });
  }, [showToast]);

  // Dynamic plastics prevented count computed from returned sterilized batches in Supabase mode
  const totalPlasticsSaved = useMemo(() => {
    if (!isSupabaseActive) {
      return state.plasticsSavedBaseline;
    }
    return state.batches
      .filter((b) => b.omprengStatus === 'returned_sterilized')
      .reduce((acc, b) => acc + (b.omprengReceivedCount ?? b.omprengCount), 0);
  }, [isSupabaseActive, state.batches, state.plasticsSavedBaseline]);

  const totalOrganicDivertedKg = useMemo(() => {
    const reportsSum = state.maggotReports.reduce((acc, r) => acc + r.estimatedKg, 0);
    return Number((state.organicKgBaseline + reportsSum).toFixed(1));
  }, [state.maggotReports, state.organicKgBaseline]);

  const pendingMaggotCount = useMemo(
    () => state.maggotReports.filter((r) => r.status === 'pending_pickup').length,
    [state.maggotReports]
  );

  const getBatchById = useCallback(
    (id: string) => state.batches.find((b) => b.id.toUpperCase() === id.toUpperCase()),
    [state.batches]
  );

  const isBatchScanUnlocked = useCallback(
    (batchId: string) => {
      const clean = batchId.trim().toUpperCase();
      if (verifiedBatchIds.includes(clean)) return true;
      const b = state.batches.find((x) => x.id.toUpperCase() === clean);
      if (!b) return false;
      return (
        b.omprengStatus === 'received_school' ||
        b.omprengStatus === 'returned_sterilized' ||
        b.batchStatus === 'rejected_spoiled' ||
        b.batchStatus === 'voided'
      );
    },
    [verifiedBatchIds, state.batches]
  );

  const value: SajiAmanContextValue = {
    isHydrated,
    dataSource: activeDataSource,
    role,
    userProfile,
    kitchenProfile,
    schools,
    menuCatalog,
    refreshUserProfile: fetchAndSetUserProfile,
    reloadAccountData,
    refreshSchools,
    refreshMenuCatalog,
    refreshKitchenProfile,
    verifyAndFetchBatchByCode,
    refreshBatchSamplePhoto,
    verifiedBatchIds,
    isBatchScanUnlocked,
    batches: state.batches,
    maggotReports: state.maggotReports,
    notifications: state.notifications,
    realtimeStatus,
    simulatedNowMs,
    serverClockDriftMs,
    isClockTampered,
    clockOffsetMs,
    totalPlasticsSaved,
    totalOrganicDivertedKg,
    pendingMaggotCount,
    toast,
    selectRole,
    logoutToRoleSelect,
    createBatch,
    confirmOmprengReceived,
    confirmOmprengReturned,
    rejectBatchSpoiled,
    markOmprengReadyForPickup,
    voidBatch,
    submitMaggotReport,
    dispatchBsfPartner,
    markNotificationRead,
    markAllNotificationsRead,
    shiftClockByMs,
    resetClock,
    resetDemoData,
    showToast,
    dismissToast,
    getBatchById,
  };

  return <SajiAmanContext.Provider value={value}>{children}</SajiAmanContext.Provider>;
};

export function useSajiAman(): SajiAmanContextValue {
  const ctx = useContext(SajiAmanContext);
  if (!ctx) {
    throw new Error('useSajiAman must be used inside SajiAmanProvider');
  }
  return ctx;
}
