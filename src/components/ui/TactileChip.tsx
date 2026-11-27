import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { hapticsAdapter } from '../../adapters/hapticsAdapter';

interface TactileChipProps {
  label: string;
  badgeText: string;
  selected: boolean;
  isHighRisk?: boolean;
  onPress: () => void;
}

export const TactileChip: React.FC<TactileChipProps> = ({
  label,
  badgeText,
  selected,
  isHighRisk = false,
  onPress,
}) => {
  const handlePress = () => {
    hapticsAdapter.lightImpact();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      className={`flex-row items-start gap-2.5 min-h-[60px] px-3 py-2.5 rounded-[10px] active:opacity-85 ${
        selected
          ? 'bg-[#EBF3FA] border-[1.5px] border-[#0F4C81]'
          : 'bg-white border border-[#D8E2EC]'
      }`}
    >
      <View
        className={`h-4 w-4 mt-0.5 rounded-[4px] items-center justify-center border shrink-0 ${
          selected
            ? 'bg-[#0F4C81] border-[#0F4C81]'
            : 'bg-white border-[#94A3B8]'
        }`}
      >
        {selected ? <Check size={12} color="#FFFFFF" strokeWidth={2.5} /> : null}
      </View>

      <View className="flex-1 min-w-0 justify-between gap-1">
        <Text
          numberOfLines={2}
          className={`font-sans text-[12.5px] leading-[16px] font-semibold ${
            selected ? 'text-[#0B2E59]' : 'text-[#0F172A]'
          }`}
        >
          {label}
        </Text>

        <View className="flex-row items-center gap-1.5 flex-wrap">
          {isHighRisk ? (
            <View className="h-2 w-2 rounded-full bg-[#B45309] shrink-0" />
          ) : null}
          <Text
            style={{ fontFamily: 'JetBrainsMono_600SemiBold', fontVariant: ['tabular-nums'] }}
            className={`text-[10.5px] ${
              isHighRisk ? 'text-[#B45309]' : 'text-[#475569]'
            }`}
          >
            {badgeText}
          </Text>
          {isHighRisk ? (
            <Text className="font-sans text-[9.5px] font-bold text-[#B45309]">
              Cepat Basi
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};
