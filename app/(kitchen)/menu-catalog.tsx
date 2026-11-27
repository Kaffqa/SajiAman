import React, { useEffect, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Ban,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicButton } from '../../src/components/ui/CivicButton';
import { HairlineCard } from '../../src/components/ui/HairlineCard';
import { StepHeader } from '../../src/components/ui/StepHeader';
import { useSajiAman } from '../../src/context/SajiAmanContext';
import { supabaseRepository } from '../../src/data/supabaseRepository';
import { inferMenuRiskTierFromHours, MENU_CATEGORIES, MENU_RISK_TIERS } from '../../src/domain/menuTiers';
import { formatHoursId } from '../../src/domain/weakestLinkEngine';
import type { MenuCategory, MenuItem } from '../../src/types/sajiaman';

export default function MenuCatalogScreen() {
  const router = useRouter();
  const {
    menuCatalog,
    kitchenProfile,
    userProfile,
    dataSource,
    refreshMenuCatalog,
    showToast,
  } = useSajiAman();

  const [catalog, setCatalog] = useState<MenuItem[]>(menuCatalog);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form states for add/edit item
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MenuCategory>('sayur');
  const [newRiskTier, setNewRiskTier] = useState('santan_kuah_tinggi');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  useEffect(() => {
    setCatalog(menuCatalog);
  }, [menuCatalog]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return catalog;
    return catalog.filter((i) => i.category === selectedCategory);
  }, [catalog, selectedCategory]);

  const openAddModal = () => {
    setEditingItem(null);
    setNewName('');
    setNewCategory('sayur');
    setNewRiskTier('santan_kuah_tinggi');
    setShowAddModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    if (!item.kitchenId && dataSource === 'supabase') {
      showToast('Menu standar BGN tidak dapat diubah. Tambah sebagai Menu Kustom SPPG.', 'info');
      return;
    }
    setEditingItem(item);
    setNewName(item.name);
    setNewCategory(item.category);
    setNewRiskTier(inferMenuRiskTierFromHours(item.holdingHours));
    setShowAddModal(true);
  };

  const handleSaveMenuItem = async () => {
    if (!newName.trim()) {
      showToast('Nama menu olahan wajib diisi', 'warning');
      return;
    }

    setIsSubmitting(true);
    const tier = MENU_RISK_TIERS.find((t) => t.id === newRiskTier) || MENU_RISK_TIERS[0];
    const isActive = editingItem ? editingItem.isActive !== false : true;

    try {
      if (dataSource === 'supabase') {
        await supabaseRepository.upsertMenuItem(
          editingItem?.id || '',
          newName.trim(),
          newCategory,
          newRiskTier,
          isActive
        );
        await refreshMenuCatalog();
      } else {
        const cleanSlug =
          newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'menu';
        const savedItem: MenuItem = {
          id: editingItem?.id || `k-${cleanSlug}-${Date.now().toString(36)}`,
          name: newName.trim(),
          category: newCategory,
          holdingHours: tier.hours,
          riskLabel: tier.hours <= 3.5 ? 'Berkuah/Santan' : tier.label,
          isHighRisk: tier.hours <= 3.5,
          isActive,
          kitchenId: userProfile?.kitchenId || kitchenProfile.id,
          isSystemDefault: false,
        };
        setCatalog((prev) =>
          editingItem
            ? prev.map((it) => (it.id === savedItem.id ? savedItem : it))
            : [savedItem, ...prev]
        );
      }
      showToast(
        editingItem
          ? `Menu ${newName.trim()} berhasil diperbarui (${tier.hours} jam)`
          : `Menu kustom SPPG "${newName.trim()}" berhasil ditambahkan (${tier.hours} jam)`,
        'success'
      );
      setShowAddModal(false);
      setEditingItem(null);
      setNewName('');
    } catch (err: any) {
      showToast('Gagal menyimpan menu: ' + err.message, 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item: MenuItem) => {
    if (togglingItemId) return;
    if (!item.kitchenId && dataSource === 'supabase') {
      showToast('Menu standar BGN bersifat baku nasional.', 'info');
      return;
    }
    const nextActive = item.isActive === false;
    const tierId = inferMenuRiskTierFromHours(item.holdingHours);
    setTogglingItemId(item.id);
    try {
      if (dataSource === 'supabase') {
        await supabaseRepository.upsertMenuItem(
          item.id,
          item.name,
          item.category,
          tierId,
          nextActive
        );
        await refreshMenuCatalog();
      } else {
        setCatalog((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, isActive: nextActive } : it))
        );
      }
      showToast(
        nextActive ? `Menu ${item.name} diaktifkan kembali` : `Menu ${item.name} dinonaktifkan`,
        'info'
      );
    } catch (err: any) {
      showToast('Gagal mengubah status menu: ' + err.message, 'warning');
    } finally {
      setTogglingItemId(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-[#F4F7FA]">
      <StepHeader
        title="Katalog Menu & Batas Aman"
        eyebrow={userProfile?.kitchenName || kitchenProfile.name || 'STANDARISASI PANGAN BGN'}
        onBack={() => router.back()}
        rightSlot={
          <Pressable
            onPress={openAddModal}
            className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-[6px] bg-[#0F4C81] active:bg-[#0B2E59]"
          >
            <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text className="font-sans text-[11px] font-bold text-white">
              Tambah
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Category Filter Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {[
            { id: 'all', label: 'Semua Menu' },
            ...MENU_CATEGORIES.map((c) => ({ id: c.key, label: c.shortLabel })),
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-[8px] border ${
                  isSelected
                    ? 'bg-[#0B2E59] border-[#0B2E59]'
                    : 'bg-white border-[#D8E2EC]'
                }`}
              >
                <Text
                  className={`font-sans text-[12px] font-bold ${
                    isSelected ? 'text-white' : 'text-[#475569]'
                  }`}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Compact Guidance Tip */}
        <View className="mb-3 px-3 py-2 rounded-[8px] bg-[#EBF3FA] border border-[#BDD5EB] flex-row items-center gap-2">
          <ShieldCheck size={15} color="#0F4C81" className="shrink-0" />
          <Text className="font-sans text-[11px] font-medium text-[#0F4C81] flex-1 min-w-0">
            Batas aman terkunci otomatis oleh sistem (kuah santan maks 3,5 jam).
          </Text>
        </View>

        {/* Menu Items List */}
        <View className="gap-2.5">
          {filteredItems.map((item) => {
            const isHighRisk = item.holdingHours <= 3.5;
            const isActive = item.isActive !== false;
            const isCustomKitchen = Boolean(item.kitchenId);
            return (
              <View
                key={item.id}
                className={`bg-white rounded-[12px] border p-3.5 gap-2.5 ${
                  isActive ? 'border-[#D8E2EC]' : 'border-[#E2E8F0] opacity-65'
                }`}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center flex-wrap gap-1.5">
                      <Text className="font-sans text-[14px] font-bold text-[#0F172A]">
                        {item.name}
                      </Text>
                      {isCustomKitchen ? (
                        <View className="px-1.5 py-0.5 rounded border bg-[#EBF3FA] border-[#BDD5EB]">
                          <Text className="font-sans text-[9px] font-bold uppercase text-[#0F4C81]">
                            KUSTOM
                          </Text>
                        </View>
                      ) : null}
                      {!isActive && (
                        <View className="px-1.5 py-0.5 rounded bg-[#F1F5F9] border border-[#CBD5E1]">
                          <Text className="font-sans text-[9px] font-bold text-[#64748B] uppercase">
                            NONAKTIF
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center gap-2 mt-1">
                      <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                        {item.category}
                      </Text>
                      <Text className="text-[#CBD5E1]">•</Text>
                      <Text style={[styles.holdingMono, { color: isHighRisk ? '#B45309' : '#0F4C81' }]}>
                        Batas {formatHoursId(item.holdingHours)} Jam
                      </Text>
                    </View>
                  </View>

                  <View
                    className={`px-2.5 py-1 rounded-[6px] border shrink-0 ${
                      isHighRisk
                        ? 'bg-[#FEF3C7] border-[#FCD34D]'
                        : 'bg-[#DCFCE7] border-[#86EFAC]'
                    }`}
                  >
                    <Text
                      style={[
                        styles.tierBadge,
                        { color: isHighRisk ? '#78350F' : '#14532D' },
                      ]}
                    >
                      {isHighRisk ? 'RISIKO SANTAN' : 'STANDAR KERING'}
                    </Text>
                  </View>
                </View>

                {isCustomKitchen || dataSource !== 'supabase' ? (
                  <View className="flex-row items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                    <Pressable
                      onPress={() => openEditModal(item)}
                      className="flex-row items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#EBF3FA] border border-[#BDD5EB]"
                    >
                      <Edit3 size={12} color="#0F4C81" />
                      <Text className="font-sans text-[11px] font-bold text-[#0F4C81]">
                        Edit Menu
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleToggleActive(item)}
                      className={`flex-row items-center gap-1 px-2.5 py-1 rounded-[6px] border ${
                        isActive
                          ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                          : 'bg-[#DCFCE7] border-[#86EFAC]'
                      }`}
                    >
                      {isActive ? (
                        <Ban size={12} color="#B91C1C" />
                      ) : (
                        <CheckCircle2 size={12} color="#15803D" />
                      )}
                      <Text
                        className={`font-sans text-[11px] font-bold ${
                          isActive ? 'text-[#B91C1C]' : 'text-[#15803D]'
                        }`}
                      >
                        {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Add / Edit Menu Item Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
        <Pressable
          className="flex-1 bg-black/60 items-center justify-center p-4"
          onPress={() => setShowAddModal(false)}
        >
          <Pressable
            className="bg-white rounded-[16px] p-5 w-full max-w-[360px] max-h-[85%] border border-[#D8E2EC]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between border-b border-[#EDF2F7] pb-2.5 mb-3">
              <Text className="font-sans text-[15px] font-bold text-[#0F172A] flex-1 min-w-0">
                {editingItem ? 'Edit Menu Olahan' : 'Tambah Menu Olahan Baru'}
              </Text>
              <Pressable onPress={() => setShowAddModal(false)} className="p-1 shrink-0">
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            {/* Menu Name */}
            <View className="gap-1">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                NAMA MASAKAN / OLAHAN
              </Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Contoh: Soto Ayam Santan"
                placeholderTextColor="#94A3B8"
                className="font-sans text-[13px] text-[#0F172A] border border-[#D8E2EC] rounded-[8px] p-2.5 bg-[#F8FAFC]"
              />
            </View>

            {/* Category */}
            <View className="gap-1.5">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                KATEGORI KOMPONEN
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {MENU_CATEGORIES.map((cat) => {
                  const isSelected = newCategory === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => setNewCategory(cat.key)}
                      style={{ width: '48.5%' }}
                      className={`px-2 py-2 rounded-[6px] border items-center ${
                        isSelected
                          ? 'bg-[#0F4C81] border-[#0F4C81]'
                          : 'bg-[#F8FAFC] border-[#D8E2EC]'
                      }`}
                    >
                      <Text
                        numberOfLines={1}
                        className={`font-sans text-[10.5px] font-bold ${
                          isSelected ? 'text-white' : 'text-[#475569]'
                        }`}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Standard Risk Tier Selector */}
            <View className="gap-1.5">
              <Text className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-[#475569]">
                TINGKAT KETAHANAN &amp; BATAS AMAN
              </Text>
              {MENU_RISK_TIERS.map((tier) => {
                const isSelected = newRiskTier === tier.id;
                return (
                  <Pressable
                    key={tier.id}
                    onPress={() => setNewRiskTier(tier.id)}
                    className={`p-2.5 rounded-[8px] border flex-row items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#EBF3FA] border-[#0F4C81]'
                        : 'bg-[#F8FAFC] border-[#D8E2EC]'
                    }`}
                  >
                    <Text
                      className={`flex-1 min-w-0 font-sans text-[11.5px] font-semibold ${
                        isSelected ? 'text-[#0B2E59] font-bold' : 'text-[#475569]'
                      }`}
                    >
                      {tier.label}
                    </Text>
                    <Text style={[styles.holdingMono, { color: tier.color }]} className="shrink-0">
                      {formatHoursId(tier.hours)} Jam
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <CivicButton
              variant="primary"
              loading={isSubmitting}
              onPress={handleSaveMenuItem}
              className="mt-1"
            >
              {editingItem ? 'Perbarui Menu' : 'Simpan ke Katalog'}
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
  holdingMono: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
  },
  tierBadge: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
