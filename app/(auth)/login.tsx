import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  ChefHat,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Mail,
  QrCode,
  Recycle,
  ShieldCheck,
} from 'lucide-react-native';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { KITCHEN_PROFILE, SCHOOLS } from '../../src/data/mockRepository';
import { formatWibTime } from '../../src/domain/weakestLinkEngine';
import { supabase } from '../../src/lib/supabase';
import { CivicButton } from '../../src/components/ui/CivicButton';
import { RoleTutorialModal } from '../../src/components/ui/RoleTutorialModal';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    dataSource,
    selectRole,
    refreshUserProfile,
    reloadAccountData,
    simulatedNowMs,
    showToast,
  } = useSajiAman();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);

  const handleOfficialLogin = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Email dan kata sandi wajib diisi');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      if (dataSource === 'supabase') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data?.user) {
          // Fetch authenticated user profile strictly from database
          const activeProfile = await refreshUserProfile();
          if (!activeProfile) {
            showToast('Lengkapi kode SPPG atau NPSN sekolah untuk mengaktifkan akun Anda.', 'info');
            router.replace('/(auth)/complete-profile' as any);
            return;
          }

          await reloadAccountData(activeProfile);
          selectRole(activeProfile.role);

          if (activeProfile.role === 'admin') {
            router.replace('/(admin)' as any);
          } else if (activeProfile.role === 'kitchen') {
            router.replace('/(kitchen)' as any);
          } else {
            router.replace('/(school)' as any);
          }
          return;
        }
      }

      // Mock Mode Fallback if Supabase not configured
      if (cleanEmail.toLowerCase().includes('admin')) {
        selectRole('admin');
        router.replace('/(admin)' as any);
      } else if (cleanEmail.toLowerCase().includes('dapur') || cleanEmail.toLowerCase().includes('chef')) {
        selectRole('kitchen');
        router.replace('/(kitchen)' as any);
      } else {
        selectRole('school');
        router.replace('/(school)' as any);
      }
    } catch (err: any) {
      setErrorMessage(
        err.message?.includes('Invalid login credentials')
          ? 'Email atau kata sandi tidak sesuai'
          : err.message || 'Gagal masuk akun'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#F4F7FA]"
    >
      {/* Curved Brand Hero Band */}
      <View
        style={{ paddingTop: Math.max(insets.top + 14, 38) }}
        className="bg-[#0B2E59] px-5 pb-11 rounded-b-[28px]"
      >
        <View className="flex-row items-center justify-between gap-2 mb-3.5">
          <View className="border border-white/20 bg-white/10 px-2.5 py-1 rounded-[6px]">
            <Text style={styles.kickerTag}>MBG RI • BGN</Text>
          </View>
          <Text style={styles.clockHeader}>
            {formatWibTime(simulatedNowMs)}
          </Text>
        </View>

        <View className="flex-row items-center gap-3.5">
          <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-[#0F4C81] border border-white/25 shrink-0 shadow-sm">
            <ShieldCheck size={26} color="#FFFFFF" strokeWidth={2} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="font-sans font-extrabold text-[23px] text-white tracking-[-0.025em] leading-[27px]">
              SajiAman
            </Text>
            <Text numberOfLines={1} className="font-sans font-medium text-[12px] text-[#CBD5E1] mt-0.5">
              Kendali Mutu Pangan &amp; Sirkulasi Ompreng MBG
            </Text>
          </View>
        </View>

        {/* Mini Ecosystem Flow Pill Strip */}
        <View className="mt-4 flex-row items-center justify-between bg-white/10 border border-white/15 rounded-[12px] px-3 py-2">
          <View className="flex-row items-center gap-1.5 flex-1">
            <ChefHat size={13} color="#93C5FD" />
            <Text numberOfLines={1} className="font-sans text-[10.5px] font-semibold text-white">
              Masak &amp; Kunci
            </Text>
          </View>
          <ChevronRight size={12} color="#64748B" />
          <View className="flex-row items-center gap-1.5 flex-1 justify-center">
            <QrCode size={13} color="#FDE68A" />
            <Text numberOfLines={1} className="font-sans text-[10.5px] font-semibold text-white">
              Segel QR
            </Text>
          </View>
          <ChevronRight size={12} color="#64748B" />
          <View className="flex-row items-center gap-1.5 flex-1 justify-end">
            <Recycle size={13} color="#86EFAC" />
            <Text numberOfLines={1} className="font-sans text-[10.5px] font-semibold text-white">
              Zero-Waste
            </Text>
          </View>
        </View>
      </View>

      {/* Main Floating Login Sheet */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        className="flex-1 -mt-6"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'space-between',
          paddingHorizontal: 18,
          paddingTop: 2,
          paddingBottom: Math.max(insets.bottom + 20, 28),
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Official Email & Password Form */}
        <View className="bg-white rounded-[16px] border border-[#D8E2EC] p-4 gap-3.5 shadow-md">
          <View className="border-b border-[#EDF2F7] pb-2.5">
            <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#0B2E59]">
              MASUK AKUN RESMI PETUGAS
            </Text>
            <Text className="font-sans text-[12px] text-[#64748B] mt-0.5">
              Gunakan email &amp; kata sandi yang telah terdaftar di SPPG / Sekolah.
            </Text>
          </View>

          {errorMessage ? (
            <View className="p-2.5 rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5]">
              <Text className="font-sans text-[11px] font-bold text-[#B91C1C]">
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* Email Input */}
          <View className="gap-1">
            <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
              ALAMAT EMAIL
            </Text>
            <View className="flex-row items-center rounded-[10px] border border-[#D8E2EC] bg-[#F8FAFC] px-3 min-h-[46px]">
              <Mail size={16} color="#64748B" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="nama@sppg.id atau nama@sekolah.id"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
                className="flex-1 font-sans text-[13px] text-[#0F172A] ml-2.5"
              />
            </View>
          </View>

          {/* Password Input */}
          <View className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                KATA SANDI
              </Text>
              <Pressable onPress={() => router.push('/(auth)/forgot-password' as any)}>
                <Text className="font-sans text-[11px] font-semibold text-[#0F4C81]">
                  Lupa sandi?
                </Text>
              </Pressable>
            </View>
            <View className="flex-row items-center rounded-[10px] border border-[#D8E2EC] bg-[#F8FAFC] px-3 min-h-[46px]">
              <Lock size={16} color="#64748B" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Minimal 8 karakter"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                className="flex-1 font-sans text-[13px] text-[#0F172A] ml-2.5"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
                className="p-1"
              >
                {showPassword ? (
                  <EyeOff size={16} color="#64748B" />
                ) : (
                  <Eye size={16} color="#64748B" />
                )}
              </Pressable>
            </View>
          </View>

          <CivicButton
            variant="primary"
            loading={isLoading}
            onPress={handleOfficialLogin}
            className="mt-1"
          >
            {isLoading ? 'Memverifikasi Kredensial...' : 'Masuk ke Sistem'}
          </CivicButton>

          {/* Link to Register */}
          <View className="pt-2 border-t border-[#EDF2F7] flex-row items-center justify-center gap-1.5">
            <Text className="font-sans text-[12px] text-[#64748B]">
              Belum memiliki akun resmi?
            </Text>
            <Pressable onPress={() => router.push('/(auth)/register' as any)}>
              <Text className="font-sans text-[12px] font-bold text-[#0F4C81]">
                Daftar Akun Baru
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom Balanced Section: Guide + 3 Visual Safeguard Pillars + Footer */}
        <View className="gap-3">
          <Pressable
            onPress={() => setShowTutorial(true)}
            className="bg-white rounded-[14px] border border-[#BDD5EB] p-3.5 flex-row items-center justify-between gap-3 active:bg-[#EBF3FA] shadow-xs"
          >
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
              <View className="h-10 w-10 rounded-[10px] bg-[#EBF3FA] items-center justify-center shrink-0">
                <HelpCircle size={20} color="#0F4C81" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="font-sans text-[13px] font-bold text-[#0B2E59]">
                  Cara Kerja SajiAman
                </Text>
                <Text numberOfLines={1} className="font-sans text-[11.5px] text-[#64748B]">
                  Lihat panduan interaktif 30 detik
                </Text>
              </View>
            </View>
            <View className="px-2.5 py-1 rounded-[8px] bg-[#EBF3FA] border border-[#BDD5EB] flex-row items-center gap-1 shrink-0">
              <BookOpen size={12} color="#0F4C81" />
              <Text className="font-sans text-[11px] font-bold text-[#0F4C81]">
                Mulai Tur
              </Text>
            </View>
          </Pressable>

          {/* 3 Compact Visual Safeguard Tiles */}
          <View className="flex-row gap-2.5">
            <View className="flex-1 bg-white rounded-[12px] border border-[#D8E2EC] p-2.5 items-center gap-1.5">
              <View className="h-8 w-8 rounded-[9px] bg-[#DCFCE7] items-center justify-center">
                <Clock size={16} color="#15803D" />
              </View>
              <Text numberOfLines={1} className="font-sans text-[11px] font-bold text-[#0F172A] text-center">
                Weakest-Link
              </Text>
              <Text numberOfLines={1} className="font-sans text-[10px] text-[#64748B] text-center">
                Batas otomatis
              </Text>
            </View>

            <View className="flex-1 bg-white rounded-[12px] border border-[#D8E2EC] p-2.5 items-center gap-1.5">
              <View className="h-8 w-8 rounded-[9px] bg-[#EBF3FA] items-center justify-center">
                <QrCode size={16} color="#0F4C81" />
              </View>
              <Text numberOfLines={1} className="font-sans text-[11px] font-bold text-[#0F172A] text-center">
                Segel QR
              </Text>
              <Text numberOfLines={1} className="font-sans text-[10px] text-[#64748B] text-center">
                Anti basi dini
              </Text>
            </View>

            <View className="flex-1 bg-white rounded-[12px] border border-[#D8E2EC] p-2.5 items-center gap-1.5">
              <View className="h-8 w-8 rounded-[9px] bg-[#FEF3C7] items-center justify-center">
                <Recycle size={16} color="#B45309" />
              </View>
              <Text numberOfLines={1} className="font-sans text-[11px] font-bold text-[#0F172A] text-center">
                Maggot BSF
              </Text>
              <Text numberOfLines={1} className="font-sans text-[10px] text-[#64748B] text-center">
                Nol limbah TPA
              </Text>
            </View>
          </View>

          <Text className="font-sans text-[10.5px] font-medium text-[#94A3B8] text-center pt-1">
            Program Makan Bergizi Gratis • Badan Gizi Nasional
          </Text>
        </View>
      </ScrollView>

      <RoleTutorialModal
        visible={showTutorial}
        audience="overview"
        onClose={() => setShowTutorial(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kickerTag: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 10,
    color: '#93C5FD',
    letterSpacing: 0.6,
  },
  clockHeader: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  sectionDivider: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: '#475569',
    letterSpacing: 0.6,
  },
  roleSubtext: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 11,
    color: '#0F4C81',
    marginTop: 2,
  },
  actionEnter: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: '#0F4C81',
  },
  footerNote: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 11,
    color: '#64748B',
  },
});
