import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertOctagon,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Lock,
  PackageCheck,
  Recycle,
  ShieldCheck,
  Truck,
  Utensils,
  XCircle,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../../src/components/ui/CivicButton';
import { HairlineCard } from '../../../src/components/ui/HairlineCard';
import { StepHeader } from '../../../src/components/ui/StepHeader';
import { useSajiAman } from '../../../src/context/SajiAmanContext';
import {
  evaluateBatchSafety,
  formatHoursId,
  formatWibTime,
} from '../../../src/domain/weakestLinkEngine';

export default function SchoolBatchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getBatchById,
    isBatchScanUnlocked,
    simulatedNowMs,
    markOmprengReadyForPickup,
    refreshBatchSamplePhoto,
    showToast,
  } = useSajiAman();

  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const retriedPhotoBatchRef = useRef<string | null>(null);

  const batch = id ? getBatchById(id) : undefined;

  useEffect(() => {
    if (batch?.id && (batch.samplePhotoStoragePath || batch.samplePhotoUrl)) {
      refreshBatchSamplePhoto(batch.id);
    }
  }, [batch?.id]);

  if (!batch) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
        <StepHeader
          title="Detail Boks"
          onBack={() => router.back()}
        />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base font-bold text-[#475569]">
            Data boks tidak ditemukan
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isBatchScanUnlocked(batch.id)) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
        <StepHeader
          title="Segel Boks Belum Terbuka"
          eyebrow="VERIFIKASI QR WAJIB • MBG"
          onBack={() => router.replace('/(school)' as any)}
        />
        <View className="flex-1 items-center justify-center p-5">
          <View className="w-full max-w-[340px] rounded-[16px] border border-[#BDD5EB] bg-white p-6 items-center gap-4 shadow-sm">
            <View className="h-14 w-14 rounded-full bg-[#EBF3FA] items-center justify-center">
              <Lock size={28} color="#0F4C81" />
            </View>
            <Text className="font-sans text-[16px] font-extrabold text-[#0F172A] text-center">
              Pindai QR Boks Fisik Saat Tiba
            </Text>
            <Text className="font-sans text-[12px] text-[#475569] text-center leading-[18px]">
              Kronologi lengkap, batas jam kedaluwarsa, dan foto sampel masak hanya dibuka setelah segel QR fisik pada boks dipindai atau diverifikasi dengan kode segel stiker.
            </Text>
            <CivicButton
              variant="primary"
              size="md"
              onPress={() => router.replace('/(school)/scan-qr' as any)}
            >
              Buka Pemindai QR
            </CivicButton>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const bStatus = batch.batchStatus || 'active';
  const isRejected = bStatus === 'rejected_spoiled';
  const isVoided = bStatus === 'voided';
  const evaluation = evaluateBatchSafety(batch, simulatedNowMs);

  const handleMarkReadyForPickup = async () => {
    if (isMarkingReady) return;
    setIsMarkingReady(true);
    try {
      await markOmprengReadyForPickup(batch.id);
      showToast('Wadah ompreng berhasil ditandai siap dijemput Dapur SPPG', 'success');
    } catch (err: any) {
      showToast('Gagal menandai wadah: ' + (err?.message || ''), 'warning');
    } finally {
      setIsMarkingReady(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        eyebrow={`${batch.id} • ${batch.schoolName}`}
        title={`Kronologi Boks: ${batch.boxNumber}`}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <View className="mt-4">
          {isRejected ? (
            <View className="p-4 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] gap-2.5">
              <View className="flex-row items-start gap-3">
                <XCircle size={22} color="#DC2626" />
                <View className="flex-1">
                  <Text className="text-sm font-black text-[#DC2626] uppercase">
                    BOKS DITOLAK (RUSAK / BASI DINI)
                  </Text>
                  <Text className="text-xs text-[#7F1D1D] mt-0.5 font-medium">
                    Alasan: &ldquo;{batch.rejectionReason || 'Kondisi makanan tidak layak konsumsi'}&rdquo;
                  </Text>
                </View>
              </View>
              {batch.rejectionPhotoPath ? (
                <Image
                  source={{ uri: batch.rejectionPhotoPath }}
                  className="w-full h-36 rounded-lg border border-[#FCA5A5]"
                  resizeMode="cover"
                />
              ) : null}
            </View>
          ) : isVoided ? (
            <View className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] flex-row items-start gap-3">
              <AlertOctagon size={22} color="#64748B" />
              <View className="flex-1">
                <Text className="text-sm font-bold text-[#475569] uppercase">
                  BATCH DIBATALKAN OLEH DAPUR
                </Text>
                <Text className="text-xs text-[#64748B] mt-0.5">
                  Alasan: "{batch.voidReason || 'Pembatalan teknis oleh tim dapur'}"
                </Text>
              </View>
            </View>
          ) : (
            <View
              className={`p-4 rounded-xl border flex-row items-center justify-between gap-2.5 ${
                evaluation.status === 'GREEN'
                  ? 'bg-[#DCFCE7] border-[#86EFAC]'
                  : evaluation.status === 'YELLOW'
                  ? 'bg-[#FEF3C7] border-[#FCD34D]'
                  : 'bg-[#FEE2E2] border-[#FCA5A5]'
              }`}
            >
              <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                <ShieldCheck
                  size={20}
                  className="shrink-0"
                  color={
                    evaluation.status === 'GREEN'
                      ? '#15803D'
                      : evaluation.status === 'YELLOW'
                      ? '#B45309'
                      : '#DC2626'
                  }
                />
                <View className="flex-1 min-w-0">
                  <Text
                    numberOfLines={2}
                    className={`text-xs font-black uppercase ${
                      evaluation.status === 'GREEN'
                        ? 'text-[#15803D]'
                        : evaluation.status === 'YELLOW'
                        ? 'text-[#B45309]'
                        : 'text-[#DC2626]'
                    }`}
                  >
                    STATUS: {evaluation.verdictTitle}
                  </Text>
                  <Text className="text-[11px] text-[#475569] mt-0.5">
                    Batas Konsumsi: {formatWibTime(batch.expiresAt)}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(school)/scan/[id]',
                    params: { id: batch.id },
                  })
                }
                className="flex-row items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-[#D8E2EC] shrink-0"
              >
                <Text className="text-[11px] font-bold text-[#0F4C81]">Live Scanner</Text>
                <ExternalLink size={12} color="#0F4C81" />
              </Pressable>
            </View>
          )}
        </View>

        {/* Timeline Title */}
        <Text className="text-xs font-bold text-[#475569] uppercase tracking-wider mt-6 mb-3">
          Jejak Rantai Pasok & Pengawasan
        </Text>

        {/* Node 1: Dimasak di SPPG */}
        <HairlineCard className="p-4 bg-white mb-3">
          <View className="flex-row items-start gap-3">
            <View className="h-8 w-8 rounded-full bg-[#EBF3FA] items-center justify-center border border-[#BDD5EB]">
              <Utensils size={15} color="#0F4C81" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-bold text-[#0B2E59] flex-1 min-w-0">
                  1. Dimasak &amp; Disegel di SPPG
                </Text>
                <Text className="text-xs font-mono font-bold text-[#0F4C81] shrink-0">
                  {formatWibTime(batch.cookedAt)}
                </Text>
              </View>
              <Text className="text-xs text-[#64748B] mt-0.5">
                Dapur: {batch.kitchenName}
              </Text>

              {/* Sample Photo Preview */}
              {batch.samplePhotoUrl && (
                <View className="mt-2.5 rounded-lg overflow-hidden border border-[#CBD5E1]">
                  <Image
                    source={{ uri: batch.samplePhotoUrl }}
                    onError={() => {
                      if (retriedPhotoBatchRef.current === batch.id) return;
                      retriedPhotoBatchRef.current = batch.id;
                      void refreshBatchSamplePhoto(batch.id);
                    }}
                    style={{ width: '100%', height: 140 }}
                    resizeMode="cover"
                  />
                  <View className="bg-[#0B2E59]/80 px-2.5 py-1 flex-row items-center justify-between">
                    <Text className="text-[10px] font-bold text-white">
                      Foto Sampel Live Masak
                    </Text>
                    <Text className="text-[10px] font-mono text-[#93C5FD]">
                      {batch.samplePhotoTimestamp || formatWibTime(batch.cookedAt)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Menu items summary */}
              <View className="mt-2.5 bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0]">
                <Text className="text-[11px] font-bold text-[#334155] mb-1">
                  Komposisi Menu Olahan:
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {batch.items.map((item, i) => (
                    <View
                      key={`${item.id}-${i}`}
                      className="px-2 py-0.5 rounded bg-white border border-[#CBD5E1]"
                    >
                      <Text className="text-[10px] font-semibold text-[#475569]">
                        {item.name}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text className="text-[10px] text-[#B45309] font-bold mt-1.5">
                  * Titik Lemah Basi: {batch.weakestLinkItemName} ({formatHoursId(batch.holdingHours)})
                </Text>
              </View>
            </View>
          </View>
        </HairlineCard>

        {/* Node 2: Diterima di Sekolah */}
        <HairlineCard className="p-4 bg-white mb-3">
          <View className="flex-row items-start gap-3">
            <View className="h-8 w-8 rounded-full bg-[#DCFCE7] items-center justify-center border border-[#86EFAC]">
              <PackageCheck size={15} color="#15803D" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-bold text-[#0B2E59] flex-1 min-w-0">
                  2. Penerimaan di Sekolah
                </Text>
                <Text className="text-xs font-mono font-bold text-[#15803D] shrink-0">
                  {batch.omprengConfirmedAt
                    ? formatWibTime(batch.omprengConfirmedAt)
                    : batch.arrivedAt
                    ? formatWibTime(batch.arrivedAt)
                    : 'Dalam Pengiriman'}
                </Text>
              </View>

              <Text className="text-xs text-[#64748B] mt-0.5">
                Penerima: {batch.omprengConfirmedBy || 'Koordinator Guru Sekolah'}
              </Text>

              <View className="mt-2 bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0] gap-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] text-[#475569]">Jumlah Boks Dikirim Dapur:</Text>
                  <Text className="text-xs font-bold text-[#0F172A]">{batch.omprengCount} Unit</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] text-[#475569]">Jumlah Diterima Aktual:</Text>
                  <Text className="text-xs font-bold text-[#15803D]">
                    {batch.omprengReceivedCount || batch.omprengCount} Unit
                  </Text>
                </View>

                {batch.omprengDiscrepancyNote && (
                  <View className="bg-[#FEF3C7] p-2 rounded border border-[#FCD34D] mt-1">
                    <Text className="text-[10px] font-bold text-[#B45309]">
                      Catatan Selisih / Kerusakan Boks:
                    </Text>
                    <Text className="text-[11px] text-[#78350F] mt-0.5">
                      "{batch.omprengDiscrepancyNote}"
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </HairlineCard>

        {/* Node 3: Status Wadah (Ompreng Stainless) */}
        <HairlineCard className="p-4 bg-white mb-4">
          <View className="flex-row items-start gap-3">
            <View className="h-8 w-8 rounded-full bg-[#FEF3C7] items-center justify-center border border-[#FCD34D]">
              <Truck size={15} color="#B45309" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-bold text-[#0B2E59] flex-1 min-w-0">
                  3. Pengembalian Wadah
                </Text>
                <View
                  className={`px-2 py-0.5 rounded shrink-0 ${
                    batch.omprengStatus === 'returned_sterilized'
                      ? 'bg-[#DCFCE7] border border-[#86EFAC]'
                      : batch.omprengReadyForPickup
                      ? 'bg-[#FEF3C7] border border-[#FCD34D]'
                      : 'bg-[#F1F5F9] border border-[#CBD5E1]'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      batch.omprengStatus === 'returned_sterilized'
                        ? 'text-[#15803D]'
                        : batch.omprengReadyForPickup
                        ? 'text-[#B45309]'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {batch.omprengStatus === 'returned_sterilized'
                      ? 'STERIL DI DAPUR'
                      : batch.omprengReadyForPickup
                      ? 'SIAP DIJEMPUT'
                      : 'DIGUNAKAN'}
                  </Text>
                </View>
              </View>

              <Text className="text-xs text-[#64748B] mt-1">
                {batch.omprengStatus === 'returned_sterilized'
                  ? `Boks telah dijemput dan disterilisasi di SPPG (${formatWibTime(batch.omprengReturnedAt || batch.cookedAt)})`
                  : batch.omprengReadyForPickup
                  ? 'Koordinator sekolah telah menandai wadah kosong selesai dan siap dijemput oleh armada logistik SPPG.'
                  : 'Boks masih berada di ruang makan siswa atau belum selesai dicuci.'}
              </Text>

              {batch.omprengStatus === 'received_school' &&
                !batch.omprengReadyForPickup &&
                bStatus === 'active' && (
                <View className="mt-3">
                  <CivicButton
                    label="Tandai Ompreng Siap Dijemput SPPG"
                    variant="secondary"
                    size="sm"
                    loading={isMarkingReady}
                    disabled={isMarkingReady}
                    icon={<Truck size={14} color="#0F4C81" />}
                    onPress={handleMarkReadyForPickup}
                  />
                </View>
              )}
            </View>
          </View>
        </HairlineCard>

        {/* Quick Waste Report Link */}
        <View className="mt-2">
          <CivicButton
            label="Lapor Sisa Makanan Organik (Maggot BSF)"
            variant="outline"
            icon={<Recycle size={16} color="#0F4C81" />}
            onPress={() =>
              router.push({
                pathname: '/(school)/report-waste/[id]',
                params: { id: batch.id },
              })
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
