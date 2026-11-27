import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  BookOpen,
  Building2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Recycle,
  School,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { CivicButton } from './CivicButton';
import {
  TUTORIAL_SLIDES,
  TUTORIAL_TITLES,
  type TutorialAudience,
  type TutorialSlide,
} from '../../data/tutorialContent';

interface RoleTutorialModalProps {
  visible: boolean;
  audience: TutorialAudience;
  onClose: () => void;
}

function renderSlideIcon(iconKey: TutorialSlide['iconKey'], color: string) {
  switch (iconKey) {
    case 'cook':
      return <ChefHat size={34} color={color} strokeWidth={2} />;
    case 'qr':
      return <QrCode size={34} color={color} strokeWidth={2} />;
    case 'recycle':
      return <Recycle size={34} color={color} strokeWidth={2} />;
    case 'school':
      return <School size={34} color={color} strokeWidth={2} />;
    case 'admin':
      return <Building2 size={34} color={color} strokeWidth={2} />;
    default:
      return <ShieldCheck size={34} color={color} strokeWidth={2} />;
  }
}

export const RoleTutorialModal: React.FC<RoleTutorialModalProps> = ({
  visible,
  audience,
  onClose,
}) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = TUTORIAL_SLIDES[audience];
  const headerInfo = TUTORIAL_TITLES[audience];

  useEffect(() => {
    if (visible) {
      setSlideIndex(0);
    }
  }, [visible, audience]);

  const current = slides[slideIndex] || slides[0];
  const isLast = slideIndex >= slides.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/60 items-center justify-center p-4"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-white rounded-[20px] w-full max-w-[390px] border border-[#D8E2EC] overflow-hidden shadow-lg"
        >
          {/* Navy Top Header */}
          <View className="bg-[#0B2E59] px-4 py-3.5 flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
              <View className="h-8 w-8 rounded-[9px] bg-white/15 items-center justify-center shrink-0">
                <BookOpen size={16} color="#93C5FD" />
              </View>
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="font-sans text-[14px] font-bold text-white">
                  {headerInfo.heading}
                </Text>
                <Text numberOfLines={1} className="font-sans text-[11px] text-[#CBD5E1]">
                  {headerInfo.subtitle}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Tutup panduan"
              className="h-8 w-8 rounded-[8px] bg-white/10 items-center justify-center shrink-0"
            >
              <X size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView className="max-h-[420px]" showsVerticalScrollIndicator={false}>
            <View className="p-5 items-center gap-4">
              {/* Step Indicator Dots */}
              <View className="flex-row items-center gap-1.5">
                {slides.map((_, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setSlideIndex(idx)}
                    className={`h-2 rounded-full ${
                      idx === slideIndex ? 'w-7 bg-[#0F4C81]' : 'w-2 bg-[#CBD5E1]'
                    }`}
                  />
                ))}
              </View>

              {/* Big Visual Icon Badge */}
              <View
                style={{ backgroundColor: current.accentBg }}
                className="h-20 w-20 rounded-[22px] items-center justify-center border border-[#E2E8F0]"
              >
                {renderSlideIcon(current.iconKey, current.accentColor)}
              </View>

              <View className="items-center gap-1.5">
                <Text
                  style={{ color: current.accentColor }}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.06em]"
                >
                  {current.stepBadge}
                </Text>
                <Text className="font-sans text-[17px] font-extrabold text-[#0F172A] text-center">
                  {current.title}
                </Text>
                <Text className="font-sans text-[13px] text-[#475569] text-center leading-[19px] mt-0.5">
                  {current.description}
                </Text>
              </View>

              {/* Highlighted Operational Tip */}
              <View className="w-full rounded-[12px] bg-[#F8FAFC] border border-[#D8E2EC] px-3.5 py-2.5">
                <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#0F4C81] mb-0.5">
                  TIPS LAPANGAN
                </Text>
                <Text className="font-sans text-[12px] text-[#334155] leading-[17px]">
                  {current.tip}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer Navigation */}
          <View className="px-5 pb-5 pt-2 flex-row items-center gap-2.5 border-t border-[#EDF2F7] bg-[#F8FAFC]">
            {slideIndex > 0 ? (
              <Pressable
                onPress={() => setSlideIndex((i) => Math.max(0, i - 1))}
                className="h-11 px-3.5 rounded-[10px] border border-[#CBD5E1] bg-white flex-row items-center justify-center gap-1"
              >
                <ChevronLeft size={16} color="#334155" />
                <Text className="font-sans text-[13px] font-semibold text-[#334155]">
                  Kembali
                </Text>
              </Pressable>
            ) : null}

            <View className="flex-1">
              <CivicButton
                variant="primary"
                size="md"
                onPress={() => {
                  if (isLast) {
                    onClose();
                  } else {
                    setSlideIndex((i) => i + 1);
                  }
                }}
              >
                {isLast ? 'Mengerti, Mulai Sekarang' : `Lanjut (${slideIndex + 1}/${slides.length})`}
              </CivicButton>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
