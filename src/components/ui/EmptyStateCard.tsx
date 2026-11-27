import React from 'react';
import { Text, View } from 'react-native';
import { CivicButton } from './CivicButton';

interface EmptyStateCardProps {
  icon: React.ReactNode;
  tintBg?: string;
  tintBorder?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Active, icon-anchored empty state card that guides users to the next meaningful action.
 */
export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon,
  tintBg = '#EBF3FA',
  tintBorder = '#BDD5EB',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <View className="rounded-[16px] border border-[#D8E2EC] bg-white px-5 py-6 items-center gap-3 shadow-sm">
      <View
        style={{ backgroundColor: tintBg, borderColor: tintBorder }}
        className="h-14 w-14 rounded-[16px] border items-center justify-center"
      >
        {icon}
      </View>

      <View className="items-center gap-1 max-w-[290px]">
        <Text className="font-sans text-[14px] font-bold text-[#0F172A] text-center">
          {title}
        </Text>
        <Text className="font-sans text-[12px] text-[#64748B] text-center leading-[17px]">
          {description}
        </Text>
      </View>

      {actionLabel && onAction ? (
        <View className="mt-1">
          <CivicButton variant="primary" size="sm" fullWidth={false} onPress={onAction}>
            {actionLabel}
          </CivicButton>
        </View>
      ) : null}
    </View>
  );
};
