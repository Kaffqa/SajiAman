import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Bell,
  Camera,
  ChevronRight,
  HelpCircle,
  Lock,
  Package,
  QrCode,
  ShieldCheck,
  User,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticsAdapter } from '../../../src/adapters/hapticsAdapter';
import { EmptyStateCard } from '../../../src/components/ui/EmptyStateCard';
import { PulseDot } from '../../../src/components/ui/PulseDot';
import { RoleTutorialModal } from '../../../src/components/ui/RoleTutorialModal';
import { useSajiAman } from '../../../src/context/SajiAmanContext';
import {
  evaluateBatchSafety,
  formatCountdown,
  formatWibTime,
} from '../../../src/domain/weakestLinkEngine';

export default function SchoolIncomingQueueScreen() {
  const router = useRouter();
  const {
    batches,
    notifications,
    userProfile,
    simulatedNowMs,
    isBatchScanUnlocked,
    showToast,
  } = useSajiAman();

  const [showTutorial, setShowTutorial] = useState(false);
  const [showGuideStrip, setShowGuideStrip] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('sajiaman_school_guide_dismissed_v1')
      .then((val) => {
        if (val === '1') setShowGuideStrip(false);
      })
      .catch(() => {});
  }, []);

  const dismissGuideStrip = () => {
    setShowGuideStrip(false);
    AsyncStorage.setItem('sajiaman_school_guide_dismissed_v1', '1').catch(() => {});
  };

  const unreadNotifCount = useMemo(
    () =>
      notifications.filter(
        (n) =>
          (!n.recipientRole || n.recipientRole === 'school') &&
          (!userProfile?.schoolId || !n.schoolId || n.schoolId === userProfile.schoolId) &&
          !n.isRead
      ).length,
    [notifications, userProfile?.schoolId]
  );

  const incomingBatches = useMemo(
    () =>
      batches
        .filter(
          (b) =>
            (!userProfile?.schoolId || b.schoolId === userProfile.schoolId) &&
            b.omprengStatus !== 'returned_sterilized' &&
            b.batchStatus !== 'voided'
        )
        .map((batch) => ({
          batch,
          evaluation: evaluateBatchSafety(batch, simulatedNowMs),
        })),
    [batches, simulatedNowMs, userProfile?.schoolId]
  );

  const summary = useMemo(() => {
    let sealedCount = 0;
    let safeCount = 0;
    let criticalCount = 0;

    for (const { batch, evaluation } of incomingBatches) {
      if (!isBatchScanUnlocked(batch.id)) {
        sealedCount += 1;
      } else if (evaluation.status === 'GREEN') {
        safeCount += 1;
      } else {
        criticalCount += 1;
      }
    }

    return { sealedCount, safeCount, criticalCount };
  }, [incomingBatches, isBatchScanUnlocked]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      {/* Curved Navy Header Matching Kitchen & Admin Proportions */}
      <View className="bg-[#0B2E59] px-4 pt-3.5 pb-10 rounded-b-[26px] flex-row items-center justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text
            numberOfLines={1}
            className="font-sans text-[10px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]"
          >
            KOORDINATOR SEKOLAH • {formatWibTime(simulatedNowMs)}
          </Text>
          <Text
            numberOfLines={1}
            className="font-sans text-[17px] font-extrabold text-white tracking-[-0.02em] mt-0.5"
          >
            {userProfile?.schoolName || 'Sekolah Penerima MBG'}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5 shrink-0">
          <Pressable
            onPress={() => setShowTutorial(true)}
            accessibilityLabel="Panduan Koordinator Sekolah"
            className="h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 border border-white/15 active:bg-white/20"
          >
            <HelpCircle size={16} color="#93C5FD" strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(school)/notifications' as any)}
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
            onPress={() => router.push('/(school)/profile' as any)}
            accessibilityLabel="Profil petugas"
            className="h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 border border-white/15 active:bg-white/20"
          >
            <User size={16} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Overlapping 3-Tile Summary Bento */}
      <View className="px-4 -mt-6 flex-row items-stretch gap-2.5 z-10">
        {[
          {
            label: 'Tersegel',
            value: summary.sealedCount,
            color: '#0F4C81',
            bg: '#EBF3FA',
            Icon: Lock,
          },
          {
            label: 'Aman',
            value: summary.safeCount,
            color: '#15803D',
            bg: '#DCFCE7',
            Icon: ShieldCheck,
          },
          {
            label: 'Kritis',
            value: summary.criticalCount,
            color: '#B45309',
            bg: '#FEF3C7',
            Icon: AlertTriangle,
          },
        ].map((tile) => {
          const TileIcon = tile.Icon;
          return (
            <View
              key={tile.label}
              className="flex-1 min-w-0 rounded-[14px] bg-white border border-[#D8E2EC] px-3 py-2.5 shadow-sm justify-between"
            >
              <View className="flex-row items-center justify-between gap-1 mb-1">
                <View
                  style={{ backgroundColor: tile.bg }}
                  className="h-7 w-7 rounded-[8px] items-center justify-center shrink-0"
                >
                  <TileIcon size={14} color={tile.color} />
                </View>
                <Text style={[styles.summaryValueMono, { color: tile.color }]}>
                  {tile.value}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={styles.summaryLabel}
              >
                {tile.label}
              </Text>
            </View>
          );
        })}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick 1-Tap Launch to Clean Scanner Tab */}
        <Pressable
          onPress={() => router.push('/(school)/scan-qr' as any)}
          className="rounded-[14px] bg-[#0F4C81] p-3.5 flex-row items-center justify-between gap-3 active:bg-[#0B2E59] shadow-xs"
        >
          <View className="flex-row items-center gap-3 flex-1 min-w-0">
            <View className="h-10 w-10 rounded-[10px] bg-white/15 border border-white/20 items-center justify-center shrink-0">
              <QrCode size={20} color="#FFFFFF" strokeWidth={2} />
            </View>
            <View className="flex-1 min-w-0">
              <Text numberOfLines={1} className="font-sans text-[14px] font-bold text-white">
                Pindai QR Boks Masuk
              </Text>
              <Text numberOfLines={1} className="font-sans text-[11px] text-[#BFDBFE] mt-0.5">
                Buka kamera pemindai segel resmi atau input manual
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#FFFFFF" className="shrink-0" />
        </Pressable>

        {showGuideStrip ? (
          <Pressable
            onPress={() => setShowTutorial(true)}
            className="rounded-[12px] border border-[#BDD5EB] bg-[#EBF3FA] px-3 py-2.5 flex-row items-center justify-between gap-2 active:bg-[#DBEAFE]"
          >
            <View className="flex-row items-center gap-2 flex-1 min-w-0">
              <HelpCircle size={15} color="#0F4C81" className="shrink-0" />
              <Text
                numberOfLines={1}
                className="font-sans text-[11.5px] font-bold text-[#0B2E59] flex-1 min-w-0"
              >
                Baru pertama kali? Lihat cara scan &amp; terima boks →
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                dismissGuideStrip();
              }}
              hitSlop={8}
              className="p-0.5 shrink-0"
            >
              <X size={14} color="#64748B" />
            </Pressable>
          </Pressable>
        ) : null}

        <View className="flex-row items-center justify-between gap-2 pt-1">
          <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            ANTRIAN BOKS MASUK HARI INI
          </Text>
          <Text style={styles.incomingCountMono}>{incomingBatches.length} Boks</Text>
        </View>

        {incomingBatches.length === 0 ? (
          <EmptyStateCard
            icon={<QrCode size={26} color="#0F4C81" />}
            title="Belum ada boks kiriman hari ini"
            description="Saat Dapur SPPG mengirim makanan, daftar boks tersegel akan muncul di sini atau Anda bisa langsung memindai QR stiker fisik."
            actionLabel="Buka Pemindai QR"
            onAction={() => router.push('/(school)/scan-qr' as any)}
          />
        ) : (
          incomingBatches.map(({ batch, evaluation }) => {
            const isUnlocked = isBatchScanUnlocked(batch.id);

            if (!isUnlocked) {
              return (
                <Pressable
                  key={batch.id}
                  onPress={() => {
                    hapticsAdapter.selection();
                    showToast(
                      'Arahkan kamera ke stiker QR fisik boks lalu tekan Mulai Pindai QR.',
                      'info'
                    );
                    router.push('/(school)/scan-qr' as any);
                  }}
                  className="w-full rounded-[14px] border border-[#D8E2EC] bg-white overflow-hidden flex-row active:opacity-90 shadow-xs"
                >
                  <View style={{ width: 4, backgroundColor: '#0F4C81' }} />
                  <View className="flex-1 min-w-0 p-3 flex-row items-center gap-3">
                    <View className="h-10 w-10 rounded-[10px] bg-[#EBF3FA] border border-[#BDD5EB] items-center justify-center relative shrink-0">
                      <Package size={18} color="#0F4C81" />
                      <View className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#0F4C81] items-center justify-center border border-white">
                        <Lock size={9} color="#FFFFFF" />
                      </View>
                    </View>

                    <View className="flex-1 min-w-0 gap-1">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text
                          numberOfLines={1}
                          style={styles.batchIdMono}
                          className="flex-1 min-w-0"
                        >
                          {batch.boxNumber || 'Boks #01'} • {batch.kitchenName || 'Dapur SPPG'}
                        </Text>
                        <Text style={styles.omprengCountMono} className="shrink-0">
                          {batch.omprengCount} Ompreng
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between gap-2">
                        <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                          <PulseDot color="#0F4C81" size={5} />
                          <Text
                            numberOfLines={1}
                            className="font-sans text-[11px] font-medium text-[#64748B] flex-1 min-w-0"
                          >
                            Ketuk untuk Pindai QR Fisik
                          </Text>
                        </View>
                        <View className="px-2 py-0.5 rounded-[6px] border bg-[#EBF3FA] border-[#BDD5EB] flex-row items-center gap-1 shrink-0">
                          <Camera size={10} color="#0F4C81" />
                          <Text className="font-sans text-[9.5px] font-bold uppercase tracking-[0.04em] text-[#0F4C81]">
                            TERSEGEL
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            }

            const isGreen = evaluation.status === 'GREEN';
            const isYellow = evaluation.status === 'YELLOW';

            const accentColor = isGreen ? '#15803D' : isYellow ? '#B45309' : '#B91C1C';
            const pillBg = isGreen
              ? 'bg-[#DCFCE7] border-[#86EFAC]'
              : isYellow
                ? 'bg-[#FEF3C7] border-[#FCD34D]'
                : 'bg-[#FEE2E2] border-[#FCA5A5]';
            const pillTextColor = isGreen
              ? 'text-[#14532D]'
              : isYellow
                ? 'text-[#78350F]'
                : 'text-[#7F1D1D]';

            return (
              <Pressable
                key={batch.id}
                onPress={() =>
                  router.push({
                    pathname: '/(school)/scan/[id]',
                    params: { id: batch.id },
                  })
                }
                className="w-full rounded-[14px] border border-[#D8E2EC] bg-white overflow-hidden flex-row active:opacity-90 shadow-xs"
              >
                <View style={{ width: 4, backgroundColor: accentColor }} />
                <View className="flex-1 min-w-0 p-3 gap-1.5">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text numberOfLines={1} style={styles.batchIdMono} className="flex-1 min-w-0">
                      {batch.id}
                    </Text>
                    <View className={`px-2 py-0.5 rounded-[5px] border shrink-0 ${pillBg}`}>
                      <Text className={`font-sans text-[9.5px] font-bold uppercase ${pillTextColor}`}>
                        {evaluation.verdictBadge}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between gap-2">
                    <Text
                      numberOfLines={1}
                      className="font-sans text-[12px] font-semibold text-[#0F172A] flex-1 min-w-0"
                    >
                      {batch.schoolName}
                    </Text>
                    <Text style={styles.omprengCountMono} className="shrink-0">
                      {batch.omprengReceivedCount ?? batch.omprengCount} Ompreng
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between gap-2 pt-1.5 border-t border-[#EDF2F7]">
                    <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                      {isGreen ? <PulseDot color="#15803D" size={5} /> : null}
                      <Text
                        numberOfLines={1}
                        style={[styles.timerMono, { color: accentColor }]}
                        className="flex-1 min-w-0"
                      >
                        {evaluation.isExpired
                          ? 'KEDALUWARSA — TERKUNCI'
                          : `${formatCountdown(evaluation.remainingMs)} tersisa`}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-0.5 shrink-0">
                      <Text className="font-sans text-[11px] font-bold text-[#0F4C81]">
                        Lihat Status
                      </Text>
                      <ChevronRight size={13} color="#0F4C81" />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <RoleTutorialModal
        visible={showTutorial}
        audience="school"
        onClose={() => setShowTutorial(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  summaryValueMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 20,
    lineHeight: 24,
  },
  summaryLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  incomingCountMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#475569',
  },
  batchIdMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    color: '#0F172A',
  },
  omprengCountMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#475569',
  },
  timerMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 12,
  },
});
