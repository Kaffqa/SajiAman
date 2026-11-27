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
  CheckCircle2,
  Leaf,
  MapPin,
  Recycle,
  Truck,
  User,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircularGaugeSvg } from '../../../src/components/ui/CircularGaugeSvg';
import { CivicButton } from '../../../src/components/ui/CivicButton';
import { EmptyStateCard } from '../../../src/components/ui/EmptyStateCard';
import { HairlineCard } from '../../../src/components/ui/HairlineCard';
import { MonoCounter } from '../../../src/components/ui/MonoCounter';
import { PulseDot } from '../../../src/components/ui/PulseDot';
import { useSajiAman } from '../../../src/context/SajiAmanContext';
import { KITCHEN_PROFILE } from '../../../src/data/mockRepository';
import { formatWibTime } from '../../../src/domain/weakestLinkEngine';
import type { WasteCategory } from '../../../src/types/sajiaman';

function getCategoryBadge(cat: WasteCategory) {
  if (cat === 'expired_red') {
    return {
      label: 'Kedaluwarsa Merah',
      badgeBg: 'bg-[#FEE2E2] border-[#FCA5A5]',
      textColor: 'text-[#7F1D1D]',
    };
  }
  if (cat === 'surplus_intact') {
    return {
      label: 'Surplus Porsi',
      badgeBg: 'bg-[#FEF3C7] border-[#FCD34D]',
      textColor: 'text-[#78350F]',
    };
  }
  return {
    label: 'Sisa Pasca-Makan',
    badgeBg: 'bg-[#EBF3FA] border-[#BDD5EB]',
    textColor: 'text-[#0B2E59]',
  };
}

export default function MaggotDashboardScreen() {
  const router = useRouter();
  const {
    maggotReports,
    notifications,
    kitchenProfile,
    userProfile,
    totalPlasticsSaved,
    totalOrganicDivertedKg,
    pendingMaggotCount,
    dispatchBsfPartner,
  } = useSajiAman();

  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

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

  const kitchenLabel = userProfile?.kitchenName || kitchenProfile.name;

  const formattedPlastics = totalPlasticsSaved.toLocaleString('id-ID');
  const formattedKg = totalOrganicDivertedKg.toFixed(1).replace('.', ',');

  const handleDispatch = async (reportId: string) => {
    if (dispatchingId) return;
    setDispatchingId(reportId);
    try {
      await dispatchBsfPartner(reportId);
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#0B2E59]">
      {/* Consistent Navy Header */}
      <View className="bg-[#0B2E59] px-4 py-3 flex-row items-center justify-between gap-2 border-b border-[#1E3A5F]">
        <View className="flex-1 min-w-0">
          <Text numberOfLines={1} className="font-sans text-[10px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]">
            {kitchenLabel} • SIRKULAR BSF
          </Text>
          <Text numberOfLines={1} className="font-sans text-[17px] font-extrabold text-white tracking-[-0.02em] mt-0.5">
            Limbah &amp; Mitra Maggot
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5 shrink-0">
          <Pressable
            onPress={() => router.push('/(kitchen)/notifications' as any)}
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
            onPress={() => router.push('/(kitchen)/profile' as any)}
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
        {/* Asymmetric 2-Column Environmental Impact Bento */}
        <View className="flex-row items-stretch gap-3">
          {/* Left: Dark Navy Card */}
          <View className="flex-1 rounded-[12px] bg-[#0B2E59] p-3.5 justify-between gap-3 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="h-8 w-8 items-center justify-center rounded-[8px] bg-white/10">
                <Leaf size={16} color="#86EFAC" strokeWidth={2.2} />
              </View>
              <Text style={styles.cardHeaderMonoNavy}>0% PLASTIK</Text>
            </View>
            <View className="gap-1">
              <MonoCounter value={formattedPlastics} size="lg" color="#FFFFFF" />
              <Text className="font-sans text-[11px] leading-[15px] text-[#CBD5E1] font-medium">
                Kemasan Plastik Sekali Pakai Dicegah
              </Text>
            </View>
          </View>

          {/* Right: White Hairline Card with SVG Eco Gauge */}
          <View className="flex-1 rounded-[14px] bg-white border border-[#D8E2EC] p-3.5 justify-between gap-2.5 shadow-sm">
            <View className="flex-row items-center justify-between gap-1">
              <CircularGaugeSvg
                progress={1}
                size={40}
                strokeWidth={4}
                color="#15803D"
                trackColor="#DCFCE7"
                centerLabel="0%"
                centerTextColor="#15803D"
              />
              <Text style={styles.cardHeaderMonoGreen}>0 KG TPA</Text>
            </View>
            <View className="gap-1">
              <MonoCounter
                value={formattedKg}
                unit="kg"
                size="lg"
                color="#15803D"
              />
              <Text className="font-sans text-[11px] leading-[15px] text-[#475569] font-medium">
                Limbah Organik ke Pakan Maggot BSF
              </Text>
            </View>
          </View>
        </View>

        {/* Compact Mitra Biokonversi Strip (replaces bulky static banner) */}
        <View className="rounded-[10px] border border-[#BDD5EB] bg-[#EBF3FA] px-3.5 py-2.5 flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2 flex-1 min-w-0">
            <Truck size={15} color="#0F4C81" className="shrink-0" />
            <Text numberOfLines={1} className="font-sans text-[12px] font-bold text-[#0B2E59] flex-1 min-w-0">
              Mitra BSF: {kitchenProfile.partnerBsfName || 'Mitra BSF Maggot Jaya'}
            </Text>
          </View>
          <Text className="font-mono text-[10px] font-bold text-[#0F4C81] shrink-0">
            ZERO-WASTE
          </Text>
        </View>

        {/* Live Pickup Dispatch Queue */}
        <View className="gap-2.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text numberOfLines={1} className="flex-1 min-w-0 font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
              ANTREAN JEMPUT MITRA MAGGOT ({maggotReports.length})
            </Text>
            {pendingMaggotCount > 0 ? (
              <View className="px-2 py-0.5 rounded-[5px] bg-[#FEF3C7] border border-[#FCD34D] flex-row items-center gap-1 shrink-0">
                <PulseDot color="#D97706" size={5} />
                <Text style={styles.pendingTag}>
                  {pendingMaggotCount} MENUNGGU
                </Text>
              </View>
            ) : null}
          </View>

          {maggotReports.length === 0 ? (
            <EmptyStateCard
              icon={<Recycle size={28} color="#15803D" />}
              tintBg="#DCFCE7"
              tintBorder="#86EFAC"
              title="Belum ada laporan sisa makanan"
              description="Saat Koordinator Sekolah melaporkan sisa pasca-makan atau boks kedaluwarsa, antrean jemput Mitra BSF otomatis muncul di sini."
            />
          ) : (
            maggotReports.map((report) => {
            const cat = getCategoryBadge(report.category);
            const isPending = report.status === 'pending_pickup';

            return (
              <HairlineCard key={report.id} className="gap-3">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <Text
                      numberOfLines={1}
                      className="font-sans text-[15px] font-bold text-[#0F172A]"
                    >
                      {report.schoolName}
                    </Text>
                    <Text numberOfLines={1} style={styles.reportMetaMono}>
                      {report.batchId} • {formatWibTime(report.reportedAt)}
                    </Text>
                  </View>

                  <View
                    className={`px-2 py-1 rounded-[5px] border shrink-0 ${
                      isPending
                        ? 'bg-[#FEF3C7] border-[#FCD34D]'
                        : 'bg-[#DCFCE7] border-[#86EFAC]'
                    }`}
                  >
                    <Text
                      className={`font-sans text-[10px] font-bold uppercase tracking-[0.04em] ${
                        isPending ? 'text-[#78350F]' : 'text-[#14532D]'
                      }`}
                    >
                      {isPending ? 'Siap Dijemput' : 'Dijemput Mitra BSF'}
                    </Text>
                  </View>
                </View>

                {/* Volume & Category Details */}
                <View className="flex-row items-center justify-between gap-2 bg-[#F4F7FA] border border-[#D8E2EC] rounded-[8px] px-3 py-2">
                  <View className="flex-1 min-w-0">
                    <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                      ESTIMASI VOLUME
                    </Text>
                    <Text numberOfLines={1} style={styles.volumeLabelMono}>
                      {report.volumeLabel}
                    </Text>
                  </View>
                  <View className={`px-2 py-1 rounded-[5px] border shrink-0 ${cat.badgeBg}`}>
                    <Text className={`font-sans text-[10px] font-bold ${cat.textColor}`}>
                      {cat.label}
                    </Text>
                  </View>
                </View>

                {/* Location Note */}
                <View className="flex-row items-start gap-1.5">
                  <MapPin size={14} color="#64748B" style={{ marginTop: 2 }} />
                  <Text className="font-sans text-[12px] text-[#475569] leading-[16px] flex-1">
                    {report.locationNote}
                  </Text>
                </View>

                {/* Action CTA */}
                {isPending ? (
                  <CivicButton
                    variant="primary"
                    size="md"
                    loading={dispatchingId === report.id}
                    disabled={dispatchingId !== null}
                    icon={<Truck size={16} color="#FFFFFF" strokeWidth={2} />}
                    onPress={() => handleDispatch(report.id)}
                  >
                    Tugaskan Mitra BSF ({kitchenProfile.partnerBsfName || 'Mitra BSF Maggot Jaya'})
                  </CivicButton>
                ) : (
                  <View className="flex-row items-center justify-between rounded-[8px] bg-[#DCFCE7] border border-[#86EFAC] px-3 py-2 gap-2">
                    <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                      <CheckCircle2 size={14} color="#14532D" strokeWidth={2.2} className="shrink-0" />
                      <Text numberOfLines={1} className="font-sans text-[11px] font-semibold text-[#14532D] flex-1 min-w-0">
                        {report.assignedPartner ?? kitchenProfile.partnerBsfName ?? 'Mitra BSF Maggot Jaya'}
                      </Text>
                    </View>
                    <Text style={styles.dispatchedTimeMono} className="shrink-0">
                      {formatWibTime(report.dispatchedAt ?? report.reportedAt)}
                    </Text>
                  </View>
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
  cardHeaderMonoNavy: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 10,
    color: '#93C5FD',
  },
  cardHeaderMonoGreen: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 10,
    color: '#15803D',
  },
  auditBgnTag: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },
  pendingTag: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 10,
    color: '#78350F',
  },
  reportMetaMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  volumeLabelMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    color: '#0F172A',
  },
  dispatchedTimeMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#14532D',
  },
});
