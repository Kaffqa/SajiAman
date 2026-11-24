import React from 'react';
import { ArrowLeft } from 'lucide-react';

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

  return (
    <header
      className={`flex flex-row items-center justify-between gap-2 px-3 py-2.5 min-h-[56px] shrink-0 border-b ${
        isNavy
          ? 'bg-[#0B2E59] border-[#1E3A5F] text-white'
          : 'bg-white border-[#D8E2EC] text-[#0F172A]'
      }`}
    >
      <div className="flex flex-row items-center gap-2 min-w-0 flex-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] active:scale-[0.96] cursor-pointer ${
              isNavy
                ? 'bg-white/10 text-white active:bg-white/20'
                : 'bg-[#F4F7FA] text-[#0F172A] border border-[#D8E2EC] active:bg-[#EDF2F7]'
            }`}
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>
        ) : null}

        <div className="flex flex-col min-w-0">
          {eyebrow ? (
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.07em] truncate ${
                isNavy ? 'text-[#93C5FD]' : 'text-[#475569]'
              }`}
            >
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-[16px] font-bold tracking-[-0.02em] truncate leading-[1.2]">
            {title}
          </h1>
        </div>
      </div>

      {rightSlot ? <div className="flex shrink-0 items-center">{rightSlot}</div> : null}
    </header>
  );
};
