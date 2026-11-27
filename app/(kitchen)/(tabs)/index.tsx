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
  AlertTriangle,
  Archive,
  Bell,
  BookOpen,
  ChevronRight,
  Clock,
  Flame,
  HelpCircle,
  Package,
  PlusCircle,
  Recycle,
  School,
  User,
  Utensils,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../../../src/components/ui/EmptyStateCard';
import { PulseDot } from '../../../src/components/ui/PulseDot';
import { RoleTutorialModal } from '../../../src/components/ui/RoleTutorialModal';
import { SafetyProgressBar } from '../../../src/components/ui/SafetyProgressBar';
import { useSajiAman } from '../../../src/context/SajiAmanContext';
import {
  calculateOmprengTelemetry,
  evaluateBatchSafety,
  formatCountdown,
  formatHoursId,
  formatWibTime,
} from '../../../src/domain/weakestLinkEngine';

type BatchFilter = 'all' | 'mine' | 'safe' | 'critical';

export default function KitchenHomeScreen() {
  const router = useRouter();
  const {
    batches,
    schools,
    menuCatalog,
    notifications,
    userProfile,
    kitchenProfile,
    simulatedNowMs,
    pendingMaggotCount,
  } = useSajiAman();

  const activeMenuCount = useMemo(
    () => menuCatalog.filter((m) => m.isActive !== false).length,
    [menuCatalog]
  );

  const [filter, setFilter] = useState<BatchFilter>('all');
  const [showTutorial, setShowTutorial] = useState(false);

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

  const omprengStats = useMemo(
    () => calculateOmprengTelemetry(kitchenProfile.totalOmprengInventory, batches),
    [kitchenProfile.totalOmprengInventory, batches]
  );

  const evaluatedBatches = useMemo(
    () =>
      batches.map((batch) => ({
        batch,
        evaluation: evaluateBatchSafety(batch, simulatedNowMs),
      })),
    [batches, simulatedNowMs]
  );

  const myBatchesCount = useMemo(
    () =>
      userProfile?.id
        ? evaluatedBatches.filter((x) => x.batch.createdBy === userProfile.id).length
        : evaluatedBatches.length,
    [evaluatedBatches, userProfile?.id]
  );

  const filteredBatches = useMemo(() => {
    if (filter === 'mine' && userProfile?.id) {
      return evaluatedBatches.filter((x) => x.batch.createdBy === userProfile.id);
    }
    if (filter === 'safe') {
      return evaluatedBatches.filter((x) => x.evaluation.status === 'GREEN');
    }
    if (filter === 'critical') {
      return evaluatedBatches.filter(
        (x) => x.evaluation.status === 'YELLOW' || x.evaluation.status === 'RED'
      );
    }
    return evaluatedBatches;
  }, [evaluatedBatches, filter, userProfile?.id]);

  const activeBatchCount = batches.filter(
    (b) => b.omprengStatus !== 'returned_sterilized' && b.batchStatus !== 'voided'
  ).length;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      {/* Curved Navy Operational Hero Header (with generous breathing space above overlapping KPIs) */}
      <View className="bg-[#0B2E59] px-4 pt-3.5 pb-10 rounded-b-[26px] flex-row items-center justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text
            numberOfLines={1}
            className="font-sans text-[17px] font-extrabold text-white tracking-[-0.015em]"
          >
            {userProfile?.kitchenName || kitchenProfile.name}
          </Text>
          <Text numberOfLines={1} className="font-sans text-[11.5px] font-medium text-[#93C5FD] mt-0.5">
            {userProfile?.fullName ? `Petugas: ${userProfile.fullName}` : 'Unit Produksi SPPG'}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5 shrink-0">
          <Pressable
            onPress={() => setShowTutorial(true)}
            accessibilityLabel="Panduan Dapur SPPG"
            className="h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 border border-white/15 active:bg-white/20"
          >
            <HelpCircle size={16} color="#93C5FD" strokeWidth={2} />
          </Pressable>
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

      {/* Overlapping Floating 3-KPI Bento Strip */}
      <View className="px-4 -mt-6 flex-row items-stretch gap-2.5 z-10">
        <View className="flex-1 rounded-[14px] bg-white border border-[#D8E2EC] px-3 py-2.5 shadow-sm justify-between">
          <View className="flex-row items-center justify-between gap-1 mb-1">
            <View className="h-7 w-7 rounded-[8px] bg-[#EBF3FA] items-center justify-center">
              <Flame size={15} color="#0F4C81" />
            </View>
            <View className="flex-row items-center gap-1">
              {activeBatchCount > 0 ? <PulseDot color="#16A34A" size={5} /> : null}
              <Text style={styles.telemetryNumber}>{activeBatchCount}</Text>
            </View>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.telemetryLabel}>
            Batch Aktif
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/(kitchen)/ompreng' as any)}
          className="flex-1 rounded-[14px] bg-white border border-[#D8E2EC] px-3 py-2.5 shadow-sm justify-between active:bg-[#F8FAFC]"
        >
          <View className="flex-row items-center justify-between gap-1 mb-1">
            <View className="h-7 w-7 rounded-[8px] bg-[#EEF2FF] items-center justify-center">
              <Package size={15} color="#4338CA" />
            </View>
            <Text style={[styles.telemetryNumber, { color: '#0F4C81' }]}>
              {omprengStats.outOfKitchen}
            </Text>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.telemetryLabel}>
            Ompreng Keluar
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(kitchen)/maggot' as any)}
          className="flex-1 rounded-[14px] bg-white border border-[#D8E2EC] px-3 py-2.5 shadow-sm justify-between active:bg-[#F8FAFC]"
        >
          <View className="flex-row items-center justify-between gap-1 mb-1">
            <View
              className={`h-7 w-7 rounded-[8px] items-center justify-center ${
                pendingMaggotCount > 0 ? 'bg-[#FEF3C7]' : 'bg-[#DCFCE7]'
              }`}
            >
              <Recycle size={15} color={pendingMaggotCount > 0 ? '#B45309' : '#15803D'} />
            </View>
            <View className="flex-row items-center gap-1">
              {pendingMaggotCount > 0 ? <PulseDot color="#D97706" size={5} /> : null}
              <Text
                style={[
                  styles.telemetryNumber,
                  { color: pendingMaggotCount > 0 ? '#B45309' : '#0F172A' },
                ]}
              >
                {pendingMaggotCount}
              </Text>
            </View>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.telemetryLabel}>
            Maggot BSF
          </Text>
        </Pressable>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        className="flex-1 bg-[#F4F7FA]"
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 15 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Expressive Primary Action Banner Card */}
        <Pressable
          onPress={() => router.push('/(kitchen)/create-batch')}
          className="rounded-[16px] bg-[#0F4C81] p-3.5 flex-row items-center justify-between gap-3 shadow-sm active:bg-[#0B2E59]"
        >
          <View className="flex-row items-center gap-3 flex-1 min-w-0">
            <View className="h-11 w-11 rounded-[12px] bg-white/15 border border-white/20 items-center justify-center shrink-0">
              <PlusCircle size={22} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="font-sans text-[14px] font-extrabold text-white">
                Catat Produksi Batch Baru
              </Text>
              <Text numberOfLines={1} className="font-sans text-[11.5px] text-[#BFDBFE] mt-0.5">
                Hitung batas aman &amp; cetak segel QR
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#FFFFFF" className="shrink-0" />
        </Pressable>

        {/* Quick-Access SPPG Operational Strip with Pastel Icon Badges */}
        <View className="flex-row gap-2.5">
          <Pressable
            onPress={() => router.push('/(kitchen)/schools' as any)}
            className="flex-1 rounded-[12px] border border-[#D8E2EC] bg-white px-2.5 py-2.5 items-center gap-1.5 active:bg-[#F8FAFC] shadow-xs"
          >
            <View className="h-8 w-8 rounded-[9px] bg-[#EBF3FA] items-center justify-center">
              <School size={16} color="#0F4C81" />
            </View>
            <Text className="font-sans text-[11px] font-bold text-[#0B2E59] text-center">
              Sekolah ({schools.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(kitchen)/menu-catalog' as any)}
            className="flex-1 rounded-[12px] border border-[#D8E2EC] bg-white px-2.5 py-2.5 items-center gap-1.5 active:bg-[#F8FAFC] shadow-xs"
          >
            <View className="h-8 w-8 rounded-[9px] bg-[#DCFCE7] items-center justify-center">
              <BookOpen size={16} color="#15803D" />
            </View>
            <Text className="font-sans text-[11px] font-bold text-[#0B2E59] text-center">
              Menu ({activeMenuCount})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(kitchen)/history' as any)}
            className="flex-1 rounded-[12px] border border-[#D8E2EC] bg-white px-2.5 py-2.5 items-center gap-1.5 active:bg-[#F8FAFC] shadow-xs"
          >
            <View className="h-8 w-8 rounded-[9px] bg-[#FEF3C7] items-center justify-center">
              <Archive size={16} color="#B45309" />
            </View>
            <Text className="font-sans text-[11px] font-bold text-[#0B2E59] text-center">
              Riwayat
            </Text>
          </Pressable>
        </View>

        {schools.length === 0 && (
          <View className="rounded-[12px] border border-[#FCD34D] bg-[#FEF3C7] p-3.5 gap-1.5">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#B45309" />
              <Text className="font-sans text-[12px] font-extrabold text-[#78350F] uppercase">
                Belum Ada Sekolah Binaan BGN
              </Text>
            </View>
            <Text className="font-sans text-[12px] text-[#92400E] leading-[17px]">
              Unit SPPG ini belum ditugaskan sekolah tujuan oleh Admin BGN Pusat. Hubungi Admin BGN untuk menambahkan sekolah penerima manfaat sebelum mencatat batch.
            </Text>
          </View>
        )}

        {/* Active Batches Ledger */}
        <View className="gap-3">
          <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            BATCH PRODUKSI HARI INI ({batches.length})
          </Text>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(
              [
                { id: 'all', label: `Semua (${batches.length})` },
                ...(userProfile?.id
                  ? [{ id: 'mine', label: `Batch Saya (${myBatchesCount})` }]
                  : []),
                {
                  id: 'safe',
                  label: `Aman (${evaluatedBatches.filter((x) => x.evaluation.status === 'GREEN').length})`,
                },
                {
                  id: 'critical',
                  label: `Kritis (${evaluatedBatches.filter((x) => x.evaluation.status !== 'GREEN').length})`,
                },
              ] as Array<{ id: BatchFilter; label: string }>
            ).map((opt) => {
              const active = filter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setFilter(opt.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-[8px] border items-center justify-center ${
                    active
                      ? 'bg-[#0F4C81] border-[#0F4C81]'
                      : 'bg-white border-[#D8E2EC] active:bg-[#EDF2F7]'
                  }`}
                >
                  <Text
                    className={`font-sans text-[12px] font-semibold ${
                      active ? 'text-white' : 'text-[#475569]'
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Visual Batch Cards with Progress Bar */}
          {filteredBatches.length === 0 ? (
            <EmptyStateCard
              icon={<Utensils size={26} color="#0F4C81" />}
              title="Belum ada batch pada filter ini"
              description="Catat produksi batch pertama hari ini untuk menghitung batas waktu aman dan mencetak segel QR."
              actionLabel={filter === 'all' ? 'Catat Batch Baru' : undefined}
              onAction={filter === 'all' ? () => router.push('/(kitchen)/create-batch') : undefined}
            />
          ) : (
            <View className="gap-2.5">
              {filteredBatches.map(({ batch, evaluation }) => {
                const isGreen = evaluation.status === 'GREEN';
                const isYellow = evaluation.status === 'YELLOW';

                const leftBarColor = isGreen
                  ? '#15803D'
                  : isYellow
                    ? '#B45309'
                    : '#B91C1C';

                const badgeBg = isGreen
                  ? 'bg-[#DCFCE7] border-[#86EFAC]'
                  : isYellow
                    ? 'bg-[#FEF3C7] border-[#FCD34D]'
                    : 'bg-[#FEE2E2] border-[#FCA5A5]';

                const badgeTextColor = isGreen
                  ? 'text-[#14532D]'
                  : isYellow
                    ? 'text-[#78350F]'
                    : 'text-[#7F1D1D]';

                const countdownColor = isGreen
                  ? '#15803D'
                  : isYellow
                    ? '#B45309'
                    : '#B91C1C';

                return (
                  <Pressable
                    key={batch.id}
                    onPress={() =>
                      router.push({
                        pathname: '/(kitchen)/batch/[id]',
                        params: { id: batch.id },
                      })
                    }
                    className="w-full rounded-[14px] border border-[#D8E2EC] bg-white overflow-hidden flex-row active:opacity-90 shadow-xs"
                  >
                    {/* 4px Solid Left Semantic Safety Bar */}
                    <View
                      style={{ width: 4, backgroundColor: leftBarColor }}
                    />

                    <View className="flex-1 min-w-0 p-3.5 gap-2">
                      {/* Row 1: School Name + Batch ID */}
                      <View className="flex-row items-center justify-between gap-2">
                        <View className="flex-row items-center gap-2 flex-1 min-w-0">
                          <View className="h-6 w-6 rounded-[7px] bg-[#EBF3FA] items-center justify-center shrink-0">
                            <School size={13} color="#0F4C81" />
                          </View>
                          <Text
                            numberOfLines={1}
                            className="font-sans text-[14.5px] font-bold text-[#0F172A] flex-1 min-w-0"
                          >
                            {batch.schoolName}
                          </Text>
                        </View>
                        <View className="bg-[#EDF2F7] px-2 py-0.5 rounded-[5px] shrink-0">
                          <Text style={styles.batchIdTag}>{batch.id}</Text>
                        </View>
                      </View>

                      {/* Row 2: Weakest Link + Ompreng */}
                      <View className="flex-row items-center justify-between gap-2">
                        <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                          <Utensils size={12} color="#64748B" className="shrink-0" />
                          <Text
                            numberOfLines={1}
                            className="font-sans text-[12px] text-[#475569] flex-1 min-w-0"
                          >
                            <Text className="font-semibold text-[#0F172A]">
                              {batch.weakestLinkItemName}
                            </Text>{' '}
                            •{' '}
                            <Text style={styles.holdingHoursMono}>
                              {formatHoursId(batch.holdingHours)}j
                            </Text>
                          </Text>
                        </View>
                        <Text style={styles.omprengCountMono} className="shrink-0">
                          {batch.omprengCount} Ompreng
                        </Text>
                      </View>

                      {/* Safety Progress Bar */}
                      <SafetyProgressBar
                        remainingMs={evaluation.remainingMs}
                        holdingHours={batch.holdingHours}
                        status={evaluation.status}
                        height={5}
                      />

                      {/* Bottom Row: Countdown + Status Badge */}
                      <View className="pt-0.5 flex-row items-center justify-between gap-2">
                        <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                          {isYellow ? (
                            <PulseDot color="#D97706" size={5} />
                          ) : (
                            <Clock size={12} color={countdownColor} className="shrink-0" />
                          )}
                          <Text
                            numberOfLines={1}
                            className="flex-1 min-w-0"
                            style={[
                              styles.countdownMono,
                              { color: countdownColor },
                            ]}
                          >
                            {batch.batchStatus === 'voided'
                              ? 'DIBATALKAN (VOID)'
                              : batch.batchStatus === 'rejected_spoiled'
                                ? 'DITOLAK SEKOLAH'
                                : evaluation.isExpired
                                  ? 'KEDALUWARSA'
                                  : `${formatCountdown(evaluation.remainingMs)} • Batas ${formatWibTime(batch.expiresAt)}`}
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-1.5 shrink-0">
                          <View
                            className={`px-2 py-0.5 rounded-[5px] border ${badgeBg}`}
                          >
                            <Text
                              className={`font-sans text-[10px] font-bold uppercase tracking-[0.05em] ${badgeTextColor}`}
                            >
                              {evaluation.verdictBadge}
                            </Text>
                          </View>
                          <ChevronRight size={16} color="#94A3B8" />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <RoleTutorialModal
        visible={showTutorial}
        audience="kitchen"
        onClose={() => setShowTutorial(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  clockMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: '#FFFFFF',
  },
  telemetryNumber: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 22,
    lineHeight: 26,
    color: '#0F172A',
  },
  telemetryLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#475569',
    marginTop: 4,
  },
  batchIdTag: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#475569',
  },
  holdingHoursMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
  },
  omprengCountMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#0F4C81',
  },
  countdownMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 13,
  },
});
