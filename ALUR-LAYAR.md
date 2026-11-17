# TUMBUH F&B — alur pengguna dan layar v0.1

## Alur pertama kali
1. Buka aplikasi dan tinjau data contoh.
2. Hapus data contoh sebelum penggunaan usaha nyata.
3. Tambahkan bahan baku beserta satuan dasar.
4. Catat stok awal melalui formulir pembelian/stok masuk.
5. Buat produk dan resep per porsi.
6. Periksa HPP dan harga jual.
7. Gunakan Kasir untuk mencatat transaksi.
8. Catat biaya operasional di menu Pengeluaran.
9. Tinjau Ringkasan dan Laporan.
10. Ekspor backup JSON secara berkala.

## Struktur layar
- **Ringkasan:** omzet bulan ini, laba bersih tercatat, kas tunai, biaya operasional, peringatan HPP/stok, transaksi terbaru.
- **Kasir:** katalog produk, keranjang, jumlah, metode pembayaran, simpan transaksi.
- **Produk & HPP:** buat produk, susun resep per porsi, lihat HPP dan margin indikatif.
- **Stok bahan:** tambah bahan, catat pembelian, lihat jumlah dan biaya rata-rata stok.
- **Pengeluaran:** biaya operasional dan riwayatnya.
- **Laporan:** omzet, HPP terjual, laba kotor, biaya operasional, laba bersih, kas tunai, transaksi terbaru.
- **Pengaturan:** nama usaha, kas tunai awal, ekspor/pemulihan backup, batasan prototype.

## Keputusan UX
- Bahasa Indonesia sederhana.
- Navigasi utama ringkas untuk layar HP.
- Tindakan transaksi utama dapat dilakukan dengan beberapa ketukan.
- Angka contoh diberi label sebagai data contoh.
- Peringatan HPP tidak lengkap ditampilkan sebelum pengguna mengandalkan laporan laba.
