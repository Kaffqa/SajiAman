import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ToastMessage } from '../../context/SajiAmanContext';

interface ToastBannerProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toast, onDismiss }) => {
  const insets = useSafeAreaInsets();
  if (!toast) return null;

  const isSuccess = toast.tone === 'success';
  const isWarning = toast.tone === 'warning';

  const containerBg = isSuccess
    ? 'bg-[#14532D] border-[#15803D]'
    : isWarning
      ? 'bg-[#78350F] border-[#B45309]'
      : 'bg-[#0B2E59] border-[#0F4C81]';

  const Icon = isSuccess ? CheckCircle2 : isWarning ? AlertTriangle : Info;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ top: Math.max(insets.top + 8, 20) }}
      className={`absolute left-4 right-4 z-50 flex-row items-center justify-between gap-2.5 rounded-[10px] border px-3.5 py-3 ${containerBg} shadow-sm`}
    >
      <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
        <Icon size={18} color="#FFFFFF" strokeWidth={2} className="shrink-0" />
        <Text
          numberOfLines={2}
          className="font-sans text-[12px] font-semibold text-white leading-[16px] flex-1 min-w-0"
        >
          {toast.text}
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Tutup notifikasi"
        className="h-8 w-8 items-center justify-center rounded-[6px] bg-white/10 active:bg-white/20 shrink-0"
      >
        <X size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
};
