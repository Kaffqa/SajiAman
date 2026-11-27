import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { CivicButton } from './CivicButton';

interface ConfirmLogoutModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  subtitle?: string;
}

export const ConfirmLogoutModal: React.FC<ConfirmLogoutModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  title = 'Keluar dari Akun?',
  subtitle = 'Sesi aktif Anda akan ditutup dan Anda perlu masuk kembali untuk mengakses data instansi.',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 bg-black/55 items-center justify-center p-5"
        onPress={onCancel}
      >
        <Pressable
          className="bg-white rounded-[16px] p-5 w-full max-w-[340px] gap-4 border border-[#D8E2EC]"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center gap-2.5">
            <View className="h-10 w-10 rounded-[10px] bg-[#FEE2E2] items-center justify-center">
              <LogOut size={18} color="#B91C1C" strokeWidth={2.2} />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-[15px] font-bold text-[#0F172A]">
                {title}
              </Text>
              <Text className="font-sans text-[12px] text-[#64748B] mt-0.5 leading-[17px]">
                {subtitle}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <CivicButton variant="secondary" size="sm" onPress={onCancel}>
                Batal
              </CivicButton>
            </View>
            <View className="flex-1">
              <CivicButton variant="danger" size="sm" onPress={onConfirm}>
                Ya, Keluar
              </CivicButton>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
