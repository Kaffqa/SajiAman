import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { hapticsAdapter } from '../../adapters/hapticsAdapter';

export type CivicButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';

interface CivicButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: CivicButtonVariant;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  children?: React.ReactNode;
  className?: string;
  testID?: string;
}

const VARIANT_CONTAINER: Record<CivicButtonVariant, string> = {
  primary: 'bg-[#0F4C81] border-[#0F4C81]',
  secondary: 'bg-white border-[#BDD5EB]',
  outline: 'bg-transparent border-[#CBD5E1]',
  danger: 'bg-[#B91C1C] border-[#B91C1C]',
  success: 'bg-[#15803D] border-[#15803D]',
  ghost: 'bg-transparent border-transparent',
};

const VARIANT_TEXT: Record<CivicButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-[#0F4C81]',
  outline: 'text-[#0F4C81]',
  danger: 'text-white',
  success: 'text-white',
  ghost: 'text-[#0F4C81]',
};

export const CivicButton: React.FC<CivicButtonProps> = ({
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  icon,
  fullWidth = true,
  size = 'lg',
  label,
  children,
  className = '',
  testID,
}) => {
  const heightClass =
    size === 'sm'
      ? 'min-h-[38px] py-1.5 px-3'
      : size === 'lg'
      ? 'min-h-[52px] py-3.5 px-4'
      : 'min-h-[48px] py-2.5 px-3.5';
  const widthClass = fullWidth ? 'w-full' : 'self-start';
  const isInactive = disabled || loading;

  const handlePress = () => {
    if (isInactive || !onPress) return;
    hapticsAdapter.lightImpact();
    onPress();
  };

  const indicatorColor =
    variant === 'secondary' || variant === 'ghost' || variant === 'outline'
      ? '#0F4C81'
      : '#FFFFFF';

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={isInactive}
      className={`flex-row items-center justify-center gap-2 rounded-[10px] border active:opacity-85 ${heightClass} ${widthClass} ${VARIANT_CONTAINER[variant]} ${isInactive ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : icon ? (
        <View className="shrink-0 items-center justify-center">{icon}</View>
      ) : null}
      <Text
        className={`font-sans font-bold text-[14px] tracking-[-0.01em] text-center shrink ${VARIANT_TEXT[variant]}`}
        numberOfLines={1}
      >
        {children ?? label}
      </Text>
    </Pressable>
  );
};
