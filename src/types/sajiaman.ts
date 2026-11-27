/**
 * SajiAman Domain Models
 * Structured to align 1:1 with future Supabase PostgreSQL tables:
 * kitchens, schools, menu_items, batches, batch_items, ompreng_logs, maggot_reports
 */

export type UserRole = 'kitchen' | 'school' | 'admin';

export type SafetyStatus = 'GREEN' | 'YELLOW' | 'RED';

export type BatchStatus = 'active' | 'voided' | 'rejected_spoiled';

export type MenuCategory =
  | 'karbohidrat'
  | 'protein'
  | 'sayur'
  | 'buah'
  | 'susu_minuman'
  | 'sambal_pelengkap';

export type ProductionInputMode = 'manual' | 'ai_camera';

export type OmprengCustodyStatus = 'dispatched' | 'received_school' | 'returned_sterilized';

export type WasteCategory = 'post_meal' | 'surplus_intact' | 'expired_red';

export type MaggotPickupStatus = 'pending_pickup' | 'dispatched_bsf';

export type RealtimeConnectionState = 'SUBSCRIBED' | 'CONNECTING' | 'OFFLINE';

export type NotificationType =
  | 'new_batch'
  | 'early_spoilage'
  | 'ompreng_discrepancy'
  | 'ompreng_ready'
  | 'batch_voided';

export interface AppNotification {
  id: string;
  recipientRole?: UserRole;
  kitchenId?: string;
  schoolId?: string;
  batchId?: string;
  batchCode?: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: number;
}

export interface ActiveUserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneWa: string;
  role: UserRole;
  kitchenId?: string;
  kitchenName?: string;
  kitchenCode?: string;
  schoolId?: string;
  schoolName?: string;
  isActive?: boolean;
}

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
  npsn?: string;
  name: string;
  address?: string;
  picName: string;
  phoneWa?: string;
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
  isActive?: boolean;
  kitchenId?: string | null;
  isSystemDefault?: boolean;
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
  dbId?: string; // PostgreSQL UUID primary key
  kitchenId: string;
  kitchenCode?: string;
  kitchenName: string;
  schoolId: string;
  schoolName: string;
  createdBy?: string;
  creatorName?: string;
  qrToken?: string;
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
  batchStatus?: BatchStatus; // 'active' | 'voided' | 'rejected_spoiled'
  rejectionReason?: string;
  rejectionPhotoPath?: string;
  rejectedAt?: number;
  voidReason?: string;
  voidedAt?: number;
  omprengReadyForPickup?: boolean;
  omprengReadyForPickupAt?: number;
  samplePhotoUrl?: string;
  samplePhotoStoragePath?: string;
  samplePhotoTimestamp?: string;
  aiOverridden?: boolean;
  aiDetectedWeakestMinutes?: number;
  verificationMethod?: 'qr_scan' | 'manual_code';
  manualVerificationReason?: string;
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
  notifications: AppNotification[];
  plasticsSavedBaseline: number;
  organicKgBaseline: number;
  baseReferenceTimeMs: number;
}

export interface AdminKitchenSummary {
  id: string;
  code: string;
  name: string;
  address?: string;
  total_ompreng_inventory: number;
  is_active?: boolean;
  school_count: number;
  staff_count: number;
  active_batch_count: number;
  created_at?: string;
}

export interface AdminSchoolSummary {
  id: string;
  npsn?: string;
  name: string;
  address?: string;
  pic_name?: string;
  phone_wa?: string;
  default_portions: number;
  assigned_kitchen_id: string;
  is_active?: boolean;
  assigned_kitchen_code?: string;
  assigned_kitchen_name?: string;
  created_at?: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  email_confirmed: boolean;
  role?: UserRole | null;
  full_name?: string | null;
  phone_wa?: string | null;
  kitchen_id?: string | null;
  kitchen_code?: string | null;
  kitchen_name?: string | null;
  school_id?: string | null;
  school_name?: string | null;
  is_active?: boolean;
  is_orphan: boolean;
  created_at?: string;
}

export interface AdminDashboardSnapshot {
  kitchens: AdminKitchenSummary[];
  schools: AdminSchoolSummary[];
  users: AdminUserSummary[];
  metrics: {
    total_kitchens: number;
    total_schools: number;
    total_users: number;
    orphan_users: number;
    total_batches: number;
    active_batches: number;
    rejected_batches: number;
    voided_batches: number;
    total_maggot_kg: number;
  };
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
