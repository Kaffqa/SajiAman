import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Archive,
  Bell,
  BellRing,
  BookOpen,
  Building2,
  Check,
  ChefHat,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Phone,
  QrCode,
  Recycle,
  School,
  ShieldCheck,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../components/ui/CivicButton';
import { ConfirmLogoutModal } from '../../components/ui/ConfirmLogoutModal';
import { RoleTutorialModal } from '../../components/ui/RoleTutorialModal';
import { StepHeader } from '../../components/ui/StepHeader';
import { useSajiAman } from '../../context/SajiAmanContext';
import { formatWibTime } from '../../domain/weakestLinkEngine';
import { supabase } from '../../lib/supabase';
import {
  checkNotificationPermissionStatus,
  requestNotificationPermissions,
} from '../../adapters/notificationsAdapter';

interface ProfileSettingsScreenProps {
  currentRole: 'kitchen' | 'school' | 'admin';
  onBack: () => void;
}

export const ProfileSettingsScreen: React.FC<ProfileSettingsScreenProps> = ({
  currentRole,
  onBack,
}) => {
  const router = useRouter();
  const {
    userProfile,
    kitchenProfile,
    dataSource,
    simulatedNowMs,
    realtimeStatus,
    refreshUserProfile,
    logoutToRoleSelect,
    showToast,
  } = useSajiAman();

  const isKitchen = currentRole === 'kitchen';
  const isAdmin = currentRole === 'admin';

  const officerName =
    userProfile?.fullName || (isAdmin ? 'Admin BGN Pusat' : isKitchen ? kitchenProfile.picName : 'Koordinator Sekolah');
  const institutionName =
    userProfile?.kitchenName ||
    userProfile?.schoolName ||
    (isAdmin ? 'Badan Gizi Nasional (BGN Pusat)' : isKitchen ? kitchenProfile.name : 'Sekolah Penerima MBG');
  const officerEmail =
    userProfile?.email || (isAdmin ? 'admin@bgn.sajiaman.id' : isKitchen ? kitchenProfile.email : 'petugas@sajiaman.id');

  const [phoneWa, setPhoneWa] = useState(userProfile?.phoneWa || '');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hasNotifPermission, setHasNotifPermission] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [expandWorkflow, setExpandWorkflow] = useState(false);
  const [expandWeakestLink, setExpandWeakestLink] = useState(false);

  useEffect(() => {
    checkNotificationPermissionStatus().then(setHasNotifPermission);
  }, []);

  const handleToggleNotif = async () => {
    const granted = await requestNotificationPermissions();
    setHasNotifPermission(granted);
    if (granted) {
      showToast('Izin notifikasi alarm keselamatan pangan aktif', 'success');
    } else {
      showToast('Izin notifikasi dinonaktifkan atau belum diizinkan sistem', 'warning');
    }
  };

  useEffect(() => {
    setPhoneWa(userProfile?.phoneWa || '');
  }, [userProfile?.phoneWa]);

  const handleSavePhone = async () => {
    const cleanPhone = phoneWa.trim();
    if (!cleanPhone) {
      showToast('Nomor WhatsApp tidak boleh kosong', 'warning');
      return;
    }

    if (dataSource === 'supabase' && userProfile?.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ phone_wa: cleanPhone })
          .eq('id', userProfile.id);
        if (error) {
          setPhoneWa(userProfile.phoneWa || '');
          setIsEditingPhone(false);
          showToast(error.message || 'Gagal memperbarui nomor WhatsApp', 'warning');
          return;
        }
        await refreshUserProfile();
      } catch (e: any) {
        setPhoneWa(userProfile.phoneWa || '');
        setIsEditingPhone(false);
        showToast(e?.message || 'Gagal terhubung saat memperbarui nomor WhatsApp', 'warning');
        return;
      }
    }

    setIsEditingPhone(false);
    showToast('Nomor WhatsApp petugas berhasil diperbarui', 'success');
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logoutToRoleSelect();
    router.replace('/(auth)/login' as any);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        title="Profil & Pengaturan"
        eyebrow={institutionName.toUpperCase()}
        onBack={onBack}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Officer Identity Card */}
        <View className="bg-white rounded-[14px] border border-[#D8E2EC] p-4 gap-3.5 mb-4 shadow-sm">
          <View className="flex-row items-start justify-between gap-2.5 border-b border-[#EDF2F7] pb-3">
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
              <View className="h-12 w-12 rounded-[14px] bg-[#0F4C81] border-2 border-[#BDD5EB] items-center justify-center shrink-0 shadow-xs">
                {isAdmin ? (
                  <ShieldCheck size={24} color="#FFFFFF" strokeWidth={2} />
                ) : isKitchen ? (
                  <ChefHat size={24} color="#FFFFFF" strokeWidth={2} />
                ) : (
                  <School size={24} color="#FFFFFF" strokeWidth={2} />
                )}
              </View>
              <View className="flex-1 min-w-0">
                <Text
                  numberOfLines={2}
                  className="font-sans text-[15px] leading-[20px] font-bold text-[#0F172A]"
                >
                  {officerName}
                </Text>
                <Text
                  numberOfLines={1}
                  className="font-sans text-[12px] text-[#64748B] mt-0.5"
                >
                  {officerEmail}
                </Text>
              </View>
            </View>
            <View
              className={`px-2.5 py-1 rounded-[6px] border shrink-0 self-start ${
                isAdmin
                  ? 'bg-[#0B2E59] border-[#0B2E59]'
                  : 'bg-[#EBF3FA] border-[#BDD5EB]'
              }`}
            >
              <Text
                style={[
                  styles.roleBadge,
                  isAdmin ? { color: '#FFFFFF' } : null,
                ]}
              >
                {isAdmin ? 'ADMIN BGN' : isKitchen ? 'CHEF SPPG' : 'KORLAP SEKOLAH'}
              </Text>
            </View>
          </View>

          {/* Unit / Institution */}
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-row items-center gap-2 shrink-0 pt-0.5">
              <Building2 size={16} color="#64748B" />
              <Text className="font-sans text-[12px] text-[#475569]">
                Unit Penugasan
              </Text>
            </View>
            <Text
              numberOfLines={2}
              className="flex-1 text-right font-sans text-[13px] font-bold text-[#0B2E59]"
            >
              {institutionName}
            </Text>
          </View>

          {/* WhatsApp Phone */}
          <View className="flex-row items-center justify-between gap-3 pt-2 border-t border-[#EDF2F7]">
            <View className="flex-row items-center gap-2 shrink-0">
              <Phone size={16} color="#64748B" />
              <Text className="font-sans text-[12px] text-[#475569]">
                Nomor WhatsApp
              </Text>
            </View>
            {isEditingPhone ? (
              <View className="flex-row items-center gap-1.5 flex-1 justify-end">
                <TextInput
                  value={phoneWa}
                  onChangeText={setPhoneWa}
                  keyboardType="phone-pad"
                  placeholder="08..."
                  className="font-sans text-[12px] font-bold text-[#0F172A] border border-[#CBD5E1] rounded-[6px] px-2 py-1 bg-white min-w-[120px] max-w-[160px]"
                />
                <Pressable
                  onPress={handleSavePhone}
                  className="p-1.5 rounded-[6px] bg-[#15803D] shrink-0"
                >
                  <Check size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setIsEditingPhone(true)}
                className="flex-row items-center gap-1.5 flex-1 justify-end"
              >
                <Text style={styles.phoneMono} numberOfLines={1}>
                  {phoneWa ? phoneWa : 'Belum diisi'}
                </Text>
                <Text className="font-sans text-[11px] font-semibold text-[#0F4C81] shrink-0">
                  • Ubah
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Pusat Panduan & Tutorial SajiAman */}
        <View className="bg-white rounded-[14px] border border-[#D8E2EC] overflow-hidden mb-4 shadow-sm">
          <View className="px-4 py-2.5 bg-[#EBF3FA] border-b border-[#BDD5EB] flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <BookOpen size={14} color="#0F4C81" />
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#0B2E59]">
                PUSAT PANDUAN &amp; TUTORIAL
              </Text>
            </View>
            <Text className="font-mono text-[10px] font-bold text-[#0F4C81]">
              {isAdmin ? 'ADMIN' : isKitchen ? 'SPPG' : 'SEKOLAH'}
            </Text>
          </View>

          {/* 1. Interactive Tour Trigger */}
          <Pressable
            onPress={() => setShowTutorial(true)}
            className="px-4 py-3.5 flex-row items-center justify-between border-b border-[#EDF2F7] active:bg-[#F4F7FA]"
          >
            <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-2">
              <View className="h-9 w-9 rounded-[10px] bg-[#EBF3FA] items-center justify-center shrink-0">
                <HelpCircle size={18} color="#0F4C81" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="font-sans text-[13.5px] font-bold text-[#0F172A]">
                  Tur Cara Pakai Aplikasi
                </Text>
                <Text numberOfLines={1} className="font-sans text-[11.5px] text-[#64748B]">
                  Panduan visual 3 langkah sesuai peran Anda
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#0F4C81" />
          </Pressable>

          {/* 2. End-to-End Flow Accordion */}
          <View className="border-b border-[#EDF2F7]">
            <Pressable
              onPress={() => setExpandWorkflow((prev) => !prev)}
              className="px-4 py-3.5 flex-row items-center justify-between active:bg-[#F4F7FA]"
            >
              <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-2">
                <View className="h-9 w-9 rounded-[10px] bg-[#DCFCE7] items-center justify-center shrink-0">
                  <QrCode size={18} color="#15803D" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="font-sans text-[13.5px] font-bold text-[#0F172A]">
                    Alur Program Hulu ke Hilir
                  </Text>
                  <Text numberOfLines={1} className="font-sans text-[11.5px] text-[#64748B]">
                    Dapur SPPG → Segel QR → Sekolah → Maggot BSF
                  </Text>
                </View>
              </View>
              {expandWorkflow ? (
                <ChevronUp size={18} color="#64748B" />
              ) : (
                <ChevronDown size={18} color="#64748B" />
              )}
            </Pressable>

            {expandWorkflow ? (
              <View className="px-4 pb-3.5 pt-1 bg-[#F8FAFC] gap-2">
                {[
                  {
                    num: '1',
                    title: 'Produksi Dapur SPPG',
                    desc: 'Pilih sekolah & menu; jam aman dikunci berdasar menu paling cepat basi.',
                    color: '#0F4C81',
                  },
                  {
                    num: '2',
                    title: 'Segel QR Fisik',
                    desc: 'QR ditempel pada boks. Di sekolah, boks berstatus TERSEGEL sebelum dipindai.',
                    color: '#4338CA',
                  },
                  {
                    num: '3',
                    title: 'Verifikasi Koordinator Sekolah',
                    desc: 'Scan QR membuka sisa waktu aman, cek lampu status, lalu konfirmasi terima.',
                    color: '#B45309',
                  },
                  {
                    num: '4',
                    title: 'Retur Ompreng & Maggot BSF',
                    desc: 'Wadah kembali dicuci steril; sisa pangan/boks basi dijemput Mitra BSF.',
                    color: '#15803D',
                  },
                ].map((step) => (
                  <View key={step.num} className="flex-row items-start gap-2.5">
                    <View
                      style={{ backgroundColor: step.color }}
                      className="h-5 w-5 rounded-full items-center justify-center mt-0.5 shrink-0"
                    >
                      <Text className="font-mono text-[10px] font-bold text-white">
                        {step.num}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="font-sans text-[12px] font-bold text-[#0F172A]">
                        {step.title}
                      </Text>
                      <Text className="font-sans text-[11px] text-[#475569] leading-[15px]">
                        {step.desc}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* 3. Weakest-Link & 45-Minute Alarm Accordion */}
          <View>
            <Pressable
              onPress={() => setExpandWeakestLink((prev) => !prev)}
              className="px-4 py-3.5 flex-row items-center justify-between active:bg-[#F4F7FA]"
            >
              <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-2">
                <View className="h-9 w-9 rounded-[10px] bg-[#FEF3C7] items-center justify-center shrink-0">
                  <Recycle size={18} color="#B45309" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="font-sans text-[13.5px] font-bold text-[#0F172A]">
                    Aturan 45 Menit &amp; Weakest-Link
                  </Text>
                  <Text numberOfLines={1} className="font-sans text-[11.5px] text-[#64748B]">
                    Kenapa batas waktu berbeda &amp; terkunci jam server
                  </Text>
                </View>
              </View>
              {expandWeakestLink ? (
                <ChevronUp size={18} color="#64748B" />
              ) : (
                <ChevronDown size={18} color="#64748B" />
              )}
            </Pressable>

            {expandWeakestLink ? (
              <View className="px-4 pb-3.5 pt-1 bg-[#F8FAFC] gap-1.5">
                <Text className="font-sans text-[11.5px] text-[#334155] leading-[17px]">
                  • <Text className="font-bold">Weakest-Link:</Text> Satu komponen cepat basi (mis. sayur santan 3,5 jam) mengunci batas aman seluruh boks meski lauk kering tahan lebih lama.
                </Text>
                <Text className="font-sans text-[11.5px] text-[#334155] leading-[17px]">
                  • <Text className="font-bold">Status Kuning (&lt; 45 menit):</Text> Sistem membunyikan alarm agar makanan segera dibagikan sebelum kedaluwarsa.
                </Text>
                <Text className="font-sans text-[11.5px] text-[#334155] leading-[17px]">
                  • <Text className="font-bold">Anti-Tamper:</Text> Hitung mundur mengacu waktu server pusat sehingga pengubahan jam HP tidak membuka boks basi.
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Admin Center Shortcut */}
        {isAdmin && (
          <View className="bg-white rounded-[14px] border border-[#D8E2EC] overflow-hidden mb-4 shadow-sm">
            <Pressable
              onPress={onBack}
              className="px-4 py-3.5 flex-row items-center justify-between active:bg-[#F4F7FA]"
            >
              <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-2">
                <LayoutDashboard size={18} color="#0F4C81" />
                <View className="flex-1 min-w-0">
                  <Text className="font-sans text-[14px] font-bold text-[#0F172A]">
                    Kembali ke Dasbor BGN
                  </Text>
                  <Text className="font-sans text-[12px] text-[#64748B]" numberOfLines={1}>
                    Pengawasan unit SPPG, Sekolah, &amp; Akun
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </Pressable>
          </View>
        )}

        {/* OS-Level Safety Alarms Card (Operational Staff Only) */}
        {!isAdmin && (
          <View className="bg-white rounded-[14px] border border-[#D8E2EC] p-4 gap-3 mb-4 shadow-sm">
            <View className="flex-row items-center justify-between gap-2 border-b border-[#EDF2F7] pb-2.5">
              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                <BellRing size={16} color="#0B2E59" className="shrink-0" />
                <Text
                  numberOfLines={2}
                  className="flex-1 font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]"
                >
                  ALARM KESELAMATAN PANGAN (OS)
                </Text>
              </View>
              <View
                className={`px-2 py-0.5 rounded-[4px] border shrink-0 ${
                  hasNotifPermission
                    ? 'bg-[#DCFCE7] border-[#86EFAC]'
                    : 'bg-[#FEF3C7] border-[#FCD34D]'
                }`}
              >
                <Text
                  className={`font-sans text-[10px] font-bold uppercase ${
                    hasNotifPermission ? 'text-[#15803D]' : 'text-[#B45309]'
                  }`}
                >
                  {hasNotifPermission ? 'AKTIF' : 'NONAKTIF'}
                </Text>
              </View>
            </View>

            <Text className="font-sans text-[12px] text-[#475569] leading-[17px]">
              Alarm sistem berbunyi otomatis saat boks memasuki batas kuning 45 menit dan batas merah kedaluwarsa.
            </Text>

            <CivicButton
              variant={hasNotifPermission ? 'secondary' : 'primary'}
              size="sm"
              icon={<Bell size={16} color={hasNotifPermission ? '#0B2E59' : '#FFFFFF'} />}
              onPress={handleToggleNotif}
            >
              {hasNotifPermission ? 'Periksa / Segarkan Izin Alarm' : 'Aktifkan Izin Notifikasi & Suara'}
            </CivicButton>
          </View>
        )}

        {/* Kitchen Management Shortcuts */}
        {isKitchen && (
          <View className="bg-white rounded-[14px] border border-[#D8E2EC] overflow-hidden mb-4 shadow-sm">
            <View className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#EDF2F7]">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                PINTASAN OPERASIONAL DAPUR
              </Text>
            </View>

            <Pressable
              onPress={() => router.push('/(kitchen)/menu-catalog' as any)}
              className="px-4 py-3.5 flex-row items-center justify-between border-b border-[#EDF2F7] active:bg-[#F4F7FA]"
            >
              <View className="flex-row items-center gap-3">
                <BookOpen size={18} color="#0F4C81" />
                <View>
                  <Text className="font-sans text-[14px] font-bold text-[#0F172A]">
                    Kelola Katalog Menu
                  </Text>
                  <Text className="font-sans text-[12px] text-[#64748B]">
                    Atur batas waktu aman olahan pangan
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </Pressable>

            <Pressable
              onPress={() => router.push('/(kitchen)/schools' as any)}
              className="px-4 py-3.5 flex-row items-center justify-between border-b border-[#EDF2F7] active:bg-[#F4F7FA]"
            >
              <View className="flex-row items-center gap-3">
                <School size={18} color="#0F4C81" />
                <View>
                  <Text className="font-sans text-[14px] font-bold text-[#0F172A]">
                    Sekolah Binaan &amp; Inventaris
                  </Text>
                  <Text className="font-sans text-[12px] text-[#64748B]">
                    Alokasi porsi dan total stok ompreng
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </Pressable>

            <Pressable
              onPress={() => router.push('/(kitchen)/history' as any)}
              className="px-4 py-3.5 flex-row items-center justify-between active:bg-[#F4F7FA]"
            >
              <View className="flex-row items-center gap-3">
                <Archive size={18} color="#0F4C81" />
                <View>
                  <Text className="font-sans text-[14px] font-bold text-[#0F172A]">
                    Arsip Riwayat Produksi
                  </Text>
                  <Text className="font-sans text-[12px] text-[#64748B]">
                    Laporan kepatuhan aman &amp; ringkasan batch
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </Pressable>
          </View>
        )}

        {/* Logout Action Button */}
        <View className="mt-2">
          <CivicButton
            variant="danger"
            icon={<LogOut size={18} color="#FFFFFF" strokeWidth={2} />}
            onPress={() => setShowLogoutConfirm(true)}
          >
            Keluar dari Akun
          </CivicButton>
        </View>

        {/* Compact Status Footer */}
        <Text className="font-mono text-[10px] text-[#94A3B8] text-center mt-5">
          Sinkron {formatWibTime(simulatedNowMs)} • Koneksi{' '}
          {realtimeStatus === 'SUBSCRIBED' ? 'Realtime Aktif' : realtimeStatus === 'CONNECTING' ? 'Sinkronisasi...' : 'Lokal/Siaga'}
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmLogoutModal
        visible={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
      />

      <RoleTutorialModal
        visible={showTutorial}
        audience={currentRole}
        onClose={() => setShowTutorial(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  roleBadge: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: '#0F4C81',
    letterSpacing: 0.5,
  },
  phoneMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 12,
    color: '#0F172A',
  },
});
