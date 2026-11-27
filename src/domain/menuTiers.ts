/**
 * Shared Food Perishability Risk Tiers for SajiAman Menu Management.
 * Maps 1:1 with holding_time_minutes rules in PostgreSQL upsert_menu_item RPC.
 */

import type { MenuCategory } from '../types/sajiaman';

export interface MenuCategoryMeta {
  key: MenuCategory;
  label: string;
  shortLabel: string;
}

export const MENU_CATEGORIES: MenuCategoryMeta[] = [
  { key: 'karbohidrat', label: 'Karbohidrat', shortLabel: 'Karbohidrat' },
  { key: 'protein', label: 'Protein & Lauk', shortLabel: 'Protein' },
  { key: 'sayur', label: 'Sayur & Lalapan', shortLabel: 'Sayur' },
  { key: 'buah', label: 'Buah Segar', shortLabel: 'Buah' },
  { key: 'susu_minuman', label: 'Susu & Minuman', shortLabel: 'Minuman' },
  { key: 'sambal_pelengkap', label: 'Sambal & Pelengkap', shortLabel: 'Pelengkap' },
];

export interface MenuRiskTierOption {
  id: string;
  label: string;
  hours: number;
  color: string;
  bg: string;
  border: string;
}

export const MENU_RISK_TIERS: MenuRiskTierOption[] = [
  {
    id: 'santan_kuah_tinggi',
    label: 'Risiko Tinggi • Berkuah Santan / Mudah Basi',
    hours: 3.5,
    color: '#B45309',
    bg: '#FEF3C7',
    border: '#FCD34D',
  },
  {
    id: 'tumis_kuah',
    label: 'Risiko Sedang • Basah / Berkuah Ringan',
    hours: 4.0,
    color: '#0F4C81',
    bg: '#EBF3FA',
    border: '#BDD5EB',
  },
  {
    id: 'kering_goreng',
    label: 'Standar Higienis • Matang Kering / Non-Kuah',
    hours: 4.5,
    color: '#15803D',
    bg: '#DCFCE7',
    border: '#86EFAC',
  },
  {
    id: 'lauk_kering',
    label: 'Tahan Lama • Kadar Air Rendah / Kering Awet',
    hours: 5.0,
    color: '#15803D',
    bg: '#DCFCE7',
    border: '#86EFAC',
  },
  {
    id: 'buah_utuh',
    label: 'Sangat Tahan Lama • Utuh / Kemasan Segel',
    hours: 6.0,
    color: '#15803D',
    bg: '#DCFCE7',
    border: '#86EFAC',
  },
];

export function inferMenuRiskTierFromHours(hours: number): string {
  const match = MENU_RISK_TIERS.find((t) => Math.abs(t.hours - hours) < 0.05);
  return match?.id || 'tumis_kuah';
}
