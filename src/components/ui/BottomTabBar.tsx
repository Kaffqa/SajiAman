import React from 'react';

export interface TabItemConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
}

interface BottomTabBarProps {
  tabs: TabItemConfig[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  tabs,
  activeId,
  onSelect,
}) => {
  return (
    <nav
      aria-label="Navigasi utama"
      className="flex flex-row items-stretch justify-between h-[64px] shrink-0 bg-white border-t border-[#D8E2EC]"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] transition-colors cursor-pointer active:bg-[#F4F7FA] ${
              isActive ? 'text-[#0F4C81]' : 'text-[#64748B]'
            }`}
          >
            {/* Sharp 3px institutional top indicator bar */}
            <span
              className={`absolute top-0 left-3 right-3 h-[3px] rounded-b-[2px] transition-opacity ${
                isActive ? 'bg-[#0F4C81] opacity-100' : 'opacity-0'
              }`}
            />
            <span className="relative flex items-center justify-center">
              {tab.icon}
              {tab.badgeCount && tab.badgeCount > 0 ? (
                <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#B45309] text-white font-mono text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {tab.badgeCount}
                </span>
              ) : null}
            </span>
            <span className={`text-[11px] leading-none whitespace-nowrap ${isActive ? 'font-bold' : 'font-medium'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
