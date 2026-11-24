import React from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import type { ToastMessage } from '../../context/SajiAmanContext';

interface ToastBannerProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  const toneClasses =
    toast.tone === 'success'
      ? 'bg-[#14532D] border-[#15803D] text-white'
      : toast.tone === 'warning'
        ? 'bg-[#78350F] border-[#B45309] text-white'
        : 'bg-[#0B2E59] border-[#0F4C81] text-white';

  const Icon =
    toast.tone === 'success'
      ? CheckCircle2
      : toast.tone === 'warning'
        ? AlertTriangle
        : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute bottom-[76px] left-3 right-3 z-50 flex flex-row items-center justify-between gap-2.5 rounded-[10px] border px-3.5 py-2.5 ${toneClasses}`}
    >
      <div className="flex flex-row items-center gap-2 min-w-0 flex-1">
        <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
        <span className="text-[12px] font-semibold leading-[1.35]">{toast.text}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Tutup notifikasi"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-white/10 active:bg-white/20 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
