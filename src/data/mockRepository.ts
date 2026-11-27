/**
 * SajiAman Async Data Repository (Mock / Local Persistence)
 * // TODO(expo-migration): Swap methods in this file with `@supabase/supabase-js`
 * // PostgreSQL queries & RPC calls. Domain types remain identical.
 */

import { TRAY_PHOTOS } from '../adapters/cameraAdapter';
import { storageAdapter } from '../adapters/storageAdapter';
import { formatWibTime, MS_PER_HOUR } from '../domain/weakestLinkEngine';
import type {
  BatchRecord,
  KitchenProfile,
  MaggotReport,
  MenuItem,
  SajiAmanStateSnapshot,
  SchoolProfile,
  WasteVolumePreset,
} from '../types/sajiaman';

const STATE_STORAGE_KEY = 'repository_state';

/**
 * Deterministic morning WIB anchor: 24 Nov 2026, 07:30:00 WIB (00:30:00 UTC).
 */
export const DEFAULT_MORNING_ANCHOR_MS = Date.UTC(2026, 10, 24, 0, 30, 0);

export const KITCHEN_PROFILE: KitchenProfile = {
  id: 'sppg-smg-01',
  code: 'SPPG-SRG-01',
  name: 'SPPG Semarang Tengah',
  picName: 'Chef Hendra',
  email: 'chef.semarang01@sppg-mbg.id',
  totalOmprengInventory: 600,
  partnerBsfName: 'Mitra BSF (Maggot Jaya)',
};

export const SCHOOLS: SchoolProfile[] = [
  {
    id: 'sdn-01-pendrikan',
    name: 'SDN 01 Pendrikan',
    picName: 'Bu Sari',
    email: 'korlap.pendrikan01@sekolah-mbg.id',
    defaultPortions: 150,
  },
  {
    id: 'smpn-03-semarang',
    name: 'SMPN 03 Semarang',
    picName: 'Pak Bambang',
    email: 'korlap.smpn03@sekolah-mbg.id',
    defaultPortions: 120,
  },
  {
    id: 'sdn-04-miroto',
    name: 'SDN 04 Miroto',
    picName: 'Bu Ratna',
    email: 'korlap.miroto04@sekolah-mbg.id',
    defaultPortions: 90,
  },
  {
    id: 'mi-al-hikmah',
    name: 'MI Al-Hikmah',
    picName: 'Ustadz Arif',
    email: 'korlap.alhikmah@sekolah-mbg.id',
    defaultPortions: 110,
  },
];

export const MENU_CATALOG: MenuItem[] = [
  // Karbohidrat
  {
    id: 'nasi-putih',
    name: 'Nasi Putih',
    category: 'karbohidrat',
    holdingHours: 4.5,
    riskLabel: 'Menu Kering',
    isHighRisk: false,
  },
  {
    id: 'nasi-uduk-santan',
    name: 'Nasi Uduk Santan',
    category: 'karbohidrat',
    holdingHours: 3.5,
    riskLabel: 'Santan',
    isHighRisk: true,
  },
  {
    id: 'kentang-rebus',
    name: 'Kentang Rebus',
    category: 'karbohidrat',
    holdingHours: 4.5,
    riskLabel: 'Menu Kering',
    isHighRisk: false,
  },

  // Protein
  {
    id: 'ayam-goreng',
    name: 'Ayam Goreng Kering',
    category: 'protein',
    holdingHours: 5.0,
    riskLabel: 'Menu Kering',
    isHighRisk: false,
  },
  {
    id: 'telur-balado',
    name: 'Telur Balado',
    category: 'protein',
    holdingHours: 4.5,
    riskLabel: 'Bumbu Kering',
    isHighRisk: false,
  },
  {
    id: 'gulai-ayam-santan',
    name: 'Gulai Ayam Santan',
    category: 'protein',
    holdingHours: 3.5,
    riskLabel: 'Berkuah/Santan',
    isHighRisk: true,
  },
  {
    id: 'ikan-kuah-kuning',
    name: 'Ikan Kuah Kuning',
    category: 'protein',
    holdingHours: 3.5,
    riskLabel: 'Berkuah',
    isHighRisk: true,
  },
  {
    id: 'tempe-orek',
    name: 'Tempe Orek Kering',
    category: 'protein',
    holdingHours: 5.0,
    riskLabel: 'Menu Kering',
    isHighRisk: false,
  },

  // Sayur
  {
    id: 'tumis-buncis',
    name: 'Tumis Buncis Kering',
    category: 'sayur',
    holdingHours: 4.5,
    riskLabel: 'Menu Kering',
    isHighRisk: false,
  },
  {
    id: 'capcay-kuah',
    name: 'Capcay Kuah',
    category: 'sayur',
    holdingHours: 4.0,
    riskLabel: 'Sayur Kuah',
    isHighRisk: false,
  },
  {
    id: 'sayur-lodeh',
    name: 'Sayur Lodeh Santan',
    category: 'sayur',
    holdingHours: 3.5,
    riskLabel: 'Berkuah/Santan',
    isHighRisk: true,
  },
  {
    id: 'sop-wortel-bakso',
    name: 'Sop Wortel Bakso',
    category: 'sayur',
    holdingHours: 3.5,
    riskLabel: 'Berkuah',
    isHighRisk: true,
  },

  // Buah
  {
    id: 'pisang-ambon',
    name: 'Pisang Ambon',
    category: 'buah',
    holdingHours: 6.0,
    riskLabel: 'Buah Utuh',
    isHighRisk: false,
  },
  {
    id: 'jeruk-medan',
    name: 'Jeruk Medan',
    category: 'buah',
    holdingHours: 6.0,
    riskLabel: 'Buah Utuh',
    isHighRisk: false,
  },
  {
    id: 'potongan-melon',
    name: 'Potongan Melon',
    category: 'buah',
    holdingHours: 3.5,
    riskLabel: 'Buah Potong',
    isHighRisk: true,
  },

  // Tambahan Lauk, Lalapan, Susu & Pelengkap MBG
  {
    id: 'telur-ceplok-dadar',
    name: 'Telur Ceplok / Dadar',
    category: 'protein',
    holdingHours: 4.5,
    riskLabel: 'Menu Kering',
    isHighRisk: false,
  },
  {
    id: 'lalapan-timun-selada',
    name: 'Lalapan Timun & Selada',
    category: 'sayur',
    holdingHours: 4.5,
    riskLabel: 'Lalapan Segar',
    isHighRisk: false,
  },
  {
    id: 'susu-kotak-uht',
    name: 'Susu Kotak UHT',
    category: 'susu_minuman',
    holdingHours: 6.0,
    riskLabel: 'Kemasan UHT',
    isHighRisk: false,
  },
  {
    id: 'air-mineral-gelas',
    name: 'Air Mineral / Minuman',
    category: 'susu_minuman',
    holdingHours: 6.0,
    riskLabel: 'Minuman Kemasan',
    isHighRisk: false,
  },
  {
    id: 'sambal-segar',
    name: 'Sambal / Saus Pelengkap',
    category: 'sambal_pelengkap',
    holdingHours: 3.5,
    riskLabel: 'Basah / Cepat Basi',
    isHighRisk: true,
  },
  {
    id: 'kerupuk-pelengkap',
    name: 'Kerupuk / Pelengkap Kering',
    category: 'sambal_pelengkap',
    holdingHours: 5.0,
    riskLabel: 'Pelengkap Kering',
    isHighRisk: false,
  },
];

export const WASTE_VOLUME_PRESETS: WasteVolumePreset[] = [
  {
    id: 'ringan',
    title: 'Ringan',
    unitLabel: '½ Ember • ~1,5 kg',
    estimatedKg: 1.5,
    bucketEstimate: '½ Ember',
  },
  {
    id: 'sedang',
    title: 'Sedang',
    unitLabel: '1 Ember • ~3,5 kg',
    estimatedKg: 3.5,
    bucketEstimate: '1 Ember',
  },
  {
    id: 'banyak',
    title: 'Banyak',
    unitLabel: '2 Ember • ~7,5 kg',
    estimatedKg: 7.5,
    bucketEstimate: '2 Ember',
  },
  {
    id: 'surplus_penuh',
    title: 'Surplus Penuh',
    unitLabel: '1 Boks • ~15 kg',
    estimatedKg: 15,
    bucketEstimate: '1 Boks Penuh',
  },
];

function getMenuItems(ids: string[]): MenuItem[] {
  return ids
    .map((id) => MENU_CATALOG.find((item) => item.id === id))
    .filter((item): item is MenuItem => Boolean(item));
}

export function createSeedSnapshot(anchorMs = DEFAULT_MORNING_ANCHOR_MS): SajiAmanStateSnapshot {
  return {
    batches: [],
    maggotReports: [],
    notifications: [],
    plasticsSavedBaseline: 0,
    organicKgBaseline: 0,
    baseReferenceTimeMs: anchorMs,
  };
}

export const sajiamanRepository = {
  async loadState(): Promise<SajiAmanStateSnapshot> {
    const stored = await storageAdapter.getItem<SajiAmanStateSnapshot>(STATE_STORAGE_KEY);
    if (stored && Array.isArray(stored.batches) && stored.batches.length > 0) {
      return stored;
    }
    const fresh = createSeedSnapshot();
    await storageAdapter.setItem(STATE_STORAGE_KEY, fresh);
    return fresh;
  },

  async saveState(snapshot: SajiAmanStateSnapshot): Promise<void> {
    await storageAdapter.setItem(STATE_STORAGE_KEY, snapshot);
  },

  async resetDemoState(): Promise<SajiAmanStateSnapshot> {
    const fresh = createSeedSnapshot();
    await storageAdapter.setItem(STATE_STORAGE_KEY, fresh);
    return fresh;
  },
};
