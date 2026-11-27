/**
 * SajiAman Supabase Async Repository
 * Implements Multi-Tenant Scoped PostgreSQL Queries, Server-Side RPCs,
 * Private Signed Storage & Filtered Realtime Sync.
 */

import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { MENU_CATALOG, WASTE_VOLUME_PRESETS } from './mockRepository';
import { executeVerifyBatchQrServer, type QrServerCheckResult } from '../domain/qrCrypto';
import type {
  ActiveUserProfile,
  AdminDashboardSnapshot,
  AppNotification,
  BatchRecord,
  KitchenProfile,
  MaggotPickupStatus,
  MaggotReport,
  MenuItem,
  NotificationType,
  OmprengCustodyStatus,
  ProductionInputMode,
  RealtimeConnectionState,
  SchoolProfile,
  UserRole,
  WasteCategory,
} from '../types/sajiaman';

function mapDbToFrontendOmprengStatus(dbStatus: string): OmprengCustodyStatus {
  if (dbStatus === 'in_transit') return 'dispatched';
  if (dbStatus === 'received_school') return 'received_school';
  return 'returned_sterilized';
}

function mapFrontendToDbInputMode(mode: ProductionInputMode): 'manual' | 'ai_photo' {
  return mode === 'ai_camera' ? 'ai_photo' : 'manual';
}

function mapDbToFrontendInputMode(dbMode: string): ProductionInputMode {
  return dbMode === 'ai_photo' ? 'ai_camera' : 'manual';
}

function mapFrontendToDbWasteCategory(cat: WasteCategory): 'post_meal_leftover' | 'surplus_intact' | 'expired_red' {
  if (cat === 'post_meal') return 'post_meal_leftover';
  return cat;
}

function mapDbToFrontendWasteCategory(dbCat: string): WasteCategory {
  if (dbCat === 'post_meal_leftover') return 'post_meal';
  return dbCat as WasteCategory;
}

function mapDbToFrontendMaggotStatus(dbStatus: string): MaggotPickupStatus {
  if (dbStatus === 'ready_for_pickup') return 'pending_pickup';
  return 'dispatched_bsf';
}

function getRiskLabelFromMinutes(minutes: number): string {
  if (minutes <= 210) return 'Berkuah/Santan';
  if (minutes <= 240) return 'Sayur Kuah';
  if (minutes >= 360) return 'Buah Utuh';
  return 'Menu Kering';
}

/**
 * Extracts canonical bucket object path from raw or broken public/signed Supabase Storage URLs.
 */
function extractSampleStoragePath(rawPath?: string | null): string | null {
  if (!rawPath) return null;
  const trimmed = rawPath.trim();
  if (!trimmed) return null;

  // Already a relative storage path inside sample-photos (not an external URL or local URI)
  if (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('file://') &&
    !trimmed.startsWith('blob:') &&
    !trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  // Heal previously saved broken Supabase public/signed URLs for private bucket
  const marker = '/sample-photos/';
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    const after = trimmed.slice(idx + marker.length);
    return after.split('?')[0] || null;
  }

  return null;
}

/**
 * Batch-resolves relative sample-photos storage paths into fresh 1-hour Signed URLs.
 */
async function resolveSignedPhotoMap(rawPaths: Array<string | null | undefined>): Promise<Record<string, string>> {
  const pathSet = new Set<string>();
  const rawToObjectPath: Record<string, string> = {};

  for (const raw of rawPaths) {
    if (!raw) continue;
    const objPath = extractSampleStoragePath(raw);
    if (objPath) {
      pathSet.add(objPath);
      rawToObjectPath[raw] = objPath;
    }
  }

  const resolvedMap: Record<string, string> = {};
  const uniquePaths = Array.from(pathSet);
  if (uniquePaths.length === 0) return resolvedMap;

  try {
    const { data, error } = await supabase.storage
      .from('sample-photos')
      .createSignedUrls(uniquePaths, 3600);

    if (!error && Array.isArray(data)) {
      const objUrlByPath: Record<string, string> = {};
      for (const entry of data) {
        if (entry.path && entry.signedUrl) {
          objUrlByPath[entry.path] = entry.signedUrl;
        }
      }
      for (const [raw, objPath] of Object.entries(rawToObjectPath)) {
        if (objUrlByPath[objPath]) {
          resolvedMap[raw] = objUrlByPath[objPath];
        }
      }
    }
  } catch (err) {
    console.warn('[supabaseRepository] resolveSignedPhotoMap notice:', err);
  }

  return resolvedMap;
}

function mapDbRowToBatchRecord(
  b: any,
  index: number,
  signedPhotoMap: Record<string, string>
): BatchRecord {
  const items: MenuItem[] = (b.items || []).map((it: any, itemIdx: number) => {
    const found = MENU_CATALOG.find((m) => m.id === it.menu_item_id);
    const mins = it.holding_time_minutes || (found ? Math.round(found.holdingHours * 60) : 210);
    if (found) {
      return {
        ...found,
        name: it.menu_item_name || found.name,
        holdingHours: mins / 60,
        riskLabel: getRiskLabelFromMinutes(mins),
        isHighRisk: mins <= 210,
      };
    }
    const slug =
      String(it.menu_item_name || 'item')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'custom';
    return {
      id: it.menu_item_id || `custom-${slug}-${itemIdx}`,
      name: it.menu_item_name,
      category: it.category,
      holdingHours: mins / 60,
      riskLabel: getRiskLabelFromMinutes(mins),
      isHighRisk: mins <= 210,
    };
  });

  const weakest = items.find((m) => m.name === b.weakest_link_item_name) || items[0];

  const resolvePhoto = (raw?: string | null): string | undefined => {
    if (!raw) return undefined;
    if (signedPhotoMap[raw]) return signedPhotoMap[raw];
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      // Avoid returning broken /object/public/sample-photos/ if signing failed
      if (raw.includes('/object/public/sample-photos/')) return undefined;
      return raw;
    }
    return undefined;
  };

  return {
    id: b.batch_code,
    dbId: b.id,
    kitchenId: b.kitchen_id,
    kitchenCode: b.kitchen?.code || undefined,
    kitchenName: b.kitchen?.name || 'Dapur SPPG',
    schoolId: b.school_id,
    schoolName: b.school?.name || 'Sekolah MBG',
    createdBy: b.created_by || undefined,
    creatorName: b.creator?.full_name || undefined,
    qrToken: b.qr_token || undefined,
    boxNumber: b.box_label || `Boks #${String(b.box_number ?? index + 1).padStart(2, '0')}`,
    items,
    weakestLinkItemId: weakest?.id || 'item',
    weakestLinkItemName: b.weakest_link_item_name,
    weakestLinkRiskLabel: weakest?.riskLabel || 'Batas Terlemah',
    holdingHours: (b.holding_time_minutes || 210) / 60,
    cookedAt: new Date(b.cooked_at).getTime(),
    expiresAt: new Date(b.expires_at).getTime(),
    kitchenTempC: 28,
    omprengCount: b.ompreng_sent_count,
    omprengReceivedCount: b.ompreng_received_count != null ? Number(b.ompreng_received_count) : undefined,
    omprengDiscrepancyNote: b.ompreng_discrepancy_note || undefined,
    omprengReadyForPickup: Boolean(b.ompreng_ready_for_pickup),
    omprengReadyForPickupAt: b.ompreng_ready_for_pickup_at
      ? new Date(b.ompreng_ready_for_pickup_at).getTime()
      : undefined,
    omprengStatus: mapDbToFrontendOmprengStatus(b.ompreng_status),
    omprengConfirmedBy: b.receiver?.full_name || undefined,
    omprengConfirmedAt: b.ompreng_received_at ? new Date(b.ompreng_received_at).getTime() : undefined,
    omprengReturnedAt: b.ompreng_returned_at ? new Date(b.ompreng_returned_at).getTime() : undefined,
    inputMode: mapDbToFrontendInputMode(b.input_mode),
    batchStatus: (b.batch_status as any) || 'active',
    rejectionReason: b.rejection_reason || undefined,
    rejectionPhotoPath: resolvePhoto(b.rejection_photo_path),
    rejectedAt: b.rejected_at ? new Date(b.rejected_at).getTime() : undefined,
    voidReason: b.void_reason || undefined,
    voidedAt: b.voided_at ? new Date(b.voided_at).getTime() : undefined,
    samplePhotoUrl: resolvePhoto(b.sample_photo_path),
    samplePhotoStoragePath: extractSampleStoragePath(b.sample_photo_path) || undefined,
    aiOverridden: Boolean(b.ai_overridden),
    aiDetectedWeakestMinutes:
      b.ai_detected_weakest_minutes != null ? Number(b.ai_detected_weakest_minutes) : undefined,
    verificationMethod: b.verification_method === 'manual_code' ? 'manual_code' : 'qr_scan',
    manualVerificationReason: b.manual_verification_reason || undefined,
    aiVerifiedNutrition: b.ai_nutrition_verified
      ? { karbohidrat: true, protein: true, sayur: true, buah: true }
      : undefined,
  };
}

const BATCH_SELECT_QUERY = `
  *,
  kitchen:kitchens(name, code),
  school:schools(name, npsn),
  creator:profiles!created_by(full_name),
  receiver:profiles!ompreng_received_by(full_name),
  items:batch_menu_items(
    menu_item_id,
    menu_item_name,
    category,
    holding_time_minutes
  )
`;

export const supabaseRepository = {
  /**
   * Fetches official server epoch in ms, returning null if offline/unreachable.
   */
  async fetchServerTimeMs(): Promise<number | null> {
    try {
      const { data, error } = await supabase.rpc('get_server_time');
      if (error || !data) return null;
      const ms = new Date(data).getTime();
      return Number.isFinite(ms) ? ms : null;
    } catch {
      return null;
    }
  },

  /**
   * Refreshes a single sample-photos signed URL cleanly (1-hour lifetime).
   */
  async refreshSignedSampleUrl(storagePathOrUrl?: string | null): Promise<string | null> {
    const objPath = extractSampleStoragePath(storagePathOrUrl);
    if (!objPath) return null;
    try {
      const { data, error } = await supabase.storage
        .from('sample-photos')
        .createSignedUrl(objPath, 3600);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  },

  /**
   * Fetches official server time to calculate clock drift and prevent tamper.
   */
  async getServerTime(): Promise<number> {
    return (await this.fetchServerTimeMs()) ?? Date.now();
  },

  /**
   * Fetches production batches strictly scoped to the active officer's kitchen or school.
   */
  async fetchBatches(profile?: ActiveUserProfile | null): Promise<BatchRecord[]> {
    if (!profile) {
      return [];
    }

    let query = supabase
      .from('production_batches')
      .select(BATCH_SELECT_QUERY)
      .order('created_at', { ascending: false });

    if (profile.role === 'kitchen' && profile.kitchenId) {
      query = query.eq('kitchen_id', profile.kitchenId);
    } else if (profile.role === 'school' && profile.schoolId) {
      query = query.eq('school_id', profile.schoolId);
    } else if (profile.role !== 'admin') {
      return [];
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[supabaseRepository] fetchBatches error:', error.message);
      return [];
    }

    const rows = data || [];
    const photoPaths: Array<string | null | undefined> = [];
    for (const r of rows) {
      photoPaths.push(r.sample_photo_path, r.rejection_photo_path);
    }
    const signedMap = await resolveSignedPhotoMap(photoPaths);

    return rows.map((b, index) => mapDbRowToBatchRecord(b, index, signedMap));
  },

  /**
   * Direct server lookup for a single batch code (fallback when WebSocket sync lags).
   */
  async fetchBatchByCode(batchCode: string): Promise<BatchRecord | null> {
    const cleanCode = batchCode.trim().toUpperCase();
    if (!cleanCode) return null;

    const { data, error } = await supabase
      .from('production_batches')
      .select(BATCH_SELECT_QUERY)
      .ilike('batch_code', cleanCode)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const signedMap = await resolveSignedPhotoMap([data.sample_photo_path, data.rejection_photo_path]);
    return mapDbRowToBatchRecord(data, 0, signedMap);
  },

  /**
   * Verifies scanned or manually typed batch QR payload directly on PostgreSQL server (fail-closed).
   */
  async verifyBatchQrServer(
    batchCode: string,
    sig?: string | null,
    requireSig: boolean = true,
    verificationMethod?: 'qr_scan' | 'manual_code',
    manualReason?: string
  ): Promise<QrServerCheckResult & { batchCode?: string; batchStatus?: string }> {
    return executeVerifyBatchQrServer(
      async (fn, args) => {
        const res = await supabase.rpc(fn, args);
        return { data: res.data, error: res.error };
      },
      { batchCode, sig, requireSig, verificationMethod, manualReason }
    );
  },

  /**
   * Fetches maggot circular pickup reports scoped to the active unit.
   */
  async fetchMaggotReports(profile?: ActiveUserProfile | null): Promise<MaggotReport[]> {
    if (!profile) {
      return [];
    }

    let query = supabase
      .from('maggot_pickup_reports')
      .select(`
        *,
        school:schools(name),
        batch:production_batches(batch_code)
      `)
      .order('reported_at', { ascending: false });

    if (profile.role === 'kitchen' && profile.kitchenId) {
      query = query.eq('kitchen_id', profile.kitchenId);
    } else if (profile.role === 'school' && profile.schoolId) {
      query = query.eq('school_id', profile.schoolId);
    } else if (profile.role !== 'admin') {
      return [];
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[supabaseRepository] fetchMaggotReports error:', error.message);
      return [];
    }

    return (data || []).map((r) => {
      const preset = WASTE_VOLUME_PRESETS.find((p) => p.id === r.volume_tier) || WASTE_VOLUME_PRESETS[1];
      return {
        id: r.id,
        batchId: r.batch?.batch_code || 'MBG-SAMPLE',
        schoolId: r.school_id,
        schoolName: r.school?.name || 'Sekolah MBG',
        boxNumber: 'Boks Utama',
        category: mapDbToFrontendWasteCategory(r.waste_category),
        volumePresetId: (r.volume_tier as any) || 'sedang',
        volumeLabel: preset.unitLabel,
        estimatedKg: Number(r.estimated_kg),
        locationNote: r.notes || 'Area Pengambilan Sampah MBG',
        reportedBy: 'Petugas Sekolah',
        reportedAt: new Date(r.reported_at).getTime(),
        status: mapDbToFrontendMaggotStatus(r.status),
        assignedPartner: r.partner_name || undefined,
        dispatchedAt: r.assigned_at ? new Date(r.assigned_at).getTime() : undefined,
      };
    });
  },

  /**
   * Fetches operational notifications strictly filtered by active role & unit ID,
   * joining production_batches so navigation always uses batch_code (not raw UUID).
   */
  async fetchNotifications(profile?: ActiveUserProfile | null): Promise<AppNotification[]> {
    if (!profile) {
      return [];
    }

    let query = supabase
      .from('notifications')
      .select(`
        *,
        batch:production_batches(batch_code)
      `)
      .order('created_at', { ascending: false })
      .limit(40);

    if (profile.role === 'kitchen' && profile.kitchenId) {
      query = query.eq('recipient_role', 'kitchen').eq('kitchen_id', profile.kitchenId);
    } else if (profile.role === 'school' && profile.schoolId) {
      query = query.eq('recipient_role', 'school').eq('school_id', profile.schoolId);
    } else if (profile.role !== 'admin') {
      return [];
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[supabaseRepository] fetchNotifications error:', error.message);
      return [];
    }

    return (data || []).map((n) => {
      const batchCode = n.batch?.batch_code || undefined;
      return {
        id: n.id,
        recipientRole: n.recipient_role || undefined,
        kitchenId: n.kitchen_id || undefined,
        schoolId: n.school_id || undefined,
        batchId: batchCode || n.batch_id || undefined,
        batchCode,
        title: n.title,
        message: n.message,
        type: n.type as NotificationType,
        isRead: Boolean(n.is_read),
        createdAt: new Date(n.created_at).getTime(),
      };
    });
  },

  async markNotificationRead(id: string): Promise<void> {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },

  /**
   * Marks only the active unit's unread notifications as read.
   */
  async markAllNotificationsRead(profile?: ActiveUserProfile | null): Promise<void> {
    if (!profile) return;

    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .eq('recipient_role', profile.role);

    if (profile.role === 'kitchen' && profile.kitchenId) {
      query = query.eq('kitchen_id', profile.kitchenId);
    } else if (profile.role === 'school' && profile.schoolId) {
      query = query.eq('school_id', profile.schoolId);
    } else {
      return;
    }

    await query;
  },

  /**
   * Seals a new production batch via Server-Side Anti-Tampering RPC.
   * Supports ad-hoc/AI-detected items (adhoc-*) via p_extra_items with fallback to upsert_menu_item.
   */
  async sealProductionBatch(params: {
    schoolId: string;
    menuItemIds: string[];
    extraItems?: Array<{ name: string; category: string; holdingHours: number; isHighRisk?: boolean }>;
    omprengCount: number;
    inputMode: ProductionInputMode;
    samplePhotoPath?: string;
    aiDetectedWeakestMinutes?: number;
  }): Promise<any> {
    const extraPayload = (params.extraItems || []).map((ex) => ({
      name: ex.name,
      category: ex.category,
      holding_time_minutes: Math.round((ex.holdingHours || 4.5) * 60),
      is_high_risk: Boolean(ex.isHighRisk),
    }));

    const rpcPayload: Record<string, any> = {
      p_school_id: params.schoolId,
      p_menu_item_ids: params.menuItemIds,
      p_ompreng_count: params.omprengCount,
      p_input_mode: mapFrontendToDbInputMode(params.inputMode),
      p_sample_photo_path: params.samplePhotoPath || null,
      p_extra_items: extraPayload,
      p_ai_detected_weakest_minutes: params.aiDetectedWeakestMinutes ?? null,
    };

    const { data, error } = await supabase.rpc('seal_production_batch', rpcPayload);

    if (error) {
      // Fallback to 6-arg (010/011) if 012 hasn't been executed yet
      if (
        error.message.includes('schema cache') ||
        error.message.includes('p_ai_detected_weakest_minutes') ||
        error.message.includes('p_extra_items')
      ) {
        if (error.message.includes('p_ai_detected_weakest_minutes')) {
          const { data: v11Data, error: v11Err } = await supabase.rpc('seal_production_batch', {
            p_school_id: params.schoolId,
            p_menu_item_ids: params.menuItemIds,
            p_ompreng_count: params.omprengCount,
            p_input_mode: mapFrontendToDbInputMode(params.inputMode),
            p_sample_photo_path: params.samplePhotoPath || null,
            p_extra_items: extraPayload,
          });
          if (!v11Err) return v11Data;
        }

        const createdIds = [...params.menuItemIds];
        for (const ex of params.extraItems || []) {
          try {
            const tier =
              ex.holdingHours <= 3.5
                ? 'santan_kuah_tinggi'
                : ex.holdingHours <= 4.0
                  ? 'tumis_kuah'
                  : ex.holdingHours >= 6.0
                    ? 'buah_utuh'
                    : ex.holdingHours >= 5.0
                      ? 'lauk_kering'
                      : 'kering_goreng';
            const fallbackCat = ['karbohidrat', 'protein', 'sayur', 'buah'].includes(ex.category)
              ? ex.category
              : ex.category === 'susu_minuman'
                ? 'buah'
                : 'sayur';
            const saved = await this.upsertMenuItem('', ex.name, fallbackCat, tier, true);
            if (saved?.item?.id) createdIds.push(saved.item.id);
          } catch {}
        }
        const { data: legacyData, error: legacyErr } = await supabase.rpc('seal_production_batch', {
          p_school_id: params.schoolId,
          p_menu_item_ids: createdIds,
          p_ompreng_count: params.omprengCount,
          p_input_mode: mapFrontendToDbInputMode(params.inputMode),
          p_sample_photo_path: params.samplePhotoPath || null,
        });
        if (legacyErr) throw new Error(legacyErr.message);
        return legacyData;
      }
      throw new Error(error.message);
    }
    return data;
  },

  /**
   * Resolves a batch_code ('MBG-...') to its PostgreSQL UUID.
   */
  async resolveBatchUuid(batchIdOrCode: string): Promise<string> {
    if (batchIdOrCode.includes('-') && batchIdOrCode.length === 36) {
      return batchIdOrCode;
    }
    const { data } = await supabase
      .from('production_batches')
      .select('id')
      .ilike('batch_code', batchIdOrCode.trim())
      .limit(1)
      .maybeSingle();

    return data?.id || batchIdOrCode;
  },

  async confirmOmprengReceipt(
    batchId: string,
    receivedCount?: number,
    discrepancyNote?: string,
    verificationMethod?: 'qr_scan' | 'manual_code',
    manualReason?: string
  ): Promise<void> {
    const targetUuid = await this.resolveBatchUuid(batchId);
    const { error } = await supabase.rpc('confirm_ompreng_receipt', {
      p_batch_id: targetUuid,
      p_received_count: receivedCount ?? null,
      p_discrepancy_note: discrepancyNote || null,
      p_verification_method: verificationMethod || null,
      p_manual_reason: manualReason || null,
    });

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('function')) {
        const { error: v6Err } = await supabase.rpc('confirm_ompreng_receipt', {
          p_batch_id: targetUuid,
          p_received_count: receivedCount ?? null,
          p_discrepancy_note: discrepancyNote || null,
        });
        if (!v6Err) return;
        const { error: fallbackErr } = await supabase.rpc('confirm_ompreng_receipt', {
          p_batch_id: targetUuid,
        });
        if (!fallbackErr) return;
      }
      throw new Error(error.message);
    }
  },

  async confirmOmprengReturn(batchId: string): Promise<void> {
    const targetUuid = await this.resolveBatchUuid(batchId);
    const { error } = await supabase.rpc('confirm_ompreng_return', {
      p_batch_id: targetUuid,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async rejectBatchSpoiled(batchId: string, reason: string, photoPath?: string): Promise<void> {
    const targetUuid = await this.resolveBatchUuid(batchId);
    const { error } = await supabase.rpc('reject_batch_spoiled', {
      p_batch_id: targetUuid,
      p_reason: reason,
      p_photo_path: photoPath || null,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async markOmprengReadyForPickup(batchId: string): Promise<void> {
    const targetUuid = await this.resolveBatchUuid(batchId);
    const { error } = await supabase.rpc('mark_ompreng_ready_for_pickup', {
      p_batch_id: targetUuid,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async voidProductionBatch(batchId: string, reason: string): Promise<void> {
    const targetUuid = await this.resolveBatchUuid(batchId);
    const { error } = await supabase.rpc('void_production_batch', {
      p_batch_id: targetUuid,
      p_reason: reason,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Fetches active/all menu catalog items from PostgreSQL (BGN global + caller's SPPG custom items).
   */
  async fetchMenuCatalog(): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from('menu_catalog')
      .select('id, name, category, holding_time_minutes, is_high_risk_wet, is_active, kitchen_id, is_system_default')
      .order('is_system_default', { ascending: false })
      .order('category')
      .order('name');

    if (error) {
      // Legacy fallback before 007 columns exist
      const { data: legacyData, error: legacyErr } = await supabase
        .from('menu_catalog')
        .select('id, name, category, holding_time_minutes, is_high_risk_wet, is_active')
        .order('category')
        .order('name');

      if (legacyErr || !legacyData || legacyData.length === 0) {
        return MENU_CATALOG.map((m) => ({ ...m, isActive: true, isSystemDefault: true }));
      }

      return legacyData.map((row) => {
        const mins = Number(row.holding_time_minutes) || 270;
        return {
          id: row.id,
          name: row.name,
          category: row.category,
          holdingHours: mins / 60,
          riskLabel: getRiskLabelFromMinutes(mins),
          isHighRisk: Boolean(row.is_high_risk_wet),
          isActive: row.is_active !== false,
          isSystemDefault: true,
        };
      });
    }

    if (!data || data.length === 0) {
      return MENU_CATALOG.map((m) => ({ ...m, isActive: true, isSystemDefault: true }));
    }

    return data.map((row: any) => {
      const mins = Number(row.holding_time_minutes) || 270;
      return {
        id: row.id,
        name: row.name,
        category: row.category,
        holdingHours: mins / 60,
        riskLabel: getRiskLabelFromMinutes(mins),
        isHighRisk: Boolean(row.is_high_risk_wet),
        isActive: row.is_active !== false,
        kitchenId: row.kitchen_id || null,
        isSystemDefault: row.is_system_default ?? !row.kitchen_id,
      };
    });
  },

  async upsertMenuItem(
    id: string,
    name: string,
    category: string,
    riskTier: string,
    isActive: boolean = true
  ): Promise<{ item?: MenuItem; raw?: any }> {
    const mapRow = (row: any): MenuItem => {
      const mins = Number(row.holding_time_minutes) || 270;
      return {
        id: row.id,
        name: row.name,
        category: row.category,
        holdingHours: mins / 60,
        riskLabel: getRiskLabelFromMinutes(mins),
        isHighRisk: Boolean(row.is_high_risk_wet),
        isActive: row.is_active !== false,
        kitchenId: row.kitchen_id || null,
        isSystemDefault: row.is_system_default ?? !row.kitchen_id,
      };
    };

    const { data, error } = await supabase.rpc('upsert_menu_item', {
      p_id: id,
      p_name: name,
      p_category: category,
      p_risk_tier: riskTier,
      p_is_active: isActive,
    });

    if (error) {
      // Fallback for 4-arg legacy signature before 006 runs
      if (error.message.includes('schema cache') || error.message.includes('function')) {
        const { data: d2, error: e2 } = await supabase.rpc('upsert_menu_item', {
          p_id: id,
          p_name: name,
          p_category: category,
          p_risk_tier: riskTier,
        });
        if (!e2) return { item: d2?.item ? mapRow(d2.item) : undefined, raw: d2 };
      }
      throw new Error(error.message);
    }
    return { item: data?.item ? mapRow(data.item) : undefined, raw: data };
  },

  async checkRegistrationInstitution(
    role: UserRole,
    code: string
  ): Promise<{ valid: boolean; institutionName?: string; reason?: string }> {
    const { data, error } = await supabase.rpc('check_registration_institution', {
      p_role: role,
      p_code: code.trim(),
    });

    if (error) {
      // Graceful fallback if 007 RPC is not deployed yet
      if (error.message.includes('schema cache') || error.message.includes('function')) {
        return { valid: true };
      }
      return { valid: false, reason: error.message };
    }

    return {
      valid: Boolean(data?.valid),
      institutionName: data?.institution_name || undefined,
      reason: data?.reason || undefined,
    };
  },

  async completeUserRegistration(params: {
    role: UserRole;
    fullName: string;
    phoneWa: string;
    kitchenCode?: string;
    schoolNpsn?: string;
    userId?: string;
  }): Promise<any> {
    const { data, error } = await supabase.rpc('complete_user_registration', {
      p_role: params.role,
      p_full_name: params.fullName,
      p_phone_wa: params.phoneWa,
      p_kitchen_code: params.kitchenCode || null,
      p_school_npsn: params.schoolNpsn || null,
      p_user_id: params.userId || null,
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  },

  async submitMaggotReport(params: {
    batchId: string;
    category: WasteCategory;
    volumePresetId: string;
    estimatedKg: number;
    notes?: string;
  }): Promise<any> {
    const targetUuid = await this.resolveBatchUuid(params.batchId);
    const { data, error } = await supabase.rpc('submit_maggot_report', {
      p_batch_id: targetUuid,
      p_waste_category: mapFrontendToDbWasteCategory(params.category),
      p_volume_tier: params.volumePresetId,
      p_estimated_kg: params.estimatedKg,
      p_notes: params.notes || null,
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  },

  async assignMaggotPartner(reportId: string, partnerName?: string): Promise<any> {
    const { data, error } = await supabase.rpc('assign_maggot_partner', {
      p_report_id: reportId,
      p_partner_name: partnerName || 'Mitra BSF Maggot Jaya',
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  },

  /**
   * Uploads live photo cleanly to private Supabase Storage bucket 'sample-photos'
   * using RLS-compliant folder prefixes (${kitchenId}/... or rejections/${schoolId}/...)
   * and returns the canonical storage object path (resolved to signed URLs on read).
   */
  async uploadSamplePhoto(
    localUri: string,
    ownerUnitId: string,
    kind: 'sample' | 'rejection' = 'sample'
  ): Promise<string> {
    try {
      if (!localUri) return '';
      if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
        // Keep external specimen fallback URL or extract object path if already in sample-photos
        const existingObj = extractSampleStoragePath(localUri);
        return existingObj || localUri;
      }

      if (!ownerUnitId) {
        throw new Error('ID unit SPPG/Sekolah tidak ditemukan untuk unggah bukti foto.');
      }

      let binaryBody: ArrayBuffer;
      if (Platform.OS === 'web' || localUri.startsWith('blob:') || localUri.startsWith('data:')) {
        const resp = await fetch(localUri);
        binaryBody = await resp.arrayBuffer();
      } else {
        const base64 = await new File(localUri).base64();
        binaryBody = decode(base64);
      }

      const objectPath =
        kind === 'rejection'
          ? `rejections/${ownerUnitId}/${Date.now()}-rejection.jpg`
          : `${ownerUnitId}/${Date.now()}-sample.jpg`;

      const { data, error } = await supabase.storage
        .from('sample-photos')
        .upload(objectPath, binaryBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;
      return data.path;
    } catch (e: any) {
      console.warn('[supabaseRepository] uploadSamplePhoto error:', e?.message || e);
      throw new Error(e?.message || 'Gagal mengunggah foto ke penyimpanan aman SajiAman.');
    }
  },

  /**
   * Fetches active schools strictly assigned to the caller's kitchen.
   */
  async fetchSchools(kitchenId?: string): Promise<SchoolProfile[]> {
    let query = supabase
      .from('schools')
      .select('id, npsn, name, address, pic_name, phone_wa, default_portions, assigned_kitchen_id, is_active')
      .eq('is_active', true)
      .order('name');

    if (kitchenId) {
      query = query.eq('assigned_kitchen_id', kitchenId);
    }

    const { data, error } = await query;

    if (error) {
      // Fallback if 006/009 columns aren't migrated yet
      const { data: legacyData, error: legacyErr } = await supabase
        .from('schools')
        .select('id, npsn, name, address, assigned_kitchen_id')
        .order('name');

      if (legacyErr || !legacyData) return [];

      return legacyData
        .filter((s) => !kitchenId || s.assigned_kitchen_id === kitchenId)
        .map((s, idx) => ({
          id: s.id,
          npsn: s.npsn || undefined,
          name: s.name,
          address: s.address || undefined,
          picName: `Koordinator ${s.name}`,
          email: s.npsn ? `korlap.${s.npsn}@sekolah-mbg.id` : 'korlap@sekolah-mbg.id',
          defaultPortions: idx === 0 ? 150 : idx === 1 ? 120 : idx === 2 ? 90 : 100,
        }));
    }

    return (data || []).map((s: any, idx: number) => ({
      id: s.id,
      npsn: s.npsn || undefined,
      name: s.name,
      address: s.address || undefined,
      picName: s.pic_name || `Koordinator ${s.name}`,
      phoneWa: s.phone_wa || undefined,
      email: s.npsn ? `korlap.${s.npsn}@sekolah-mbg.id` : 'korlap@sekolah-mbg.id',
      defaultPortions: Number(s.default_portions) || (idx === 0 ? 150 : 100),
    }));
  },

  /**
   * Registers or updates a partner school bound to the caller's kitchen.
   */
  async saveSchool(params: {
    id?: string;
    kitchenId: string;
    name: string;
    npsn?: string;
    address?: string;
    picName?: string;
    phoneWa?: string;
    defaultPortions?: number;
  }): Promise<any> {
    const { data, error } = await supabase.rpc('manage_school', {
      p_school_id: params.id || null,
      p_name: params.name,
      p_npsn: params.npsn || null,
      p_address: params.address || null,
      p_pic_name: params.picName || null,
      p_phone_wa: params.phoneWa || null,
      p_default_portions: params.defaultPortions ?? 100,
    });

    if (error) {
      // Fallback for pre-006 direct insert scoped by kitchenId
      if (error.message.includes('schema cache') || error.message.includes('function')) {
        const { data: inserted, error: insertErr } = await supabase
          .from('schools')
          .insert({
            name: params.name,
            npsn: params.npsn || null,
            address: params.address || 'Kota Semarang',
            assigned_kitchen_id: params.kitchenId,
          })
          .select()
          .single();
        if (insertErr) throw new Error(insertErr.message);
        return { school: inserted };
      }
      throw new Error(error.message);
    }
    return data;
  },

  /**
   * Fetches actual kitchen profile strictly for the logged-in chef's kitchen_id.
   */
  async fetchKitchenProfile(profile?: ActiveUserProfile | null): Promise<KitchenProfile | null> {
    if (!profile?.kitchenId) return null;

    const { data, error } = await supabase
      .from('kitchens')
      .select('*')
      .eq('id', profile.kitchenId)
      .single();

    if (error || !data) {
      return {
        id: profile.kitchenId,
        code: profile.kitchenCode || 'SPPG',
        name: profile.kitchenName || 'Dapur SPPG',
        picName: profile.fullName,
        email: profile.email,
        totalOmprengInventory: 600,
        partnerBsfName: 'Mitra BSF (Maggot Jaya)',
      };
    }

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      picName: profile.fullName,
      email: profile.email,
      totalOmprengInventory: Number(data.total_ompreng_inventory) || 600,
      partnerBsfName: 'Mitra BSF (Maggot Jaya)',
    };
  },

  /**
   * Updates kitchen total ompreng inventory strictly for the caller's kitchen.
   */
  async updateKitchenInventory(inventoryCount: number, kitchenId?: string): Promise<void> {
    const { error } = await supabase.rpc('update_kitchen_inventory', {
      p_inventory_count: inventoryCount,
    });

    if (error) {
      if ((error.message.includes('schema cache') || error.message.includes('function')) && kitchenId) {
        const { error: directErr } = await supabase
          .from('kitchens')
          .update({ total_ompreng_inventory: inventoryCount })
          .eq('id', kitchenId);
        if (!directErr) return;
      }
      throw new Error(error.message);
    }
  },

  /**
   * Fetches national overview snapshot strictly for Admin BGN role.
   */
  async fetchAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
    const { data, error } = await supabase.rpc('admin_get_dashboard_snapshot');
    if (error) {
      throw new Error(error.message);
    }
    return {
      kitchens: Array.isArray(data?.kitchens) ? data.kitchens : [],
      schools: Array.isArray(data?.schools) ? data.schools : [],
      users: Array.isArray(data?.users) ? data.users : [],
      metrics: {
        total_kitchens: Number(data?.metrics?.total_kitchens || 0),
        total_schools: Number(data?.metrics?.total_schools || 0),
        total_users: Number(data?.metrics?.total_users || 0),
        orphan_users: Number(data?.metrics?.orphan_users || 0),
        total_batches: Number(data?.metrics?.total_batches || 0),
        active_batches: Number(data?.metrics?.active_batches || 0),
        rejected_batches: Number(data?.metrics?.rejected_batches || 0),
        voided_batches: Number(data?.metrics?.voided_batches || 0),
        total_maggot_kg: Number(data?.metrics?.total_maggot_kg || 0),
      },
    };
  },

  async adminManageKitchen(params: {
    kitchenId?: string;
    code?: string;
    name?: string;
    address?: string;
    inventory?: number;
  }): Promise<any> {
    const { data, error } = await supabase.rpc('admin_manage_kitchen', {
      p_kitchen_id: params.kitchenId || null,
      p_code: params.code || null,
      p_name: params.name || null,
      p_address: params.address || null,
      p_inventory: params.inventory ?? 600,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminManageSchool(params: {
    schoolId?: string;
    kitchenId?: string;
    name?: string;
    npsn?: string;
    address?: string;
    picName?: string;
    phoneWa?: string;
    defaultPortions?: number;
  }): Promise<any> {
    const { data, error } = await supabase.rpc('admin_manage_school', {
      p_school_id: params.schoolId || null,
      p_kitchen_id: params.kitchenId || null,
      p_name: params.name || null,
      p_npsn: params.npsn || null,
      p_address: params.address || null,
      p_pic_name: params.picName || null,
      p_phone_wa: params.phoneWa || null,
      p_default_portions: params.defaultPortions ?? 100,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminReassignUserProfile(params: {
    userId: string;
    role: UserRole;
    fullName: string;
    phoneWa?: string;
    kitchenId?: string | null;
    schoolId?: string | null;
  }): Promise<any> {
    const { data, error } = await supabase.rpc('admin_reassign_user_profile', {
      p_user_id: params.userId,
      p_role: params.role,
      p_full_name: params.fullName,
      p_phone_wa: params.phoneWa || null,
      p_kitchen_id: params.role === 'kitchen' ? params.kitchenId || null : null,
      p_school_id: params.role === 'school' ? params.schoolId || null : null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminToggleKitchenActive(kitchenId: string, isActive: boolean): Promise<any> {
    const { data, error } = await supabase.rpc('admin_toggle_kitchen_active', {
      p_kitchen_id: kitchenId,
      p_is_active: isActive,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminToggleSchoolActive(schoolId: string, isActive: boolean): Promise<any> {
    const { data, error } = await supabase.rpc('admin_toggle_school_active', {
      p_school_id: schoolId,
      p_is_active: isActive,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminToggleUserActive(userId: string, isActive: boolean): Promise<any> {
    const { data, error } = await supabase.rpc('admin_toggle_user_active', {
      p_user_id: userId,
      p_is_active: isActive,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Sets up unit-scoped Realtime WebSocket subscriptions (or national feed for Admin).
   */
  subscribeToRealtimeChanges(
    profile: ActiveUserProfile,
    onBatchChange: (event?: any) => void,
    onMaggotChange: (event?: any) => void,
    onNotificationChange?: (event?: any) => void,
    onStatusChange?: (status: RealtimeConnectionState) => void
  ): () => void {
    const isAdmin = profile.role === 'admin';
    const filterCol = profile.role === 'kitchen' ? 'kitchen_id' : 'school_id';
    const filterVal = profile.role === 'kitchen' ? profile.kitchenId : profile.schoolId;

    if (!isAdmin && !filterVal) {
      return () => {};
    }

    const filterOpt = isAdmin ? undefined : `${filterCol}=eq.${filterVal}`;
    const channelName = isAdmin
      ? `sajiaman_sync_admin_${profile.id}`
      : `sajiaman_sync_${profile.role}_${filterVal}`;

    const batchFilter = filterOpt
      ? { event: '*' as const, schema: 'public', table: 'production_batches', filter: filterOpt }
      : { event: '*' as const, schema: 'public', table: 'production_batches' };
    const maggotFilter = filterOpt
      ? { event: '*' as const, schema: 'public', table: 'maggot_pickup_reports', filter: filterOpt }
      : { event: '*' as const, schema: 'public', table: 'maggot_pickup_reports' };
    const notifFilter = filterOpt
      ? { event: '*' as const, schema: 'public', table: 'notifications', filter: filterOpt }
      : { event: '*' as const, schema: 'public', table: 'notifications' };

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', batchFilter, (payload) => onBatchChange(payload))
      .on('postgres_changes', maggotFilter, (payload) => onMaggotChange(payload))
      .on('postgres_changes', notifFilter, (payload) => {
        if (onNotificationChange) onNotificationChange(payload);
      })
      .subscribe((status) => {
        if (!onStatusChange) return;
        if (status === 'SUBSCRIBED') {
          onStatusChange('SUBSCRIBED');
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          onStatusChange('OFFLINE');
        } else {
          onStatusChange('CONNECTING');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
