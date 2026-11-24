import React from 'react';

interface HairlineCardProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export const HairlineCard: React.FC<HairlineCardProps> = ({
  children,
  className = '',
  padded = true,
}) => {
  return (
    <div
      className={`shrink-0 rounded-[12px] border border-[#D8E2EC] bg-white ${padded ? 'p-3.5' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
