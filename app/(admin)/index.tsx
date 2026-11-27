import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeftRight,
  Building2,
  ChefHat,
  ChevronRight,
  Edit3,
  FileDown,
  HelpCircle,
  Layers,
  Plus,
  Power,
  RefreshCw,
  School,
  Search,
  ShieldAlert,
  User,
  Users,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../src/components/ui/CivicButton';
import { ConfirmLogoutModal } from '../../src/components/ui/ConfirmLogoutModal';
import { HairlineCard } from '../../src/components/ui/HairlineCard';
import { PulseDot } from '../../src/components/ui/PulseDot';
import { RoleTutorialModal } from '../../src/components/ui/RoleTutorialModal';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { supabaseRepository } from '../../src/data/supabaseRepository';
import { evaluateBatchSafety, formatWibTime, getWibStartOfDayMs } from '../../src/domain/weakestLinkEngine';
import { exportPeriodicSummaryPdf } from '../../src/utils/manifestGenerator';
import type {
  AdminDashboardSnapshot,
  AdminKitchenSummary,
  AdminSchoolSummary,
  AdminUserSummary,
  BatchRecord,
} from '../../src/types/sajiaman';

type AdminTab = 'kitchens' | 'schools' | 'users' | 'batches';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const {
    batches,
    dataSource,
    userProfile,
    simulatedNowMs,
    logoutToRoleSelect,
    showToast,
  } = useSajiAman();

  const [activeTab, setActiveTab] = useState<AdminTab>('kitchens');
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [onlyOrphanUsers, setOnlyOrphanUsers] = useState(false);
  const [selectedAuditBatch, setSelectedAuditBatch] = useState<BatchRecord | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'today' | '7days' | 'all'>('today');
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pendingToggleConfirm, setPendingToggleConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isActivate: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Kitchen Modal state
  const [showKitchenModal, setShowKitchenModal] = useState(false);
  const [editingKitchen, setEditingKitchen] = useState<AdminKitchenSummary | null>(null);
  const [kitchenCode, setKitchenCode] = useState('');
  const [kitchenName, setKitchenName] = useState('');
  const [kitchenAddress, setKitchenAddress] = useState('');
  const [kitchenInventory, setKitchenInventory] = useState('600');
  const [isSavingKitchen, setIsSavingKitchen] = useState(false);

  // School Modal state
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<AdminSchoolSummary | null>(null);
  const [schoolKitchenId, setSchoolKitchenId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schoolNpsn, setSchoolNpsn] = useState('');
  const [schoolPic, setSchoolPic] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolPortions, setSchoolPortions] = useState('100');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [isSavingSchool, setIsSavingSchool] = useState(false);

  // User Profile Reassign Modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserSummary | null>(null);
  const [assignRole, setAssignRole] = useState<'kitchen' | 'school'>('kitchen');
  const [assignName, setAssignName] = useState('');
  const [assignPhone, setAssignPhone] = useState('');
  const [assignKitchenId, setAssignKitchenId] = useState('');
  const [assignSchoolId, setAssignSchoolId] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const loadSnapshot = useCallback(async () => {
    if (dataSource !== 'supabase') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setSnapshotError(null);
    try {
      const data = await supabaseRepository.fetchAdminDashboardSnapshot();
      setSnapshot(data);
    } catch (err: any) {
      const message = err?.message || 'Gagal memuat data pusat Admin BGN';
      setSnapshotError(message);
      showToast(message, 'warning');
    } finally {
      setIsLoading(false);
    }
  }, [dataSource, showToast]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSnapshot();
    setIsRefreshing(false);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logoutToRoleSelect();
    router.replace('/(auth)/login');
  };

  // --- Kitchen CRUD Handlers ---
  const openAddKitchen = () => {
    setEditingKitchen(null);
    setKitchenCode('SPPG-');
    setKitchenName('');
    setKitchenAddress('');
    setKitchenInventory('600');
    setShowKitchenModal(true);
  };

  const openEditKitchen = (k: AdminKitchenSummary) => {
    setEditingKitchen(k);
    setKitchenCode(k.code);
    setKitchenName(k.name);
    setKitchenAddress(k.address || '');
    setKitchenInventory(String(k.total_ompreng_inventory ?? 600));
    setShowKitchenModal(true);
  };

  const handleSaveKitchen = async () => {
    if (!kitchenCode.trim() || !kitchenName.trim()) {
      showToast('Kode SPPG dan Nama SPPG wajib diisi', 'warning');
      return;
    }
    const parsedInv = parseInt(kitchenInventory, 10);
    setIsSavingKitchen(true);
    try {
      await supabaseRepository.adminManageKitchen({
        kitchenId: editingKitchen?.id,
        code: kitchenCode.trim().toUpperCase(),
        name: kitchenName.trim(),
        address: kitchenAddress.trim() || undefined,
        inventory: Math.max(0, Number.isNaN(parsedInv) ? 600 : parsedInv),
      });
      showToast(
        editingKitchen ? 'Data unit SPPG diperbarui' : `Unit SPPG ${kitchenCode.trim().toUpperCase()} ditambahkan`,
        'success'
      );
      setShowKitchenModal(false);
      await loadSnapshot();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan unit SPPG', 'warning');
    } finally {
      setIsSavingKitchen(false);
    }
  };

  // --- School CRUD Handlers ---
  const openAddSchool = () => {
    const firstKitchen = snapshot?.kitchens[0]?.id || '';
    setEditingSchool(null);
    setSchoolKitchenId(firstKitchen);
    setSchoolName('');
    setSchoolNpsn('');
    setSchoolPic('');
    setSchoolPhone('');
    setSchoolPortions('100');
    setSchoolAddress('');
    setShowSchoolModal(true);
  };

  const openEditSchool = (s: AdminSchoolSummary) => {
    setEditingSchool(s);
    setSchoolKitchenId(s.assigned_kitchen_id);
    setSchoolName(s.name);
    setSchoolNpsn(s.npsn || '');
    setSchoolPic(s.pic_name || '');
    setSchoolPhone(s.phone_wa || '');
    setSchoolPortions(String(s.default_portions ?? 100));
    setSchoolAddress(s.address || '');
    setShowSchoolModal(true);
  };

  const handleSaveSchool = async () => {
    if (!schoolName.trim() || !schoolKitchenId) {
      showToast('Nama sekolah dan SPPG pembina wajib diisi', 'warning');
      return;
    }
    if (schoolNpsn.trim() && !/^\d{8}$/.test(schoolNpsn.trim())) {
      showToast('NPSN harus 8 digit angka', 'warning');
      return;
    }
    const parsedPortions = parseInt(schoolPortions, 10);
    setIsSavingSchool(true);
    try {
      await supabaseRepository.adminManageSchool({
        schoolId: editingSchool?.id,
        kitchenId: schoolKitchenId,
        name: schoolName.trim(),
        npsn: schoolNpsn.trim() || undefined,
        picName: schoolPic.trim() || undefined,
        phoneWa: schoolPhone.trim() || undefined,
        defaultPortions: Math.max(1, Number.isNaN(parsedPortions) ? 100 : parsedPortions),
        address: schoolAddress.trim() || undefined,
      });
      showToast(
        editingSchool ? `Data ${schoolName.trim()} diperbarui` : `Sekolah ${schoolName.trim()} didaftarkan`,
        'success'
      );
      setShowSchoolModal(false);
      await loadSnapshot();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan data sekolah', 'warning');
    } finally {
      setIsSavingSchool(false);
    }
  };

  // --- User Assignment / Orphan Recovery ---
  const openEditUser = (u: AdminUserSummary) => {
    setEditingUser(u);
    const nextRole = u.role === 'school' ? 'school' : 'kitchen';
    setAssignRole(nextRole);
    setAssignName(u.full_name || u.email.split('@')[0]);
    setAssignPhone(u.phone_wa || '');
    setAssignKitchenId(u.kitchen_id || snapshot?.kitchens[0]?.id || '');
    setAssignSchoolId(u.school_id || snapshot?.schools[0]?.id || '');
    setShowUserModal(true);
  };

  const handleSaveUserAssignment = async () => {
    if (!editingUser) return;
    if (assignRole === 'kitchen' && !assignKitchenId) {
      showToast('Pilih unit SPPG untuk akun dapur ini', 'warning');
      return;
    }
    if (assignRole === 'school' && !assignSchoolId) {
      showToast('Pilih sekolah binaan untuk akun koordinator ini', 'warning');
      return;
    }
    setIsSavingUser(true);
    try {
      await supabaseRepository.adminReassignUserProfile({
        userId: editingUser.id,
        role: assignRole,
        fullName: assignName.trim() || 'Petugas Resmi',
        phoneWa: assignPhone.trim() || undefined,
        kitchenId: assignRole === 'kitchen' ? assignKitchenId : null,
        schoolId: assignRole === 'school' ? assignSchoolId : null,
      });
      showToast(`Penugasan ${editingUser.email} berhasil disimpan`, 'success');
      setShowUserModal(false);
      await loadSnapshot();
    } catch (err: any) {
      showToast(err?.message || 'Gagal memperbarui penugasan akun', 'warning');
    } finally {
      setIsSavingUser(false);
    }
  };

  const metrics = snapshot?.metrics;

  const filteredReportBatches = useMemo(() => {
    return batches.filter((b) => {
      if (reportPeriod === 'today') {
        const startOfDayMs = getWibStartOfDayMs(simulatedNowMs);
        return b.cookedAt >= startOfDayMs;
      }
      if (reportPeriod === '7days') {
        return b.cookedAt >= simulatedNowMs - 7 * 24 * 60 * 60 * 1000;
      }
      return true;
    });
  }, [batches, reportPeriod, simulatedNowMs]);

  const confirmToggleKitchenActive = (k: AdminKitchenSummary) => {
    const nextActive = k.is_active === false;
    const actionLabel = nextActive ? 'Aktifkan Kembali' : 'Nonaktifkan';
    setPendingToggleConfirm({
      title: `${actionLabel} Unit SPPG`,
      message: nextActive
        ? `Aktifkan kembali ${k.name} (${k.code}) agar petugas dapat masuk dan menyegel batch?`
        : `Nonaktifkan ${k.name} (${k.code})? Riwayat batch tetap tersimpan untuk audit, tetapi unit dan petugasnya tidak dapat mencatat batch baru.`,
      confirmLabel: actionLabel,
      isActivate: nextActive,
      onConfirm: async () => {
        setTogglingId(k.id);
        try {
          await supabaseRepository.adminToggleKitchenActive(k.id, nextActive);
          showToast(
            nextActive ? `${k.name} diaktifkan kembali` : `${k.name} dinonaktifkan`,
            'success'
          );
          await loadSnapshot();
        } catch (err: any) {
          showToast(err?.message || 'Gagal mengubah status unit SPPG', 'warning');
        } finally {
          setTogglingId(null);
        }
      },
    });
  };

  const confirmToggleSchoolActive = (s: AdminSchoolSummary) => {
    const nextActive = s.is_active === false;
    const actionLabel = nextActive ? 'Aktifkan Kembali' : 'Nonaktifkan';
    setPendingToggleConfirm({
      title: `${actionLabel} Sekolah Binaan`,
      message: nextActive
        ? `Aktifkan kembali ${s.name}?`
        : `Nonaktifkan ${s.name}? Sekolah ini tidak akan muncul sebagai tujuan produksi baru, sementara riwayat audit tetap utuh.`,
      confirmLabel: actionLabel,
      isActivate: nextActive,
      onConfirm: async () => {
        setTogglingId(s.id);
        try {
          await supabaseRepository.adminToggleSchoolActive(s.id, nextActive);
          showToast(
            nextActive ? `${s.name} diaktifkan kembali` : `${s.name} dinonaktifkan`,
            'success'
          );
          await loadSnapshot();
        } catch (err: any) {
          showToast(err?.message || 'Gagal mengubah status sekolah', 'warning');
        } finally {
          setTogglingId(null);
        }
      },
    });
  };

  const confirmToggleUserActive = (u: AdminUserSummary) => {
    const nextActive = u.is_active === false;
    const actionLabel = nextActive ? 'Aktifkan Akun' : 'Nonaktifkan Akun';
    setPendingToggleConfirm({
      title: actionLabel,
      message: nextActive
        ? `Aktifkan kembali akses login untuk ${u.full_name || u.email}?`
        : `Nonaktifkan akun ${u.full_name || u.email}? Petugas ini tidak akan bisa login atau mencatat batch baru.`,
      confirmLabel: actionLabel,
      isActivate: nextActive,
      onConfirm: async () => {
        setTogglingId(u.id);
        try {
          await supabaseRepository.adminToggleUserActive(u.id, nextActive);
          showToast(
            nextActive ? `Akun ${u.email} diaktifkan` : `Akun ${u.email} dinonaktifkan`,
            'success'
          );
          await loadSnapshot();
        } catch (err: any) {
          showToast(err?.message || 'Gagal mengubah status akun', 'warning');
        } finally {
          setTogglingId(null);
        }
      },
    });
  };

  const handleExportAdminPdf = async () => {
    if (isExportingReport) return;
    setIsExportingReport(true);
    try {
      const periodLabel =
        reportPeriod === 'today'
          ? 'HARI INI'
          : reportPeriod === '7days'
            ? '7 HARI TERAKHIR'
            : 'SEMUA WAKTU';
      await exportPeriodicSummaryPdf({
        batches: filteredReportBatches,
        periodLabel,
        scopeTitle: 'PENGAWASAN NASIONAL LINTAS SPPG',
        generatedBy: userProfile?.fullName || 'Administrator BGN Pusat',
        simulatedNowMs,
        totalMaggotKg: metrics?.total_maggot_kg ?? 0,
      });
    } catch (err: any) {
      const msg = err?.message || 'Terjadi kendala saat membuat berkas PDF.';
      showToast('Gagal mengekspor laporan PDF: ' + msg, 'warning');
    } finally {
      setIsExportingReport(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      {/* Curved BGN Admin Navy Hero Header (spacious bottom padding for 2x2 overlapping grid) */}
      <View className="bg-[#0B2E59] px-4 pt-3.5 pb-10 rounded-b-[26px] flex-row items-center justify-between gap-2">
        <View className="flex-1 min-w-0 pr-1">
          <Text
            numberOfLines={1}
            className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#93C5FD]"
          >
            BADAN GIZI NASIONAL • PUSAT
          </Text>
          <Text
            numberOfLines={1}
            className="font-sans text-[17px] font-extrabold text-white mt-0.5"
          >
            Admin BGN SajiAman
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5 shrink-0">
          <Pressable
            onPress={() => setShowTutorial(true)}
            accessibilityLabel="Panduan Admin BGN"
            className="h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 border border-white/15 active:bg-white/20"
          >
            <HelpCircle size={15} color="#93C5FD" />
          </Pressable>
          <Pressable
            onPress={loadSnapshot}
            accessibilityLabel="Segarkan data pusat"
            className="h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 border border-white/15 active:bg-white/20"
          >
            <RefreshCw size={15} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(admin)/profile' as any)}
            accessibilityLabel="Profil Admin BGN"
            className="h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 border border-white/15 active:bg-white/20"
          >
            <User size={15} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => setShowLogoutConfirm(true)}
            accessibilityLabel="Keluar dari akun"
            className="h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 border border-white/15 active:bg-white/20"
          >
            <ArrowLeftRight size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ConfirmLogoutModal
        visible={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* Overlapping Balanced 2x2 KPI Bento Grid */}
      <View className="px-4 -mt-6 gap-2.5 z-10 mb-2.5">
        <View className="flex-row gap-2.5">
          <Pressable
            onPress={() => setActiveTab('kitchens')}
            className={`flex-1 rounded-[14px] bg-white border px-3 py-2.5 shadow-sm flex-row items-center justify-between gap-2 ${
              activeTab === 'kitchens' ? 'border-[#0F4C81]' : 'border-[#D8E2EC]'
            }`}
          >
            <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
              <View className="h-9 w-9 rounded-[10px] bg-[#EBF3FA] items-center justify-center shrink-0">
                <Building2 size={17} color="#0F4C81" />
              </View>
              <Text numberOfLines={1} className="font-sans text-[11.5px] font-bold text-[#475569]">
                Unit SPPG
              </Text>
            </View>
            <Text style={styles.kpiNumber}>{metrics?.total_kitchens ?? 0}</Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('schools')}
            className={`flex-1 rounded-[14px] bg-white border px-3 py-2.5 shadow-sm flex-row items-center justify-between gap-2 ${
              activeTab === 'schools' ? 'border-[#0F4C81]' : 'border-[#D8E2EC]'
            }`}
          >
            <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
              <View className="h-9 w-9 rounded-[10px] bg-[#EEF2FF] items-center justify-center shrink-0">
                <School size={17} color="#4338CA" />
              </View>
              <Text numberOfLines={1} className="font-sans text-[11.5px] font-bold text-[#475569]">
                Sekolah
              </Text>
            </View>
            <Text style={styles.kpiNumber}>{metrics?.total_schools ?? 0}</Text>
          </Pressable>
        </View>

        <View className="flex-row gap-2.5">
          <Pressable
            onPress={() => setActiveTab('batches')}
            className={`flex-1 rounded-[14px] bg-white border px-3 py-2.5 shadow-sm flex-row items-center justify-between gap-2 ${
              activeTab === 'batches' ? 'border-[#0F4C81]' : 'border-[#D8E2EC]'
            }`}
          >
            <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
              <View className="h-9 w-9 rounded-[10px] bg-[#DCFCE7] items-center justify-center shrink-0">
                <Layers size={17} color="#15803D" />
              </View>
              <Text numberOfLines={1} className="font-sans text-[11.5px] font-bold text-[#475569]">
                Batch Aktif
              </Text>
            </View>
            <Text style={[styles.kpiNumber, { color: '#0F4C81' }]}>
              {metrics?.active_batches ?? batches.length}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('users')}
            className={`flex-1 rounded-[14px] border px-3 py-2.5 shadow-sm flex-row items-center justify-between gap-2 ${
              (metrics?.orphan_users ?? 0) > 0
                ? 'border-[#FCA5A5] bg-[#FEF2F2]'
                : activeTab === 'users'
                  ? 'border-[#0F4C81] bg-white'
                  : 'border-[#D8E2EC] bg-white'
            }`}
          >
            <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
              <View
                className={`h-9 w-9 rounded-[10px] items-center justify-center shrink-0 ${
                  (metrics?.orphan_users ?? 0) > 0 ? 'bg-[#FEE2E2]' : 'bg-[#F1F5F9]'
                }`}
              >
                <Users size={17} color={(metrics?.orphan_users ?? 0) > 0 ? '#B91C1C' : '#475569'} />
              </View>
              <View className="flex-row items-center gap-1 flex-1 min-w-0">
                <Text numberOfLines={1} className="font-sans text-[11.5px] font-bold text-[#475569]">
                  Akun
                </Text>
                {(metrics?.orphan_users ?? 0) > 0 ? <PulseDot color="#DC2626" size={5} /> : null}
              </View>
            </View>
            <Text
              style={[
                styles.kpiNumber,
                { color: (metrics?.orphan_users ?? 0) > 0 ? '#B91C1C' : '#15803D' },
              ]}
            >
              {metrics?.total_users ?? 0}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 bg-[#F4F7FA]">
        {/* Sub-tab segmented pill container */}
        <View className="px-4 pb-2.5">
          <View className="flex-row gap-1 bg-white p-1 rounded-[12px] border border-[#D8E2EC]">
            {[
              { id: 'kitchens', label: `SPPG (${snapshot?.kitchens.length ?? 0})` },
              { id: 'schools', label: `Sekolah (${snapshot?.schools.length ?? 0})` },
              {
                id: 'users',
                label: `Akun (${snapshot?.users.length ?? 0})${(metrics?.orphan_users ?? 0) > 0 ? '!' : ''}`,
              },
              { id: 'batches', label: `Batch (${batches.length})` },
            ].map((t) => {
              const active = activeTab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setActiveTab(t.id as AdminTab)}
                  className={`flex-1 py-2 px-1 rounded-[9px] items-center justify-center ${
                    active ? 'bg-[#0F4C81]' : 'bg-transparent'
                  }`}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    className={`font-sans text-[11px] font-bold ${
                      active ? 'text-white' : 'text-[#475569]'
                    }`}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#0F4C81"
              colors={['#0F4C81']}
            />
          }
        >

          {snapshotError ? (
            <HairlineCard className="border-[#FCA5A5] bg-[#FEF2F2] gap-2">
              <View className="flex-row items-center gap-2">
                <ShieldAlert size={16} color="#B91C1C" />
                <Text className="flex-1 font-sans text-[13px] font-bold text-[#991B1B]">
                  Koneksi Snapshot Admin Gagal
                </Text>
              </View>
              <Text className="font-sans text-[12px] text-[#7F1D1D] leading-[17px]">
                {snapshotError}
              </Text>
              <Text className="font-sans text-[11px] text-[#991B1B] leading-[16px]">
                Pastikan pembaruan SQL 007 (termasuk kolom estimated_kg &amp; NOTIFY pgrst) sudah dijalankan di Supabase SQL Editor.
              </Text>
              <CivicButton
                fullWidth={false}
                size="sm"
                variant="danger"
                icon={<RefreshCw size={13} color="#FFFFFF" />}
                onPress={loadSnapshot}
              >
                Muat Ulang Data
              </CivicButton>
            </HairlineCard>
          ) : null}

          {isLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#0F4C81" />
              <Text className="font-sans text-[12px] text-[#64748B] mt-2">
                Memuat data pengawasan nasional...
              </Text>
            </View>
          ) : dataSource !== 'supabase' ? (
            <HairlineCard>
              <Text className="font-sans text-[13px] font-bold text-[#0B2E59]">
                Mode Offline Mock
              </Text>
              <Text className="font-sans text-[12px] text-[#475569] mt-1">
                Panel Admin BGN mengelola unit SPPG, Sekolah, dan Akun secara langsung di Supabase Cloud.
              </Text>
            </HairlineCard>
          ) : activeTab === 'kitchens' ? (
            <>
              <View className="flex-row items-center justify-between gap-2">
                <Text
                  numberOfLines={1}
                  className="flex-1 font-sans text-[12px] font-bold uppercase tracking-[0.05em] text-[#0B2E59]"
                >
                  Daftar Unit SPPG
                </Text>
                <CivicButton
                  fullWidth={false}
                  size="sm"
                  label="Tambah SPPG"
                  icon={<Plus size={14} color="#FFFFFF" />}
                  onPress={openAddKitchen}
                />
              </View>
              {(snapshot?.kitchens || []).map((k) => {
                const isInactive = k.is_active === false;
                return (
                <HairlineCard
                  key={k.id}
                  className={`gap-2 ${isInactive ? 'bg-[#F8FAFC] border-[#CBD5E1] opacity-80' : ''}`}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <View className={`px-2 py-0.5 rounded ${isInactive ? 'bg-[#64748B]' : 'bg-[#0B2E59]'}`}>
                          <Text className="font-mono text-[10px] font-bold text-white">
                            {k.code}
                          </Text>
                        </View>
                        <Text className="font-sans text-[15px] font-bold text-[#0F172A]">
                          {k.name}
                        </Text>
                        {isInactive ? (
                          <View className="px-2 py-0.5 rounded bg-[#FEE2E2] border border-[#FCA5A5]">
                            <Text className="font-mono text-[9px] font-bold text-[#B91C1C]">
                              NONAKTIF
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {k.address ? (
                        <Text className="font-sans text-[12px] text-[#64748B] mt-1">
                          {k.address}
                        </Text>
                      ) : null}
                    </View>
                    <View className="flex-row items-center gap-1.5 shrink-0">
                      <Pressable
                        onPress={() => openEditKitchen(k)}
                        accessibilityLabel="Edit unit SPPG"
                        className="p-2 rounded-[8px] bg-[#EBF3FA] border border-[#BDD5EB]"
                      >
                        <Edit3 size={14} color="#0F4C81" />
                      </Pressable>
                      <Pressable
                        disabled={togglingId === k.id}
                        onPress={() => confirmToggleKitchenActive(k)}
                        accessibilityLabel={isInactive ? 'Aktifkan SPPG' : 'Nonaktifkan SPPG'}
                        className={`p-2 rounded-[8px] border ${
                          isInactive
                            ? 'bg-[#DCFCE7] border-[#86EFAC]'
                            : 'bg-[#FEF2F2] border-[#FCA5A5]'
                        }`}
                      >
                        <Power size={14} color={isInactive ? '#15803D' : '#B91C1C'} />
                      </Pressable>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap items-center gap-3 pt-2 border-t border-[#F1F5F9]">
                    <Text className="font-sans text-[11px] font-semibold text-[#475569]">
                      Sekolah: <Text className="font-bold text-[#0B2E59]">{k.school_count}</Text>
                    </Text>
                    <Text className="font-sans text-[11px] font-semibold text-[#475569]">
                      Petugas: <Text className="font-bold text-[#0B2E59]">{k.staff_count}</Text>
                    </Text>
                    <Text className="font-sans text-[11px] font-semibold text-[#475569]">
                      Ompreng: <Text className="font-bold text-[#0F4C81]">{k.total_ompreng_inventory}</Text>
                    </Text>
                  </View>
                </HairlineCard>
                );
              })}
            </>
          ) : activeTab === 'schools' ? (
            <>
              <View className="flex-row items-center justify-between gap-2">
                <Text
                  numberOfLines={1}
                  className="flex-1 font-sans text-[12px] font-bold uppercase tracking-[0.05em] text-[#0B2E59]"
                >
                  Sekolah Binaan &amp; NPSN
                </Text>
                <CivicButton
                  fullWidth={false}
                  size="sm"
                  label="Tambah Sekolah"
                  icon={<Plus size={14} color="#FFFFFF" />}
                  onPress={openAddSchool}
                />
              </View>
              {(snapshot?.schools || []).map((s) => {
                const isInactive = s.is_active === false;
                return (
                <HairlineCard
                  key={s.id}
                  className={`gap-2 ${isInactive ? 'bg-[#F8FAFC] border-[#CBD5E1] opacity-80' : ''}`}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="font-sans text-[15px] font-bold text-[#0F172A]">
                          {s.name}
                        </Text>
                        {s.npsn ? (
                          <View className="px-2 py-0.5 rounded bg-[#EBF3FA] border border-[#BDD5EB]">
                            <Text className="font-mono text-[10px] font-bold text-[#0F4C81]">
                              NPSN {s.npsn}
                            </Text>
                          </View>
                        ) : null}
                        {isInactive ? (
                          <View className="px-2 py-0.5 rounded bg-[#FEE2E2] border border-[#FCA5A5]">
                            <Text className="font-mono text-[9px] font-bold text-[#B91C1C]">
                              NONAKTIF
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="font-sans text-[12px] text-[#475569] mt-0.5">
                        SPPG Pembina:{' '}
                        <Text className="font-bold text-[#0B2E59]">
                          {s.assigned_kitchen_name || '-'} ({s.assigned_kitchen_code || '-'})
                        </Text>
                      </Text>
                      <Text className="font-sans text-[11px] text-[#64748B] mt-0.5">
                        PIC: {s.pic_name || '-'} • WA: {s.phone_wa || '-'} • Porsi: {s.default_portions}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 shrink-0">
                      <Pressable
                        onPress={() => openEditSchool(s)}
                        accessibilityLabel="Edit sekolah"
                        className="p-2 rounded-[8px] bg-[#EBF3FA] border border-[#BDD5EB]"
                      >
                        <Edit3 size={14} color="#0F4C81" />
                      </Pressable>
                      <Pressable
                        disabled={togglingId === s.id}
                        onPress={() => confirmToggleSchoolActive(s)}
                        accessibilityLabel={isInactive ? 'Aktifkan sekolah' : 'Nonaktifkan sekolah'}
                        className={`p-2 rounded-[8px] border ${
                          isInactive
                            ? 'bg-[#DCFCE7] border-[#86EFAC]'
                            : 'bg-[#FEF2F2] border-[#FCA5A5]'
                        }`}
                      >
                        <Power size={14} color={isInactive ? '#15803D' : '#B91C1C'} />
                      </Pressable>
                    </View>
                  </View>
                </HairlineCard>
                );
              })}
            </>
          ) : activeTab === 'users' ? (
            <>
              <View className="gap-2">
                <Text className="font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B2E59]">
                  Daftar Akun Petugas &amp; Pemulihan Penugasan
                </Text>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 flex-row items-center bg-white border border-[#CBD5E1] rounded-[10px] px-3 py-2 gap-2">
                    <Search size={14} color="#64748B" />
                    <TextInput
                      value={userSearch}
                      onChangeText={setUserSearch}
                      placeholder="Cari nama, email, atau unit..."
                      placeholderTextColor="#94A3B8"
                      className="flex-1 font-sans text-[12px] text-[#0F172A] py-0"
                    />
                    {userSearch.length > 0 ? (
                      <Pressable onPress={() => setUserSearch('')} hitSlop={8}>
                        <X size={13} color="#64748B" />
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => setOnlyOrphanUsers((prev) => !prev)}
                    className={`px-3 py-2 rounded-[10px] border shrink-0 ${
                      onlyOrphanUsers
                        ? 'bg-[#DC2626] border-[#DC2626]'
                        : 'bg-white border-[#CBD5E1]'
                    }`}
                  >
                    <Text
                      className={`font-sans text-[11px] font-bold ${
                        onlyOrphanUsers ? 'text-white' : 'text-[#475569]'
                      }`}
                    >
                      Orphan ({metrics?.orphan_users ?? 0})
                    </Text>
                  </Pressable>
                </View>
              </View>
              {(snapshot?.users || [])
                .filter((u) => {
                  if (onlyOrphanUsers && !u.is_orphan) return false;
                  const q = userSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (u.full_name || '').toLowerCase().includes(q) ||
                    (u.email || '').toLowerCase().includes(q) ||
                    (u.kitchen_name || '').toLowerCase().includes(q) ||
                    (u.school_name || '').toLowerCase().includes(q)
                  );
                })
                .map((u) => {
                  const isUserInactive = u.is_active === false;
                  return (
                <HairlineCard
                  key={u.id}
                  className={`gap-2 ${
                    u.is_orphan
                      ? 'border-[#FCA5A5] bg-[#FEF2F2]'
                      : isUserInactive
                        ? 'border-[#CBD5E1] bg-[#F8FAFC] opacity-80'
                        : ''
                  }`}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text className="font-sans text-[14px] font-bold text-[#0F172A]">
                          {u.full_name || '(Tanpa Profil)'}
                        </Text>
                        <View
                          className={`px-2 py-0.5 rounded ${
                            u.is_orphan
                              ? 'bg-[#DC2626]'
                              : u.role === 'admin'
                                ? 'bg-[#0B2E59]'
                                : 'bg-[#DCFCE7]'
                          }`}
                        >
                          <Text
                            className={`font-mono text-[9px] font-bold uppercase ${
                              u.is_orphan || u.role === 'admin' ? 'text-white' : 'text-[#14532D]'
                            }`}
                          >
                            {u.is_orphan ? 'ORPHAN / BELUM TERHUBUNG' : u.role}
                          </Text>
                        </View>
                        {isUserInactive && !u.is_orphan ? (
                          <View className="px-2 py-0.5 rounded bg-[#FEE2E2] border border-[#FCA5A5]">
                            <Text className="font-mono text-[9px] font-bold text-[#B91C1C]">
                              NONAKTIF
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="font-sans text-[12px] text-[#475569] mt-0.5" numberOfLines={1}>
                        {u.email}
                      </Text>
                      <Text className="font-sans text-[11px] text-[#64748B] mt-0.5">
                        Unit:{' '}
                        {u.role === 'admin'
                          ? 'Pusat BGN'
                          : u.kitchen_name
                            ? `${u.kitchen_name} (${u.kitchen_code})`
                            : u.school_name || 'Belum ditugaskan'}
                      </Text>
                    </View>
                    {u.role !== 'admin' && u.id !== userProfile?.id ? (
                      <View className="flex-row items-center gap-1.5 shrink-0">
                        <Pressable
                          onPress={() => openEditUser(u)}
                          className="px-2.5 py-1.5 rounded-[8px] bg-[#0F4C81]"
                        >
                          <Text className="font-sans text-[11px] font-bold text-white">
                            Atur Unit
                          </Text>
                        </Pressable>
                        {!u.is_orphan ? (
                          <Pressable
                            disabled={togglingId === u.id}
                            onPress={() => confirmToggleUserActive(u)}
                            accessibilityLabel={isUserInactive ? 'Aktifkan akun' : 'Nonaktifkan akun'}
                            className={`p-1.5 rounded-[8px] border ${
                              isUserInactive
                                ? 'bg-[#DCFCE7] border-[#86EFAC]'
                                : 'bg-[#FEF2F2] border-[#FCA5A5]'
                            }`}
                          >
                            <Power size={14} color={isUserInactive ? '#15803D' : '#B91C1C'} />
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </HairlineCard>
                  );
                })}
            </>
          ) : (
            <>
              {metrics && (
                <View className="rounded-[10px] border border-[#BDD5EB] bg-[#EBF3FA] px-3.5 py-2.5 flex-row items-center justify-between flex-wrap gap-2">
                  <Text className="font-sans text-[11px] font-semibold text-[#0B2E59]">
                    Ditolak Basi: {metrics.rejected_batches} • Void: {metrics.voided_batches} • Maggot BSF: {metrics.total_maggot_kg} kg
                  </Text>
                  <Text className="font-mono text-[10px] font-bold text-[#0F4C81]">
                    {formatWibTime(simulatedNowMs)}
                  </Text>
                </View>
              )}

              {/* Periodic Report Bar & PDF Export */}
              <View className="bg-white rounded-[12px] border border-[#D8E2EC] p-3 gap-2.5">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                    REKAP LAPORAN BERKALA ({filteredReportBatches.length})
                  </Text>
                  <Pressable
                    disabled={isExportingReport}
                    onPress={handleExportAdminPdf}
                    className="px-3 py-1.5 rounded-[8px] bg-[#0F4C81] flex-row items-center gap-1.5 active:bg-[#0B2E59]"
                  >
                    <FileDown size={13} color="#FFFFFF" />
                    <Text className="font-sans text-[11px] font-bold text-white">
                      {isExportingReport ? 'Membuat...' : 'Ekspor Rekap PDF'}
                    </Text>
                  </Pressable>
                </View>
                <View className="flex-row gap-1.5">
                  {[
                    { id: 'today', label: 'Hari Ini' },
                    { id: '7days', label: '7 Hari' },
                    { id: 'all', label: 'Semua Waktu' },
                  ].map((opt) => {
                    const active = reportPeriod === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => setReportPeriod(opt.id as any)}
                        className={`flex-1 py-1.5 rounded-[8px] border items-center ${
                          active ? 'bg-[#EBF3FA] border-[#0F4C81]' : 'bg-[#F8FAFC] border-[#CBD5E1]'
                        }`}
                      >
                        <Text
                          className={`font-sans text-[11px] font-bold ${
                            active ? 'text-[#0B2E59]' : 'text-[#64748B]'
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Text className="font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B2E59]">
                Monitoring Batch Lintas SPPG ({filteredReportBatches.length})
              </Text>
              {filteredReportBatches.map((b) => {
                const ev = evaluateBatchSafety(b, simulatedNowMs);
                return (
                  <Pressable key={b.id} onPress={() => setSelectedAuditBatch(b)}>
                    <HairlineCard className="gap-1.5">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="flex-1 min-w-0 font-mono text-[12px] font-bold text-[#0B2E59]" numberOfLines={1}>
                          {b.id}
                        </Text>
                        <View className="flex-row items-center gap-1.5 shrink-0">
                          <View className="px-2 py-0.5 rounded bg-[#EBF3FA] border border-[#BDD5EB]">
                            <Text className="font-mono text-[10px] font-bold text-[#0F4C81]">
                              {ev.verdictBadge}
                            </Text>
                          </View>
                          <ChevronRight size={14} color="#94A3B8" />
                        </View>
                      </View>
                      <Text className="font-sans text-[13px] font-bold text-[#0F172A]">
                        {b.kitchenName} → {b.schoolName}
                      </Text>
                      <Text className="font-sans text-[11px] text-[#64748B]">
                        {b.omprengCount} Ompreng • Koki: {b.creatorName || 'Petugas'} • {formatWibTime(b.cookedAt)}
                      </Text>
                    </HairlineCard>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>

      {/* Modal: Tambah / Edit SPPG */}
      <Modal
        visible={showKitchenModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowKitchenModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-2xl p-5 border-t border-[#D8E2EC] max-h-[85%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#EDF2F7]">
              <Text className="font-sans text-[16px] font-bold text-[#0B2E59]">
                {editingKitchen ? 'Edit Unit Dapur SPPG' : 'Tambah Unit SPPG Baru'}
              </Text>
              <Pressable onPress={() => setShowKitchenModal(false)} className="p-1">
                <X size={18} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView className="py-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text className="text-xs font-bold text-[#475569] mb-1">KODE RESMI SPPG *</Text>
              <TextInput
                value={kitchenCode}
                onChangeText={setKitchenCode}
                autoCapitalize="characters"
                placeholder="SPPG-DIY-01"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm font-bold text-[#0F172A] mb-3"
              />
              <Text className="text-xs font-bold text-[#475569] mb-1">NAMA UNIT SPPG *</Text>
              <TextInput
                value={kitchenName}
                onChangeText={setKitchenName}
                placeholder="SPPG Yogyakarta Kota"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] mb-3"
              />
              <Text className="text-xs font-bold text-[#475569] mb-1">ALAMAT DAPUR</Text>
              <TextInput
                value={kitchenAddress}
                onChangeText={setKitchenAddress}
                placeholder="Jl. Malioboro No. 10, Yogyakarta"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] mb-3"
              />
              <Text className="text-xs font-bold text-[#475569] mb-1">KUOTA OMPRENG AWAL</Text>
              <TextInput
                value={kitchenInventory}
                onChangeText={setKitchenInventory}
                keyboardType="numeric"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm font-bold text-[#0F172A] mb-4"
              />
              <CivicButton
                variant="primary"
                loading={isSavingKitchen}
                onPress={handleSaveKitchen}
              >
                {editingKitchen ? 'Simpan Perubahan SPPG' : 'Daftarkan Unit SPPG'}
              </CivicButton>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Tambah / Edit Sekolah */}
      <Modal
        visible={showSchoolModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSchoolModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-2xl p-5 border-t border-[#D8E2EC] max-h-[88%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#EDF2F7]">
              <Text className="font-sans text-[16px] font-bold text-[#0B2E59]">
                {editingSchool ? 'Edit Sekolah Binaan' : 'Daftarkan Sekolah Binaan'}
              </Text>
              <Pressable onPress={() => setShowSchoolModal(false)} className="p-1">
                <X size={18} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView className="py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text className="text-xs font-bold text-[#475569] mb-1.5">PILIH SPPG PEMBINA *</Text>
              <ScrollView className="max-h-36 mb-3" nestedScrollEnabled showsVerticalScrollIndicator>
                <View className="flex-row flex-wrap gap-2">
                  {(snapshot?.kitchens || []).map((k) => {
                    const selected = schoolKitchenId === k.id;
                    return (
                      <Pressable
                        key={k.id}
                        onPress={() => setSchoolKitchenId(k.id)}
                        className={`px-3 py-2 rounded-lg border ${
                          selected ? 'bg-[#0F4C81] border-[#0F4C81]' : 'bg-[#F8FAFC] border-[#CBD5E1]'
                        }`}
                      >
                        <Text className={`text-xs font-bold ${selected ? 'text-white' : 'text-[#334155]'}`}>
                          {k.code} ({k.name})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              <Text className="text-xs font-bold text-[#475569] mb-1">NAMA SEKOLAH *</Text>
              <TextInput
                value={schoolName}
                onChangeText={setSchoolName}
                placeholder="SDN 01 Purwokerto Lor"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] mb-3"
              />
              <Text className="text-xs font-bold text-[#475569] mb-1">NPSN RESMI (8 DIGIT)</Text>
              <TextInput
                value={schoolNpsn}
                onChangeText={setSchoolNpsn}
                keyboardType="numeric"
                maxLength={8}
                placeholder="20301999"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm font-bold text-[#0F172A] mb-3"
              />
              <Text className="text-xs font-bold text-[#475569] mb-1">NAMA PIC SEKOLAH</Text>
              <TextInput
                value={schoolPic}
                onChangeText={setSchoolPic}
                placeholder="Ibu Ani Suryani"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] mb-3"
              />
              <Text className="text-xs font-bold text-[#475569] mb-1">NO. WHATSAPP PIC</Text>
              <TextInput
                value={schoolPhone}
                onChangeText={setSchoolPhone}
                keyboardType="phone-pad"
                placeholder="081234567890"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] mb-3"
              />
              <Text className="text-xs font-bold text-[#475569] mb-1">PORSI STANDAR HARIAN</Text>
              <TextInput
                value={schoolPortions}
                onChangeText={setSchoolPortions}
                keyboardType="numeric"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm font-bold text-[#0F172A] mb-3"
              />
              <Text className="text-xs font-bold text-[#475569] mb-1">ALAMAT SEKOLAH</Text>
              <TextInput
                value={schoolAddress}
                onChangeText={setSchoolAddress}
                placeholder="Jl. Merdeka No. 1"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] mb-4"
              />
              <CivicButton variant="primary" loading={isSavingSchool} onPress={handleSaveSchool}>
                {editingSchool ? 'Simpan Perubahan Sekolah' : 'Simpan Sekolah Binaan'}
              </CivicButton>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Atur Penugasan Pengguna */}
      <Modal
        visible={showUserModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUserModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-2xl p-5 border-t border-[#D8E2EC] max-h-[88%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#EDF2F7]">
              <View className="flex-1 min-w-0 pr-2">
                <Text className="font-sans text-[16px] font-bold text-[#0B2E59]">
                  Atur Penugasan Akun Petugas
                </Text>
                <Text className="font-sans text-[11px] text-[#64748B]" numberOfLines={1}>
                  {editingUser?.email}
                </Text>
              </View>
              <Pressable onPress={() => setShowUserModal(false)} className="p-1 shrink-0">
                <X size={18} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView className="py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text className="text-xs font-bold text-[#475569] mb-1.5">PERAN AKUN</Text>
              <View className="flex-row gap-2 mb-3">
                {(['kitchen', 'school'] as const).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setAssignRole(r)}
                    className={`flex-1 py-2.5 rounded-lg border items-center ${
                      assignRole === r ? 'bg-[#0F4C81] border-[#0F4C81]' : 'bg-[#F8FAFC] border-[#CBD5E1]'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${assignRole === r ? 'text-white' : 'text-[#475569]'}`}>
                      {r === 'kitchen' ? 'Dapur SPPG' : 'Sekolah Penerima'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-xs font-bold text-[#475569] mb-1">NAMA LENGKAP</Text>
              <TextInput
                value={assignName}
                onChangeText={setAssignName}
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] mb-3"
              />

              <Text className="text-xs font-bold text-[#475569] mb-1">NO. WHATSAPP</Text>
              <TextInput
                value={assignPhone}
                onChangeText={setAssignPhone}
                keyboardType="phone-pad"
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] mb-3"
              />

              <Text className="text-xs font-bold text-[#475569] mb-1.5">
                {assignRole === 'kitchen' ? 'TUGASKAN KE SPPG' : 'TUGASKAN KE SEKOLAH'}
              </Text>
              <ScrollView className="max-h-40 mb-4" nestedScrollEnabled showsVerticalScrollIndicator>
                <View className="flex-row flex-wrap gap-2">
                  {assignRole === 'kitchen'
                    ? (snapshot?.kitchens || []).map((k) => {
                        const sel = assignKitchenId === k.id;
                        return (
                          <Pressable
                            key={k.id}
                            onPress={() => setAssignKitchenId(k.id)}
                            className={`px-3 py-2 rounded-lg border ${
                              sel ? 'bg-[#0F4C81] border-[#0F4C81]' : 'bg-[#F8FAFC] border-[#CBD5E1]'
                            }`}
                          >
                            <Text className={`text-xs font-bold ${sel ? 'text-white' : 'text-[#334155]'}`}>
                              {k.code} • {k.name}
                            </Text>
                          </Pressable>
                        );
                      })
                    : (snapshot?.schools || []).map((s) => {
                        const sel = assignSchoolId === s.id;
                        return (
                          <Pressable
                            key={s.id}
                            onPress={() => setAssignSchoolId(s.id)}
                            className={`px-3 py-2 rounded-lg border ${
                              sel ? 'bg-[#0F4C81] border-[#0F4C81]' : 'bg-[#F8FAFC] border-[#CBD5E1]'
                            }`}
                          >
                            <Text className={`text-xs font-bold ${sel ? 'text-white' : 'text-[#334155]'}`}>
                              {s.name} ({s.npsn || '-'})
                            </Text>
                          </Pressable>
                        );
                      })}
                </View>
              </ScrollView>

              <CivicButton variant="primary" loading={isSavingUser} onPress={handleSaveUserAssignment}>
                Simpan Penugasan Akun
              </CivicButton>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Detail Audit Batch Lintas SPPG */}
      <Modal
        visible={!!selectedAuditBatch}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAuditBatch(null)}
      >
        <Pressable
          className="flex-1 bg-black/55 items-center justify-center p-4"
          onPress={() => setSelectedAuditBatch(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-[16px] w-full max-w-[400px] border border-[#D8E2EC] overflow-hidden max-h-[82%]"
          >
            {selectedAuditBatch ? (
              <>
                <View className="px-4 py-3 bg-[#0B2E59] flex-row items-center justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <Text className="font-mono text-[13px] font-bold text-white" numberOfLines={1}>
                      {selectedAuditBatch.id}
                    </Text>
                    <Text className="font-sans text-[11px] text-[#93C5FD]" numberOfLines={1}>
                      {selectedAuditBatch.kitchenName} → {selectedAuditBatch.schoolName}
                    </Text>
                  </View>
                  <Pressable onPress={() => setSelectedAuditBatch(null)} className="p-1">
                    <X size={18} color="#FFFFFF" />
                  </Pressable>
                </View>

                <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between bg-[#F8FAFC] p-3 rounded-[10px] border border-[#E2E8F0]">
                      <View>
                        <Text className="font-sans text-[10px] font-bold uppercase text-[#64748B]">
                          STATUS KEAMANAN
                        </Text>
                        <Text className="font-sans text-[13px] font-bold text-[#0F172A] mt-0.5">
                          {evaluateBatchSafety(selectedAuditBatch, simulatedNowMs).verdictBadge}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-sans text-[10px] font-bold uppercase text-[#64748B]">
                          OMPRENG
                        </Text>
                        <Text className="font-mono text-[13px] font-bold text-[#0F4C81] mt-0.5">
                          {selectedAuditBatch.omprengReceivedCount ?? selectedAuditBatch.omprengCount} / {selectedAuditBatch.omprengCount}
                        </Text>
                      </View>
                    </View>

                    <View className="bg-[#F8FAFC] p-3 rounded-[10px] border border-[#E2E8F0] gap-1.5">
                      <Text className="font-sans text-[11px] text-[#475569]">
                        Koki: <Text className="font-bold text-[#0F172A]">{selectedAuditBatch.creatorName || 'Petugas Dapur'}</Text>
                      </Text>
                      <Text className="font-sans text-[11px] text-[#475569]">
                        Masak: <Text className="font-mono font-bold text-[#0F172A]">{formatWibTime(selectedAuditBatch.cookedAt)}</Text> • Batas: <Text className="font-mono font-bold text-[#0F172A]">{formatWibTime(selectedAuditBatch.expiresAt)}</Text>
                      </Text>
                      <Text className="font-sans text-[11px] text-[#475569]">
                        Pemicu Terlemah: <Text className="font-bold text-[#B45309]">{selectedAuditBatch.weakestLinkItemName} ({selectedAuditBatch.holdingHours} jam)</Text>
                      </Text>
                      {selectedAuditBatch.aiOverridden ? (
                        <View className="mt-1 px-2 py-1 rounded bg-[#FEF3C7] border border-[#FCD34D]">
                          <Text className="font-sans text-[10.5px] font-bold text-[#92400E]">
                            AI OVERRIDDEN: Koki menaikkan batas aman dari deteksi awal AI ({selectedAuditBatch.aiDetectedWeakestMinutes ? `${(selectedAuditBatch.aiDetectedWeakestMinutes / 60).toFixed(1).replace('.', ',')} jam` : 'risiko tinggi'}).
                          </Text>
                        </View>
                      ) : null}
                      {selectedAuditBatch.verificationMethod === 'manual_code' ? (
                        <View className="mt-1 px-2 py-1 rounded bg-[#EBF3FA] border border-[#BDD5EB]">
                          <Text className="font-sans text-[10.5px] font-bold text-[#0F4C81]">
                            VERIFIKASI MANUAL SEKOLAH: {selectedAuditBatch.manualVerificationReason || 'Kode stiker manual'}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View className="gap-1.5">
                      <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                        DAFTAR MENU ({selectedAuditBatch.items.length})
                      </Text>
                      {selectedAuditBatch.items.map((item, idx) => (
                        <View key={`${item.id}-${idx}`} className="flex-row items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                          <Text className="font-sans text-[12px] font-semibold text-[#0F172A] flex-1 pr-2">
                            {item.name}
                          </Text>
                          <Text className="font-mono text-[11px] text-[#475569]">
                            {item.holdingHours} jam
                          </Text>
                        </View>
                      ))}
                    </View>

                    {(selectedAuditBatch.rejectionReason || selectedAuditBatch.voidReason || selectedAuditBatch.omprengDiscrepancyNote) ? (
                      <View className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] p-3 gap-1">
                        <Text className="font-sans text-[10px] font-bold uppercase text-[#B91C1C]">
                          CATATAN INSIDEN / SELISIH
                        </Text>
                        <Text className="font-sans text-[12px] text-[#7F1D1D]">
                          {selectedAuditBatch.rejectionReason || selectedAuditBatch.voidReason || selectedAuditBatch.omprengDiscrepancyNote}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!pendingToggleConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingToggleConfirm(null)}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center p-5"
          onPress={() => setPendingToggleConfirm(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] rounded-[16px] bg-white border border-[#D8E2EC] p-5 gap-3 shadow-lg"
          >
            <View className="flex-row items-center gap-2.5">
              <View
                className={`h-9 w-9 rounded-[8px] items-center justify-center ${
                  pendingToggleConfirm?.isActivate ? 'bg-[#DCFCE7]' : 'bg-[#FEE2E2]'
                }`}
              >
                <Power
                  size={18}
                  color={pendingToggleConfirm?.isActivate ? '#15803D' : '#B91C1C'}
                />
              </View>
              <Text className="font-sans text-[15px] font-bold text-[#0F172A] flex-1">
                {pendingToggleConfirm?.title}
              </Text>
            </View>

            <Text className="font-sans text-[12.5px] leading-[18px] text-[#475569]">
              {pendingToggleConfirm?.message}
            </Text>

            <View className="flex-row items-center gap-2.5 mt-1">
              <Pressable
                onPress={() => setPendingToggleConfirm(null)}
                className="flex-1 min-h-[44px] items-center justify-center rounded-[10px] border border-[#CBD5E1] bg-white active:bg-[#F8FAFC]"
              >
                <Text className="font-sans text-[13px] font-bold text-[#475569]">
                  Batal
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const action = pendingToggleConfirm;
                  setPendingToggleConfirm(null);
                  if (action) {
                    await action.onConfirm();
                  }
                }}
                className={`flex-1 min-h-[44px] items-center justify-center rounded-[10px] ${
                  pendingToggleConfirm?.isActivate
                    ? 'bg-[#15803D] active:bg-[#14532D]'
                    : 'bg-[#B91C1C] active:bg-[#991B1B]'
                }`}
              >
                <Text className="font-sans text-[13px] font-bold text-white">
                  {pendingToggleConfirm?.confirmLabel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <RoleTutorialModal
        visible={showTutorial}
        audience="admin"
        onClose={() => setShowTutorial(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  kpiNumber: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 20,
    color: '#0F172A',
  },
  kpiLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#475569',
    marginTop: 2,
  },
});
