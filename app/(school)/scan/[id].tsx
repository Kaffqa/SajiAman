import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Minus,
  Plus,
  Recycle,
  RefreshCw,
  ShieldAlert,
  Truck,
  User,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticsAdapter } from '../../../src/adapters/hapticsAdapter';
import { CivicButton } from '../../../src/components/ui/CivicButton';
import { HairlineCard } from '../../../src/components/ui/HairlineCard';
import { StepHeader } from '../../../src/components/ui/StepHeader';
import { TrafficBanner } from '../../../src/components/ui/TrafficBanner';
import { useSajiAman } from '../../../src/context/SajiAmanContext';
import { supabaseRepository } from '../../../src/data/supabaseRepository';
import {
  evaluateBatchSafety,
  formatHoursId,
  formatWibTime,
} from '../../../src/domain/weakestLinkEngine';

export default function SafetyCheckScreen() {
  const router = useRouter();
  const { id, reason } = useLocalSearchParams<{ id: string; reason?: string }>();
  const {
    batches,
    userProfile,
    dataSource,
    simulatedNowMs,
    isClockTampered,
    confirmOmprengReceived,
    rejectBatchSpoiled,
    isBatchScanUnlocked,
    refreshBatchSamplePhoto,
    showToast,
  } = useSajiAman();

  const [permission, requestPermission] = useCameraPermissions();
  const rejectCameraRef = useRef<CameraView | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Bau Asam / Basi Dini');
  const [rejectNote, setRejectNote] = useState('');
  const [rejectPhotoUri, setRejectPhotoUri] = useState<string | null>(null);
  const [isCameraOpenInReject, setIsCameraOpenInReject] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [discrepancyCount, setDiscrepancyCount] = useState<number>(0);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [isSubmittingDiscrepancy, setIsSubmittingDiscrepancy] = useState(false);
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const retriedPhotoBatchRef = useRef<string | null>(null);

  const scannedCode = String(id || '').trim();

  const batch = batches.find(
    (b) => b.id.toUpperCase() === scannedCode.toUpperCase()
  );

  useEffect(() => {
    if (batch?.id && (batch.samplePhotoStoragePath || batch.samplePhotoUrl)) {
      refreshBatchSamplePhoto(batch.id);
    }
  }, [batch?.id]);

  const evaluation = useMemo(() => {
    if (!batch) return null;
    return evaluateBatchSafety(batch, simulatedNowMs);
  }, [batch, simulatedNowMs]);

  if (!batch || !evaluation) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
        <StepHeader
          title="Verifikasi QR Gagal"
          eyebrow="PROTOKOL KEAMANAN PANGAN MBG"
          onBack={() => router.replace('/(school)' as any)}
        />
        <View className="flex-1 p-5 items-center justify-center">
          <View className="w-full max-w-[340px] rounded-[16px] border border-[#FCA5A5] bg-white p-6 items-center gap-4 shadow-sm">
            <View className="h-16 w-16 rounded-full bg-[#FEE2E2] items-center justify-center">
              <ShieldAlert size={36} color="#B91C1C" strokeWidth={2.2} />
            </View>

            <View className="items-center gap-1">
              <View className="px-2.5 py-0.5 rounded-[5px] bg-[#FEE2E2] border border-[#FCA5A5]">
                <Text className="font-sans text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7F1D1D]">
                  BOKS TIDAK TERDAFTAR
                </Text>
              </View>
              <Text className="font-sans text-[18px] font-extrabold text-[#0F172A] text-center mt-1">
                Kode QR Tidak Valid
              </Text>
            </View>

            <View className="w-full rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] p-3 items-center">
              <Text className="font-sans text-[10px] font-bold text-[#64748B] uppercase tracking-[0.05em] mb-1">
                KODE YANG TERBACA
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.timeAuditMono, { color: '#B91C1C', fontSize: 13, textAlign: 'center' }]}
              >
                {scannedCode || 'QR KOSONG / TIDAK TERBACA'}
              </Text>
            </View>

            <Text className="font-sans text-[12px] text-[#475569] text-center leading-[18px]">
              {reason ||
                'Kode QR ini tidak terdaftar dalam manifes Dapur SPPG resmi hari ini. Demi integritas dan keselamatan siswa, dilarang membagikan makanan dari boks tanpa segel resmi SajiAman.'}
            </Text>

            <View className="w-full mt-2">
              <CivicButton
                variant="primary"
                size="md"
                onPress={() => router.replace('/(school)/scan-qr' as any)}
              >
                Pindai Ulang Segel Resmi
              </CivicButton>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (userProfile?.schoolId && batch.schoolId !== userProfile.schoolId) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
        <StepHeader
          title="Akses Boks Ditolak"
          eyebrow="ISOLASI UNIT SEKOLAH MBG"
          onBack={() => router.replace('/(school)' as any)}
        />
        <View className="flex-1 p-5 items-center justify-center">
          <View className="w-full max-w-[340px] rounded-[16px] border border-[#FCA5A5] bg-white p-6 items-center gap-4 shadow-sm">
            <View className="h-16 w-16 rounded-full bg-[#FEE2E2] items-center justify-center">
              <Ban size={34} color="#B91C1C" strokeWidth={2.2} />
            </View>
            <Text className="font-sans text-[17px] font-extrabold text-[#0F172A] text-center">
              Boks Bukan untuk Sekolah Anda
            </Text>
            <Text className="font-sans text-[12px] text-[#475569] text-center leading-[18px]">
              Batch {batch.id} ditujukan ke {batch.schoolName}, bukan unit {userProfile.schoolName || 'Anda'}. Jangan membuka segel atau membagikan makanan dari boks ini.
            </Text>
            <View className="w-full mt-1">
              <CivicButton
                variant="primary"
                size="md"
                onPress={() => router.replace('/(school)' as any)}
              >
                Kembali ke Pemindai
              </CivicButton>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!isBatchScanUnlocked(batch.id)) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
        <StepHeader
          title="Segel Boks Belum Dipindai"
          eyebrow="VERIFIKASI FISIK WAJIB • QR MBG"
          onBack={() => router.replace('/(school)' as any)}
        />
        <View className="flex-1 p-5 items-center justify-center">
          <View className="w-full max-w-[340px] rounded-[16px] border border-[#BDD5EB] bg-white p-6 items-center gap-4 shadow-sm">
            <View className="h-16 w-16 rounded-full bg-[#EBF3FA] items-center justify-center">
              <Lock size={32} color="#0F4C81" strokeWidth={2.2} />
            </View>
            <Text className="font-sans text-[17px] font-extrabold text-[#0F172A] text-center">
              Pindai QR Boks Fisik Terlebih Dahulu
            </Text>
            <Text className="font-sans text-[12px] text-[#475569] text-center leading-[18px]">
              Status kelayakan, batas jam kedaluwarsa, komposisi menu, dan konfirmasi penerimaan hanya terbuka setelah Anda memindai stiker QR fisik pada boks (atau memasukkan kode segel manual).
            </Text>
            <View className="w-full mt-1">
              <CivicButton
                variant="primary"
                size="md"
                onPress={() => router.replace('/(school)' as any)}
              >
                Buka Pemindai QR
              </CivicButton>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isVoided = batch.batchStatus === 'voided';
  const isSpoiledRejected = batch.batchStatus === 'rejected_spoiled';
  const isRed = evaluation.status === 'RED' || isSpoiledRejected || isVoided;
  const isOmprengConfirmed =
    batch.omprengStatus === 'received_school' ||
    batch.omprengStatus === 'returned_sterilized';

  const handleOpenDiscrepancyModal = () => {
    setDiscrepancyCount(Math.max(1, batch.omprengCount - 1));
    setDiscrepancyNote('');
    setShowDiscrepancyModal(true);
  };

  const handleConfirmDiscrepancy = async () => {
    setIsSubmittingDiscrepancy(true);
    try {
      await confirmOmprengReceived(
        batch.id,
        discrepancyCount,
        discrepancyNote.trim() || 'Selisih boks saat penerimaan di sekolah'
      );
      setShowDiscrepancyModal(false);
    } catch {
      showToast('Gagal mencatat selisih ompreng', 'warning');
    } finally {
      setIsSubmittingDiscrepancy(false);
    }
  };

  const handleStartRejectCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        showToast('Izin kamera wajib aktif untuk foto bukti kondisi boks', 'warning');
        return;
      }
    }
    setIsCameraOpenInReject(true);
  };

  const handleCaptureRejectPhoto = async () => {
    if (isCapturingPhoto || !rejectCameraRef.current || !permission?.granted) return;
    setIsCapturingPhoto(true);
    hapticsAdapter.lightImpact();
    try {
      const pic = await rejectCameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });
      if (pic?.uri) {
        let compressedUri = pic.uri;
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            pic.uri,
            [{ resize: { width: 1024 } }],
            { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
          );
          compressedUri = manipulated.uri;
        } catch {
          // Keep original camera capture if compression fails
        }
        setRejectPhotoUri(compressedUri);
        setIsCameraOpenInReject(false);
        hapticsAdapter.success();
      }
    } catch {
      showToast('Gagal mengambil foto bukti kerusakan boks', 'warning');
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const handleConfirmReject = async () => {
    setIsRejecting(true);
    try {
      let uploadedPhotoPath: string | undefined;
      if (rejectPhotoUri && dataSource === 'supabase') {
        const ownerSchoolId = userProfile?.schoolId || batch.schoolId;
        uploadedPhotoPath = await supabaseRepository.uploadSamplePhoto(
          rejectPhotoUri,
          ownerSchoolId,
          'rejection'
        );
      } else if (rejectPhotoUri) {
        uploadedPhotoPath = rejectPhotoUri;
      }
      const fullReason = rejectReason + (rejectNote.trim() ? ` — ${rejectNote.trim()}` : '');
      setShowRejectModal(false);
      setIsCameraOpenInReject(false);
      await rejectBatchSpoiled(batch.id, fullReason, uploadedPhotoPath);
    } catch (err: any) {
      showToast(err?.message || 'Gagal melaporkan penolakan boks', 'warning');
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        title="Hasil Verifikasi Boks"
        eyebrow="PROTOKOL KEAMANAN MBG"
        onBack={() => router.replace('/(school)' as any)}
        rightSlot={
          <View className="px-2 py-1 rounded-[6px] bg-[#EBF3FA] border border-[#BDD5EB]">
            <Text style={styles.clockTagMono}>
              {formatWibTime(simulatedNowMs)}
            </Text>
          </View>
        }
      />

      <ScrollView
        className="flex-1 bg-[#F4F7FA]"
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Full-Bleed Top Traffic-Light Decision Header (GREEN / YELLOW / RED) */}
        <TrafficBanner
          evaluation={evaluation}
          batchId={batch.id}
          cookedAt={batch.cookedAt}
          expiresAt={batch.expiresAt}
        />

        {isClockTampered && (
          <View className="mx-4 mt-3 p-3.5 rounded-[10px] bg-[#FEF2F2] border border-[#F87171] flex-row items-center gap-3">
            <AlertTriangle size={20} color="#B91C1C" strokeWidth={2.2} />
            <View className="flex-1">
              <Text className="font-sans text-[11px] font-extrabold text-[#7F1D1D] uppercase tracking-[0.05em]">
                Manipulasi Waktu Terdeteksi
              </Text>
              <Text className="font-sans text-[12px] text-[#991B1B] leading-[17px] mt-0.5">
                Jam sistem perangkat diubah. Sistem mengunci perhitungan batas kelayakan pada waktu resmi server Dapur SPPG.
              </Text>
            </View>
          </View>
        )}

        <View className="px-4 py-4 gap-3.5">
          {/* Primary Decision Actions */}
          {isRed ? (
            /* STATE C — HARD LOCK */
            <View className="gap-3">
              {isVoided && (
                <View className="p-3.5 rounded-[10px] bg-[#FEF2F2] border border-[#F87171] gap-1.5">
                  <View className="flex-row items-center gap-1.5">
                    <Ban size={16} color="#B91C1C" strokeWidth={2.2} />
                    <Text className="font-sans text-[12px] font-extrabold uppercase text-[#7F1D1D]">
                      BATCH DIBATALKAN OLEH DAPUR SPPG (VOID)
                    </Text>
                  </View>
                  <Text className="font-sans text-[12px] text-[#991B1B] leading-[17px]">
                    Alasan pembatalan: <Text className="font-bold">{batch.voidReason || 'Kesalahan pencatatan di dapur SPPG'}</Text>. Jangan terima atau bagikan boks ini.
                  </Text>
                </View>
              )}

              {isSpoiledRejected && (
                <View className="p-3.5 rounded-[10px] bg-[#FEF2F2] border border-[#F87171] gap-2">
                  <View className="flex-row items-center gap-1.5">
                    <Ban size={16} color="#B91C1C" strokeWidth={2.2} />
                    <Text className="font-sans text-[12px] font-extrabold uppercase text-[#7F1D1D]">
                      DITOLAK OLEH KOORDINATOR SEKOLAH
                    </Text>
                  </View>
                  <Text className="font-sans text-[12px] text-[#991B1B] leading-[17px]">
                    Alasan: <Text className="font-bold">{batch.rejectionReason || 'Kondisi makanan tidak layak'}</Text>
                  </Text>
                  {batch.rejectionPhotoPath ? (
                    <Image
                      source={{ uri: batch.rejectionPhotoPath }}
                      className="w-full h-36 rounded-[8px] border border-[#FCA5A5]"
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              )}

              {/* Visibly LOCKED / DISABLED bar */}
              <View className="min-h-[48px] rounded-[10px] border border-[#FCA5A5] bg-[#FEE2E2] px-3.5 py-2.5 flex-row items-center justify-center gap-2">
                <Lock size={16} color="#B91C1C" strokeWidth={2.2} />
                <Text className="font-sans text-[13px] font-bold text-[#B91C1C]">
                  Distribusi ke Siswa Dikunci Sistem
                </Text>
              </View>

              <HairlineCard className="border-[#FCA5A5] bg-[#FFF5F5] gap-2">
                <View className="flex-row items-center gap-1.5">
                  <ShieldAlert size={16} color="#B91C1C" strokeWidth={2.2} />
                  <Text className="font-sans text-[13px] font-bold text-[#B91C1C]">
                    Instruksi Keselamatan Wajib
                  </Text>
                </View>
                <View className="gap-1 pl-2">
                  <Text className="font-sans text-[12px] text-[#7F1D1D] leading-[18px]">
                    1. Jangan buka segel boks untuk dikonsumsi siswa kelas manapun.
                  </Text>
                  <Text className="font-sans text-[12px] text-[#7F1D1D] leading-[18px]">
                    {isVoided
                      ? '2. Kembalikan boks utuh kepada pengantar / armada Dapur SPPG.'
                      : '2. Segera alihkan seluruh porsi boks ke jalur pakan maggot (BSF) agar tidak terbuang ke TPA.'}
                  </Text>
                </View>
              </HairlineCard>

              {!isVoided && (
                <CivicButton
                  variant="danger"
                  icon={<Recycle size={20} color="#FFFFFF" strokeWidth={2} />}
                  onPress={() =>
                    router.push({
                      pathname: '/(school)/report-waste/[id]',
                      params: { id: batch.id, presetCategory: 'expired_red' },
                    })
                  }
                >
                  Alihkan ke Jalur Pakan Maggot (BSF)
                </CivicButton>
              )}
            </View>
          ) : (
            /* STATE A (GREEN) or STATE B (YELLOW) */
            <View className="gap-2.5">
              {isOmprengConfirmed ? (
                <View className="gap-2.5">
                  <View className="min-h-[52px] rounded-[10px] border border-[#86EFAC] bg-[#DCFCE7] px-4 py-3 flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center gap-2 flex-1 min-w-0">
                      <CheckCircle2 size={18} color="#15803D" strokeWidth={2.2} className="shrink-0" />
                      <View className="flex-1 min-w-0">
                        <Text className="font-sans text-[13px] font-bold text-[#14532D]">
                          ✓ {batch.omprengReceivedCount ?? batch.omprengCount} Ompreng Dikonfirmasi Masuk
                        </Text>
                        {batch.omprengReceivedCount != null &&
                          batch.omprengReceivedCount < batch.omprengCount && (
                            <Text className="font-sans text-[11px] font-bold text-[#B91C1C] mt-0.5">
                              Selisih -{batch.omprengCount - batch.omprengReceivedCount}: {batch.omprengDiscrepancyNote}
                            </Text>
                          )}
                      </View>
                    </View>
                    <Text style={styles.confirmedTimeMono} className="shrink-0">
                      {formatWibTime(batch.omprengConfirmedAt ?? simulatedNowMs)}
                    </Text>
                  </View>

                  <CivicButton
                    variant="secondary"
                    size="md"
                    icon={<Recycle size={18} color="#0F4C81" strokeWidth={2} />}
                    onPress={() =>
                      router.push({
                        pathname: '/(school)/report-waste/[id]',
                        params: { id: batch.id, presetCategory: 'post_meal' },
                      })
                    }
                  >
                    Lapor Sisa Pasca-Makan (Jalur Maggot)
                  </CivicButton>
                </View>
              ) : (
                <View className="gap-2">
                  <CivicButton
                    variant="primary"
                    loading={isConfirmingReceipt}
                    disabled={isConfirmingReceipt}
                    icon={<ClipboardCheck size={20} color="#FFFFFF" strokeWidth={2} />}
                    onPress={async () => {
                      if (isConfirmingReceipt) return;
                      setIsConfirmingReceipt(true);
                      try {
                        await confirmOmprengReceived(batch.id);
                      } finally {
                        setIsConfirmingReceipt(false);
                      }
                    }}
                  >
                    Konfirmasi Terima Lengkap ({batch.omprengCount} Boks)
                  </CivicButton>

                  <View className="flex-row gap-2.5">
                    <Pressable
                      onPress={handleOpenDiscrepancyModal}
                      className="flex-1 min-h-[46px] rounded-[12px] border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 flex-row items-center justify-center gap-1.5 active:bg-[#FEF3C7]"
                    >
                      <AlertTriangle size={15} color="#B45309" strokeWidth={2.2} />
                      <Text className="font-sans text-[12px] font-bold text-[#92400E]">
                        Lapor Selisih
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowRejectModal(true)}
                      className="flex-1 min-h-[46px] rounded-[12px] border border-[#FCA5A5] bg-[#FFF5F5] px-3 py-2 flex-row items-center justify-center gap-1.5 active:bg-[#FEE2E2]"
                    >
                      <Ban size={15} color="#B91C1C" strokeWidth={2.2} />
                      <Text className="font-sans text-[12px] font-bold text-[#B91C1C]">
                        Tolak Boks
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Batch Audit & Visual Evidence Card */}
          <HairlineCard className="gap-3">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
                BUKTI SAMPEL DAPUR
              </Text>
              <Text
                numberOfLines={1}
                className="font-sans text-[11px] font-semibold text-[#0F4C81] flex-1 text-right"
              >
                {batch.kitchenName}
              </Text>
            </View>

            {/* Live Kitchen Photo Proof or Manual Chef Badge */}
            {batch.samplePhotoUrl ? (
              <View className="flex-row items-center gap-3">
                <View className="w-24 h-20 rounded-[8px] overflow-hidden border border-[#CBD5E1] relative">
                  <Image
                    source={{ uri: batch.samplePhotoUrl }}
                    onError={() => {
                      if (retriedPhotoBatchRef.current === batch.id) return;
                      retriedPhotoBatchRef.current = batch.id;
                      void refreshBatchSamplePhoto(batch.id);
                    }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  <View className="absolute bottom-1 left-1 right-1 bg-black/80 rounded-[3px] py-0.5 px-1 items-center">
                    <Text style={styles.photoLiveTag}>
                      LIVE {formatWibTime(batch.cookedAt).replace(' WIB', '')}
                    </Text>
                  </View>
                </View>
                <View className="flex-1 gap-1">
                  <Text className="font-sans text-[14px] font-bold text-[#0F172A] leading-[18px]">
                    {batch.schoolName}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <CheckCircle2 size={14} color="#15803D" />
                    <Text className="font-sans text-[11px] font-semibold text-[#15803D]">
                      Foto Sampel AI Valid
                    </Text>
                  </View>
                  <Text style={styles.boxMetaMono}>
                    {batch.omprengCount} Ompreng • {batch.boxNumber}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="rounded-[8px] bg-[#EBF3FA] border border-[#BDD5EB] px-3 py-2.5 flex-row items-center justify-between gap-2">
                <View className="flex-1 min-w-0">
                  <Text numberOfLines={1} className="font-sans text-[13px] font-bold text-[#0B2E59]">
                    {batch.schoolName}
                  </Text>
                  <Text className="font-sans text-[11px] font-semibold text-[#0F4C81]">
                    Dicatat via Mode Cepat Chef
                  </Text>
                </View>
                <Text style={styles.omprengBatchMono} className="shrink-0">
                  {batch.omprengCount} Ompreng
                </Text>
              </View>
            )}

            {/* 2-Column Time Audit */}
            <View className="flex-row rounded-[8px] border border-[#D8E2EC] bg-[#F4F7FA]">
              <View className="flex-1 p-2.5 border-r border-[#D8E2EC] gap-0.5">
                <View className="flex-row items-center gap-1">
                  <Clock size={12} color="#475569" />
                  <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                    Selesai Masak
                  </Text>
                </View>
                <Text style={styles.timeAuditMono}>
                  {formatWibTime(batch.cookedAt)}
                </Text>
              </View>
              <View className="flex-1 p-2.5 gap-0.5">
                <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  Batas Aman ({formatHoursId(batch.holdingHours)}j)
                </Text>
                <Text style={[styles.timeAuditMono, { color: '#B45309' }]}>
                  {formatWibTime(batch.expiresAt)}
                </Text>
              </View>
            </View>

            {/* Menu List with Weakest-Link Dish Highlighted */}
            <View className="gap-1.5 pt-1">
              <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                KOMPOSISI MENU BATCH
              </Text>
              <View className="gap-1.5">
                {batch.items.map((item) => {
                  const isWeakest = item.id === batch.weakestLinkItemId;
                  return (
                    <View
                      key={item.id}
                      className={`flex-row items-center justify-between gap-2 px-2.5 py-2 rounded-[8px] border ${
                        isWeakest
                          ? 'bg-[#FEF3C7] border-[#FCD34D]'
                          : 'bg-white border-[#EDF2F7]'
                      }`}
                    >
                      <Text
                        numberOfLines={1}
                        className={`font-sans text-[12px] font-semibold flex-1 ${
                          isWeakest ? 'text-[#78350F]' : 'text-[#0F172A]'
                        }`}
                      >
                        {item.name}
                      </Text>
                      <View className="flex-row items-center gap-1.5">
                        {isWeakest ? (
                          <View className="px-1.5 py-0.5 rounded-[4px] bg-[#78350F]">
                            <Text style={styles.weakestTag}>
                              Penentu Batas
                            </Text>
                          </View>
                        ) : null}
                        <Text style={styles.dishHoldingMono}>
                          {formatHoursId(item.holdingHours)}j
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Logistics Footnote (authentic data only) */}
            <View className="pt-2.5 border-t border-[#EDF2F7] flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-1 shrink-0">
                <Truck size={14} color="#64748B" />
                <Text className="font-sans text-[11px] text-[#475569]">
                  Masak: {formatWibTime(batch.cookedAt)}
                </Text>
              </View>
              <View className="flex-row items-center gap-1 flex-1 min-w-0 justify-end">
                <User size={13} color="#0F4C81" className="shrink-0" />
                <Text numberOfLines={1} style={styles.tempMono} className="min-w-0">
                  Koki: {batch.creatorName || 'Petugas SPPG'}
                </Text>
              </View>
            </View>
          </HairlineCard>
        </View>
      </ScrollView>

      {/* Rejection Modal (Force Red Override - Keyboard & Scroll Safe) */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
        <Pressable
          className="flex-1 bg-black/60 items-center justify-center p-4"
          onPress={() => setShowRejectModal(false)}
        >
          <Pressable
            className="bg-white rounded-[16px] p-5 w-full max-w-[360px] max-h-[88%] border border-[#FCA5A5]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between border-b border-[#EDF2F7] pb-2.5 mb-3">
              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                <Ban size={18} color="#B91C1C" strokeWidth={2.2} className="shrink-0" />
                <Text className="font-sans text-[15px] font-bold text-[#0F172A] flex-1 min-w-0">
                  Tolak Boks &amp; Kunci Status
                </Text>
              </View>
              <Pressable onPress={() => setShowRejectModal(false)} className="p-1 shrink-0">
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>

            <Text className="font-sans text-[12px] text-[#475569] leading-[18px]">
              Tindakan ini akan mengunci status boks menjadi MERAH DARURAT dan membatalkan distribusi makanan ke siswa.
            </Text>

            <View className="gap-1.5">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                PILIH ALASAN PENOLAKAN
              </Text>
              {[
                'Bau Asam / Basi Dini',
                'Tekstur Berlendir / Berubah Warna',
                'Boks Rusak / Terkontaminasi',
                'Porsi Tidak Lengkap',
              ].map((reasonOption) => {
                const isSelected = rejectReason === reasonOption;
                return (
                  <Pressable
                    key={reasonOption}
                    onPress={() => setRejectReason(reasonOption)}
                    className={`min-h-[40px] px-3 py-2 rounded-[8px] border justify-center ${
                      isSelected
                        ? 'bg-[#FEE2E2] border-[#B91C1C]'
                        : 'bg-[#F8FAFC] border-[#D8E2EC]'
                    }`}
                  >
                    <Text
                      className={`font-sans text-[12px] font-bold ${
                        isSelected ? 'text-[#7F1D1D]' : 'text-[#475569]'
                      }`}
                    >
                      {reasonOption}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="gap-1">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                CATATAN TAMBAHAN (OPSIONAL)
              </Text>
              <TextInput
                value={rejectNote}
                onChangeText={setRejectNote}
                placeholder="Contoh: Sayur lodeh berbau asam menyengat"
                placeholderTextColor="#94A3B8"
                className="font-sans text-[12px] text-[#0F172A] border border-[#D8E2EC] rounded-[8px] p-2.5 bg-[#F8FAFC]"
              />
            </View>

            {/* Live Camera Evidence for Rejection */}
            <View className="gap-1.5">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                FOTO BUKTI KONDISI BOKS (KAMERA LIVE)
              </Text>
              {isCameraOpenInReject ? (
                <View className="w-full h-40 rounded-[10px] overflow-hidden bg-[#0B1220] border border-[#0F4C81] relative">
                  <CameraView ref={rejectCameraRef} style={StyleSheet.absoluteFill} />
                  <View className="absolute bottom-2 left-2 right-2 flex-row items-center justify-between gap-2">
                    <Pressable
                      onPress={() => setIsCameraOpenInReject(false)}
                      className="px-3 py-1.5 rounded-[8px] bg-black/70 border border-white/25"
                    >
                      <Text className="font-sans text-[11px] font-bold text-white">Batal</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCaptureRejectPhoto}
                      disabled={isCapturingPhoto}
                      className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] bg-[#DC2626] border border-[#FCA5A5]"
                    >
                      <Camera size={14} color="#FFFFFF" />
                      <Text className="font-sans text-[11px] font-bold text-white">
                        {isCapturingPhoto ? 'Memotret...' : 'Ambil Foto'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : rejectPhotoUri ? (
                <View className="flex-row items-center gap-2.5 p-2 rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2]">
                  <Image
                    source={{ uri: rejectPhotoUri }}
                    className="w-16 h-14 rounded-[6px] border border-[#FCA5A5]"
                    resizeMode="cover"
                  />
                  <View className="flex-1 gap-1">
                    <Text className="font-sans text-[11px] font-bold text-[#7F1D1D]">
                      Foto bukti siap dilampirkan
                    </Text>
                    <Pressable
                      onPress={handleStartRejectCamera}
                      className="self-start flex-row items-center gap-1 px-2 py-1 rounded bg-white border border-[#FCA5A5]"
                    >
                      <RefreshCw size={11} color="#B91C1C" />
                      <Text className="font-sans text-[10px] font-bold text-[#B91C1C]">
                        Ambil Ulang
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handleStartRejectCamera}
                  className="min-h-[42px] px-3 py-2 rounded-[8px] border border-dashed border-[#94A3B8] bg-[#F8FAFC] flex-row items-center justify-center gap-2 active:bg-[#EDF2F7]"
                >
                  <Camera size={16} color="#0F4C81" />
                  <Text className="font-sans text-[12px] font-semibold text-[#0F4C81]">
                    Ambil Foto Kondisi Makanan (Kamera Live)
                  </Text>
                </Pressable>
              )}
            </View>

            <CivicButton
              variant="danger"
              loading={isRejecting}
              onPress={handleConfirmReject}
              className="mt-1"
            >
              {isRejecting ? 'Mengunggah Bukti & Mengunci...' : 'Kunci & Tolak Boks Sekarang'}
            </CivicButton>
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Discrepancy Modal (Keyboard & Scroll Safe) */}
      <Modal
        visible={showDiscrepancyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDiscrepancyModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
        <Pressable
          className="flex-1 bg-black/60 items-center justify-center p-4"
          onPress={() => setShowDiscrepancyModal(false)}
        >
          <Pressable
            className="bg-white rounded-[16px] p-5 w-full max-w-[360px] max-h-[85%] border border-[#D8E2EC]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between border-b border-[#EDF2F7] pb-2.5 mb-3">
              <Text className="font-sans text-[15px] font-bold text-[#0F172A] flex-1 min-w-0">
                Lapor Selisih / Kerusakan Boks
              </Text>
              <Pressable onPress={() => setShowDiscrepancyModal(false)} className="p-1 shrink-0">
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>

            <Text className="font-sans text-[12px] text-[#475569] leading-[18px]">
              Tercatat dikirim: <Text className="font-bold">{batch.omprengCount} boks</Text>. Masukkan jumlah boks fisik yang layak diterima:
            </Text>

            {/* Stepper for received count */}
            <View className="items-center py-2">
              <View className="flex-row items-center gap-4">
                <Pressable
                  onPress={() => setDiscrepancyCount((prev) => Math.max(0, prev - 1))}
                  className="h-11 w-11 rounded-[10px] bg-[#F1F5F9] border border-[#CBD5E1] items-center justify-center active:bg-[#E2E8F0]"
                >
                  <Minus size={20} color="#0F172A" />
                </Pressable>
                <View className="min-w-[90px] items-center">
                  <Text style={[styles.timeAuditMono, { fontSize: 26, color: '#0B2E59' }]}>
                    {discrepancyCount}
                  </Text>
                  <Text className="font-sans text-[11px] font-bold text-[#64748B] uppercase">
                    BOKS DITERIMA
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDiscrepancyCount((prev) => Math.min(batch.omprengCount, prev + 1))}
                  className="h-11 w-11 rounded-[10px] bg-[#F1F5F9] border border-[#CBD5E1] items-center justify-center active:bg-[#E2E8F0]"
                >
                  <Plus size={20} color="#0F172A" />
                </Pressable>
              </View>
              {discrepancyCount < batch.omprengCount && (
                <Text className="font-sans text-[11px] font-bold text-[#B91C1C] mt-2">
                  Selisih: -{batch.omprengCount - discrepancyCount} boks kurang/rusak
                </Text>
              )}
            </View>

            <View className="gap-1">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                CATATAN KERUSAKAN / KEKURANGAN
              </Text>
              <TextInput
                value={discrepancyNote}
                onChangeText={setDiscrepancyNote}
                placeholder="Contoh: 2 boks penyok &amp; tertumpah di mobil"
                placeholderTextColor="#94A3B8"
                className="font-sans text-[12px] text-[#0F172A] border border-[#D8E2EC] rounded-[8px] p-2.5 bg-[#F8FAFC]"
              />
            </View>

            <CivicButton
              variant="primary"
              loading={isSubmittingDiscrepancy}
              onPress={handleConfirmDiscrepancy}
              className="mt-1"
            >
              Simpan &amp; Konfirmasi Penerimaan
            </CivicButton>
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  clockTagMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#0B2E59',
  },
  confirmedTimeMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#14532D',
  },
  photoLiveTag: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    color: '#FFFFFF',
  },
  boxMetaMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#475569',
  },
  omprengBatchMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#0B2E59',
  },
  timeAuditMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    color: '#0F172A',
  },
  weakestTag: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  dishHoldingMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#475569',
  },
  tempMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#0F172A',
  },
});
