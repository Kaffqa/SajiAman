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
  // Batch 1: HIJAU (Menu kering 4,5j, ~2 jam 15 menit tersisa)
  const greenExpires = anchorMs + 2 * MS_PER_HOUR + 15 * 60 * 1000;
  const greenCooked = greenExpires - 4.5 * MS_PER_HOUR;

  // Batch 2: KUNING (Capcay kuah 4,0j, ~28 menit tersisa < 45 menit)
  const yellowExpires = anchorMs + 28 * 60 * 1000;
  const yellowCooked = yellowExpires - 4.0 * MS_PER_HOUR;

  // Batch 3: MERAH (Sayur Lodeh Santan 3,5j, sudah lewat 20 menit -> KEDALUWARSA)
  const redExpires = anchorMs - 20 * 60 * 1000;
  const redCooked = redExpires - 3.5 * MS_PER_HOUR;

  // Batch 4: Returned sterilized earlier shift
  const returnedCooked = anchorMs - 3.0 * MS_PER_HOUR;
  const returnedExpires = returnedCooked + 5.0 * MS_PER_HOUR;

  const batches: BatchRecord[] = [
    {
      id: 'MBG-2411-G01',
      kitchenId: KITCHEN_PROFILE.id,
      kitchenName: KITCHEN_PROFILE.name,
      schoolId: 'sdn-01-pendrikan',
      schoolName: 'SDN 01 Pendrikan',
      boxNumber: 'Boks #04',
      items: getMenuItems(['nasi-putih', 'ayam-goreng', 'tumis-buncis', 'pisang-ambon']),
      weakestLinkItemId: 'nasi-putih',
      weakestLinkItemName: 'Nasi Putih',
      weakestLinkRiskLabel: 'Menu Kering',
      holdingHours: 4.5,
      cookedAt: greenCooked,
      expiresAt: greenExpires,
      arrivedAt: greenCooked + 55 * 60 * 1000,
      kitchenTempC: 68,
      omprengCount: 150,
      omprengStatus: 'dispatched',
      inputMode: 'ai_camera',
      samplePhotoUrl: TRAY_PHOTOS.lodehSet,
      samplePhotoTimestamp: `SPPG SMG • ${formatWibTime(greenCooked, true)} • VERIFIED`,
      aiVerifiedNutrition: {
        karbohidrat: true,
        protein: true,
        sayur: true,
        buah: true,
      },
    },
    {
      id: 'MBG-2411-Y02',
      kitchenId: KITCHEN_PROFILE.id,
      kitchenName: KITCHEN_PROFILE.name,
      schoolId: 'smpn-03-semarang',
      schoolName: 'SMPN 03 Semarang',
      boxNumber: 'Boks #02',
      items: getMenuItems(['nasi-putih', 'telur-balado', 'capcay-kuah', 'jeruk-medan']),
      weakestLinkItemId: 'capcay-kuah',
      weakestLinkItemName: 'Capcay Kuah',
      weakestLinkRiskLabel: 'Sayur Kuah',
      holdingHours: 4.0,
      cookedAt: yellowCooked,
      expiresAt: yellowExpires,
      arrivedAt: yellowCooked + 60 * 60 * 1000,
      kitchenTempC: 67,
      omprengCount: 120,
      omprengReceivedCount: 120,
      omprengStatus: 'received_school',
      omprengConfirmedBy: 'Pak Bambang',
      omprengConfirmedAt: yellowCooked + 72 * 60 * 1000,
      inputMode: 'ai_camera',
      samplePhotoUrl: TRAY_PHOTOS.sotoSet,
      samplePhotoTimestamp: `SPPG SMG • ${formatWibTime(yellowCooked, true)} • VERIFIED`,
      aiVerifiedNutrition: {
        karbohidrat: true,
        protein: true,
        sayur: true,
        buah: true,
      },
    },
    {
      id: 'MBG-2411-R03',
      kitchenId: KITCHEN_PROFILE.id,
      kitchenName: KITCHEN_PROFILE.name,
      schoolId: 'sdn-04-miroto',
      schoolName: 'SDN 04 Miroto',
      boxNumber: 'Boks #01',
      items: getMenuItems(['nasi-putih', 'gulai-ayam-santan', 'sayur-lodeh', 'pisang-ambon']),
      weakestLinkItemId: 'sayur-lodeh',
      weakestLinkItemName: 'Sayur Lodeh Santan',
      weakestLinkRiskLabel: 'Berkuah/Santan',
      holdingHours: 3.5,
      cookedAt: redCooked,
      expiresAt: redExpires,
      arrivedAt: redCooked + 58 * 60 * 1000,
      kitchenTempC: 66,
      omprengCount: 90,
      omprengReceivedCount: 90,
      omprengStatus: 'received_school',
      omprengConfirmedBy: 'Bu Ratna',
      omprengConfirmedAt: redCooked + 65 * 60 * 1000,
      inputMode: 'manual',
    },
    {
      id: 'MBG-2411-K00',
      kitchenId: KITCHEN_PROFILE.id,
      kitchenName: KITCHEN_PROFILE.name,
      schoolId: 'mi-al-hikmah',
      schoolName: 'MI Al-Hikmah',
      boxNumber: 'Boks #00',
      items: getMenuItems(['nasi-putih', 'tempe-orek', 'tumis-buncis', 'jeruk-medan']),
      weakestLinkItemId: 'nasi-putih',
      weakestLinkItemName: 'Nasi Putih',
      weakestLinkRiskLabel: 'Menu Kering',
      holdingHours: 4.5,
      cookedAt: returnedCooked,
      expiresAt: returnedExpires,
      arrivedAt: returnedCooked + 40 * 60 * 1000,
      kitchenTempC: 69,
      omprengCount: 110,
      omprengReceivedCount: 110,
      omprengStatus: 'returned_sterilized',
      omprengConfirmedBy: 'Ustadz Arif',
      omprengConfirmedAt: returnedCooked + 50 * 60 * 1000,
      omprengReturnedAt: anchorMs - 25 * 60 * 1000,
      inputMode: 'manual',
    },
  ];

  const maggotReports: MaggotReport[] = [
    {
      id: 'MGT-2411-01',
      batchId: 'MBG-2411-Y02',
      schoolId: 'smpn-03-semarang',
      schoolName: 'SMPN 03 Semarang',
      boxNumber: 'Boks #02',
      category: 'post_meal',
      volumePresetId: 'sedang',
      volumeLabel: '1 Ember • ~3,5 kg',
      estimatedKg: 3.5,
      locationNote: 'Ember tertutup di samping pos satpam gerbang utara',
      reportedBy: 'Pak Bambang',
      reportedAt: anchorMs - 14 * 60 * 1000,
      status: 'pending_pickup',
    },
    {
      id: 'MGT-2411-00',
      batchId: 'MBG-2411-K00',
      schoolId: 'mi-al-hikmah',
      schoolName: 'MI Al-Hikmah',
      boxNumber: 'Boks #00',
      category: 'post_meal',
      volumePresetId: 'ringan',
      volumeLabel: '½ Ember • ~1,5 kg',
      estimatedKg: 1.5,
      locationNote: 'Area kantin belakang',
      reportedBy: 'Ustadz Arif',
      reportedAt: anchorMs - 45 * 60 * 1000,
      status: 'dispatched_bsf',
      assignedPartner: KITCHEN_PROFILE.partnerBsfName,
      dispatchedAt: anchorMs - 30 * 60 * 1000,
    },
  ];

  return {
    batches,
    maggotReports,
    plasticsSavedBaseline: 1850,
    organicKgBaseline: 37.5, // + 5.0 kg from seeded reports = 42,5 kg
    baseReferenceTimeMs: anchorMs,
  };
}

export const sajiamanRepository = {
  async loadState(): Promise<SajiAmanStateSnapshot> {
    const stored = storageAdapter.getItem<SajiAmanStateSnapshot>(STATE_STORAGE_KEY);
    if (stored && Array.isArray(stored.batches) && stored.batches.length > 0) {
      return stored;
    }
    const fresh = createSeedSnapshot();
    storageAdapter.setItem(STATE_STORAGE_KEY, fresh);
    return fresh;
  },

  async saveState(snapshot: SajiAmanStateSnapshot): Promise<void> {
    storageAdapter.setItem(STATE_STORAGE_KEY, snapshot);
  },

  async resetDemoState(): Promise<SajiAmanStateSnapshot> {
    const fresh = createSeedSnapshot();
    storageAdapter.setItem(STATE_STORAGE_KEY, fresh);
    return fresh;
  },
};
