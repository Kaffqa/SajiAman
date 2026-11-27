import React, { useState } from 'react';
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
import * as Linking from 'expo-linking';
import { CheckCircle2, Mail } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../src/components/ui/CivicButton';
import { StepHeader } from '../../src/components/ui/StepHeader';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { supabase } from '../../src/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { dataSource } = useSajiAman();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleResetPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Masukkan alamat email yang terdaftar');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      if (dataSource === 'supabase') {
        const redirectUrl =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? `${window.location.origin}/(auth)/reset-password`
            : Linking.createURL('/(auth)/reset-password');
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl,
        });
        if (error) throw error;
      }
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengirim instruksi reset kata sandi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        title="Pemulihan Kata Sandi"
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
          {isSuccess ? (
            <View className="items-center py-4 gap-3">
              <View className="h-14 w-14 rounded-full bg-[#DCFCE7] items-center justify-center">
                <CheckCircle2 size={32} color="#15803D" strokeWidth={2.2} />
              </View>
              <Text className="font-sans text-[16px] font-bold text-[#0F172A] text-center">
                Tautan Pemulihan Terkirim
              </Text>
              <Text className="font-sans text-[13px] text-[#475569] text-center leading-[19px]">
                Silakan periksa kotak masuk atau spam email <Text className="font-bold">{email}</Text> untuk tautan penyetelan ulang kata sandi Anda.
              </Text>
              <View className="w-full mt-3">
                <CivicButton
                  variant="primary"
                  onPress={() => router.replace('/(auth)/login' as any)}
                >
                  Kembali ke Layar Masuk
                </CivicButton>
              </View>
            </View>
          ) : (
            <>
              <Text className="font-sans text-[13px] text-[#475569] leading-[19px]">
                Masukkan alamat email resmi yang terdaftar pada sistem SajiAman. Tautan pemulihan akan dikirimkan ke email tersebut.
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
                  ALAMAT EMAIL RESMI
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

              <CivicButton
                variant="primary"
                loading={isLoading}
                onPress={handleResetPassword}
                className="mt-2"
              >
                {isLoading ? 'Mengirim Instruksi...' : 'Kirim Tautan Reset'}
              </CivicButton>

              <View className="pt-2 border-t border-[#EDF2F7] items-center">
                <Pressable onPress={() => router.replace('/(auth)/login' as any)}>
                  <Text className="font-sans text-[12px] font-bold text-[#0F4C81]">
                    Kembali ke Layar Masuk
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
