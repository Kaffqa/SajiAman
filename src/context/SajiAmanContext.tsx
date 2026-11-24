import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hapticsAdapter } from '../adapters/hapticsAdapter';
import {
  createSeedSnapshot,
  DEFAULT_MORNING_ANCHOR_MS,
  KITCHEN_PROFILE,
  sajiamanRepository,
  SCHOOLS,
  WASTE_VOLUME_PRESETS,
} from '../data/mockRepository';
import {
  calculateWeakestLink,
  generateBatchId,
} from '../domain/weakestLinkEngine';
import type {
  AppRoute,
  BatchRecord,
  MaggotReport,
  MenuItem,
  ProductionInputMode,
  SajiAmanStateSnapshot,
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

interface SajiAmanContextValue {
  route: AppRoute;
  role: UserRole | null;
  batches: BatchRecord[];
  maggotReports: MaggotReport[];
  simulatedNowMs: number;
  clockOffsetMs: number;
  totalPlasticsSaved: number;
  totalOrganicDivertedKg: number;
  pendingMaggotCount: number;
  toast: ToastMessage | null;
  navigate: (next: AppRoute) => void;
  selectRole: (role: UserRole) => void;
  logoutToRoleSelect: () => void;
  createBatch: (input: CreateBatchInput) => BatchRecord | null;
  confirmOmprengReceived: (batchId: string, receivedCount?: number, discrepancyNote?: string) => void;
  confirmOmprengReturned: (batchId: string) => void;
  submitMaggotReport: (input: CreateMaggotReportInput) => MaggotReport | null;
  dispatchBsfPartner: (reportId: string) => void;
  shiftClockByMs: (deltaMs: number) => void;
  resetClock: () => void;
  resetDemoData: () => void;
  showToast: (text: string, tone?: ToastMessage['tone']) => void;
  dismissToast: () => void;
}

const SajiAmanContext = createContext<SajiAmanContextValue | null>(null);

function resolveInitialRoute(): { route: AppRoute; role: UserRole | null } {
  if (typeof window === 'undefined') {
    return { route: { name: 'login' }, role: null };
  }
  const params = new URLSearchParams(window.location.search);
  const autostart = params.get('autostart');
  if (autostart === '1' || autostart === 'kitchen') {
    return { route: { name: 'kitchen_home' }, role: 'kitchen' };
  }
  if (autostart === 'school') {
    return { route: { name: 'school_scanner' }, role: 'school' };
  }
  return { route: { name: 'login' }, role: null };
}

export const SajiAmanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialNav = useMemo(() => resolveInitialRoute(), []);
  const [route, setRoute] = useState<AppRoute>(initialNav.route);
  const [role, setRole] = useState<UserRole | null>(initialNav.role);
  const [state, setState] = useState<SajiAmanStateSnapshot>(() => createSeedSnapshot());
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [elapsedRealMs, setElapsedRealMs] = useState<number>(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const sessionStartWallRef = useRef<number>(Date.now());
  const toastTimerRef = useRef<number | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    let active = true;
    sajiamanRepository.loadState().then((loaded) => {
      if (active) {
        setState(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist state whenever batches/reports change
  useEffect(() => {
    sajiamanRepository.saveState(state);
  }, [state]);

  // Live 1-second ticker synchronized to QA simulated clock
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsedRealMs(Date.now() - sessionStartWallRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const simulatedNowMs = state.baseReferenceTimeMs + elapsedRealMs + clockOffsetMs;

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), text, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3400);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    hapticsAdapter.selection();
    setRoute(next);
  }, []);

  const selectRole = useCallback((nextRole: UserRole) => {
    hapticsAdapter.selection();
    setRole(nextRole);
    setRoute(nextRole === 'kitchen' ? { name: 'kitchen_home' } : { name: 'school_scanner' });
  }, []);

  const logoutToRoleSelect = useCallback(() => {
    hapticsAdapter.selection();
    setRole(null);
    setRoute({ name: 'login' });
  }, []);

  const createBatch = useCallback(
    (input: CreateBatchInput): BatchRecord | null => {
      const weakest = calculateWeakestLink(input.items);
      if (!weakest) return null;

      const school = SCHOOLS.find((s) => s.id === input.schoolId) ?? SCHOOLS[0];
      const nextSeq = state.batches.length + 1;
      const newBatchId = generateBatchId(nextSeq);
      const cookedAt = simulatedNowMs;
      const expiresAt = cookedAt + weakest.holdingMs;

      const newBatch: BatchRecord = {
        id: newBatchId,
        kitchenId: KITCHEN_PROFILE.id,
        kitchenName: KITCHEN_PROFILE.name,
        schoolId: school.id,
        schoolName: school.name,
        boxNumber: `Boks #${String(nextSeq + 1).padStart(2, '0')}`,
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
        inputMode: input.inputMode,
        samplePhotoUrl: input.samplePhotoUrl,
        samplePhotoTimestamp: input.samplePhotoTimestamp,
        aiVerifiedNutrition: input.aiVerifiedNutrition,
      };

      setState((prev) => ({
        ...prev,
        batches: [newBatch, ...prev.batches],
      }));

      hapticsAdapter.success();
      showToast(`Boks ${newBatch.id} berhasil disegel & terkunci waktu server`, 'success');
      return newBatch;
    },
    [simulatedNowMs, state.batches.length, showToast]
  );

  const confirmOmprengReceived = useCallback(
    (batchId: string, receivedCount?: number, discrepancyNote?: string) => {
      setState((prev) => ({
        ...prev,
        batches: prev.batches.map((b) => {
          if (b.id !== batchId) return b;
          const school = SCHOOLS.find((s) => s.id === b.schoolId);
          return {
            ...b,
            omprengStatus: 'received_school',
            omprengReceivedCount: receivedCount ?? b.omprengCount,
            omprengDiscrepancyNote: discrepancyNote,
            omprengConfirmedBy: school?.picName ?? 'Bu Sari',
            omprengConfirmedAt: simulatedNowMs,
          };
        }),
      }));
      hapticsAdapter.success();
      showToast('Penerimaan ompreng stainless berhasil dikonfirmasi', 'success');
    },
    [simulatedNowMs, showToast]
  );

  const confirmOmprengReturned = useCallback(
    (batchId: string) => {
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
      hapticsAdapter.success();
      showToast(
        `${returnedCount} ompreng kembali & steril — statistik bebas plastik diperbarui`,
        'success'
      );
    },
    [simulatedNowMs, showToast]
  );

  const submitMaggotReport = useCallback(
    (input: CreateMaggotReportInput): MaggotReport | null => {
      const batch = state.batches.find((b) => b.id === input.batchId);
      const preset = WASTE_VOLUME_PRESETS.find((p) => p.id === input.volumePresetId);
      if (!batch || !preset) return null;

      const school = SCHOOLS.find((s) => s.id === batch.schoolId);
      const report: MaggotReport = {
        id: `MGT-2411-${String(state.maggotReports.length + 1).padStart(2, '0')}`,
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
        reportedBy: school?.picName ?? 'Bu Sari',
        reportedAt: simulatedNowMs,
        status: 'pending_pickup',
      };

      setState((prev) => ({
        ...prev,
        maggotReports: [report, ...prev.maggotReports],
      }));

      hapticsAdapter.success();
      showToast('Laporan sisa terkirim — status Siap Dijemput Mitra Maggot BSF', 'success');
      return report;
    },
    [state.batches, state.maggotReports.length, simulatedNowMs, showToast]
  );

  const dispatchBsfPartner = useCallback(
    (reportId: string) => {
      setState((prev) => ({
        ...prev,
        maggotReports: prev.maggotReports.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: 'dispatched_bsf',
                assignedPartner: KITCHEN_PROFILE.partnerBsfName,
                dispatchedAt: simulatedNowMs,
              }
            : r
        ),
      }));
      hapticsAdapter.success();
      showToast(`Armada ${KITCHEN_PROFILE.partnerBsfName} berhasil ditugaskan`, 'success');
    },
    [simulatedNowMs, showToast]
  );

  const shiftClockByMs = useCallback((deltaMs: number) => {
    setClockOffsetMs((prev) => prev + deltaMs);
  }, []);

  const resetClock = useCallback(() => {
    sessionStartWallRef.current = Date.now();
    setElapsedRealMs(0);
    setClockOffsetMs(0);
    showToast('Jam simulasi dikembalikan ke 07:30 WIB', 'info');
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

  const totalOrganicDivertedKg = useMemo(() => {
    const reportsSum = state.maggotReports.reduce((acc, r) => acc + r.estimatedKg, 0);
    return Number((state.organicKgBaseline + reportsSum).toFixed(1));
  }, [state.maggotReports, state.organicKgBaseline]);

  const pendingMaggotCount = useMemo(
    () => state.maggotReports.filter((r) => r.status === 'pending_pickup').length,
    [state.maggotReports]
  );

  const value: SajiAmanContextValue = {
    route,
    role,
    batches: state.batches,
    maggotReports: state.maggotReports,
    simulatedNowMs,
    clockOffsetMs,
    totalPlasticsSaved: state.plasticsSavedBaseline,
    totalOrganicDivertedKg,
    pendingMaggotCount,
    toast,
    navigate,
    selectRole,
    logoutToRoleSelect,
    createBatch,
    confirmOmprengReceived,
    confirmOmprengReturned,
    submitMaggotReport,
    dispatchBsfPartner,
    shiftClockByMs,
    resetClock,
    resetDemoData,
    showToast,
    dismissToast,
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
