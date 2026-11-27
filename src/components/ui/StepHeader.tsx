import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { hapticsAdapter } from '../../adapters/hapticsAdapter';

interface StepHeaderProps {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  variant?: 'light' | 'navy';
}

export const StepHeader: React.FC<StepHeaderProps> = ({
  title,
  eyebrow,
  onBack,
  rightSlot,
  variant = 'light',
}) => {
  const isNavy = variant === 'navy';

  const handleBack = () => {
    if (onBack) {
      hapticsAdapter.selection();
      onBack();
    }
  };

  return (
    <View
      className={`flex-row items-center justify-between gap-2 px-3 py-2.5 min-h-[56px] border-b ${
        isNavy
          ? 'bg-[#0B2E59] border-[#1E3A5F]'
          : 'bg-white border-[#D8E2EC]'
      }`}
    >
      <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
        {onBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            className={`h-11 w-11 shrink-0 items-center justify-center rounded-[10px] active:opacity-75 ${
              isNavy
                ? 'bg-white/10'
                : 'bg-[#F4F7FA] border border-[#D8E2EC]'
            }`}
          >
            <ArrowLeft
              size={20}
              color={isNavy ? '#FFFFFF' : '#0F172A'}
              strokeWidth={2}
            />
          </Pressable>
        ) : null}

        <View className="flex-col flex-1 min-w-0">
          {eyebrow ? (
            <Text
              numberOfLines={1}
              className={`font-sans text-[10px] font-bold uppercase tracking-[0.08em] ${
                isNavy ? 'text-[#93C5FD]' : 'text-[#475569]'
              }`}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            numberOfLines={1}
            className={`font-sans text-[16px] font-bold tracking-[-0.02em] ${
              isNavy ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {title}
          </Text>
        </View>
      </View>

      {rightSlot ? <View className="shrink-0 items-center">{rightSlot}</View> : null}
    </View>
  );
};
