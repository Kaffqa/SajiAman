import React, { useState } from 'react';
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
  ArrowLeft,
  ChefHat,
  Eye,
  EyeOff,
  Lock,
  Mail,
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
import type { UserRole } from '../../src/types/sajiaman';

export default function RegisterScreen() {
  const router = useRouter();
  const { dataSource, selectRole, refreshUserProfile, reloadAccountData, showToast } = useSajiAman();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<UserRole>('kitchen');
  const [fullName, setFullName] = useState('');
  const [phoneWa, setPhoneWa] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifiedInstitutionName, setVerifiedInstitutionName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingEmailConfirm, setPendingEmailConfirm] = useState(false);

  const handleNextStep = async () => {
    setErrorMessage('');
    if (!fullName.trim() || !phoneWa.trim() || !verificationCode.trim()) {
      setErrorMessage('Nama lengkap, WhatsApp, dan kode instansi wajib diisi');
      return;
    }
    if (role === 'school' && !/^\d{8}$/.test(verificationCode.trim())) {
      setErrorMessage('NPSN resmi sekolah wajib berupa 8 digit angka');
      return;
    }
    setIsLoading(true);
    try {
      if (dataSource === 'supabase') {
        const check = await supabaseRepository.checkRegistrationInstitution(
          role,
          verificationCode.trim()
        );
        if (!check.valid) {
          throw new Error(
            check.reason ||
              (role === 'kitchen'
                ? 'Kode SPPG belum terdaftar oleh Admin BGN.'
                : 'NPSN sekolah belum terdaftar di sistem.')
          );
        }
        setVerifiedInstitutionName(check.institutionName || '');
      }
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memverifikasi kode instansi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (dataSource !== 'supabase' || !email.trim()) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) throw error;
      showToast('Email verifikasi berhasil dikirim ulang', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengirim ulang email', 'warning');
    } finally {
      setIsResending(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage('');

    if (!fullName.trim() || !phoneWa.trim() || !email.trim() || !verificationCode.trim()) {
      setErrorMessage('Semua formulir pendaftaran wajib diisi');
      return;
    }

    if (role === 'school' && !/^\d{8}$/.test(verificationCode.trim())) {
      setErrorMessage('NPSN resmi sekolah wajib berupa 8 digit angka');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Kata sandi minimal 8 karakter');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok');
      return;
    }

    setIsLoading(true);

    try {
      if (dataSource === 'supabase') {
        // 0. Pre-validate SPPG Code or School NPSN BEFORE creating auth user (prevents orphan accounts)
        const check = await supabaseRepository.checkRegistrationInstitution(
          role,
          verificationCode.trim()
        );
        if (!check.valid) {
          throw new Error(
            check.reason ||
              (role === 'kitchen'
                ? 'Kode SPPG belum terdaftar. Hanya Admin BGN yang dapat mendaftarkan unit SPPG baru.'
                : 'NPSN sekolah belum terdaftar di sistem binaan SPPG.')
          );
        }

        // 1. Supabase Auth Sign Up (stores onboarding metadata for email-confirm resume via complete-profile)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              role,
              full_name: fullName.trim(),
              phone_wa: phoneWa.trim(),
              kitchen_code: role === 'kitchen' ? verificationCode.trim().toUpperCase() : undefined,
              school_npsn: role === 'school' ? verificationCode.trim() : undefined,
            },
          },
        });

        if (authError) {
          if (authError.message.toLowerCase().includes('already registered')) {
            throw new Error('Email ini sudah terdaftar di sistem. Silakan langsung masuk di halaman Login.');
          }
          throw new Error(authError.message);
        }

        if (
          authData?.user &&
          Array.isArray(authData.user.identities) &&
          authData.user.identities.length === 0
        ) {
          throw new Error(
            'Email ini sudah terdaftar di sistem. Silakan langsung masuk di halaman Login.'
          );
        }

        // If email confirmation is enabled (session === null), stop BEFORE RPC and resume via complete-profile after login
        if (!authData?.session) {
          setPendingEmailConfirm(true);
          showToast(
            'Registrasi tercatat. Verifikasi email Anda lalu masuk untuk aktivasi profil otomatis.',
            'info'
          );
          return;
        }

        // 2. Bind Profile with Kitchen Code or School NPSN via Server RPC using authenticated session
        await supabaseRepository.completeUserRegistration({
          role,
          fullName: fullName.trim(),
          phoneWa: phoneWa.trim(),
          kitchenCode: role === 'kitchen' ? verificationCode.trim() : undefined,
          schoolNpsn: role === 'school' ? verificationCode.trim() : undefined,
        });

        const prof = await refreshUserProfile();
        if (prof) {
          await reloadAccountData(prof);
        }
      }

      showToast('Pendaftaran berhasil! Akun resmi Anda telah aktif.', 'success');
      selectRole(role);

      if (role === 'kitchen') {
        router.replace('/(kitchen)' as any);
      } else {
        router.replace('/(school)' as any);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mendaftarkan akun');
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingEmailConfirm) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
        <StepHeader
          title="Verifikasi Email Akun"
          eyebrow="STANDAR PANGAN & INTEGRITAS MBG"
          onBack={() => router.replace('/(auth)/login' as any)}
        />
        <View className="flex-1 p-5 justify-center">
          <View className="bg-white rounded-[14px] border border-[#D8E2EC] p-6 gap-4 items-center shadow-sm">
            <View className="h-14 w-14 rounded-full bg-[#DCFCE7] items-center justify-center">
              <Mail size={28} color="#15803D" />
            </View>
            <Text className="font-sans text-[17px] font-bold text-[#0F172A] text-center">
              Pendaftaran Berhasil — Konfirmasi Email
            </Text>
            <Text className="font-sans text-[13px] text-[#475569] text-center leading-[19px]">
              Tautan verifikasi telah dikirim ke <Text className="font-bold">{email.trim()}</Text>. Klik tautan tersebut, lalu masuk melalui halaman Login.
            </Text>
            <View className="w-full gap-2.5 mt-2">
              <CivicButton
                variant="primary"
                onPress={() => router.replace('/(auth)/login' as any)}
              >
                Kembali ke Halaman Masuk
              </CivicButton>
              <CivicButton
                variant="secondary"
                size="md"
                loading={isResending}
                onPress={handleResendEmail}
              >
                Kirim Ulang Email Verifikasi
              </CivicButton>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        title="Registrasi Petugas Resmi"
        eyebrow={`LANGKAH ${step} DARI 2 • MBG RI`}
        onBack={() => (step === 2 ? setStep(1) : router.replace('/(auth)/login' as any))}
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
            {/* 2-Step Visual Indicator Strip */}
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[11px] font-bold text-[#0F4C81]">
                  {step === 1 ? '1. Identitas & Kode Unit' : '2. Email & Kata Sandi'}
                </Text>
                <Text className="font-mono text-[10px] font-bold text-[#64748B]">
                  TAHAP {step}/2
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="flex-1 h-2 rounded-full bg-[#0F4C81]" />
                <View className={`flex-1 h-2 rounded-full ${step === 2 ? 'bg-[#0F4C81]' : 'bg-[#E2E8F0]'}`} />
              </View>
            </View>

            {errorMessage ? (
              <View className="p-3 rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5]">
                <Text className="font-sans text-[11px] font-bold text-[#B91C1C]">
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {step === 1 ? (
              <>
                {/* Visual Icon Role Selector Cards */}
                <View className="gap-1.5">
                  <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                    PILIH PERAN OPERASIONAL
                  </Text>
                  <View className="flex-row gap-2.5">
                    <Pressable
                      onPress={() => setRole('kitchen')}
                      className={`flex-1 p-3 rounded-[12px] border gap-1.5 ${
                        role === 'kitchen'
                          ? 'bg-[#EBF3FA] border-[#0F4C81]'
                          : 'bg-[#F8FAFC] border-[#CBD5E1]'
                      }`}
                    >
                      <View
                        className={`h-9 w-9 rounded-[10px] items-center justify-center ${
                          role === 'kitchen' ? 'bg-[#0F4C81]' : 'bg-white border border-[#E2E8F0]'
                        }`}
                      >
                        <ChefHat size={18} color={role === 'kitchen' ? '#FFFFFF' : '#64748B'} />
                      </View>
                      <Text
                        className={`font-sans text-[13px] font-bold ${
                          role === 'kitchen' ? 'text-[#0B2E59]' : 'text-[#334155]'
                        }`}
                      >
                        Dapur SPPG
                      </Text>
                      <Text className="font-sans text-[10.5px] text-[#64748B] leading-[14px]">
                        Catat masak &amp; cetak QR via Kode SPPG
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setRole('school')}
                      className={`flex-1 p-3 rounded-[12px] border gap-1.5 ${
                        role === 'school'
                          ? 'bg-[#EBF3FA] border-[#0F4C81]'
                          : 'bg-[#F8FAFC] border-[#CBD5E1]'
                      }`}
                    >
                      <View
                        className={`h-9 w-9 rounded-[10px] items-center justify-center ${
                          role === 'school' ? 'bg-[#0F4C81]' : 'bg-white border border-[#E2E8F0]'
                        }`}
                      >
                        <School size={18} color={role === 'school' ? '#FFFFFF' : '#64748B'} />
                      </View>
                      <Text
                        className={`font-sans text-[13px] font-bold ${
                          role === 'school' ? 'text-[#0B2E59]' : 'text-[#334155]'
                        }`}
                      >
                        Sekolah
                      </Text>
                      <Text className="font-sans text-[10.5px] text-[#64748B] leading-[14px]">
                        Scan QR &amp; terima boks via NPSN resmi
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Institutional Verification Code */}
                <View className="gap-1">
                  <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                    {role === 'kitchen' ? 'KODE SPPG RESMI' : 'NPSN SEKOLAH (8 DIGIT)'}
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

                {/* Full Name */}
                <View className="gap-1">
                  <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                    NAMA LENGKAP
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

                {/* WhatsApp Phone */}
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

                <CivicButton
                  variant="primary"
                  loading={isLoading}
                  onPress={handleNextStep}
                  className="mt-1"
                >
                  {isLoading ? 'Memverifikasi Kode...' : 'Lanjut ke Data Akun'}
                </CivicButton>
              </>
            ) : (
              <>
                {/* Verified Institution Summary Strip */}
                <View className="p-3 rounded-[10px] bg-[#EBF3FA] border border-[#BDD5EB] flex-row items-center justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <Text className="font-sans text-[10px] font-bold uppercase text-[#0F4C81]">
                      {role === 'kitchen' ? 'DAPUR SPPG' : 'SEKOLAH PENERIMA'}
                    </Text>
                    <Text numberOfLines={1} className="font-sans text-[13px] font-bold text-[#0B2E59] mt-0.5">
                      {verifiedInstitutionName || verificationCode.toUpperCase()}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setErrorMessage('');
                      setStep(1);
                    }}
                    className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-[6px] bg-white border border-[#BDD5EB] shrink-0"
                  >
                    <ArrowLeft size={12} color="#0F4C81" />
                    <Text className="font-sans text-[11px] font-bold text-[#0F4C81]">Ubah</Text>
                  </Pressable>
                </View>

                {/* Email */}
                <View className="gap-1">
                  <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                    EMAIL RESMI PETUGAS
                  </Text>
                  <View className="flex-row items-center rounded-[10px] border border-[#D8E2EC] bg-[#F8FAFC] px-3 min-h-[46px]">
                    <Mail size={16} color="#64748B" />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="nama.petugas@instansi.id"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      className="flex-1 font-sans text-[13px] text-[#0F172A] ml-2.5"
                    />
                  </View>
                </View>

                {/* Password */}
                <View className="gap-1">
                  <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                    KATA SANDI
                  </Text>
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

                {/* Confirm Password */}
                <View className="gap-1">
                  <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                    KONFIRMASI KATA SANDI
                  </Text>
                  <View className="flex-row items-center rounded-[10px] border border-[#D8E2EC] bg-[#F8FAFC] px-3 min-h-[46px]">
                    <Lock size={16} color="#64748B" />
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Ketik ulang kata sandi"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      className="flex-1 font-sans text-[13px] text-[#0F172A] ml-2.5"
                    />
                  </View>
                </View>

                <CivicButton
                  variant="primary"
                  loading={isLoading}
                  onPress={handleRegister}
                  className="mt-1"
                >
                  {isLoading ? 'Mendaftarkan Akun...' : 'Daftar Akun Petugas'}
                </CivicButton>
              </>
            )}

            {/* Back to Login */}
            <View className="pt-2 border-t border-[#EDF2F7] flex-row items-center justify-center gap-1.5">
              <Text className="font-sans text-[12px] text-[#64748B]">
                Sudah memiliki akun?
              </Text>
              <Pressable onPress={() => router.replace('/(auth)/login' as any)}>
                <Text className="font-sans text-[12px] font-bold text-[#0F4C81]">
                  Masuk di sini
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
