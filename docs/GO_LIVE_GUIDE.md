# Panduan Rilis Produksi & Deployment SajiAman MBG
**SajiAman: Platform Pengawasan Keamanan Pangan & Rantai Dingin MBG**

Dokumen ini memuat panduan lengkap penerapan Supabase Edge Function AI, pengerasan keamanan database (Security Advisor), dan kompilasi APK mandiri (*standalone*) Android untuk pengujian lapangan dengan 2 perangkat HP.

---

## 1. Arsitektur Komponen Baru

```
[Kamera HP Dapur] 
       │ (Live Capture)
       ▼
[Image Manipulator] ──> Kompresi Web/Native (1024px, JPEG 0.72)
       │
       ▼
[Supabase Edge Function: analyze-meal-sample]
       │ (JWT Auth Guard + Size Guard < 4MB)
       ▼
[Gemini Vision AI Engine]
       │
       ├─ Validasi Nampan Stainless MBG
       ├─ Verifikasi 4 Komponen Gizi (Karbohidrat, Protein, Sayur, Buah)
       ├─ Deteksi Komponen Basah/Bersantan (Weakest-Link 3,5 Jam Lock)
       └─ Skor Keyakinan (Confidence Score)
       │
       ▼
[Dapur SPPG UI] ──> Tampilkan Badge Gizi & Kunci Waktu Masak
       │
       ▼ (Segel Batch SHA-256)
[Supabase PostgreSQL + Storage sample-photos]
       │
       ▼ (Realtime WebSocket / QR Scan)
[HP Koordinator Sekolah]
       ├─ NTP Clock Lock & Tamper Detection
       ├─ Background OS Alarms (Warning 45m & Hard-Lock Red)
       └─ Offline Cache Persistence (Bebas Masalah Koneksi Siang Hari)
```

---

## 2. Deploy Supabase Edge Function (Gemini Vision AI)

Edge Function terletak di `supabase/functions/analyze-meal-sample/index.ts`. Fungsi ini dilindungi oleh Supabase JWT Auth Guard dan membaca `GEMINI_API_KEY` langsung dari environment Deno tanpa pernah mengeksposnya ke aplikasi mobile.

### Langkah Deploy:
1. Pastikan Supabase CLI terpasang dan login:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```

2. Simpan rahasia API Key AI Vision di Supabase Secrets:
   ```bash
   npx supabase secrets set GEMINI_API_KEY="<YOUR_GEMINI_API_KEY>"
   npx supabase secrets set GROQ_API_KEY="<YOUR_GROQ_API_KEY>"
   npx supabase secrets set GEMINI_MODEL="gemini-2.5-flash"
   ```
   *(Catatan: Model default adalah `gemini-2.5-flash`. Jika Anda ingin menggunakan `gemini-4-hydrogen`, atur parameter `GEMINI_MODEL="gemini-4-hydrogen"`)*.

3. Deploy Edge Function ke Supabase:
   ```bash
   npx supabase functions deploy analyze-meal-sample
   ```

4. Verifikasi status deployment di dashboard Supabase:
   - Masuk ke **Edge Functions** -> Pastikan status `analyze-meal-sample` berwarna hijau / active.

---

## 3. Eksekusi Pengerasan Security Advisor Supabase

Berdasarkan tinjauan panel **Security Advisor** di Supabase Dashboard Anda:
- `Security Definer View` -> `public.v_kitchen_impact_metrics` (CRITICAL)
- `Auth RLS Initialization Plan` -> `public.profiles`
- `Function Search Path Mutable` -> `public.current_user_profile`, `public.my_kitchen_id`, dll.
- `Public Can Execute SECURITY DEFINER Function` -> `seal_production_batch`, `confirm_ompreng_receipt`, dll.

### Solusi:
Buka menu **SQL Editor** di Dashboard Supabase Anda, buat query baru, lalu salin dan jalankan seluruh isi file migrasi:
📁 `supabase/migrations/005_production_security_advisor_hardening.sql`

Setelah dijalankan:
1. `v_kitchen_impact_metrics` diubah menjadi `security_invoker = true` sehingga mematuhi RLS caller (menghilangkan status CRITICAL).
2. Kebijakan RLS pada tabel `profiles` menggunakan scalar subquery `(SELECT auth.uid())` dan dilengkapi indeks pada `kitchen_id` dan `school_id`, sehingga query plan menjadi optimal.
3. Seluruh fungsi PostgreSQL ditambahkan deklarasi `SET search_path = public`, menutup celah mutable search path.
4. Izin eksekusi publik (`PUBLIC`) pada fungsi-fungsi penanganan data operasional dicabut (`REVOKE`), dan dibatasi hanya untuk role `authenticated`.

---

## 4. Kompilasi APK Standalone untuk Android (`.apk`)

Konfigurasi build telah disiapkan di `eas.json` dengan profile `preview` yang menghasilkan berkas APK mandiri yang dapat langsung diinstal ke HP tanpa melalui Google Play Store.

### Langkah Build APK:
1. Pastikan EAS CLI terpasang:
   ```bash
   npm install -g eas-cli
   ```

2. Login ke akun Expo Anda:
   ```bash
   eas login
   ```

3. Jalankan kompilasi APK:
   ```bash
   eas build --platform android --profile preview
   ```

4. Tunggu proses kompilasi selesai di server Expo EAS Cloud (sekitar 5–10 menit). Setelah selesai, unduh berkas `.apk` dari tautan yang diberikan di terminal atau dashboard Expo Anda, lalu bagikan ke ponsel pengujian via WhatsApp/Google Drive.

---

## 5. Skenario Uji Lapangan 2 Perangkat (Field-Test Protocol)

### Perangkat A (HP Chef Dapur SPPG):
1. **Login Akun Dapur**:
   - Buka aplikasi SajiAman -> Masuk menggunakan akun Chef SPPG resmi.
2. **Catat Produksi Batch**:
   - Pilih menu **Catat Produksi Batch**.
   - Pilih tab **Mode Foto Sampel AI**.
   - Ambil foto baki sampel MBG live (atau gunakan tombol *Uji Sampel Baki*).
   - Perhatikan bahwa:
     - Foto otomatis dikompresi ke 1024px.
     - Strip verifikasi AI memeriksa 4 komponen gizi (Karbohidrat, Protein, Sayur, Buah).
     - Sayur bersantan (Lodeh) otomatis mengunci batas konsumsi menjadi 3,5 jam.
     - Jika foto bukan makanan (contoh: diarahkan ke lantai/wajah), AI menolak baki dan tombol segel dinonaktifkan.
3. **Segel Batch Produksi**:
   - Tekan **Selesai Masak & Segel Boks**.
   - Foto terunggah ke Supabase Storage `sample-photos`.
   - Kode QR berstempel SHA-256 muncul di layar detail batch.

### Perangkat B (HP Koordinator Sekolah):
1. **Login Akun Sekolah**:
   - Buka aplikasi SajiAman -> Masuk menggunakan akun Koordinator Sekolah resmi.
2. **Pindai QR Boks**:
   - Buka tab **Pindai QR MBG**.
   - Arahkan kamera HP ke kode QR di layar HP Dapur (atau gunakan tombol input kode batch manual).
   - Layar hasil evaluasi langsung membaca waktu server terkunci (Anti-Tampering).
3. **Uji Manipulasi Waktu (Tamper Test)**:
   - Ubah jam HP Sekolah mundur 2 jam di pengaturan Android.
   - Buka kembali SajiAman -> Banner merah **Manipulasi Waktu Terdeteksi** otomatis muncul, dan evaluasi kelayakan makanan tetap patuh pada waktu server SPPG.
4. **Konfirmasi Terima & Alarm OS**:
   - Tekan **Konfirmasi Terima Lengkap**.
   - Sistem menjadwalkan 2 alarm notifikasi di Android OS:
     - **Alarm Peringatan (Kuning)**: 45 menit sebelum kedaluwarsa.
     - **Alarm Hard-Lock (Merah)**: Saat batas waktu aman habis.
5. **Uji Mode Offline**:
   - Matikan koneksi Wi-Fi dan Data Seluler pada HP Sekolah.
   - Perhatikan banner kuning tipis muncul: *Koneksi Terputus • Menggunakan Data Cache Lokal SajiAman*.
   - Data batch sebelumnya tetap dapat diakses tanpa layar putih/crash berkat sistem cache persisten.
6. **Uji Penolakan Makanan Rusak (Force Red Override)**:
   - Tekan tombol **Tolak Boks / Kondisi Makanan Rusak**.
   - Masukkan alasan penolakan (misal: *Berbau asam saat dibuka*).
   - Status boks langsung terkunci menjadi **MERAH DARURAT** dan siswa dilarang mengonsumsi, dengan opsi pengalihan ke jalur pakan maggot BSF.
