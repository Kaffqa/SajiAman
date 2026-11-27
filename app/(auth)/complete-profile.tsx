import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChefHat,
  LogOut,
  Phone,
  School,
  ShieldCheck,
  User,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../src/components/ui/CivicButton';
import { StepHeader } from '../../src/components/ui/StepHeader';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { supabaseRepository } from '../../src/data/supabaseRepository';
import { supabase } from '../../src/lib/supabase';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const {
    dataSource,
    selectRole,
    refreshUserProfile,
    reloadAccountData,
    logoutToRoleSelect,
    showToast,
  } = useSajiAman();

  const [role, setRole] = useState<'kitchen' | 'school'>('kitchen');
  const [fullName, setFullName] = useState('');
  const [phoneWa, setPhoneWa] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (dataSource !== 'supabase') return;
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        const md = data?.user?.user_metadata;
        if (!md) return;
        if (md.role === 'kitchen' || md.role === 'school') {
          setRole(md.role);
        }
        if (typeof md.full_name === 'string' && md.full_name.trim()) {
          setFullName((prev) => prev || md.full_name.trim());
        }
        if (typeof md.phone_wa === 'string' && md.phone_wa.trim()) {
          setPhoneWa((prev) => prev || md.phone_wa.trim());
        }
        if (md.role === 'kitchen' && typeof md.kitchen_code === 'string' && md.kitchen_code.trim()) {
          setVerificationCode((prev) => prev || md.kitchen_code.trim().toUpperCase());
        } else if (md.role === 'school' && typeof md.school_npsn === 'string' && md.school_npsn.trim()) {
          setVerificationCode((prev) => prev || md.school_npsn.trim());
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [dataSource]);

  const handleComplete = async () => {
    setErrorMessage('');
    if (!fullName.trim() || !phoneWa.trim() || !verificationCode.trim()) {
      setErrorMessage('Semua data penugasan instansi wajib dilengkapi.');
      return;
    }

    if (role === 'school' && !/^\d{8}$/.test(verificationCode.trim())) {
      setErrorMessage('NPSN resmi sekolah wajib berupa 8 digit angka.');
      return;
    }

    setIsLoading(true);
    try {
      const check = await supabaseRepository.checkRegistrationInstitution(
        role,
        verificationCode.trim()
      );
      if (!check.valid) {
        setErrorMessage(
          check.reason ||
            'Kode SPPG atau NPSN belum terdaftar oleh Admin BGN. Hubungi Admin Pusat.'
        );
        return;
      }

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) {
        throw new Error('Sesi autentikasi habis. Silakan login ulang.');
      }

      await supabaseRepository.completeUserRegistration({
        role,
        fullName: fullName.trim(),
        phoneWa: phoneWa.trim(),
        kitchenCode: role === 'kitchen' ? verificationCode.trim() : undefined,
        schoolNpsn: role === 'school' ? verificationCode.trim() : undefined,
      });

      const prof = await refreshUserProfile();
      if (!prof) {
        throw new Error('Profil gagal dimuat setelah verifikasi. Coba muat ulang.');
      }
      await reloadAccountData(prof);
      selectRole(prof.role);
      showToast('Profil instansi berhasil dipulihkan dan terhubung!', 'success');

      if (prof.role === 'kitchen') {
        router.replace('/(kitchen)' as any);
      } else {
        router.replace('/(school)' as any);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menautkan profil ke unit instansi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logoutToRoleSelect();
    router.replace('/(auth)/login' as any);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        title="Lengkapi Profil Instansi"
        eyebrow="PEMULIHAN PENUGASAN AKUN MBG"
        onBack={handleSwitchAccount}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white rounded-[14px] border border-[#D8E2EC] p-4 gap-4 shadow-sm">
            <View className="p-3 rounded-[10px] bg-[#FEF3C7] border border-[#FCD34D]">
              <Text className="font-sans text-[12px] font-bold text-[#78350F]">
                Tautkan akun ke Kode SPPG atau NPSN 8 digit dari Admin BGN.
              </Text>
            </View>

          <View className="gap-1.5">
            <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
              PILIH PERAN PENUGASAN
            </Text>
            <View className="flex-row rounded-[10px] bg-[#F1F5F9] p-1 border border-[#E2E8F0]">
              <Pressable
                onPress={() => setRole('kitchen')}
                className={`flex-1 py-2.5 rounded-[8px] flex-row items-center justify-center gap-1.5 ${
                  role === 'kitchen' ? 'bg-[#0F4C81]' : ''
                }`}
              >
                <ChefHat size={16} color={role === 'kitchen' ? '#FFFFFF' : '#64748B'} />
                <Text
                  className={`font-sans text-[12px] font-bold ${
                    role === 'kitchen' ? 'text-white' : 'text-[#64748B]'
                  }`}
                >
                  Dapur SPPG
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setRole('school')}
                className={`flex-1 py-2.5 rounded-[8px] flex-row items-center justify-center gap-1.5 ${
                  role === 'school' ? 'bg-[#0F4C81]' : ''
                }`}
              >
                <School size={16} color={role === 'school' ? '#FFFFFF' : '#64748B'} />
                <Text
                  className={`font-sans text-[12px] font-bold ${
                    role === 'school' ? 'text-white' : 'text-[#64748B]'
                  }`}
                >
                  Sekolah Penerima
                </Text>
              </Pressable>
            </View>
          </View>

          {errorMessage ? (
            <View className="p-3 rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5]">
              <Text className="font-sans text-[11px] font-bold text-[#B91C1C]">
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View className="gap-1">
            <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
              NAMA LENGKAP PETUGAS
            </Text>
            <View className="flex-row items-center rounded-[10px] border border-[#D8E2EC] bg-[#F8FAFC] px-3 min-h-[46px]">
              <User size={16} color="#64748B" />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Contoh: Hendra Kusuma, S.Gz"
                placeholderTextColor="#94A3B8"
                className="flex-1 font-sans text-[13px] text-[#0F172A] ml-2.5"
              />
            </View>
          </View>

          <View className="gap-1">
            <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
              NOMOR WHATSAPP AKTIF
            </Text>
            <View className="flex-row items-center rounded-[10px] border border-[#D8E2EC] bg-[#F8FAFC] px-3 min-h-[46px]">
              <Phone size={16} color="#64748B" />
              <TextInput
                value={phoneWa}
                onChangeText={setPhoneWa}
                placeholder="081234567890"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                className="flex-1 font-sans text-[13px] text-[#0F172A] ml-2.5"
              />
            </View>
          </View>

          <View className="gap-1">
            <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
              {role === 'kitchen' ? 'KODE VERIFIKASI SPPG RESMI' : 'NPSN RESMI SEKOLAH (8 DIGIT)'}
            </Text>
            <View className="flex-row items-center rounded-[10px] border border-[#D8E2EC] bg-[#F8FAFC] px-3 min-h-[46px]">
              <ShieldCheck size={16} color="#0F4C81" />
              <TextInput
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder={role === 'kitchen' ? 'Contoh: SPPG-SMG-01' : 'Contoh: 20328901'}
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                className="flex-1 font-sans text-[13px] font-bold text-[#0F172A] ml-2.5"
              />
            </View>
          </View>

          <CivicButton variant="primary" loading={isLoading} onPress={handleComplete}>
            {isLoading ? 'Menyimpan Penugasan...' : 'Tautkan ke Unit Resmi'}
          </CivicButton>

          <CivicButton
            variant="ghost"
            icon={<LogOut size={16} color="#0F4C81" />}
            onPress={handleSwitchAccount}
          >
            Keluar &amp; Gunakan Akun Lain
          </CivicButton>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
