import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../src/components/ui/CivicButton';
import { StepHeader } from '../../src/components/ui/StepHeader';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { supabase } from '../../src/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const incomingUrl = Linking.useURL();
  const { dataSource, showToast } = useSajiAman();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (dataSource !== 'supabase') return;
    let active = true;

    const hydrateRecoverySession = async () => {
      try {
        const rawUrl =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.href
            : incomingUrl || '';
        if (!rawUrl) return;

        const [beforeHash, hashPart = ''] = rawUrl.split('#');
        const queryPart = beforeHash.includes('?') ? beforeHash.split('?')[1] : '';
        const queryParams = new URLSearchParams(queryPart);
        const hashParams = new URLSearchParams(hashPart);

        const code = queryParams.get('code');
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error && active) {
            setErrorMessage('Tautan pemulihan tidak valid atau kedaluwarsa.');
          }
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error && active) {
            setErrorMessage('Sesi pemulihan kata sandi kedaluwarsa.');
          }
        }
      } catch (err: any) {
        if (active && err?.message) {
          setErrorMessage(err.message);
        }
      }
    };

    hydrateRecoverySession();
    return () => {
      active = false;
    };
  }, [dataSource, incomingUrl]);

  const handleUpdatePassword = async () => {
    setErrorMessage('');
    if (newPassword.length < 8) {
      setErrorMessage('Kata sandi baru minimal 8 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok');
      return;
    }

    setIsLoading(true);
    try {
      if (dataSource === 'supabase') {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      setIsUpdated(true);
      showToast('Kata sandi berhasil diperbarui', 'success');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Tautan pemulihan kedaluwarsa. Silakan minta ulang di halaman Lupa Sandi.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        title="Setel Ulang Kata Sandi"
        eyebrow="AKUN RESMI PETUGAS MBG"
        onBack={() => router.replace('/(auth)/login' as any)}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, paddingBottom: 36 }}
          showsVerticalScrollIndicator={false}
        >
        <View className="bg-white rounded-[14px] border border-[#D8E2EC] p-5 gap-4 shadow-sm">
          {isUpdated ? (
            <View className="items-center py-4 gap-3">
              <View className="h-14 w-14 rounded-full bg-[#DCFCE7] items-center justify-center">
                <CheckCircle2 size={32} color="#15803D" strokeWidth={2.2} />
              </View>
              <Text className="font-sans text-[16px] font-bold text-[#0F172A] text-center">
                Kata Sandi Diperbarui
              </Text>
              <Text className="font-sans text-[13px] text-[#475569] text-center leading-[19px]">
                Kata sandi baru Anda sudah aktif. Silakan masuk menggunakan kata sandi baru Anda.
              </Text>
              <View className="w-full mt-2">
                <CivicButton
                  variant="primary"
                  onPress={() => router.replace('/(auth)/login' as any)}
                >
                  Masuk Sekarang
                </CivicButton>
              </View>
            </View>
          ) : (
            <>
              <Text className="font-sans text-[13px] text-[#475569] leading-[19px]">
                Masukkan kata sandi baru untuk akun resmi SajiAman Anda.
              </Text>

              {errorMessage ? (
                <View className="p-3 rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5]">
                  <Text className="font-sans text-[11px] font-bold text-[#B91C1C]">
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              <View className="gap-1">
                <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                  KATA SANDI BARU
                </Text>
                <View className="flex-row items-center rounded-[10px] border border-[#D8E2EC] bg-[#F8FAFC] px-3 min-h-[46px]">
                  <Lock size={16} color="#64748B" />
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Minimal 8 karakter"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    className="flex-1 font-sans text-[13px] text-[#0F172A] ml-2.5"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} className="p-1">
                    {showPassword ? (
                      <EyeOff size={16} color="#64748B" />
                    ) : (
                      <Eye size={16} color="#64748B" />
                    )}
                  </Pressable>
                </View>
              </View>

              <View className="gap-1">
                <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                  KONFIRMASI KATA SANDI BARU
                </Text>
                <View className="flex-row items-center rounded-[10px] border border-[#D8E2EC] bg-[#F8FAFC] px-3 min-h-[46px]">
                  <Lock size={16} color="#64748B" />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Ketik ulang kata sandi baru"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    className="flex-1 font-sans text-[13px] text-[#0F172A] ml-2.5"
                  />
                </View>
              </View>

              <CivicButton
                variant="primary"
                loading={isLoading}
                onPress={handleUpdatePassword}
                className="mt-2"
              >
                {isLoading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
              </CivicButton>
            </>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
