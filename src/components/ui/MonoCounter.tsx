import React from 'react';

interface MonoCounterProps {
  value: string | number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  sm: 'text-[14px]',
  md: 'text-[20px]',
  lg: 'text-[28px] leading-[1.1]',
  xl: 'text-[34px] leading-[1.1]',
};

export const MonoCounter: React.FC<MonoCounterProps> = ({
  value,
  unit,
  size = 'lg',
  className = '',
}) => {
  return (
    <span className={`inline-flex items-baseline gap-1 font-mono font-bold tabular-nums tracking-[-0.02em] ${SIZE_MAP[size]} ${className}`}>
      <span>{value}</span>
      {unit ? <span className="text-[13px] font-semibold opacity-80">{unit}</span> : null}
    </span>
  );
};
