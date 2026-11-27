import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileDown,
  Filter,
  Layers,
  School,
  ShieldCheck,
  XCircle,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../../src/components/ui/EmptyStateCard';
import { HairlineCard } from '../../src/components/ui/HairlineCard';
import { StepHeader } from '../../src/components/ui/StepHeader';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { formatWibTime, getWibStartOfDayMs } from '../../src/domain/weakestLinkEngine';
import { exportPeriodicSummaryPdf } from '../../src/utils/manifestGenerator';
import type { BatchRecord, BatchStatus } from '../../src/types/sajiaman';

type DateFilter = 'today' | '7days' | 'all';
type StatusFilter = 'all' | 'active' | 'rejected' | 'voided';

export default function KitchenHistoryScreen() {
  const router = useRouter();
  const {
    batches,
    simulatedNowMs,
    userProfile,
    kitchenProfile,
    totalOrganicDivertedKg,
    showToast,
  } = useSajiAman();

  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isExporting, setIsExporting] = useState(false);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // Date filter
      if (dateFilter === 'today') {
        const startOfDayMs = getWibStartOfDayMs(simulatedNowMs);
        if (b.cookedAt < startOfDayMs) return false;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = simulatedNowMs - 7 * 24 * 60 * 60 * 1000;
        if (b.cookedAt < sevenDaysAgo) return false;
      }

      // Status filter
      const bStatus = b.batchStatus || 'active';
      if (statusFilter === 'active' && bStatus !== 'active') return false;
      if (statusFilter === 'rejected' && bStatus !== 'rejected_spoiled') return false;
      if (statusFilter === 'voided' && bStatus !== 'voided') return false;

      return true;
    });
  }, [batches, dateFilter, statusFilter, simulatedNowMs]);

  // KPIs
  const totalBatches = filteredBatches.length;
  const totalPortions = useMemo(
    () => filteredBatches.reduce((acc, b) => acc + (b.omprengCount || 0), 0),
    [filteredBatches]
  );
  const complianceRate = useMemo(() => {
    if (totalBatches === 0) return 100;
    const rejectedCount = filteredBatches.filter((b) => b.batchStatus === 'rejected_spoiled').length;
    return Math.round(((totalBatches - rejectedCount) / totalBatches) * 100);
  }, [filteredBatches, totalBatches]);

  const handleExportPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const periodLabel =
        dateFilter === 'today'
          ? 'HARI INI'
          : dateFilter === '7days'
            ? '7 HARI TERAKHIR'
            : 'SEMUA WAKTU';
      await exportPeriodicSummaryPdf({
        batches: filteredBatches,
        periodLabel,
        scopeTitle: `${userProfile?.kitchenName || kitchenProfile.name} (${userProfile?.kitchenCode || kitchenProfile.code})`,
        generatedBy: userProfile?.fullName || kitchenProfile.picName || 'Petugas Dapur SPPG',
        simulatedNowMs,
        totalMaggotKg: totalOrganicDivertedKg,
      });
    } catch (err: any) {
      const msg = err?.message || 'Terjadi kendala saat membuat berkas PDF.';
      Alert.alert('Gagal Ekspor Rekap PDF', msg);
      showToast('Gagal mengekspor rekap PDF: ' + msg, 'warning');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        eyebrow="AUDIT KEPATUHAN SPPG"
        title="Arsip Riwayat Produksi"
        onBack={() => router.back()}
        rightSlot={
          <Pressable
            disabled={isExporting}
            onPress={handleExportPdf}
            className="px-2.5 py-1.5 rounded-[8px] bg-[#0F4C81] flex-row items-center gap-1 active:bg-[#0B2E59]"
          >
            <FileDown size={13} color="#FFFFFF" />
            <Text className="font-sans text-[11px] font-bold text-white">
              {isExporting ? '...' : 'Rekap PDF'}
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Strip */}
        <View className="flex-row gap-2.5 mt-4">
          <View className="flex-1">
            <HairlineCard className="p-3 bg-white">
              <Text className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Total Batch
              </Text>
              <Text className="text-xl font-black text-[#0B2E59]">
                {totalBatches}{' '}
                <Text className="text-xs font-semibold text-[#64748B]">Batch</Text>
              </Text>
            </HairlineCard>
          </View>

          <View className="flex-1">
            <HairlineCard className="p-3 bg-white">
              <Text className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Total Porsi
              </Text>
              <Text className="text-xl font-black text-[#0B2E59]">
                {totalPortions}{' '}
                <Text className="text-xs font-semibold text-[#64748B]">Porsi</Text>
              </Text>
            </HairlineCard>
          </View>

          <View className="flex-1">
            <HairlineCard className="p-3 bg-white">
              <Text className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Kepatuhan Aman
              </Text>
              <Text
                className={`text-xl font-black ${
                  complianceRate >= 95 ? 'text-[#15803D]' : 'text-[#DC2626]'
                }`}
              >
                {complianceRate}%
              </Text>
            </HairlineCard>
          </View>
        </View>

        {/* Date Filter Pills */}
        <View className="mt-4">
          <Text className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
            Rentang Waktu
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              { id: 'all', label: 'Semua Waktu' },
              { id: '7days', label: '7 Hari Terakhir' },
              { id: 'today', label: 'Hari Ini' },
            ].map((d) => {
              const active = dateFilter === d.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => setDateFilter(d.id as DateFilter)}
                  className={`px-3 py-1.5 rounded-lg border ${
                    active
                      ? 'bg-[#0B2E59] border-[#0B2E59]'
                      : 'bg-white border-[#CBD5E1]'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      active ? 'text-white' : 'text-[#475569]'
                    }`}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Status Filter Pills */}
        <View className="mt-3">
          <Text className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
            Status Kelayakan
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            <View className="flex-row flex-wrap gap-2">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'active', label: 'Aktif / Layak' },
                { id: 'rejected', label: 'Ditolak Basi Dini' },
                { id: 'voided', label: 'Dibatalkan' },
              ].map((s) => {
                const active = statusFilter === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setStatusFilter(s.id as StatusFilter)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      active
                        ? 'bg-[#0F4C81] border-[#0F4C81]'
                        : 'bg-white border-[#CBD5E1]'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        active ? 'text-white' : 'text-[#475569]'
                      }`}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Batch Cards Vertical Timeline */}
        <View className="mt-5">
          {filteredBatches.length === 0 ? (
            <EmptyStateCard
              icon={<Archive size={26} color="#0F4C81" />}
              title="Tidak ada batch yang sesuai filter"
              description="Ubah rentang waktu atau filter status di atas untuk melihat arsip produksi SPPG."
            />
          ) : (
            filteredBatches.map((batch, idx) => {
              const bStatus = batch.batchStatus || 'active';
              const isRejected = bStatus === 'rejected_spoiled';
              const isVoided = bStatus === 'voided';
              const isLast = idx === filteredBatches.length - 1;
              const nodeColor = isRejected ? '#DC2626' : isVoided ? '#94A3B8' : '#15803D';

              return (
                <View key={batch.id} className="flex-row items-stretch gap-2.5">
                  {/* Left Timeline Rail */}
                  <View className="items-center w-4 pt-4">
                    <View
                      style={{ backgroundColor: nodeColor }}
                      className="h-3 w-3 rounded-full border-2 border-white shadow-xs"
                    />
                    {!isLast ? <View className="w-[1.5px] flex-1 bg-[#CBD5E1] mt-1" /> : null}
                  </View>

                  <Pressable
                    className="flex-1 pb-3"
                    onPress={() => router.push(`/(kitchen)/batch/${batch.id}` as any)}
                  >
                    <HairlineCard className="p-4 bg-white">
                    {/* Header: Batch ID & Status Badge */}
                    <View className="flex-row items-center justify-between gap-2 mb-2">
                      <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                        <Text numberOfLines={1} className="text-sm font-mono font-bold text-[#0B2E59]">
                          {batch.id}
                        </Text>
                        <Text numberOfLines={1} className="text-xs font-bold text-[#64748B] shrink-0">
                          • {batch.boxNumber}
                        </Text>
                      </View>

                      {isRejected ? (
                        <View className="px-2 py-0.5 rounded bg-[#FEE2E2] border border-[#FCA5A5] flex-row items-center gap-1 shrink-0">
                          <XCircle size={11} color="#DC2626" />
                          <Text className="text-[10px] font-black text-[#DC2626]">
                            DITOLAK BASI
                          </Text>
                        </View>
                      ) : isVoided ? (
                        <View className="px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#CBD5E1] flex-row items-center gap-1 shrink-0">
                          <AlertOctagon size={11} color="#64748B" />
                          <Text className="text-[10px] font-bold text-[#64748B]">
                            DIBATALKAN
                          </Text>
                        </View>
                      ) : (
                        <View className="px-2 py-0.5 rounded bg-[#DCFCE7] border border-[#86EFAC] flex-row items-center gap-1 shrink-0">
                          <CheckCircle2 size={11} color="#15803D" />
                          <Text className="text-[10px] font-bold text-[#15803D]">
                            LAYAK / SELESAI
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* School & Portion */}
                    <View className="flex-row items-center justify-between gap-2 mb-2">
                      <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                        <School size={14} color="#0F4C81" className="shrink-0" />
                        <Text
                          className="text-sm font-bold text-[#1E293B] flex-1 min-w-0"
                          numberOfLines={1}
                        >
                          {batch.schoolName}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1 shrink-0">
                        <Layers size={13} color="#64748B" />
                        <Text className="text-xs font-bold text-[#0B2E59]">
                          {batch.omprengCount} Porsi
                        </Text>
                      </View>
                    </View>

                    {/* Rejection / Void note if any */}
                    {isRejected && batch.rejectionReason && (
                      <View className="bg-[#FEF2F2] p-2 rounded border border-[#FEE2E2] mb-2">
                        <Text className="text-[11px] font-bold text-[#B91C1C]">
                          Alasan Tolak Sekolah:
                        </Text>
                        <Text className="text-[11px] text-[#7F1D1D] mt-0.5">
                          "{batch.rejectionReason}"
                        </Text>
                      </View>
                    )}
                    {isVoided && batch.voidReason && (
                      <View className="bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0] mb-2">
                        <Text className="text-[11px] font-bold text-[#475569]">
                          Alasan Pembatalan:
                        </Text>
                        <Text className="text-[11px] text-[#64748B] mt-0.5">
                          "{batch.voidReason}"
                        </Text>
                      </View>
                    )}

                    {/* Timestamps & Weakest Link */}
                    <View className="pt-2 border-t border-[#F1F5F9] flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                        <Clock size={12} color="#64748B" className="shrink-0" />
                        <Text className="text-[11px] text-[#64748B]">
                          Masak: <Text className="font-semibold text-[#334155]">{formatWibTime(batch.cookedAt)}</Text>
                        </Text>
                        <Text className="text-[11px] text-[#94A3B8]">|</Text>
                        <Text className="text-[11px] text-[#64748B]">
                          Batas: <Text className="font-semibold text-[#DC2626]">{formatWibTime(batch.expiresAt)}</Text>
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-1 shrink-0">
                        <ChevronRight size={14} color="#0F4C81" />
                      </View>
                    </View>
                  </HairlineCard>
                </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
