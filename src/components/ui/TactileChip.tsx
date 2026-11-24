import React from 'react';
import { Check } from 'lucide-react';

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
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={selected}
      className={`flex flex-row items-center justify-between gap-2 min-h-[48px] px-3 py-2 rounded-[8px] text-left transition-transform duration-150 active:scale-[0.98] cursor-pointer ${
        selected
          ? 'bg-[#EBF3FA] border-[1.5px] border-[#0F4C81] text-[#0B2E59]'
          : 'bg-white border border-[#D8E2EC] text-[#0F172A] active:bg-[#F4F7FA]'
      }`}
    >
      <div className="flex flex-row items-center gap-2 min-w-0 flex-1">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
            selected
              ? 'bg-[#0F4C81] border-[#0F4C81] text-white'
              : 'bg-white border-[#94A3B8]'
          }`}
        >
          {selected ? <Check className="w-3 h-3" strokeWidth={2.5} /> : null}
        </span>
        <span className="text-[13px] font-semibold leading-[1.25] truncate">{label}</span>
      </div>

      <span className="flex flex-row items-center gap-1 shrink-0 font-mono text-[11px] font-semibold tabular-nums text-[#475569]">
        {isHighRisk ? (
          <span
            aria-label="Risiko cepat basi"
            className="inline-block h-2 w-2 rounded-full bg-[#B45309]"
          />
        ) : null}
        <span>{badgeText}</span>
      </span>
    </button>
  );
};
