# SajiAman — Sistem Pengawasan Keamanan Pangan & Sirkularitas MBG

**SajiAman** adalah aplikasi mobile dan web lintas-platform berbasis **React Native (Expo SDK 58)** dan **Supabase PostgreSQL** untuk pengawasan *closed-loop* Program **Makan Bergizi Gratis (MBG)** Badan Gizi Nasional (BGN). Sistem ini mengintegrasikan pengendalian batas waktu aman konsumsi pangan (*holding time*), pelacakan wadah stainless (*ompreng*) berbasis *zero-sum*, serta pengalihan limbah organik dan makanan kedaluwarsa ke jalur biokonversi **Maggot Black Soldier Fly (BSF)**.

---

## 1. Fitur Utama per Peran

### Dapur SPPG (`app/(kitchen)/`)
- **Produksi Dual-Mode (Manual Chef & Foto Sampel AI):** Mendukung pemilihan komponen menu dari katalog BGN/SPPG maupun pengambilan foto sampel nampan secara langsung (*live-only*, tanpa unggah galeri) yang dianalisis melalui Supabase Edge Function Dual-AI (**Gemini Vision** dengan fallback otomatis ke **Groq Vision**).
- **Weakest-Link Rule & Clamping Server:** Batas aman konsumsi satu boks dikunci otomatis oleh komponen paling rentan (misal olahan santan/kuah maksimal 3,5 jam, sementara susu kemasan/steril UHT dikecualikan dari pembatasan pangan basah).
- **Segel QR & Tiket Termal (`sajiaman.v1`):** Setiap penyegelan boks menghasilkan kode batch unik (`MBG-DDMM-XXXXXX`), `qr_token` UUID dari server, dan pratinjau/cetak manifes BGN dalam format PDF.
- **Pelacak Ompreng Zero-Sum:** Rekonsiliasi waktu nyata stok ompreng di dapur, dalam perjalanan, berada di sekolah, siap dijemput (`ready_pickup`), kembali steril, serta selisih/hilang.
- **Katalog Menu, Sekolah Binaan & Pembatalan Terkontrol:** Manajemen menu kustom per unit SPPG, penyesuaian kuota ompreng, pemantauan sekolah binaan, pembatalan batch (*void*) beralasan wajib, serta penugasan armada Mitra Maggot BSF.

### Koordinator Sekolah (`app/(school)/`)
- **Antrean Pra-Tiba Tersamar & Pemindai QR Terpisah:** Kode batch sebelum tiba disamarkan pada daftar antrean untuk mencegah verifikasi fiktif tanpa memindai stiker fisik; tersedia jalur darurat input kode manual dengan pemilihan alasan wajib (*stiker basah/sobek* atau *kamera bermasalah*).
- **Evaluasi Lampu Lalu Lintas Terkunci Waktu Server:**
  - **HIJAU (`AMAN DIKONSUMSI`):** Sisa waktu aman `> 45` menit.
  - **KUNING (`SEGERA KONSUMSI`):** Sisa waktu aman `<= 45` menit (disertai alarm lokal peringatan).
  - **MERAH (`DILARANG DIBAGIKAN`):** Batas waktu habis (*hard-lock* otomatis), dibatalkan SPPG (*void*), atau ditolak koordinator.
- **Force Red Override (Tolak Basi Dini):** Memungkinkan koordinator mengunci status batch menjadi merah sebelum waktu habis apabila terindikasi bau asam/kerusakan fisik, lengkap dengan foto bukti di lokasi sekolah.
- **Konfirmasi Ompreng & Jalur Maggot BSF:** Konfirmasi penerimaan lengkap atau lapor selisih jumlah ompreng, penandaan wadah siap dijemput kembali, dan pelaporan sisa pasca-makan/surplus/kedaluwarsa ke antrean Mitra Maggot BSF.

### Admin BGN Pusat (`app/(admin)/`)
- **Tata Kelola Multi-Tenant Nasional:** Pendaftaran dan pembaruan unit SPPG, sekolah binaan (beserta NPSN), serta pemulihan/penugasan akun petugas lintas unit.
- **Kontrol Status Aktif (`is_active`):** Aktivasi atau penonaktifan unit SPPG, sekolah, dan akun pengguna beserta konfirmasi lintas platform (Android/iOS/Web) yang tetap mempertahankan jejak riwayat audit.
- **Pemantauan Anomali & Rekap PDF Berkala:** Penanda audit `AI OVERRIDDEN` (jika batas aman dari deteksi AI dinaikkan koki) dan verifikasi manual sekolah, lengkap dengan ekspor laporan rekap PDF periode Hari Ini (WIB), 7 Hari Terakhir, dan Semua Waktu.

---

## 2. Arsitektur Keamanan & Anti-Manipulasi (*Zero-Tampering*)

- **Penguncian Waktu & Aturan di Server (`SECURITY DEFINER` RPC):** Stempel waktu `cooked_at`, `expires_at`, nomor boks, dan pembatasan durasi item ad-hoc (`60–360` menit, maksimal `210` menit untuk pangan berisiko tinggi kecuali produk kemasan steril/UHT) dihitung dan dikunci di PostgreSQL melalui `seal_production_batch`.
- **Sinkronisasi Jam Server & Anti-Rollback:** Klien melakukan sinkronisasi offset melalui RPC `get_server_time()`, memantau pergeseran jam lokal selama sesi berjalan, dan mendeteksi kemunduran jam perangkat saat aplikasi ditutup dalam kondisi offline (`detectOfflineClockRollback`).
- **Verifikasi QR Fail-Closed Berbasis `qr_token` Server:** Payload QR `sajiaman.v1` menyertakan format checksum cepat FNV-1a di sisi klien sekaligus `qr_token` UUID dari server yang diverifikasi PostgreSQL (`verify_batch_qr_server`). Penanganan respons verifikasi bersifat **fail-closed** pada galat autentikasi (`401`/`403`), galat RPC, atau respons kosong; fallback cache offline hanya diizinkan saat perangkat benar-benar offline dengan kecocokan `qr_token` ketat dan jam tidak dimanipulasi.
- **Isolasi Multi-Tenant RLS & Proteksi Eskalasi:**
  - Kebijakan Row Level Security (RLS) mengisolasi data `production_batches`, `batch_menu_items`, `menu_catalog`, `schools`, `notifications`, dan `maggot_pickup_reports` berdasarkan peran (`admin`, `kitchen`, `school`) serta ID unit terkait.
  - Trigger `BEFORE UPDATE` pada `public.profiles` (`trg_protect_profiles_privilege_fields`) mencegah pengguna non-admin mengubah kolom `role`, `kitchen_id`, `school_id`, atau `is_active` secara langsung, serta `complete_user_registration` mengunci pengikatan akun ke `auth.uid()`.
- **Storage Privat & Edge Function Berproteksi JWT:** Bukti foto tersimpan di bucket privat `sample-photos` yang diakses lewat Signed URL terscoped per unit. Edge Function `analyze-meal-sample` mewajibkan header Bearer JWT pengguna terverifikasi sehingga API Key **Gemini** maupun **Groq** tersimpan eksklusif di Supabase Secrets.

---

## 3. Stack Teknologi & Struktur Direktori

### Stack Utama (`package.json`)
- **Framework Aplikasi:** React Native `0.88.1`, React `19.3.0`, Expo SDK `~58.0.26`, Expo Router `~58.0.32`
- **Styling & UI:** NativeWind `^4.1.23`, Tailwind CSS `^3.4.17`, `lucide-react-native`, `react-native-reanimated`, `react-native-qrcode-svg`, `@expo-google-fonts/plus-jakarta-sans`, `@expo-google-fonts/jetbrains-mono`
- **Kamera, Penyimpanan & Dokumen:** `expo-camera`, `expo-image-manipulator`, `expo-file-system`, `expo-notifications`, `expo-print`, `expo-sharing`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`
- **Backend & Cloud:** Supabase (`@supabase/supabase-js ^2.119.2`), PostgreSQL + RLS + Realtime + Private Storage + Deno Edge Functions
- **Pengujian & Bahasa:** TypeScript `^5.8.2`, `tsx ^4.19.2` (`node:test`)

### Struktur Direktori Inti
```text
SajiAman/
├── app/                              # Rute file-based Expo Router
│   ├── _layout.tsx                   # Root layout, ErrorBoundary, fonts, Toast/Offline banner
│   ├── index.tsx                     # Redirect awal berbasis sesi & peran
│   ├── (auth)/                       # Login, registrasi SPPG/NPSN, pemulihan sandi & profil
│   ├── (kitchen)/                    # Beranda Dapur, Produksi AI/Manual, Ompreng, Maggot, Riwayat
│   ├── (school)/                     # Antrean Pra-Tiba, Scanner QR, Evaluasi Aman, Lapor Limbah
│   └── (admin)/                      # Dasbor Pusat Admin BGN & audit lintas SPPG
├── src/
│   ├── adapters/                     # Adapter kamera, haptics, notifikasi lokal, QR SVG, storage
│   ├── components/                   # ErrorBoundary & komponen UI Swiss-Utilitarian
│   ├── config/                       # Validasi variabel lingkungan klien (env.ts)
│   ├── context/                      # State global, clock drift, sync & cache (SajiAmanContext.tsx)
│   ├── data/                         # Repository Supabase async & data simulasi offline
│   ├── domain/                       # Weakest-link engine, parser AI, QR verification & unit tests
│   ├── hooks/                        # Hook pemantau status jaringan (useNetworkStatus.ts)
│   ├── lib/                          # Inisialisasi Supabase client
│   ├── screens/shared/               # Layar profil & pengaturan lintas peran
│   ├── services/                     # Orkestrator kompresi gambar & pemanggil Vision AI
│   └── utils/                        # Generator manifes & rekap berkala PDF/HTML
├── supabase/
│   ├── functions/analyze-meal-sample/# Edge Function Dual-AI Vision (Gemini -> Groq fallback)
│   ├── migrations/                   # 001_sajiaman_init.sql s.d. 013_fix_rls_and_maggot_rpc.sql
│   └── seed.sql                      # Data awal SPPG, sekolah binaan, katalog & akun uji coba
├── app.json                          # Konfigurasi Expo & izin perangkat Android/iOS
├── eas.json                          # Profil build EAS (development, preview APK, production)
└── .env.example                      # Templat variabel lingkungan
```

---

## 4. Panduan Instalasi & Konfigurasi Lokal

### Prasyarat
- **Node.js `>= 22.13.0`** dan `npm`
- **Expo CLI** / **EAS CLI** (`npm install -g eas-cli` jika ingin build APK cloud)
- Proyek **Supabase** aktif (opsional jika hanya menjalankan mode simulasi offline `mock`)

### 1) Instalasi Dependensi & Konfigurasi Environment
```bash
git clone <url-repositori-anda>
cd SajiAman
npm install
```

Salin templat environment ke `.env`:
```bash
cp .env.example .env
```

Atur mode sumber data pada `.env`:
- **Mode Simulasi Offline (`mock`):** Set `EXPO_PUBLIC_DATA_SOURCE=mock` untuk menjalankan seluruh alur secara lokal tanpa koneksi Supabase.
- **Mode Produksi / Live (`supabase`):** Set `EXPO_PUBLIC_DATA_SOURCE=supabase`, lalu isi `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Biarkan `EXPO_PUBLIC_GEMINI_API_KEY` dan `EXPO_PUBLIC_GROQ_API_KEY` kosong di build rilis.

### 2) Setup Database Supabase (`supabase/migrations/` & `seed.sql`)
Jalankan seluruh file migrasi SQL secara berurutan melalui **Supabase SQL Editor** dari awal hingga akhir:
1. `supabase/migrations/001_sajiaman_init.sql`
2. `supabase/migrations/002_enable_realtime_and_anon_access.sql`
3. `supabase/migrations/003_unified_security_and_features.sql`
4. `supabase/migrations/004_fix_security_advisor_and_registration.sql`
5. `supabase/migrations/005_production_security_advisor_hardening.sql`
6. `supabase/migrations/006_multi_tenant_isolation_and_qr_hardening.sql`
7. `supabase/migrations/007_admin_menu_isolation_and_auth_hardening.sql`
8. `supabase/migrations/008_sealed_pre_arrival_notification.sql`
9. `supabase/migrations/009_admin_status_and_reports.sql`
10. `supabase/migrations/010_expanded_categories_and_catalog.sql`
11. `supabase/migrations/011_fix_seal_qr_token_uuid.sql`
12. `supabase/migrations/012_security_hardening_and_audit.sql`
13. `supabase/migrations/013_fix_rls_and_maggot_rpc.sql`
14. *(Opsional data uji coba awal)* `supabase/seed.sql`

### 3) Deploy Edge Function `analyze-meal-sample` & Atur Secrets
Pastikan Supabase CLI sudah terhubung ke proyek Anda, lalu simpan secret penyedia AI di server dan deploy Edge Function:
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>

npx supabase secrets set GEMINI_API_KEY="<YOUR_GEMINI_API_KEY>"
npx supabase secrets set GROQ_API_KEY="<YOUR_GROQ_API_KEY>"
npx supabase secrets set GEMINI_MODEL="gemini-2.5-flash"

npx supabase functions deploy analyze-meal-sample
```

### 4) Menjalankan Aplikasi, Pengujian & Build APK Android
Jalankan Metro bundler dengan cache bersih:
```bash
npx expo start -c
```

Jalankan pemeriksaan tipe TypeScript dan seluruh unit test domain:
```bash
npm run typecheck
npm test
```

Kompilasi APK Android siap uji lapangan melalui Expo EAS (mode rilis otomatis hanya memakai Edge Function server tanpa menyertakan API Key AI di klien):
```bash
eas build -p android --profile preview
```
