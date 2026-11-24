import React from 'react';

export type CivicButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

interface CivicButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CivicButtonVariant;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
}

const VARIANT_CLASSES: Record<CivicButtonVariant, string> = {
  primary:
    'bg-[#0F4C81] text-white border border-[#0F4C81] active:bg-[#0A355C] disabled:bg-[#CBD5E1] disabled:border-[#CBD5E1] disabled:text-[#64748B]',
  secondary:
    'bg-white text-[#0F4C81] border border-[#BDD5EB] active:bg-[#EBF3FA] disabled:bg-[#EDF2F7] disabled:text-[#94A3B8]',
  danger:
    'bg-[#B91C1C] text-white border border-[#B91C1C] active:bg-[#991B1B] disabled:bg-[#FCA5A5]',
  success:
    'bg-[#15803D] text-white border border-[#15803D] active:bg-[#166534]',
  ghost:
    'bg-transparent text-[#0F4C81] border border-transparent active:bg-[#EBF3FA]',
};

export const CivicButton: React.FC<CivicButtonProps> = ({
  variant = 'primary',
  icon,
  fullWidth = true,
  size = 'lg',
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const heightClass = size === 'lg' ? 'min-h-[52px] px-4 py-3 text-[14px]' : 'min-h-[48px] px-3.5 py-2.5 text-[13px]';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      className={`flex flex-row items-center justify-center gap-2 rounded-[10px] font-bold tracking-[-0.01em] transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100 disabled:cursor-not-allowed cursor-pointer ${heightClass} ${widthClass} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {icon ? <span className="flex shrink-0 items-center justify-center">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </button>
  );
};
