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
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Clock,
  Layers,
  Package,
  Truck,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../src/components/ui/CivicButton';
import { HairlineCard } from '../../src/components/ui/HairlineCard';
import { StepHeader } from '../../src/components/ui/StepHeader';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { formatWibTime } from '../../src/domain/weakestLinkEngine';
import type { AppNotification } from '../../src/types/sajiaman';

export default function SchoolNotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    userProfile,
    isBatchScanUnlocked,
    markNotificationRead,
    markAllNotificationsRead,
    showToast,
  } = useSajiAman();

  // Filter for school unit & general
  const schoolNotifs = useMemo(() => {
    return notifications
      .filter(
        (n) =>
          (!n.recipientRole || n.recipientRole === 'school') &&
          (!userProfile?.schoolId || !n.schoolId || n.schoolId === userProfile.schoolId)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [notifications, userProfile?.schoolId]);

  const unreadCount = schoolNotifs.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      showToast('Semua notifikasi ditandai dibaca', 'info');
    } catch (err: any) {
      showToast('Gagal memperbarui status: ' + err.message, 'warning');
    }
  };

  const handlePressNotif = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await markNotificationRead(notif.id);
    }
    const targetId = notif.batchCode || notif.batchId;
    if (targetId) {
      if (notif.type === 'new_batch' && !isBatchScanUnlocked(targetId)) {
        showToast(
          'Pindai QR stiker pada boks fisik (atau gunakan Input Kode Manual) saat kiriman tiba.',
          'info'
        );
        router.replace('/(school)/scan-qr' as any);
        return;
      }
      router.push(`/(school)/batch/${targetId}` as any);
    }
  };

  const getNotifStyle = (type: AppNotification['type']) => {
    switch (type) {
      case 'batch_voided':
        return {
          bg: '#FEF2F2',
          border: '#FCA5A5',
          iconColor: '#DC2626',
          badgeBg: '#FEE2E2',
          badgeText: '#DC2626',
          badgeLabel: 'DIBATALKAN SPPG',
          Icon: AlertOctagon,
        };
      case 'new_batch':
        return {
          bg: '#F0FDF4',
          border: '#86EFAC',
          iconColor: '#16A34A',
          badgeBg: '#DCFCE7',
          badgeText: '#15803D',
          badgeLabel: 'BOKS DIKIRIM',
          Icon: Package,
        };
      case 'ompreng_ready':
        return {
          bg: '#EEF2FF',
          border: '#C7D2FE',
          iconColor: '#4F46E5',
          badgeBg: '#E0E7FF',
          badgeText: '#3730A3',
          badgeLabel: 'JEMPUT OMPRENG',
          Icon: Truck,
        };
      case 'early_spoilage':
        return {
          bg: '#FEF2F2',
          border: '#FCA5A5',
          iconColor: '#DC2626',
          badgeBg: '#FEE2E2',
          badgeText: '#DC2626',
          badgeLabel: 'BOKS DITOLAK',
          Icon: AlertTriangle,
        };
      case 'ompreng_discrepancy':
      default:
        return {
          bg: '#FFFBEB',
          border: '#FCD34D',
          iconColor: '#D97706',
          badgeBg: '#FEF3C7',
          badgeText: '#B45309',
          badgeLabel: 'SELISIH OMPRENG',
          Icon: Layers,
        };
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        eyebrow={userProfile?.schoolName || 'KOORDINATOR SEKOLAH MBG'}
        title="Pusat Notifikasi Operasional"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Subheader Action Bar */}
        <View className="flex-row items-center justify-between flex-wrap gap-2 mt-4 mb-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              Daftar Pemberitahuan
            </Text>
            {unreadCount > 0 && (
              <View className="bg-[#DC2626] px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-black text-white">
                  {unreadCount} Baru
                </Text>
              </View>
            )}
          </View>

          {unreadCount > 0 && (
            <Pressable
              onPress={handleMarkAllRead}
              className="flex-row items-center gap-1.5 py-1 px-2.5 rounded-lg bg-white border border-[#CBD5E1] active:bg-[#F1F5F9] shrink-0"
            >
              <CheckCheck size={14} color="#0F4C81" />
              <Text className="text-xs font-bold text-[#0F4C81]">
                Tandai Semua Dibaca
              </Text>
            </Pressable>
          )}
        </View>

        {/* Notifications List */}
        <View className="gap-2.5">
          {schoolNotifs.length === 0 ? (
            <HairlineCard className="p-8 bg-white items-center justify-center">
              <BellOff size={36} color="#94A3B8" />
              <Text className="text-sm font-bold text-[#475569] mt-3">
                Belum ada notifikasi baru
              </Text>
              <Text className="text-xs text-[#94A3B8] text-center mt-1">
                Pemberitahuan boks baru dari Dapur SPPG dan jadwal penjemputan ompreng akan tampil di sini.
              </Text>
            </HairlineCard>
          ) : (
            schoolNotifs.map((notif) => {
              const style = getNotifStyle(notif.type);
              const IconComp = style.Icon;
              const targetCode = notif.batchCode || notif.batchId;
              const isLockedNewBatch =
                notif.type === 'new_batch' &&
                Boolean(targetCode) &&
                !isBatchScanUnlocked(String(targetCode));

              return (
                <Pressable
                  key={notif.id}
                  onPress={() => handlePressNotif(notif)}
                  className="active:opacity-80"
                >
                  <HairlineCard
                    className={`p-3.5 bg-white ${
                      !notif.isRead
                        ? 'border-l-4 border-l-[#0F4C81]'
                        : 'border-[#E2E8F0] opacity-80'
                    }`}
                  >
                    <View className="flex-row items-start gap-3">
                      <View
                        className="h-8 w-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: style.badgeBg }}
                      >
                        <IconComp size={16} color={style.iconColor} />
                      </View>

                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center justify-between mb-1 gap-2">
                          <View
                            className="px-2 py-0.5 rounded"
                            style={{ backgroundColor: style.badgeBg }}
                          >
                            <Text
                              className="text-[10px] font-black"
                              style={{ color: style.badgeText }}
                            >
                              {style.badgeLabel}
                            </Text>
                          </View>

                          <View className="flex-row items-center gap-1 shrink-0">
                            <Clock size={11} color="#94A3B8" />
                            <Text className="text-[10px] text-[#94A3B8]">
                              {formatWibTime(notif.createdAt)}
                            </Text>
                            {notif.batchId && <ChevronRight size={13} color="#0F4C81" />}
                          </View>
                        </View>

                        <Text className="text-sm font-bold text-[#0F172A] mb-0.5">
                          {notif.title}
                        </Text>
                        <Text className="text-xs text-[#475569] leading-relaxed">
                          {isLockedNewBatch
                            ? 'Kiriman boks baru dalam perjalanan. Pindai QR fisik saat tiba untuk membuka batas aman.'
                            : notif.message}
                        </Text>
                      </View>
                    </View>
                  </HairlineCard>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
