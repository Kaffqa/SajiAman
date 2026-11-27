import React, { useCallback, useRef, useState } from 'react';
import {
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
import { useFocusEffect, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import {
  AlertTriangle,
  Flashlight,
  Keyboard,
  QrCode,
  ScanLine,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticsAdapter } from '../../../src/adapters/hapticsAdapter';
import {
  normalizeScannedBatchCode,
  parseAndVerifyBatchQrPayload,
} from '../../../src/adapters/qrAdapter';
import { CameraPermissionGuard } from '../../../src/components/ui/CameraPermissionGuard';
import { CivicButton } from '../../../src/components/ui/CivicButton';
import { ScanLaserOverlay } from '../../../src/components/ui/ScanLaserOverlay';
import { useSajiAman } from '../../../src/context/SajiAmanContext';

const MANUAL_REASONS = [
  'Stiker Basah / Sobek',
  'Kamera Bermasalah',
  'QR Pudar / Tidak Terbaca',
] as const;

export default function SchoolQrScannerScreen() {
  const router = useRouter();
  const { userProfile, verifyAndFetchBatchByCode, showToast } = useSajiAman();

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraFocused, setIsCameraFocused] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isScanArmed, setIsScanArmed] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [scanErrorBanner, setScanErrorBanner] = useState<string | null>(null);

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualReason, setManualReason] = useState('');

  const scanLockRef = useRef(false);
  const scanArmedRef = useRef(false);
  const navigatingRef = useRef(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      setIsCameraFocused(true);
      navigatingRef.current = false;
      scanLockRef.current = false;
      scanArmedRef.current = false;
      setIsLocked(false);
      setIsScanArmed(false);
      setScanErrorBanner(null);
      return () => {
        setIsCameraFocused(false);
        scanArmedRef.current = false;
        setIsScanArmed(false);
        setTorchEnabled(false);
        if (navTimerRef.current) {
          clearTimeout(navTimerRef.current);
          navTimerRef.current = null;
        }
      };
    }, [])
  );

  const navigateToSafetyResult = (batchId: string) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    scanLockRef.current = true;
    scanArmedRef.current = false;
    setIsLocked(true);
    setIsScanArmed(false);
    setScanErrorBanner(null);
    hapticsAdapter.success();

    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current);
    }
    navTimerRef.current = setTimeout(() => {
      navTimerRef.current = null;
      router.push({
        pathname: '/(school)/scan/[id]',
        params: { id: batchId },
      });
    }, 180);
  };

  const rejectScanAtCamera = (message: string) => {
    scanArmedRef.current = false;
    setIsScanArmed(false);
    scanLockRef.current = false;
    setIsLocked(false);
    hapticsAdapter.warning();
    setScanErrorBanner(message);
    showToast(message, 'warning');
  };

  const handleToggleScanArmed = () => {
    if (isVerifyingCode || navigatingRef.current) return;
    if (scanArmedRef.current) {
      scanArmedRef.current = false;
      setIsScanArmed(false);
      hapticsAdapter.selection();
    } else {
      scanLockRef.current = false;
      setIsLocked(false);
      setScanErrorBanner(null);
      scanArmedRef.current = true;
      setIsScanArmed(true);
      hapticsAdapter.lightImpact();
    }
  };

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (
      !scanArmedRef.current ||
      scanLockRef.current ||
      navigatingRef.current ||
      isVerifyingCode ||
      !result.data
    ) {
      return;
    }

    scanArmedRef.current = false;
    scanLockRef.current = true;
    setIsScanArmed(false);
    setIsLocked(true);
    setScanErrorBanner(null);

    const verified = parseAndVerifyBatchQrPayload(result.data);
    if (!verified.isValid) {
      rejectScanAtCamera(
        verified.reason || 'QR bukan segel resmi SajiAman. Gunakan Input Manual jika stiker rusak.'
      );
      return;
    }

    if (
      userProfile?.schoolId &&
      verified.schoolId &&
      verified.schoolId !== userProfile.schoolId
    ) {
      rejectScanAtCamera('QR boks ini ditujukan untuk sekolah lain, bukan unit sekolah Anda.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const res = await verifyAndFetchBatchByCode(
        verified.batchCode,
        verified.qrToken,
        true,
        { verificationMethod: 'qr_scan' }
      );
      if (!res.ok || !res.batch) {
        rejectScanAtCamera(
          res.reason ||
            `Batch ${verified.batchCode} tidak ditemukan di server atau tidak ditujukan untuk sekolah ini.`
        );
        return;
      }
      navigateToSafetyResult(res.batch.id);
    } catch (err: any) {
      rejectScanAtCamera(err?.message || 'Gagal memverifikasi segel QR ke server.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleManualSubmit = async () => {
    const code = normalizeScannedBatchCode(manualCode);
    if (!code) {
      showToast('Masukkan kode batch SajiAman yang valid (contoh: MBG-XXXX-XXXX)', 'warning');
      return;
    }
    if (!manualReason) {
      showToast('Pilih alasan penggunaan Input Kode Manual terlebih dahulu', 'warning');
      return;
    }
    setIsVerifyingCode(true);
    try {
      const res = await verifyAndFetchBatchByCode(code, null, false, {
        verificationMethod: 'manual_code',
        manualReason,
      });
      if (!res.ok || !res.batch) {
        showToast(
          res.reason ||
            `Kode batch ${code} tidak ditemukan atau tidak ditujukan untuk sekolah ini`,
          'warning'
        );
        return;
      }
      setShowManualModal(false);
      setManualCode('');
      setManualReason('');
      navigateToSafetyResult(res.batch.id);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memeriksa kode batch ke server', 'warning');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#0B1220]">
      {/* Compact Top Scanner Header */}
      <View className="bg-[#0B2E59] px-4 py-3 flex-row items-center justify-between gap-2 border-b border-[#1E3A5F]">
        <View className="flex-1 min-w-0">
          <Text
            numberOfLines={1}
            className="font-sans text-[15px] font-bold text-white tracking-[-0.015em]"
          >
            Pindai Segel QR Boks
          </Text>
          <Text numberOfLines={1} className="font-sans text-[11px] font-medium text-[#93C5FD] mt-0.5">
            {userProfile?.schoolName || 'Sekolah Penerima MBG'}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5 shrink-0">
          {permission?.granted ? (
            <Pressable
              onPress={() => setTorchEnabled((prev) => !prev)}
              accessibilityLabel="Nyalakan senter kamera"
              className={`h-9 px-2.5 rounded-[9px] border flex-row items-center gap-1.5 ${
                torchEnabled
                  ? 'bg-[#FEF3C7] border-[#FCD34D]'
                  : 'bg-white/10 border-white/20'
              }`}
            >
              <Flashlight size={15} color={torchEnabled ? '#B45309' : '#FFFFFF'} strokeWidth={2} />
              <Text
                className={`font-sans text-[11px] font-bold ${
                  torchEnabled ? 'text-[#78350F]' : 'text-white'
                }`}
              >
                Senter
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setShowManualModal(true)}
            accessibilityLabel="Input kode manual"
            className="h-9 px-2.5 rounded-[9px] bg-white/10 border border-white/20 flex-row items-center gap-1.5 active:bg-white/20"
          >
            <Keyboard size={15} color="#93C5FD" strokeWidth={2} />
            <Text className="font-sans text-[11px] font-bold text-white">Manual</Text>
          </Pressable>
        </View>
      </View>

      {/* Dedicated Full-Height Unobstructed Camera Viewport */}
      <View className="flex-1 bg-[#0B1220] relative overflow-hidden">
        {isCameraFocused && permission?.granted ? (
          <CameraView
            enableTorch={torchEnabled}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={
              isScanArmed && !isLocked && !isVerifyingCode ? handleBarcodeScanned : undefined
            }
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {/* Subtle Dark Framing Overlay */}
        <View className="absolute inset-0 bg-black/25 pointer-events-none" />

        {/* Centered Unobstructed Reticle */}
        <View className="flex-1 items-center justify-center px-5">
          {!permission?.granted ? (
            <CameraPermissionGuard
              onRequestPermission={() => requestPermission()}
              canAskAgain={permission?.canAskAgain}
              compact
            />
          ) : (
            <View className="items-center gap-4 w-full">
              {/* Top Status Pill Above Reticle (Never blocks center QR) */}
              <View
                className={`px-3 py-1.5 rounded-full border flex-row items-center gap-1.5 ${
                  scanErrorBanner
                    ? 'bg-[#7F1D1D]/95 border-[#FCA5A5]'
                    : isLocked || isVerifyingCode
                      ? 'bg-[#15803D]/95 border-[#86EFAC]'
                      : isScanArmed
                        ? 'bg-[#0F4C81]/95 border-[#38BDF8]'
                        : 'bg-[#0B1220]/85 border-white/20'
                }`}
              >
                {scanErrorBanner ? (
                  <AlertTriangle size={13} color="#FCA5A5" strokeWidth={2.2} />
                ) : (
                  <QrCode size={13} color="#93C5FD" strokeWidth={2} />
                )}
                <Text style={styles.statusPillText}>
                  {scanErrorBanner
                    ? 'QR TIDAK VALID'
                    : isVerifyingCode
                      ? 'MEMVERIFIKASI...'
                      : isLocked
                        ? 'QR TERKUNCI'
                        : isScanArmed
                          ? 'MEMINDAI QR...'
                          : 'KAMERA SIAGA'}
                </Text>
              </View>

              {/* Clean Open QR Reticle Window */}
              <View className="w-[230px] h-[230px] items-center justify-center relative">
                <View style={[styles.reticleCorner, { top: 0, left: 0, borderTopWidth: 3.5, borderLeftWidth: 3.5 }]} />
                <View style={[styles.reticleCorner, { top: 0, right: 0, borderTopWidth: 3.5, borderRightWidth: 3.5 }]} />
                <View style={[styles.reticleCorner, { bottom: 0, left: 0, borderBottomWidth: 3.5, borderLeftWidth: 3.5 }]} />
                <View style={[styles.reticleCorner, { bottom: 0, right: 0, borderBottomWidth: 3.5, borderRightWidth: 3.5 }]} />

                <ScanLaserOverlay
                  active={isScanArmed && !isLocked && !isVerifyingCode && !scanErrorBanner}
                  height={224}
                />
              </View>

              {scanErrorBanner ? (
                <View className="w-full max-w-[320px] px-3 py-2 rounded-[10px] bg-[#7F1D1D]/95 border border-[#FCA5A5]">
                  <Text className="font-sans text-[11.5px] font-medium text-white text-center leading-[16px]">
                    {scanErrorBanner}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Clean Bottom Shutter Control Dock */}
        {permission?.granted ? (
          <View className="px-4 pt-3 pb-4 bg-[#0B1220]/90 border-t border-white/10 gap-2">
            <Text className="font-sans text-[11.5px] text-[#CBD5E1] text-center">
              {isScanArmed
                ? 'Tahan stiker QR boks di dalam bingkai sudut biru'
                : 'Arahkan kotak ke stiker QR fisik, lalu tekan tombol di bawah'}
            </Text>

            <Pressable
              onPress={handleToggleScanArmed}
              disabled={isVerifyingCode || isLocked}
              className={`min-h-[48px] px-4 py-2.5 rounded-[12px] border flex-row items-center justify-center gap-2 ${
                isScanArmed
                  ? 'bg-[#B91C1C] border-[#FCA5A5] active:bg-[#991B1B]'
                  : 'bg-[#0F4C81] border-[#38BDF8]/70 active:bg-[#0B2E59]'
              }`}
            >
              {isScanArmed ? (
                <X size={18} color="#FFFFFF" strokeWidth={2.4} />
              ) : (
                <ScanLine size={18} color="#FFFFFF" strokeWidth={2.2} />
              )}
              <Text className="font-sans text-[14px] font-bold text-white">
                {isVerifyingCode
                  ? 'Memverifikasi QR...'
                  : isScanArmed
                    ? 'Batalkan Pindai'
                    : scanErrorBanner
                      ? 'Pindai Ulang QR'
                      : 'Tekan untuk Pindai QR'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Manual Code Backup Modal */}
      <Modal
        visible={showManualModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-center items-center p-5 bg-black/60"
        >
          <View className="w-full max-w-[360px] max-h-[85%] rounded-[16px] bg-white p-5 border border-[#D8E2EC]">
            <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-[#EDF2F7]">
              <Text className="font-sans text-[15px] font-bold text-[#0F172A]">
                Input Kode Batch Manual
              </Text>
              <Pressable
                onPress={() => setShowManualModal(false)}
                className="h-8 w-8 items-center justify-center rounded-[8px] bg-[#F4F7FA]"
              >
                <X size={16} color="#475569" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 14 }}
            >
              <View className="gap-1.5">
                <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  KODE SEGEL DARI STIKER BOKS FISIK
                </Text>
                <Text className="font-sans text-[11px] text-[#64748B] leading-[15px]">
                  Cadangan resmi apabila stiker QR pada boks fisik basah, tergores, atau kamera mengalami kendala.
                </Text>
                <TextInput
                  value={manualCode}
                  onChangeText={setManualCode}
                  placeholder="Contoh: MBG-2511-A1B2C3"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  style={styles.manualInput}
                />
              </View>

              <View className="gap-1.5">
                <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  ALASAN INPUT MANUAL (WAJIB AUDIT)
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {MANUAL_REASONS.map((opt) => {
                    const selected = manualReason === opt;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => setManualReason(opt)}
                        className={`px-2.5 py-2 rounded-[8px] border ${
                          selected
                            ? 'bg-[#0F4C81] border-[#0F4C81]'
                            : 'bg-[#F8FAFC] border-[#CBD5E1]'
                        }`}
                      >
                        <Text
                          className={`font-sans text-[11px] font-semibold ${
                            selected ? 'text-white' : 'text-[#475569]'
                          }`}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <CivicButton
                variant="primary"
                size="md"
                loading={isVerifyingCode}
                disabled={isVerifyingCode || !manualReason}
                onPress={handleManualSubmit}
              >
                {isVerifyingCode ? 'Memeriksa ke Server...' : 'Cek Kelayakan Batch'}
              </CivicButton>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  reticleCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#38BDF8',
  },
  statusPillText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10.5,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  manualInput: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#94A3B8',
    paddingHorizontal: 14,
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 14,
    color: '#0F172A',
  },
});
