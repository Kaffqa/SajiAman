/**
 * SajiAman Domain Models
 * Structured to align 1:1 with future Supabase PostgreSQL tables:
 * kitchens, schools, menu_items, batches, batch_items, ompreng_logs, maggot_reports
 */

export type UserRole = 'kitchen' | 'school';

export type SafetyStatus = 'GREEN' | 'YELLOW' | 'RED';

export type MenuCategory = 'karbohidrat' | 'protein' | 'sayur' | 'buah';

export type ProductionInputMode = 'manual' | 'ai_camera';

export type OmprengCustodyStatus = 'dispatched' | 'received_school' | 'returned_sterilized';

export type WasteCategory = 'post_meal' | 'surplus_intact' | 'expired_red';

export type MaggotPickupStatus = 'pending_pickup' | 'dispatched_bsf';

export interface KitchenProfile {
  id: string;
  code: string;
  name: string;
  picName: string;
  email: string;
  totalOmprengInventory: number;
  partnerBsfName: string;
}

export interface SchoolProfile {
  id: string;
  name: string;
  picName: string;
  email: string;
  defaultPortions: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  holdingHours: number; // e.g., 3.5, 4.0, 4.5, 5.0, 6.0
  riskLabel: string; // e.g., "Berkuah/Santan", "Menu Kering", "Buah Potong"
  isHighRisk: boolean; // true for <= 3.5h
}

export interface WeakestLinkResult {
  holdingHours: number;
  holdingMs: number;
  triggerItem: MenuItem;
  isDryStandard: boolean;
  reasonText: string;
  shortRuleLabel: string;
}

export interface SafetyEvaluation {
  status: SafetyStatus;
  remainingMs: number;
  elapsedPastExpiryMs: number;
  isExpired: boolean;
  verdictTitle: string;
  verdictBadge: string;
  instruction: string;
}

export interface BatchRecord {
  id: string; // e.g., MBG-2411-G01
  kitchenId: string;
  kitchenName: string;
  schoolId: string;
  schoolName: string;
  boxNumber: string; // e.g., Boks #04
  items: MenuItem[];
  weakestLinkItemId: string;
  weakestLinkItemName: string;
  weakestLinkRiskLabel: string;
  holdingHours: number;
  cookedAt: number; // epoch ms (locked server timestamp)
  expiresAt: number; // epoch ms
  arrivedAt?: number; // epoch ms
  kitchenTempC: number;
  omprengCount: number;
  omprengReceivedCount?: number;
  omprengDiscrepancyNote?: string;
  omprengStatus: OmprengCustodyStatus;
  omprengConfirmedBy?: string;
  omprengConfirmedAt?: number;
  omprengReturnedAt?: number;
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

export interface WasteVolumePreset {
  id: 'ringan' | 'sedang' | 'banyak' | 'surplus_penuh';
  title: string;
  unitLabel: string;
  estimatedKg: number;
  bucketEstimate: string;
}

export interface MaggotReport {
  id: string;
  batchId: string;
  schoolId: string;
  schoolName: string;
  boxNumber: string;
  category: WasteCategory;
  volumePresetId: WasteVolumePreset['id'];
  volumeLabel: string;
  estimatedKg: number;
  locationNote: string;
  reportedBy: string;
  reportedAt: number;
  status: MaggotPickupStatus;
  assignedPartner?: string;
  dispatchedAt?: number;
}

export interface SajiAmanStateSnapshot {
  batches: BatchRecord[];
  maggotReports: MaggotReport[];
  plasticsSavedBaseline: number;
  organicKgBaseline: number;
  baseReferenceTimeMs: number;
}

export type AppRoute =
  | { name: 'login' }
  | { name: 'kitchen_home' }
  | { name: 'kitchen_create_batch' }
  | { name: 'kitchen_batch_qr'; batchId: string }
  | { name: 'kitchen_ompreng' }
  | { name: 'kitchen_maggot' }
  | { name: 'school_scanner' }
  | { name: 'school_history' }
  | { name: 'school_safety_check'; batchId: string }
  | { name: 'school_waste_report'; batchId: string; presetCategory?: WasteCategory };
