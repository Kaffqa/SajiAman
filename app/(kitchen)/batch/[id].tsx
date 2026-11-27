import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileText,
  Home,
  Lock,
  Printer,
  Share2,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildBatchQrPayload, QrCodeView } from '../../../src/adapters/qrAdapter';
import { CivicButton } from '../../../src/components/ui/CivicButton';
import { StepHeader } from '../../../src/components/ui/StepHeader';
import { useSajiAman } from '../../../src/context/SajiAmanContext';
import { formatHoursId, formatWibTime } from '../../../src/domain/weakestLinkEngine';
import { printManifest, shareManifestPdf } from '../../../src/utils/manifestGenerator';

export default function BatchQrTicketScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { batches, schools, kitchenProfile, voidBatch, refreshBatchSamplePhoto, showToast } = useSajiAman();

  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const batch = batches.find(
    (b) => b.id.toUpperCase() === String(id).toUpperCase()
  );

  useEffect(() => {
    if (batch?.id && (batch.samplePhotoStoragePath || batch.samplePhotoUrl)) {
      refreshBatchSamplePhoto(batch.id);
    }
  }, [batch?.id]);

  if (!batch) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA] items-center justify-center p-6">
        <Text className="font-sans text-[14px] font-semibold text-[#475569]">
          Data batch tidak ditemukan.
        </Text>
        <View className="mt-4 w-full max-w-[220px]">
          <CivicButton onPress={() => router.replace('/(kitchen)' as any)}>
            Kembali ke Dasbor
          </CivicButton>
        </View>
      </SafeAreaView>
    );
  }

  const school = schools.find((s) => s.id === batch.schoolId);
  const isVoided = batch.batchStatus === 'voided';
  const isRejectedSpoiled = batch.batchStatus === 'rejected_spoiled';
  const canVoid = batch.batchStatus === 'active' && batch.omprengStatus === 'dispatched';

  const handlePrint = async () => {
    setIsExporting(true);
    try {
      await printManifest(batch, kitchenProfile, school);
    } catch (err: any) {
      showToast('Gagal memproses cetak manifes: ' + err.message, 'warning');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSharePdf = async () => {
    setIsExporting(true);
    try {
      await shareManifestPdf(batch, kitchenProfile, school);
    } catch (err: any) {
      const msg = err?.message || 'Terjadi kendala saat membagikan PDF.';
      Alert.alert('Gagal Bagikan PDF', msg);
      showToast('Gagal membagikan manifes: ' + msg, 'warning');
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidReason.trim()) {
      showToast('Alasan pembatalan wajib diisi', 'warning');
      return;
    }
    setIsVoiding(true);
    try {
      const reason = voidReason.trim();
      const ok = await voidBatch(batch.id, reason);
      if (ok) {
        setShowVoidModal(false);
        setVoidReason('');
      }
    } catch (err: any) {
      showToast('Gagal membatalkan batch: ' + (err?.message || ''), 'warning');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-[#E2E8F0]">
      <StepHeader
        title={isVoided ? 'Batch Dibatalkan' : 'Segel Boks Berhasil'}
        eyebrow="VERIFIKASI KEAMANAN MBG"
        onBack={() => router.replace('/(kitchen)' as any)}
        rightSlot={
          isVoided ? (
            <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#FEE2E2] border border-[#FCA5A5]">
              <Ban size={12} color="#B91C1C" strokeWidth={2.2} />
              <Text style={[styles.lockedBadge, { color: '#B91C1C' }]}>VOID</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#DCFCE7] border border-[#86EFAC]">
              <Lock size={12} color="#14532D" strokeWidth={2.2} />
              <Text style={styles.lockedBadge}>TERKUNCI</Text>
            </View>
          )
        }
      />

      <ScrollView
        className="flex-1 bg-[#E2E8F0]"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isVoided && (
          <View className="mb-3.5 p-3.5 rounded-[12px] bg-[#FEF2F2] border border-[#F87171] gap-1">
            <View className="flex-row items-center gap-1.5">
              <Ban size={16} color="#B91C1C" strokeWidth={2.2} />
              <Text className="font-sans text-[12px] font-extrabold uppercase text-[#7F1D1D]">
                BATCH INI DIBATALKAN TERKONTROL (VOID)
              </Text>
            </View>
            <Text className="font-sans text-[12px] text-[#991B1B] leading-[17px]">
              Alasan: <Text className="font-bold">{batch.voidReason || 'Pembatalan sebelum diterima sekolah'}</Text>
            </Text>
          </View>
        )}

        {isRejectedSpoiled && (
          <View className="mb-3.5 p-3.5 rounded-[12px] bg-[#FEF2F2] border border-[#F87171] gap-1.5">
            <View className="flex-row items-center gap-1.5">
              <AlertTriangle size={16} color="#B91C1C" strokeWidth={2.2} />
              <Text className="font-sans text-[12px] font-extrabold uppercase text-[#7F1D1D]">
                BATCH DITOLAK SEKOLAH (TERINDIKASI BASI / RUSAK)
              </Text>
            </View>
            <Text className="font-sans text-[12px] text-[#991B1B] leading-[17px]">
              Temuan: <Text className="font-bold">{batch.rejectionReason || 'Kerusakan organoleptik saat penerimaan di sekolah'}</Text>
            </Text>
            {batch.rejectionPhotoPath ? (
              <Image
                source={{ uri: batch.rejectionPhotoPath }}
                className="w-full h-36 rounded-[8px] border border-[#FCA5A5] mt-1"
                resizeMode="cover"
              />
            ) : null}
          </View>
        )}

        {/* Physical Thermal Dispatch Ticket */}
        <View className="rounded-[12px] border border-[#94A3B8] bg-white overflow-hidden shadow-sm">
          {/* Deep Navy Header Strip */}
          <View className="bg-[#0B2E59] px-4 py-3 flex-row items-center justify-between gap-2">
            <Text numberOfLines={1} className="flex-1 min-w-0 font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]">
              LABEL SEGEL BOKS MBG
            </Text>
            <View className="bg-white/15 px-2 py-0.5 rounded-[5px] shrink-0">
              <Text style={styles.batchIdBadge}>{batch.id}</Text>
            </View>
          </View>

          {/* Target School & Ompreng Bar */}
          <View className="px-4 py-3.5 border-b border-[#D8E2EC] gap-2">
            <View>
              <Text className="font-sans text-[18px] font-extrabold text-[#0F172A] tracking-[-0.02em] leading-[22px]">
                {batch.schoolName}
              </Text>
              <Text className="font-sans text-[12px] text-[#475569] mt-0.5">
                Dari: {batch.kitchenName}{batch.creatorName ? ` • Koki: ${batch.creatorName}` : ''} • {batch.boxNumber}
              </Text>
            </View>

            <View className="self-start px-2.5 py-1 rounded-[6px] bg-[#0B2E59]">
              <Text style={styles.omprengBadge}>
                {batch.omprengCount} OMPRENG STAINLESS
              </Text>
            </View>
          </View>

          {/* Centered Monochrome SVG QR Code Zone */}
          <View className="px-4 py-5 items-center justify-center bg-white">
            <View className="p-3 rounded-[10px] border border-[#D8E2EC] bg-white relative">
              {/* Corner framing brackets */}
              <View style={[styles.qrCorner, { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 }]} />
              <View style={[styles.qrCorner, { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 }]} />
              <View style={[styles.qrCorner, { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
              <View style={[styles.qrCorner, { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 }]} />

              <QrCodeView
                value={buildBatchQrPayload({
                  batchCode: batch.id,
                  kitchenCode: batch.kitchenCode || kitchenProfile.code,
                  schoolId: batch.schoolId,
                  cookedAtMs: batch.cookedAt,
                  qrToken: batch.qrToken,
                })}
                size={180}
              />
            </View>

            <Text style={styles.batchHeroCode}>{batch.id}</Text>
            <Text className="font-sans text-[12px] text-[#475569] text-center max-w-[260px] mt-1">
              Pindai di sekolah sebelum dibagikan ke siswa
            </Text>
          </View>

          {/* Dashed Perforation Tear-Line with Semicircular Side Notches */}
          <View className="relative flex-row items-center bg-white overflow-hidden">
            <View style={styles.leftNotch} />
            <View style={styles.dashedLine} />
            <View style={styles.rightNotch} />
          </View>

          {/* 2x2 Anti-Tampering Audit Grid */}
          <View className="border-b border-[#D8E2EC] bg-white">
            <View className="flex-row border-b border-[#D8E2EC]">
              <View className="flex-1 p-3 border-r border-[#D8E2EC] gap-1">
                <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  WAKTU SELESAI MASAK
                </Text>
                <Text style={styles.auditValue}>
                  {formatWibTime(batch.cookedAt)}
                </Text>
              </View>

              <View className="flex-1 p-3 gap-1">
                <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  BATAS AMAN KONSUMSI
                </Text>
                <Text style={[styles.auditValue, { color: '#B91C1C' }]}>
                  {formatWibTime(batch.expiresAt)}
                </Text>
              </View>
            </View>

            <View className="flex-row">
              <View className="flex-1 p-3 border-r border-[#D8E2EC] gap-1">
                <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  ATURAN TERENTAN
                </Text>
                <Text className="font-sans text-[12px] font-bold text-[#0F172A]">
                  {formatHoursId(batch.holdingHours)} Jam ({batch.weakestLinkRiskLabel})
                </Text>
              </View>

              <View className="flex-1 p-3 gap-1">
                <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  MODE INPUT
                </Text>
                <View className="flex-row items-center gap-1">
                  <CheckCircle2 size={14} color="#15803D" strokeWidth={2.2} />
                  <Text className="font-sans text-[12px] font-bold text-[#15803D]">
                    {batch.inputMode === 'ai_camera' ? 'Foto AI Valid' : 'Manual Chef'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Menu Proof & Optional AI Sample Photo */}
          <View className="p-3.5 bg-[#F4F7FA] flex-row items-center gap-3">
            {batch.samplePhotoUrl ? (
              <Image
                source={{ uri: batch.samplePhotoUrl }}
                className="w-14 h-14 rounded-[8px] border border-[#CBD5E1]"
                resizeMode="cover"
              />
            ) : null}
            <View className="flex-1">
              <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                KOMPOSISI MENU TERSEGEL
              </Text>
              <Text
                numberOfLines={2}
                className="font-sans text-[12px] font-semibold text-[#0F172A] mt-0.5 leading-[16px]"
              >
                {batch.items.map((i) => i.name).join(' • ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Void Batch Action */}
        {canVoid && (
          <View className="mt-3.5">
            <Pressable
              onPress={() => setShowVoidModal(true)}
              className="py-3 px-4 rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] flex-row items-center justify-center gap-2 active:bg-[#FEE2E2]"
            >
              <Ban size={16} color="#B91C1C" strokeWidth={2} />
              <Text className="font-sans text-[12px] font-bold text-[#B91C1C]">
                Batalkan Batch Ini (Salah Input / Void)
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Clean Single-Row Action Footer */}
      <View className="bg-white border-t border-[#D8E2EC] px-4 py-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <CivicButton
              variant="primary"
              size="md"
              loading={isExporting}
              icon={<Printer size={16} color="#FFFFFF" strokeWidth={2} />}
              onPress={handlePrint}
            >
              Cetak
            </CivicButton>
          </View>
          <View className="flex-1">
            <CivicButton
              variant="secondary"
              size="md"
              loading={isExporting}
              icon={<Share2 size={16} color="#0F4C81" strokeWidth={2} />}
              onPress={handleSharePdf}
            >
              Bagikan PDF
            </CivicButton>
          </View>
          <Pressable
            onPress={() => router.replace('/(kitchen)' as any)}
            accessibilityLabel="Kembali ke Dasbor"
            className="h-11 w-11 rounded-[10px] border border-[#BDD5EB] bg-[#EBF3FA] items-center justify-center shrink-0 active:opacity-80"
          >
            <Home size={18} color="#0F4C81" strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Void Modal */}
      <Modal
        visible={showVoidModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVoidModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
        <Pressable
          className="flex-1 bg-black/60 items-center justify-center p-5"
          onPress={() => setShowVoidModal(false)}
        >
          <Pressable
            className="bg-white rounded-[16px] p-5 w-full max-w-[340px] max-h-[80%] border border-[#FCA5A5]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between border-b border-[#EDF2F7] pb-2.5 mb-3">
              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                <Ban size={18} color="#B91C1C" strokeWidth={2.2} className="shrink-0" />
                <Text className="font-sans text-[15px] font-bold text-[#0F172A] flex-1 min-w-0">
                  Batalkan Batch Produksi
                </Text>
              </View>
              <Pressable onPress={() => setShowVoidModal(false)} className="p-1 shrink-0">
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <Text className="font-sans text-[12px] text-[#475569] leading-[18px]">
              Tindakan ini menandai batch sebagai dibatalkan sehingga tidak dapat discan di sekolah (audit trail tetap terjaga).
            </Text>

            <View className="gap-1">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                ALASAN PEMBATALAN (WAJIB)
              </Text>
              <TextInput
                value={voidReason}
                onChangeText={setVoidReason}
                placeholder="Contoh: Salah pilih sekolah tujuan / salah jumlah porsi"
                placeholderTextColor="#94A3B8"
                className="font-sans text-[12px] text-[#0F172A] border border-[#D8E2EC] rounded-[8px] p-2.5 bg-[#F8FAFC]"
              />
            </View>

            <CivicButton
              variant="danger"
              loading={isVoiding}
              onPress={handleConfirmVoid}
              className="mt-1"
            >
              Konfirmasi Batalkan Batch
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
  lockedBadge: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: '#14532D',
  },
  batchIdBadge: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: '#FFFFFF',
  },
  omprengBadge: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  qrCorner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: '#0B2E59',
  },
  batchHeroCode: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 16,
    color: '#0F172A',
    letterSpacing: 1.5,
    marginTop: 12,
  },
  leftNotch: {
    marginLeft: -10,
    height: 20,
    width: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    borderRightWidth: 1,
    borderColor: '#94A3B8',
  },
  rightNotch: {
    marginRight: -10,
    height: 20,
    width: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    borderLeftWidth: 1,
    borderColor: '#94A3B8',
  },
  dashedLine: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  auditValue: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 14,
    color: '#0F172A',
  },
});
