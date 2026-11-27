import React, { useMemo } from 'react';
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
  CheckCircle2,
  ChevronRight,
  QrCode,
  Recycle,
  User,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../../../src/components/ui/EmptyStateCard';
import { HairlineCard } from '../../../src/components/ui/HairlineCard';
import { useSajiAman } from '../../../src/context/SajiAmanContext';
import { evaluateBatchSafety, formatWibTime } from '../../../src/domain/weakestLinkEngine';

export default function SchoolHistoryScreen() {
  const router = useRouter();
  const {
    batches,
    notifications,
    userProfile,
    maggotReports,
    simulatedNowMs,
    markOmprengReadyForPickup,
  } = useSajiAman();

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

  const schoolName = userProfile?.schoolName || 'Sekolah Penerima MBG';
  const acceptedBatches = batches.filter(
    (b) =>
      (!userProfile?.schoolId || b.schoolId === userProfile.schoolId) &&
      (b.omprengStatus === 'received_school' ||
        b.omprengStatus === 'returned_sterilized')
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#0B2E59]">
      <View className="bg-[#0B2E59] px-4 py-3 flex-row items-center justify-between gap-2 border-b border-[#1E3A5F]">
        <View className="flex-1 min-w-0">
          <Text numberOfLines={1} className="font-sans text-[10px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]">
            {schoolName} • LOG HARIAN
          </Text>
          <Text numberOfLines={1} className="font-sans text-[17px] font-extrabold text-white tracking-[-0.02em] mt-0.5">
            Riwayat Boks &amp; Lapor Sisa
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5 shrink-0">
          <Pressable
            onPress={() => router.push('/(school)/notifications' as any)}
            accessibilityLabel="Pusat notifikasi"
            className="h-9 w-9 items-center justify-center rounded-[8px] bg-white/10 border border-white/15 active:bg-white/20 relative"
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
            className="h-9 w-9 items-center justify-center rounded-[8px] bg-white/10 border border-white/15 active:bg-white/20"
          >
            <User size={16} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-[#F4F7FA]"
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Accepted Batches Section */}
        <View className="gap-2.5">
          <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            BOKS DITERIMA SEKOLAH ({acceptedBatches.length})
          </Text>

          {acceptedBatches.length === 0 ? (
            <EmptyStateCard
              icon={<QrCode size={26} color="#0F4C81" />}
              title="Belum ada boks diterima hari ini"
              description="Pindai segel QR pada boks kiriman dari Dapur SPPG lalu konfirmasi penerimaan agar tercatat di log harian sekolah."
              actionLabel="Buka Pemindai QR"
              onAction={() => router.push('/(school)/scan-qr' as any)}
            />
          ) : (
            acceptedBatches.map((batch, idx) => {
              const ev = evaluateBatchSafety(batch, simulatedNowMs);
              const isLast = idx === acceptedBatches.length - 1;
              const nodeColor =
                ev.status === 'GREEN'
                  ? '#15803D'
                  : ev.status === 'YELLOW'
                    ? '#D97706'
                    : '#DC2626';
              return (
                <View key={batch.id} className="flex-row items-stretch gap-2.5">
                  <View className="items-center w-4 pt-4">
                    <View
                      style={{ backgroundColor: nodeColor }}
                      className="h-3 w-3 rounded-full border-2 border-white shadow-xs"
                    />
                    {!isLast ? <View className="w-[1.5px] flex-1 bg-[#CBD5E1] mt-1" /> : null}
                  </View>

                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(school)/batch/[id]',
                        params: { id: batch.id },
                      })
                    }
                    className="flex-1 rounded-[12px] border border-[#D8E2EC] bg-white p-3.5 gap-2 active:bg-[#F4F7FA] mb-1"
                  >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text numberOfLines={1} style={styles.batchIdMono} className="flex-1 min-w-0">
                      {batch.id}
                    </Text>
                    <View className="flex-row items-center gap-1 shrink-0">
                      <CheckCircle2 size={14} color="#15803D" />
                      <Text style={styles.omprengCountGreen}>
                        {batch.omprengReceivedCount ?? batch.omprengCount} Ompreng
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
                    <Text style={styles.statusBadgeMono} className="shrink-0">{ev.verdictBadge}</Text>
                  </View>

                  {batch.omprengStatus === 'received_school' && (
                    <View className="pt-2 border-t border-[#EDF2F7]">
                      {batch.omprengReadyForPickup ? (
                        <View className="flex-row items-center gap-1.5 py-1 px-2.5 rounded-[6px] bg-[#EEF2FF] border border-[#C7D2FE] self-start">
                          <CheckCircle2 size={13} color="#3730A3" />
                          <Text className="font-sans text-[11px] font-bold text-[#3730A3]">
                            Ompreng Siap Dijemput Dapur
                          </Text>
                        </View>
                      ) : (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            markOmprengReadyForPickup(batch.id);
                          }}
                          className="py-1.5 px-3 rounded-[6px] bg-[#0F4C81] flex-row items-center justify-center gap-1.5 active:bg-[#0B2E59]"
                        >
                          <Text className="font-sans text-[11px] font-bold text-white">
                            🚚 Tandai Ompreng Selesai &amp; Siap Dijemput
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  <View className="pt-2 border-t border-[#EDF2F7] flex-row items-center justify-between gap-2">
                    <Text numberOfLines={1} className="font-sans text-[11px] text-[#475569] flex-1 min-w-0">
                      Dikonfirmasi{' '}
                      {formatWibTime(batch.omprengConfirmedAt ?? batch.cookedAt)}
                    </Text>
                    <View className="flex-row items-center gap-0.5 shrink-0">
                      <Text className="font-sans text-[11px] font-bold text-[#0F4C81]">
                        Buka Detail
                      </Text>
                      <ChevronRight size={14} color="#0F4C81" />
                    </View>
                  </View>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        {/* Submitted Maggot Reports Section */}
        <View className="gap-2.5">
          <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            LAPORAN JALUR MAGGOT BSF ({maggotReports.length})
          </Text>

          {maggotReports.map((report) => {
            const isPending = report.status === 'pending_pickup';
            return (
              <HairlineCard key={report.id} className="gap-2">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                    <Recycle size={14} color="#15803D" className="shrink-0" />
                    <Text numberOfLines={1} style={styles.reportBatchMono} className="flex-1 min-w-0">
                      {report.batchId}
                    </Text>
                  </View>
                  <View
                    className={`px-2 py-0.5 rounded-[5px] border shrink-0 ${
                      isPending
                        ? 'bg-[#FEF3C7] border-[#FCD34D]'
                        : 'bg-[#DCFCE7] border-[#86EFAC]'
                    }`}
                  >
                    <Text
                      className={`font-sans text-[10px] font-bold uppercase ${
                        isPending ? 'text-[#78350F]' : 'text-[#14532D]'
                      }`}
                    >
                      {isPending ? 'Siap Dijemput' : 'Dijemput Mitra BSF'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between gap-2">
                  <Text numberOfLines={1} className="font-sans text-[12px] font-semibold text-[#0F172A] flex-1 min-w-0">
                    {report.schoolName}
                  </Text>
                  <Text style={styles.volumeTagMono} className="shrink-0">
                    {report.volumeLabel}
                  </Text>
                </View>

                <Text className="font-sans text-[11px] text-[#475569]">
                  {report.locationNote}
                </Text>
              </HairlineCard>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  batchIdMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    color: '#0F172A',
  },
  omprengCountGreen: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#15803D',
  },
  statusBadgeMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#475569',
  },
  reportBatchMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: '#0F172A',
  },
  volumeTagMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: '#0F4C81',
  },
});
