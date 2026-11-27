import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CheckCircle2,
  MapPin,
  Package,
  Recycle,
  Truck,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticsAdapter } from '../../../src/adapters/hapticsAdapter';
import { CivicButton } from '../../../src/components/ui/CivicButton';
import { HairlineCard } from '../../../src/components/ui/HairlineCard';
import { StepHeader } from '../../../src/components/ui/StepHeader';
import { useSajiAman } from '../../../src/context/SajiAmanContext';
import { WASTE_VOLUME_PRESETS } from '../../../src/data/mockRepository';
import { evaluateBatchSafety, formatWibTime } from '../../../src/domain/weakestLinkEngine';
import type { MaggotReport, WasteCategory, WasteVolumePreset } from '../../../src/types/sajiaman';

const CATEGORIES: Array<{ id: WasteCategory; label: string; desc: string }> = [
  {
    id: 'post_meal',
    label: 'Sisa Pasca-Makan',
    desc: 'Sisa piring siswa',
  },
  {
    id: 'surplus_intact',
    label: 'Surplus Porsi Utuh',
    desc: 'Porsi tak terbagi',
  },
  {
    id: 'expired_red',
    label: 'Kedaluwarsa (Status Merah)',
    desc: 'Melewati batas aman',
  },
];

export default function WasteReportScreen() {
  const router = useRouter();
  const { id, presetCategory } = useLocalSearchParams<{
    id: string;
    presetCategory?: WasteCategory;
  }>();
  const { batches, simulatedNowMs, submitMaggotReport } = useSajiAman();

  const batch = batches.find(
    (b) => b.id.toUpperCase() === String(id).toUpperCase()
  );

  const evaluation = batch
    ? evaluateBatchSafety(batch, simulatedNowMs)
    : null;

  const initialCategory: WasteCategory =
    (presetCategory as WasteCategory) ??
    (evaluation?.status === 'RED' ? 'expired_red' : 'post_meal');

  const [category, setCategory] = useState<WasteCategory>(initialCategory);
  const [volumeId, setVolumeId] = useState<WasteVolumePreset['id']>(
    initialCategory === 'expired_red' ? 'surplus_penuh' : 'sedang'
  );
  const [locationNote, setLocationNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<MaggotReport | null>(null);

  if (!batch || !evaluation) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA] items-center justify-center p-6">
        <Text className="font-sans text-[14px] font-semibold text-[#475569]">
          Data batch tidak ditemukan.
        </Text>
        <View className="mt-4 w-full max-w-[220px]">
          <CivicButton onPress={() => router.replace('/(school)' as any)}>
            Kembali ke Pemindai
          </CivicButton>
        </View>
      </SafeAreaView>
    );
  }

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    hapticsAdapter.mediumImpact();
    try {
      const created = await submitMaggotReport({
        batchId: batch.id,
        category,
        volumePresetId: volumeId,
        locationNote,
      });
      if (created) {
        setSubmittedReport(created);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedReport) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
        <StepHeader
          title="Laporan Sisa Terkirim"
          eyebrow="JALUR BIOKONVERSI MAGGOT BSF"
          onBack={() => router.replace('/(school)' as any)}
        />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: 16,
            flexGrow: 1,
            justifyContent: 'space-between',
          }}
        >
          <View className="gap-4">
            <HairlineCard className="border-[#86EFAC] bg-[#DCFCE7] items-center text-center gap-2.5 py-6">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#15803D]">
                <CheckCircle2 size={28} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <Text className="font-sans text-[18px] font-extrabold text-[#14532D] tracking-[-0.02em] text-center">
                Laporan Terkirim ke {batch.kitchenName}
              </Text>
              <Text className="font-sans text-[13px] font-semibold text-[#14532D] text-center">
                Status: Siap Dijemput Mitra Maggot BSF
              </Text>
            </HairlineCard>

            <HairlineCard className="gap-2.5">
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[12px] text-[#475569]">
                  Nomor Tiket Jemput
                </Text>
                <Text style={styles.confirmTicketMono}>
                  {submittedReport.id}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[12px] text-[#475569]">
                  Batch Terkait
                </Text>
                <Text style={styles.confirmBatchMono}>
                  {submittedReport.batchId}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[12px] text-[#475569]">
                  Estimasi Volume
                </Text>
                <Text style={styles.confirmVolumeMono}>
                  {submittedReport.volumeLabel}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[12px] text-[#475569]">
                  Waktu Lapor
                </Text>
                <Text style={styles.confirmTimeMono}>
                  {formatWibTime(submittedReport.reportedAt)}
                </Text>
              </View>

              <View className="pt-2 border-t border-[#EDF2F7]">
                <Text className="font-sans text-[12px] text-[#475569]">
                  Lokasi:{' '}
                  <Text className="font-bold text-[#0F172A]">
                    {submittedReport.locationNote}
                  </Text>
                </Text>
              </View>
            </HairlineCard>
          </View>

          <View className="gap-2.5 pt-4">
            <CivicButton
              variant="primary"
              onPress={() => router.replace('/(school)' as any)}
            >
              Kembali ke Pemindai QR
            </CivicButton>
            <CivicButton
              variant="secondary"
              size="md"
              onPress={() => router.replace('/(school)/history' as any)}
            >
              Lihat Riwayat Laporan Sekolah
            </CivicButton>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        title="Lapor Sisa &amp; Surplus"
        eyebrow="PENANGANAN LIMBAH MAGGOT BSF"
        onBack={() => router.back()}
      />

      {/* Batch Reference Strip */}
      <View className="bg-[#EBF3FA] border-b border-[#BDD5EB] px-4 py-2.5 flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2 flex-1">
          <Package size={16} color="#0F4C81" />
          <Text
            numberOfLines={1}
            style={styles.batchStripMono}
            className="flex-1"
          >
            {batch.id} • {batch.schoolName}
          </Text>
        </View>
        <View
          className={`px-2 py-0.5 rounded-[5px] ${
            evaluation.status === 'RED'
              ? 'bg-[#FEE2E2] border border-[#FCA5A5]'
              : evaluation.status === 'YELLOW'
                ? 'bg-[#FEF3C7] border border-[#FCD34D]'
                : 'bg-[#DCFCE7] border border-[#86EFAC]'
          }`}
        >
          <Text
            className={`font-sans text-[10px] font-bold uppercase ${
              evaluation.status === 'RED'
                ? 'text-[#7F1D1D]'
                : evaluation.status === 'YELLOW'
                  ? 'text-[#78350F]'
                  : 'text-[#14532D]'
            }`}
          >
            {evaluation.verdictBadge}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: 3 Tactile Category Pills */}
        <View className="gap-2">
          <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            1. KATEGORI LAPORAN
          </Text>
          <View className="gap-2">
            {CATEGORIES.map((cat) => {
              const selected = category === cat.id;
              const isCatRed = cat.id === 'expired_red';

              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    hapticsAdapter.lightImpact();
                    setCategory(cat.id);
                  }}
                  className={`min-h-[48px] px-3.5 py-2.5 rounded-[10px] flex-row items-center justify-between border ${
                    selected
                      ? isCatRed
                        ? 'bg-[#FEE2E2] border-[#B91C1C]'
                        : 'bg-[#EBF3FA] border-[#0F4C81]'
                      : 'bg-white border-[#D8E2EC]'
                  }`}
                >
                  <View className="flex-1 min-w-0 pr-2">
                    <Text
                      className={`font-sans text-[13px] font-bold ${
                        selected
                          ? isCatRed
                            ? 'text-[#7F1D1D]'
                            : 'text-[#0B2E59]'
                          : 'text-[#0F172A]'
                      }`}
                    >
                      {cat.label}
                    </Text>
                    <Text className="font-sans text-[11px] text-[#64748B] mt-0.5">
                      {cat.desc}
                    </Text>
                  </View>

                  <View
                    className={`h-4 w-4 rounded-full border-2 items-center justify-center shrink-0 ${
                      selected
                        ? isCatRed
                          ? 'border-[#B91C1C] bg-[#B91C1C]'
                          : 'border-[#0F4C81] bg-[#0F4C81]'
                        : 'border-[#94A3B8] bg-white'
                    }`}
                  >
                    {selected ? (
                      <View className="h-1.5 w-1.5 rounded-full bg-white" />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 2: 2x2 Tactile Volume Selector Grid */}
        <View className="gap-2">
          <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            2. ESTIMASI VOLUME PRAKTIS (TANPA TIMBANGAN)
          </Text>
          <View className="flex-row flex-wrap gap-2.5">
            {WASTE_VOLUME_PRESETS.map((preset, idx) => {
              const selected = volumeId === preset.id;
              const level = idx + 1;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => {
                    hapticsAdapter.lightImpact();
                    setVolumeId(preset.id);
                  }}
                  style={{ width: '48%' }}
                  className={`min-h-[94px] rounded-[12px] p-3 justify-between border ${
                    selected
                      ? 'bg-[#EBF3FA] border-[#0F4C81]'
                      : 'bg-white border-[#D8E2EC]'
                  }`}
                >
                  <View className="flex-row items-center justify-between gap-1.5">
                    <Text
                      numberOfLines={1}
                      className={`flex-1 min-w-0 font-sans text-[14px] font-extrabold tracking-[-0.01em] ${
                        selected ? 'text-[#0B2E59]' : 'text-[#0F172A]'
                      }`}
                    >
                      {preset.title}
                    </Text>
                    <Recycle
                      size={16}
                      color={selected ? '#0F4C81' : '#94A3B8'}
                      className="shrink-0"
                    />
                  </View>
                  <View className="gap-1.5">
                    <View className="flex-row items-center gap-1">
                      {[1, 2, 3, 4].map((bar) => (
                        <View
                          key={bar}
                          className={`flex-1 h-1.5 rounded-full ${
                            bar <= level
                              ? selected
                                ? 'bg-[#0F4C81]'
                                : 'bg-[#16A34A]'
                              : 'bg-[#E2E8F0]'
                          }`}
                        />
                      ))}
                    </View>
                    <Text style={styles.presetUnitMono}>{preset.unitLabel}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 3: Optional Single-Line Note */}
        <View className="gap-1.5">
          <View className="flex-row items-center gap-1">
            <MapPin size={14} color="#475569" />
            <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
              3. CATATAN SINGKAT LOKASI (OPSIONAL)
            </Text>
          </View>
          <TextInput
            value={locationNote}
            onChangeText={setLocationNote}
            placeholder="Titip di pos satpam dekat gerbang utama"
            placeholderTextColor="#94A3B8"
            style={styles.locationInput}
          />
        </View>

      </ScrollView>
      </KeyboardAvoidingView>

      {/* Pinned Submit CTA */}
      <View className="bg-white border-t border-[#D8E2EC] px-4 py-3">
        <CivicButton
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting}
          icon={<Truck size={20} color="#FFFFFF" strokeWidth={2} />}
          onPress={handleSubmit}
        >
          Kirim &amp; Panggil Penjemputan Maggot
        </CivicButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  confirmTicketMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: '#0F172A',
  },
  confirmBatchMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: '#0F4C81',
  },
  confirmVolumeMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: '#15803D',
  },
  confirmTimeMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: '#0F172A',
  },
  batchStripMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: '#0B2E59',
  },
  presetUnitMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: '#0F4C81',
  },
  locationInput: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#0F172A',
  },
});
