export type TutorialAudience = 'overview' | 'kitchen' | 'school' | 'admin';

export interface TutorialSlide {
  stepBadge: string;
  title: string;
  description: string;
  tip: string;
  iconKey: 'cook' | 'qr' | 'shield' | 'recycle' | 'school' | 'admin';
  accentBg: string;
  accentColor: string;
}

export const TUTORIAL_TITLES: Record<TutorialAudience, { heading: string; subtitle: string }> = {
  overview: {
    heading: 'Cara Kerja Ekosistem SajiAman',
    subtitle: 'Alur pengamanan pangan MBG dari dapur hingga sekolah',
  },
  kitchen: {
    heading: 'Panduan Petugas Dapur SPPG',
    subtitle: '3 langkah wajib dari pencatatan masak hingga retur ompreng',
  },
  school: {
    heading: 'Panduan Koordinator Sekolah',
    subtitle: '3 langkah penerimaan boks aman hingga pelaporan sisa makanan',
  },
  admin: {
    heading: 'Panduan Pusat Admin BGN',
    subtitle: 'Kendali unit SPPG, sekolah binaan, akun petugas, dan audit',
  },
};

export const TUTORIAL_SLIDES: Record<TutorialAudience, TutorialSlide[]> = {
  overview: [
    {
      stepBadge: 'LANGKAH 1 • DAPUR SPPG',
      title: 'Catat Masakan & Cetak Segel QR',
      description:
        'Dapur memilih sekolah tujuan, porsi ompreng, dan menu. Sistem otomatis mengunci batas waktu aman berdasarkan menu paling cepat basi (Weakest-Link).',
      tip: 'Contoh: jika ada sayur santan (3,5 jam) & ayam goreng (5 jam), boks terkunci di 3,5 jam.',
      iconKey: 'cook',
      accentBg: '#EBF3FA',
      accentColor: '#0F4C81',
    },
    {
      stepBadge: 'LANGKAH 2 • SEKOLAH PENERIMA',
      title: 'Pindai QR untuk Membuka Boks',
      description:
        'Saat kurir tiba di sekolah, boks masih berstatus TERSEGEL. Koordinator sekolah memindai stiker QR fisik untuk membuka sisa waktu aman & memberi konfirmasi terima.',
      tip: 'Alarm kuning berbunyi otomatis saat sisa waktu aman tinggal 45 menit.',
      iconKey: 'qr',
      accentBg: '#FEF3C7',
      accentColor: '#B45309',
    },
    {
      stepBadge: 'LANGKAH 3 • SIRKULASI & ZERO-WASTE',
      title: 'Retur Ompreng & Maggot BSF',
      description:
        'Setelah siswa selesai makan, sekolah menandai ompreng siap jemput atau melapor sisa makanan/boks basi untuk diolah Mitra BSF menjadi pakan maggot.',
      tip: 'Seluruh rantai waktu terkunci jam server pusat agar tidak bisa dimanipulasi.',
      iconKey: 'recycle',
      accentBg: '#DCFCE7',
      accentColor: '#15803D',
    },
  ],
  kitchen: [
    {
      stepBadge: 'LANGKAH 1 • PRODUKSI',
      title: 'Pilih Sekolah & Komponen Menu',
      description:
        'Tekan "Catat Produksi Batch Baru", pilih sekolah tujuan, jumlah ompreng, dan seluruh menu yang dimasak hari ini. Tidak perlu menghitung jam manual.',
      tip: 'Menu cepat basi seperti santan/kuah otomatis memperketat batas kedaluwarsa batch.',
      iconKey: 'cook',
      accentBg: '#EBF3FA',
      accentColor: '#0F4C81',
    },
    {
      stepBadge: 'LANGKAH 2 • SEGEL QR',
      title: 'Foto Sampel & Tempel Stiker QR',
      description:
        'Ambil foto sampel makanan hangat untuk bukti audit, lalu cetak atau bagikan label QR PDF untuk ditempel di boks ompreng.',
      tip: 'Salah input? Gunakan tombol Batalkan (Void) dari detail batch sebelum dikonsumsi.',
      iconKey: 'qr',
      accentBg: '#EEF2FF',
      accentColor: '#4338CA',
    },
    {
      stepBadge: 'LANGKAH 3 • OMPRENG & BSF',
      title: 'Lacak Ompreng & Tugaskan BSF',
      description:
        'Pantau pergerakan ompreng (Dikirim → Sekolah → Kembali Steril) di tab Ompreng, dan tugaskan penjemputan Mitra BSF di tab Maggot bila ada laporan sisa.',
      tip: 'Tekan "Konfirmasi Kembali & Steril" saat wadah sudah dicuci di dapur.',
      iconKey: 'recycle',
      accentBg: '#DCFCE7',
      accentColor: '#15803D',
    },
  ],
  school: [
    {
      stepBadge: 'LANGKAH 1 • PINDAI SEGEL',
      title: 'Scan QR Stiker Boks Saat Tiba',
      description:
        'Antrian masuk berstatus TERSEGEL agar batas aman tidak ditebak-tebak. Arahkan kamera ke stiker QR pada boks (atau pakai Input Kode Manual) untuk membukanya.',
      tip: 'Gunakan tombol Senter bila pencahayaan ruang penerimaan redup.',
      iconKey: 'qr',
      accentBg: '#EBF3FA',
      accentColor: '#0F4C81',
    },
    {
      stepBadge: 'LANGKAH 2 • VERIFIKASI',
      title: 'Periksa Lampu Status & Konfirmasi',
      description:
        'Hijau berarti aman dibagikan; Kuning (< 45 menit) harap segera habiskan; Merah berarti kedaluwarsa/terkunci dan wajib ditolak.',
      tip: 'Cocokkan jumlah fisik ompreng sebelum menekan "Konfirmasi Terima Boks".',
      iconKey: 'shield',
      accentBg: '#FEF3C7',
      accentColor: '#B45309',
    },
    {
      stepBadge: 'LANGKAH 3 • PASCA-MAKAN',
      title: 'Lapor Sisa Porsi & Siap Jemput',
      description:
        'Usai jam makan siswa, buka Riwayat Boks untuk melapor sisa makanan ke jalur Maggot BSF dan menandai ompreng bersih siap dijemput kurir SPPG.',
      tip: 'Data laporan langsung memicu penugasan penjemputan ke Dapur SPPG.',
      iconKey: 'recycle',
      accentBg: '#DCFCE7',
      accentColor: '#15803D',
    },
  ],
  admin: [
    {
      stepBadge: 'LANGKAH 1 • UNIT & SEKOLAH',
      title: 'Kelola SPPG & Sekolah Binaan',
      description:
        'Admin BGN adalah satu-satunya otoritas pembuat kode SPPG dan pengait sekolah (NPSN) ke dapur pembina agar pendaftaran petugas selalu valid.',
      tip: 'Gunakan tab SPPG dan Sekolah untuk menambah unit baru atau memperbarui kuota porsi.',
      iconKey: 'admin',
      accentBg: '#EBF3FA',
      accentColor: '#0F4C81',
    },
    {
      stepBadge: 'LANGKAH 2 • PULIHKAN AKUN',
      title: 'Tangani Akun Petugas Orphan',
      description:
        'Jika kartu Akun berkedip merah menandakan ada akun Orphan (belum terhubung ke unit), buka tab Akun dan gunakan filter Orphan untuk menugaskannya.',
      tip: 'Akun petugas hanya bisa mencatat atau memindai setelah terhubung ke unit resmi.',
      iconKey: 'school',
      accentBg: '#FEE2E2',
      accentColor: '#B91C1C',
    },
    {
      stepBadge: 'LANGKAH 3 • AUDIT NASIONAL',
      title: 'Pantau Batch Lintas SPPG',
      description:
        'Di tab Batch, pantau boks ditolak basi, void, dan total kg Maggot BSF. Ketuk kartu batch mana saja untuk membuka detail menu dan bukti insiden.',
      tip: 'Tarik layar ke bawah kapan saja untuk menyegarkan snapshot nasional.',
      iconKey: 'shield',
      accentBg: '#DCFCE7',
      accentColor: '#15803D',
    },
  ],
};
