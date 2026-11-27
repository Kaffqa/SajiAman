import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  AlertTriangle,
  Apple,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coffee,
  Droplets,
  Flame,
  Leaf,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Utensils,
  WifiOff,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import {
  TRAY_PHOTOS,
  type LiveCaptureResult,
} from '../../src/adapters/cameraAdapter';
import { hapticsAdapter } from '../../src/adapters/hapticsAdapter';
import { CivicButton } from '../../src/components/ui/CivicButton';
import { CameraPermissionGuard } from '../../src/components/ui/CameraPermissionGuard';
import { HairlineCard } from '../../src/components/ui/HairlineCard';
import { StepHeader } from '../../src/components/ui/StepHeader';
import { TactileChip } from '../../src/components/ui/TactileChip';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { supabaseRepository } from '../../src/data/supabaseRepository';
import { hasConflictingCookingVariant } from '../../src/domain/aiResponseParser';
import { MENU_CATEGORIES, MENU_RISK_TIERS } from '../../src/domain/menuTiers';
import {
  calculateOmprengTelemetry,
  calculateWeakestLink,
  formatHoursId,
  formatWibTime,
} from '../../src/domain/weakestLinkEngine';
import {
  verifyMealSampleWithGemini,
  type MealAiVerificationResult,
} from '../../src/services/aiMealAnalyzer';
import type { MenuCategory, MenuItem, ProductionInputMode } from '../../src/types/sajiaman';

export default function CreateBatchScreen() {
  const router = useRouter();
  const {
    batches,
    simulatedNowMs,
    userProfile,
    kitchenProfile,
    schools,
    menuCatalog,
    dataSource,
    refreshMenuCatalog,
    createBatch,
    showToast,
  } = useSajiAman();
  const { isOnline } = useNetworkStatus();

  const activeCatalog = useMemo(
    () => menuCatalog.filter((item) => item.isActive !== false),
    [menuCatalog]
  );

  const omprengTelemetry = useMemo(
    () => calculateOmprengTelemetry(kitchenProfile.totalOmprengInventory, batches),
    [kitchenProfile.totalOmprengInventory, batches]
  );

  const [mode, setMode] = useState<ProductionInputMode>('manual');
  const [selectedIds, setSelectedIds] = useState<string[]>([
    'nasi-putih',
    'ayam-goreng',
    'tumis-buncis',
    'pisang-ambon',
  ]);
  const [schoolId, setSchoolId] = useState<string>(schools[0]?.id || '');
  const [omprengCount, setOmprengCount] = useState<number>(schools[0]?.defaultPortions || 100);
  const [omprengInputText, setOmprengInputText] = useState<string>(
    String(schools[0]?.defaultPortions || 100)
  );
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);

  // Quick-add custom dish states
  const [showQuickMenuModal, setShowQuickMenuModal] = useState(false);
  const [quickMenuName, setQuickMenuName] = useState('');
  const [quickMenuCategory, setQuickMenuCategory] = useState<MenuCategory>('sayur');
  const [quickMenuRiskTier, setQuickMenuRiskTier] = useState('santan_kuah_tinggi');
  const [isSavingQuickMenu, setIsSavingQuickMenu] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<MenuCategory, boolean>>({
    karbohidrat: false,
    protein: false,
    sayur: false,
    buah: false,
    susu_minuman: false,
    sambal_pelengkap: false,
  });
  const [adHocItems, setAdHocItems] = useState<MenuItem[]>([]);
  const [selectedAdHocIds, setSelectedAdHocIds] = useState<string[]>([]);

  const toggleCategorySection = (cat: MenuCategory) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Sync default school selection once DB schools arrive
  useEffect(() => {
    if (schools.length > 0 && !schools.some((s) => s.id === schoolId)) {
      const firstPortions = schools[0].defaultPortions || 100;
      setSchoolId(schools[0].id);
      setOmprengCount(firstPortions);
      setOmprengInputText(String(firstPortions));
    }
  }, [schools, schoolId]);

  const setCountSynced = (nextCount: number) => {
    const safe = Math.max(1, Math.min(9999, Math.round(nextCount)));
    setOmprengCount(safe);
    setOmprengInputText(String(safe));
  };

  // Camera hardware states
  const [permission, requestPermission] = useCameraPermissions();
  const [useHardwareCamera, setUseHardwareCamera] = useState<boolean>(Platform.OS !== 'web');
  const [isScanning, setIsScanning] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [captureResult, setCaptureResult] = useState<LiveCaptureResult | null>(null);
  const [aiResult, setAiResult] = useState<MealAiVerificationResult | null>(null);
  const [manualPhotoFallbackUri, setManualPhotoFallbackUri] = useState<string | null>(null);
  const [previewVariant, setPreviewVariant] = useState<'lodeh' | 'soto'>('lodeh');
  const cameraRef = useRef<CameraView | null>(null);

  const selectedItems = useMemo(
    () => [
      ...activeCatalog.filter((item) => selectedIds.includes(item.id)),
      ...adHocItems.filter((item) => selectedAdHocIds.includes(item.id)),
    ],
    [activeCatalog, selectedIds, adHocItems, selectedAdHocIds]
  );

  const weakestLink = useMemo(
    () => calculateWeakestLink(selectedItems),
    [selectedItems]
  );

  const currentSchool = useMemo(
    () => schools.find((s) => s.id === schoolId) ?? schools[0],
    [schools, schoolId]
  );

  const toggleMenuItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAdHocItem = (id: string) => {
    setSelectedAdHocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectSchool = (nextSchoolId: string) => {
    setSchoolId(nextSchoolId);
    const found = schools.find((s) => s.id === nextSchoolId);
    if (found) {
      setCountSynced(found.defaultPortions || 100);
    }
    setShowSchoolPicker(false);
  };

  const handleSaveQuickMenu = async () => {
    const trimmedName = quickMenuName.trim();
    if (!trimmedName) {
      showToast('Nama komposisi masakan wajib diisi', 'warning');
      return;
    }
    if (dataSource !== 'supabase') {
      const tier = MENU_RISK_TIERS.find((t) => t.id === quickMenuRiskTier) ?? MENU_RISK_TIERS[0];
      const slug = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'custom';
      const localItem: MenuItem = {
        id: `adhoc-${slug}-${Date.now().toString(36)}`,
        name: trimmedName,
        category: quickMenuCategory,
        holdingHours: tier.hours,
        riskLabel: tier.label,
        isHighRisk: tier.hours <= 4,
      };
      setAdHocItems((prev) => [...prev, localItem]);
      setSelectedAdHocIds((prev) => [...prev, localItem.id]);
      showToast(`Komposisi "${trimmedName}" ditambahkan & dipilih`, 'success');
      setShowQuickMenuModal(false);
      setQuickMenuName('');
      return;
    }
    setIsSavingQuickMenu(true);
    try {
      const res = await supabaseRepository.upsertMenuItem(
        '',
        trimmedName,
        quickMenuCategory,
        quickMenuRiskTier,
        true
      );
      await refreshMenuCatalog();
      if (res.item?.id) {
        setSelectedIds((prev) => (prev.includes(res.item!.id) ? prev : [...prev, res.item!.id]));
      }
      showToast(`Komposisi "${trimmedName}" ditambahkan & dipilih`, 'success');
      setShowQuickMenuModal(false);
      setQuickMenuName('');
    } catch (err: any) {
      showToast('Gagal menambah komposisi: ' + err.message, 'warning');
    } finally {
      setIsSavingQuickMenu(false);
    }
  };

  const handleCaptureLive = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setManualPhotoFallbackUri(null);
    setAdHocItems([]);
    setSelectedAdHocIds([]);
    hapticsAdapter.lightImpact();

    try {
      let photoUri: string | null = null;
      if (useHardwareCamera && cameraRef.current && permission?.granted) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.85,
            skipProcessing: false,
            shutterSound: false,
          });
          if (photo?.uri) {
            photoUri = photo.uri;
          }
        } catch (camErr) {
          console.warn('[Camera] Take picture error, using tray specimen:', camErr);
        }
      }

      const initialSourceUri =
        photoUri || (previewVariant === 'lodeh' ? TRAY_PHOTOS.lodehSet : TRAY_PHOTOS.sotoSet);

      // Perform Dual-AI Vision verification (Gemini Hydrogen/3.8 -> Groq Qwen3.8 fallback) & image compression
      const aiVerification = await verifyMealSampleWithGemini(
        initialSourceUri,
        previewVariant,
        { activeCatalog }
      );
      setAiResult(aiVerification);

      if (aiVerification.source === 'ai_unavailable') {
        setCaptureResult(null);
        hapticsAdapter.warning();
        showToast(
          aiVerification.errorMessage || 'Layanan Gemini & Groq AI tidak terjangkau saat ini',
          'warning'
        );
        return;
      }

      if (!aiVerification.is_valid_food_tray) {
        setCaptureResult(null);
        hapticsAdapter.warning();
        showToast(
          aiVerification.rejection_reason_id || 'Foto bukan nampan bersekat MBG yang valid',
          'warning'
        );
        return;
      }

      const wibStamp = formatWibTime(simulatedNowMs, false);
      const isGroq = aiVerification.providerUsed === 'groq';
      const providerBadge = isGroq ? 'GROQ AI' : 'GEMINI AI';
      const unitCode = userProfile?.kitchenCode || kitchenProfile.code || 'SPPG';
      const watermark = `${unitCode} • ${wibStamp} • ${providerBadge}`;

      const matchedCatalogSet = new Set<string>();
      const nextAdHoc: MenuItem[] = [];

      // Map all detected tray components (catalog + non-catalog ad-hoc items)
      const detectedList = Array.isArray(aiVerification.detected_items)
        ? aiVerification.detected_items
        : [];

      detectedList.forEach((d, idx) => {
        const rawDirectMatch = d.matched_catalog_id
          ? activeCatalog.find((m) => m.id === d.matched_catalog_id)
          : undefined;
        const directMatch =
          rawDirectMatch && !hasConflictingCookingVariant(d.name, rawDirectMatch.name)
            ? rawDirectMatch
            : undefined;
        const nameLower = d.name.trim().toLowerCase();
        const fallbackNameMatch =
          directMatch ??
          activeCatalog.find(
            (m) =>
              !hasConflictingCookingVariant(d.name, m.name) &&
              (m.name.trim().toLowerCase() === nameLower ||
                (nameLower.length >= 5 && m.name.trim().toLowerCase().includes(nameLower)))
          );

        if (fallbackNameMatch) {
          matchedCatalogSet.add(fallbackNameMatch.id);
        } else {
          const slug =
            nameLower
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || `item-${idx}`;
          const hrsText = formatHoursId(d.estimated_holding_hours);
          nextAdHoc.push({
            id: `adhoc-${slug}-${idx}`,
            name: d.name,
            category: d.category,
            holdingHours: d.estimated_holding_hours,
            riskLabel: d.is_high_risk
              ? `Risiko Tinggi (${hrsText} Jam)`
              : `Deteksi AI — Standar ${hrsText} Jam`,
            isHighRisk: d.is_high_risk,
          });
        }
      });

      if (detectedList.length === 0) {
        for (const id of aiVerification.matched_menu_item_ids) {
          if (activeCatalog.some((m) => m.id === id)) {
            matchedCatalogSet.add(id);
          }
        }
      }

      const validMatchedIds = Array.from(matchedCatalogSet);

      const finalResult: LiveCaptureResult = {
        photoUrl: aiVerification.compressedUri || initialSourceUri,
        capturedAtMs: simulatedNowMs,
        watermarkText: watermark,
        detectedItemIds: validMatchedIds,
        nutritionChecklist: {
          karbohidrat: aiVerification.nutrition_checks.karbohidrat.present,
          protein: aiVerification.nutrition_checks.protein.present,
          sayur: aiVerification.nutrition_checks.sayur.present,
          buah: aiVerification.nutrition_checks.buah.present,
        },
      };

      setCaptureResult(finalResult);
      setAdHocItems(nextAdHoc);
      setSelectedAdHocIds(nextAdHoc.map((item) => item.id));
      if (validMatchedIds.length > 0 || nextAdHoc.length > 0) {
        setSelectedIds(validMatchedIds);
      }

      const totalDetectedCount = Math.max(
        detectedList.length,
        validMatchedIds.length + nextAdHoc.length
      );
      hapticsAdapter.success();
      showToast(
        isGroq
          ? `Groq Vision AI (Cadangan): ${totalDetectedCount} komponen nampan terdeteksi`
          : `Gemini Vision AI: ${totalDetectedCount} komponen nampan terdeteksi`,
        'success'
      );
    } catch {
      showToast('Gagal memproses sampel kamera', 'warning');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSealBatch = async () => {
    if (!weakestLink || !currentSchool || isSealing) return;
    const rawTypedCount = parseInt(omprengInputText, 10);
    const effectiveOmprengCount = Math.min(
      9999,
      Math.max(1, Number.isNaN(rawTypedCount) ? omprengCount : rawTypedCount)
    );
    if (effectiveOmprengCount !== omprengCount) {
      setCountSynced(effectiveOmprengCount);
    }

    const activePhotoUri =
      mode === 'ai_camera' ? captureResult?.photoUrl : manualPhotoFallbackUri;
    if (mode === 'ai_camera' && !activePhotoUri) {
      showToast('Ambil foto sampel nampan terlebih dahulu', 'warning');
      return;
    }
    setIsSealing(true);

    try {
      let finalPhotoUrl = activePhotoUri || undefined;
      if (activePhotoUri && dataSource === 'supabase') {
        try {
          const ownerUnitId = userProfile?.kitchenId || kitchenProfile.id;
          finalPhotoUrl = await supabaseRepository.uploadSamplePhoto(
            activePhotoUri,
            ownerUnitId,
            'sample'
          );
        } catch (uploadErr: any) {
          showToast(
            uploadErr?.message || 'Gagal mengunggah foto sampel ke penyimpanan cloud',
            'warning'
          );
          setIsSealing(false);
          return;
        }
      }

      const aiDetectedWeakestMinutes =
        mode === 'ai_camera' && aiResult?.detected_items?.length
          ? Math.min(
              ...aiResult.detected_items.map((d) =>
                Math.max(60, Math.round((d.estimated_holding_hours || 4.5) * 60))
              )
            )
          : undefined;

      const created = await createBatch({
        schoolId: currentSchool.id,
        items: selectedItems,
        omprengCount: effectiveOmprengCount,
        inputMode: mode === 'ai_camera' && captureResult ? 'ai_camera' : 'manual',
        samplePhotoUrl: finalPhotoUrl,
        samplePhotoTimestamp: mode === 'ai_camera' ? captureResult?.watermarkText : undefined,
        aiDetectedWeakestMinutes,
        aiVerifiedNutrition: mode === 'ai_camera' ? captureResult?.nutritionChecklist : undefined,
      });

      if (created) {
        router.replace({
          pathname: '/(kitchen)/batch/[id]',
          params: { id: created.id },
        });
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyegel batch produksi', 'warning');
    } finally {
      setIsSealing(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        title="Catat Produksi Batch"
        eyebrow={userProfile?.kitchenName || kitchenProfile.name || 'UNIT DAPUR SPPG'}
        onBack={() => router.back()}
        rightSlot={
          <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#EBF3FA] border border-[#BDD5EB]">
            <Lock size={12} color="#0B2E59" strokeWidth={2} />
            <Text style={styles.headerClock}>
              {formatWibTime(simulatedNowMs)}
            </Text>
          </View>
        }
      />

      {/* Segmented Mode Switcher + 3-Step Flow Bar */}
      <View className="px-4 py-2.5 bg-white border-b border-[#D8E2EC] gap-2">
        <View className="flex-row items-center gap-1 p-1 rounded-[10px] bg-[#EDF2F7]">
          <Pressable
            onPress={() => {
              hapticsAdapter.selection();
              setMode('manual');
            }}
            className={`flex-1 min-h-[40px] items-center justify-center rounded-[8px] ${
              mode === 'manual'
                ? 'bg-white border border-[#D8E2EC]'
                : ''
            }`}
          >
            <Text
              className={`font-sans text-[12px] font-bold ${
                mode === 'manual' ? 'text-[#0B2E59]' : 'text-[#475569]'
              }`}
            >
              Mode Cepat Manual
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              hapticsAdapter.selection();
              setMode('ai_camera');
            }}
            className={`flex-1 min-h-[40px] items-center justify-center rounded-[8px] ${
              mode === 'ai_camera'
                ? 'bg-white border border-[#D8E2EC]'
                : ''
            }`}
          >
            <Text
              className={`font-sans text-[12px] font-bold ${
                mode === 'ai_camera' ? 'text-[#0B2E59]' : 'text-[#475569]'
              }`}
            >
              Mode Foto Sampel AI
            </Text>
          </Pressable>
        </View>

        {/* Visual 3-Step Progress Strip */}
        <View className="flex-row items-center justify-between px-1">
          {[
            { num: '1', label: 'Tujuan & Porsi', done: !!currentSchool },
            { num: '2', label: mode === 'ai_camera' ? 'Foto Sampel' : 'Pilih Menu', done: selectedItems.length > 0 },
            { num: '3', label: 'Segel QR', done: false },
          ].map((st, idx) => (
            <View key={st.num} className="flex-row items-center gap-1.5">
              <View
                className={`h-5 w-5 rounded-full items-center justify-center ${
                  st.done ? 'bg-[#15803D]' : 'bg-[#EBF3FA] border border-[#BDD5EB]'
                }`}
              >
                <Text
                  className={`font-mono text-[10px] font-bold ${
                    st.done ? 'text-white' : 'text-[#0F4C81]'
                  }`}
                >
                  {st.num}
                </Text>
              </View>
              <Text className="font-sans text-[11px] font-semibold text-[#475569]">
                {st.label}
              </Text>
              {idx < 2 ? <Text className="text-[#CBD5E1] mx-1">›</Text> : null}
            </View>
          ))}
        </View>
      </View>

      {/* Scrollable Body */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-[#F4F7FA]"
      >
      <ScrollView
        className="flex-1 bg-[#F4F7FA]"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Destination School & Ompreng Logistics FIRST (ergonomic order) */}
        <HairlineCard className="gap-3">
          <View className="gap-1.5">
            <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
              1. SEKOLAH TUJUAN
            </Text>

            <Pressable
              onPress={() => setShowSchoolPicker(true)}
              className="min-h-[46px] w-full rounded-[10px] border border-[#94A3B8] bg-white px-3.5 py-2 flex-row items-center justify-between gap-2"
            >
              <Text
                numberOfLines={1}
                className="flex-1 min-w-0 font-sans text-[13.5px] font-semibold text-[#0F172A]"
              >
                {currentSchool
                  ? `${currentSchool.name} (${currentSchool.picName})`
                  : 'Belum ada sekolah ditugaskan Admin BGN'}
              </Text>
              <ChevronDown size={18} color="#475569" className="shrink-0" />
            </Pressable>
            {schools.length === 0 ? (
              <Text className="font-sans text-[11px] text-[#B45309] leading-[15px]">
                Sekolah binaan &amp; NPSN didaftarkan oleh Admin BGN Pusat.
              </Text>
            ) : null}
          </View>

          <View className="pt-2.5 border-t border-[#EDF2F7] gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
                JUMLAH OMPRENG
              </Text>
              <Text className="font-sans text-[11px] font-semibold text-[#0F4C81]">
                Tersedia: {omprengTelemetry.inKitchen} unit
              </Text>
            </View>

            <View className="flex-row items-center justify-between gap-2.5">
              <Pressable
                onPress={() => {
                  hapticsAdapter.lightImpact();
                  setCountSynced(Math.max(1, omprengCount - 10));
                }}
                className="h-11 w-11 items-center justify-center rounded-[10px] border border-[#94A3B8] bg-white active:bg-[#EDF2F7] shrink-0"
              >
                <Minus size={18} color="#0F172A" strokeWidth={2.2} />
              </Pressable>

              <View className="flex-1 items-center justify-center py-1 rounded-[10px] bg-[#F4F7FA] border border-[#D8E2EC]">
                <TextInput
                  value={omprengInputText}
                  onChangeText={(txt) => {
                    const digits = txt.replace(/\D/g, '');
                    setOmprengInputText(digits);
                    const n = parseInt(digits, 10);
                    if (!Number.isNaN(n) && n > 0) {
                      setOmprengCount(Math.min(9999, n));
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseInt(omprengInputText, 10);
                    setCountSynced(
                      Number.isNaN(parsed) || parsed <= 0 ? 1 : Math.min(9999, parsed)
                    );
                  }}
                  keyboardType="numeric"
                  maxLength={4}
                  textAlign="center"
                  style={[styles.omprengHeroCount, { width: '100%', paddingVertical: 1 }]}
                />
              </View>

              <Pressable
                onPress={() => {
                  hapticsAdapter.lightImpact();
                  setCountSynced(Math.min(9999, omprengCount + 10));
                }}
                className="h-11 w-11 items-center justify-center rounded-[10px] border border-[#94A3B8] bg-white active:bg-[#EDF2F7] shrink-0"
              >
                <Plus size={18} color="#0F172A" strokeWidth={2.2} />
              </Pressable>
            </View>

            {currentSchool && omprengCount !== (currentSchool.defaultPortions || 100) ? (
              <Pressable
                onPress={() => {
                  hapticsAdapter.lightImpact();
                  setCountSynced(currentSchool.defaultPortions || 100);
                }}
                className="self-start px-2.5 py-1 rounded-[6px] bg-[#EBF3FA] border border-[#BDD5EB]"
              >
                <Text className="font-sans text-[11px] font-bold text-[#0F4C81]">
                  Reset ke porsi default ({currentSchool.defaultPortions || 100} unit)
                </Text>
              </Pressable>
            ) : null}

            {omprengCount > omprengTelemetry.inKitchen && (
              <Text className="font-sans text-[11px] text-[#B45309] leading-[15px]">
                Melebihi sisa steril dapur ({omprengTelemetry.inKitchen} unit).
              </Text>
            )}
          </View>
        </HairlineCard>

        {mode === 'manual' ? (
          /* Mode 1: Collapsible Category Tactile Matrix + Inline Custom Composition */
          <View className="gap-3.5">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1 min-w-0">
                <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  2. KOMPOSISI MENU BATCH
                </Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <View className="h-2 w-2 rounded-full bg-[#B45309]" />
                  <Text className="font-sans text-[11px] font-medium text-[#475569]">
                    Titik oranye = Cepat basi (3,5j)
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowQuickMenuModal(true)}
                className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-[#0F4C81] active:bg-[#0B2E59] shrink-0"
              >
                <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text className="font-sans text-[11px] font-bold text-white">
                  Komposisi Baru
                </Text>
              </Pressable>
            </View>

            {MENU_CATEGORIES.map(({ key, label }) => {
              const catItems = activeCatalog.filter((m) => m.category === key);
              const catAdHocItems = adHocItems.filter((m) => m.category === key);
              if (catItems.length === 0 && catAdHocItems.length === 0) return null;
              const selectedCountInCat =
                catItems.filter((m) => selectedIds.includes(m.id)).length +
                catAdHocItems.filter((m) => selectedAdHocIds.includes(m.id)).length;
              const isCollapsed = collapsedCategories[key];
              const CatIcon =
                key === 'karbohidrat'
                  ? Utensils
                  : key === 'protein'
                    ? Flame
                    : key === 'sayur'
                      ? Leaf
                      : key === 'buah'
                        ? Apple
                        : key === 'susu_minuman'
                          ? Coffee
                          : Droplets;
              const catTintBg =
                key === 'karbohidrat'
                  ? '#EBF3FA'
                  : key === 'protein'
                    ? '#FEF3C7'
                    : key === 'sayur'
                      ? '#DCFCE7'
                      : key === 'buah'
                        ? '#FCE7F3'
                        : key === 'susu_minuman'
                          ? '#E0F2FE'
                          : '#FFEDD5';
              const catTintColor =
                key === 'karbohidrat'
                  ? '#0F4C81'
                  : key === 'protein'
                    ? '#B45309'
                    : key === 'sayur'
                      ? '#15803D'
                      : key === 'buah'
                        ? '#BE185D'
                        : key === 'susu_minuman'
                          ? '#0369A1'
                          : '#C2410C';
              return (
                <View key={key} className="gap-2 bg-white rounded-[12px] border border-[#D8E2EC] p-3">
                  <Pressable
                    onPress={() => toggleCategorySection(key)}
                    className="flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-2">
                      <View
                        style={{ backgroundColor: catTintBg }}
                        className="h-7 w-7 rounded-[8px] items-center justify-center"
                      >
                        <CatIcon size={14} color={catTintColor} />
                      </View>
                      <Text className="font-sans text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#0F172A]">
                        {label}
                      </Text>
                      {selectedCountInCat > 0 ? (
                        <View className="px-1.5 py-0.5 rounded bg-[#EBF3FA] border border-[#BDD5EB]">
                          <Text className="font-mono text-[9.5px] font-bold text-[#0F4C81]">
                            {selectedCountInCat} dipilih
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {isCollapsed ? (
                      <ChevronDown size={15} color="#64748B" />
                    ) : (
                      <ChevronUp size={15} color="#64748B" />
                    )}
                  </Pressable>
                  {!isCollapsed ? (
                    <View className="flex-row flex-wrap gap-2">
                      {catAdHocItems.map((item) => (
                        <View key={item.id} style={{ width: '48%' }}>
                          <TactileChip
                            label={item.name}
                            badgeText={`${formatHoursId(item.holdingHours)}j`}
                            selected={selectedAdHocIds.includes(item.id)}
                            isHighRisk={item.isHighRisk}
                            onPress={() => toggleAdHocItem(item.id)}
                          />
                        </View>
                      ))}
                      {catItems.map((item) => (
                        <View key={item.id} style={{ width: '48%' }}>
                          <TactileChip
                            label={item.name}
                            badgeText={`${formatHoursId(item.holdingHours)}j`}
                            selected={selectedIds.includes(item.id)}
                            isHighRisk={item.isHighRisk}
                            onPress={() => toggleMenuItem(item.id)}
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          /* Mode 2: Live AI Sample Capture (Zero Gallery Upload) */
          <View className="gap-3">
            {/* Dark 4:3 Hardware Viewfinder */}
            <View className="w-full aspect-[4/3] rounded-[12px] overflow-hidden bg-[#0B1220] border border-[#0F4C81] relative justify-center items-center">
              {useHardwareCamera && !permission?.granted ? (
                <View className="p-4 items-center justify-center">
                  <CameraPermissionGuard
                    onRequestPermission={() => requestPermission()}
                    canAskAgain={permission?.canAskAgain}
                    compact
                  />
                </View>
              ) : useHardwareCamera && permission?.granted ? (
                <CameraView
                  ref={cameraRef}
                  facing="back"
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <Image
                  source={{
                    uri: captureResult
                      ? captureResult.photoUrl
                      : previewVariant === 'lodeh'
                        ? TRAY_PHOTOS.lodehSet
                        : TRAY_PHOTOS.sotoSet,
                  }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              )}

              {/* Scrim Overlay */}
              <View className="absolute inset-0 bg-black/30 pointer-events-none" />

              {/* Anti-Tampering Security Lock Badge & Mode Switch */}
              <View className="absolute top-2.5 left-2.5 right-2.5 flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-1 px-2 py-1 rounded-[6px] bg-[#0B1220]/90 border border-[#EF4444]/60 shrink min-w-0">
                  <Lock size={11} color="#FCA5A5" strokeWidth={2.2} />
                  <Text numberOfLines={1} style={styles.antiTamperText}>
                    KAMERA LANGSUNG
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    if (!permission?.granted) {
                      requestPermission();
                    } else {
                      setUseHardwareCamera((prev) => !prev);
                      if (useHardwareCamera) {
                        setPreviewVariant((v) => (v === 'lodeh' ? 'soto' : 'lodeh'));
                      }
                    }
                  }}
                  className="px-2 py-1 rounded-[6px] bg-[#0B1220]/90 border border-white/25 flex-row items-center gap-1 shrink-0 active:bg-black"
                >
                  <RefreshCw size={11} color="#FFFFFF" />
                  <Text className="font-sans text-[10px] font-semibold text-white">
                    {useHardwareCamera ? 'Uji Sampel' : 'Kamera HP'}
                  </Text>
                </Pressable>
              </View>

              {/* Optical Alignment Corner Brackets */}
              <View style={[styles.cornerBracket, { top: 40, left: 16, borderTopWidth: 2, borderLeftWidth: 2 }]} />
              <View style={[styles.cornerBracket, { top: 40, right: 16, borderTopWidth: 2, borderRightWidth: 2 }]} />
              <View style={[styles.cornerBracket, { bottom: 40, left: 16, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
              <View style={[styles.cornerBracket, { bottom: 40, right: 16, borderBottomWidth: 2, borderRightWidth: 2 }]} />

              {/* Scanning Active Overlay */}
              {isScanning ? (
                <View className="absolute inset-0 items-center justify-center bg-black/50">
                  <ActivityIndicator size="large" color="#38BDF8" />
                  <Text style={styles.scanningText}>
                    MEMINDAI SELURUH NAMPAN...
                  </Text>
                </View>
              ) : null}

              {/* Burned-in Watermark Timestamp */}
              <View className="absolute bottom-2.5 left-2.5 right-2.5 flex-row items-center">
                <View className="px-2 py-1 rounded-[5px] bg-black/85 max-w-full">
                  <Text numberOfLines={1} ellipsizeMode="tail" style={styles.watermarkText}>
                    {captureResult
                      ? captureResult.watermarkText
                      : `LIVE • ${formatWibTime(simulatedNowMs, false)}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Shutter Capture Button */}
            <CivicButton
              variant="primary"
              icon={<Camera size={20} color="#FFFFFF" strokeWidth={2} />}
              onPress={handleCaptureLive}
              disabled={isScanning}
            >
              {isScanning
                ? 'Memverifikasi Sampel AI...'
                : captureResult
                  ? 'Ambil Ulang Foto Sampel Langsung'
                  : 'Ambil Foto Sampel Langsung'}
            </CivicButton>

            {/* 4-Component Nutrition Verification Strip / Photo-Preserved Manual Fallback */}
            {manualPhotoFallbackUri ? (
              <HairlineCard className="gap-2.5 border-[#FCD34D] bg-[#FFFBEB]">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <AlertTriangle size={16} color="#B45309" strokeWidth={2.2} />
                    <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#92400E]">
                      FOTO KAMERA TERSIMPAN • PILIH MENU MANUAL
                    </Text>
                  </View>
                </View>
                <Text className="font-sans text-[11.5px] text-[#78350F] leading-[16px]">
                  Layanan AI sedang offline. Foto sampel dari kamera tetap dilampirkan sebagai bukti audit, silakan pilih komponen menu di bawah secara manual.
                </Text>
                <View className="gap-2 pt-2 border-t border-[#FDE68A]">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 min-w-0 font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                      PILIH KOMPONEN MENU BOKS
                    </Text>
                    <Pressable
                      onPress={() => setShowQuickMenuModal(true)}
                      className="flex-row items-center gap-1 px-2 py-1 rounded-[6px] bg-white border border-[#BDD5EB] shrink-0"
                    >
                      <Plus size={12} color="#0F4C81" strokeWidth={2.4} />
                      <Text className="font-sans text-[10px] font-bold text-[#0F4C81]">
                        Komposisi Baru
                      </Text>
                    </Pressable>
                  </View>
                  <View className="flex-row flex-wrap gap-1.5">
                    {adHocItems.map((item) => {
                      const isSel = selectedAdHocIds.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggleAdHocItem(item.id)}
                          className={`px-2.5 py-1.5 rounded-[7px] border ${
                            isSel
                              ? item.isHighRisk
                                ? 'bg-[#FEF3C7] border-[#D97706]'
                                : 'bg-[#0F4C81] border-[#0F4C81]'
                              : 'bg-white border-[#D8E2EC]'
                          }`}
                        >
                          <Text
                            className={`font-sans text-[11px] font-semibold ${
                              isSel
                                ? item.isHighRisk
                                  ? 'text-[#78350F]'
                                  : 'text-white'
                                : 'text-[#475569]'
                            }`}
                          >
                            {item.name} ({formatHoursId(item.holdingHours)}j)
                          </Text>
                        </Pressable>
                      );
                    })}
                    {activeCatalog.map((item) => {
                      const isSel = selectedIds.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggleMenuItem(item.id)}
                          className={`px-2.5 py-1.5 rounded-[7px] border ${
                            isSel
                              ? item.isHighRisk
                                ? 'bg-[#FEF3C7] border-[#D97706]'
                                : 'bg-[#0F4C81] border-[#0F4C81]'
                              : 'bg-white border-[#D8E2EC]'
                          }`}
                        >
                          <Text
                            className={`font-sans text-[11px] font-semibold ${
                              isSel
                                ? item.isHighRisk
                                  ? 'text-[#78350F]'
                                  : 'text-white'
                                : 'text-[#475569]'
                            }`}
                          >
                            {item.name} ({formatHoursId(item.holdingHours)}j)
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </HairlineCard>
            ) : aiResult?.source === 'ai_unavailable' ? (
              <View className="rounded-[10px] border border-[#FCD34D] bg-[#FEF3C7] p-3.5 gap-2.5">
                <View className="flex-row items-center gap-2">
                  <AlertTriangle size={18} color="#B45309" strokeWidth={2.2} />
                  <Text className="font-sans text-[12px] font-extrabold uppercase text-[#78350F]">
                    LAYANAN AI TIDAK TERJANGKAU
                  </Text>
                </View>
                <Text className="font-sans text-[12px] text-[#92400E] leading-[17px]">
                  {aiResult.errorMessage ||
                    'Koneksi ke Gemini AI dan Groq Vision terputus atau limit kuota tercapai.'}
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={handleCaptureLive}
                    disabled={isScanning}
                    className="flex-1 min-h-[38px] rounded-[8px] bg-[#0F4C81] items-center justify-center px-3 active:bg-[#0B2E59]"
                  >
                    <Text className="font-sans text-[11px] font-bold text-white">
                      Coba Analisis Ulang
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      hapticsAdapter.selection();
                      if (aiResult.compressedUri) {
                        setManualPhotoFallbackUri(aiResult.compressedUri);
                      } else {
                        setMode('manual');
                      }
                    }}
                    className="flex-1 min-h-[38px] rounded-[8px] bg-white border border-[#D97706] items-center justify-center px-3 active:bg-[#FEF9C3]"
                  >
                    <Text className="font-sans text-[11px] font-bold text-[#92400E] text-center">
                      Pakai Foto + Menu Manual
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : aiResult && !aiResult.is_valid_food_tray ? (
              <View className="rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 gap-2">
                <View className="flex-row items-center gap-2">
                  <AlertTriangle size={18} color="#B91C1C" strokeWidth={2.2} />
                  <Text className="font-sans text-[12px] font-extrabold uppercase text-[#7F1D1D]">
                    FOTO DITOLAK — BUKAN NAMPAN MBG
                  </Text>
                </View>
                <Text className="font-sans text-[12px] text-[#991B1B] leading-[17px]">
                  {aiResult.rejection_reason_id || 'Foto tidak terdeteksi sebagai boks/nampan bersekat MBG yang berisi makanan.'} Silakan ambil foto ulang dengan jelas.
                </Text>
              </View>
            ) : captureResult ? (
              <HairlineCard className="gap-2.5">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                    <CheckCircle2 size={16} color="#15803D" strokeWidth={2.2} className="shrink-0" />
                    <Text
                      numberOfLines={1}
                      className="flex-1 min-w-0 font-sans text-[11px] font-bold uppercase tracking-[0.04em] text-[#15803D]"
                    >
                      VERIFIKASI GIZI MBG
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1 shrink-0">
                    <Text style={styles.aiValidTag}>
                      {aiResult?.providerUsed === 'groq' || aiResult?.source === 'edge_groq' || aiResult?.source === 'groq_direct'
                        ? 'GROQ VISION AI'
                        : aiResult?.providerUsed === 'gemini' || aiResult?.source === 'edge_gemini' || aiResult?.source === 'edge_ai' || aiResult?.source === 'gemini_direct'
                          ? 'GEMINI VISION AI'
                          : 'AI VALID'}
                    </Text>
                    {aiResult?.confidence_score ? (
                      <View className="px-1.5 py-0.5 rounded-[4px] bg-[#E2E8F0]">
                        <Text className="font-mono text-[9px] font-bold text-[#334155]">
                          {Math.round(aiResult.confidence_score * 100)}%
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View className="flex-row flex-wrap gap-2">
                  {(
                    [
                      ['Karbohidrat', captureResult.nutritionChecklist.karbohidrat, aiResult?.nutrition_checks.karbohidrat.detected_label],
                      ['Protein', captureResult.nutritionChecklist.protein, aiResult?.nutrition_checks.protein.detected_label],
                      ['Sayur', captureResult.nutritionChecklist.sayur, aiResult?.nutrition_checks.sayur.detected_label],
                      ['Buah', captureResult.nutritionChecklist.buah, aiResult?.nutrition_checks.buah.detected_label],
                    ] as const
                  ).map(([name, ok, label]) => (
                    <View
                      key={name}
                      style={{ width: '48%' }}
                      className={`px-2.5 py-2 rounded-[8px] border flex-row items-center justify-between ${
                        ok
                          ? 'bg-[#DCFCE7] border-[#86EFAC]'
                          : 'bg-[#FEF3C7] border-[#FCD34D]'
                      }`}
                    >
                      <View className="flex-1 pr-1">
                        <Text
                          className={`font-sans text-[11px] font-bold ${
                            ok ? 'text-[#14532D]' : 'text-[#78350F]'
                          }`}
                        >
                          {name}
                        </Text>
                        {label ? (
                          <Text
                            numberOfLines={1}
                            className={`font-sans text-[10px] ${
                              ok ? 'text-[#166534]' : 'text-[#92400E]'
                            }`}
                          >
                            {label}
                          </Text>
                        ) : null}
                      </View>
                      <Text className={`font-bold ${ok ? 'text-[#14532D]' : 'text-[#B45309]'}`}>
                        {ok ? '✓' : '!'}
                      </Text>
                    </View>
                  ))}
                </View>

                {aiResult?.detected_items && aiResult.detected_items.length > 0 ? (
                  <View className="gap-1.5 pt-2 border-t border-[#EDF2F7]">
                    <Text className="font-sans text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                      SEMUA KOMPONEN NAMPAN TERDETEKSI ({aiResult.detected_items.length})
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {aiResult.detected_items.map((det, idx) => {
                        const catMeta = MENU_CATEGORIES.find((c) => c.key === det.category);
                        return (
                          <View
                            key={`${det.name}-${idx}`}
                            className={`px-2 py-1 rounded-[6px] border ${
                              det.is_high_risk
                                ? 'bg-[#FFFBEB] border-[#FCD34D]'
                                : 'bg-[#F0FDF4] border-[#BBF7D0]'
                            }`}
                          >
                            <Text
                              className={`font-sans text-[10.5px] font-semibold ${
                                det.is_high_risk ? 'text-[#92400E]' : 'text-[#166534]'
                              }`}
                            >
                              {det.name} • {catMeta?.shortLabel ?? det.category} • {formatHoursId(det.estimated_holding_hours)}j
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {aiResult?.risk_notes_id ? (
                  <View className="px-2.5 py-1.5 rounded-[6px] bg-[#F1F5F9] border border-[#E2E8F0]">
                    <Text className="font-sans text-[11px] text-[#475569] leading-[15px]">
                      Catatan Risiko: <Text className="font-semibold text-[#0F172A]">{aiResult.risk_notes_id}</Text>
                    </Text>
                  </View>
                ) : null}

                <View className="gap-2 mt-0.5 pt-2 border-t border-[#EDF2F7]">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 min-w-0 font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                      KOMPOSISI TERPILIH (TAP UNTUK UBAH)
                    </Text>
                    <Pressable
                      onPress={() => setShowQuickMenuModal(true)}
                      className="flex-row items-center gap-1 px-2 py-1 rounded-[6px] bg-[#EBF3FA] border border-[#BDD5EB] shrink-0"
                    >
                      <Plus size={12} color="#0F4C81" strokeWidth={2.4} />
                      <Text className="font-sans text-[10px] font-bold text-[#0F4C81]">
                        Komposisi Baru
                      </Text>
                    </Pressable>
                  </View>
                  <View className="flex-row flex-wrap gap-1.5">
                    {adHocItems.map((item) => {
                      const isSel = selectedAdHocIds.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggleAdHocItem(item.id)}
                          className={`px-2.5 py-1.5 rounded-[7px] border ${
                            isSel
                              ? item.isHighRisk
                                ? 'bg-[#FEF3C7] border-[#D97706]'
                                : 'bg-[#0F4C81] border-[#0F4C81]'
                              : 'bg-[#F8FAFC] border-[#D8E2EC]'
                          }`}
                        >
                          <Text
                            className={`font-sans text-[11px] font-semibold ${
                              isSel
                                ? item.isHighRisk
                                  ? 'text-[#78350F]'
                                  : 'text-white'
                                : 'text-[#475569]'
                            }`}
                          >
                            {item.name} ({formatHoursId(item.holdingHours)}j)
                          </Text>
                        </Pressable>
                      );
                    })}
                    {activeCatalog.map((item) => {
                      const isSel = selectedIds.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggleMenuItem(item.id)}
                          className={`px-2.5 py-1.5 rounded-[7px] border ${
                            isSel
                              ? item.isHighRisk
                                ? 'bg-[#FEF3C7] border-[#D97706]'
                                : 'bg-[#0F4C81] border-[#0F4C81]'
                              : 'bg-[#F8FAFC] border-[#D8E2EC]'
                          }`}
                        >
                          <Text
                            className={`font-sans text-[11px] font-semibold ${
                              isSel
                                ? item.isHighRisk
                                  ? 'text-[#78350F]'
                                  : 'text-white'
                                : 'text-[#475569]'
                            }`}
                          >
                            {item.name} ({formatHoursId(item.holdingHours)}j)
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </HairlineCard>
            ) : null}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Bottom Action Dock with Live Weakest-Link Rule Strip */}
      <View className="bg-white border-t border-[#D8E2EC] px-4 pt-3 pb-4 gap-2.5">
        {weakestLink ? (
          <View
            className={`rounded-[10px] border px-3 py-2 flex-row items-center justify-between gap-2 ${
              weakestLink.holdingHours <= 3.5
                ? 'bg-[#FEF3C7] border-[#FCD34D]'
                : 'bg-[#EBF3FA] border-[#BDD5EB]'
            }`}
          >
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5">
                {weakestLink.holdingHours <= 3.5 ? (
                  <AlertTriangle size={14} color="#B45309" strokeWidth={2.2} />
                ) : (
                  <ShieldCheck size={14} color="#0B2E59" strokeWidth={2.2} />
                )}
                <Text
                  style={[
                    styles.weakestLinkHero,
                    {
                      color:
                        weakestLink.holdingHours <= 3.5 ? '#78350F' : '#0B2E59',
                    },
                  ]}
                >
                  Batas Aman: {formatHoursId(weakestLink.holdingHours)} Jam
                </Text>
              </View>
              <Text
                numberOfLines={1}
                className="font-sans text-[11px] font-medium text-[#475569] mt-0.5"
              >
                {weakestLink.reasonText}
              </Text>
            </View>
            <View className="bg-white/80 px-2 py-0.5 rounded-[5px] shrink-0">
              <Text style={styles.itemsCountTag}>
                {selectedItems.length} item
              </Text>
            </View>
          </View>
        ) : (
          <View className="rounded-[10px] border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2">
            <Text className="font-sans text-[12px] font-semibold text-[#7F1D1D]">
              Pilih minimal 1 komponen menu untuk menghitung batas aman konsumsi.
            </Text>
          </View>
        )}

        {!currentSchool ? (
          <Text className="font-sans text-[11px] font-semibold text-[#B45309] text-center">
            Sekolah tujuan belum tersedia — pastikan sekolah sudah ditugaskan Admin BGN ke unit SPPG ini.
          </Text>
        ) : mode === 'ai_camera' && !captureResult && !manualPhotoFallbackUri ? (
          <Text className="font-sans text-[11px] font-semibold text-[#0F4C81] text-center">
            Ambil foto sampel baki langsung terlebih dahulu untuk mengaktifkan tombol segel boks.
          </Text>
        ) : null}

        {!isOnline && (
          <View className="mb-2.5 p-3 rounded-[10px] bg-[#FEF3C7] border border-[#FCD34D] flex-row items-center gap-2.5">
            <WifiOff size={18} color="#B45309" strokeWidth={2.2} />
            <Text className="font-sans text-[11px] text-[#92400E] flex-1 leading-[16px]">
              Koneksi offline. Penyegelan resmi batch MBG mewajibkan koneksi online untuk mengunci stempel waktu server anti-tampering.
            </Text>
          </View>
        )}

        <CivicButton
          variant="primary"
          icon={<ShieldCheck size={20} color="#FFFFFF" strokeWidth={2} />}
          disabled={
            !weakestLink ||
            !currentSchool ||
            isSealing ||
            !isOnline ||
            (mode === 'ai_camera' && !captureResult && !manualPhotoFallbackUri) ||
            (mode === 'ai_camera' && !manualPhotoFallbackUri && aiResult != null && !aiResult.is_valid_food_tray)
          }
          loading={isSealing}
          onPress={handleSealBatch}
        >
          {isSealing ? 'Mengunggah & Menyegel...' : 'Selesai Masak & Segel Boks'}
        </CivicButton>
      </View>

      {/* School Picker Modal */}
      <Modal
        visible={showSchoolPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSchoolPicker(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center p-5"
          onPress={() => setShowSchoolPicker(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-[16px] p-5 gap-3 border border-[#D8E2EC] max-h-[75%]"
          >
            <Text className="font-sans text-[15px] font-bold text-[#0F172A]">
              Pilih Sekolah Tujuan
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[380px]">
              <View className="gap-2">
                {schools.length === 0 ? (
                  <Text className="font-sans text-[13px] text-[#64748B] py-2 leading-[19px]">
                    Belum ada sekolah yang ditugaskan oleh Admin BGN ke unit SPPG ini. Hubungi Admin BGN Pusat untuk mendaftarkan sekolah binaan &amp; NPSN.
                  </Text>
                ) : (
                  schools.map((school) => {
                    const isSelected = school.id === schoolId;
                    return (
                      <Pressable
                        key={school.id}
                        onPress={() => handleSelectSchool(school.id)}
                        className={`min-h-[48px] px-3.5 py-3 rounded-[10px] border justify-center ${
                          isSelected
                            ? 'bg-[#EBF3FA] border-[#0F4C81]'
                            : 'bg-white border-[#D8E2EC]'
                        }`}
                      >
                        <Text
                          className={`font-sans text-[14px] font-bold ${
                            isSelected ? 'text-[#0B2E59]' : 'text-[#0F172A]'
                          }`}
                        >
                          {school.name}
                        </Text>
                        <Text className="font-sans text-[12px] text-[#475569] mt-0.5">
                          PIC: {school.picName} • Porsi Standar: {school.defaultPortions}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Quick-Add Custom Dish / Composition Modal */}
      <Modal
        visible={showQuickMenuModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuickMenuModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
        <Pressable
          className="flex-1 bg-black/60 items-center justify-center p-4"
          onPress={() => setShowQuickMenuModal(false)}
        >
          <Pressable
            className="bg-white rounded-[16px] p-5 w-full max-w-[360px] max-h-[85%] border border-[#D8E2EC]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between border-b border-[#EDF2F7] pb-2.5 mb-3">
              <View className="flex-1 min-w-0 pr-2">
                <Text className="font-sans text-[15px] font-bold text-[#0F172A]">
                  Tambah Komposisi Menu Baru
                </Text>
                <Text className="font-sans text-[11px] text-[#64748B]">
                  Menu kustom khusus SPPG ini
                </Text>
              </View>
              <Pressable onPress={() => setShowQuickMenuModal(false)} className="p-1 shrink-0">
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <View className="gap-1">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                NAMA MASAKAN / KOMPOSISI
              </Text>
              <TextInput
                value={quickMenuName}
                onChangeText={setQuickMenuName}
                placeholder="Contoh: Rendang Telur / Sayur Bening Bayam"
                placeholderTextColor="#94A3B8"
                className="font-sans text-[13px] text-[#0F172A] border border-[#D8E2EC] rounded-[8px] p-2.5 bg-[#F8FAFC]"
              />
            </View>

            <View className="gap-1.5">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                KATEGORI KOMPONEN
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {MENU_CATEGORIES.map(({ key, label }) => {
                  const sel = quickMenuCategory === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setQuickMenuCategory(key)}
                      style={{ width: '48.5%' }}
                      className={`py-2 px-2 rounded-[6px] border items-center ${
                        sel ? 'bg-[#0F4C81] border-[#0F4C81]' : 'bg-[#F8FAFC] border-[#D8E2EC]'
                      }`}
                    >
                      <Text
                        numberOfLines={1}
                        className={`font-sans text-[10.5px] font-bold ${
                          sel ? 'text-white' : 'text-[#475569]'
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                TINGKAT KETAHANAN &amp; BATAS AMAN
              </Text>
              {MENU_RISK_TIERS.map((tier) => {
                const sel = quickMenuRiskTier === tier.id;
                return (
                  <Pressable
                    key={tier.id}
                    onPress={() => setQuickMenuRiskTier(tier.id)}
                    className={`p-2.5 rounded-[8px] border flex-row items-center justify-between gap-2 ${
                      sel ? 'bg-[#EBF3FA] border-[#0F4C81]' : 'bg-[#F8FAFC] border-[#D8E2EC]'
                    }`}
                  >
                    <Text
                      className={`flex-1 min-w-0 font-sans text-[11.5px] ${
                        sel ? 'text-[#0B2E59] font-bold' : 'text-[#475569] font-semibold'
                      }`}
                    >
                      {tier.label}
                    </Text>
                    <Text className="font-mono text-[11px] font-bold shrink-0" style={{ color: tier.color }}>
                      {formatHoursId(tier.hours)} Jam
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <CivicButton
              variant="primary"
              loading={isSavingQuickMenu}
              onPress={handleSaveQuickMenu}
              className="mt-1"
            >
              Simpan &amp; Gunakan di Batch Ini
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
  headerClock: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#0B2E59',
  },
  cornerBracket: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#38BDF8',
  },
  antiTamperText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  scanningText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 10,
  },
  watermarkText: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 9.5,
    color: '#86EFAC',
  },
  aiValidTag: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: '#15803D',
  },
  omprengHeroCount: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 26,
    lineHeight: 30,
    color: '#0B2E59',
  },
  quickAddText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: '#0F4C81',
  },
  weakestLinkHero: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 13,
  },
  itemsCountTag: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: '#0B2E59',
  },
});
