# TUMBUH F&B — Prototype PWA v0.1.0

Prototype awal kasir dan pengendali kesehatan usaha UMKM makanan/minuman. Dibuat tanpa framework dan tanpa layanan berbayar agar mudah diperiksa serta dikembangkan.

## Isi paket
- `index.html` — kerangka aplikasi.
- `styles.css` — tampilan responsif untuk HP dan desktop.
- `app.js` — kasir, produk/HPP, stok, pengeluaran, laporan, backup/restore.
- `sw.js` — cache app shell agar layar aplikasi dapat dibuka offline setelah pernah dimuat.
- `manifest.webmanifest` dan `icon.svg` — metadata PWA.
- `MODEL-DATA-DAN-RUMUS.md` — model data dan aturan perhitungan.
- `ALUR-LAYAR.md` — alur pengguna dan struktur layar.

## Menjalankan
Untuk uji cepat, buka `index.html` di browser modern. Penyimpanan lokal mungkin bergantung pada dukungan browser terhadap `file://`.

**Agar kemampuan PWA/offline penuh aktif, aplikasi harus disajikan melalui HTTPS atau localhost.** Service Worker tidak berjalan dari alamat `file://`.

Pilihan hosting statis HTTPS tanpa biaya hosting:
1. Buat repository GitHub baru.
2. Unggah seluruh isi folder ini ke root repository.
3. Buka Settings → Pages.
4. Pilih deploy dari branch `main`, folder `/root`.
5. Setelah GitHub Pages memberi alamat HTTPS, buka alamat tersebut di Chrome Android.
6. Muat aplikasi sekali saat online, lalu gunakan menu browser “Tambahkan ke layar utama” atau “Install app” jika tersedia.
7. Uji mode pesawat setelah aplikasi berhasil dimuat.

Nama menu GitHub dapat berubah mengikuti tampilan perangkat. Hosting pihak ketiga tidak disertakan dalam paket ini.

## Data contoh
Aplikasi pertama kali membuat data contoh Es Teh. Tekan **Hapus data contoh** di Ringkasan sebelum memasukkan data usaha sungguhan. Data contoh tidak mewakili harga pasar atau rekomendasi harga.

## Uji manual minimum
- [ ] Tambahkan bahan baru.
- [ ] Catat stok masuk dan periksa biaya rata-rata.
- [ ] Buat produk dengan resep.
- [ ] Pastikan HPP = jumlah takaran × biaya rata-rata bahan.
- [ ] Simpan transaksi tunai dan non-tunai.
- [ ] Pastikan stok bahan berkurang.
- [ ] Catat biaya operasional tunai dan non-tunai.
- [ ] Pastikan laba bersih = omzet − HPP − biaya operasional.
- [ ] Pastikan kas tunai = kas awal + penjualan tunai − pengeluaran tunai − pembelian stok tunai.
- [ ] Ekspor backup, pulihkan backup, dan cocokkan data.
- [ ] Muat aplikasi online, aktifkan mode pesawat, tutup/buka kembali aplikasi, lalu uji transaksi offline.
- [ ] Uji di beberapa perangkat Android dan versi Chrome.

## Status yang jujur
Ini prototype awal, **belum layak dipakai sebagai satu-satunya catatan keuangan usaha produksi**. Belum ada sinkronisasi cloud, akun, enkripsi backup, retur, rekonsiliasi bank/QRIS, pajak, dan audit trail. Uji offline penuh harus dilakukan setelah paket dipasang pada origin HTTPS.
