import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Edit3,
  Layers,
  MessageCircle,
  School,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../src/components/ui/CivicButton';
import { HairlineCard } from '../../src/components/ui/HairlineCard';
import { StepHeader } from '../../src/components/ui/StepHeader';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { supabaseRepository } from '../../src/data/supabaseRepository';
import type { KitchenProfile, SchoolProfile } from '../../src/types/sajiaman';

function normalizeWhatsappNumber(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export default function SchoolsManagementScreen() {
  const router = useRouter();
  const {
    schools: ctxSchools,
    kitchenProfile: ctxKitchenProfile,
    userProfile,
    dataSource,
    refreshKitchenProfile,
    showToast,
  } = useSajiAman();

  const [schools, setSchools] = useState<SchoolProfile[]>(ctxSchools);
  const [kitchenProfile, setKitchenProfile] = useState<KitchenProfile>(ctxKitchenProfile);

  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [newInventoryCount, setNewInventoryCount] = useState(
    String(ctxKitchenProfile.totalOmprengInventory)
  );
  const [isSubmittingInventory, setIsSubmittingInventory] = useState(false);

  useEffect(() => {
    setSchools(ctxSchools);
  }, [ctxSchools]);

  useEffect(() => {
    setKitchenProfile(ctxKitchenProfile);
    setNewInventoryCount(String(ctxKitchenProfile.totalOmprengInventory));
  }, [ctxKitchenProfile]);

  const handleOpenWhatsApp = (school: SchoolProfile) => {
    const phone = normalizeWhatsappNumber(school.phoneWa);
    if (!phone || phone.length < 9) {
      showToast(
        'Nomor WhatsApp PIC sekolah belum didaftarkan oleh Admin BGN.',
        'warning'
      );
      return;
    }
    const unitName = userProfile?.kitchenName || kitchenProfile.name;
    const message = encodeURIComponent(
      `Halo ${school.picName || 'Koordinator MBG'} (${school.name}), kami dari ${unitName} ingin mengonfirmasi jadwal pengantaran boks makan bergizi hari ini.`
    );
    const url = `https://wa.me/${phone}?text=${message}`;
    Linking.openURL(url).catch(() => {
      showToast('Tidak dapat membuka aplikasi WhatsApp', 'warning');
    });
  };

  const handleUpdateInventory = async () => {
    const count = parseInt(newInventoryCount, 10);
    if (isNaN(count) || count < 0) {
      showToast('Masukkan jumlah kuota yang valid', 'warning');
      return;
    }

    setIsSubmittingInventory(true);
    try {
      if (dataSource === 'supabase') {
        await supabaseRepository.updateKitchenInventory(count);
        await refreshKitchenProfile();
      } else {
        setKitchenProfile((prev) => ({ ...prev, totalOmprengInventory: count }));
      }
      showToast(`Total kuota ompreng berhasil diperbarui: ${count} unit`, 'success');
      setShowInventoryModal(false);
    } catch (err: any) {
      showToast('Gagal mengubah kuota: ' + err.message, 'warning');
    } finally {
      setIsSubmittingInventory(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        eyebrow={`${userProfile?.kitchenName || kitchenProfile.name} (${userProfile?.kitchenCode || kitchenProfile.code})`}
        title="Sekolah Binaan & Inventaris"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Strip */}
        <View className="flex-row gap-3 mt-4">
          <View className="flex-1">
            <HairlineCard className="p-3 bg-white">
              <View className="flex-row items-center gap-2 mb-1">
                <School size={16} color="#0F4C81" />
                <Text className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  Sekolah Binaan
                </Text>
              </View>
              <Text className="text-2xl font-black text-[#0B2E59]">
                {schools.length}{' '}
                <Text className="text-xs font-semibold text-[#64748B]">Sekolah</Text>
              </Text>
              <Text className="text-[11px] text-[#475569] mt-0.5">Penugasan resmi BGN</Text>
            </HairlineCard>
          </View>

          <View className="flex-1">
            <HairlineCard className="p-3 bg-white">
              <View className="flex-row items-center justify-between gap-1.5 mb-1">
                <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                  <Layers size={15} color="#0F4C81" className="shrink-0" />
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    className="flex-1 min-w-0 text-[10.5px] font-bold text-[#64748B] uppercase tracking-wider"
                  >
                    Total Ompreng
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowInventoryModal(true)}
                  className="p-1 rounded bg-[#EBF3FA] shrink-0"
                  accessibilityLabel="Ubah kuota ompreng"
                >
                  <Edit3 size={13} color="#0F4C81" />
                </Pressable>
              </View>
              <Text className="text-2xl font-black text-[#0B2E59]">
                {kitchenProfile.totalOmprengInventory}{' '}
                <Text className="text-xs font-semibold text-[#64748B]">Unit</Text>
              </Text>
              <Text className="text-[11px] text-[#0F4C81] font-semibold mt-0.5">
                Stok stainless steril
              </Text>
            </HairlineCard>
          </View>
        </View>

        {/* Compact Admin BGN Notice */}
        <View className="flex-row items-center gap-2 px-3 py-2 rounded-[8px] bg-[#EBF3FA] border border-[#BDD5EB] mt-3.5">
          <ShieldCheck size={15} color="#0F4C81" className="shrink-0" />
          <Text className="text-[11px] font-medium text-[#0B2E59] flex-1 min-w-0">
            Penambahan &amp; NPSN sekolah dikelola oleh Admin BGN Pusat.
          </Text>
        </View>

        {/* Section Header */}
        <View className="mt-5 mb-3">
          <Text className="text-sm font-bold text-[#0B2E59] uppercase tracking-wider">
            Daftar Titik Distribusi
          </Text>
          <Text className="text-xs text-[#64748B]">
            Unit penerima manfaat binaan {userProfile?.kitchenName || kitchenProfile.name}
          </Text>
        </View>

        {/* School Cards */}
        <View className="gap-3">
          {schools.length === 0 ? (
            <HairlineCard className="p-5 bg-white items-center">
              <Text className="text-sm font-bold text-[#0B2E59] text-center">
                Belum ada sekolah binaan ditugaskan ke SPPG ini
              </Text>
              <Text className="text-xs text-[#64748B] text-center mt-1 leading-[18px]">
                Hubungi Admin BGN Pusat untuk mendaftarkan sekolah tujuan dan NPSN resmi agar dapur dapat membuat batch produksi dan QR.
              </Text>
            </HairlineCard>
          ) : (
            schools.map((school, index) => (
              <HairlineCard key={school.id || index} className="p-4 bg-white">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center flex-wrap gap-2 mb-1">
                      <Text className="text-base font-bold text-[#0B2E59]">{school.name}</Text>
                      <View className="bg-[#EBF3FA] px-2 py-0.5 rounded border border-[#BDD5EB]">
                        <Text className="text-[10px] font-bold text-[#0F4C81]">
                          Porsi: {school.defaultPortions}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-[#475569] mb-0.5">
                      PIC / Korlap: <Text className="font-semibold text-[#1E293B]">{school.picName}</Text>
                    </Text>
                    {school.npsn ? (
                      <Text className="text-[11px] text-[#64748B]">NPSN: {school.npsn}</Text>
                    ) : null}
                    <Text className="text-[11px] text-[#64748B]">
                      {school.phoneWa ? `WA: ${school.phoneWa}` : `Email: ${school.email}`}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleOpenWhatsApp(school)}
                    className="flex-row items-center gap-1.5 px-2.5 py-2 bg-[#DCFCE7] border border-[#86EFAC] rounded-lg active:opacity-70 shrink-0"
                    accessibilityLabel={`WhatsApp ke ${school.name}`}
                  >
                    <MessageCircle size={15} color="#15803D" />
                    <Text className="text-xs font-bold text-[#15803D]">WhatsApp</Text>
                  </Pressable>
                </View>
              </HairlineCard>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal: Ubah Kuota Ompreng */}
      <Modal
        visible={showInventoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInventoryModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-2xl p-5 border-t border-[#D8E2EC]">
            <View className="flex-row items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="text-base font-bold text-[#0B2E59]">
                  Ubah Kuota Inventaris Ompreng
                </Text>
                <Text numberOfLines={2} className="text-xs text-[#64748B]">
                  Total boks stainless yang beredar di SPPG ini
                </Text>
              </View>
              <Pressable
                onPress={() => setShowInventoryModal(false)}
                className="p-1.5 rounded-full bg-[#F1F5F9] shrink-0"
              >
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            <View className="py-4">
              <Text className="text-xs font-bold text-[#475569] mb-1.5">
                Total Jumlah Boks Stainless (Unit)
              </Text>
              <TextInput
                value={newInventoryCount}
                onChangeText={setNewInventoryCount}
                placeholder="600"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-base font-bold text-[#0B2E59] mb-4"
              />

              <CivicButton
                label="Simpan Perubahan Kuota"
                variant="primary"
                loading={isSubmittingInventory}
                onPress={handleUpdateInventory}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
