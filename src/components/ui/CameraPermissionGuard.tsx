import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, CameraOff, Settings } from 'lucide-react-native';
import { CivicButton } from './CivicButton';

interface CameraPermissionGuardProps {
  onRequestPermission: () => void;
  canAskAgain?: boolean;
  compact?: boolean;
}

export const CameraPermissionGuard: React.FC<CameraPermissionGuardProps> = ({
  onRequestPermission,
  canAskAgain = true,
  compact = false,
}) => {
  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {
      // Fallback
    });
  };

  if (compact) {
    return (
      <View className="items-center justify-center p-4 bg-[#0B1220]/90 rounded-xl border border-white/20">
        <CameraOff size={24} color="#F87171" />
        <Text className="text-xs font-bold text-white mt-2 text-center">
          Izin Kamera Belum Aktif
        </Text>
        <Text className="text-[10px] text-[#94A3B8] text-center mt-0.5 mb-3 max-w-[200px]">
          Aktifkan izin untuk memindai QR boks makanan
        </Text>

        <View className="flex-row gap-2">
          {canAskAgain ? (
            <Pressable
              onPress={onRequestPermission}
              className="px-3 py-1.5 rounded-lg bg-[#0F4C81] border border-[#38BDF8]"
            >
              <Text className="text-[11px] font-bold text-white">Izinkan</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleOpenSettings}
            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 flex-row items-center gap-1"
          >
            <Settings size={12} color="#FFFFFF" />
            <Text className="text-[11px] font-bold text-white">Pengaturan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center p-6 bg-[#0B1220]">
      <View className="h-16 w-16 rounded-2xl bg-white/10 border border-white/15 items-center justify-center mb-4">
        <CameraOff size={32} color="#F87171" strokeWidth={2} />
      </View>

      <Text className="text-base font-bold text-white text-center mb-1">
        Akses Kamera Diperlukan
      </Text>
      <Text className="text-xs text-[#94A3B8] text-center mb-6 leading-relaxed max-w-[280px]">
        SajiAman memerlukan akses kamera untuk verifikasi boks bergaransi dan dokumentasi sampel masakan MBG.
      </Text>

      <View className="w-full max-w-[280px] gap-2.5">
        {canAskAgain ? (
          <CivicButton
            label="Izinkan Akses Kamera"
            variant="primary"
            icon={<Camera size={16} color="#FFFFFF" />}
            onPress={onRequestPermission}
          />
        ) : null}

        <Pressable
          onPress={handleOpenSettings}
          accessibilityRole="button"
          className="min-h-[48px] w-full flex-row items-center justify-center gap-2 rounded-[10px] border border-white/25 bg-white/10 px-4 py-2.5 active:bg-white/20"
        >
          <Settings size={16} color="#FFFFFF" />
          <Text className="font-sans text-[14px] font-bold text-white text-center shrink" numberOfLines={1}>
            Buka Pengaturan Perangkat
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
