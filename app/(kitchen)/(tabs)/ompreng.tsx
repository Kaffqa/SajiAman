import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  School,
  Truck,
  User,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../../src/components/ui/CivicButton';
import { EmptyStateCard } from '../../../src/components/ui/EmptyStateCard';
import { HairlineCard } from '../../../src/components/ui/HairlineCard';
import { PulseDot } from '../../../src/components/ui/PulseDot';
import { useSajiAman } from '../../../src/context/SajiAmanContext';
import {
  calculateOmprengTelemetry,
  formatWibTime,
} from '../../../src/domain/weakestLinkEngine';
import type { OmprengCustodyStatus } from '../../../src/types/sajiaman';

type CustodyFilter = 'all' | OmprengCustodyStatus;

export default function OmprengTrackerScreen() {
  const router = useRouter();
  const {
    batches,
    notifications,
    userProfile,
    kitchenProfile,
    simulatedNowMs,
    confirmOmprengReturned,
  } = useSajiAman();

  const [filter, setFilter] = useState<CustodyFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);

  const unreadNotifCount = useMemo(
    () =>
      notifications.filter(
        (n) =>
          (!n.recipientRole || n.recipientRole === 'kitchen') &&
          (!userProfile?.kitchenId || !n.kitchenId || n.kitchenId === userProfile.kitchenId) &&
          !n.isRead
      ).length,
    [notifications, userProfile?.kitchenId]
  );

  const stats = useMemo(
    () => calculateOmprengTelemetry(kitchenProfile.totalOmprengInventory, batches),
    [kitchenProfile.totalOmprengInventory, batches]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return batches;
    return batches.filter((b) => b.batchStatus !== 'voided' && b.omprengStatus === filter);
  }, [batches, filter]);

  const handleConfirmReturn = async (batchId: string) => {
    setReturningId(batchId);
    try {
      await confirmOmprengReturned(batchId);
    } finally {
      setReturningId(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      {/* Curved Navy Operational Header */}
      <View className="bg-[#0B2E59] px-4 pt-3.5 pb-10 rounded-b-[26px] flex-row items-center justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text numberOfLines={1} className="font-sans text-[10px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]">
            {userProfile?.kitchenName || kitchenProfile.name} • STOK {stats.totalInventory} UNIT
          </Text>
          <Text numberOfLines={1} className="font-sans text-[17px] font-extrabold text-white tracking-[-0.02em] mt-0.5">
            Sirkulasi Ompreng
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5 shrink-0">
          <Pressable
            onPress={() => router.push('/(kitchen)/notifications' as any)}
            accessibilityLabel="Pusat notifikasi"
            className="h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 border border-white/15 active:bg-white/20 relative"
          >
            <Bell size={16} color="#FFFFFF" strokeWidth={2} />
            {unreadNotifCount > 0 && (
              <View className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-[#EF4444] items-center justify-center border border-[#0B2E59]">
                <Text className="text-[9px] font-black text-white">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/(kitchen)/profile' as any)}
            accessibilityLabel="Profil petugas"
            className="h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 border border-white/15 active:bg-white/20"
          >
            <User size={16} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Overlapping 3-Tile Inventory Summary Bento */}
      <View className="px-4 -mt-6 flex-row items-stretch gap-2.5 z-10">
        {[
          { label: 'Di Dapur', value: stats.inKitchen, color: '#15803D', bg: '#DCFCE7', Icon: ChefHat },
          { label: 'Di Sekolah', value: stats.atSchools, color: '#B45309', bg: '#FEF3C7', Icon: School },
          { label: 'Dalam Kirim', value: stats.inTransit, color: '#0F4C81', bg: '#EBF3FA', Icon: Truck },
        ].map((tile) => {
          const TileIcon = tile.Icon;
          return (
            <View
              key={tile.label}
              className="flex-1 rounded-[14px] bg-white border border-[#D8E2EC] px-3 py-2.5 shadow-sm justify-between"
            >
              <View className="flex-row items-center justify-between gap-1 mb-1">
                <View
                  style={{ backgroundColor: tile.bg }}
                  className="h-7 w-7 rounded-[8px] items-center justify-center"
                >
                  <TileIcon size={15} color={tile.color} />
                </View>
                <Text
                  style={[
                    styles.summaryValueMono,
                    { color: tile.color },
                  ]}
                >
                  {tile.value}
                </Text>
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.summaryLabel}>
                {tile.label}
              </Text>
            </View>
          );
        })}
      </View>

      <ScrollView
        className="flex-1 bg-[#F4F7FA]"
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {stats.missingOrDiscrepancy > 0 ? (
          <View className="px-3.5 py-2.5 rounded-[12px] bg-[#FEF2F2] border border-[#FCA5A5] flex-row items-center justify-between gap-2">
            <Text className="font-sans text-[11.5px] font-bold text-[#991B1B] flex-1">
              Selisih / Hilang di Lapangan (Belum Kembali Utuh)
            </Text>
            <Text className="font-mono text-[13px] font-extrabold text-[#B91C1C]">
              {stats.missingOrDiscrepancy} Unit
            </Text>
          </View>
        ) : null}

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {[
            { id: 'all', label: `Semua (${batches.length})` },
            { id: 'received_school', label: 'Di Sekolah' },
            { id: 'dispatched', label: 'Dalam Kirim' },
            { id: 'returned_sterilized', label: 'Kembali' },
          ].map((item) => {
            const active = filter === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilter(item.id as CustodyFilter)}
                className={`min-h-[38px] px-3 py-1.5 rounded-[8px] border items-center justify-center ${
                  active
                    ? 'bg-[#0F4C81] border-[#0F4C81]'
                    : 'bg-white border-[#D8E2EC]'
                }`}
              >
                <Text
                  className={`font-sans text-[12px] font-semibold ${
                    active ? 'text-white' : 'text-[#475569]'
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Per-Batch Compact Custody Cards with Expandable Timeline */}
        <View className="gap-3">
          {filtered.length === 0 ? (
            <EmptyStateCard
              icon={<PackageCheck size={26} color="#0F4C81" />}
              title="Belum ada sirkulasi ompreng pada filter ini"
              description="Sirkulasi ompreng akan muncul otomatis saat dapur mengirim batch ke sekolah binaan."
            />
          ) : (
            filtered.map((batch) => {
            const isVoided = batch.batchStatus === 'voided';
            const stepIndex =
              batch.omprengStatus === 'dispatched'
                ? 1
                : batch.omprengStatus === 'received_school'
                  ? 2
                  : 3;
            const isExpanded = expandedId === batch.id;

            const badgeBg = isVoided
              ? 'bg-[#FEF2F2] border-[#FCA5A5]'
              : batch.omprengStatus === 'returned_sterilized'
                ? 'bg-[#DCFCE7] border-[#86EFAC]'
                : batch.omprengStatus === 'received_school'
                  ? 'bg-[#FEF3C7] border-[#FCD34D]'
                  : 'bg-[#EBF3FA] border-[#BDD5EB]';

            const badgeText = isVoided
              ? 'BATAL / VOID'
              : batch.omprengStatus === 'returned_sterilized'
                ? 'KEMBALI LENGKAP'
                : batch.omprengStatus === 'received_school'
                  ? 'DITERIMA SEKOLAH'
                  : 'DALAM PENGIRIMAN';

            const badgeTextColor = isVoided
              ? 'text-[#B91C1C]'
              : batch.omprengStatus === 'returned_sterilized'
                ? 'text-[#14532D]'
                : batch.omprengStatus === 'received_school'
                  ? 'text-[#78350F]'
                  : 'text-[#0B2E59]';

            return (
              <HairlineCard key={batch.id} className="gap-2.5">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <Text
                      numberOfLines={1}
                      className="font-sans text-[15px] font-bold text-[#0F172A]"
                    >
                      {batch.schoolName}
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                      <Text style={styles.batchTagMono}>{batch.id}</Text>
                      <Text className="text-[#475569]">•</Text>
                      <Text style={styles.unitTagMono}>
                        {batch.omprengCount} unit
                      </Text>
                    </View>
                  </View>

                  <View className={`px-2 py-1 rounded-[5px] border shrink-0 ${badgeBg}`}>
                    <Text
                      className={`font-sans text-[10px] font-bold uppercase tracking-[0.04em] ${badgeTextColor}`}
                    >
                      {badgeText}
                    </Text>
                  </View>
                </View>

                {/* Mini 3-Node Icon Pipeline + Expand Toggle */}
                <Pressable
                  onPress={() => setExpandedId(isExpanded ? null : batch.id)}
                  className="gap-2 py-1"
                >
                  <View className="flex-row items-center px-1">
                    <View className="h-6 w-6 rounded-full bg-[#0F4C81] items-center justify-center">
                      <ChefHat size={12} color="#FFFFFF" />
                    </View>
                    <View
                      className={`flex-1 h-1 mx-1 rounded-full ${
                        stepIndex >= 2
                          ? stepIndex === 3
                            ? 'bg-[#15803D]'
                            : 'bg-[#0F4C81]'
                          : 'bg-[#CBD5E1]'
                      }`}
                    />
                    <View
                      className={`h-6 w-6 rounded-full items-center justify-center ${
                        stepIndex === 1
                          ? 'bg-[#0F4C81]'
                          : stepIndex === 2
                            ? 'bg-[#D97706]'
                            : 'bg-[#15803D]'
                      }`}
                    >
                      {stepIndex === 1 ? <Truck size={12} color="#FFFFFF" /> : <School size={12} color="#FFFFFF" />}
                    </View>
                    <View
                      className={`flex-1 h-1 mx-1 rounded-full ${
                        stepIndex >= 3 ? 'bg-[#15803D]' : 'bg-[#CBD5E1]'
                      }`}
                    />
                    <View
                      className={`h-6 w-6 rounded-full items-center justify-center ${
                        stepIndex >= 3
                          ? 'bg-[#15803D]'
                          : 'bg-[#F1F5F9] border border-[#CBD5E1]'
                      }`}
                    >
                      <PackageCheck size={12} color={stepIndex >= 3 ? '#FFFFFF' : '#94A3B8'} />
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1">
                      {stepIndex < 3 && !isVoided ? (
                        <PulseDot color={stepIndex === 2 ? '#D97706' : '#0F4C81'} size={5} />
                      ) : null}
                      <Text className="font-sans text-[11px] text-[#64748B]">
                        {stepIndex === 1
                          ? 'Tahap 1/3 • Dalam Pengiriman'
                          : stepIndex === 2
                            ? 'Tahap 2/3 • Diterima Sekolah'
                            : 'Tahap 3/3 • Kembali & Steril'}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-0.5">
                      <Text className="font-sans text-[11px] font-semibold text-[#0F4C81]">
                        {isExpanded ? 'Tutup Jejak' : 'Detail Jejak'}
                      </Text>
                      {isExpanded ? (
                        <ChevronUp size={13} color="#0F4C81" />
                      ) : (
                        <ChevronDown size={13} color="#0F4C81" />
                      )}
                    </View>
                  </View>
                </Pressable>

                {/* Expandable 3-Step Horizontal Custody Pipeline */}
                {isExpanded ? (
                  <View className="rounded-[10px] bg-[#F4F7FA] border border-[#D8E2EC] px-2 py-3">
                    <View className="flex-row items-start justify-between">
                      <View className="items-center gap-1 flex-1 px-0.5">
                        <View className="h-6 w-6 items-center justify-center rounded-full bg-[#0F4C81]">
                          <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                        </View>
                        <Text className="font-sans text-[9.5px] leading-[12px] font-bold text-[#0F172A] text-center">
                          Dikirim Dapur
                        </Text>
                      </View>
                      <View
                        className={`w-5 h-[2px] mt-3 ${
                          stepIndex >= 2 ? 'bg-[#0F4C81]' : 'bg-[#CBD5E1]'
                        }`}
                      />
                      <View className="items-center gap-1 flex-1 px-0.5">
                        <View
                          className={`h-6 w-6 items-center justify-center rounded-full ${
                            stepIndex >= 2
                              ? stepIndex === 3
                                ? 'bg-[#15803D]'
                                : 'bg-[#0F4C81]'
                              : 'bg-white border-2 border-[#94A3B8]'
                          }`}
                        >
                          {stepIndex >= 2 ? (
                            <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                          ) : (
                            <View className="h-2 w-2 rounded-full bg-[#94A3B8]" />
                          )}
                        </View>
                        <Text
                          className={`font-sans text-[9.5px] leading-[12px] font-bold text-center ${
                            stepIndex >= 2 ? 'text-[#0F172A]' : 'text-[#64748B]'
                          }`}
                        >
                          Diterima Sekolah
                        </Text>
                      </View>
                      <View
                        className={`w-5 h-[2px] mt-3 ${
                          stepIndex >= 3 ? 'bg-[#15803D]' : 'bg-[#CBD5E1]'
                        }`}
                      />
                      <View className="items-center gap-1 flex-1 px-0.5">
                        <View
                          className={`h-6 w-6 items-center justify-center rounded-full ${
                            stepIndex >= 3
                              ? 'bg-[#15803D]'
                              : 'bg-white border-2 border-[#CBD5E1]'
                          }`}
                        >
                          {stepIndex >= 3 ? (
                            <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                          ) : (
                            <View className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                          )}
                        </View>
                        <Text
                          className={`font-sans text-[9.5px] leading-[12px] font-bold text-center ${
                            stepIndex >= 3 ? 'text-[#14532D]' : 'text-[#64748B]'
                          }`}
                        >
                          Kembali &amp; Steril
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* Discrepancy & Pickup Readiness Indicators */}
                {batch.omprengReceivedCount != null &&
                  batch.omprengReceivedCount < batch.omprengCount && (
                    <View className="px-3 py-2 rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5] gap-0.5">
                      <Text className="font-sans text-[11px] font-bold text-[#B91C1C]">
                        ⚠️ Diterima {batch.omprengReceivedCount}/{batch.omprengCount} • Selisih -{batch.omprengCount - batch.omprengReceivedCount} boks
                      </Text>
                      {batch.omprengDiscrepancyNote ? (
                        <Text className="font-sans text-[11px] text-[#7F1D1D]">
                          "{batch.omprengDiscrepancyNote}"
                        </Text>
                      ) : null}
                    </View>
                  )}

                {batch.omprengReadyForPickup && batch.omprengStatus === 'received_school' && (
                  <View className="px-3 py-1.5 rounded-[8px] bg-[#EEF2FF] border border-[#C7D2FE] flex-row items-center gap-1.5 self-start">
                    <Truck size={14} color="#3730A3" />
                    <Text className="font-sans text-[11px] font-bold text-[#3730A3] uppercase tracking-[0.04em]">
                      Ompreng Siap Dijemput Sekolah
                    </Text>
                  </View>
                )}

                {/* Contextual Action / Audit Metadata */}
                {isVoided ? (
                  <Text className="font-sans text-[11px] font-semibold text-[#B91C1C]">
                    Batch dibatalkan oleh Dapur SPPG — ompreng dikembalikan ke stok siap pakai.
                  </Text>
                ) : batch.omprengStatus === 'received_school' ? (
                  <View className="gap-2">
                    <Text className="font-sans text-[11px] text-[#475569]">
                      Dikonfirmasi {batch.omprengConfirmedBy ?? 'PIC Sekolah'} •{' '}
                      <Text style={styles.auditTimeMono}>
                        {formatWibTime(batch.omprengConfirmedAt ?? simulatedNowMs)}
                      </Text>
                    </Text>
                    <CivicButton
                      variant="primary"
                      size="md"
                      loading={returningId === batch.id}
                      disabled={returningId !== null}
                      icon={<CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2} />}
                      onPress={() => handleConfirmReturn(batch.id)}
                    >
                      Konfirmasi Wadah Kembali Lengkap
                    </CivicButton>
                  </View>
                ) : batch.omprengStatus === 'returned_sterilized' ? (
                  <View className="flex-row items-center justify-between bg-[#DCFCE7] border border-[#86EFAC] rounded-[8px] px-3 py-2">
                    <View className="flex-row items-center gap-1.5 flex-1">
                      <CheckCircle2 size={14} color="#14532D" />
                      <Text className="font-sans text-[11px] font-semibold text-[#14532D]">
                        Kembali &amp; siap sterilisasi
                      </Text>
                    </View>
                    <Text style={styles.returnedTimeMono}>
                      {formatWibTime(batch.omprengReturnedAt ?? simulatedNowMs)}
                    </Text>
                  </View>
                ) : (
                  <Text className="font-sans text-[11px] text-[#475569]">
                    Menunggu pemindaian QR dan konfirmasi penerimaan oleh Koordinator Sekolah.
                  </Text>
                )}
              </HairlineCard>
            );
          })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  summaryValueMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 18,
    lineHeight: 22,
  },
  summaryLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#475569',
    marginTop: 2,
  },
  batchTagMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#475569',
  },
  unitTagMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#0F4C81',
  },
  auditTimeMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
  },
  returnedTimeMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#14532D',
  },
});
